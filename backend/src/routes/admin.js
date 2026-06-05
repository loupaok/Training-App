import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Create Coach (Admin only)
router.post('/coaches', authenticateToken, authorizeRole(['admin']), [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty(),
  body('specializations').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, fullName, specializations } = req.body;
    const connection = await pool.getConnection();

    // Check if user exists
    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create coach
    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role, specializations, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [email, hashedPassword, fullName, 'coach', specializations || null]
    );

    connection.release();

    res.status(201).json({ 
      message: 'Coach created successfully',
      coachId: result.insertId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all coaches (Admin only)
router.get('/coaches', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [coaches] = await connection.query(
      'SELECT id, email, full_name, specializations, created_at FROM users WHERE role = "coach"'
    );
    connection.release();
    res.json(coaches);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete coach (Admin only)
router.delete('/coaches/:coachId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'DELETE FROM users WHERE id = ? AND role = "coach"',
      [req.params.coachId]
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Coach not found' });
    }

    res.json({ message: 'Coach deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all clients (Admin only)
router.get('/clients', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [clients] = await connection.query(
      'SELECT id, email, full_name, created_at FROM users WHERE role = "client"'
    );
    connection.release();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get stats (Admin only)
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [coachCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "coach"'
    );

    const [clientCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "client"'
    );

    connection.release();

    res.json({
      coaches: coachCount[0].count,
      clients: clientCount[0].count,
      totalUsers: coachCount[0].count + clientCount[0].count
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
