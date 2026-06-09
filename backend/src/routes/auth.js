import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge,
    path: '/'
  };
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, cookieOptions(30 * 24 * 60 * 60 * 1000));
  }
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '7d' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function normalizeStatus(user) {
  if (['coach', 'admin'].includes(user.role)) return 'active';
  return user.status || 'pending_payment';
}

function getRedirectPath(user, onboardingCompleted = true) {
  if (['coach', 'admin'].includes(user.role)) return '/coach/dashboard';
  if (user.role === 'client' && !onboardingCompleted) return '/client-onboarding';
  if (user.role === 'client' && user.status === 'active') return '/client/dashboard';
  if (user.role === 'client' && user.status === 'expired') return '/client/expired';
  if (user.role === 'client') return '/client/pending';
  return '/login';
}

async function ensureAuthSchema(connection) {
  for (const statement of [
    'ALTER TABLE users ADD COLUMN first_name VARCHAR(100)',
    'ALTER TABLE users ADD COLUMN last_name VARCHAR(100)',
    "ALTER TABLE users ADD COLUMN status ENUM('pending_payment', 'active', 'expired') DEFAULT 'pending_payment'",
    "ALTER TABLE users ADD COLUMN payment_method ENUM('bank', 'stripe') DEFAULT 'bank'",
    'ALTER TABLE users ADD COLUMN approved_at TIMESTAMP NULL',
    'ALTER TABLE users ADD COLUMN approved_by INT NULL',
    'ALTER TABLE users ADD COLUMN profile_photo VARCHAR(255)',
    'ALTER TABLE users ADD COLUMN specializations TEXT'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_user_id (user_id)
    )
  `);
}

async function getOnboardingCompleted(connection, userId, role) {
  if (role !== 'client') return true;

  try {
    const [rows] = await connection.query(
      'SELECT id FROM onboarding_forms WHERE client_id = ?',
      [userId]
    );
    return rows.length > 0;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return false;
    throw error;
  }
}

function buildUserResponse(user, onboardingCompleted = true) {
  const status = normalizeStatus(user);
  const fullName = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || '';
  const response = {
    id: user.id,
    email: user.email,
    role: user.role,
    status,
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    fullName,
    profilePhoto: user.profile_photo || null,
    profileTitle: user.specializations || null,
    onboardingCompleted
  };
  return { ...response, redirectTo: getRedirectPath(response, onboardingCompleted) };
}

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureAuthSchema(connection);

    const [rows] = await connection.query(
      `SELECT id, email, role, status, full_name, first_name, last_name, profile_photo, specializations
       FROM users
       WHERE id = ? AND is_active = 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'User not found' });
    }

    const onboardingCompleted = await getOnboardingCompleted(connection, rows[0].id, rows[0].role);
    connection.release();

    res.json({ user: buildUserResponse(rows[0], onboardingCompleted) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureAuthSchema(connection);
    const { email, password, fullName } = req.body;

    const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role, status, payment_method) VALUES (?, ?, ?, "client", "pending_payment", "bank")',
      [email, hashedPassword, fullName]
    );

    const user = {
      id: result.insertId,
      email,
      role: 'client',
      status: 'pending_payment',
      full_name: fullName,
      profile_photo: null,
      specializations: null
    };

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await connection.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
    );
    connection.release();

    setAuthCookies(res, accessToken, refreshToken);
    const responseUser = buildUserResponse(user, false);

    res.status(201).json({
      message: 'User registered successfully',
      token: accessToken,
      accessToken,
      refreshToken,
      role: responseUser.role,
      status: responseUser.status,
      redirectTo: responseUser.redirectTo,
      user: responseUser
    });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureAuthSchema(connection);
    const { email, password } = req.body;

    const [users] = await connection.query(
      `SELECT id, email, password, role, status, full_name, first_name, last_name, profile_photo, specializations
       FROM users
       WHERE email = ? AND is_active = 1`,
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
    await connection.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
    );

    const onboardingCompleted = await getOnboardingCompleted(connection, user.id, user.role);
    connection.release();

    setAuthCookies(res, accessToken, refreshToken);
    const responseUser = buildUserResponse(user, onboardingCompleted);

    res.json({
      accessToken,
      refreshToken,
      role: responseUser.role,
      status: responseUser.status,
      redirectTo: responseUser.redirectTo,
      user: responseUser
    });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', authenticateToken, [
  body('fullName').notEmpty().withMessage('Full name required'),
  body('profileTitle').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureAuthSchema(connection);
    const { fullName, profileTitle } = req.body;

    await connection.query(
      'UPDATE users SET full_name = ?, specializations = ? WHERE id = ?',
      [fullName, profileTitle || null, req.user.id]
    );

    const [rows] = await connection.query(
      `SELECT id, email, role, status, full_name, first_name, last_name, profile_photo, specializations
       FROM users
       WHERE id = ?`,
      [req.user.id]
    );

    const onboardingCompleted = rows[0] ? await getOnboardingCompleted(connection, rows[0].id, rows[0].role) : true;
    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: buildUserResponse(rows[0], onboardingCompleted) });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

async function refreshHandler(req, res) {
  const refreshToken = req.body.refreshToken || readCookie(req, 'refreshToken');

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  const connection = await pool.getConnection();

  try {
    await ensureAuthSchema(connection);
    const [rows] = await connection.query(
      `SELECT rt.user_id, u.email, u.role, u.status
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = ? AND rt.expires_at > NOW() AND u.is_active = 1`,
      [refreshToken]
    );

    connection.release();

    if (rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = { id: rows[0].user_id, email: rows[0].email, role: rows[0].role, status: rows[0].status };
    const accessToken = generateAccessToken(user);
    setAuthCookies(res, accessToken);

    res.json({
      accessToken,
      role: user.role,
      status: normalizeStatus(user),
      redirectTo: getRedirectPath({ ...user, status: normalizeStatus(user) })
    });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}

router.post('/refresh-token', refreshHandler);
router.post('/refresh', refreshHandler);

router.post('/logout', async (req, res) => {
  const refreshToken = req.body.refreshToken || readCookie(req, 'refreshToken');

  try {
    if (refreshToken) {
      const connection = await pool.getConnection();
      await connection.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      connection.release();
    }
    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
