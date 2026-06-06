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

const subscriptionPackages = {
  '2_months': { label: '2 μήνες', months: 2, price: 190 },
  '3_months': { label: '3 μήνες', months: 3, price: 270 },
  '4_months': { label: '4 μήνες', months: 4, price: 320 }
};

async function ensureOnboardingSchema(connection) {
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

// GET /clients/me/onboarding — current client's onboarding state
router.get('/me/onboarding', authorizeRole(['client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureOnboardingSchema(connection);

    const [rows] = await connection.query(
      'SELECT * FROM client_onboarding WHERE client_id = ?',
      [req.user.id]
    );

    connection.release();
    res.json({ onboarding: rows[0] || null });
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

  if (!fullName || !email || !phone || !goal || updateDay === undefined || !weightKg || !subscriptionPackage) {
    return res.status(400).json({ message: 'Συμπλήρωσε όλα τα απαραίτητα πεδία.' });
  }

  const selectedPackage = subscriptionPackages[subscriptionPackage];
  if (!selectedPackage) {
    return res.status(400).json({ message: 'Μη έγκυρο πακέτο συνδρομής.' });
  }

  const connection = await pool.getConnection();

  try {
    await ensureOnboardingSchema(connection);
    await connection.beginTransaction();

    const coachId = await getDefaultCoachId(connection);
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = addMonths(new Date(), selectedPackage.months);
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
        subscriptionPackage,
        paymentMethod || 'bank_transfer'
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

    const [subscriptionResult] = await connection.query(
      `INSERT INTO subscriptions (client_id, coach_id, plan_name, plan_type, price, currency, start_date, end_date, status, notes)
       VALUES (?, ?, ?, 'custom', ?, 'EUR', ?, ?, 'active', ?)`,
      [
        req.user.id,
        coachId,
        selectedPackage.label,
        selectedPackage.price,
        startDate,
        endDate,
        paymentMethod === 'stripe_card' ? 'Stripe card selected - integration pending' : 'Bank transfer selected'
      ]
    );

    await connection.query(
      `INSERT INTO payments (client_id, coach_id, subscription_id, amount, currency, method, status, notes)
       VALUES (?, ?, ?, ?, 'EUR', ?, 'pending', ?)`,
      [
        req.user.id,
        coachId,
        subscriptionResult.insertId,
        selectedPackage.price,
        paymentMethod === 'stripe_card' ? 'stripe' : 'bank_transfer',
        paymentMethod === 'stripe_card' ? 'Stripe θα συνδεθεί αργότερα.' : 'Αναμένεται τραπεζικό έμβασμα.'
      ]
    );

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

// GET /clients — coaches see their own clients, admins see all
router.get('/', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const search = String(req.query.search || '').trim();
    const searchLimit = search ? ' LIMIT 12' : '';

    let rows;
    if (req.user.role === 'admin' || req.user.role === 'moderator') {
      const filters = ["u.role = 'client'"];
      const values = [];

      if (search) {
        filters.push('(u.full_name LIKE ? OR u.email LIKE ? OR c.phone LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      [rows] = await connection.query(
        `SELECT u.id, u.email, u.full_name, u.profile_photo, u.is_active,
                c.phone, c.gender, c.date_of_birth, c.height_cm, c.weight_kg, c.fitness_goal,
                cc.status AS coaching_status, cc.coach_id
         FROM users u
         LEFT JOIN clients c ON c.user_id = u.id
         LEFT JOIN coach_clients cc ON cc.client_id = u.id
         WHERE ${filters.join(' AND ')}
         ORDER BY u.full_name
         ${searchLimit}`,
        values
      );
    } else {
      const filters = ["u.role = 'client'"];
      const values = [req.user.id];

      if (search) {
        filters.push('(u.full_name LIKE ? OR u.email LIKE ? OR c.phone LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      [rows] = await connection.query(
        `SELECT u.id, u.email, u.full_name, u.profile_photo, u.is_active,
                c.phone, c.gender, c.date_of_birth, c.height_cm, c.weight_kg, c.fitness_goal,
                cc.status AS coaching_status
         FROM users u
         INNER JOIN coach_clients cc ON cc.client_id = u.id AND cc.coach_id = ?
         LEFT JOIN clients c ON c.user_id = u.id
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

    const [rows] = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.profile_photo, u.bio, u.is_active,
              c.date_of_birth, c.gender, c.phone, c.height_cm, c.weight_kg,
              c.fitness_goal, c.medical_notes,
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

    await ensureOnboardingSchema(connection);

    const [onboardingRows] = await connection.query(
      'SELECT * FROM client_onboarding WHERE client_id = ?',
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
      updateSchedule: scheduleRows[0] || null,
      progressUpdates: progressRows
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
      fitnessGoal, medicalNotes, emergencyContactName, emergencyContactPhone
    } = req.body;

    await connection.query(
      `INSERT INTO clients (user_id, phone, gender, date_of_birth, height_cm, weight_kg,
         fitness_goal, medical_notes, emergency_contact_name, emergency_contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone = COALESCE(VALUES(phone), phone),
         gender = COALESCE(VALUES(gender), gender),
         date_of_birth = COALESCE(VALUES(date_of_birth), date_of_birth),
         height_cm = COALESCE(VALUES(height_cm), height_cm),
         weight_kg = COALESCE(VALUES(weight_kg), weight_kg),
         fitness_goal = COALESCE(VALUES(fitness_goal), fitness_goal),
         medical_notes = COALESCE(VALUES(medical_notes), medical_notes),
         emergency_contact_name = COALESCE(VALUES(emergency_contact_name), emergency_contact_name),
         emergency_contact_phone = COALESCE(VALUES(emergency_contact_phone), emergency_contact_phone)`,
      [req.params.id, phone || null, gender || null, dateOfBirth || null,
       heightCm || null, weightKg || null, fitnessGoal || null,
       medicalNotes || null, emergencyContactName || null, emergencyContactPhone || null]
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

// DELETE /clients/:id — admin only (soft delete via is_active)
router.delete('/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      'SELECT id FROM users WHERE id = ? AND role = "client"', [req.params.id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    await connection.query(
      'UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]
    );

    connection.release();
    res.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
