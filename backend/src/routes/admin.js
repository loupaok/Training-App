import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const ALLOWED_ROLES = ['admin', 'moderator', 'coach', 'client'];
const TEAM_ROLES = ['admin', 'moderator'];

async function ensureRoleEnum(connection) {
  await connection.query(
    "ALTER TABLE users MODIFY role ENUM('admin', 'moderator', 'coach', 'client') NOT NULL DEFAULT 'client'"
  );
}

function publicUserSelect() {
  return 'id, email, full_name, role, specializations, is_active, created_at';
}

// Get all users (Admin only)
router.get('/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureRoleEnum(connection);
    const [users] = await connection.query(
      `SELECT ${publicUserSelect()} FROM users WHERE role IN ('admin', 'moderator') ORDER BY created_at DESC, full_name ASC`
    );
    connection.release();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create any user role (Admin only)
router.post('/users', authenticateToken, authorizeRole(['admin']), [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty(),
  body('role').isIn(TEAM_ROLES),
  body('specializations').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureRoleEnum(connection);
    const { email, password, fullName, role, specializations } = req.body;

    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role, specializations, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [email, hashedPassword, fullName, role, specializations || null]
    );

    connection.release();
    res.status(201).json({ message: 'User created successfully', id: result.insertId });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update role/status (Admin only)
router.put('/users/:userId', authenticateToken, authorizeRole(['admin']), [
  body('role').optional().isIn(TEAM_ROLES),
  body('isActive').optional().isBoolean(),
  body('fullName').optional().notEmpty(),
  body('specializations').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureRoleEnum(connection);
    const updates = [];
    const values = [];

    if (req.body.role) {
      updates.push('role = ?');
      values.push(req.body.role);
    }
    if (req.body.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(req.body.isActive ? 1 : 0);
    }
    if (req.body.fullName) {
      updates.push('full_name = ?');
      values.push(req.body.fullName);
    }
    if (req.body.specializations !== undefined) {
      updates.push('specializations = ?');
      values.push(req.body.specializations || null);
    }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ message: 'No updates provided' });
    }

    values.push(req.params.userId);
    const [result] = await connection.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

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
    await ensureRoleEnum(connection);

    const [coachCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "coach"'
    );

    const [moderatorCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "moderator"'
    );

    const [adminCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
    );

    const [clientCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "client"'
    );

    connection.release();

    res.json({
      admins: adminCount[0].count,
      moderators: moderatorCount[0].count,
      coaches: coachCount[0].count,
      clients: clientCount[0].count,
      totalUsers: adminCount[0].count + moderatorCount[0].count + coachCount[0].count + clientCount[0].count
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
