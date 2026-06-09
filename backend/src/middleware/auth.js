import jwt from 'jsonwebtoken';
import { pool } from '../index.js';

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function getRequestToken(req) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  return readCookie(req, 'accessToken') || bearerToken;
}

function wantsHtml(req) {
  if (req.originalUrl?.startsWith('/api/')) return false;
  return req.accepts(['html', 'json']) === 'html';
}

export const isAuthenticated = async (req, res, next) => {
  const token = getRequestToken(req);

  if (!token) {
    if (wantsHtml(req)) return res.redirect('/login');
    return res.status(401).json({ message: 'Access token required', redirectTo: '/login' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const connection = await pool.getConnection();

    for (const statement of [
      'ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP NULL',
      "ALTER TABLE users ADD COLUMN status ENUM('pending_payment', 'active', 'expired') DEFAULT 'pending_payment'",
      "ALTER TABLE users ADD COLUMN payment_method ENUM('bank', 'stripe') DEFAULT 'bank'",
      'ALTER TABLE users ADD COLUMN approved_at TIMESTAMP NULL',
      'ALTER TABLE users ADD COLUMN approved_by INT NULL',
      'ALTER TABLE users ADD COLUMN first_name VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN last_name VARCHAR(100)'
    ]) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }

    const [rows] = await connection.query(
      `SELECT id, email, role, is_active,
              COALESCE(status, CASE WHEN role IN ('admin', 'coach') THEN 'active' ELSE 'pending_payment' END) AS status
       FROM users
       WHERE id = ?`,
      [payload.id]
    );

    if (rows.length > 0 && rows[0].is_active) {
      await connection.query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [payload.id]);
    }
    connection.release();

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(403).json({ message: 'Invalid or expired token', redirectTo: '/login' });
    }

    req.user = {
      id: rows[0].id,
      email: rows[0].email,
      role: rows[0].role,
      status: rows[0].status,
    };
    next();
  } catch {
    if (wantsHtml(req)) return res.redirect('/login');
    return res.status(403).json({ message: 'Invalid or expired token', redirectTo: '/login' });
  }
};

export const isCoach = (req, res, next) => {
  const coachRoles = ['coach', 'admin'];
  if (!req.user || !coachRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

export const isClient = (req, res, next) => {
  if (!req.user || req.user.role !== 'client') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (req.user.status === 'pending_payment') {
    if (wantsHtml(req)) return res.redirect('/client/pending');
    return res.status(403).json({ message: 'Payment pending', redirectTo: '/client/pending' });
  }

  if (req.user.status === 'expired') {
    if (wantsHtml(req)) return res.redirect('/client/expired');
    return res.status(403).json({ message: 'Subscription expired', redirectTo: '/client/expired' });
  }

  next();
};

export const authenticateToken = isAuthenticated;

export const authorizeRole = (roles) => {
  return (req, res, next) => {
    const normalizedRoles = roles.flatMap((role) => {
      if (role === 'coach' || role === 'admin') return ['coach', 'admin'];
      return [role];
    });
    if (!req.user || !normalizedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};
