import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

async function ensureChangelogSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS changelog_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

// List entries, newest first — visible to every authenticated role, no notifications triggered
router.get('/', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureChangelogSchema(connection);
    const [rows] = await connection.query(
      `SELECT ce.id, ce.title, ce.body, ce.created_at, u.full_name AS created_by_name
       FROM changelog_entries ce
       JOIN users u ON u.id = ce.created_by
       ORDER BY ce.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

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
    await ensureChangelogSchema(connection);
    const { title, body } = req.body;
    const [result] = await connection.query(
      'INSERT INTO changelog_entries (title, body, created_by) VALUES (?, ?, ?)',
      [title, body || null, req.user.id]
    );
    res.status(201).json({ message: 'Entry added', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.delete('/:id', authorizeRole(['admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureChangelogSchema(connection);
    const [result] = await connection.query('DELETE FROM changelog_entries WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    res.json({ message: 'Entry deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

export default router;
