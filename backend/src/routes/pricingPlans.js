import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// New plans requested for the public pricing redesign — added alongside the
// existing seeded plans (Basic/Pro/Elite), never replacing them, since a
// coach may have already customized those via the admin page.
const newSeedPlans = [
  {
    slug: 'vasiko',
    name: 'Βασικό',
    badge: '',
    description: '',
    price: 80,
    currency: 'EUR',
    period: 'Μηνιαίο',
    themeColor: '#EF4444',
    isPopular: false,
    sortOrder: 4,
    features: [
      { text: 'Πρόγραμμα Προπόνησης', included: true },
      { text: 'Εβδομαδιαίο Check-in', included: true },
      { text: 'Παρακολούθηση Προόδου', included: true },
    ],
  },
  {
    slug: 'premium',
    name: 'Premium',
    badge: 'Δημοφιλές',
    description: '',
    price: 120,
    currency: 'EUR',
    period: 'Μηνιαίο',
    themeColor: '#EF4444',
    isPopular: true,
    sortOrder: 5,
    features: [
      { text: 'Πρόγραμμα Προπόνησης', included: true },
      { text: 'Εβδομαδιαίο Check-in', included: true },
      { text: 'Παρακολούθηση Προόδου', included: true },
      { text: 'Πρόγραμμα Διατροφής', included: true },
      { text: 'Άμεση Επικοινωνία', included: true },
      { text: 'Απεριόριστες Αλλαγές Πλάνου', included: true },
    ],
  },
];

// Soft/optional authentication — populates req.user if a valid token is
// present (cookie or header), but never rejects the request when absent or
// invalid. Lets the public pricing endpoint keep its existing behavior for
// already-logged-in coaches/admins (see all plans by default) while also
// genuinely working for anonymous marketing-page visitors.
async function attachUserIfPresent(req, _res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const cookieToken = (req.headers.cookie || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('accessToken='))
    ?.slice('accessToken='.length);
  const token = cookieToken || bearerToken;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.id, email: payload.email, role: payload.role };
    } catch {
      // Invalid/expired token on a public route — just proceed as anonymous.
    }
  }
  next();
}

