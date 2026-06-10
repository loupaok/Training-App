import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

async function coachHasClient(connection, coachId, clientId) {
  const [rows] = await connection.query(
    'SELECT id FROM coach_clients WHERE coach_id = ? AND client_id = ?',
    [coachId, clientId]
  );
  return rows.length > 0;
}

async function coachOwnsPlan(connection, coachId, planId) {
  const [rows] = await connection.query(
    'SELECT id FROM training_plans WHERE id = ? AND coach_id = ?',
    [planId, coachId]
  );
  return rows.length > 0;
}


async function ensureTrainingPlanBuilderSchema(connection) {
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
      rest_seconds VARCHAR(50),
      target_weight VARCHAR(50),
      notes TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (day_id) REFERENCES training_plan_days(id) ON DELETE CASCADE,
      INDEX idx_day_id (day_id)
    )
  `);

  try {
    await connection.query('ALTER TABLE training_plan_exercises ADD COLUMN tempo VARCHAR(50) AFTER reps');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }

  await connection.query('ALTER TABLE training_plan_exercises MODIFY rest_seconds VARCHAR(50)');
}

async function ensureExerciseImagesTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS exercise_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      exercise_id INT NOT NULL,
      image_url VARCHAR(600) NOT NULL,
      alt_text VARCHAR(255),
      sort_order INT DEFAULT 0,
      is_primary TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
      INDEX idx_exercise_id (exercise_id),
      INDEX idx_is_primary (is_primary)
    )
  `);

  await connection.query(`
    INSERT INTO exercise_images (exercise_id, image_url, sort_order, is_primary)
    SELECT e.id, e.image_url, 0, 1
    FROM exercises e
    WHERE e.image_url IS NOT NULL
      AND e.image_url <> ''
      AND NOT EXISTS (
        SELECT 1 FROM exercise_images ei
        WHERE ei.exercise_id = e.id AND ei.image_url = e.image_url
      )
  `);
}

async function getExerciseImagesMap(connection, exerciseIds) {
  const ids = [...new Set(exerciseIds.filter(Boolean).map(Number))];
  if (!ids.length) return new Map();

  await ensureExerciseImagesTable(connection);
  const [rows] = await connection.query(
    `SELECT id, exercise_id AS exerciseId, image_url AS imageUrl, alt_text AS altText,
            sort_order AS sortOrder, is_primary AS isPrimary
     FROM exercise_images
     WHERE exercise_id IN (?)
     ORDER BY is_primary DESC, sort_order ASC, id ASC`,
    [ids]
  );

  return rows.reduce((map, image) => {
    const list = map.get(image.exerciseId) || [];
    list.push({
      id: image.id,
      imageUrl: image.imageUrl,
      altText: image.altText || '',
      sortOrder: image.sortOrder || 0,
      isPrimary: Boolean(image.isPrimary),
    });
    map.set(image.exerciseId, list);
    return map;
  }, new Map());
}

