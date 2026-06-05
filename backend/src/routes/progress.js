import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Multer storage — saves to uploads/progress/<clientId>/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('uploads', 'progress', req.params.progressId || 'tmp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const valid = allowed.test(path.extname(file.originalname).toLowerCase())
                && allowed.test(file.mimetype);
    valid ? cb(null, true) : cb(new Error('Only image files are allowed'));
  }
});

// Helper — verify coach has access to a client
async function coachHasClient(connection, coachId, clientId) {
  const [rows] = await connection.query(
    'SELECT id FROM coach_clients WHERE coach_id = ? AND client_id = ?',
    [coachId, clientId]
  );
  return rows.length > 0;
}

// POST /progress — create a new progress update
router.post('/', authorizeRole(['coach', 'admin']), [
  body('clientId').isInt().withMessage('Valid client ID required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    clientId, weightKg, bodyFatPct, muscleMassKg,
    waistCm, hipsCm, chestCm,
    moodScore, energyScore, sleepHours, notes
  } = req.body;

  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, clientId))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const coachId = req.user.role === 'coach' ? req.user.id : (req.body.coachId || null);

    const [result] = await connection.query(
      `INSERT INTO progress_updates
         (client_id, coach_id, weight_kg, body_fat_pct, muscle_mass_kg,
          waist_cm, hips_cm, chest_cm, mood_score, energy_score, sleep_hours, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, coachId,
       weightKg || null, bodyFatPct || null, muscleMassKg || null,
       waistCm || null, hipsCm || null, chestCm || null,
       moodScore || null, energyScore || null, sleepHours || null, notes || null]
    );

    connection.release();
    res.status(201).json({ message: 'Progress update created', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /progress/:clientId — all progress updates with photos
router.get('/:clientId', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    if (req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, req.params.clientId))) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const [updates] = await connection.query(
      `SELECT pu.*, u.full_name AS coach_name
       FROM progress_updates pu
       LEFT JOIN users u ON u.id = pu.coach_id
       WHERE pu.client_id = ?
       ORDER BY pu.submitted_at DESC`,
      [req.params.clientId]
    );

    if (updates.length > 0) {
      const ids = updates.map(u => u.id);
      const [photos] = await connection.query(
        `SELECT * FROM progress_photos WHERE progress_update_id IN (?)`,
        [ids]
      );

      // Attach photos to their parent update
      const photoMap = {};
      photos.forEach(p => {
        if (!photoMap[p.progress_update_id]) photoMap[p.progress_update_id] = [];
        photoMap[p.progress_update_id].push(p);
      });
      updates.forEach(u => { u.photos = photoMap[u.id] || []; });
    }

    connection.release();
    res.json(updates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /progress/:id — delete update + photos (files + DB rows)
router.delete('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT pu.*, cc.coach_id
       FROM progress_updates pu
       LEFT JOIN coach_clients cc ON cc.client_id = pu.client_id
       WHERE pu.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Progress update not found' });
    }

    if (req.user.role === 'coach' && rows[0].coach_id !== req.user.id) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    // Fetch photos to delete physical files
    const [photos] = await connection.query(
      'SELECT photo_url FROM progress_photos WHERE progress_update_id = ?',
      [req.params.id]
    );

    // Delete physical files
    photos.forEach(p => {
      const filePath = path.join(p.photo_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    // DB rows cascade via FK (progress_photos → progress_updates)
    await connection.query('DELETE FROM progress_updates WHERE id = ?', [req.params.id]);

    connection.release();
    res.json({ message: 'Progress update and photos deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /progress/:progressId/photos — upload photos for a progress update
router.post('/:progressId/photos', authorizeRole(['coach', 'admin']), (req, res, next) => {
  upload.array('photos', 10)(req, res, err => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT pu.client_id, cc.coach_id
       FROM progress_updates pu
       LEFT JOIN coach_clients cc ON cc.client_id = pu.client_id
       WHERE pu.id = ?`,
      [req.params.progressId]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Progress update not found' });
    }

    if (req.user.role === 'coach' && rows[0].coach_id !== req.user.id) {
      connection.release();
      return res.status(403).json({ message: 'Access denied' });
    }

    const angles = req.body.angles || [];
    const clientId = rows[0].client_id;

    const insertValues = req.files.map((file, i) => [
      req.params.progressId,
      clientId,
      file.path.replace(/\\/g, '/'),
      angles[i] || 'other'
    ]);

    await connection.query(
      'INSERT INTO progress_photos (progress_update_id, client_id, photo_url, angle) VALUES ?',
      [insertValues]
    );

    connection.release();
    res.status(201).json({
      message: `${req.files.length} photo(s) uploaded successfully`,
      photos: req.files.map((f, i) => ({
        url: f.path.replace(/\\/g, '/'),
        angle: angles[i] || 'other'
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