const defaultPlans = [
  {
    slug: 'basic',
    name: 'Basic',
    badge: '',
    description: 'Για όσους θέλουν μια καθαρή αρχή με βασική καθοδήγηση.',
    price: 29,
    currency: 'EUR',
    period: 'Μηνιαίο',
    themeColor: '#22C55E',
    sortOrder: 1,
    features: [
      { text: 'Προπονητικό πλάνο', included: true },
      { text: 'Παρακολούθηση προόδου', included: true },
      { text: 'Υποστήριξη μέσω μηνυμάτων', included: false },
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    badge: 'Πιο δημοφιλές',
    description: 'Για όσους θέλουν σοβαρή καθοδήγηση και καλύτερα αποτελέσματα.',
    price: 49,
    currency: 'EUR',
    period: 'Μηνιαίο',
    themeColor: '#EF4444',
    sortOrder: 2,
    features: [
      { text: 'Προπονητικό πλάνο', included: true },
      { text: 'Διατροφικό πλάνο', included: true },
      { text: 'Παρακολούθηση προόδου', included: true },
      { text: 'Υποστήριξη μέσω μηνυμάτων', included: true },
      { text: '2 προσαρμογές πλάνου / μήνα', included: false },
    ],
  },
  {
    slug: 'elite',
    name: 'Elite',
    badge: '',
    description: 'Για πλήρη παρακολούθηση, περισσότερη υποστήριξη και custom προσέγγιση.',
    price: 79,
    currency: 'EUR',
    period: 'Μηνιαίο',
    themeColor: '#8B5CF6',
    sortOrder: 3,
    features: [
      { text: 'Προπονητικό πλάνο', included: true },
      { text: 'Διατροφικό πλάνο', included: true },
      { text: 'Παρακολούθηση προόδου', included: true },
      { text: 'Προτεραιότητα στα μηνύματα', included: true },
      { text: 'Προσαρμογές πλάνου κάθε εβδομάδα', included: true },
    ],
  },
];

export async function ensurePricingPlansSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(80) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      badge VARCHAR(120),
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
      period VARCHAR(80) NOT NULL DEFAULT 'Μηνιαίο',
      theme_color VARCHAR(20) NOT NULL DEFAULT '#EF4444',
      features_json JSON,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_active_order (is_active, sort_order)
    )
  `);

  for (const statement of [
    'ALTER TABLE pricing_plans ADD COLUMN is_popular TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE pricing_plans ADD COLUMN points_reward INT NOT NULL DEFAULT 0',
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }

  const [rows] = await connection.query('SELECT COUNT(*) AS total FROM pricing_plans');
  if (Number(rows[0]?.total || 0) === 0) {
    await connection.query(
      `INSERT INTO pricing_plans
        (slug, name, badge, description, price, currency, period, theme_color, features_json, is_active, sort_order, is_popular)
       VALUES ?`,
      [defaultPlans.map((plan) => [
        plan.slug,
        plan.name,
        plan.badge,
        plan.description,
        plan.price,
        plan.currency,
        plan.period,
        plan.themeColor,
        JSON.stringify(plan.features),
        1,
        plan.sortOrder,
        plan.badge === 'Πιο δημοφιλές' ? 1 : 0,
      ])]
    );
  }

  // Add the two new business plans alongside whatever already exists —
  // never touches/replaces existing rows, only inserts if not already there.
  for (const plan of newSeedPlans) {
    const [existing] = await connection.query('SELECT id FROM pricing_plans WHERE slug = ? LIMIT 1', [plan.slug]);
    if (existing.length) continue;
    await connection.query(
      `INSERT INTO pricing_plans
        (slug, name, badge, description, price, currency, period, theme_color, features_json, is_active, sort_order, is_popular)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        plan.slug,
        plan.name,
        plan.badge,
        plan.description,
        plan.price,
        plan.currency,
        plan.period,
        plan.themeColor,
        JSON.stringify(plan.features),
        plan.sortOrder,
        plan.isPopular ? 1 : 0,
      ]
    );
  }
}

export async function ensurePaymentSettingsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id TINYINT PRIMARY KEY,
      bank_transfer_enabled TINYINT(1) NOT NULL DEFAULT 1,
      cash_enabled TINYINT(1) NOT NULL DEFAULT 1,
      payment_reference VARCHAR(255) NULL,
      payment_note TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bank_name VARCHAR(160) NOT NULL,
      account_holder VARCHAR(255) NOT NULL,
      iban VARCHAR(64) NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      is_visible TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await connection.query('INSERT IGNORE INTO payment_settings (id) VALUES (1)');
}

function normalizeIban(value = '') {
  return String(value).replace(/\s+/g, '').toUpperCase();
}

export function isValidIban(value) {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9A-Z]+$/.test(iban) || (iban.startsWith('GR') && iban.length !== 27) || iban.length < 15 || iban.length > 34) return false;
  const prepared = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of prepared) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

function normalizeAccount(row) {
  return {
    id: row.id,
    bankName: row.bank_name,
    accountHolder: row.account_holder,
    iban: normalizeIban(row.iban),
    isDefault: Boolean(row.is_default),
    isVisible: Boolean(row.is_visible),
    sortOrder: Number(row.sort_order || 0),
  };
}

export async function getPaymentSettings(connection, { publicOnly = false } = {}) {
  await ensurePaymentSettingsSchema(connection);
  const [[settings]] = await connection.query('SELECT * FROM payment_settings WHERE id = 1');
  const [accounts] = await connection.query(
    `SELECT * FROM bank_accounts ${publicOnly ? 'WHERE is_visible = 1' : ''} ORDER BY is_default DESC, sort_order ASC, id ASC`
  );
  return {
    bankTransferEnabled: Boolean(settings?.bank_transfer_enabled),
    cashEnabled: Boolean(settings?.cash_enabled),
    paymentReference: settings?.payment_reference || '',
    paymentNote: settings?.payment_note || '',
    bankAccounts: accounts.map(normalizeAccount),
  };
}

