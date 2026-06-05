import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';

const router = express.Router();

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '15m' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

// POST /auth/register — clients only (coaches created by admin)
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, fullName } = req.body;
    const connection = await pool.getConnection();

    const [existing] = await connection.query(
      'SELECT id FROM users WHERE email = ?', [email]
    );

    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, "client")',
      [email, hashedPassword, fullName]
    );

    connection.release();

    const user = { id: result.insertId, email, role: 'client' };
    const accessToken = generateAccessToken(user);

    res.status(201).json({ message: 'User registered successfully', token: accessToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/login — coach & client
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const connection = await pool.getConnection();

    const [users] = await connection.query(
      'SELECT id, email, password, role, full_name FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      connection.release();
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await connection.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );

    connection.release();

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, fullName: user.full_name }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/refresh-token — issue new access token
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT rt.user_id, u.email, u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = ? AND rt.expires_at > NOW() AND u.is_active = 1`,
      [refreshToken]
    );

    connection.release();

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = { id: rows[0].user_id, email: rows[0].email, role: rows[0].role };
    const accessToken = generateAccessToken(user);

    res.json({ accessToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/logout — invalidate refresh token
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    connection.release();

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
