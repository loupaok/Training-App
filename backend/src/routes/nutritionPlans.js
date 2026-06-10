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
    'SELECT id FROM nutrition_plans WHERE id = ? AND coach_id = ?',
    [planId, coachId]
  );
  return rows.length > 0;
}


async function ensureNutritionPlanBuilderSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS nutrition_plan_meals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nutrition_plan_id INT NOT NULL,
      day_of_week TINYINT NOT NULL DEFAULT 1,
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
}

async function getFullNutritionPlan(connection, clientId) {
  await ensureNutritionPlanBuilderSchema(connection);

  const [plans] = await connection.query(
    `SELECT * FROM nutrition_plans
     WHERE client_id = ? AND status = 'active'
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [clientId]
  );

  if (!plans.length) return null;

  const plan = plans[0];
  const [meals] = await connection.query(
    'SELECT * FROM nutrition_plan_meals WHERE nutrition_plan_id = ? ORDER BY sort_order, id',
    [plan.id]
  );

  let foods = [];
  if (meals.length) {
    [foods] = await connection.query(
      'SELECT * FROM nutrition_plan_foods WHERE meal_id IN (?) ORDER BY sort_order, id',
      [meals.map((meal) => meal.id)]
    );
  }

  return {
    ...plan,
    meals: meals.map((meal) => ({
      ...meal,
      foods: foods.filter((food) => food.meal_id === meal.id),
    })),
  };
}

router.get('/:clientId/full', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const plan = await getFullNutritionPlan(connection, req.params.clientId);
    connection.release();
    res.json(plan || { meals: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:clientId/full', authorizeRole(['coach', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureNutritionPlanBuilderSchema(connection);
    await connection.beginTransaction();

    const clientId = Number(req.params.clientId);
    const {
      title = '????????? ?????????',
      description = '',
      dailyCalories = null,
      proteinG = null,
      carbsG = null,
      fatG = null,
      notes = '',
      startDate = null,
      endDate = null,
      meals = [],
    } = req.body;

    const coachId = req.user.id;
    const [existing] = await connection.query(
      "SELECT id FROM nutrition_plans WHERE client_id = ? AND status = 'active' ORDER BY updated_at DESC, created_at DESC LIMIT 1",
      [clientId]
    );

    let planId = existing[0]?.id;
    if (planId) {
      await connection.query(
        `UPDATE nutrition_plans
         SET coach_id = ?, title = ?, description = ?, daily_calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?, notes = ?, start_date = ?, end_date = ?, status = 'active'
         WHERE id = ?`,
        [coachId, title, description || null, dailyCalories || null, proteinG || null, carbsG || null, fatG || null, notes || null, startDate || null, endDate || null, planId]
      );
      await connection.query('DELETE FROM nutrition_plan_meals WHERE nutrition_plan_id = ?', [planId]);
    } else {
      const [result] = await connection.query(
        `INSERT INTO nutrition_plans
          (coach_id, client_id, title, description, daily_calories, protein_g, carbs_g, fat_g, notes, is_template, status, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)`,
        [coachId, clientId, title, description || null, dailyCalories || null, proteinG || null, carbsG || null, fatG || null, notes || null, startDate || null, endDate || null]
      );
      planId = result.insertId;
    }

    for (const [mealIndex, meal] of meals.entries()) {
      const foods = Array.isArray(meal.foods) ? meal.foods : [];
      const hasContent = meal.title || meal.notes || foods.length;
      if (!hasContent) continue;

      const [mealResult] = await connection.query(
        `INSERT INTO nutrition_plan_meals (nutrition_plan_id, day_of_week, meal_type, title, notes, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [planId, Number(meal.dayOfWeek ?? meal.day_of_week ?? 1), meal.mealType || meal.meal_type || 'other', meal.title || null, meal.notes || null, mealIndex]
      );

      for (const [foodIndex, food] of foods.entries()) {
        const foodName = food.foodName || food.food_name;
        if (!foodName) continue;
        await connection.query(
          `INSERT INTO nutrition_plan_foods
            (meal_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [mealResult.insertId, foodName, food.quantity || null, food.calories || null, food.proteinG || food.protein_g || null, food.carbsG || food.carbs_g || null, food.fatG || food.fat_g || null, foodIndex]
        );
      }
    }

    await connection.commit();
    const plan = await getFullNutritionPlan(connection, clientId);
    connection.release();
    res.json({ message: 'Nutrition plan saved', plan });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /nutrition-plans/:clientId — all plans for a client
router.get('/:clientId', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, req.params.clientId))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await connection.query(
      `SELECT np.*, u.full_name AS coach_name
       FROM nutrition_plans np
       LEFT JOIN users u ON u.id = np.coach_id
       WHERE np.client_id = ? OR (np.is_template = 1 AND np.coach_id = ?)
       ORDER BY np.created_at DESC`,
      [req.params.clientId, req.user.id]
    );

    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /nutrition-plans — create a new plan
router.post('/', authorizeRole(['coach', 'admin']), [
  body('title').notEmpty().withMessage('Title required'),
  body('clientId').optional().isInt(),
  body('dailyCalories').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['draft', 'active', 'completed', 'archived'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    clientId, title, description,
    dailyCalories, proteinG, carbsG, fatG,
    notes, isTemplate, status, startDate, endDate
  } = req.body;

  try {
    const connection = await pool.getConnection();

    if (clientId && req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, clientId))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const coachId = req.user.role === 'coach' ? req.user.id : (req.body.coachId || null);

    const [result] = await connection.query(
      `INSERT INTO nutrition_plans
         (coach_id, client_id, title, description, daily_calories,
          protein_g, carbs_g, fat_g, notes, is_template, status, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [coachId, clientId || null, title, description || null,
       dailyCalories || null, proteinG || null, carbsG || null, fatG || null,
       notes || null, isTemplate ? 1 : 0, status || 'draft',
       startDate || null, endDate || null]
    );

    connection.release();
    res.status(201).json({ message: 'Nutrition plan created', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /nutrition-plans/:id — update plan
router.put('/:id', authorizeRole(['coach', 'admin']), [
  body('status').optional().isIn(['draft', 'active', 'completed', 'archived']),
  body('dailyCalories').optional().isInt({ min: 0 })
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

    const [rows] = await connection.query('SELECT id FROM nutrition_plans WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Nutrition plan not found' });
    }

    const {
      title, description, dailyCalories, proteinG, carbsG, fatG,
      notes, isTemplate, status, startDate, endDate, clientId
    } = req.body;

    const updates = [];
    const values = [];

    if (title)                     { updates.push('title = ?');           values.push(title); }
    if (description !== undefined) { updates.push('description = ?');     values.push(description); }
    if (dailyCalories !== undefined){ updates.push('daily_calories = ?'); values.push(dailyCalories); }
    if (proteinG !== undefined)    { updates.push('protein_g = ?');       values.push(proteinG); }
    if (carbsG !== undefined)      { updates.push('carbs_g = ?');         values.push(carbsG); }
    if (fatG !== undefined)        { updates.push('fat_g = ?');           values.push(fatG); }
    if (notes !== undefined)       { updates.push('notes = ?');           values.push(notes); }
    if (isTemplate !== undefined)  { updates.push('is_template = ?');     values.push(isTemplate ? 1 : 0); }
    if (status)                    { updates.push('status = ?');          values.push(status); }
    if (startDate !== undefined)   { updates.push('start_date = ?');      values.push(startDate); }
    if (endDate !== undefined)     { updates.push('end_date = ?');        values.push(endDate); }
    if (clientId !== undefined)    { updates.push('client_id = ?');       values.push(clientId); }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(req.params.id);
    await connection.query(`UPDATE nutrition_plans SET ${updates.join(', ')} WHERE id = ?`, values);

    connection.release();
    res.json({ message: 'Nutrition plan updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /nutrition-plans/:id
router.delete('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachOwnsPlan(connection, req.user.id, req.params.id))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await connection.query('SELECT id FROM nutrition_plans WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Nutrition plan not found' });
    }

    await connection.query('DELETE FROM nutrition_plans WHERE id = ?', [req.params.id]);

    connection.release();
    res.json({ message: 'Nutrition plan deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
