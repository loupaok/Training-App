import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

async function coachOwnsPlan(connection, coachId, planId) {
  const [rows] = await connection.query(
    'SELECT id FROM training_plans WHERE id = ? AND coach_id = ?',
    [planId, coachId]
  );
  return rows.length > 0;
}

async function coachOwnsRep(connection, coachId, repId) {
  const [rows] = await connection.query(
    `SELECT r.id FROM reps r
     JOIN training_plans tp ON tp.id = r.training_plan_id
     WHERE r.id = ? AND tp.coach_id = ?`,
    [repId, coachId]
  );
  return rows.length > 0;
}

// GET /reps/:trainingPlanId — all exercises grouped by day
router.get('/:trainingPlanId', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachOwnsPlan(connection, req.user.id, req.params.trainingPlanId))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await connection.query(
      `SELECT * FROM reps
       WHERE training_plan_id = ?
       ORDER BY day_number, sort_order`,
      [req.params.trainingPlanId]
    );

    // Group by day
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.day_number]) grouped[r.day_number] = [];
      grouped[r.day_number].push(r);
    });

    connection.release();
    res.json(grouped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /reps — add exercise to a training plan
router.post('/', authorizeRole(['coach', 'admin']), [
  body('trainingPlanId').isInt().withMessage('Training plan ID required'),
  body('exerciseName').notEmpty().withMessage('Exercise name required'),
  body('dayNumber').isInt({ min: 1 }).withMessage('Day number required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    trainingPlanId, dayNumber, exerciseName,
    sets, repsPerSet, restSeconds,
    weightKg, durationSeconds, distanceM,
    notes, sortOrder
  } = req.body;

  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachOwnsPlan(connection, req.user.id, trainingPlanId))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [result] = await connection.query(
      `INSERT INTO reps
         (training_plan_id, day_number, exercise_name, sets, reps_per_set,
          rest_seconds, weight_kg, duration_seconds, distance_m, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trainingPlanId, dayNumber, exerciseName,
       sets || null, repsPerSet || null, restSeconds || null,
       weightKg || null, durationSeconds || null, distanceM || null,
       notes || null, sortOrder || 0]
    );

    connection.release();
    res.status(201).json({ message: 'Exercise added', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /reps/:id — update an exercise
router.put('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachOwnsRep(connection, req.user.id, req.params.id))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await connection.query('SELECT id FROM reps WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Exercise not found' });
    }

    const {
      dayNumber, exerciseName, sets, repsPerSet,
      restSeconds, weightKg, durationSeconds, distanceM,
      notes, sortOrder
    } = req.body;

    const updates = [];
    const values = [];

    if (dayNumber !== undefined)      { updates.push('day_number = ?');       values.push(dayNumber); }
    if (exerciseName)                 { updates.push('exercise_name = ?');    values.push(exerciseName); }
    if (sets !== undefined)           { updates.push('sets = ?');             values.push(sets); }
    if (repsPerSet !== undefined)     { updates.push('reps_per_set = ?');     values.push(repsPerSet); }
    if (restSeconds !== undefined)    { updates.push('rest_seconds = ?');     values.push(restSeconds); }
    if (weightKg !== undefined)       { updates.push('weight_kg = ?');        values.push(weightKg); }
    if (durationSeconds !== undefined){ updates.push('duration_seconds = ?'); values.push(durationSeconds); }
    if (distanceM !== undefined)      { updates.push('distance_m = ?');       values.push(distanceM); }
    if (notes !== undefined)          { updates.push('notes = ?');            values.push(notes); }
    if (sortOrder !== undefined)      { updates.push('sort_order = ?');       values.push(sortOrder); }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(req.params.id);
    await connection.query(`UPDATE reps SET ${updates.join(', ')} WHERE id = ?`, values);

    connection.release();
    res.json({ message: 'Exercise updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /reps/:id — remove an exercise
router.delete('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachOwnsRep(connection, req.user.id, req.params.id))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await connection.query('SELECT id FROM reps WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Exercise not found' });
    }

    await connection.query('DELETE FROM reps WHERE id = ?', [req.params.id]);

    connection.release();
    res.json({ message: 'Exercise deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