function normalizePlan(row) {
  let features = [];
  try {
    features = typeof row.features_json === 'string' ? JSON.parse(row.features_json || '[]') : (row.features_json || []);
  } catch {
    features = [];
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    badge: row.badge || '',
    description: row.description || '',
    price: Number(row.price),
    currency: row.currency,
    period: row.period,
    themeColor: row.theme_color,
    features,
    isActive: Boolean(row.is_active),
    isPopular: Boolean(row.is_popular),
    sortOrder: row.sort_order,
    pointsReward: Number(row.points_reward) || 0,
  };
}

// Public — no auth required. Anonymous visitors and clients always get
// active-only; an already-logged-in coach/admin keeps seeing everything by
// default (same behavior as before), unless ?active=true is passed.
router.get('/', attachUserIfPresent, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);

    const values = [];
    let where = '';
    if (req.query.active === 'true' || !req.user || req.user.role === 'client') {
      where = 'WHERE is_active = 1';
    }

    const [rows] = await connection.query(
      `SELECT * FROM pricing_plans ${where} ORDER BY sort_order ASC, id ASC`,
      values
    );
    connection.release();

    res.json(rows.map(normalizePlan));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Coach only — always returns every plan (active + inactive) for the admin UI.
router.get('/manage', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);
    const [rows] = await connection.query('SELECT * FROM pricing_plans ORDER BY sort_order ASC, id ASC');
    connection.release();
    res.json(rows.map(normalizePlan));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/payment-options', async (_req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    res.json(await getPaymentSettings(connection, { publicOnly: true }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally { connection?.release(); }
});

router.get('/payment-settings', authenticateToken, authorizeRole(['coach', 'admin']), async (_req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    res.json(await getPaymentSettings(connection));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally { connection?.release(); }
});

router.put('/payment-settings', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await ensurePaymentSettingsSchema(connection);
    const accounts = Array.isArray(req.body.bankAccounts) ? req.body.bankAccounts : [];
    const normalized = accounts.map((account, index) => ({
      bankName: String(account.bankName || '').trim(),
      accountHolder: String(account.accountHolder || '').trim(),
      iban: normalizeIban(account.iban),
      isDefault: Boolean(account.isDefault),
      isVisible: account.isVisible !== false,
      sortOrder: index,
    })).filter((account) => account.bankName || account.accountHolder || account.iban);
    if (normalized.some((account) => !account.bankName || !account.accountHolder || !isValidIban(account.iban))) {
      return res.status(400).json({ message: 'Συμπλήρωσε έγκυρα στοιχεία για κάθε τραπεζικό λογαριασμό.' });
    }
    if (normalized.length) {
      const defaultIndex = normalized.findIndex((account) => account.isDefault);
      const visibleIndex = normalized.findIndex((account) => account.isVisible);
      normalized.forEach((account, index) => { account.isDefault = index === (defaultIndex >= 0 ? defaultIndex : (visibleIndex >= 0 ? visibleIndex : 0)); });
    }
    await connection.beginTransaction();
    await connection.query(
      `UPDATE payment_settings SET bank_transfer_enabled = ?, cash_enabled = ?, payment_reference = ?, payment_note = ? WHERE id = 1`,
      [req.body.bankTransferEnabled !== false ? 1 : 0, req.body.cashEnabled !== false ? 1 : 0, String(req.body.paymentReference || '').trim() || null, String(req.body.paymentNote || '').trim() || null]
    );
    await connection.query('DELETE FROM bank_accounts');
    if (normalized.length) await connection.query(
      'INSERT INTO bank_accounts (bank_name, account_holder, iban, is_default, is_visible, sort_order) VALUES ?',
      [normalized.map((account) => [account.bankName, account.accountHolder, account.iban, account.isDefault ? 1 : 0, account.isVisible ? 1 : 0, account.sortOrder])]
    );
    await connection.commit();
    res.json(await getPaymentSettings(connection));
  } catch (error) {
    await connection?.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally { connection?.release(); }
});

