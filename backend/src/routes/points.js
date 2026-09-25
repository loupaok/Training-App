import express from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { wcRequest, createCoupon } from '../lib/woocommerce.js';
import { sendMail } from '../lib/mailer.js';

const router = express.Router();

export async function ensurePointsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS points_settings (
      id INT DEFAULT 1 PRIMARY KEY,
      points_per_euro INT DEFAULT 100,
      euro_per_points INT DEFAULT 100,
      coupon_expiry_days INT DEFAULT 30,
      min_points_redeem INT DEFAULT 100,
      max_discount_percent INT DEFAULT 50,
      is_active BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await connection.query(
    'INSERT IGNORE INTO points_settings (id, points_per_euro, euro_per_points) VALUES (1, 1, 100)'
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS client_points (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      total_points INT DEFAULT 0,
      used_points INT DEFAULT 0,
      available_points INT GENERATED ALWAYS AS (total_points - used_points) STORED,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_client (client_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS points_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      type ENUM('earned', 'redeemed', 'expired', 'adjusted') NOT NULL,
      points INT NOT NULL,
      description VARCHAR(255),
      reference_id INT NULL,
      reference_type VARCHAR(50) NULL,
      coupon_code VARCHAR(100) NULL,
      wc_coupon_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

// Best-effort points award — called after a payment is recorded as completed
// (manual entry or bank-transfer approval). Never throws: a points-system
// hiccup must not undo or fail the payment it's attached to.
export async function awardPoints(connection, { clientId, planId, paymentId }) {
  try {
    if (!planId) return;
    await ensurePointsSchema(connection);
    const [plans] = await connection.query('SELECT name, points_reward FROM pricing_plans WHERE id = ?', [planId]);
    const reward = Number(plans[0]?.points_reward) || 0;
    if (reward <= 0) return;

    await connection.query(
      `INSERT INTO client_points (client_id, total_points) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE total_points = total_points + ?`,
      [clientId, reward, reward]
    );
    await connection.query(
      `INSERT INTO points_transactions (client_id, type, points, description, reference_id, reference_type)
       VALUES (?, 'earned', ?, ?, ?, 'payment')`,
      [clientId, reward, `Πληρωμή ${plans[0]?.name || ''}`.trim(), paymentId || null]
    );
  } catch (error) {
    console.error('Points award failed:', error);
  }
}

router.get('/settings', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePointsSchema(connection);
    const [rows] = await connection.query('SELECT * FROM points_settings WHERE id = 1');
    connection.release();
    res.json(rows[0] || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/settings', authenticateToken, authorizeRole(['coach']), [
  body('pointsPerEuro').optional().isInt({ min: 0 }),
  body('euroPerPoints').optional().isInt({ min: 1 }),
  body('couponExpiryDays').optional().isInt({ min: 1 }),
  body('minPointsRedeem').optional().isInt({ min: 0 }),
  body('maxDiscountPercent').optional().isInt({ min: 0, max: 100 }),
  body('isActive').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensurePointsSchema(connection);
    const current = (await connection.query('SELECT * FROM points_settings WHERE id = 1'))[0][0];

    await connection.query(
      `UPDATE points_settings
       SET points_per_euro = ?, euro_per_points = ?, coupon_expiry_days = ?, min_points_redeem = ?,
           max_discount_percent = ?, is_active = ?
       WHERE id = 1`,
      [
        req.body.pointsPerEuro ?? current.points_per_euro,
        req.body.euroPerPoints ?? current.euro_per_points,
        req.body.couponExpiryDays ?? current.coupon_expiry_days,
        req.body.minPointsRedeem ?? current.min_points_redeem,
        req.body.maxDiscountPercent ?? current.max_discount_percent,
        req.body.isActive === undefined ? current.is_active : (req.body.isActive ? 1 : 0),
      ]
    );

    const [rows] = await connection.query('SELECT * FROM points_settings WHERE id = 1');
    connection.release();
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

async function getClientPointsPayload(connection, clientId) {
  const [pointsRows] = await connection.query('SELECT * FROM client_points WHERE client_id = ?', [clientId]);
  const [transactions] = await connection.query(
    'SELECT * FROM points_transactions WHERE client_id = ? ORDER BY created_at DESC LIMIT 50',
    [clientId]
  );
  const points = pointsRows[0] || { total_points: 0, used_points: 0, available_points: 0 };
  return {
    totalPoints: points.total_points,
    usedPoints: points.used_points,
    availablePoints: points.available_points,
    transactions,
  };
}

router.get('/my', authenticateToken, authorizeRole(['client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePointsSchema(connection);
    const payload = await getClientPointsPayload(connection, req.user.id);
    connection.release();
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/client/:id', authenticateToken, authorizeRole(['coach']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePointsSchema(connection);
    const payload = await getClientPointsPayload(connection, Number(req.params.id));
    connection.release();
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/award', authenticateToken, authorizeRole(['coach']), [
  body('clientId').isInt({ gt: 0 }),
  body('points').isInt(),
  body('description').optional({ nullable: true }).isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensurePointsSchema(connection);
    const { clientId, points, description } = req.body;

    await connection.query(
      `INSERT INTO client_points (client_id, total_points) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE total_points = total_points + ?`,
      [clientId, points, points]
    );
    await connection.query(
      `INSERT INTO points_transactions (client_id, type, points, description)
       VALUES (?, 'adjusted', ?, ?)`,
      [clientId, points, description || 'Χειροκίνητη προσθήκη από coach']
    );

    const payload = await getClientPointsPayload(connection, clientId);
    connection.release();
    res.status(201).json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/redeem', authenticateToken, authorizeRole(['client']), [
  body('pointsToRedeem').isInt({ gt: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    await ensurePointsSchema(connection);
    const { pointsToRedeem } = req.body;

    const [settingsRows] = await connection.query('SELECT * FROM points_settings WHERE id = 1');
    const settings = settingsRows[0];
    if (!settings?.is_active) {
      connection.release();
      return res.status(400).json({ message: 'Το πρόγραμμα πόντων δεν είναι ενεργό.' });
    }
    if (pointsToRedeem < settings.min_points_redeem) {
      connection.release();
      return res.status(400).json({ message: `Ελάχιστοι πόντοι για εξαργύρωση: ${settings.min_points_redeem}.` });
    }

    const [pointsRows] = await connection.query('SELECT * FROM client_points WHERE client_id = ?', [req.user.id]);
    const available = pointsRows[0]?.available_points || 0;
    if (available < pointsToRedeem) {
      connection.release();
      return res.status(400).json({ message: 'Δεν έχεις αρκετούς διαθέσιμους πόντους.' });
    }

    const [userRows] = await connection.query('SELECT email, full_name FROM users WHERE id = ?', [req.user.id]);
    const client = userRows[0];

    const discount = Math.round((pointsToRedeem / settings.euro_per_points) * 100) / 100;
    const couponCode = `COACH-${req.user.id}-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    let coupon;
    try {
      coupon = await createCoupon({
        code: couponCode,
        amount: discount,
        clientEmail: client.email,
        expiryDays: settings.coupon_expiry_days,
      });
    } catch (wcError) {
      connection.release();
      console.error('WooCommerce coupon creation failed:', wcError);
      return res.status(502).json({ message: `Δεν ήταν δυνατή η δημιουργία coupon: ${wcError.message}` });
    }

    await connection.beginTransaction();
    await connection.query('UPDATE client_points SET used_points = used_points + ? WHERE client_id = ?', [pointsToRedeem, req.user.id]);
    await connection.query(
      `INSERT INTO points_transactions (client_id, type, points, description, coupon_code, wc_coupon_id)
       VALUES (?, 'redeemed', ?, ?, ?, ?)`,
      [req.user.id, pointsToRedeem, `Coupon ${couponCode}`, couponCode, coupon?.id || null]
    );
    await connection.commit();

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + settings.coupon_expiry_days);

    try {
      await sendMail({
        to: client.email,
        subject: 'Το coupon έκπτωσης σου είναι έτοιμο! 🎁',
        html: `<p>Γεια σου ${client.full_name || ''},</p><p>Δημιουργήθηκε coupon έκπτωσης <strong>${discount}€</strong> από την εξαργύρωση των πόντων σου.</p><p>Κωδικός: <strong>${couponCode}</strong></p><p>Λήγει: ${expiryDate.toLocaleDateString('el-GR')}</p>`,
      });
    } catch (mailError) {
      console.error('Points redeem email failed:', mailError);
    }

    res.status(201).json({ couponCode, discount, expiryDate });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/wc-test', authenticateToken, authorizeRole(['coach']), async (req, res) => {
  try {
    const status = await wcRequest('GET', '/system_status');
    res.json({ connected: true, store: status?.environment?.site_url || 'WooCommerce' });
  } catch (error) {
    res.json({ connected: false, message: error.message });
  }
});

export default router;
