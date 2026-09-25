import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';
import { getVapidPublicKey, sendPushToUser, sendPushToUsers } from '../lib/webPush.js';
import { insertTrainingPlanDays } from './trainingPlans.js';
import { insertNutritionPlanMeals } from './nutritionPlans.js';
import { getFullTrainingTemplate, getFullNutritionTemplate } from './templates.js';
import { ensureClientActivityLogSchema, logClientActivity } from '../lib/client-activity-log.js';
import { ensureQuestionnaireSchema, syncUpdateDayQuestionnaireAnswer } from './questionnaire.js';
import { awardPoints } from './points.js';

const router = express.Router();
const activeMessageTypers = new Map();

function setMessageTyping(clientId, typer) {
  if (!typer.isTyping) {
    activeMessageTypers.delete(String(clientId));
    return;
  }
  activeMessageTypers.set(String(clientId), { ...typer, expiresAt: Date.now() + 5000 });
}

function getMessageTyper(clientId, expectedRole) {
  const typer = activeMessageTypers.get(String(clientId));
  if (!typer || typer.expiresAt < Date.now()) {
    activeMessageTypers.delete(String(clientId));
    return null;
  }
  return typer.role === expectedRole ? { name: typer.name } : null;
}

const onboardingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('uploads', 'onboarding', String(req.user.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const onboardingUpload = multer({
  storage: onboardingStorage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const imageFields = ['frontPhoto', 'sidePhoto', 'backPhoto'];
    const pdfFields = ['trainingPlanPdf', 'nutritionPlanPdf', 'previousPlanPdf', 'bloodTestsPdf'];

    if (imageFields.includes(file.fieldname)) {
      const allowed = /jpeg|jpg|png|webp/;
      const valid = allowed.test(ext) && allowed.test(file.mimetype);
      return valid ? cb(null, true) : cb(new Error('Only image files are allowed for photos'));
    }

    if (pdfFields.includes(file.fieldname)) {
      const valid = ext === '.pdf' && file.mimetype === 'application/pdf';
      return valid ? cb(null, true) : cb(new Error('Only PDF files are allowed for plans'));
    }

    return cb(new Error('Unsupported upload field'));
  }
});

const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('uploads', 'media');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg').toLowerCase() || '.jpg';
    cb(null, `profile-${req.user.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const profilePhotoUpload = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
  }
});

const paymentProofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('uploads', 'payments', String(req.user.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `payment-proof-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const paymentProofUpload = multer({
  storage: paymentProofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|png|webp)$/.test(file.mimetype) || file.mimetype === 'application/pdf';
    cb(null, allowed);
  }
});

const subscriptionPackages = {
  '2_months': { label: '2 μήνες', months: 2, price: 190 },
  '3_months': { label: '3 μήνες', months: 3, price: 270 },
  '4_months': { label: '4 μήνες', months: 4, price: 320 }
};

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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

function monthsFromPeriod(period, fallback = 1) {
  const value = String(period || '').toLowerCase();
  if (value.includes('3') || value.includes('τρίμη') || value.includes('quarter')) return 3;
  if (value.includes('6') || value.includes('εξάμη')) return 6;
  if (value.includes('12') || value.includes('έτος') || value.includes('year')) return 12;
  if (value.includes('4')) return 4;
  if (value.includes('2')) return 2;
  return fallback;
}

async function getSelectedSubscriptionPlan(connection, slug) {
  await ensurePricingPlansSchema(connection);
  const [rows] = await connection.query(
    'SELECT slug, name, price, currency, period FROM pricing_plans WHERE slug = ? AND is_active = 1 LIMIT 1',
    [slug]
  );
  if (rows.length) {
    return {
      label: rows[0].name,
      months: monthsFromPeriod(rows[0].period),
      price: Number(rows[0].price),
      currency: rows[0].currency || 'EUR'
    };
  }

  return subscriptionPackages[slug] || null;
}

async function ensureOnboardingSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS onboarding_forms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL UNIQUE,
      goal VARCHAR(120),
      level VARCHAR(120),
      available_days VARCHAR(255),
      injuries TEXT,
      dietary_restrictions TEXT,
      additional_notes TEXT,
      date_of_birth DATE,
      age INT,
      height_cm DECIMAL(5,2),
      weight_kg DECIMAL(6,2),
      update_day TINYINT,
      occupation_schedule TEXT,
      health_problem TEXT,
      cycle_history TEXT,
      cardio_sessions_per_week TEXT,
      sleep_schedule TEXT,
      blood_tests_pdf VARCHAR(500),
      current_training_plan TEXT,
      current_nutrition_plan TEXT,
      previous_plan_history TEXT,
      current_training_pdf VARCHAR(500),
      current_nutrition_pdf VARCHAR(500),
      previous_plan_pdf VARCHAR(500),
      selected_package VARCHAR(50),
      payment_method ENUM('bank_transfer', 'stripe_card') DEFAULT 'bank_transfer',
      visible_to_client TINYINT(1) NOT NULL DEFAULT 0,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_client_id (client_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS client_onboarding (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL UNIQUE,
      goal VARCHAR(120),
      date_of_birth DATE,
      age INT,
      height_cm DECIMAL(5,2),
      update_day TINYINT,
      occupation_schedule TEXT,
      health_problem TEXT,
      injuries TEXT,
      cycle_history TEXT,
      cardio_sessions_per_week TEXT,
      sleep_schedule TEXT,
      blood_tests_pdf VARCHAR(500),
      current_training_plan TEXT,
      current_nutrition_plan TEXT,
      previous_plan_history TEXT,
      current_training_pdf VARCHAR(500),
      current_nutrition_pdf VARCHAR(500),
      previous_plan_pdf VARCHAR(500),
      selected_package VARCHAR(50),
      payment_method ENUM('bank_transfer', 'stripe_card') DEFAULT 'bank_transfer',
      onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_client_id (client_id)
    )
  `);

  const createUpdateScheduleTable = async () => connection.query(`
    CREATE TABLE IF NOT EXISTS update_schedule (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NULL,
      client_id INT NOT NULL UNIQUE,
      frequency ENUM('weekly', 'biweekly', 'monthly') NOT NULL DEFAULT 'weekly',
      day_of_week TINYINT NULL,
      reminder_enabled TINYINT(1) NOT NULL DEFAULT 1,
      next_due_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_client_id (client_id),
      INDEX idx_next_due_date (next_due_date)
    )
  `);

  await createUpdateScheduleTable();
  try {
    await connection.query('SELECT id FROM update_schedule LIMIT 1');
  } catch (error) {
    if (String(error.sqlMessage || error.message || '').includes("doesn't exist in engine")) {
      await connection.query('DROP TABLE IF EXISTS update_schedule');
      await createUpdateScheduleTable();
    } else {
      throw error;
    }
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_updates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      coach_id INT,
      weight_kg DECIMAL(6,2),
      training_score TINYINT,
      nutrition_score TINYINT,
      notes TEXT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      week_start DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE KEY unique_client_week (client_id, week_start),
      INDEX idx_client_id (client_id),
      INDEX idx_week_start (week_start)
    )
  `);

  for (const statement of [
    'ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP NULL',
    'ALTER TABLE clients ADD COLUMN coach_notes TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN level VARCHAR(120)',
    'ALTER TABLE onboarding_forms ADD COLUMN available_days VARCHAR(255)',
    'ALTER TABLE onboarding_forms ADD COLUMN dietary_restrictions TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN additional_notes TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN date_of_birth DATE',
    'ALTER TABLE onboarding_forms ADD COLUMN age INT',
    'ALTER TABLE onboarding_forms ADD COLUMN height_cm DECIMAL(5,2)',
    'ALTER TABLE onboarding_forms ADD COLUMN weight_kg DECIMAL(6,2)',
    'ALTER TABLE onboarding_forms ADD COLUMN update_day TINYINT',
    'ALTER TABLE onboarding_forms ADD COLUMN occupation_schedule TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN health_problem TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN cycle_history TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN cardio_sessions_per_week TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN sleep_schedule TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN blood_tests_pdf VARCHAR(500)',
    'ALTER TABLE onboarding_forms ADD COLUMN current_training_plan TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN current_nutrition_plan TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN previous_plan_history TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN current_training_pdf VARCHAR(500)',
    'ALTER TABLE onboarding_forms ADD COLUMN current_nutrition_pdf VARCHAR(500)',
    'ALTER TABLE onboarding_forms ADD COLUMN previous_plan_pdf VARCHAR(500)',
    'ALTER TABLE onboarding_forms ADD COLUMN selected_package VARCHAR(50)',
    "ALTER TABLE onboarding_forms ADD COLUMN payment_method ENUM('bank_transfer', 'stripe_card') DEFAULT 'bank_transfer'",
    'ALTER TABLE onboarding_forms ADD COLUMN visible_to_client TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE onboarding_forms ADD COLUMN submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS client_onboarding (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL UNIQUE,
      goal VARCHAR(120),
      date_of_birth DATE,
      age INT,
      height_cm DECIMAL(5,2),
      update_day TINYINT,
      occupation_schedule TEXT,
      health_problem TEXT,
      injuries TEXT,
      cycle_history TEXT,
      cardio_sessions_per_week TEXT,
      sleep_schedule TEXT,
      blood_tests_pdf VARCHAR(500),
      current_training_plan TEXT,
      current_nutrition_plan TEXT,
      previous_plan_history TEXT,
      current_training_pdf VARCHAR(500),
      current_nutrition_pdf VARCHAR(500),
      previous_plan_pdf VARCHAR(500),
      selected_package VARCHAR(50),
      payment_method ENUM('bank_transfer', 'stripe_card') DEFAULT 'bank_transfer',
      onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_client_id (client_id)
    )
  `);

  for (const statement of [
    'ALTER TABLE client_onboarding ADD COLUMN current_training_pdf VARCHAR(500)',
    'ALTER TABLE client_onboarding ADD COLUMN current_nutrition_pdf VARCHAR(500)',
    'ALTER TABLE client_onboarding ADD COLUMN previous_plan_pdf VARCHAR(500)',
    'ALTER TABLE client_onboarding ADD COLUMN age INT',
    'ALTER TABLE client_onboarding ADD COLUMN date_of_birth DATE',
    'ALTER TABLE client_onboarding ADD COLUMN height_cm DECIMAL(5,2)',
    'ALTER TABLE client_onboarding ADD COLUMN occupation_schedule TEXT',
    'ALTER TABLE client_onboarding ADD COLUMN health_problem TEXT',
    'ALTER TABLE client_onboarding ADD COLUMN injuries TEXT',
    'ALTER TABLE client_onboarding ADD COLUMN cycle_history TEXT',
    'ALTER TABLE client_onboarding ADD COLUMN cardio_sessions_per_week TEXT',
    'ALTER TABLE client_onboarding MODIFY cardio_sessions_per_week TEXT',
    'ALTER TABLE client_onboarding ADD COLUMN sleep_schedule TEXT',
    'ALTER TABLE client_onboarding ADD COLUMN blood_tests_pdf VARCHAR(500)'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

function nextDateForWeekday(day) {
  const now = new Date();
  const currentDay = now.getDay();
  const diff = (Number(day) - currentDay + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().slice(0, 10);
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function parseDecimalText(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseFloat(String(value).replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRegistrationQuestion(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('el-GR');
}

async function getRegistrationBodyFallback(connection, clientId) {
  const [rows] = await connection.query(
    `SELECT qq.question, qa.answer
     FROM questionnaire_answers qa
     INNER JOIN questionnaire_questions qq ON qq.id = qa.question_id
     WHERE qa.client_id = ?`,
    [clientId]
  );

  const findAnswer = (matches) => rows.find((row) => matches(normalizeRegistrationQuestion(row.question)))?.answer || null;
  return {
    heightCm: parseDecimalText(findAnswer((question) => question.includes('υψ'))),
    weightKg: parseDecimalText(findAnswer((question) => question.includes('τρεχ') && question.includes('βαρ'))),
    goal: findAnswer((question) => question.includes('στοχ')),
  };
}

function normalizeSocialLinks(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item.platform && item.url) : [];
  } catch {
    return [];
  }
}

export async function getDefaultCoachId(connection) {
  const [rows] = await connection.query(
    "SELECT id FROM users WHERE role IN ('admin', 'coach') AND is_active = 1 ORDER BY FIELD(role, 'coach', 'admin'), id LIMIT 1"
  );
  return rows[0]?.id || null;
}

async function ensureMediaTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS media_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES media_folders(id) ON DELETE SET NULL,
      INDEX idx_parent_id (parent_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      asset_type ENUM('photo', 'icon') DEFAULT 'photo',
      url VARCHAR(600) NOT NULL,
      source VARCHAR(80) DEFAULT 'upload',
      folder_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE SET NULL,
      INDEX idx_asset_type (asset_type),
      INDEX idx_source (source),
      INDEX idx_folder_id (folder_id)
    )
  `);
}