router.put('/reorder', authenticateToken, authorizeRole(['coach', 'admin']), [
  body('ids').isArray({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);
    const { ids } = req.body;
    for (let index = 0; index < ids.length; index += 1) {
      await connection.query('UPDATE pricing_plans SET sort_order = ? WHERE id = ?', [index, ids[index]]);
    }
    connection.release();
    res.json({ message: 'Plans reordered' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authenticateToken, authorizeRole(['coach', 'admin']), [
  body('name').notEmpty(),
  body('price').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);

    const slug = (req.body.slug || req.body.name)
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `plan-${Date.now()}`;

    if (req.body.isPopular) await connection.query('UPDATE pricing_plans SET is_popular = 0');
    const [result] = await connection.query(
      `INSERT INTO pricing_plans
        (slug, name, badge, description, price, currency, period, theme_color, features_json, is_active, sort_order, is_popular, points_reward)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        req.body.name,
        req.body.badge || null,
        req.body.description || null,
        req.body.price,
        req.body.currency || 'EUR',
        req.body.period || 'Μηνιαίο',
        req.body.themeColor || '#EF4444',
        JSON.stringify(req.body.features || []),
        req.body.isActive === false ? 0 : 1,
        req.body.sortOrder || 0,
        req.body.isPopular ? 1 : 0,
        Number(req.body.pointsReward) || 0,
      ]
    );

    const [rows] = await connection.query('SELECT * FROM pricing_plans WHERE id = ?', [result.insertId]);
    connection.release();
    res.status(201).json(normalizePlan(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Το slug υπάρχει ήδη.' : 'Server error' });
  }
});

router.put('/:id', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);

    if (req.body.isPopular) await connection.query('UPDATE pricing_plans SET is_popular = 0 WHERE id != ?', [req.params.id]);
    await connection.query(
      `UPDATE pricing_plans
       SET name = ?, badge = ?, description = ?, price = ?, currency = ?, period = ?,
           theme_color = ?, features_json = ?, is_active = ?, sort_order = ?, is_popular = ?, points_reward = ?
       WHERE id = ?`,
      [
        req.body.name,
        req.body.badge || null,
        req.body.description || null,
        req.body.price,
        req.body.currency || 'EUR',
        req.body.period || 'Μηνιαίο',
        req.body.themeColor || '#EF4444',
        JSON.stringify(req.body.features || []),
        req.body.isActive ? 1 : 0,
        req.body.sortOrder || 0,
        req.body.isPopular ? 1 : 0,
        Number(req.body.pointsReward) || 0,
        req.params.id,
      ]
    );

    const [rows] = await connection.query('SELECT * FROM pricing_plans WHERE id = ?', [req.params.id]);
    connection.release();
    if (!rows.length) return res.status(404).json({ message: 'Plan not found' });
    res.json(normalizePlan(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);
    const [plans] = await connection.query('SELECT name FROM pricing_plans WHERE id = ? LIMIT 1', [req.params.id]);
    if (!plans.length) {
      connection.release();
      return res.status(404).json({ message: 'Plan not found' });
    }
    const [[usage]] = await connection.query(
      `SELECT COUNT(*) AS total FROM subscriptions
       WHERE plan_name = ? AND status IN ('active', 'expiring_soon') AND start_date <= CURDATE() AND end_date >= CURDATE()`,
      [plans[0].name]
    );
    if (Number(usage?.total || 0) > 0) {
      await connection.query('UPDATE pricing_plans SET is_active = 0 WHERE id = ?', [req.params.id]);
      connection.release();
      return res.json({ message: 'Το πλάνο κρύφτηκε επειδή έχει ενεργούς πελάτες.', softDeleted: true, activeClients: Number(usage.total) });
    }
    await connection.query('DELETE FROM pricing_plans WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ message: 'Plan deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
