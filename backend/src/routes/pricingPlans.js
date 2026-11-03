import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { COMMON_FEATURE_SEED, PACKAGE_DURATION_SEED, PACKAGE_SEED, calculateDurationDiscount, calculateDurationSavingCents, calculatePackagePriceCents } from '../lib/packages.js';

const router = express.Router();

const normalizePackage = (row, allFeatures = []) => ({
  id: Number(row.id), key: row.package_key,
  name: row.name, monthlyAddonCents: Number(row.monthly_addon_cents || 0),
  label: row.label || null, sortOrder: Number(row.sort_order || 0),
  parentPackageId: row.parent_package_id === null ? undefined : Number(row.parent_package_id),
  isVisible: Boolean(row.is_visible), isUpgradable: Boolean(row.is_upgradable),
  features: allFeatures.filter((feature) => Number(feature.package_id) === Number(row.id)).map((feature) => ({ id: Number(feature.id), text: feature.text, sortOrder: Number(feature.sort_order || 0) })),
});

const parseOfferFeatures = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch { return []; }
};

export async function ensurePackagesSchema(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS package_durations (
    id INT AUTO_INCREMENT PRIMARY KEY, months TINYINT NOT NULL UNIQUE, base_price_cents INT NOT NULL,
    title VARCHAR(120) NULL, label VARCHAR(80) NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS packages (
    id INT AUTO_INCREMENT PRIMARY KEY, package_key VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL,
    monthly_addon_cents INT NOT NULL DEFAULT 0, label VARCHAR(120) NULL, sort_order INT NOT NULL DEFAULT 0,
    parent_package_id INT NULL,
    is_visible TINYINT(1) NOT NULL DEFAULT 1, is_upgradable TINYINT(1) NOT NULL DEFAULT 1,
    deleted_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS package_features (
    id INT AUTO_INCREMENT PRIMARY KEY, package_id INT NOT NULL, text VARCHAR(500) NOT NULL, sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS package_duration_offers (
    id INT AUTO_INCREMENT PRIMARY KEY, package_id INT NOT NULL, months TINYINT NOT NULL,
    price_cents INT NOT NULL, features_json JSON NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY package_duration_unique (package_id, months),
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS common_features (
    id INT AUTO_INCREMENT PRIMARY KEY, text VARCHAR(700) NOT NULL, sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS package_settings (
    id TINYINT PRIMARY KEY, points_per_euro INT NOT NULL DEFAULT 5,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await connection.query('INSERT IGNORE INTO package_settings (id, points_per_euro) VALUES (1, 5)');

  const [[durationCount]] = await connection.query('SELECT COUNT(*) AS total FROM package_durations');
  if (!Number(durationCount.total)) await connection.query(
    'INSERT INTO package_durations (months, base_price_cents, label, is_active, sort_order) VALUES ?',
    [PACKAGE_DURATION_SEED.map((item) => [item.months, item.basePriceCents, item.label, 1, item.sortOrder])],
  );
  const [[packageCount]] = await connection.query('SELECT COUNT(*) AS total FROM packages WHERE deleted_at IS NULL');
  if (!Number(packageCount.total)) {
    for (const item of PACKAGE_SEED) {
      const [result] = await connection.query(
        `INSERT INTO packages (package_key, name, monthly_addon_cents, label, sort_order, is_visible, is_upgradable)
         VALUES (?, ?, ?, ?, ?, 1, 1)`, [item.key, item.name, item.monthlyAddonCents, item.label, item.sortOrder],
      );
      await connection.query('INSERT INTO package_features (package_id, text, sort_order) VALUES ?', [item.features.map((text, index) => [result.insertId, text, index + 1])]);
    }
  }
  const [[commonCount]] = await connection.query('SELECT COUNT(*) AS total FROM common_features');
  if (!Number(commonCount.total)) await connection.query('INSERT INTO common_features (text, sort_order) VALUES ?', [COMMON_FEATURE_SEED.map((text, index) => [text, index + 1])]);

  // Existing packages keep their current calculated prices/features as the
  // starting point. From here each duration can be edited independently.
  const [[offerCount]] = await connection.query('SELECT COUNT(*) AS total FROM package_duration_offers');
  if (!Number(offerCount.total)) {
    const [seedPackages] = await connection.query('SELECT id, monthly_addon_cents FROM packages WHERE deleted_at IS NULL ORDER BY sort_order, id');
    const [seedDurations] = await connection.query('SELECT months, base_price_cents FROM package_durations ORDER BY sort_order, months');
    const [seedFeatures] = await connection.query('SELECT package_id, text FROM package_features ORDER BY sort_order, id');
    let inheritedSeedFeatures = [];
    for (const pkg of seedPackages) {
      const ownFeatures = seedFeatures.filter((item) => Number(item.package_id) === Number(pkg.id)).map((item) => item.text);
      const fullFeatures = [...inheritedSeedFeatures, ...ownFeatures];
      if (!seedDurations.length) continue;
      await connection.query(
        'INSERT INTO package_duration_offers (package_id, months, price_cents, features_json, is_active) VALUES ?',
        [seedDurations.map((duration) => [pkg.id, Number(duration.months), calculatePackagePriceCents({ basePriceCents: Number(duration.base_price_cents), monthlyAddonCents: Number(pkg.monthly_addon_cents || 0), months: Number(duration.months) }), JSON.stringify(fullFeatures), 1])],
      );
      inheritedSeedFeatures = fullFeatures;
    }
  }

  // Earlier installations may already have the first version of offers,
  // where Plus/Premium/Direct contained only their own extras. Upgrade only
  // those untouched defaults to the complete package contents for every month.
  const [defaultPackages] = await connection.query('SELECT id, package_key FROM packages WHERE deleted_at IS NULL ORDER BY sort_order, id');
  const [defaultFeatureRows] = await connection.query('SELECT package_id, text FROM package_features ORDER BY sort_order, id');
  const [defaultOfferRows] = await connection.query('SELECT id, package_id, features_json FROM package_duration_offers');
  let inheritedDefaultFeatures = [];
  for (const seed of PACKAGE_SEED) {
    const current = defaultPackages.find((item) => item.package_key === seed.key);
    if (!current) continue;
    const own = defaultFeatureRows.filter((item) => Number(item.package_id) === Number(current.id)).map((item) => item.text);
    const full = [...inheritedDefaultFeatures, ...own];
    for (const offer of defaultOfferRows.filter((item) => Number(item.package_id) === Number(current.id))) {
      const stored = parseOfferFeatures(offer.features_json);
      const isUntouchedOwnList = stored.length === own.length && stored.every((item, index) => item === own[index]);
      if (isUntouchedOwnList && full.length > own.length) await connection.query('UPDATE package_duration_offers SET features_json = ? WHERE id = ?', [JSON.stringify(full), offer.id]);
    }
    inheritedDefaultFeatures = full;
  }

  for (const statement of [
    'ALTER TABLE package_durations ADD COLUMN title VARCHAR(120) NULL AFTER base_price_cents',
    'ALTER TABLE packages ADD COLUMN parent_package_id INT NULL AFTER sort_order',
    'ALTER TABLE subscriptions ADD COLUMN package_id INT NULL',
    'ALTER TABLE subscriptions ADD COLUMN duration_months TINYINT NULL',
    'ALTER TABLE subscriptions ADD COLUMN price_cents INT NULL',
    'ALTER TABLE subscriptions ADD COLUMN package_name_snapshot VARCHAR(120) NULL',
    'ALTER TABLE subscriptions ADD COLUMN features_snapshot JSON NULL',
    'ALTER TABLE payments ADD COLUMN package_id INT NULL',
    'ALTER TABLE payments ADD COLUMN duration_months TINYINT NULL',
    'ALTER TABLE payments ADD COLUMN price_cents INT NULL',
    'ALTER TABLE payments ADD COLUMN package_name_snapshot VARCHAR(120) NULL',
    'ALTER TABLE payments ADD COLUMN features_snapshot JSON NULL',
  ]) { try { await connection.query(statement); } catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; } }

  // Preserve the original Basic → Plus → Premium → Direct hierarchy as the
  // default, while allowing the coach to change the parent later from the UI.
  const [hierarchyRows] = await connection.query('SELECT id, package_key, parent_package_id FROM packages WHERE deleted_at IS NULL');
  let defaultParentId = null;
  for (const seed of PACKAGE_SEED) {
    const current = hierarchyRows.find((item) => item.package_key === seed.key);
    if (!current) continue;
    if (current.parent_package_id == null && defaultParentId) await connection.query('UPDATE packages SET parent_package_id = ? WHERE id = ?', [defaultParentId, current.id]);
    defaultParentId = current.id;
  }
}

export async function getPackageCatalog(connection, { visibleOnly = true, includeDeleted = false } = {}) {
  await ensurePackagesSchema(connection);
  const [packageRows] = await connection.query(`SELECT * FROM packages ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ${visibleOnly ? (includeDeleted ? 'WHERE is_visible = 1' : 'AND is_visible = 1') : ''} ORDER BY sort_order, id`);
  const [featureRows] = await connection.query('SELECT * FROM package_features ORDER BY sort_order, id');
  const [offerRows] = await connection.query('SELECT * FROM package_duration_offers ORDER BY months, id');
  const [durationRows] = await connection.query(`SELECT * FROM package_durations ${visibleOnly ? 'WHERE is_active = 1' : ''} ORDER BY sort_order, months`);
  const [commonRows] = await connection.query('SELECT * FROM common_features ORDER BY sort_order, id');
  const [[settings]] = await connection.query('SELECT points_per_euro FROM package_settings WHERE id = 1');
  const packages = packageRows.map((item) => ({
    ...normalizePackage(item, featureRows),
    offers: offerRows.filter((offer) => Number(offer.package_id) === Number(item.id)).map((offer) => ({
      id: Number(offer.id), months: Number(offer.months), priceCents: Number(offer.price_cents),
      features: parseOfferFeatures(offer.features_json), isActive: Boolean(offer.is_active),
    })),
  }));
  return { packages, durations: durationRows.map((item) => ({ id: Number(item.id), months: Number(item.months), title: item.title || null, basePriceCents: Number(item.base_price_cents), label: item.label || null, isActive: Boolean(item.is_active), sortOrder: Number(item.sort_order) })), commonFeatures: commonRows.map((item) => ({ id: Number(item.id), text: item.text, sortOrder: Number(item.sort_order) })), pointsPerEuro: Number(settings?.points_per_euro || 5) };
}

export async function getPackageQuote(connection, packageId, durationMonths, { visibleOnly = true, includeDeleted = false } = {}) {
  const catalog = await getPackageCatalog(connection, { visibleOnly, includeDeleted });
  const selectedPackage = catalog.packages.find((item) => item.id === Number(packageId));
  const duration = catalog.durations.find((item) => item.months === Number(durationMonths));
  const oneMonth = catalog.durations.find((item) => item.months === 1);
  if (!selectedPackage || !duration || !oneMonth) return null;
  const offer = selectedPackage.offers?.find((item) => item.months === duration.months && item.isActive !== false);
  const priceCents = offer?.priceCents ?? calculatePackagePriceCents({ basePriceCents: duration.basePriceCents, monthlyAddonCents: selectedPackage.monthlyAddonCents, months: duration.months });
  const position = catalog.packages.findIndex((item) => item.id === selectedPackage.id);
  const inheritedFeatures = catalog.packages.slice(0, position + 1).flatMap((item) => item.features.map((feature) => feature.text));
  return { package: selectedPackage, duration, priceCents, price: priceCents / 100, monthlyPriceCents: Math.round(priceCents / duration.months), discountPercent: calculateDurationDiscount(duration.basePriceCents, oneMonth.basePriceCents, duration.months), savingCents: calculateDurationSavingCents(duration.basePriceCents, oneMonth.basePriceCents, duration.months), points: Math.round((priceCents / 100) * catalog.pointsPerEuro), commonFeatures: catalog.commonFeatures.map((item) => item.text), features: offer?.features?.length ? offer.features : inheritedFeatures };
}

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
  const migrations = [
    'ALTER TABLE payment_settings ADD COLUMN stripe_enabled TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE payment_settings ADD COLUMN stripe_publishable_key VARCHAR(255) NULL',
    'ALTER TABLE payment_settings ADD COLUMN stripe_secret_key TEXT NULL',
    'ALTER TABLE payment_settings ADD COLUMN stripe_webhook_secret TEXT NULL',
    'ALTER TABLE payment_settings ADD COLUMN paypal_enabled TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE payment_settings ADD COLUMN paypal_client_id VARCHAR(255) NULL',
    'ALTER TABLE payment_settings ADD COLUMN paypal_secret TEXT NULL',
    'ALTER TABLE payment_settings ADD COLUMN paypal_mode VARCHAR(16) NOT NULL DEFAULT \'sandbox\'',
  ];
  for (const statement of migrations) {
    try { await connection.query(statement); } catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; }
  }
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
    stripeEnabled: Boolean(settings?.stripe_enabled) && Boolean(process.env.STRIPE_SECRET_KEY),
    paypalEnabled: Boolean(settings?.paypal_enabled) && Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    ...(publicOnly ? {} : {
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      paypalMode: process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox',
    }),
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
    const [rows] = await connection.query('SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
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
      `UPDATE payment_settings
       SET bank_transfer_enabled = ?, cash_enabled = ?, payment_reference = ?, payment_note = ?,
           stripe_enabled = ?, paypal_enabled = ?
       WHERE id = 1`,
      [
        req.body.bankTransferEnabled !== false ? 1 : 0,
        req.body.cashEnabled !== false ? 1 : 0,
        String(req.body.paymentReference || '').trim() || null,
        String(req.body.paymentNote || '').trim() || null,
        req.body.stripeEnabled === true ? 1 : 0,
        req.body.paypalEnabled === true ? 1 : 0,
      ]
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
       WHERE LOWER(TRIM(plan_name)) = LOWER(TRIM(?))
         AND status IN ('active', 'expiring_soon')
         AND start_date <= CURDATE() AND end_date >= CURDATE()`,
      [plans[0].name]
    );
    if (Number(usage?.total || 0) > 0) {
      connection.release();
      return res.status(409).json({ message: 'Το πλάνο δεν μπορεί να διαγραφεί όσο έχει ενεργούς πελάτες.' });
    }
    await connection.query('DELETE FROM pricing_plans WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ message: 'Plan deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/packages', async (_req, res) => {
  let connection;
  try { connection = await pool.getConnection(); res.json(await getPackageCatalog(connection)); }
  catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); }
  finally { connection?.release(); }
});

router.get('/packages/manage', authenticateToken, authorizeRole(['coach', 'admin']), async (_req, res) => {
  let connection;
  try { connection = await pool.getConnection(); res.json(await getPackageCatalog(connection, { visibleOnly: false })); }
  catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); }
  finally { connection?.release(); }
});

router.put('/package-durations', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  const durations = Array.isArray(req.body?.durations) ? req.body.durations : [];
  if (!durations.length || durations.length > 12 || new Set(durations.map((item) => Number(item.months))).size !== durations.length || durations.some((item) => !Number.isInteger(Number(item.months)) || Number(item.months) < 1 || Number(item.months) > 24 || !Number.isInteger(Number(item.basePriceCents)) || Number(item.basePriceCents) < 0)) return res.status(400).json({ message: 'Οι διάρκειες πρέπει να έχουν έγκυρους μήνες και τιμές.' });
  let connection;
  try {
    connection = await pool.getConnection(); await ensurePackagesSchema(connection); await connection.beginTransaction();
    const [existingDurations] = await connection.query('SELECT months FROM package_durations');
    const requestedMonths = durations.map((duration) => Number(duration.months));
    const removedMonths = existingDurations.map((duration) => Number(duration.months)).filter((months) => !requestedMonths.includes(months));
    if (removedMonths.length) {
      await connection.query('DELETE FROM package_duration_offers WHERE months IN (?)', [removedMonths]);
      await connection.query('DELETE FROM package_durations WHERE months IN (?)', [removedMonths]);
    }
    for (const [index, duration] of durations.entries()) {
      await connection.query(
      `INSERT INTO package_durations (months, base_price_cents, title, label, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE base_price_cents = VALUES(base_price_cents), title = VALUES(title), label = VALUES(label), is_active = VALUES(is_active), sort_order = VALUES(sort_order)`,
      [Number(duration.months), Number(duration.basePriceCents), String(duration.title || '').trim().slice(0, 120) || null, duration.label || null, duration.isActive === false ? 0 : 1, index + 1],
      );
      const duplicateFromMonths = Number(duration.duplicateFromMonths);
      if (Number.isInteger(duplicateFromMonths) && duplicateFromMonths > 0 && duplicateFromMonths !== Number(duration.months)) await connection.query(
        `INSERT INTO package_duration_offers (package_id, months, price_cents, features_json, is_active)
         SELECT package_id, ?, price_cents, features_json, is_active FROM package_duration_offers WHERE months = ?
         ON DUPLICATE KEY UPDATE price_cents = VALUES(price_cents), features_json = VALUES(features_json), is_active = VALUES(is_active)`,
        [Number(duration.months), duplicateFromMonths],
      );
    }
    const [packages] = await connection.query('SELECT id, monthly_addon_cents FROM packages WHERE deleted_at IS NULL');
    for (const pkg of packages) for (const duration of durations) await connection.query(
      `INSERT IGNORE INTO package_duration_offers (package_id, months, price_cents, features_json, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(pkg.id), Number(duration.months), calculatePackagePriceCents({ basePriceCents: Number(duration.basePriceCents), monthlyAddonCents: Number(pkg.monthly_addon_cents || 0), months: Number(duration.months) }), JSON.stringify([]), existingDurations.some((item) => Number(item.months) === Number(duration.months)) && duration.isActive !== false ? 1 : 0],
    );
    await connection.commit(); res.json(await getPackageCatalog(connection, { visibleOnly: false }));
  } catch (error) { await connection?.rollback(); console.error(error); res.status(500).json({ message: 'Server error' }); }
  finally { connection?.release(); }
});

router.put('/common-features', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  const features = Array.isArray(req.body?.features) ? req.body.features.map((item) => String(item.text || item).trim()).filter(Boolean).slice(0, 30) : [];
  let connection;
  try { connection = await pool.getConnection(); await ensurePackagesSchema(connection); await connection.beginTransaction(); await connection.query('DELETE FROM common_features'); if (features.length) await connection.query('INSERT INTO common_features (text, sort_order) VALUES ?', [features.map((text, index) => [text, index + 1])]); await connection.commit(); res.json(await getPackageCatalog(connection, { visibleOnly: false })); }
  catch (error) { await connection?.rollback(); console.error(error); res.status(500).json({ message: 'Server error' }); }
  finally { connection?.release(); }
});

router.put('/points-rate', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  const rate = Number(req.body?.pointsPerEuro);
  if (!Number.isInteger(rate) || rate < 0 || rate > 1000) return res.status(400).json({ message: 'Μη έγκυρη τιμή πόντων.' });
  let connection;
  try { connection = await pool.getConnection(); await ensurePackagesSchema(connection); await connection.query('UPDATE package_settings SET points_per_euro = ? WHERE id = 1', [rate]); res.json(await getPackageCatalog(connection, { visibleOnly: false })); }
  catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); }
  finally { connection?.release(); }
});

