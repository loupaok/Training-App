import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

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

async function ensurePricingPlansSchema(connection) {
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

  const [rows] = await connection.query('SELECT COUNT(*) AS total FROM pricing_plans');
  if (Number(rows[0]?.total || 0) === 0) {
    await connection.query(
      `INSERT INTO pricing_plans
        (slug, name, badge, description, price, currency, period, theme_color, features_json, is_active, sort_order)
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
      ])]
    );
  }
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
    sortOrder: row.sort_order,
  };
}

router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);

    const values = [];
    let where = '';
    if (req.query.active === 'true' || req.user.role === 'client') {
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

router.post('/', authorizeRole(['admin']), [
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

    const [result] = await connection.query(
      `INSERT INTO pricing_plans
        (slug, name, badge, description, price, currency, period, theme_color, features_json, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

router.put('/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);

    await connection.query(
      `UPDATE pricing_plans
       SET name = ?, badge = ?, description = ?, price = ?, currency = ?, period = ?,
           theme_color = ?, features_json = ?, is_active = ?, sort_order = ?
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

router.delete('/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensurePricingPlansSchema(connection);
    await connection.query('DELETE FROM pricing_plans WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ message: 'Plan deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
