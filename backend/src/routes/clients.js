import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// GET /clients — coaches see their own clients, admins see all
router.get('/', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    let rows;
    if (req.user.role === 'admin') {
      [rows] = await connection.query(
        `SELECT u.id, u.email, u.full_name, u.profile_photo, u.is_active,
                c.phone, c.gender, c.date_of_birth, c.height_cm, c.weight_kg, c.fitness_goal,
                cc.status AS coaching_status, cc.coach_id
         FROM users u
         LEFT JOIN clients c ON c.user_id = u.id
         LEFT JOIN coach_clients cc ON cc.client_id = u.id
         WHERE u.role = 'client'
         ORDER BY u.full_name`
      );
    } else {
      [rows] = await connection.query(
        `SELECT u.id, u.email, u.full_name, u.profile_photo, u.is_active,
                c.phone, c.gender, c.date_of_birth, c.height_cm, c.weight_kg, c.fitness_goal,
                cc.status AS coaching_status
         FROM users u
         INNER JOIN coach_clients cc ON cc.client_id = u.id AND cc.coach_id = ?
         LEFT JOIN clients c ON c.user_id = u.id
         WHERE u.role = 'client'
         ORDER BY u.full_name`,
        [req.user.id]
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
router.get('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
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

    connection.release();
    res.json(rows[0]);
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