router.put('/packages/order', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) return res.status(400).json({ message: 'Δεν δόθηκε σειρά πακέτων.' });
  let connection;
  try { connection = await pool.getConnection(); await ensurePackagesSchema(connection); await connection.beginTransaction(); for (const [index, id] of ids.entries()) await connection.query('UPDATE packages SET sort_order = ? WHERE id = ? AND deleted_at IS NULL', [index + 1, id]); await connection.commit(); res.json(await getPackageCatalog(connection, { visibleOnly: false })); }
  catch (error) { await connection?.rollback(); console.error(error); res.status(500).json({ message: 'Server error' }); }
  finally { connection?.release(); }
});

async function savePackage(connection, payload, id = null) {
  const name = String(payload?.name || '').trim().slice(0, 120);
  const key = String(payload?.key || payload?.packageKey || name).trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const addon = Number(payload?.monthlyAddonCents);
  const parentPackageId = payload?.parentPackageId == null || payload?.parentPackageId === '' ? null : Number(payload.parentPackageId);
  const features = Array.isArray(payload?.features) ? payload.features.map((feature) => String(feature.text || feature).trim()).filter(Boolean).slice(0, 30) : [];
  const [availableDurationRows] = await connection.query('SELECT months FROM package_durations');
  const availableMonths = new Set(availableDurationRows.map((duration) => Number(duration.months)));
  const offers = Array.isArray(payload?.offers) ? payload.offers
    .map((offer) => ({
      months: Number(offer.months), priceCents: Number(offer.priceCents),
      features: Array.isArray(offer.features) ? offer.features.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 40) : [],
      isActive: offer.isActive !== false,
    }))
    .filter((offer) => availableMonths.has(offer.months) && Number.isInteger(offer.priceCents) && offer.priceCents >= 0) : [];
  if (!name || !key || !Number.isInteger(addon) || addon < 0 || (!id && !features.length)) throw Object.assign(new Error('Συμπλήρωσε όνομα, έγκυρη αναβάθμιση και τουλάχιστον μία παροχή.'), { status: 400 });
  if (parentPackageId !== null && (!Number.isInteger(parentPackageId) || parentPackageId <= 0 || parentPackageId === Number(id))) throw Object.assign(new Error('Μη έγκυρο βασικό πακέτο.'), { status: 400 });
  if (offers.length && new Set(offers.map((offer) => offer.months)).size !== offers.length) throw Object.assign(new Error('Κάθε διάρκεια μπορεί να υπάρχει μόνο μία φορά.'), { status: 400 });
  if (id) {
    await connection.query('UPDATE packages SET package_key = ?, name = ?, monthly_addon_cents = ?, label = ?, parent_package_id = ?, is_visible = ?, is_upgradable = ? WHERE id = ? AND deleted_at IS NULL', [key, name, addon, payload.label || null, parentPackageId ?? 0, payload.isVisible === false ? 0 : 1, payload.isUpgradable === false ? 0 : 1, id]);
    await connection.query('DELETE FROM package_features WHERE package_id = ?', [id]);
    if (features.length) await connection.query('INSERT INTO package_features (package_id, text, sort_order) VALUES ?', [features.map((text, index) => [id, text, index + 1])]);
    if (offers.length) {
      for (const offer of offers) await connection.query(
        `INSERT INTO package_duration_offers (package_id, months, price_cents, features_json, is_active) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE price_cents = VALUES(price_cents), features_json = VALUES(features_json), is_active = VALUES(is_active)`,
        [id, offer.months, offer.priceCents, JSON.stringify(offer.features), offer.isActive ? 1 : 0],
      );
    }
    return id;
  }
  const [[last]] = await connection.query('SELECT COALESCE(MAX(sort_order), 0) AS position FROM packages');
  const [result] = await connection.query('INSERT INTO packages (package_key, name, monthly_addon_cents, label, sort_order, parent_package_id, is_visible, is_upgradable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [key, name, addon, payload.label || null, Number(last.position) + 1, parentPackageId ?? 0, payload.isVisible === false ? 0 : 1, payload.isUpgradable === false ? 0 : 1]);
  await connection.query('INSERT INTO package_features (package_id, text, sort_order) VALUES ?', [features.map((text, index) => [result.insertId, text, index + 1])]);
  const durationRows = await connection.query('SELECT months, base_price_cents FROM package_durations ORDER BY sort_order, months').then(([rows]) => rows);
  const initialOffers = offers.length ? offers : durationRows.map((duration) => ({ months: Number(duration.months), priceCents: calculatePackagePriceCents({ basePriceCents: Number(duration.base_price_cents), monthlyAddonCents: addon, months: Number(duration.months) }), features, isActive: true }));
  if (initialOffers.length) await connection.query('INSERT INTO package_duration_offers (package_id, months, price_cents, features_json, is_active) VALUES ?', [initialOffers.map((offer) => [result.insertId, offer.months, offer.priceCents, JSON.stringify(offer.features), offer.isActive ? 1 : 0])]);
  return result.insertId;
}