async function getFullTrainingPlan(connection, clientId) {
  await ensureTrainingPlanBuilderSchema(connection);

  const [plans] = await connection.query(
    `SELECT * FROM training_plans
     WHERE client_id = ? AND status = 'active'
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [clientId]
  );

  if (!plans.length) return null;

  const plan = plans[0];
  const [days] = await connection.query(
    'SELECT * FROM training_plan_days WHERE training_plan_id = ? ORDER BY sort_order, day_of_week',
    [plan.id]
  );

  let exercises = [];
  let imagesMap = new Map();
  if (days.length) {
    [exercises] = await connection.query(
      `SELECT tpe.*, e.muscle_group AS muscle_group, e.equipment, e.image_url AS image_url
       FROM training_plan_exercises tpe
       LEFT JOIN exercises e ON e.id = tpe.exercise_id
       WHERE tpe.day_id IN (?)
       ORDER BY tpe.sort_order`,
      [days.map((day) => day.id)]
    );
    imagesMap = await getExerciseImagesMap(connection, exercises.map((exercise) => exercise.exercise_id));
  }

  return {
    ...plan,
    days: days.map((day) => {
      const dayExercises = exercises
        .filter((exercise) => exercise.day_id === day.id)
        .map((exercise) => {
          const images = imagesMap.get(exercise.exercise_id) || [];
          return {
            ...exercise,
            images,
            imageUrls: images.map((image) => image.imageUrl),
          };
        });
      const muscleGroups = [...new Set(dayExercises.map((exercise) => exercise.muscle_group).filter(Boolean))];
      return { ...day, muscleGroups, exercises: dayExercises };
    }),
  };
}

router.get('/:clientId/full', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const plan = await getFullTrainingPlan(connection, req.params.clientId);
    connection.release();
    res.json(plan || { days: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:clientId/full', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureTrainingPlanBuilderSchema(connection);
    await connection.beginTransaction();

    const clientId = Number(req.params.clientId);
    const {
      title = '????????? ??????????',
      description = '',
      durationWeeks = 4,
      difficulty = 'intermediate',
      startDate = null,
      endDate = null,
      days = [],
    } = req.body;

    const coachId = req.user.id;
    const [existing] = await connection.query(
      "SELECT id FROM training_plans WHERE client_id = ? AND status = 'active' ORDER BY updated_at DESC, created_at DESC LIMIT 1",
      [clientId]
    );

    let planId = existing[0]?.id;
    if (planId) {
      await connection.query(
        `UPDATE training_plans
         SET coach_id = ?, title = ?, description = ?, duration_weeks = ?, difficulty = ?, start_date = ?, end_date = ?, status = 'active'
         WHERE id = ?`,
        [coachId, title, description || null, durationWeeks || null, difficulty, startDate || null, endDate || null, planId]
      );
      await connection.query('DELETE FROM training_plan_days WHERE training_plan_id = ?', [planId]);
    } else {
      const [result] = await connection.query(
        `INSERT INTO training_plans
          (coach_id, client_id, title, description, duration_weeks, difficulty, is_template, status, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)`,
        [coachId, clientId, title, description || null, durationWeeks || null, difficulty, startDate || null, endDate || null]
      );
      planId = result.insertId;
    }

    for (const [dayIndex, day] of days.entries()) {
      const exercises = Array.isArray(day.exercises) ? day.exercises : [];
      const hasContent = day.title || day.notes || exercises.length;
      if (!hasContent) continue;

      const [dayResult] = await connection.query(
        `INSERT INTO training_plan_days (training_plan_id, day_of_week, title, notes, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [planId, Number(day.dayOfWeek ?? day.day_of_week ?? dayIndex), day.title || null, day.notes || null, dayIndex]
      );

      for (const [exerciseIndex, exercise] of exercises.entries()) {
        const exerciseName = exercise.exerciseName || exercise.exercise_name || exercise.name;
        if (!exerciseName && !exercise.exerciseId && !exercise.exercise_id) continue;
        await connection.query(
          `INSERT INTO training_plan_exercises
            (day_id, exercise_id, exercise_name, sets, reps, tempo, rest_seconds, target_weight, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dayResult.insertId,
            exercise.exerciseId || exercise.exercise_id || null,
            exerciseName,
            exercise.sets || null,
            exercise.reps || null,
            exercise.tempo || null,
            exercise.restSeconds || exercise.rest_seconds || null,
            exercise.targetWeight || exercise.target_weight || null,
            exercise.notes || null,
            exerciseIndex,
          ]
        );
      }
    }

    await connection.commit();
    const plan = await getFullTrainingPlan(connection, clientId);
    connection.release();
    res.json({ message: 'Training plan saved', plan });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /training-plans/:clientId — all plans for a client (+ templates of the coach)
router.get('/:clientId', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, req.params.clientId))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await connection.query(
      `SELECT tp.*, u.full_name AS coach_name
       FROM training_plans tp
       LEFT JOIN users u ON u.id = tp.coach_id
       WHERE tp.client_id = ? OR (tp.is_template = 1 AND tp.coach_id = ?)
       ORDER BY tp.created_at DESC`,
      [req.params.clientId, req.user.id]
    );

    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /training-plans — create a new plan
router.post('/', authorizeRole(['coach', 'admin']), [
  body('title').notEmpty().withMessage('Title required'),
  body('clientId').optional().isInt(),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('status').optional().isIn(['draft', 'active', 'completed', 'archived'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    clientId, title, description,
    durationWeeks, difficulty, isTemplate,
    status, startDate, endDate
  } = req.body;

  try {
    const connection = await pool.getConnection();

    if (clientId && req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, clientId))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const coachId = req.user.role === 'coach' ? req.user.id : (req.body.coachId || null);

    const [result] = await connection.query(
      `INSERT INTO training_plans
         (coach_id, client_id, title, description, duration_weeks,
          difficulty, is_template, status, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [coachId, clientId || null, title, description || null,
       durationWeeks || null, difficulty || 'intermediate',
       isTemplate ? 1 : 0, status || 'draft',
       startDate || null, endDate || null]
    );

    connection.release();
    res.status(201).json({ message: 'Training plan created', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /training-plans/:id — update plan
router.put('/:id', authorizeRole(['coach', 'admin']), [
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('status').optional().isIn(['draft', 'active', 'completed', 'archived'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachOwnsPlan(connection, req.user.id, req.params.id))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await connection.query('SELECT id FROM training_plans WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Training plan not found' });
    }

    const { title, description, durationWeeks, difficulty, isTemplate, status, startDate, endDate, clientId } = req.body;

    const updates = [];
    const values = [];

    if (title)                    { updates.push('title = ?');          values.push(title); }
    if (description !== undefined){ updates.push('description = ?');    values.push(description); }
    if (durationWeeks !== undefined){ updates.push('duration_weeks = ?'); values.push(durationWeeks); }
    if (difficulty)               { updates.push('difficulty = ?');     values.push(difficulty); }
    if (isTemplate !== undefined) { updates.push('is_template = ?');    values.push(isTemplate ? 1 : 0); }
    if (status)                   { updates.push('status = ?');         values.push(status); }
    if (startDate !== undefined)  { updates.push('start_date = ?');     values.push(startDate); }
    if (endDate !== undefined)    { updates.push('end_date = ?');       values.push(endDate); }
    if (clientId !== undefined)   { updates.push('client_id = ?');      values.push(clientId); }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(req.params.id);
    await connection.query(`UPDATE training_plans SET ${updates.join(', ')} WHERE id = ?`, values);

    connection.release();
    res.json({ message: 'Training plan updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /training-plans/:id — deletes plan + reps cascade
router.delete('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachOwnsPlan(connection, req.user.id, req.params.id))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await connection.query('SELECT id FROM training_plans WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Training plan not found' });
    }

    await connection.query('DELETE FROM training_plans WHERE id = ?', [req.params.id]);

    connection.release();
    res.json({ message: 'Training plan deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
