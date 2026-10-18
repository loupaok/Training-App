import express from 'express';
import { pool } from '../index.js';
import { authenticateToken } from '../middleware/auth.js';
import { ensureAuthSchema } from './auth.js';

const router = express.Router();

router.post('/push-token', authenticateToken, async (req, res) => {
  const pushToken = typeof req.body?.pushToken === 'string' ? req.body.pushToken.trim() : '';
  if (!pushToken || pushToken.length > 255) {
    return res.status(400).json({ message: 'Invalid push token.' });
  }

  const connection = await pool.getConnection();
  try {
    await ensureAuthSchema(connection);
    await connection.query('UPDATE users SET push_token = ? WHERE id = ?', [pushToken, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Push token save failed:', error);
    res.status(500).json({ message: 'Could not save push token.' });
  } finally {
    connection.release();
  }
});

export default router;