router.post('/packages', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  let connection;
  try { connection = await pool.getConnection(); await ensurePackagesSchema(connection); await connection.beginTransaction(); const id = await savePackage(connection, req.body); await connection.commit(); const catalog = await getPackageCatalog(connection, { visibleOnly: false }); res.status(201).json(catalog.packages.find((item) => item.id === id)); }
  catch (error) { await connection?.rollback(); res.status(error.status || 500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Το κλειδί πακέτου υπάρχει ήδη.' : error.message || 'Server error' }); }
  finally { connection?.release(); }
});

router.put('/packages/:id', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  let connection;
  try { connection = await pool.getConnection(); await ensurePackagesSchema(connection); await connection.beginTransaction(); const id = await savePackage(connection, req.body, Number(req.params.id)); await connection.commit(); const catalog = await getPackageCatalog(connection, { visibleOnly: false }); const item = catalog.packages.find((entry) => entry.id === id); if (!item) return res.status(404).json({ message: 'Το πακέτο δεν βρέθηκε.' }); res.json(item); }
  catch (error) { await connection?.rollback(); res.status(error.status || 500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Το κλειδί πακέτου υπάρχει ήδη.' : error.message || 'Server error' }); }
  finally { connection?.release(); }
});

router.delete('/packages/:id', authenticateToken, authorizeRole(['coach', 'admin']), async (req, res) => {
  let connection;
  try { connection = await pool.getConnection(); await ensurePackagesSchema(connection); const id = Number(req.params.id); const [[usage]] = await connection.query('SELECT (SELECT COUNT(*) FROM subscriptions WHERE package_id = ?) + (SELECT COUNT(*) FROM payments WHERE package_id = ?) AS total', [id, id]); if (Number(usage?.total || 0)) { await connection.query('UPDATE packages SET deleted_at = NOW(), is_visible = 0, is_upgradable = 0 WHERE id = ?', [id]); return res.json({ softDeleted: true, message: 'Το πακέτο κρύφτηκε, επειδή υπάρχει σε ιστορικό πληρωμών ή συνδρομών.' }); } await connection.query('DELETE FROM packages WHERE id = ?', [id]); res.json({ softDeleted: false, message: 'Το πακέτο διαγράφηκε.' }); }
  catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); }
  finally { connection?.release(); }
});

export default router;
