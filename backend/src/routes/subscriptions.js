import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// GET /subscriptions/:clientId — get all subscriptions for a client
router.get('/:clientId', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Coaches can only view subscriptions of their own clients
    if (req.user.role === 'coach') {
      const [access] = await connection.query(
        'SELECT id FROM coach_clients WHERE coach_id = ? AND client_id = ?',
        [req.user.id, req.params.clientId]
      );
      if (access.length === 0) {
        connection.release();
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const [rows] = await connection.query(
      `SELECT s.*, u.full_name AS coach_name
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.coach_id
       WHERE s.client_id = ?
       ORDER BY s.created_at DESC`,
      [req.params.clientId]
    );

    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /subscriptions — create a new subscription
router.post('/', authorizeRole(['coach', 'admin']), [
  body('clientId').isInt().withMessage('Valid client ID required'),
  body('planName').notEmpty().withMessage('Plan name required'),
  body('planType').isIn(['monthly', 'quarterly', 'semi_annual', 'annual', 'custom']).withMessage('Invalid plan type'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('startDate').isDate().withMessage('Valid start date required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { clientId, planName, planType, price, currency, startDate, endDate, notes } = req.body;

  try {
    const connection = await pool.getConnection();

    // Coaches can only create subscriptions for their own clients
    if (req.user.role === 'coach') {
      const [access] = await connection.query(
        'SELECT id FROM coach_clients WHERE coach_id = ? AND client_id = ?',
        [req.user.id, clientId]
      );
      if (access.length === 0) {
        connection.release();
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Verify client exists
    const [client] = await connection.query(
      'SELECT id FROM users WHERE id = ? AND role = "client"', [clientId]
    );
    if (client.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Client not found' });
    }

    const coachId = req.user.role === 'coach' ? req.user.id : (req.body.coachId || null);

    const [result] = await connection.query(
      `INSERT INTO subscriptions
         (client_id, coach_id, plan_name, plan_type, price, currency, start_date, end_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, coachId, planName, planType, price,
       currency || 'EUR', startDate, endDate || null, notes || null]
    );

    connection.release();
    res.status(201).json({ message: 'Subscription created successfully', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /subscriptions/:id — update subscription (status, dates, price etc.)
router.put('/:id', authorizeRole(['coach', 'admin']), [
  body('planType').optional().isIn(['monthly', 'quarterly', 'semi_annual', 'annual', 'custom']),
  body('price').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['active', 'paused', 'cancelled', 'expired']),
  body('startDate').optional().isDate(),
  body('endDate').optional().isDate()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      'SELECT * FROM subscriptions WHERE id = ?', [req.params.id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Subscription not found' });
    }

    const sub = rows[0];

    // Coaches can only update subscriptions linked to their clients
    if (req.user.role === 'coach' && sub.coach_id !== req.user.id) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const { planName, planType, price, currency, startDate, endDate, status, notes } = req.body;

    const updates = [];
    const values = [];

    if (planName)    { updates.push('plan_name = ?');  values.push(planName); }
    if (planType)    { updates.push('plan_type = ?');  values.push(planType); }
    if (price !== undefined) { updates.push('price = ?'); values.push(price); }
    if (currency)    { updates.push('currency = ?');   values.push(currency); }
    if (startDate)   { updates.push('start_date = ?'); values.push(startDate); }
    if (endDate)     { updates.push('end_date = ?');   values.push(endDate); }
    if (status)      { updates.push('status = ?');     values.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(req.params.id);
    await connection.query(
      `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`, values
    );

    connection.release();
    res.json({ message: 'Subscription updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