async function ensureProfilePhotoFolder(connection) {
  await ensureMediaTable(connection);
  const [folders] = await connection.query(
    'SELECT id FROM media_folders WHERE LOWER(name) = LOWER(?) LIMIT 1',
    ['foto profil']
  );
  if (folders.length) return folders[0].id;

  const [result] = await connection.query(
    'INSERT INTO media_folders (name, parent_id) VALUES (?, NULL)',
    ['foto profil']
  );
  return result.insertId;
}

async function ensurePaymentProofColumns(connection) {
  await ensureNotificationsSchema(connection);
  for (const statement of [
    'ALTER TABLE payments ADD COLUMN proof_url VARCHAR(500)',
    'ALTER TABLE payments ADD COLUMN proof_uploaded_at TIMESTAMP NULL'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

async function ensureClientDetailColumns(connection) {
  for (const statement of [
    'ALTER TABLE clients ADD COLUMN discord_id VARCHAR(50) NULL',
    'ALTER TABLE clients ADD COLUMN target_weight_kg DECIMAL(6,2) NULL'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

async function ensureClientSoftDeleteColumns(connection) {
  for (const statement of [
    'ALTER TABLE clients ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL',
    'ALTER TABLE clients ADD COLUMN deleted_by INT NULL DEFAULT NULL',
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

async function ensureMessagesSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      coach_id INT NOT NULL,
      sender_role ENUM('coach', 'client') NOT NULL,
      body TEXT NOT NULL,
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_client_id (client_id)
    )
  `);
}

export async function ensureNotificationsSchema(connection) {
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

export async function notifyCoaches(connection, notification) {
  await ensureNotificationsSchema(connection);
  const [coaches] = await connection.query(
    "SELECT id FROM users WHERE role IN ('admin', 'coach') AND is_active = 1"
  );

  for (const coach of coaches) {
    await connection.query(
      `INSERT INTO notifications (user_id, client_id, payment_id, type, title, body, link_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        coach.id,
        notification.clientId || null,
        notification.paymentId || null,
        notification.type,
        notification.title,
        notification.body || null,
        notification.linkUrl || null,
      ]
    );
  }

  try {
    await sendPushToUsers(coaches.map((coach) => coach.id), {
      title: notification.title,
      body: notification.body || '',
      url: notification.linkUrl || '/'
    });
  } catch (error) {
    console.error('Push notification failed:', error.message);
  }
}

export async function notifyUser(connection, userId, notification) {
  await ensureNotificationsSchema(connection);
  await connection.query(
    `INSERT INTO notifications (user_id, client_id, payment_id, type, title, body, link_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      notification.clientId || null,
      notification.paymentId || null,
      notification.type,
      notification.title,
      notification.body || null,
      notification.linkUrl || null,
    ]
  );

  try {
    await sendPushToUser(userId, {
      title: notification.title,
      body: notification.body || '',
      url: notification.linkUrl || '/'
    });
  } catch (error) {
    console.error('Push notification failed:', error.message);
  }
}

async function refreshClientPaymentStatus(connection, clientId) {
  const [[completed]] = await connection.query(
    'SELECT id FROM payments WHERE client_id = ? AND status = "completed" LIMIT 1',
    [clientId]
  );
  const [[pending]] = await connection.query(
    'SELECT id FROM payments WHERE client_id = ? AND status = "pending" LIMIT 1',
    [clientId]
  );

  if (completed) {
    await connection.query(
      'UPDATE users SET status = "active" WHERE id = ? AND role = "client"',
      [clientId]
    );
  } else if (pending) {
    await connection.query(
      'UPDATE users SET status = "pending_payment" WHERE id = ? AND role = "client"',
      [clientId]
    );
  } else {
    await connection.query(
      'UPDATE users SET status = "expired" WHERE id = ? AND role = "client"',
      [clientId]
    );
  }
}

// GET /clients/me/onboarding — current client's onboarding state
router.get('/me/onboarding', authorizeRole(['client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureOnboardingSchema(connection);
    await ensurePaymentProofColumns(connection);

    const [rows] = await connection.query(
      'SELECT submitted_at FROM onboarding_forms WHERE client_id = ?',
      [req.user.id]
    );

    connection.release();
    res.json({ completed: rows.length > 0, submittedAt: rows[0]?.submitted_at || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /clients/me/onboarding — first questionnaire after client register
router.post('/me/onboarding', authorizeRole(['client']), (req, res, next) => {
  onboardingUpload.fields([
    { name: 'frontPhoto', maxCount: 1 },
    { name: 'sidePhoto', maxCount: 1 },
    { name: 'backPhoto', maxCount: 1 },
    { name: 'trainingPlanPdf', maxCount: 1 },
    { name: 'nutritionPlanPdf', maxCount: 1 },
    { name: 'previousPlanPdf', maxCount: 1 },
    { name: 'bloodTestsPdf', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  const {
    fullName,
    email,
    countryCode,
    phone,
    dateOfBirth,
    heightCm,
    goal,
    updateDay,
    weightKg,
    occupationSchedule,
    healthProblem,
    injuries,
    cycleHistory,
    cardioSessionsPerWeek,
    sleepSchedule,
    currentTrainingPlan,
    currentNutritionPlan,
    previousPlanHistory,
    socialLinks,
    subscriptionPackage,
    paymentMethod
  } = req.body;

  if (!fullName || !email || !phone || !goal || updateDay === undefined || !weightKg) {
    return res.status(400).json({ message: 'Συμπλήρωσε όλα τα απαραίτητα πεδία.' });
  }

  const connection = await pool.getConnection();

  try {
    await ensureOnboardingSchema(connection);

    await connection.beginTransaction();

    const coachId = await getDefaultCoachId(connection);
    const fullPhone = `${countryCode || ''}${phone}`.trim();
    const calculatedAge = calculateAge(dateOfBirth);
    const parsedHeightCm = parseDecimalText(heightCm);
    const parsedWeightKg = parseDecimalText(weightKg);

    await connection.query(
      'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
      [fullName, email, req.user.id]
    );

    await connection.query(
      `INSERT INTO clients (user_id, phone, date_of_birth, height_cm, weight_kg, fitness_goal, medical_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone = VALUES(phone),
         date_of_birth = VALUES(date_of_birth),
         height_cm = VALUES(height_cm),
         weight_kg = VALUES(weight_kg),
         fitness_goal = VALUES(fitness_goal),
         medical_notes = VALUES(medical_notes)`,
      [req.user.id, fullPhone, dateOfBirth || null, parsedHeightCm, parsedWeightKg, goal, [healthProblem, injuries].filter(Boolean).join('\n\n') || null]
    );

    await connection.query(
      `INSERT INTO onboarding_forms
         (client_id, goal, injuries, additional_notes, date_of_birth, age, height_cm, weight_kg,
          update_day, occupation_schedule, health_problem, cycle_history, cardio_sessions_per_week,
          sleep_schedule, blood_tests_pdf, current_training_plan, current_nutrition_plan,
          previous_plan_history, current_training_pdf, current_nutrition_pdf, previous_plan_pdf,
          selected_package, payment_method, visible_to_client, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
       ON DUPLICATE KEY UPDATE
         goal = VALUES(goal),
         injuries = VALUES(injuries),
         additional_notes = VALUES(additional_notes),
         date_of_birth = VALUES(date_of_birth),
         age = VALUES(age),
         height_cm = VALUES(height_cm),
         weight_kg = VALUES(weight_kg),
         update_day = VALUES(update_day),
         occupation_schedule = VALUES(occupation_schedule),
         health_problem = VALUES(health_problem),
         cycle_history = VALUES(cycle_history),
         cardio_sessions_per_week = VALUES(cardio_sessions_per_week),
         sleep_schedule = VALUES(sleep_schedule),
         blood_tests_pdf = COALESCE(VALUES(blood_tests_pdf), blood_tests_pdf),
         current_training_plan = VALUES(current_training_plan),
         current_nutrition_plan = VALUES(current_nutrition_plan),
         previous_plan_history = VALUES(previous_plan_history),
         current_training_pdf = COALESCE(VALUES(current_training_pdf), current_training_pdf),
         current_nutrition_pdf = COALESCE(VALUES(current_nutrition_pdf), current_nutrition_pdf),
         previous_plan_pdf = COALESCE(VALUES(previous_plan_pdf), previous_plan_pdf),
         selected_package = VALUES(selected_package),
         payment_method = VALUES(payment_method),
         visible_to_client = 0,
         submitted_at = COALESCE(submitted_at, NOW())`,
      [
        req.user.id,
        goal,
        injuries || null,
        [currentTrainingPlan, currentNutritionPlan, previousPlanHistory].filter(Boolean).join('\n\n') || null,
        dateOfBirth || null,
        calculatedAge,
        parsedHeightCm,
        parsedWeightKg,
        updateDay,
        occupationSchedule || null,
        healthProblem || null,
        cycleHistory || null,
        cardioSessionsPerWeek || null,
        sleepSchedule || null,
        req.files?.bloodTestsPdf?.[0]?.path.replace(/\\/g, '/') || null,
        currentTrainingPlan || null,
        currentNutritionPlan || null,
        previousPlanHistory || null,
        req.files?.trainingPlanPdf?.[0]?.path.replace(/\\/g, '/') || null,
        req.files?.nutritionPlanPdf?.[0]?.path.replace(/\\/g, '/') || null,
        req.files?.previousPlanPdf?.[0]?.path.replace(/\\/g, '/') || null,
        subscriptionPackage || null,
        paymentMethod || null
      ]
    );

    await connection.query(
      `INSERT INTO client_onboarding
         (client_id, goal, date_of_birth, age, height_cm, update_day, occupation_schedule, health_problem,
          injuries, cycle_history, cardio_sessions_per_week, sleep_schedule, blood_tests_pdf,
          current_training_plan, current_nutrition_plan, previous_plan_history,
          current_training_pdf, current_nutrition_pdf, previous_plan_pdf,
          selected_package, payment_method, onboarding_completed, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         goal = VALUES(goal),
         date_of_birth = VALUES(date_of_birth),
         age = VALUES(age),
         height_cm = VALUES(height_cm),
         update_day = VALUES(update_day),
         occupation_schedule = VALUES(occupation_schedule),
         health_problem = VALUES(health_problem),
         injuries = VALUES(injuries),
         cycle_history = VALUES(cycle_history),
         cardio_sessions_per_week = VALUES(cardio_sessions_per_week),
         sleep_schedule = VALUES(sleep_schedule),
         blood_tests_pdf = COALESCE(VALUES(blood_tests_pdf), blood_tests_pdf),
         current_training_plan = VALUES(current_training_plan),
         current_nutrition_plan = VALUES(current_nutrition_plan),
         previous_plan_history = VALUES(previous_plan_history),
         current_training_pdf = COALESCE(VALUES(current_training_pdf), current_training_pdf),
         current_nutrition_pdf = COALESCE(VALUES(current_nutrition_pdf), current_nutrition_pdf),
         previous_plan_pdf = COALESCE(VALUES(previous_plan_pdf), previous_plan_pdf),
         selected_package = VALUES(selected_package),
         payment_method = VALUES(payment_method),
         onboarding_completed = 1,
         completed_at = NOW()`,
      [
        req.user.id,
        goal,
        dateOfBirth || null,
        calculatedAge,
        parsedHeightCm,
        updateDay,
        occupationSchedule || null,
        healthProblem || null,
        injuries || null,
        cycleHistory || null,
        cardioSessionsPerWeek || null,
        sleepSchedule || null,
        req.files?.bloodTestsPdf?.[0]?.path.replace(/\\/g, '/') || null,
        currentTrainingPlan || null,
        currentNutritionPlan || null,
        previousPlanHistory || null,
        req.files?.trainingPlanPdf?.[0]?.path.replace(/\\/g, '/') || null,
        req.files?.nutritionPlanPdf?.[0]?.path.replace(/\\/g, '/') || null,
        req.files?.previousPlanPdf?.[0]?.path.replace(/\\/g, '/') || null,
        subscriptionPackage || null,
        paymentMethod || null
      ]
    );

    const links = normalizeSocialLinks(socialLinks);
    for (const link of links) {
      await connection.query(
        `INSERT INTO social_links (user_id, platform, url)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE url = VALUES(url)`,
        [req.user.id, link.platform, link.url]
      );
    }

    if (coachId) {
      await connection.query(
        `INSERT INTO coach_clients (coach_id, client_id, status)
         VALUES (?, ?, 'active')
         ON DUPLICATE KEY UPDATE status = 'active'`,
        [coachId, req.user.id]
      );

      await connection.query(
        `INSERT INTO update_schedule (coach_id, client_id, frequency, day_of_week, reminder_enabled, next_due_date)
         VALUES (?, ?, 'weekly', ?, 1, ?)
         ON DUPLICATE KEY UPDATE
           day_of_week = VALUES(day_of_week),
           reminder_enabled = 1,
           next_due_date = VALUES(next_due_date)`,
        [coachId, req.user.id, updateDay, nextDateForWeekday(updateDay)]
      );
    }

    const [progressResult] = await connection.query(
      `INSERT INTO progress_updates (client_id, coach_id, weight_kg, notes)
       VALUES (?, ?, ?, ?)`,
      [
        req.user.id,
        coachId,
        parsedWeightKg,
        [
          `Στόχος: ${goal}`,
          currentTrainingPlan ? `Τρέχον πλάνο προπόνησης: ${currentTrainingPlan}` : '',
          currentNutritionPlan ? `Τρέχον πλάνο διατροφής: ${currentNutritionPlan}` : '',
          previousPlanHistory ? `Ιστορικό πλάνων: ${previousPlanHistory}` : ''
        ].filter(Boolean).join('\n')
      ]
    );

    const photoRows = [];
    const photoMap = [
      ['frontPhoto', 'front'],
      ['sidePhoto', 'side_left'],
      ['backPhoto', 'back']
    ];

    for (const [field, angle] of photoMap) {
      const file = req.files?.[field]?.[0];
      if (file) {
        photoRows.push([
          progressResult.insertId,
          req.user.id,
          file.path.replace(/\\/g, '/'),
          angle
        ]);
      }
    }

    if (photoRows.length) {
      await connection.query(
        'INSERT INTO progress_photos (progress_update_id, client_id, photo_url, angle) VALUES ?',
        [photoRows]
      );
    }

    await connection.commit();
    connection.release();
    res.status(201).json({ message: 'Το ερωτηματολόγιο αποθηκεύτηκε.' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /clients/me/billing — select subscription package after onboarding
// GET /clients/me/profile — editable profile data for the logged-in client
router.get('/me/profile', authorizeRole(['client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureOnboardingSchema(connection);

    const [rows] = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.profile_photo,
              c.phone, c.gender, c.date_of_birth, c.height_cm, c.weight_kg, c.fitness_goal,
              COALESCE(us.day_of_week, ofm.update_day) AS update_day,
              ofm.occupation_schedule, ofm.health_problem, ofm.injuries,
              ofm.cycle_history, ofm.cardio_sessions_per_week, ofm.sleep_schedule,
              ofm.current_training_plan, ofm.current_nutrition_plan, ofm.previous_plan_history
       FROM users u
       LEFT JOIN clients c ON c.user_id = u.id
       LEFT JOIN onboarding_forms ofm ON ofm.client_id = u.id
       LEFT JOIN update_schedule us ON us.client_id = u.id
       WHERE u.id = ? AND u.role = 'client'
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    const [socialRows] = await connection.query(
      'SELECT platform, url FROM social_links WHERE user_id = ? ORDER BY platform',
      [req.user.id]
    );

    const registrationBody = await getRegistrationBodyFallback(connection, req.user.id);

    connection.release();
    const row = rows[0];
    res.json({
      id: row.id,
      fullName: row.full_name || '',
      email: row.email || '',
      phone: row.phone || '',
      gender: row.gender || '',
      dateOfBirth: row.date_of_birth || '',
      age: calculateAge(row.date_of_birth),
      heightCm: row.height_cm || registrationBody.heightCm || '',
      weightKg: row.weight_kg || registrationBody.weightKg || '',
      goal: row.fitness_goal || registrationBody.goal || '',
      updateDay: row.update_day ?? '',
      occupationSchedule: row.occupation_schedule || '',
      healthProblem: row.health_problem || '',
      injuries: row.injuries || '',
      cycleHistory: row.cycle_history || '',
      cardioSessionsPerWeek: row.cardio_sessions_per_week || '',
      sleepSchedule: row.sleep_schedule || '',
      currentTrainingPlan: row.current_training_plan || '',
      currentNutritionPlan: row.current_nutrition_plan || '',
      previousPlanHistory: row.previous_plan_history || '',
      profilePhoto: row.profile_photo || '',
      socialLinks: socialRows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /clients/me/profile — client can edit only their own personal details
router.put('/me/profile', authorizeRole(['client']), [
  body('email').isEmail().withMessage('Valid email required'),
  body('fullName').trim().notEmpty().withMessage('Full name required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    fullName,
    email,
    phone,
    gender,
    dateOfBirth,
    heightCm,
    weightKg,
    goal,
    updateDay,
    occupationSchedule,
    healthProblem,
    injuries,
    cycleHistory,
    cardioSessionsPerWeek,
    sleepSchedule,
    currentTrainingPlan,
    currentNutritionPlan,
    previousPlanHistory,
    socialLinks = []
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await ensureOnboardingSchema(connection);
    await ensureQuestionnaireSchema(connection);
    await connection.beginTransaction();

    const [existingEmail] = await connection.query(
      'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
      [email, req.user.id]
    );
    if (existingEmail.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    const parsedHeightCm = parseDecimalText(heightCm);
    const parsedWeightKg = parseDecimalText(weightKg);
    const calculatedAge = calculateAge(dateOfBirth);

    await connection.query(
      'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
      [fullName, email, req.user.id]
    );

    await connection.query(
      `INSERT INTO clients (user_id, phone, gender, date_of_birth, height_cm, weight_kg, fitness_goal, medical_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone = VALUES(phone),
         gender = VALUES(gender),
         date_of_birth = VALUES(date_of_birth),
         height_cm = VALUES(height_cm),
         weight_kg = VALUES(weight_kg),
         fitness_goal = VALUES(fitness_goal),
         medical_notes = VALUES(medical_notes)`,
      [req.user.id, phone || null, gender || null, dateOfBirth || null, parsedHeightCm, parsedWeightKg, goal || null, [healthProblem, injuries].filter(Boolean).join('\n\n') || null]
    );

    await connection.query(
      `INSERT INTO onboarding_forms
         (client_id, goal, injuries, date_of_birth, age, height_cm, weight_kg, update_day,
          occupation_schedule, health_problem, cycle_history, cardio_sessions_per_week,
          sleep_schedule, current_training_plan, current_nutrition_plan, previous_plan_history, visible_to_client)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE
         goal = VALUES(goal),
         injuries = VALUES(injuries),
         date_of_birth = VALUES(date_of_birth),
         age = VALUES(age),
         height_cm = VALUES(height_cm),
         weight_kg = VALUES(weight_kg),
         update_day = VALUES(update_day),
         occupation_schedule = VALUES(occupation_schedule),
         health_problem = VALUES(health_problem),
         cycle_history = VALUES(cycle_history),
         cardio_sessions_per_week = VALUES(cardio_sessions_per_week),
         sleep_schedule = VALUES(sleep_schedule),
         current_training_plan = VALUES(current_training_plan),
         current_nutrition_plan = VALUES(current_nutrition_plan),
         previous_plan_history = VALUES(previous_plan_history),
         visible_to_client = 0`,
      [
        req.user.id,
        goal || null,
        injuries || null,
        dateOfBirth || null,
        calculatedAge,
        parsedHeightCm,
        parsedWeightKg,
        updateDay === '' || updateDay === null || updateDay === undefined ? null : Number(updateDay),
        occupationSchedule || null,
        healthProblem || null,
        cycleHistory || null,
        cardioSessionsPerWeek || null,
        sleepSchedule || null,
        currentTrainingPlan || null,
        currentNutritionPlan || null,
        previousPlanHistory || null
      ]
    );

    await connection.query('DELETE FROM social_links WHERE user_id = ?', [req.user.id]);
    const validLinks = Array.isArray(socialLinks) ? socialLinks.filter((item) => item.platform && item.url) : [];
    if (validLinks.length) {
      await connection.query(
        'INSERT INTO social_links (user_id, platform, url) VALUES ?',
        [validLinks.map((item) => [req.user.id, item.platform, item.url])]
      );
    }

    if (updateDay !== '' && updateDay !== null && updateDay !== undefined) {
      const normalizedUpdateDay = Number(updateDay);
      const coachId = await getDefaultCoachId(connection);
      await connection.query(
        `INSERT INTO update_schedule (coach_id, client_id, frequency, day_of_week, reminder_enabled, next_due_date)
         VALUES (?, ?, 'weekly', ?, 1, ?)
         ON DUPLICATE KEY UPDATE day_of_week = VALUES(day_of_week), next_due_date = VALUES(next_due_date), reminder_enabled = 1`,
        [coachId, req.user.id, normalizedUpdateDay, nextDateForWeekday(normalizedUpdateDay)]
      );
      await syncUpdateDayQuestionnaireAnswer(connection, req.user.id, normalizedUpdateDay);
    }

    await connection.commit();
    connection.release();

    res.json({
      message: 'Profile updated',
      user: { id: req.user.id, email, role: 'client', fullName, onboardingCompleted: true }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /clients/me/profile-photo — compressed/cropped image from frontend, saved to Media Library
router.post('/me/profile-photo', authorizeRole(['client']), (req, res, next) => {
  profilePhotoUpload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Profile photo required' });
  }

  const url = `/uploads/media/${req.file.filename}`;
  const connection = await pool.getConnection();

  try {
    const folderId = await ensureProfilePhotoFolder(connection);

    await connection.beginTransaction();
    await connection.query('UPDATE users SET profile_photo = ? WHERE id = ?', [url, req.user.id]);
    await connection.query(
      'INSERT INTO media_assets (title, asset_type, url, source, folder_id) VALUES (?, "photo", ?, "profile_photo", ?)',
      [`Profile photo - client ${req.user.id}`, url, folderId]
    );
    await connection.commit();
    connection.release();

    res.status(201).json({ message: 'Profile photo uploaded', profilePhoto: url });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /clients/me/profile-photo — remove profile photo from user and return to default avatar
router.delete('/me/profile-photo', authorizeRole(['client']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.query('UPDATE users SET profile_photo = NULL WHERE id = ?', [req.user.id]);
    connection.release();
    res.json({ message: 'Profile photo removed', profilePhoto: null });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/me/billing', authorizeRole(['client']), [
  body('subscriptionPackage').notEmpty().withMessage('Subscription package required'),
  body('paymentMethod').isIn(['bank_transfer', 'stripe_card']).withMessage('Valid payment method required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { subscriptionPackage, paymentMethod } = req.body;
  const connection = await pool.getConnection();

  try {
    await ensureOnboardingSchema(connection);
    const selectedPackage = await getSelectedSubscriptionPlan(connection, subscriptionPackage);
    if (!selectedPackage) {
      connection.release();
      return res.status(400).json({ message: 'Μη έγκυρο πακέτο συνδρομής.' });
    }

    await connection.beginTransaction();

    const coachId = await getDefaultCoachId(connection);
    // The subscription clock begins only after the coach approves the payment.
    const pendingDate = new Date().toISOString().slice(0, 10);
    const referenceNumber = `KAIZEN-${String(req.user.id).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;

    await connection.query(
      `UPDATE onboarding_forms
       SET selected_package = ?, payment_method = ?
       WHERE client_id = ?`,
      [subscriptionPackage, paymentMethod, req.user.id]
    );
    await connection.query(
      `UPDATE client_onboarding
       SET selected_package = ?, payment_method = ?
       WHERE client_id = ?`,
      [subscriptionPackage, paymentMethod, req.user.id]
    );

    const [subscriptionResult] = await connection.query(
      `INSERT INTO subscriptions (client_id, coach_id, plan_name, plan_type, price, currency, start_date, end_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?)`,
      [
        req.user.id,
        coachId,
        selectedPackage.label,
        selectedPackage.months === 3 ? 'quarterly' : selectedPackage.months === 6 ? 'semi_annual' : selectedPackage.months === 12 ? 'annual' : 'monthly',
        selectedPackage.price,
        selectedPackage.currency || 'EUR',
        pendingDate,
        pendingDate,
        paymentMethod === 'stripe_card' ? 'Η πληρωμή με κάρτα αναμένει έγκριση coach.' : 'Το τραπεζικό έμβασμα αναμένει έγκριση coach.'
      ]
    );

    const [paymentResult] = await connection.query(
      `INSERT INTO payments (client_id, coach_id, subscription_id, amount, currency, method, status, reference_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        req.user.id,
        coachId,
        subscriptionResult.insertId,
        selectedPackage.price,
        selectedPackage.currency || 'EUR',
        paymentMethod === 'stripe_card' ? 'stripe' : 'bank_transfer',
        referenceNumber,
        paymentMethod === 'stripe_card' ? 'Stripe θα συνδεθεί αργότερα.' : 'Αναμένεται τραπεζικό έμβασμα.'
      ]
    );

    // A renewal or plan change must never revoke an already valid subscription.
    // New clients (or clients whose access has expired) remain pending as before.
    const [activeSubscriptions] = await connection.query(
      `SELECT id
       FROM subscriptions
       WHERE client_id = ?
         AND status IN ('active', 'expiring_soon')
         AND start_date <= CURDATE()
         AND end_date >= CURDATE()
       LIMIT 1`,
      [req.user.id]
    );
    if (!activeSubscriptions.length) {
      await connection.query(
        'UPDATE users SET status = "pending_payment", approved_at = NULL, approved_by = NULL WHERE id = ? AND role = "client"',
        [req.user.id]
      );
    }

    const [[clientUser]] = await connection.query(
      'SELECT full_name, email FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const clientName = clientUser?.full_name || clientUser?.email || 'Client';

    await notifyCoaches(connection, {
      clientId: req.user.id,
      paymentId: paymentResult.insertId,
      type: 'payment_request_created',
      title: 'Νέο αίτημα πληρωμής',
      body: `${clientName} επέλεξε ${selectedPackage.label} με ποσό ${Number(selectedPackage.price || 0).toFixed(2)} ${selectedPackage.currency || 'EUR'} (${paymentMethod === 'stripe_card' ? 'Stripe' : 'Τραπεζικό έμβασμα'}).`,
      linkUrl: `/clients/${req.user.id}`,
    });

    await connection.commit();
    connection.release();

    res.status(201).json({
      message: 'Η πληρωμή καταχωρήθηκε ως εκκρεμής.',
      paymentStatus: 'pending',
      paymentMethod,
      referenceNumber,
      amount: selectedPackage.price,
      currency: selectedPackage.currency || 'EUR',
      planName: selectedPackage.label
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /clients — coaches see their own clients, admins see all
// POST /clients/me/billing-proof — upload bank transfer proof for latest pending payment
router.post('/me/billing-proof', authorizeRole(['client']), (req, res, next) => {
  paymentProofUpload.single('proof')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Payment proof required' });
  }

  const proofUrl = req.file.path.replace(/\\/g, '/');
  const connection = await pool.getConnection();

  try {
    await ensurePaymentProofColumns(connection);

    const [payments] = await connection.query(
      `SELECT id, reference_number, amount, currency
       FROM payments
       WHERE client_id = ? AND method = 'bank_transfer' AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (!payments.length) {
      connection.release();
      return res.status(404).json({ message: 'No pending bank transfer payment found' });
    }

    await connection.query(
      `UPDATE payments
       SET proof_url = ?, proof_uploaded_at = NOW(), notes = CONCAT(COALESCE(notes, ''), '\nΑνέβηκε αποδεικτικό πληρωμής.')
       WHERE id = ?`,
      [proofUrl, payments[0].id]
    );

    const [[clientUser]] = await connection.query(
      'SELECT full_name, email FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const clientName = clientUser?.full_name || clientUser?.email || 'Πελάτης';

    await notifyCoaches(connection, {
      clientId: req.user.id,
      paymentId: payments[0].id,
      type: 'payment_proof_uploaded',
      title: 'Νέα πληρωμή με τραπεζικό έμβασμα',
      body: `${clientName} ανέβασε αποδεικτικό πληρωμής ${Number(payments[0].amount || 0).toFixed(2)} ${payments[0].currency || 'EUR'}. Χρειάζεται manual έγκριση.`,
      linkUrl: `/clients/${req.user.id}`,
    });

    await notifyUser(connection, req.user.id, {
      clientId: req.user.id,
      paymentId: payments[0].id,
      type: 'payment_proof_uploaded',
      title: 'Το αποδεικτικό πληρωμής στάλθηκε',
      body: 'Ο coach θα ελέγξει την πληρωμή σου και θα ενεργοποιήσει τη συνδρομή σου.',
      linkUrl: '/client-billing',
    });

    connection.release();
    res.status(201).json({
      message: 'Payment proof uploaded',
      paymentId: payments[0].id,
      referenceNumber: payments[0].reference_number,
      proofUrl
    });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureOnboardingSchema(connection);
    await ensureClientSoftDeleteColumns(connection);
    const search = String(req.query.search || '').trim();
    const searchLimit = search ? ' LIMIT 12' : '';

    let rows;
    if (req.user.role === 'admin' || req.user.role === 'moderator' || req.user.role === 'coach') {
      const filters = ["u.role = 'client'", 'c.deleted_at IS NULL'];
      const values = [];

      if (search) {
        filters.push('(u.full_name LIKE ? OR u.email LIKE ? OR c.phone LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      [rows] = await connection.query(
        `SELECT u.id, u.email, u.full_name, u.profile_photo, u.is_active, u.status AS user_status,
                u.created_at, u.last_seen_at,
                CASE WHEN u.last_seen_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END AS is_online,
                c.phone, c.gender, c.date_of_birth, c.height_cm, c.weight_kg, c.fitness_goal, c.coach_notes,
                cc.status AS coaching_status, cc.coach_id,
                COALESCE(us.day_of_week, ofm.update_day) AS update_day,
                COALESCE(us.next_due_date, CASE WHEN ofm.update_day IS NOT NULL THEN DATE_ADD(CURDATE(), INTERVAL ((ofm.update_day - DAYOFWEEK(CURDATE()) + 1 + 7) % 7) DAY) ELSE NULL END) AS next_update_date,
                ofm.submitted_at AS onboarding_submitted_at,
                wu.weight_kg AS latest_update_weight,
                wu.submitted_at AS latest_update_at,
                lp.status AS payment_status,
                lp.method AS payment_method,
                s.status AS subscription_status,
                s.end_date AS subscription_end_date,
                CASE
                  WHEN s.end_date IS NOT NULL AND s.end_date >= CURDATE() AND s.end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1
                  ELSE 0
                END AS is_expiring_soon,
                CASE
                  WHEN u.is_active = 0 THEN 'inactive'
                  WHEN u.status = 'active' THEN 'active'
                  WHEN u.status = 'expired' THEN 'inactive'
                  WHEN u.status = 'pending_payment' THEN 'pending'
                  WHEN lp.status = 'completed' AND (s.status IS NULL OR s.status IN ('active', 'expiring_soon')) THEN 'active'
                  WHEN lp.status = 'pending' THEN 'pending'
                  ELSE 'inactive'
                END AS client_status_key
         FROM users u
         LEFT JOIN clients c ON c.user_id = u.id
         LEFT JOIN coach_clients cc ON cc.client_id = u.id
         LEFT JOIN onboarding_forms ofm ON ofm.client_id = u.id
         LEFT JOIN update_schedule us ON us.client_id = u.id
         LEFT JOIN subscriptions s ON s.client_id = u.id AND s.id = (
           SELECT s2.id
           FROM subscriptions s2
           WHERE s2.client_id = u.id
             AND s2.status IN ('active', 'expiring_soon')
             AND s2.start_date <= CURDATE()
             AND s2.end_date >= CURDATE()
           ORDER BY s2.end_date DESC
           LIMIT 1
         )
         LEFT JOIN payments lp ON lp.client_id = u.id AND lp.id = (
           SELECT p2.id FROM payments p2 WHERE p2.client_id = u.id ORDER BY p2.created_at DESC LIMIT 1
         )
         LEFT JOIN (
           SELECT w1.client_id, NULL AS weight_kg, w1.submitted_at
           FROM weekly_updates w1
           INNER JOIN (
             SELECT client_id, MAX(submitted_at) AS submitted_at
             FROM weekly_updates
             GROUP BY client_id
           ) w2 ON w2.client_id = w1.client_id AND w2.submitted_at = w1.submitted_at
         ) wu ON wu.client_id = u.id
         WHERE ${filters.join(' AND ')}
         ORDER BY u.full_name
         ${searchLimit}`,
        values
      );
    } else {
      const filters = ["u.role = 'client'", "u.is_active = 1", 'c.deleted_at IS NULL'];
      const values = [req.user.id];

      if (search) {
        filters.push('(u.full_name LIKE ? OR u.email LIKE ? OR c.phone LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      [rows] = await connection.query(
        `SELECT u.id, u.email, u.full_name, u.profile_photo, u.is_active, u.status AS user_status,
                u.created_at, u.last_seen_at,
                CASE WHEN u.last_seen_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END AS is_online,
                c.phone, c.gender, c.date_of_birth, c.height_cm, c.weight_kg, c.fitness_goal,
                cc.status AS coaching_status,
                COALESCE(us.day_of_week, ofm.update_day) AS update_day,
                COALESCE(us.next_due_date, CASE WHEN ofm.update_day IS NOT NULL THEN DATE_ADD(CURDATE(), INTERVAL ((ofm.update_day - DAYOFWEEK(CURDATE()) + 1 + 7) % 7) DAY) ELSE NULL END) AS next_update_date,
                ofm.submitted_at AS onboarding_submitted_at,
                wu.weight_kg AS latest_update_weight,
                wu.submitted_at AS latest_update_at,
                lp.status AS payment_status,
                lp.method AS payment_method,
                s.status AS subscription_status,
                s.end_date AS subscription_end_date,
                CASE
                  WHEN s.end_date IS NOT NULL AND s.end_date >= CURDATE() AND s.end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1
                  ELSE 0
                END AS is_expiring_soon,
                CASE
                  WHEN u.status = 'active' THEN 'active'
                  WHEN u.status = 'expired' THEN 'inactive'
                  WHEN u.status = 'pending_payment' THEN 'pending'
                  WHEN lp.status = 'completed' AND (s.status IS NULL OR s.status IN ('active', 'expiring_soon')) THEN 'active'
                  WHEN lp.status = 'pending' THEN 'pending'
                  ELSE 'inactive'
                END AS client_status_key
         FROM users u
         INNER JOIN coach_clients cc ON cc.client_id = u.id AND cc.coach_id = ?
         LEFT JOIN clients c ON c.user_id = u.id
         LEFT JOIN onboarding_forms ofm ON ofm.client_id = u.id
         LEFT JOIN update_schedule us ON us.client_id = u.id
         LEFT JOIN subscriptions s ON s.client_id = u.id AND s.id = (
           SELECT s2.id
           FROM subscriptions s2
           WHERE s2.client_id = u.id
             AND s2.status IN ('active', 'expiring_soon')
             AND s2.start_date <= CURDATE()
             AND s2.end_date >= CURDATE()
           ORDER BY s2.end_date DESC
           LIMIT 1
         )
         LEFT JOIN payments lp ON lp.client_id = u.id AND lp.id = (
           SELECT p2.id FROM payments p2 WHERE p2.client_id = u.id ORDER BY p2.created_at DESC LIMIT 1
         )
         LEFT JOIN (
           SELECT w1.client_id, NULL AS weight_kg, w1.submitted_at
           FROM weekly_updates w1
           INNER JOIN (
             SELECT client_id, MAX(submitted_at) AS submitted_at
             FROM weekly_updates
             GROUP BY client_id
           ) w2 ON w2.client_id = w1.client_id AND w2.submitted_at = w1.submitted_at
         ) wu ON wu.client_id = u.id
         WHERE ${filters.join(' AND ')}
         ORDER BY u.full_name
         ${searchLimit}`,
        values
      );
    }

    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/trash', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureClientSoftDeleteColumns(connection);
    const [rows] = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.profile_photo,
              c.deleted_at, c.deleted_by,
              COALESCE(deleted_by_user.full_name, deleted_by_user.email) AS deleted_by_name
       FROM clients c
       INNER JOIN users u ON u.id = c.user_id AND u.role = 'client'
       LEFT JOIN users deleted_by_user ON deleted_by_user.id = c.deleted_by
       WHERE c.deleted_at IS NOT NULL
       ORDER BY c.deleted_at DESC, u.full_name ASC`
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// GET /clients/admin/notifications — notifications for coach/admin
router.get('/admin/notifications', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureNotificationsSchema(connection);

    const recentOnly = req.query.recent === 'true';
    const [rows] = await connection.query(
      `SELECT n.*, u.full_name AS client_name, u.email AS client_email
       FROM notifications n
       LEFT JOIN users u ON u.id = n.client_id
       WHERE n.user_id = ?
         ${recentOnly ? 'AND n.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)' : ''}
       ORDER BY n.created_at DESC
       LIMIT ${recentOnly ? 10 : 100}`,
      [req.user.id]
    );

    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /clients/:id — full profile
router.get('/notifications/unread-count', authorizeRole(['coach', 'admin', 'moderator', 'client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureNotificationsSchema(connection);
    const [[row]] = await connection.query(
      'SELECT COUNT(id) AS unread FROM notifications WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    connection.release();
    res.json({ unread: Number(row?.unread || 0) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/notifications/read', authorizeRole(['coach', 'admin', 'moderator', 'client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureNotificationsSchema(connection);
    await connection.query(
      'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    connection.release();
    res.json({ unread: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark one notification as read. The ownership condition is intentional: a
// notification can only be read by the user it was delivered to.
router.post('/notifications/:notificationId/read', authorizeRole(['coach', 'admin', 'moderator', 'client']), async (req, res) => {
  const notificationId = Number(req.params.notificationId);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ message: 'Invalid notification id' });
  }

  const connection = await pool.getConnection();
  try {
    await ensureNotificationsSchema(connection);
    const [result] = await connection.query(
      'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Notification not found' });

    const [[count]] = await connection.query(
      'SELECT COUNT(id) AS unread FROM notifications WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ id: notificationId, unread: Number(count?.unread || 0) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/me/notifications', authorizeRole(['client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureNotificationsSchema(connection);
    await ensurePaymentProofColumns(connection);

    const recentOnly = req.query.recent === 'true';
    const [notificationRows] = await connection.query(
      `SELECT * FROM notifications
       WHERE user_id = ? ${recentOnly ? 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)' : ''}
       ORDER BY created_at DESC LIMIT ${recentOnly ? 10 : 100}`,
      [req.user.id]
    );
    const [paymentRows] = await connection.query(
      'SELECT id, subscription_id, amount, currency, method, status, reference_number, proof_url, proof_uploaded_at, paid_at, created_at FROM payments WHERE client_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    const [subscriptionRows] = await connection.query(
      'SELECT * FROM subscriptions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    const paymentApproved = paymentRows.some((payment) => payment.status === 'completed') || req.user.status === 'active';

    connection.release();
    res.json({
      notifications: notificationRows,
      payments: paymentRows,
      subscription: subscriptionRows[0] || null,
      paymentApproved,
      unreadNotifications: notificationRows.filter((item) => !item.read_at).length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

async function ensurePushSubscriptionsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      endpoint VARCHAR(500) NOT NULL,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(255) NOT NULL,
      user_agent VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_endpoint (endpoint),
      INDEX idx_user_id (user_id)
    )
  `);
}

// Public VAPID key so the frontend can call PushManager.subscribe(). 404 when push isn't configured.
router.get('/push/vapid-public-key', async (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(404).json({ message: 'Push notifications are not configured' });
  }
  res.json({ publicKey });
});

router.post('/push/subscribe', [
  body('endpoint').isString().notEmpty(),
  body('keys.p256dh').isString().notEmpty(),
  body('keys.auth').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();
  try {
    await ensurePushSubscriptionsSchema(connection);
    const { endpoint, keys, userAgent } = req.body;
    await connection.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent)`,
      [req.user.id, endpoint, keys.p256dh, keys.auth, userAgent || null]
    );
    res.status(201).json({ message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.post('/push/unsubscribe', [
  body('endpoint').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();
  try {
    await ensurePushSubscriptionsSchema(connection);
    await connection.query(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
      [req.body.endpoint, req.user.id]
    );
    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/push/subscriptions', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensurePushSubscriptionsSchema(connection);
    const [rows] = await connection.query(
      'SELECT id, endpoint, user_agent, created_at FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.delete('/push/subscriptions/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensurePushSubscriptionsSchema(connection);
    const [result] = await connection.query(
      'DELETE FROM push_subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json({ message: 'Subscription removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

async function canAccessClientActivity(connection, user, clientId) {
  const [clients] = await connection.query(
    'SELECT id FROM users WHERE id = ? AND role = "client" LIMIT 1',
    [clientId]
  );
  if (!clients.length) return { allowed: false, status: 404, message: 'Client not found' };

  if (user.role === 'coach') {
    const [access] = await connection.query(
      'SELECT id FROM coach_clients WHERE coach_id = ? AND client_id = ? LIMIT 1',
      [user.id, clientId]
    );
    if (!access.length) return { allowed: false, status: 403, message: 'Access denied' };
  }

  return { allowed: true };
}

router.get('/:id/log', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const clientId = Number(req.params.id);
    const access = await canAccessClientActivity(connection, req.user, clientId);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    await ensureClientActivityLogSchema(connection);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const [rows] = await connection.query(
      `SELECT id, action, performed_by AS performedBy, performed_by_name AS performedByName,
              details, created_at AS createdAt
       FROM client_activity_log
       WHERE client_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [clientId, limit, offset]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.post('/:id/log', authorizeRole(['coach', 'admin', 'moderator']), [
  body('action').trim().isLength({ min: 1, max: 255 }),
  body('details').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    const clientId = Number(req.params.id);
    const access = await canAccessClientActivity(connection, req.user, clientId);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    await logClientActivity(connection, {
      clientId,
      action: req.body.action,
      performedBy: req.user.id,
      details: req.body.details || null,
    });
    res.status(201).json({ message: 'Activity logged' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/:id/questionnaire-answers', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureQuestionnaireSchema(connection);
    const [rows] = await connection.query(
      `SELECT qq.id AS question_id, qq.question, qq.type, qq.options, qq.sort_order, qq.placeholder, qa.answer
       FROM questionnaire_questions qq
       LEFT JOIN questionnaire_answers qa ON qa.question_id = qq.id AND qa.client_id = ?
       WHERE qq.is_active = TRUE
       ORDER BY qq.sort_order ASC, qq.id ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.put('/:id/questionnaire-answers', authorizeRole(['coach', 'admin', 'moderator']), [
  body('answers').isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();

  try {
    await ensureQuestionnaireSchema(connection);
    const clientId = req.params.id;
    const { answers } = req.body;

    await connection.beginTransaction();

    for (const entry of answers || []) {
      if (!entry || entry.question_id === undefined) continue;
      const value = Array.isArray(entry.answer) || (entry.answer && typeof entry.answer === 'object')
        ? JSON.stringify(entry.answer)
        : (entry.answer ?? '');
      await connection.query('DELETE FROM questionnaire_answers WHERE client_id = ? AND question_id = ?', [clientId, entry.question_id]);
      if (String(value).trim() !== '') {
        await connection.query(
          'INSERT INTO questionnaire_answers (client_id, question_id, answer) VALUES (?, ?, ?)',
          [clientId, entry.question_id, String(value)]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Οι απαντήσεις αποθηκεύτηκαν.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/:id/weekly-updates', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const clientId = Number(req.params.id);
    const access = await canAccessClientActivity(connection, req.user, clientId);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    const { ensureWeeklyUpdateSchema } = await import('./weekly-updates.js');
    await ensureWeeklyUpdateSchema(connection);

    const [answerRows] = await connection.query(
      `SELECT wu.id, wu.submitted_at, wu.week_start, wu.is_read,
              wua.answer, wuq.question, wuq.type, wuq.sort_order, wuq.standard_key
       FROM weekly_updates wu
       LEFT JOIN weekly_update_answers wua ON wua.update_id = wu.id
       LEFT JOIN update_questions wuq ON wuq.id = wua.question_id
       WHERE wu.client_id = ?
       ORDER BY wu.submitted_at DESC, wuq.sort_order ASC`,
      [clientId]
    );

    const updatesById = new Map();
    for (const row of answerRows) {
      if (!updatesById.has(row.id)) {
        updatesById.set(row.id, {
          id: row.id,
          submittedAt: row.submitted_at,
          weekStart: row.week_start,
          isRead: Boolean(row.is_read),
          weight: null,
          trainingRating: null,
          nutritionRating: null,
          generalRating: null,
          notes: null,
          photos: [],
        });
      }

      if (!row.question || row.answer === null || row.answer === undefined || row.answer === '') continue;

      const update = updatesById.get(row.id);
      const question = String(row.question)
        .toLocaleLowerCase('el-GR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const value = Number(String(row.answer).replace(',', '.'));

      if (row.standard_key === 'weight_kg' && Number.isFinite(value)) {
        update.weight = value;
      } else if (row.type === 'rating' && question.includes('προπον') && Number.isFinite(value)) {
        update.trainingRating = value;
      } else if (row.type === 'rating' && question.includes('διατροφ') && Number.isFinite(value)) {
        update.nutritionRating = value;
      } else if (row.type === 'rating' && question.includes('εβδομαδ') && Number.isFinite(value)) {
        update.generalRating = value;
      } else if (row.type === 'textarea' && !update.notes) {
        update.notes = row.answer;
      }
    }

    const updates = [...updatesById.values()];
    if (updates.length) {
      const [fileRows] = await connection.query(
        `SELECT update_id, file_url
         FROM weekly_update_files
         WHERE update_id IN (?) AND file_type = 'photo'
         ORDER BY created_at DESC`,
        [updates.map((update) => update.id)]
      );
      const photosByUpdateId = new Map();
      for (const file of fileRows) {
        const photos = photosByUpdateId.get(file.update_id) || [];
        photos.push(file.file_url);
        photosByUpdateId.set(file.update_id, photos);
      }
      for (const update of updates) update.photos = photosByUpdateId.get(update.id) || [];
    }

    res.json(updates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// GET /:id/workouts — completed workout sessions with the client's own
// post-workout feeling/notes, for the coach's Πρόοδος tab.
router.get('/:id/workouts', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const clientId = Number(req.params.id);
    const access = await canAccessClientActivity(connection, req.user, clientId);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    const { ensureWorkoutSchema } = await import('./client.js');
    await ensureWorkoutSchema(connection);

    const [workouts] = await connection.query(
      `SELECT id, day_name, completed_at, duration_seconds, total_sets_completed, total_volume_kg, workout_feeling, notes
       FROM workout_logs
       WHERE client_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT 20`,
      [clientId]
    );
    res.json(workouts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/:id/payments', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const clientId = Number(req.params.id);
    const access = await canAccessClientActivity(connection, req.user, clientId);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    const [payments] = await connection.query(
      `SELECT id, subscription_id, amount, currency, method, status, notes, paid_at, created_at
       FROM payments
       WHERE client_id = ?
       ORDER BY created_at DESC`,
      [clientId]
    );
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/:id', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureOnboardingSchema(connection);
    await ensureQuestionnaireSchema(connection);
    await ensurePaymentProofColumns(connection);
    await ensureClientDetailColumns(connection);
    await ensureClientSoftDeleteColumns(connection);

    const [rows] = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.profile_photo, u.bio, u.is_active,
              u.status AS user_status, u.created_at, u.last_seen_at,
              c.date_of_birth, c.gender, c.phone, c.height_cm, c.weight_kg, c.target_weight_kg,
              c.fitness_goal, c.medical_notes, c.coach_notes, c.discord_id,
              c.emergency_contact_name, c.emergency_contact_phone, c.deleted_at, c.deleted_by,
              cc.status AS coaching_status, cc.coach_id
       FROM users u
       LEFT JOIN clients c ON c.user_id = u.id
       LEFT JOIN coach_clients cc ON cc.client_id = u.id
       WHERE u.id = ? AND u.role = 'client'`,
      [req.params.id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    // The current admin/coach role owns the coach panel and can inspect all clients.

    const [onboardingRows] = await connection.query(
      'SELECT * FROM onboarding_forms WHERE client_id = ?',
      [req.params.id]
    );
    const [socialRows] = await connection.query(
      'SELECT platform, url FROM social_links WHERE user_id = ? ORDER BY platform',
      [req.params.id]
    );
    let intakeFileRows = [];
    try {
      [intakeFileRows] = await connection.query(
        `SELECT id, file_url, file_type, original_name, created_at
         FROM client_intake_files
         WHERE client_id = ?
         ORDER BY created_at ASC, id ASC`,
        [req.params.id]
      );
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
    const registrationBody = await getRegistrationBodyFallback(connection, req.params.id);
    const [subscriptionRows] = await connection.query(
      `SELECT id, plan_name, price, currency, start_date, end_date, status,
              DATEDIFF(end_date, CURDATE()) AS days_remaining
       FROM subscriptions
       WHERE client_id = ?
         AND status IN ('active', 'expiring_soon')
         AND start_date <= CURDATE()
         AND end_date >= CURDATE()
       ORDER BY end_date DESC
       LIMIT 1`,
      [req.params.id]
    );
    const [upcomingSubscriptionRows] = await connection.query(
      `SELECT s.id, s.plan_name, s.price, s.currency, s.start_date, s.end_date, s.status
       FROM subscriptions s
       INNER JOIN payments p ON p.subscription_id = s.id AND p.status = 'completed'
       WHERE s.client_id = ?
         AND s.status = 'active'
         AND s.start_date > CURDATE()
       ORDER BY s.start_date ASC
       LIMIT 1`,
      [req.params.id]
    );
    const [scheduleRows] = await connection.query(
      'SELECT * FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      [req.params.id]
    );
    const [progressRows] = await connection.query(
      'SELECT * FROM progress_updates WHERE client_id = ? ORDER BY submitted_at DESC LIMIT 5',
      [req.params.id]
    );
    const [paymentRows] = await connection.query(
      'SELECT id, subscription_id, amount, currency, method, status, notes, reference_number, proof_url, proof_uploaded_at, paid_at, created_at FROM payments WHERE client_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const [weeklyRows] = await connection.query(
      'SELECT id, submitted_at, week_start FROM weekly_updates WHERE client_id = ? ORDER BY submitted_at DESC LIMIT 12',
      [req.params.id]
    );

    if (progressRows.length > 0) {
      const progressIds = progressRows.map((row) => row.id);
      const [photoRows] = await connection.query(
        'SELECT * FROM progress_photos WHERE progress_update_id IN (?) ORDER BY created_at DESC',
        [progressIds]
      );
      const photoMap = {};
      photoRows.forEach((photo) => {
        if (!photoMap[photo.progress_update_id]) photoMap[photo.progress_update_id] = [];
        photoMap[photo.progress_update_id].push(photo);
      });
      progressRows.forEach((row) => {
        row.photos = photoMap[row.id] || [];
      });
    }

    connection.release();
    res.json({
      ...rows[0],
      height_cm: rows[0].height_cm || registrationBody.heightCm || null,
      weight_kg: rows[0].weight_kg || registrationBody.weightKg || null,
      target_weight_kg: rows[0].target_weight_kg || registrationBody.targetWeightKg || null,
      fitness_goal: rows[0].fitness_goal || registrationBody.goal || null,
      onboarding: onboardingRows[0] || null,
      socialLinks: socialRows,
      intakeFiles: intakeFileRows,
      subscription: subscriptionRows[0]
        ? { ...subscriptionRows[0], daysRemaining: subscriptionRows[0].days_remaining }
        : null,
      upcomingSubscription: upcomingSubscriptionRows[0] || null,
      payments: paymentRows,
      updateSchedule: scheduleRows[0] || null,
      progressUpdates: progressRows,
      weeklyUpdates: weeklyRows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /clients/:id/details — coach edits a client's personal info / coach-only notes
router.put('/:id/details', authorizeRole(['coach', 'admin', 'moderator']), [
  body('fullName').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('phone').optional({ nullable: true }).isString(),
  body('dateOfBirth').optional({ nullable: true }).isString(),
  body('gender').optional({ nullable: true, checkFalsy: true }).isIn(['male', 'female', 'other']),
  body('heightCm').optional({ nullable: true, checkFalsy: true }).isNumeric(),
  body('weightKg').optional({ nullable: true, checkFalsy: true }).isNumeric(),
  body('fitnessGoal').optional({ nullable: true }).isString(),
  body('medicalNotes').optional({ nullable: true }).isString(),
  body('emergencyContactName').optional({ nullable: true }).isString(),
  body('emergencyContactPhone').optional({ nullable: true }).isString(),
  body('discordId').optional({ nullable: true }).isString(),
  body('coachNotes').optional({ nullable: true }).isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();
  try {
    await ensureClientDetailColumns(connection);

    const userUpdates = [];
    const userValues = [];
    if (req.body.fullName !== undefined) {
      userUpdates.push('full_name = ?');
      userValues.push(req.body.fullName);
    }
    if (req.body.email !== undefined) {
      userUpdates.push('email = ?');
      userValues.push(req.body.email);
    }
    if (userUpdates.length) {
      userValues.push(req.params.id);
      await connection.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ? AND role = 'client'`, userValues);
    }

    const fieldMap = {
      phone: 'phone',
      dateOfBirth: 'date_of_birth',
      gender: 'gender',
      heightCm: 'height_cm',
      weightKg: 'weight_kg',
      fitnessGoal: 'fitness_goal',
      medicalNotes: 'medical_notes',
      emergencyContactName: 'emergency_contact_name',
      emergencyContactPhone: 'emergency_contact_phone',
      discordId: 'discord_id',
      coachNotes: 'coach_notes'
    };

    const updates = [];
    const values = [];
    for (const [bodyKey, column] of Object.entries(fieldMap)) {
      if (req.body[bodyKey] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(req.body[bodyKey] === '' ? null : req.body[bodyKey]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    values.push(req.params.id);
    const [result] = await connection.query(`UPDATE clients SET ${updates.join(', ')} WHERE user_id = ?`, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    await logClientActivity(connection, {
      clientId: Number(req.params.id),
      action: 'Personal information updated',
      performedBy: req.user.id,
    });

    res.json({ message: 'Client details updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// POST /clients/:id/payments — record a manual payment (Coach/Admin only)
router.post('/:id/payments', authorizeRole(['coach', 'admin']), [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('method').isIn(['cash', 'bank_transfer', 'card', 'stripe']),
  body('planId').optional({ nullable: true }).isInt({ gt: 0 }),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
  body('notes').optional({ nullable: true }).isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();
  try {
    const clientId = Number(req.params.id);
    const { amount, method, planId, startDate, endDate, notes } = req.body;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ message: 'End date must be on or after start date' });
    }

    await ensurePricingPlansSchema(connection);
    const { ensureSubscriptionPlanIdColumn } = await import('./register.js');
    await ensureSubscriptionPlanIdColumn(connection);
    let plan = null;
    if (planId) {
      const [plans] = await connection.query(
        'SELECT id, name, price, currency, period FROM pricing_plans WHERE id = ? AND is_active = 1 LIMIT 1',
        [planId]
      );
      if (!plans.length) return res.status(400).json({ message: 'Selected plan is not available' });
      plan = plans[0];
    }

    await connection.beginTransaction();

    const [clientRows] = await connection.query(
      'SELECT id FROM users WHERE id = ? AND role = "client" LIMIT 1',
      [clientId]
    );
    if (!clientRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Client not found' });
    }

    const planMonths = plan ? monthsFromPeriod(plan.period) : 1;
    const planType = planMonths === 1 ? 'monthly' : planMonths === 3 ? 'quarterly' : planMonths === 6 ? 'semi_annual' : planMonths === 12 ? 'annual' : 'custom';
    const planName = plan?.name || 'Χειροκίνητη συνδρομή';
    const planPrice = plan ? Number(plan.price) : Number(amount);
    const currency = plan?.currency || 'EUR';
    const [existingSubscriptions] = await connection.query(
      'SELECT id FROM subscriptions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
      [clientId]
    );

    let subscriptionId;
    if (existingSubscriptions.length) {
      subscriptionId = existingSubscriptions[0].id;
      await connection.query(
        `UPDATE subscriptions
         SET coach_id = ?, plan_id = ?, plan_name = ?, plan_type = ?, price = ?, currency = ?,
             start_date = ?, end_date = ?, status = 'active', notes = ?
         WHERE id = ?`,
        [req.user.id, plan?.id || null, planName, planType, planPrice, currency, startDate, endDate, notes || null, subscriptionId]
      );
    } else {
      const [subscriptionResult] = await connection.query(
        `INSERT INTO subscriptions
           (client_id, coach_id, plan_id, plan_name, plan_type, price, currency, start_date, end_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [clientId, req.user.id, plan?.id || null, planName, planType, planPrice, currency, startDate, endDate, notes || null]
      );
      subscriptionId = subscriptionResult.insertId;
    }

    const [paymentResult] = await connection.query(
      `INSERT INTO payments (client_id, coach_id, subscription_id, amount, currency, method, status, notes, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, NOW())`,
      [clientId, req.user.id, subscriptionId, amount, currency, method, notes || null]
    );

    await connection.query(
      'UPDATE users SET status = "active", approved_at = COALESCE(approved_at, NOW()), approved_by = COALESCE(approved_by, ?) WHERE id = ? AND role = "client"',
      [req.user.id, clientId]
    );
    await logClientActivity(connection, {
      clientId,
      action: `Χειροκίνητη πληρωμή €${Number(amount).toFixed(2)} - Συνδρομή ενεργοποιήθηκε`,
      performedBy: req.user.id,
      details: { paymentId: paymentResult.insertId, subscriptionId, planName },
    });

    await connection.commit();
    if (plan?.id) await awardPoints(connection, { clientId, planId: plan.id, paymentId: paymentResult.insertId });
    res.status(201).json({ message: 'Payment and subscription recorded', id: paymentResult.insertId, subscriptionId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.delete('/:id/payments/:paymentId', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const clientId = Number(req.params.id);
    const paymentId = Number(req.params.paymentId);
    const access = await canAccessClientActivity(connection, req.user, clientId);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    const [payments] = await connection.query(
      'SELECT id, amount FROM payments WHERE id = ? AND client_id = ? LIMIT 1',
      [paymentId, clientId]
    );
    if (!payments.length) return res.status(404).json({ message: 'Payment not found' });

    await connection.beginTransaction();
    await connection.query('DELETE FROM payments WHERE id = ? AND client_id = ?', [paymentId, clientId]);
    await logClientActivity(connection, {
      clientId,
      action: `Διαγραφή πληρωμής €${Number(payments[0].amount).toFixed(2)}`,
      performedBy: req.user.id,
      details: { paymentId },
    });
    await connection.commit();

    res.json({ message: 'Payment deleted' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// GET/POST /clients/me/messages — client-side view/send for their own thread
// (declared before the /:id/messages wildcard routes below so "me" is never
// captured as an :id value)
router.get('/messages/inbox', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureMessagesSchema(connection);
    const isAdmin = req.user.role === 'admin';
    const [rows] = await connection.query(
      `SELECT u.id AS client_id, u.full_name AS client_name, u.email AS client_email, u.profile_photo,
              MAX(m.created_at) AS last_message_at,
              SUBSTRING_INDEX(GROUP_CONCAT(m.body ORDER BY m.created_at DESC SEPARATOR '\\n'), '\\n', 1) AS last_message,
              SUM(CASE WHEN m.sender_role = 'client' AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread_count
       FROM coach_clients cc
       INNER JOIN users u ON u.id = cc.client_id AND u.role = 'client'
       LEFT JOIN messages m ON m.client_id = u.id
       ${isAdmin ? '' : 'WHERE cc.coach_id = ?'}
       GROUP BY u.id, u.full_name, u.email, u.profile_photo
       HAVING last_message_at IS NOT NULL
       ORDER BY unread_count DESC, last_message_at DESC`,
      isAdmin ? [] : [req.user.id]
    );
    res.json(rows.map((row) => ({ ...row, unread_count: Number(row.unread_count || 0) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/me/messages', authorizeRole(['client']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureMessagesSchema(connection);
    const [rows] = await connection.query(
      'SELECT id, sender_role, body, read_at, created_at FROM messages WHERE client_id = ? ORDER BY created_at ASC',
      [req.user.id]
    );
    await connection.query(
      "UPDATE messages SET read_at = COALESCE(read_at, NOW()) WHERE client_id = ? AND sender_role = 'coach' AND read_at IS NULL",
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/me/messages/unread-count', authorizeRole(['client']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureMessagesSchema(connection);
    const [[row]] = await connection.query(
      "SELECT COUNT(*) AS unread FROM messages WHERE client_id = ? AND sender_role = 'coach' AND read_at IS NULL",
      [req.user.id]
    );
    res.json({ unread: Number(row?.unread || 0) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/me/messages/coach', authorizeRole(['client']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureMessagesSchema(connection);
    const [rows] = await connection.query(
      `SELECT u.id, u.full_name, u.email, u.profile_photo
       FROM coach_clients cc
       INNER JOIN users u ON u.id = cc.coach_id
       WHERE cc.client_id = ?
       ORDER BY cc.created_at DESC
       LIMIT 1`,
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.post('/me/messages/typing', authorizeRole(['client']), (req, res) => {
  setMessageTyping(req.user.id, {
    role: 'client',
    name: String(req.body?.name || 'Ο πελάτης').trim().slice(0, 100),
    isTyping: Boolean(req.body?.isTyping),
  });
  res.json({ ok: true });
});

router.get('/me/messages/typing', authorizeRole(['client']), (req, res) => {
  res.json({ typer: getMessageTyper(req.user.id, 'coach') });
});

router.post('/me/messages', authorizeRole(['client']), [
  body('message').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  if (/(data:image\/|<img\b|base64,)/i.test(req.body.message)) {
    return res.status(400).json({ message: 'Images are not supported in messages' });
  }

  const connection = await pool.getConnection();
  try {
    await ensureMessagesSchema(connection);
    const [coachRows] = await connection.query(
      'SELECT coach_id FROM coach_clients WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    if (coachRows.length === 0) {
      return res.status(400).json({ message: 'No coach assigned yet' });
    }
    const coachId = coachRows[0].coach_id;
    const [[clientRow]] = await connection.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    const clientName = clientRow?.full_name || 'πελάτη';

    await connection.query(
      `INSERT INTO messages (client_id, coach_id, sender_role, body) VALUES (?, ?, 'client', ?)`,
      [req.user.id, coachId, req.body.message]
    );
    await notifyUser(connection, coachId, {
      clientId: req.user.id,
      type: 'client_message',
      title: 'Νέο μήνυμα από πελάτη',
      body: req.body.message,
      title: `Μήνυμα από τον/την ${clientName}`,
      linkUrl: `/clients/${req.user.id}?tab=messages`
    });
    const [adminRows] = await connection.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?",
      [coachId]
    );
    await Promise.all(adminRows.map((admin) => notifyUser(connection, admin.id, {
      clientId: req.user.id,
      type: 'client_message',
      title: 'Νέο μήνυμα από πελάτη',
      body: req.body.message,
      title: `Μήνυμα από τον/την ${clientName}`,
      linkUrl: `/clients/${req.user.id}?tab=messages`
    })));

    res.status(201).json({ message: 'Message sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// GET/POST /clients/:id/messages — coach-side view/send for one client's thread
router.get('/:id/messages', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureMessagesSchema(connection);
    const [rows] = await connection.query(
      'SELECT id, sender_role, body, read_at, created_at FROM messages WHERE client_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    await connection.query(
      "UPDATE messages SET read_at = COALESCE(read_at, NOW()) WHERE client_id = ? AND sender_role = 'client' AND read_at IS NULL",
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/:id/messages/unread-count', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureMessagesSchema(connection);
    const [[row]] = await connection.query(
      "SELECT COUNT(*) AS unread FROM messages WHERE client_id = ? AND sender_role = 'client' AND read_at IS NULL",
      [req.params.id]
    );
    res.json({ unread: Number(row?.unread || 0) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.post('/:id/messages/typing', authorizeRole(['coach', 'admin']), (req, res) => {
  setMessageTyping(req.params.id, {
    role: 'coach',
    name: String(req.body?.name || 'Ο coach').trim().slice(0, 100),
    isTyping: Boolean(req.body?.isTyping),
  });
  res.json({ ok: true });
});

router.get('/:id/messages/typing', authorizeRole(['coach', 'admin']), (req, res) => {
  res.json({ typer: getMessageTyper(req.params.id, 'client') });
});

router.post('/:id/messages', authorizeRole(['coach', 'admin']), [
  body('message').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  if (/(data:image\/|<img\b|base64,)/i.test(req.body.message)) {
    return res.status(400).json({ message: 'Images are not supported in messages' });
  }

  const connection = await pool.getConnection();
  try {
    await ensureMessagesSchema(connection);
    const [[coachRow]] = await connection.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    const coachName = coachRow?.full_name || 'coach';
    await connection.query(
      `INSERT INTO messages (client_id, coach_id, sender_role, body) VALUES (?, ?, 'coach', ?)`,
      [req.params.id, req.user.id, req.body.message]
    );
    await notifyUser(connection, req.params.id, {
      type: 'coach_message',
      title: 'Νέο μήνυμα από τον coach',
      body: req.body.message,
      title: `Μήνυμα από τον/την ${coachName}`,
      linkUrl: '/client-messages'
    });

    res.status(201).json({ message: 'Message sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// POST /clients/:id/assign-training-template — copy a template into this client's
// active plan. The template itself is only ever read here, never modified.
router.post('/:id/assign-training-template', authorizeRole(['coach', 'admin']), [
  body('templateId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    const template = await getFullTrainingTemplate(connection, req.body.templateId);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const [clientRows] = await connection.query('SELECT full_name FROM users WHERE id = ?', [req.params.id]);
    if (!clientRows.length) return res.status(404).json({ message: 'Client not found' });
    const clientName = clientRows[0].full_name || '';

    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT id FROM training_plans WHERE client_id = ? AND status = 'active' ORDER BY updated_at DESC, created_at DESC LIMIT 1",
      [req.params.id]
    );
    if (existing[0]?.id) {
      await connection.query("UPDATE training_plans SET status = 'archived' WHERE id = ?", [existing[0].id]);
    }

    const [result] = await connection.query(
      `INSERT INTO training_plans
        (coach_id, client_id, template_id, title, description, duration_weeks, difficulty, is_template, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'active')`,
      [
        req.user.id,
        req.params.id,
        template.id,
        clientName ? `${template.title} - ${clientName}` : template.title,
        template.description || null,
        template.days_per_week || null,
        template.level || 'intermediate',
      ]
    );

    await insertTrainingPlanDays(connection, result.insertId, template.days || []);
    await logClientActivity(connection, {
      clientId: Number(req.params.id),
      action: 'Training plan assigned',
      performedBy: req.user.id,
      details: `Template: ${template.title}`,
    });

    await connection.commit();
    res.status(201).json({ message: 'Template assigned', planId: result.insertId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// POST /clients/:id/assign-nutrition-template — same as above, for nutrition
router.post('/:id/assign-nutrition-template', authorizeRole(['coach', 'admin']), [
  body('templateId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    const template = await getFullNutritionTemplate(connection, req.body.templateId);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const [clientRows] = await connection.query('SELECT full_name FROM users WHERE id = ?', [req.params.id]);
    if (!clientRows.length) return res.status(404).json({ message: 'Client not found' });
    const clientName = clientRows[0].full_name || '';

    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT id FROM nutrition_plans WHERE client_id = ? AND status = 'active' ORDER BY updated_at DESC, created_at DESC LIMIT 1",
      [req.params.id]
    );
    if (existing[0]?.id) {
      await connection.query("UPDATE nutrition_plans SET status = 'archived' WHERE id = ?", [existing[0].id]);
    }

    const [result] = await connection.query(
      `INSERT INTO nutrition_plans
        (coach_id, client_id, template_id, title, description, daily_calories, protein_g, carbs_g, fat_g, is_template, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active')`,
      [
        req.user.id,
        req.params.id,
        template.id,
        clientName ? `${template.title} - ${clientName}` : template.title,
        template.description || null,
        template.daily_calories || null,
        template.protein_g || null,
        template.carbs_g || null,
        template.fat_g || null,
      ]
    );

    await insertNutritionPlanMeals(connection, result.insertId, template.meals || []);
    await logClientActivity(connection, {
      clientId: Number(req.params.id),
      action: 'Nutrition plan assigned',
      performedBy: req.user.id,
      details: `Template: ${template.title}`,
    });

    await connection.commit();
    res.status(201).json({ message: 'Template assigned', planId: result.insertId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// POST /clients — create client and optionally assign to coach
router.post('/', authorizeRole(['coach', 'admin']), [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
  body('fullName').notEmpty().withMessage('Full name required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    email, password, fullName,
    phone, gender, dateOfBirth, heightCm, weightKg,
    fitnessGoal, medicalNotes,
    emergencyContactName, emergencyContactPhone
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await ensureOnboardingSchema(connection);
    await connection.beginTransaction();

    const [existing] = await connection.query(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [userResult] = await connection.query(
      'INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, "client")',
      [email, hashedPassword, fullName]
    );
    const userId = userResult.insertId;

    await connection.query(
      `INSERT INTO clients
         (user_id, phone, gender, date_of_birth, height_cm, weight_kg,
          fitness_goal, medical_notes, emergency_contact_name, emergency_contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, phone || null, gender || null, dateOfBirth || null,
       heightCm || null, weightKg || null, fitnessGoal || null,
       medicalNotes || null, emergencyContactName || null, emergencyContactPhone || null]
    );

    // Auto-assign to the creating coach
    if (req.user.role === 'coach') {
      await connection.query(
        'INSERT INTO coach_clients (coach_id, client_id, status) VALUES (?, ?, "active")',
        [req.user.id, userId]
      );
    }

    await logClientActivity(connection, {
      clientId: userId,
      action: 'Client created',
      performedBy: req.user.id,
      details: `Client: ${fullName}`,
    });

    await connection.commit();
    connection.release();

    res.status(201).json({ message: 'Client created successfully', id: userId });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /clients/:id/approve-payment — manual bank transfer approval
router.post('/:id/approve-payment', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureNotificationsSchema(connection);
    await ensurePaymentProofColumns(connection);
    const { ensureSubscriptionPlanIdColumn } = await import('./register.js');
    await ensureSubscriptionPlanIdColumn(connection);

    const clientId = Number(req.params.id);
    const paymentId = req.body?.paymentId ? Number(req.body.paymentId) : null;
    const [clients] = await connection.query(
      'SELECT id, full_name, email FROM users WHERE id = ? AND role = "client" LIMIT 1',
      [clientId]
    );

    if (!clients.length) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    const [payments] = await connection.query(
      `SELECT p.id, p.subscription_id, p.amount, p.currency, p.method, p.status, p.proof_url, s.plan_type, s.plan_id
       FROM payments p
       LEFT JOIN subscriptions s ON s.id = p.subscription_id
       WHERE p.client_id = ? AND p.status = 'pending' AND (? IS NULL OR p.id = ?)
       ORDER BY p.proof_uploaded_at DESC, p.created_at DESC
       LIMIT 1`,
      [clientId, paymentId, paymentId]
    );

    if (!payments.length) {
      connection.release();
      return res.status(400).json({ message: 'Δεν υπάρχει εκκρεμής πληρωμή για έγκριση.' });
    }

    await connection.beginTransaction();

    await connection.query(
      `UPDATE payments
       SET status = 'completed', paid_at = NOW(), notes = CONCAT(COALESCE(notes, ''), '\nΕγκρίθηκε χειροκίνητα από coach/admin.')
       WHERE id = ?`,
      [payments[0].id]
    );

    if (payments[0].subscription_id) {
      const monthsByPlanType = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12, custom: 1 };
      const months = monthsByPlanType[payments[0].plan_type] || 1;
      const [currentSubscriptions] = await connection.query(
        `SELECT end_date
         FROM subscriptions
         WHERE client_id = ?
           AND id <> ?
           AND status IN ('active', 'expiring_soon')
           AND start_date <= CURDATE()
           AND end_date >= CURDATE()
         ORDER BY end_date DESC
         LIMIT 1`,
        [clientId, payments[0].subscription_id]
      );
      const currentEndDate = currentSubscriptions[0]?.end_date || null;
      await connection.query(
        `UPDATE subscriptions
         SET start_date = CASE WHEN ? IS NULL THEN CURDATE() ELSE DATE_ADD(?, INTERVAL 1 DAY) END,
             end_date = DATE_ADD(CASE WHEN ? IS NULL THEN CURDATE() ELSE DATE_ADD(?, INTERVAL 1 DAY) END, INTERVAL ? MONTH),
             status = 'active'
         WHERE id = ?`,
        [currentEndDate, currentEndDate, currentEndDate, currentEndDate, months, payments[0].subscription_id]
      );
    }

    await connection.query(
      'UPDATE users SET status = "active", approved_at = NOW(), approved_by = ? WHERE id = ?',
      [req.user.id, clientId]
    );

    await notifyUser(connection, clientId, {
      clientId,
      paymentId: payments[0].id,
      type: 'payment_approved',
      title: 'Η πληρωμή σου εγκρίθηκε',
      body: 'Η συνδρομή σου είναι ενεργή. Τα προγράμματα και το progress ξεκλειδώθηκαν.',
      linkUrl: '/client-dashboard',
    });

    await notifyCoaches(connection, {
      clientId,
      paymentId: payments[0].id,
      type: 'payment_approved',
      title: 'Πληρωμή εγκρίθηκε',
      body: `${clients[0].full_name || clients[0].email} ενεργοποιήθηκε χειροκίνητα.`,
      linkUrl: `/clients/${clientId}`,
    });

    await connection.query(
      'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE client_id = ? AND payment_id = ? AND type IN (?, ?)',
      [clientId, payments[0].id, 'payment_proof_uploaded', 'payment_request_created']
    );
    await logClientActivity(connection, {
      clientId,
      action: 'Payment approved',
      performedBy: req.user.id,
      details: `Payment #${payments[0].id} approved`,
    });

    await connection.commit();
    if (payments[0].plan_id) await awardPoints(connection, { clientId, planId: payments[0].plan_id, paymentId: payments[0].id });
    connection.release();

    res.json({
      message: 'Η πληρωμή εγκρίθηκε και ο πελάτης ενεργοποιήθηκε.',
      clientId,
      paymentId: payments[0].id,
      status: 'active',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /clients/:id — update client profile
router.post('/:id/reject-payment', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureNotificationsSchema(connection);
    await ensurePaymentProofColumns(connection);

    const clientId = Number(req.params.id);
    const paymentId = Number(req.body?.paymentId);
    if (!paymentId) {
      connection.release();
      return res.status(400).json({ message: 'Payment id required' });
    }

    const [clients] = await connection.query(
      'SELECT id, full_name, email FROM users WHERE id = ? AND role = "client" LIMIT 1',
      [clientId]
    );
    if (!clients.length) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    const [payments] = await connection.query(
      `SELECT id, subscription_id, amount, currency, method, status
       FROM payments
       WHERE id = ? AND client_id = ? AND status = 'pending'
       LIMIT 1`,
      [paymentId, clientId]
    );
    if (!payments.length) {
      connection.release();
      return res.status(400).json({ message: 'Δεν υπάρχει εκκρεμής πληρωμή για απόρριψη.' });
    }

    await connection.beginTransaction();

    await connection.query(
      `UPDATE payments
       SET status = 'failed', notes = CONCAT(COALESCE(notes, ''), '\nΑπορρίφθηκε χειροκίνητα από coach/admin.')
       WHERE id = ?`,
      [paymentId]
    );

    if (payments[0].subscription_id) {
      await connection.query(
        "UPDATE subscriptions SET status = 'cancelled' WHERE id = ?",
        [payments[0].subscription_id]
      );
    }

    await refreshClientPaymentStatus(connection, clientId);

    await notifyUser(connection, clientId, {
      clientId,
      paymentId,
      type: 'payment_rejected',
      title: 'Η πληρωμή σου απορρίφθηκε',
      body: 'Ο coach απέρριψε την πληρωμή. Μπορείς να ανεβάσεις νέο αποδεικτικό ή να επικοινωνήσεις μαζί του για διόρθωση.',
      linkUrl: '/client-billing',
    });

    await notifyCoaches(connection, {
      clientId,
      paymentId,
      type: 'payment_rejected',
      title: 'Πληρωμή απορρίφθηκε',
      body: `${clients[0].full_name || clients[0].email} παραμένει σε κατάσταση πληρωμής μετά την απόρριψη.`,
      linkUrl: `/clients/${clientId}`,
    });

    await connection.query(
      'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE client_id = ? AND payment_id = ? AND type IN (?, ?)',
      [clientId, paymentId, 'payment_proof_uploaded', 'payment_request_created']
    );
    await logClientActivity(connection, {
      clientId,
      action: 'Payment rejected',
      performedBy: req.user.id,
      details: `Payment #${paymentId} rejected`,
    });

    await connection.commit();
    connection.release();

    res.json({ message: 'Η πληρωμή απορρίφθηκε.', clientId, paymentId });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authorizeRole(['coach', 'admin', 'moderator']), [
  body('email').optional().isEmail(),
  body('fullName').optional().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureOnboardingSchema(connection);
    // Verify client exists and coach has access
    const [rows] = await connection.query(
      `SELECT u.id, u.is_active, cc.coach_id
       FROM users u
       LEFT JOIN coach_clients cc ON cc.client_id = u.id
       WHERE u.id = ? AND u.role = 'client'`,
      [req.params.id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    if (req.user.role === 'coach' && rows[0].coach_id !== req.user.id) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    await connection.beginTransaction();

    const { fullName, email, bio, isActive } = req.body;

    if (fullName || email || bio !== undefined || isActive !== undefined) {
      const updates = [];
      const values = [];

      if (fullName) { updates.push('full_name = ?'); values.push(fullName); }
      if (email)    { updates.push('email = ?');     values.push(email); }
      if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
      if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }

      if (updates.length > 0) {
        values.push(req.params.id);
        await connection.query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values
        );
      }
    }

    const {
      phone, gender, dateOfBirth, heightCm, weightKg,
      fitnessGoal, medicalNotes, coachNotes, emergencyContactName, emergencyContactPhone
    } = req.body;

    await connection.query(
      `INSERT INTO clients (user_id, phone, gender, date_of_birth, height_cm, weight_kg,
         fitness_goal, medical_notes, coach_notes, emergency_contact_name, emergency_contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone = COALESCE(VALUES(phone), phone),
         gender = COALESCE(VALUES(gender), gender),
         date_of_birth = COALESCE(VALUES(date_of_birth), date_of_birth),
         height_cm = COALESCE(VALUES(height_cm), height_cm),
         weight_kg = COALESCE(VALUES(weight_kg), weight_kg),
         fitness_goal = COALESCE(VALUES(fitness_goal), fitness_goal),
         medical_notes = COALESCE(VALUES(medical_notes), medical_notes),
         coach_notes = COALESCE(VALUES(coach_notes), coach_notes),
         emergency_contact_name = COALESCE(VALUES(emergency_contact_name), emergency_contact_name),
         emergency_contact_phone = COALESCE(VALUES(emergency_contact_phone), emergency_contact_phone)`,
      [req.params.id, phone || null, gender || null, dateOfBirth || null,
       heightCm || null, weightKg || null, fitnessGoal || null,
       medicalNotes || null, coachNotes || null, emergencyContactName || null, emergencyContactPhone || null]
    );

    const clientId = Number(req.params.id);
    if (isActive !== undefined && Boolean(rows[0].is_active) !== Boolean(isActive)) {
      await logClientActivity(connection, {
        clientId,
        action: 'Client status changed',
        performedBy: req.user.id,
        details: isActive ? 'Status: active' : 'Status: inactive',
      });
    }

    if ([fullName, email, bio, phone, gender, dateOfBirth, heightCm, weightKg, fitnessGoal, medicalNotes, coachNotes, emergencyContactName, emergencyContactPhone].some((value) => value !== undefined)) {
      await logClientActivity(connection, {
        clientId,
        action: 'Personal information updated',
        performedBy: req.user.id,
      });
    }

    await connection.commit();
    connection.release();

    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /clients/:id/update-day — update weekly check-in day from admin/coach
router.put('/:id/update-day', authorizeRole(['coach', 'admin']), [
  body('updateDay').isInt({ min: 0, max: 6 }).withMessage('Valid update day required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureOnboardingSchema(connection);
    await ensureQuestionnaireSchema(connection);
    const clientId = Number(req.params.id);
    const updateDay = Number(req.body.updateDay);

    const [rows] = await connection.query(
      `SELECT u.id, COALESCE(cc.coach_id, us.coach_id, ?) AS coach_id
       FROM users u
       LEFT JOIN coach_clients cc ON cc.client_id = u.id
       LEFT JOIN update_schedule us ON us.client_id = u.id
       WHERE u.id = ? AND u.role = 'client'
       LIMIT 1`,
      [req.user.id, clientId]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    if (req.user.role === 'coach' && rows[0].coach_id !== req.user.id) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const coachId = rows[0].coach_id || req.user.id;
    const nextDueDate = nextDateForWeekday(updateDay);

    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO onboarding_forms (client_id, update_day)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE update_day = VALUES(update_day)`,
      [clientId, updateDay]
    );
    await connection.query(
      `INSERT INTO update_schedule (coach_id, client_id, frequency, day_of_week, reminder_enabled, next_due_date)
       VALUES (?, ?, 'weekly', ?, 1, ?)
       ON DUPLICATE KEY UPDATE day_of_week = VALUES(day_of_week), next_due_date = VALUES(next_due_date), reminder_enabled = 1`,
      [coachId, clientId, updateDay, nextDueDate]
    );
    await syncUpdateDayQuestionnaireAnswer(connection, clientId, updateDay);
    await connection.commit();
    connection.release();

    res.json({ message: 'Update day changed', updateDay, nextUpdateDate: nextDueDate });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /clients/:id — admin only, permanent delete of client and related data
router.delete('/:id', authorizeRole(['admin']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureClientSoftDeleteColumns(connection);
    const clientId = Number(req.params.id);
    const [rows] = await connection.query(
      `SELECT u.id, c.deleted_at
       FROM users u
       LEFT JOIN clients c ON c.user_id = u.id
       WHERE u.id = ? AND u.role = 'client'`,
      [clientId]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    if (rows[0].deleted_at) {
      connection.release();
      return res.status(400).json({ message: 'Client is already in trash' });
    }

    await connection.beginTransaction();
    const [updateResult] = await connection.query(
      `UPDATE clients
       SET deleted_at = NOW(), deleted_by = ?
       WHERE user_id = ? AND deleted_at IS NULL`,
      [req.user.id, clientId]
    );

    // Some legacy client users predate the clients profile row. Create the
    // minimal profile record so they follow the same soft-delete lifecycle.
    if (updateResult.affectedRows === 0) {
      await connection.query(
        `INSERT INTO clients (user_id, deleted_at, deleted_by)
         VALUES (?, NOW(), ?)`,
        [clientId, req.user.id]
      );
    }
    await logClientActivity(connection, {
      clientId,
      action: 'Μεταφορά στον Κάδο',
      performedBy: req.user.id,
    });

    await connection.commit();
    connection.release();
    res.json({ message: 'Client moved to trash' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/restore', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureClientSoftDeleteColumns(connection);
    const clientId = Number(req.params.id);
    const [result] = await connection.query(
      `UPDATE clients
       SET deleted_at = NULL, deleted_by = NULL
       WHERE user_id = ? AND deleted_at IS NOT NULL`,
      [clientId]
    );

    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ message: 'Trashed client not found' });
    }

    await logClientActivity(connection, {
      clientId,
      action: 'Επαναφορά από τον Κάδο',
      performedBy: req.user.id,
    });

    connection.release();
    res.json({ message: 'Client restored from trash' });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/permanent', authorizeRole(['admin']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureOnboardingSchema(connection);
    await ensureClientSoftDeleteColumns(connection);
    const clientId = Number(req.params.id);

    const [rows] = await connection.query(
      `SELECT u.id
       FROM users u
       INNER JOIN clients c ON c.user_id = u.id
       WHERE u.id = ? AND u.role = 'client' AND c.deleted_at IS NOT NULL`,
      [clientId]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Trashed client not found' });
    }

    const ignoreDelete = async (sql, values) => {
      try {
        await connection.query(sql, values);
      } catch (error) {
        if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) throw error;
      }
    };

    await connection.beginTransaction();

    await logClientActivity(connection, {
      clientId,
      action: 'Client deleted',
      performedBy: req.user.id,
      details: 'Permanent deletion requested',
    });

    await ignoreDelete('DELETE FROM weekly_update_photos WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM progress_photos WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM payments WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM subscriptions WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM weekly_updates WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM progress_updates WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM update_schedule WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM onboarding_forms WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM client_onboarding WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM coach_clients WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM social_links WHERE user_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM training_plans WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM nutrition_plans WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM workout_logs WHERE client_id = ?', [clientId]);
    await ignoreDelete('DELETE FROM notifications WHERE user_id = ? OR client_id = ?', [clientId, clientId]);
    await ignoreDelete('DELETE FROM clients WHERE user_id = ?', [clientId]);
    await connection.query('DELETE FROM users WHERE id = ? AND role = "client"', [clientId]);

    await connection.commit();
    connection.release();
    res.json({ message: 'Client permanently deleted' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
