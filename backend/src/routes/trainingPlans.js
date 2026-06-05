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
