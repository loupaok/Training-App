import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

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

function normalizeSocialLinks(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item.platform && item.url) : [];
  } catch {
    return [];
  }
}

async function getDefaultCoachId(connection) {
  const [rows] = await connection.query(
    "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id LIMIT 1"
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

// GET /clients/me/onboarding — current client's onboarding state
router.get('/me/onboarding', authorizeRole(['client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureOnboardingSchema(connection);

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
              ofm.update_day, ofm.occupation_schedule, ofm.health_problem, ofm.injuries,
              ofm.cycle_history, ofm.cardio_sessions_per_week, ofm.sleep_schedule,
              ofm.current_training_plan, ofm.current_nutrition_plan, ofm.previous_plan_history
       FROM users u
       LEFT JOIN clients c ON c.user_id = u.id
       LEFT JOIN onboarding_forms ofm ON ofm.client_id = u.id
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
      heightCm: row.height_cm || '',
      weightKg: row.weight_kg || '',
      goal: row.fitness_goal || '',
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
      const coachId = await getDefaultCoachId(connection);
      await connection.query(
        `INSERT INTO update_schedule (coach_id, client_id, frequency, day_of_week, reminder_enabled, next_due_date)
         VALUES (?, ?, 'weekly', ?, 1, ?)
         ON DUPLICATE KEY UPDATE day_of_week = VALUES(day_of_week), next_due_date = VALUES(next_due_date), reminder_enabled = 1`,
        [coachId, req.user.id, Number(updateDay), nextDateForWeekday(Number(updateDay))]
      );
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

    const [onboardingRows] = await connection.query(
      'SELECT id FROM onboarding_forms WHERE client_id = ? LIMIT 1',
      [req.user.id]
    );
    if (!onboardingRows.length) {
      connection.release();
      return res.status(400).json({ message: 'Πρέπει πρώτα να ολοκληρωθεί η φόρμα εισαγωγής.' });
    }

    await connection.beginTransaction();

    const coachId = await getDefaultCoachId(connection);
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = addMonths(new Date(), selectedPackage.months);
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
       VALUES (?, ?, ?, 'custom', ?, ?, ?, ?, 'active', ?)`,
      [
        req.user.id,
        coachId,
        selectedPackage.label,
        selectedPackage.price,
        selectedPackage.currency || 'EUR',
        startDate,
        endDate,
        paymentMethod === 'stripe_card' ? 'Stripe card selected - integration pending' : 'Bank transfer selected'
      ]
    );

    await connection.query(
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
      `SELECT id, reference_number
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
    const search = String(req.query.search || '').trim();
    const searchLimit = search ? ' LIMIT 12' : '';

    let rows;
    if (req.user.role === 'admin' || req.user.role === 'moderator') {
      const filters = ["u.role = 'client'", "u.is_active = 1"];
      const values = [];

      if (search) {
        filters.push('(u.full_name LIKE ? OR u.email LIKE ? OR c.phone LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      [rows] = await connection.query(
        `SELECT u.id, u.email, u.full_name, u.profile_photo, u.is_active,
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
                CASE
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
           SELECT s2.id FROM subscriptions s2 WHERE s2.client_id = u.id ORDER BY s2.created_at DESC LIMIT 1
         )
         LEFT JOIN payments lp ON lp.client_id = u.id AND lp.id = (
           SELECT p2.id FROM payments p2 WHERE p2.client_id = u.id ORDER BY p2.created_at DESC LIMIT 1
         )
         LEFT JOIN (
           SELECT w1.client_id, w1.weight_kg, w1.submitted_at
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
      const filters = ["u.role = 'client'", "u.is_active = 1"];
      const values = [req.user.id];

      if (search) {
        filters.push('(u.full_name LIKE ? OR u.email LIKE ? OR c.phone LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      [rows] = await connection.query(
        `SELECT u.id, u.email, u.full_name, u.profile_photo, u.is_active,
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
                CASE
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
           SELECT s2.id FROM subscriptions s2 WHERE s2.client_id = u.id ORDER BY s2.created_at DESC LIMIT 1
         )
         LEFT JOIN payments lp ON lp.client_id = u.id AND lp.id = (
           SELECT p2.id FROM payments p2 WHERE p2.client_id = u.id ORDER BY p2.created_at DESC LIMIT 1
         )
         LEFT JOIN (
           SELECT w1.client_id, w1.weight_kg, w1.submitted_at
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

// GET /clients/:id — full profile
router.get('/:id', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureOnboardingSchema(connection);

    const [rows] = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.profile_photo, u.bio, u.is_active,
              c.date_of_birth, c.gender, c.phone, c.height_cm, c.weight_kg,
              c.fitness_goal, c.medical_notes, c.coach_notes,
              c.emergency_contact_name, c.emergency_contact_phone,
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

    // Coaches can only view their own clients
    if (req.user.role === 'coach' && rows[0].coach_id !== req.user.id) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [onboardingRows] = await connection.query(
      'SELECT * FROM onboarding_forms WHERE client_id = ?',
      [req.params.id]
    );
    const [socialRows] = await connection.query(
      'SELECT platform, url FROM social_links WHERE user_id = ? ORDER BY platform',
      [req.params.id]
    );
    const [subscriptionRows] = await connection.query(
      'SELECT * FROM subscriptions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
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
      'SELECT id, subscription_id, amount, currency, method, status, reference_number, paid_at, created_at FROM payments WHERE client_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const [weeklyRows] = await connection.query(
      'SELECT id, weight_kg, training_score, nutrition_score, notes, submitted_at, week_start FROM weekly_updates WHERE client_id = ? ORDER BY submitted_at DESC LIMIT 12',
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
      onboarding: onboardingRows[0] || null,
      socialLinks: socialRows,
      subscription: subscriptionRows[0] || null,
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

// PUT /clients/:id — update client profile
router.put('/:id', authorizeRole(['coach', 'admin']), [
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
      `SELECT u.id, cc.coach_id
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
    await ensureOnboardingSchema(connection);
    const clientId = Number(req.params.id);

    const [rows] = await connection.query(
      'SELECT id FROM users WHERE id = ? AND role = "client"', [clientId]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    const ignoreDelete = async (sql, values) => {
      try {
        await connection.query(sql, values);
      } catch (error) {
        if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) throw error;
      }
    };

    await connection.beginTransaction();

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
