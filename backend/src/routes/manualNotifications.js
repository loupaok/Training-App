import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';
import { sendPushToUsers } from '../lib/webPush.js';

const router = express.Router();

async function ensureManualNotificationsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS manual_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      link_url VARCHAR(500),
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_read_at (read_at)
    )
  `);

  for (const statement of [
    'ALTER TABLE notifications ADD COLUMN client_id INT NULL',
    'ALTER TABLE notifications ADD COLUMN payment_id INT NULL',
    'ALTER TABLE notifications ADD COLUMN manual_notification_id INT NULL'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

// List broadcasts, newest first (Admin only)
router.get('/', authorizeRole(['admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureManualNotificationsSchema(connection);
    const [rows] = await connection.query(
      `SELECT mn.id, mn.title, mn.body, mn.created_at, u.full_name AS created_by_name
       FROM manual_notifications mn
       JOIN users u ON u.id = mn.created_by
       ORDER BY mn.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// Create a broadcast and fan it out to every active user (Admin only)
router.post('/', authorizeRole(['admin']), [
  body('title').isString().notEmpty(),
  body('body').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();
  try {
    await ensureManualNotificationsSchema(connection);
    const { title, body } = req.body;

    const [result] = await connection.query(
      'INSERT INTO manual_notifications (title, body, created_by) VALUES (?, ?, ?)',
      [title, body || null, req.user.id]
    );
    const manualNotificationId = result.insertId;

    const [users] = await connection.query('SELECT id FROM users WHERE is_active = 1');
    for (const user of users) {
      await connection.query(
        `INSERT INTO notifications (user_id, manual_notification_id, type, title, body)
         VALUES (?, ?, 'admin_broadcast', ?, ?)`,
        [user.id, manualNotificationId, title, body || null]
      );
    }

    try {
      await sendPushToUsers(users.map((user) => user.id), { title, body: body || '', url: '/' });
    } catch (pushError) {
      console.error('Push notification failed:', pushError.message);
    }

    res.status(201).json({ message: 'Notification sent', id: manualNotificationId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// Delete a broadcast and its fanned-out notifications (Admin only)
router.delete('/:id', authorizeRole(['admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureManualNotificationsSchema(connection);
    await connection.query('DELETE FROM notifications WHERE manual_notification_id = ?', [req.params.id]);
    const [result] = await connection.query('DELETE FROM manual_notifications WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

export default router;
