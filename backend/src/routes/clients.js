import express from 'express';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all clients (for coaches)
router.get('/', authorizeRole(['coach']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Get clients assigned to this coach
    const [clients] = await connection.query(
      `SELECT u.id, u.full_name, u.email, u.profile_photo, cc.status 
       FROM users u 
       LEFT JOIN coach_clients cc ON u.id = cc.client_id 
       WHERE u.role = "client" AND cc.coach_id = ?`,
      [req.user.id]
    );
    
    connection.release();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get client profile
router.get('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [clients] = await connection.query(
      'SELECT id, full_name, email, profile_photo FROM users WHERE id = ? AND role = "client"',
      [req.params.id]
    );
    connection.release();

    if (clients.length === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json(clients[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign client to coach
router.post('/:clientId/assign', authorizeRole(['coach']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    await connection.query(
      'INSERT INTO coach_clients (coach_id, client_id, status, created_at) VALUES (?, ?, "active", NOW())',
      [req.user.id, req.params.clientId]
    );

    connection.release();
    res.status(201).json({ message: 'Client assigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
