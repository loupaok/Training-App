import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('uploads', 'weekly-updates', String(req.user.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const valid = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    valid ? cb(null, true) : cb(new Error('Only image files are allowed'));
  }
});

async function ensureClientDashboardSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS training_plan_days (
      id INT AUTO_INCREMENT PRIMARY KEY,
      training_plan_id INT NOT NULL,
      day_of_week TINYINT NOT NULL,
      title VARCHAR(255),
      notes TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (training_plan_id) REFERENCES training_plans(id) ON DELETE CASCADE,
      INDEX idx_training_plan_id (training_plan_id),
      INDEX idx_day_of_week (day_of_week)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS training_plan_exercises (
      id INT AUTO_INCREMENT PRIMARY KEY,
      day_id INT NOT NULL,
      exercise_id INT,
      exercise_name VARCHAR(255) NOT NULL,
      sets VARCHAR(50),
      reps VARCHAR(50),
      rest_seconds INT,
      target_weight VARCHAR(50),
      notes TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (day_id) REFERENCES training_plan_days(id) ON DELETE CASCADE,
      INDEX idx_day_id (day_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS nutrition_plan_meals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nutrition_plan_id INT NOT NULL,
      day_of_week TINYINT NOT NULL,
      meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner', 'other') NOT NULL DEFAULT 'other',
      title VARCHAR(255),
      notes TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (nutrition_plan_id) REFERENCES nutrition_plans(id) ON DELETE CASCADE,
      INDEX idx_nutrition_plan_id (nutrition_plan_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS nutrition_plan_foods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meal_id INT NOT NULL,
      food_name VARCHAR(255) NOT NULL,
      quantity VARCHAR(100),
      calories INT,
      protein_g DECIMAL(6,1),
      carbs_g DECIMAL(6,1),
      fat_g DECIMAL(6,1),
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (meal_id) REFERENCES nutrition_plan_meals(id) ON DELETE CASCADE,
      INDEX idx_meal_id (meal_id)
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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_update_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      weekly_update_id INT NOT NULL,
      client_id INT NOT NULL,
      photo_url VARCHAR(500) NOT NULL,
      angle ENUM('front', 'side', 'back', 'other') DEFAULT 'other',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (weekly_update_id) REFERENCES weekly_updates(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_weekly_update_id (weekly_update_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS onboarding_forms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL UNIQUE,
      source_onboarding_id INT,
      goal VARCHAR(120),
      level VARCHAR(120),
      available_days VARCHAR(255),
      injuries TEXT,
      dietary_restrictions TEXT,
      additional_notes TEXT,
      visible_to_client TINYINT(1) NOT NULL DEFAULT 0,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  for (const statement of [
    'ALTER TABLE onboarding_forms ADD COLUMN submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE onboarding_forms ADD COLUMN visible_to_client TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE onboarding_forms ADD COLUMN goal VARCHAR(120)',
    'ALTER TABLE onboarding_forms ADD COLUMN level VARCHAR(120)',
    'ALTER TABLE onboarding_forms ADD COLUMN available_days VARCHAR(255)',
    'ALTER TABLE onboarding_forms ADD COLUMN injuries TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN dietary_restrictions TEXT',
    'ALTER TABLE onboarding_forms ADD COLUMN additional_notes TEXT'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }

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
}

function getWeekStart(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  current.setHours(0, 0, 0, 0);
  return current.toISOString().slice(0, 10);
}

function isUpdateDay(schedule) {
  if (!schedule?.day_of_week && schedule?.day_of_week !== 0) return false;
  return Number(schedule.day_of_week) === new Date().getDay();
}

async function getCurrentPlans(connection, clientId) {
  const [trainingPlans] = await connection.query(
    `SELECT * FROM training_plans WHERE client_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [clientId]
  );
  const [nutritionPlans] = await connection.query(
    `SELECT * FROM nutrition_plans WHERE client_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [clientId]
  );

  let training = trainingPlans[0] || null;
  if (training) {
    const [days] = await connection.query(
      'SELECT * FROM training_plan_days WHERE training_plan_id = ? ORDER BY day_of_week, sort_order',
      [training.id]
    );
    const dayIds = days.map((day) => day.id);
    let exercises = [];
    if (dayIds.length) {
      [exercises] = await connection.query(
        'SELECT * FROM training_plan_exercises WHERE day_id IN (?) ORDER BY sort_order',
        [dayIds]
      );
    }
    training = {
      ...training,
      days: days.map((day) => ({
        ...day,
        exercises: exercises.filter((exercise) => exercise.day_id === day.id)
      }))
    };
  }

  let nutrition = nutritionPlans[0] || null;
  if (nutrition) {
    const [meals] = await connection.query(
      'SELECT * FROM nutrition_plan_meals WHERE nutrition_plan_id = ? ORDER BY day_of_week, sort_order',
      [nutrition.id]
    );
    const mealIds = meals.map((meal) => meal.id);
    let foods = [];
    if (mealIds.length) {
      [foods] = await connection.query(
        'SELECT * FROM nutrition_plan_foods WHERE meal_id IN (?) ORDER BY sort_order',
        [mealIds]
      );
    }
    nutrition = {
      ...nutrition,
      meals: meals.map((meal) => ({
        ...meal,
        foods: foods.filter((food) => food.meal_id === meal.id)
      }))
    };
  }

  return { training, nutrition };
}

router.get('/', authorizeRole(['client']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureClientDashboardSchema(connection);

    const { training, nutrition } = await getCurrentPlans(connection, req.user.id);

    const [scheduleRows] = await connection.query(
      'SELECT * FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      [req.user.id]
    );
    const schedule = scheduleRows[0] || null;
    const weekStart = getWeekStart();
    const [weeklyRows] = await connection.query(
      'SELECT * FROM weekly_updates WHERE client_id = ? AND week_start = ? LIMIT 1',
      [req.user.id, weekStart]
    );
    const [progressRows] = await connection.query(
      'SELECT * FROM progress_updates WHERE client_id = ? ORDER BY submitted_at DESC LIMIT 12',
      [req.user.id]
    );
    const [notificationRows] = await connection.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.user.id]
    );
    const [paymentRows] = await connection.query(
      'SELECT id, subscription_id, amount, currency, method, status, paid_at, created_at FROM payments WHERE client_id = ? ORDER BY created_at DESC LIMIT 12',
      [req.user.id]
    );
    const [subscriptionRows] = await connection.query(
      'SELECT id, plan_name, status, start_date, end_date, price, currency FROM subscriptions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    const paymentApproved = paymentRows.some((payment) => payment.status === 'completed');

    connection.release();

    res.json({
      paymentApproved,
      subscription: subscriptionRows[0] || null,
      training,
      nutrition,
      progress: progressRows,
      weeklyUpdate: {
        available: isUpdateDay(schedule) && weeklyRows.length === 0,
        alreadySubmitted: weeklyRows.length > 0,
        weekStart,
        schedule
      },
      notifications: notificationRows,
      payments: paymentRows,
      unreadNotifications: notificationRows.filter((item) => !item.read_at).length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/weekly-update', authorizeRole(['client']), upload.array('photos', 3), [
  body('weightKg').notEmpty(),
  body('trainingScore').isInt({ min: 1, max: 5 }),
  body('nutritionScore').isInt({ min: 1, max: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureClientDashboardSchema(connection);
    const [scheduleRows] = await connection.query(
      'SELECT * FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      [req.user.id]
    );
    const schedule = scheduleRows[0] || null;
    const weekStart = getWeekStart();

    if (!isUpdateDay(schedule)) {
      connection.release();
      return res.status(403).json({ message: 'Το εβδομαδιαίο update ανοίγει μόνο την ημέρα που έχει επιλεγεί.' });
    }

    const [existing] = await connection.query(
      'SELECT id FROM weekly_updates WHERE client_id = ? AND week_start = ?',
      [req.user.id, weekStart]
    );
    if (existing.length) {
      connection.release();
      return res.status(400).json({ message: 'Το update αυτής της εβδομάδας έχει ήδη υποβληθεί.' });
    }

    const [coachRows] = await connection.query(
      'SELECT coach_id FROM coach_clients WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    const coachId = coachRows[0]?.coach_id || null;

    const [result] = await connection.query(
      `INSERT INTO weekly_updates (client_id, coach_id, weight_kg, training_score, nutrition_score, notes, week_start)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, coachId, req.body.weightKg, req.body.trainingScore, req.body.nutritionScore, req.body.notes || null, weekStart]
    );

    if (req.files?.length) {
      const angles = ['front', 'side', 'back'];
      await connection.query(
        'INSERT INTO weekly_update_photos (weekly_update_id, client_id, photo_url, angle) VALUES ?',
        [req.files.map((file, index) => [result.insertId, req.user.id, file.path.replace(/\\/g, '/'), angles[index] || 'other'])]
      );
    }

    connection.release();
    res.status(201).json({ message: 'Το εβδομαδιαίο update υποβλήθηκε.' });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
