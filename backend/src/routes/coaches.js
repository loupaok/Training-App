import express from 'express';
import multer from 'multer';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Get all coaches
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [coaches] = await connection.query(
      'SELECT id, full_name, email, profile_photo FROM users WHERE role = "coach"'
    );
    connection.release();
    res.json(coaches);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get coach profile
router.get('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [coaches] = await connection.query(
      'SELECT id, full_name, email, profile_photo, bio, specializations FROM users WHERE id = ? AND role = "coach"',
      [req.params.id]
    );
    connection.release();

    if (coaches.length === 0) {
      return res.status(404).json({ message: 'Coach not found' });
    }

    res.json(coaches[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update coach profile
router.put('/:id', authorizeRole(['coach']), upload.single('profilePhoto'), async (req, res) => {
  try {
    if (req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ message: 'Cannot update other profiles' });
    }

    const { bio, specializations } = req.body;
    const profilePhoto = req.file ? req.file.path : null;

    const connection = await pool.getConnection();

    let query = 'UPDATE users SET bio = ?, specializations = ?';
    const values = [bio, specializations];

    if (profilePhoto) {
      query += ', profile_photo = ?';
      values.push(profilePhoto);
    }

    query += ' WHERE id = ?';
    values.push(req.params.id);

    await connection.query(query, values);
    connection.release();

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
