import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRoleOrPermission } from '../middleware/auth.js';
import { sendPushToUsers } from '../lib/webPush.js';

const router = express.Router();

async function ensureManualNotificationsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS manual_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      audience VARCHAR(30) NOT NULL DEFAULT 'all_active',
      recipient_count INT NOT NULL DEFAULT 0,
      link_url VARCHAR(500) NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      link_url VARCHAR(500),
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_read_at (read_at)
    )
  `);

  for (const statement of [
    "ALTER TABLE manual_notifications ADD COLUMN audience VARCHAR(30) NOT NULL DEFAULT 'all_active'",
    'ALTER TABLE manual_notifications ADD COLUMN recipient_count INT NOT NULL DEFAULT 0',
    'ALTER TABLE manual_notifications ADD COLUMN link_url VARCHAR(500) NULL',
    'ALTER TABLE notifications ADD COLUMN client_id INT NULL',
    'ALTER TABLE notifications ADD COLUMN payment_id INT NULL',
    'ALTER TABLE notifications ADD COLUMN manual_notification_id INT NULL'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

// List broadcasts, newest first (Admin only)
router.get('/', authorizeRoleOrPermission(['admin'], 'send_announcements'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureManualNotificationsSchema(connection);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [[countRow]] = await connection.query('SELECT COUNT(*) AS total FROM manual_notifications');
    const [rows] = await connection.query(
      `SELECT mn.id, mn.title, mn.body, mn.audience, mn.recipient_count, mn.link_url, mn.created_at, u.full_name AS created_by_name
       FROM manual_notifications mn
       JOIN users u ON u.id = mn.created_by
       ORDER BY mn.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const total = Number(countRow?.total || 0);
    res.json({ items: rows, page, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/recipients', authorizeRoleOrPermission(['admin'], 'send_announcements'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT id, full_name, email, profile_photo
       FROM users
       WHERE role = 'client' AND is_active = 1
       ORDER BY full_name, email`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not load recipients.' });
  } finally {
    connection.release();
  }
});

function recipientsQuery(audience, recipientIds) {
  if (audience === 'active_clients') {
    return ['SELECT id FROM users WHERE role = "client" AND is_active = 1 AND status = "active"', []];
  }
  if (audience === 'coaches') {
    return ['SELECT id FROM users WHERE role IN ("admin", "coach", "moderator") AND is_active = 1', []];
  }
  if (audience === 'selected_clients') {
    return ['SELECT id FROM users WHERE role = "client" AND is_active = 1 AND id IN (?)', [recipientIds]];
  }
  return ['SELECT id FROM users WHERE is_active = 1 AND (role <> "client" OR status = "active")', []];
}

// Create a broadcast and fan it out to the chosen recipients (Admin only)
router.post('/', authorizeRoleOrPermission(['admin'], 'send_announcements'), [
  body('title').isString().trim().isLength({ min: 1, max: 255 }),
  body('body').isString().trim().isLength({ min: 1, max: 4000 }),
  body('audience').isIn(['all_active', 'active_clients', 'coaches', 'selected_clients']),
  body('recipientIds').optional().isArray(),
  body('recipientIds.*').optional().isInt(),
  body('linkUrl').optional({ checkFalsy: true }).custom((value) => {
    const link = String(value).trim();
    if (link.startsWith('/')) return true;
    try {
      const url = new URL(link);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      throw new Error('Ο σύνδεσμος πρέπει να είναι εσωτερική διαδρομή ή πλήρες URL.');
    }
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();
  try {
    await ensureManualNotificationsSchema(connection);
    const { title, body, audience, linkUrl } = req.body;
    const recipientIds = [...new Set((req.body.recipientIds || []).map(Number).filter(Number.isInteger))];
    if (audience === 'selected_clients' && recipientIds.length === 0) {
      return res.status(400).json({ message: 'Επίλεξε τουλάχιστον έναν πελάτη.' });
    }
    const [recipientSql, recipientValues] = recipientsQuery(audience, recipientIds);
    const [users] = await connection.query(recipientSql, recipientValues);
    if (!users.length) return res.status(400).json({ message: 'Δεν βρέθηκαν ενεργοί παραλήπτες για αυτή την επιλογή.' });

    await connection.beginTransaction();
    const [result] = await connection.query(
      'INSERT INTO manual_notifications (title, body, audience, recipient_count, link_url, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title.trim(), body.trim(), audience, users.length, String(linkUrl || '').trim() || null, req.user.id]
    );
    const manualNotificationId = result.insertId;

    const placeholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    await connection.query(
      `INSERT INTO notifications (user_id, manual_notification_id, type, title, body, link_url) VALUES ${placeholders}`,
      users.flatMap((user) => [user.id, manualNotificationId, 'admin_broadcast', title.trim(), body.trim(), String(linkUrl || '').trim() || null])
    );
    await connection.commit();

    try {
      await sendPushToUsers(users.map((user) => user.id), { title: title.trim(), body: body.trim(), url: String(linkUrl || '').trim() || '/' });
    } catch (pushError) {
      console.error('Push notification failed:', pushError.message);
    }

    res.status(201).json({ message: 'Notification sent', id: manualNotificationId, recipientCount: users.length });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// Delete a broadcast and its fanned-out notifications (Admin only)
router.delete('/:id', authorizeRoleOrPermission(['admin'], 'send_announcements'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureManualNotificationsSchema(connection);
    await connection.query('DELETE FROM notifications WHERE manual_notification_id = ?', [req.params.id]);
    const [result] = await connection.query('DELETE FROM manual_notifications WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

export default router;
