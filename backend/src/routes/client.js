import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';
import { ensureWeeklyUpdateSchema } from './weekly-updates.js';
import { notifyCoaches } from './clients.js';
import { getEmailTemplate, sendMail } from '../lib/mailer.js';
import { updateNotificationEmail } from '../lib/email-templates.js';

const router = express.Router();
router.use(authorizeRole(['client']));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      const directory = path.join('uploads', 'media', 'progress', String(req.user.id));
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    },
    filename: (req, file, callback) => callback(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const image = /^image\/(jpeg|png|webp)$/.test(file.mimetype) && ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);
    const pdf = file.mimetype === 'application/pdf' && extension === '.pdf';
    callback(image || pdf ? null : new Error('Only images and PDF files are allowed'), image || pdf);
  },
});

export async function ensureWorkoutSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS workout_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      training_plan_id INT NOT NULL,
      day_number INT NOT NULL,
      day_name VARCHAR(150),
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      duration_seconds INT DEFAULT 0,
      total_sets_completed INT DEFAULT 0,
      total_volume_kg DECIMAL(10,2) DEFAULT 0,
      notes TEXT NULL,
      workout_feeling VARCHAR(20) NULL,
      FOREIGN KEY (client_id) REFERENCES users(id),
      INDEX idx_workout_client_completed (client_id, completed_at),
      INDEX idx_workout_plan_day (training_plan_id, day_number)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS workout_set_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workout_log_id INT NOT NULL,
      exercise_name VARCHAR(255),
      exercise_id INT NULL,
      set_number INT NOT NULL,
      target_reps INT NULL,
      reps_completed INT NULL,
      weight_kg DECIMAL(6,2) DEFAULT 0,
      set_type VARCHAR(20) NOT NULL DEFAULT 'normal',
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id) ON DELETE CASCADE,
      UNIQUE KEY unique_workout_exercise_set (workout_log_id, exercise_name, set_number)
    )
  `);
  await connection.query("ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS workout_feeling VARCHAR(20) NULL");
  await connection.query("ALTER TABLE workout_set_logs ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) NOT NULL DEFAULT 'normal'");
}

const today = (value = new Date()) => {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
};

function currentWeekStart(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return today(date);
}

function nextScheduledDate(day) {
  if (day === null || day === undefined) return null;
  const date = new Date();
  date.setDate(date.getDate() + ((Number(day) - date.getDay() + 7) % 7));
  return today(date);
}

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function summarizeUpdate(update) {
  const result = {
    id: update.id, submittedAt: update.submitted_at, weekStart: update.week_start, isRead: Boolean(update.is_read),
    weight: null, trainingRating: null, nutritionRating: null, generalRating: null, notes: null, photos: [], files: [],
  };
  for (const answer of update.answers || []) {
    if (!answer.answer) continue;
    const text = normalizeText(answer.question);
    const number = Number(String(answer.answer).replace(',', '.'));
    if (answer.standard_key === 'weight_kg' && Number.isFinite(number)) result.weight = number;
    else if (answer.type === 'rating' && text.includes('\u03c0\u03c1\u03bf\u03c0\u03bf\u03bd') && Number.isFinite(number)) result.trainingRating = number;
    else if (answer.type === 'rating' && text.includes('\u03b4\u03b9\u03b1\u03c4\u03c1\u03bf\u03c6') && Number.isFinite(number)) result.nutritionRating = number;
    else if (answer.type === 'rating' && text.includes('\u03b5\u03b2\u03b4\u03bf\u03bc\u03b1\u03b4') && Number.isFinite(number)) result.generalRating = number;
    else if (answer.type === 'textarea' && !result.notes) result.notes = answer.answer;
  }
  result.files = update.files || [];
  result.photos = result.files.filter((file) => file.file_type === 'photo').map((file) => file.file_url);
  return result;
}

async function getUpdates(connection, clientId, limit = 12) {
  const [updates] = await connection.query('SELECT id, submitted_at, week_start, is_read FROM weekly_updates WHERE client_id = ? ORDER BY submitted_at DESC LIMIT ?', [clientId, limit]);
  if (!updates.length) return [];
  const ids = updates.map((update) => update.id);
  const [answers] = await connection.query(`SELECT wa.update_id, wa.answer, q.question, q.type, q.standard_key FROM weekly_update_answers wa JOIN update_questions q ON q.id = wa.question_id WHERE wa.update_id IN (?) ORDER BY q.sort_order`, [ids]);
  const [files] = await connection.query('SELECT update_id, question_id, file_url, file_type, original_name FROM weekly_update_files WHERE update_id IN (?) ORDER BY created_at DESC', [ids]);
  return updates.map((update) => summarizeUpdate({ ...update, answers: answers.filter((answer) => answer.update_id === update.id), files: files.filter((file) => file.update_id === update.id) }));
}

async function getPlans(connection, clientId) {
  const [trainingRows] = await connection.query("SELECT * FROM training_plans WHERE client_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1", [clientId]);
  const [nutritionRows] = await connection.query("SELECT * FROM nutrition_plans WHERE client_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1", [clientId]);
  const training = trainingRows[0] || null;
  const nutrition = nutritionRows[0] || null;
  if (training) {
    const [days] = await connection.query('SELECT * FROM training_plan_days WHERE training_plan_id = ? ORDER BY day_of_week, sort_order', [training.id]);
    const dayIds = days.map((day) => day.id);
    const [exercises] = dayIds.length ? await connection.query(
      `SELECT tpe.*, e.muscle_group, e.equipment, e.image_url, e.video_url, e.instructions
       FROM training_plan_exercises tpe
       LEFT JOIN exercises e ON e.id = tpe.exercise_id
       WHERE tpe.day_id IN (?) ORDER BY tpe.sort_order`,
      [dayIds]
    ) : [[]];
    training.days = days.map((day) => ({ ...day, name: day.title || `Day ${day.day_of_week}`, exercises: exercises.filter((exercise) => exercise.day_id === day.id).map((exercise) => ({ ...exercise, name: exercise.exercise_name || exercise.name })) }));
  }
  if (nutrition) {
    const [meals] = await connection.query('SELECT * FROM nutrition_plan_meals WHERE nutrition_plan_id = ? ORDER BY day_of_week, sort_order', [nutrition.id]);
    const mealIds = meals.map((meal) => meal.id);
    const [foods] = mealIds.length ? await connection.query(
      `SELECT npf.*, f.image_url AS food_image
       FROM nutrition_plan_foods npf
       LEFT JOIN foods f ON (
         LOWER(TRIM(npf.food_name)) = LOWER(TRIM(f.name_gr))
         OR LOWER(TRIM(npf.food_name)) = LOWER(TRIM(f.name_en))
       )
       WHERE npf.meal_id IN (?)
       ORDER BY npf.sort_order`,
      [mealIds]
    ) : [[]];
    nutrition.meals = meals.map((meal) => ({ ...meal, name: meal.name || `Meal ${meal.sort_order + 1}`, foods: foods.filter((food) => food.meal_id === meal.id).map((food) => ({ ...food, name: food.food_name || food.name, amount: food.quantity || food.amount })) }));
  }
  return { training, nutrition };
}

function streakFor(updates) {
  const weeks = new Set(updates.map((update) => today(new Date(update.weekStart))));
  let streak = 0;
  let cursor = updates[0]?.weekStart ? new Date(updates[0].weekStart) : new Date(`${currentWeekStart()}T00:00:00`);
  while (weeks.has(today(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 7); }
  return streak;
}

router.get('/dashboard', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    try {
      await ensureWeeklyUpdateSchema(connection);
    } catch (schemaError) {
      console.error('Client dashboard weekly-update schema check failed:', schemaError);
    }
    const clientId = req.user.id;
    const [users] = await connection.query('SELECT full_name FROM users WHERE id = ?', [clientId]);
    const [schedules] = await connection.query('SELECT day_of_week, next_due_date FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1', [clientId]);
    const [subscriptions] = await connection.query("SELECT plan_name, status, start_date, end_date, DATEDIFF(end_date, CURDATE()) AS days_remaining FROM subscriptions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1", [clientId]);
    let updates = [];
    try {
      updates = await getUpdates(connection, clientId, 52);
    } catch (updatesError) {
      console.error('Client dashboard update lookup failed:', updatesError);
    }
    let training = null;
    let nutrition = null;
    try {
      ({ training, nutrition } = await getPlans(connection, clientId));
    } catch (planError) {
      console.error('Client dashboard plan lookup failed:', planError);
    }
    const schedule = schedules[0] || null;
    const subscription = subscriptions[0] || null;
    const todayIsUpdateDay = schedule ? Number(schedule.day_of_week) === new Date().getDay() : false;
    const alreadySubmittedThisWeek = updates.some((update) => today(new Date(update.weekStart)) === currentWeekStart());
    const lastUpdate = updates[0] || null;
    const ratings = [lastUpdate?.trainingRating, lastUpdate?.nutritionRating, lastUpdate?.generalRating].filter(Number.isFinite);
    const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
    res.json({
      client: { firstName: String(users[0]?.full_name || '').trim().split(/\s+/)[0] || 'Client', currentWeight: lastUpdate?.weight ?? null, subscriptionStatus: subscription?.status || null, daysRemaining: subscription?.days_remaining ?? null, planName: subscription?.plan_name || null, subscriptionStartDate: subscription?.start_date || null, subscriptionEndDate: subscription?.end_date || null },
      todayIsUpdateDay, alreadySubmittedThisWeek, nextUpdateDate: schedule?.next_due_date || nextScheduledDate(schedule?.day_of_week), streak: streakFor(updates), updatesCount: updates.length,
      lastUpdate: lastUpdate ? { submittedAt: lastUpdate.submittedAt, averageRating } : null,
      trainingPlan: training ? { id: training.id, title: training.title } : null, nutritionPlan: nutrition ? { id: nutrition.id, title: nutrition.title } : null,
    });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/update-status', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWeeklyUpdateSchema(connection);
    const [schedules] = await connection.query('SELECT day_of_week, next_due_date FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1', [req.user.id]);
    const [updates] = await connection.query('SELECT submitted_at FROM weekly_updates WHERE client_id = ? AND week_start = ? LIMIT 1', [req.user.id, currentWeekStart()]);
    const schedule = schedules[0] || null;
    const todayIsUpdateDay = schedule ? Number(schedule.day_of_week) === new Date().getDay() : false;
    res.json({ canSubmit: todayIsUpdateDay && !updates.length, todayIsUpdateDay, alreadySubmittedThisWeek: Boolean(updates.length), nextUpdateDate: schedule?.next_due_date || nextScheduledDate(schedule?.day_of_week), lastSubmission: updates[0]?.submitted_at || null });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/updates', async (req, res) => {
  const connection = await pool.getConnection();
  try { await ensureWeeklyUpdateSchema(connection); res.json(await getUpdates(connection, req.user.id, 52)); }
  catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/training-plan', async (req, res) => {
  const connection = await pool.getConnection();
  try { res.json((await getPlans(connection, req.user.id)).training); }
  catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.post('/workout/start', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWorkoutSchema(connection);
    const trainingPlanId = Number(req.body.trainingPlanId);
    const dayNumber = Number(req.body.dayNumber);
    const dayName = String(req.body.dayName || '').trim().slice(0, 150);
    if (!Number.isInteger(trainingPlanId) || !Number.isInteger(dayNumber) || dayNumber < 1) {
      return res.status(400).json({ message: 'Invalid workout details.' });
    }
    const [plans] = await connection.query("SELECT id FROM training_plans WHERE id = ? AND client_id = ? AND status = 'active'", [trainingPlanId, req.user.id]);
    if (!plans.length) return res.status(404).json({ message: 'Training plan not found.' });
    const [result] = await connection.query(
      'INSERT INTO workout_logs (client_id, training_plan_id, day_number, day_name, started_at) VALUES (?, ?, ?, ?, NOW())',
      [req.user.id, trainingPlanId, dayNumber, dayName || null]
    );
    res.status(201).json({ workoutLogId: result.insertId });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.post('/workout/log-set', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWorkoutSchema(connection);
    const workoutLogId = Number(req.body.workoutLogId);
    const setNumber = Number(req.body.setNumber);
    const targetReps = Number(req.body.targetReps) || null;
    const repsCompleted = Number(req.body.repsCompleted) || null;
    const weightKg = Math.max(0, Number(req.body.weightKg) || 0);
    const exerciseName = String(req.body.exerciseName || '').trim().slice(0, 255);
    const exerciseId = Number(req.body.exerciseId) || null;
    const setType = String(req.body.setType || 'normal').trim().toLowerCase();
    if (!['normal', 'warmup', 'drop', 'failure'].includes(setType)) {
      return res.status(400).json({ message: 'Invalid set type.' });
    }
    if (!Number.isInteger(workoutLogId) || !Number.isInteger(setNumber) || setNumber < 1 || !exerciseName) {
      return res.status(400).json({ message: 'Invalid set details.' });
    }
    const [logs] = await connection.query('SELECT id FROM workout_logs WHERE id = ? AND client_id = ? AND completed_at IS NULL', [workoutLogId, req.user.id]);
    if (!logs.length) return res.status(404).json({ message: 'Active workout not found.' });
    await connection.query(
      `INSERT INTO workout_set_logs (workout_log_id, exercise_name, exercise_id, set_number, target_reps, reps_completed, weight_kg, set_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE target_reps = VALUES(target_reps), reps_completed = VALUES(reps_completed), weight_kg = VALUES(weight_kg), set_type = VALUES(set_type), completed_at = CURRENT_TIMESTAMP`,
      [workoutLogId, exerciseName, exerciseId, setNumber, targetReps, repsCompleted, weightKg, setType]
    );
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.post('/workout/complete', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWorkoutSchema(connection);
    const workoutLogId = Number(req.body.workoutLogId);
    const durationSeconds = Math.max(0, Number(req.body.durationSeconds) || 0);
    const totalSetsCompleted = Math.max(0, Number(req.body.totalSetsCompleted) || 0);
    const totalVolumeKg = Math.max(0, Number(req.body.totalVolumeKg) || 0);
    const notes = String(req.body.notes || '').trim() || null;
    const workoutFeeling = String(req.body.workoutFeeling || '').trim().toLowerCase() || null;
    if (workoutFeeling && !['easy', 'good', 'hard', 'pr'].includes(workoutFeeling)) {
      return res.status(400).json({ message: 'Invalid workout feeling.' });
    }
    const [result] = await connection.query(
      `UPDATE workout_logs SET completed_at = NOW(), duration_seconds = ?, total_sets_completed = ?, total_volume_kg = ?, notes = ?, workout_feeling = ?
       WHERE id = ? AND client_id = ? AND completed_at IS NULL`,
      [durationSeconds, totalSetsCompleted, totalVolumeKg, notes, workoutFeeling, workoutLogId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Active workout not found.' });
    res.json({ success: true, summary: { durationSeconds, totalSetsCompleted, totalVolumeKg } });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.post('/workout/cancel', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWorkoutSchema(connection);
    const [result] = await connection.query('DELETE FROM workout_logs WHERE id = ? AND client_id = ? AND completed_at IS NULL', [Number(req.body.workoutLogId), req.user.id]);
    res.json({ success: true, discarded: Boolean(result.affectedRows) });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/workout/history', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWorkoutSchema(connection);
    const [logs] = await connection.query('SELECT * FROM workout_logs WHERE client_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 10', [req.user.id]);
    if (!logs.length) return res.json([]);
    const ids = logs.map((log) => log.id);
    const [sets] = await connection.query('SELECT * FROM workout_set_logs WHERE workout_log_id IN (?) ORDER BY set_number', [ids]);
    res.json(logs.map((log) => ({ ...log, setLogs: sets.filter((set) => set.workout_log_id === log.id) })));
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/workout/exercise-history', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWorkoutSchema(connection);
    const exerciseName = String(req.query.exerciseName || '').trim();
    const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 5));
    if (!exerciseName) return res.status(400).json({ message: 'exerciseName is required.' });
    const [sessions] = await connection.query(
      `SELECT id, completed_at FROM workout_logs
       WHERE client_id = ? AND completed_at IS NOT NULL
         AND id IN (SELECT workout_log_id FROM workout_set_logs WHERE exercise_name = ?)
       ORDER BY completed_at DESC LIMIT ?`,
      [req.user.id, exerciseName, limit]
    );
    if (!sessions.length) return res.json([]);
    const sessionIds = sessions.map((session) => session.id);
    const [sets] = await connection.query(
      `SELECT workout_log_id, set_number AS setNumber, weight_kg AS weightKg, reps_completed AS repsCompleted
       FROM workout_set_logs WHERE workout_log_id IN (?) AND exercise_name = ? ORDER BY set_number`,
      [sessionIds, exerciseName]
    );
    res.json(sessions.map((session) => ({
      completedAt: session.completed_at,
      sets: sets.filter((set) => set.workout_log_id === session.id),
    })));
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/workout/last/:planId/:dayNumber', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWorkoutSchema(connection);
    const [logs] = await connection.query(
      'SELECT id, completed_at, total_volume_kg FROM workout_logs WHERE client_id = ? AND training_plan_id = ? AND day_number = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1',
      [req.user.id, Number(req.params.planId), Number(req.params.dayNumber)]
    );
    if (!logs.length) return res.json({ sets: [] });
    const [sets] = await connection.query('SELECT exercise_name AS exerciseName, exercise_id AS exerciseId, set_number AS setNumber, weight_kg AS weightKg, reps_completed AS repsCompleted FROM workout_set_logs WHERE workout_log_id = ? ORDER BY set_number', [logs[0].id]);
    res.json({ completedAt: logs[0].completed_at, totalVolumeKg: logs[0].total_volume_kg === null ? null : Number(logs[0].total_volume_kg), sets });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/workout/total-volume', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWorkoutSchema(connection);
    const [[{ total }]] = await connection.query(
      'SELECT COALESCE(SUM(total_volume_kg), 0) AS total FROM workout_logs WHERE client_id = ? AND completed_at IS NOT NULL',
      [req.user.id]
    );
    res.json({ totalVolumeKg: Number(total) });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/nutrition-plan', async (req, res) => {
  const connection = await pool.getConnection();
  try { res.json((await getPlans(connection, req.user.id)).nutrition); }
  catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/nutrition-equivalents', async (req, res) => {
  const target = {
    calories: Math.max(0, Number(req.query.calories) || 0),
    protein: Math.max(0, Number(req.query.protein) || 0),
    carbs: Math.max(0, Number(req.query.carbs) || 0),
    fats: Math.max(0, Number(req.query.fats) || 0),
  };
  const foodName = String(req.query.foodName || '').trim();

  if (!foodName || !Object.values(target).some(Boolean)) {
    return res.status(400).json({ message: 'Food macros are required.' });
  }

  const connection = await pool.getConnection();
  try {
    const [foods] = await connection.query(
      `SELECT id, name_gr, name_en, image_url, calories_per_100g, protein_per_100g,
              carbs_per_100g, fats_per_100g
       FROM foods
       WHERE is_active = TRUE
         AND LOWER(name_gr) <> LOWER(?)
         AND (name_en IS NULL OR LOWER(name_en) <> LOWER(?))`,
      [foodName, foodName],
    );

    const macroEntries = [
      ['protein', 'protein_per_100g'],
      ['carbs', 'carbs_per_100g'],
      ['fats', 'fats_per_100g'],
    ];
    const primary = macroEntries.reduce((best, entry) => target[entry[0]] > target[best[0]] ? entry : best, macroEntries[0]);

    const equivalents = foods.map((food) => {
      const primaryPer100 = Number(food[primary[1]]) || 0;
      const grams = primaryPer100 > 0
        ? (target[primary[0]] / primaryPer100) * 100
        : (target.calories / Math.max(Number(food.calories_per_100g) || 1, 1)) * 100;
      const factor = grams / 100;
      const macros = {
        calories: (Number(food.calories_per_100g) || 0) * factor,
        protein: (Number(food.protein_per_100g) || 0) * factor,
        carbs: (Number(food.carbs_per_100g) || 0) * factor,
        fats: (Number(food.fats_per_100g) || 0) * factor,
      };
      const score = ['calories', 'protein', 'carbs', 'fats'].reduce(
        (total, key) => total + Math.abs(macros[key] - target[key]) / Math.max(target[key], 1),
        0,
      );
      return {
        id: food.id,
        name: food.name_gr || food.name_en,
        imageUrl: food.image_url,
        quantityG: Math.round(grams / 5) * 5,
        calories: Math.round(macros.calories),
        proteinG: Number(macros.protein.toFixed(1)),
        carbsG: Number(macros.carbs.toFixed(1)),
        fatsG: Number(macros.fats.toFixed(1)),
        score,
      };
    })
      .filter((food) => food.quantityG > 0 && food.quantityG <= 1000)
      .sort((first, second) => first.score - second.score)
      .slice(0, 6)
      .map(({ score, ...food }) => food);

    res.json({ equivalents });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/progress', async (req, res) => {
  const connection = await pool.getConnection();
  try { await ensureWeeklyUpdateSchema(connection); const updates = await getUpdates(connection, req.user.id, 52); res.json({ weights: updates.filter((update) => update.weight !== null).map((update) => ({ submittedAt: update.submittedAt, weight: update.weight })).reverse(), photos: updates.flatMap((update) => update.photos).slice(0, 24), updates }); }
  catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.get('/payments', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [subscriptions] = await connection.query("SELECT plan_name, price, status, end_date, DATEDIFF(end_date, CURDATE()) AS days_remaining FROM subscriptions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1", [req.user.id]);
    const [payments] = await connection.query('SELECT id, amount, currency, method, status, reference_number AS referenceNumber, paid_at AS paidAt, notes FROM payments WHERE client_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ subscription: subscriptions[0] || null, payments });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); } finally { connection.release(); }
});

router.post('/updates/submit', upload.array('files', 5), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureWeeklyUpdateSchema(connection);
    let answers;
    let fileQuestionIds;
    try { answers = JSON.parse(req.body.answers || '[]'); } catch { return res.status(400).json({ message: 'Invalid answers' }); }
    try { fileQuestionIds = JSON.parse(req.body.fileQuestionIds || '[]'); } catch { return res.status(400).json({ message: 'Invalid files' }); }
    const [schedules] = await connection.query('SELECT day_of_week FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1', [req.user.id]);
    if (!schedules.length || Number(schedules[0].day_of_week) !== new Date().getDay()) return res.status(403).json({ message: 'Updates are available on the scheduled day only.' });
    const weekStart = currentWeekStart();
    const [existing] = await connection.query('SELECT id FROM weekly_updates WHERE client_id = ? AND week_start = ?', [req.user.id, weekStart]);
    if (existing.length) return res.status(400).json({ message: 'You have already submitted an update this week.' });
    const [questions] = await connection.query('SELECT id, type, is_required FROM update_questions WHERE is_active = 1');
    const answered = new Set(answers.filter((answer) => String(answer?.answer ?? '').trim()).map((answer) => Number(answer.questionId)));
    const uploadedForQuestion = new Set(fileQuestionIds.map(Number));
    if (questions.some((question) => question.is_required && question.type !== 'photos' && question.type !== 'pdf' && !answered.has(question.id))) return res.status(400).json({ message: 'Complete all required questions.' });
    if (questions.some((question) => question.is_required && ['photos', 'pdf'].includes(question.type) && !uploadedForQuestion.has(question.id))) return res.status(400).json({ message: 'Complete all required uploads.' });
    const photos = (req.files || []).filter((file) => file.mimetype !== 'application/pdf');
    const pdfs = (req.files || []).filter((file) => file.mimetype === 'application/pdf');
    if (photos.length > 4 || pdfs.length > 1) return res.status(400).json({ message: 'Up to 4 photos and 1 PDF are allowed.' });
    await connection.beginTransaction();
    const [result] = await connection.query('INSERT INTO weekly_updates (client_id, week_start, is_read) VALUES (?, ?, 0)', [req.user.id, weekStart]);
    for (const answer of answers) {
      if (!answer || answer.questionId === undefined) continue;
      const value = typeof answer.answer === 'object' ? JSON.stringify(answer.answer) : String(answer.answer ?? '');
      await connection.query('INSERT INTO weekly_update_answers (update_id, question_id, answer) VALUES (?, ?, ?)', [result.insertId, answer.questionId, value]);
    }
    if (req.files?.length) await connection.query('INSERT INTO weekly_update_files (update_id, question_id, file_url, file_type, original_name) VALUES ?', [req.files.map((file, index) => [result.insertId, Number(fileQuestionIds[index]) || null, file.path.replace(/\\/g, '/'), file.mimetype === 'application/pdf' ? 'pdf' : 'photo', file.originalname])]);
    await connection.commit();
    const [users] = await connection.query('SELECT full_name, email FROM users WHERE id = ?', [req.user.id]);
    const clientName = users[0]?.full_name || users[0]?.email || 'Client';
    try {
      await notifyCoaches(connection, { clientId: req.user.id, type: 'new_update', title: 'New weekly update', body: `${clientName} submitted a new update.`, linkUrl: `/coach/updates?id=${result.insertId}` });
      const [coaches] = await connection.query("SELECT email FROM users WHERE role IN ('coach', 'admin') AND is_active = 1");
      const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/coach/updates?id=${result.insertId}`;
      const template = await getEmailTemplate('update_notification', { clientName, updateUrl: url }, connection) || updateNotificationEmail(clientName, '', '', '', url);
      coaches.forEach((coach) => sendMail({ to: coach.email, ...template }).catch((error) => console.error('Email failed', error)));
    } catch (error) { console.error('Coach notification failed', error); }
    res.status(201).json({ success: true, updateId: result.insertId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally { connection.release(); }
});

export default router;
