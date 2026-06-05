import jwt from 'jsonwebtoken';
import { pool } from '../index.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT id, email, role, is_active FROM users WHERE id = ?',
      [user.id]
    );
    connection.release();

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    req.user = {
      ...user,
      email: rows[0].email,
      role: rows[0].role,
    };
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};
