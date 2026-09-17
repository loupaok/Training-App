import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Global library — every coach/admin can see, create, edit and delete every
// template. No per-coach scoping (matches the "global library" requirement).

async function ensureTemplatesSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS training_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT,
      goal ENUM('fat_loss', 'muscle_gain', 'toning', 'maintenance'),
      level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
      days_per_week TINYINT UNSIGNED,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS template_training_days (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_id INT NOT NULL,
      day_of_week TINYINT NOT NULL,
      title VARCHAR(255),
      notes TEXT,
      sort_order INT DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES training_templates(id) ON DELETE CASCADE,
      INDEX idx_template_id (template_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS template_training_exercises (
      id INT AUTO_INCREMENT PRIMARY KEY,
      day_id INT NOT NULL,
      exercise_id INT,
      exercise_name VARCHAR(255) NOT NULL,
      sets VARCHAR(50),
      reps VARCHAR(50),
      tempo VARCHAR(50),
      rest_seconds VARCHAR(50),
      target_weight VARCHAR(50),
      notes TEXT,
      sort_order INT DEFAULT 0,
      FOREIGN KEY (day_id) REFERENCES template_training_days(id) ON DELETE CASCADE,
      INDEX idx_day_id (day_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS nutrition_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT,
      goal ENUM('fat_loss', 'muscle_gain', 'toning', 'maintenance'),
      daily_calories INT UNSIGNED,
      protein_g DECIMAL(6,1),
      carbs_g DECIMAL(6,1),
      fat_g DECIMAL(6,1),
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS template_nutrition_meals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_id INT NOT NULL,
      day_of_week TINYINT NOT NULL DEFAULT 1,
      meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner', 'pre_workout', 'post_workout', 'other') NOT NULL DEFAULT 'other',
      title VARCHAR(255),
      notes TEXT,
      sort_order INT DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES nutrition_templates(id) ON DELETE CASCADE,
      INDEX idx_template_id (template_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS template_nutrition_foods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meal_id INT NOT NULL,
      food_name VARCHAR(255) NOT NULL,
      quantity VARCHAR(100),
      calories INT,
      protein_g DECIMAL(6,1),
      carbs_g DECIMAL(6,1),
      fat_g DECIMAL(6,1),
      sort_order INT DEFAULT 0,
      FOREIGN KEY (meal_id) REFERENCES template_nutrition_meals(id) ON DELETE CASCADE,
      INDEX idx_meal_id (meal_id)
    )
  `);
}

export async function getFullTrainingTemplate(connection, templateId) {
  await ensureTemplatesSchema(connection);

  const [templates] = await connection.query('SELECT * FROM training_templates WHERE id = ?', [templateId]);
  if (!templates.length) return null;

  const template = templates[0];
  const [days] = await connection.query(
    'SELECT * FROM template_training_days WHERE template_id = ? ORDER BY sort_order, day_of_week',
    [template.id]
  );

  let exercises = [];
  if (days.length) {
    [exercises] = await connection.query(
      `SELECT tte.*, e.muscle_group AS muscle_group, e.equipment, e.image_url AS image_url
       FROM template_training_exercises tte
       LEFT JOIN exercises e ON e.id = tte.exercise_id
       WHERE tte.day_id IN (?)
       ORDER BY tte.sort_order`,
      [days.map((day) => day.id)]
    );
  }

  return {
    ...template,
    days: days.map((day) => ({
      ...day,
      exercises: exercises.filter((exercise) => exercise.day_id === day.id),
    })),
  };
}

export async function getFullNutritionTemplate(connection, templateId) {
  await ensureTemplatesSchema(connection);

  const [templates] = await connection.query('SELECT * FROM nutrition_templates WHERE id = ?', [templateId]);
  if (!templates.length) return null;

  const template = templates[0];
  const [meals] = await connection.query(
    'SELECT * FROM template_nutrition_meals WHERE template_id = ? ORDER BY sort_order, id',
    [template.id]
  );

  let foods = [];
  if (meals.length) {
    [foods] = await connection.query(
      'SELECT * FROM template_nutrition_foods WHERE meal_id IN (?) ORDER BY sort_order, id',
      [meals.map((meal) => meal.id)]
    );
  }

  return {
    ...template,
    meals: meals.map((meal) => ({
      ...meal,
      foods: foods.filter((food) => food.meal_id === meal.id),
    })),
  };
}

async function insertTemplateTrainingDays(connection, templateId, days) {
  for (const [dayIndex, day] of days.entries()) {
    const exercises = Array.isArray(day.exercises) ? day.exercises : [];
    const hasContent = day.title || day.notes || exercises.length;
    if (!hasContent) continue;

    const [dayResult] = await connection.query(
      `INSERT INTO template_training_days (template_id, day_of_week, title, notes, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [templateId, Number(day.dayOfWeek ?? day.day_of_week ?? dayIndex), day.title || null, day.notes || null, dayIndex]
    );

    for (const [exerciseIndex, exercise] of exercises.entries()) {
      const exerciseName = exercise.exerciseName || exercise.exercise_name || exercise.name;
      if (!exerciseName && !exercise.exerciseId && !exercise.exercise_id) continue;
      await connection.query(
        `INSERT INTO template_training_exercises
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
}

async function insertTemplateNutritionMeals(connection, templateId, meals) {
  for (const [mealIndex, meal] of meals.entries()) {
    const foods = Array.isArray(meal.foods) ? meal.foods : [];
    const hasContent = meal.title || meal.notes || foods.length;
    if (!hasContent) continue;

    const [mealResult] = await connection.query(
      `INSERT INTO template_nutrition_meals (template_id, day_of_week, meal_type, title, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [templateId, Number(meal.dayOfWeek ?? meal.day_of_week ?? 1), meal.mealType || meal.meal_type || 'other', meal.title || null, meal.notes || null, mealIndex]
    );

    for (const [foodIndex, food] of foods.entries()) {
      const foodName = food.foodName || food.food_name;
      if (!foodName) continue;
      await connection.query(
        `INSERT INTO template_nutrition_foods
          (meal_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [mealResult.insertId, foodName, food.quantity || null, food.calories || null, food.proteinG || food.protein_g || null, food.carbsG || food.carbs_g || null, food.fatG || food.fat_g || null, foodIndex]
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Training templates
// ---------------------------------------------------------------------------

router.get('/training', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureTemplatesSchema(connection);
    const [rows] = await connection.query(
      `SELECT tt.*, u.full_name AS coach_name,
              (SELECT COUNT(*) FROM template_training_days d WHERE d.template_id = tt.id) AS day_count,
              (SELECT COUNT(*) FROM template_training_exercises e
                 JOIN template_training_days d2 ON d2.id = e.day_id
                 WHERE d2.template_id = tt.id) AS exercise_count
       FROM training_templates tt
       LEFT JOIN users u ON u.id = tt.coach_id
       WHERE tt.is_active = 1
       ORDER BY tt.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/training/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const template = await getFullTrainingTemplate(connection, req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.post('/training', authorizeRole(['coach', 'admin']), [
  body('title').isString().notEmpty(),
  body('goal').optional({ nullable: true }).isIn(['fat_loss', 'muscle_gain', 'toning', 'maintenance']),
  body('level').optional({ nullable: true }).isIn(['beginner', 'intermediate', 'advanced'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    await ensureTemplatesSchema(connection);
    await connection.beginTransaction();

    const { title, description, goal, level, daysPerWeek, days = [] } = req.body;
    const [result] = await connection.query(
      `INSERT INTO training_templates (coach_id, title, description, goal, level, days_per_week)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, description || null, goal || null, level || 'intermediate', daysPerWeek || days.length || null]
    );
    await insertTemplateTrainingDays(connection, result.insertId, days);

    await connection.commit();
    const template = await getFullTrainingTemplate(connection, result.insertId);
    res.status(201).json({ message: 'Template created', template });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.put('/training/:id', authorizeRole(['coach', 'admin']), [
  body('title').isString().notEmpty(),
  body('goal').optional({ nullable: true }).isIn(['fat_loss', 'muscle_gain', 'toning', 'maintenance']),
  body('level').optional({ nullable: true }).isIn(['beginner', 'intermediate', 'advanced'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    await ensureTemplatesSchema(connection);
    await connection.beginTransaction();

    const { title, description, goal, level, daysPerWeek, days = [] } = req.body;
    const [result] = await connection.query(
      `UPDATE training_templates SET title = ?, description = ?, goal = ?, level = ?, days_per_week = ? WHERE id = ?`,
      [title, description || null, goal || null, level || 'intermediate', daysPerWeek || days.length || null, req.params.id]
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Template not found' });
    }

    await connection.query('DELETE FROM template_training_days WHERE template_id = ?', [req.params.id]);
    await insertTemplateTrainingDays(connection, req.params.id, days);

    await connection.commit();
    const template = await getFullTrainingTemplate(connection, req.params.id);
    res.json({ message: 'Template updated', template });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.delete('/training/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureTemplatesSchema(connection);
    const [result] = await connection.query('DELETE FROM training_templates WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// ---------------------------------------------------------------------------
// Nutrition templates
// ---------------------------------------------------------------------------

router.get('/nutrition', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureTemplatesSchema(connection);
    const [rows] = await connection.query(
      `SELECT nt.*, u.full_name AS coach_name,
              (SELECT COUNT(*) FROM template_nutrition_meals m WHERE m.template_id = nt.id) AS meal_count
       FROM nutrition_templates nt
       LEFT JOIN users u ON u.id = nt.coach_id
       WHERE nt.is_active = 1
       ORDER BY nt.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/nutrition/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const template = await getFullNutritionTemplate(connection, req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.post('/nutrition', authorizeRole(['coach', 'admin']), [
  body('title').isString().notEmpty(),
  body('goal').optional({ nullable: true }).isIn(['fat_loss', 'muscle_gain', 'toning', 'maintenance'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    await ensureTemplatesSchema(connection);
    await connection.beginTransaction();

    const { title, description, goal, dailyCalories, proteinG, carbsG, fatG, meals = [] } = req.body;
    const [result] = await connection.query(
      `INSERT INTO nutrition_templates (coach_id, title, description, goal, daily_calories, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, description || null, goal || null, dailyCalories || null, proteinG || null, carbsG || null, fatG || null]
    );
    await insertTemplateNutritionMeals(connection, result.insertId, meals);

    await connection.commit();
    const template = await getFullNutritionTemplate(connection, result.insertId);
    res.status(201).json({ message: 'Template created', template });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.put('/nutrition/:id', authorizeRole(['coach', 'admin']), [
  body('title').isString().notEmpty(),
  body('goal').optional({ nullable: true }).isIn(['fat_loss', 'muscle_gain', 'toning', 'maintenance'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    await ensureTemplatesSchema(connection);
    await connection.beginTransaction();

    const { title, description, goal, dailyCalories, proteinG, carbsG, fatG, meals = [] } = req.body;
    const [result] = await connection.query(
      `UPDATE nutrition_templates SET title = ?, description = ?, goal = ?, daily_calories = ?, protein_g = ?, carbs_g = ?, fat_g = ? WHERE id = ?`,
      [title, description || null, goal || null, dailyCalories || null, proteinG || null, carbsG || null, fatG || null, req.params.id]
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Template not found' });
    }

    await connection.query('DELETE FROM template_nutrition_meals WHERE template_id = ?', [req.params.id]);
    await insertTemplateNutritionMeals(connection, req.params.id, meals);

    await connection.commit();
    const template = await getFullNutritionTemplate(connection, req.params.id);
    res.json({ message: 'Template updated', template });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.delete('/nutrition/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureTemplatesSchema(connection);
    const [result] = await connection.query('DELETE FROM nutrition_templates WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

export default router;
