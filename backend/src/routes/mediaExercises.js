import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

// A separate router mounted at the same '/api/media' prefix as media.js,
// purely additive — does not import from or modify exercises.js/media.js.
// Manages only the single exercises.image_url field (the "primary"
// thumbnail this page displays); the exercise_images multi-image gallery
// that exercises.js/exercises-page.tsx own is untouched.

const router = express.Router();
const exerciseUploadDir = path.join(process.cwd(), 'uploads', 'exercises');
fs.mkdirSync(exerciseUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: exerciseUploadDir,
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      cb(null, `exercise-${req.params.id}-${Date.now()}${extension}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

const MUSCLE_FILTERS = {
  chest: ['στήθ'],
  back: ['πλάτ', 'τραπεζοειδ'],
  legs: ['μηριαί', 'τετρακέφαλ', 'γάμπ', 'γλουτ', 'προσαγωγ', 'απαγωγ'],
  shoulders: ['ώμ', 'αυχέν'],
  arms: ['δικέφαλ', 'τρικέφαλ', 'πήχ'],
  abs: ['κοιλιακ', 'κορμ'],
};

const SORTS = {
  az: 'name ASC',
  za: 'name DESC',
  muscle: 'muscle_group ASC, name ASC',
};

router.get('/exercises', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  const { search = '', filter = '', sort = 'az' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 40));
  const offset = (page - 1) * limit;

  const where = [];
  const values = [];

  if (search) {
    where.push('(name LIKE ? OR muscle_group LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }
  if (filter === 'hasImage') {
    where.push("image_url IS NOT NULL AND image_url <> ''");
  } else if (filter === 'noImage') {
    where.push("(image_url IS NULL OR image_url = '')");
  } else if (filter === 'cardio') {
    where.push('type LIKE ?');
    values.push('%cardio%');
  } else if (MUSCLE_FILTERS[filter]) {
    const keywordClauses = MUSCLE_FILTERS[filter].map(() => 'muscle_group LIKE ?').join(' OR ');
    where.push(`(${keywordClauses})`);
    values.push(...MUSCLE_FILTERS[filter].map((keyword) => `%${keyword}%`));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORTS[sort] || SORTS.az;

  try {
    const connection = await pool.getConnection();
    const [[{ total }]] = await connection.query(`SELECT COUNT(*) AS total FROM exercises ${whereSql}`, values);
    const [rows] = await connection.query(
      `SELECT id, name, muscle_group AS muscleGroup, image_url AS imageUrl
       FROM exercises ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
    connection.release();
    res.json({ items: rows, total: Number(total), page, limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN image_url IS NOT NULL AND image_url <> '' THEN 1 ELSE 0 END) AS withImage
       FROM exercises`
    );
    connection.release();
    const total = Number(row.total);
    const withImage = Number(row.withImage);
    res.json({ total, withImage, withoutImage: total - withImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/exercises/:id/image', authorizeRole(['coach', 'admin']), upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file required (jpg, png or webp, max 2MB).' });
  }

  const imageUrl = `/uploads/exercises/${req.file.filename}`;

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [imageUrl, req.params.id]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Exercise not found' });
    }
    res.json({ message: 'Image replaced', imageUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/exercises/:id/image', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('UPDATE exercises SET image_url = NULL WHERE id = ?', [req.params.id]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Exercise not found' });
    }
    res.json({ message: 'Image removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// wger's old fuzzy `/exercise/search/` endpoint no longer exists in their
// current API — `exercise-translation` only supports an exact, case-sensitive
// `name=` match (confirmed empirically: `name__icontains` is silently
// ignored). This means hit rate is inherently limited to exercises whose
// name is byte-for-byte identical to wger's own naming; anything else
// legitimately falls through to notFound below, which is the correct,
// honest outcome rather than a bug.
async function fetchWgerImageUrl(name) {
  const translationUrl = `https://wger.de/api/v2/exercise-translation/?name=${encodeURIComponent(name)}&format=json`;
  const translationResponse = await fetch(translationUrl);
  if (!translationResponse.ok) return null;
  const translationData = await translationResponse.json();
  const baseId = translationData?.results?.[0]?.exercise;
  if (!baseId) return null;

  const imageUrl = `https://wger.de/api/v2/exerciseimage/?exercise=${baseId}&format=json`;
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) return null;
  const imageData = await imageResponse.json();
  const results = imageData?.results || [];
  const main = results.find((item) => item.is_main) || results[0];
  return main?.image || null;
}

router.post('/fetch-from-wger', authorizeRole(['coach', 'admin']), async (req, res) => {
  const exerciseIds = Array.isArray(req.body.exerciseIds) ? req.body.exerciseIds : [];
  if (!exerciseIds.length) {
    return res.status(400).json({ message: 'exerciseIds is required' });
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id, name FROM exercises WHERE id IN (?)`,
      [exerciseIds]
    );

    const updated = [];
    const notFound = [];

    for (const exercise of rows) {
      try {
        const imageUrl = await fetchWgerImageUrl(exercise.name);
        if (imageUrl) {
          await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [imageUrl, exercise.id]);
          updated.push({ id: exercise.id, name: exercise.name, imageUrl });
        } else {
          notFound.push({ id: exercise.id, name: exercise.name });
        }
      } catch (error) {
        console.warn(`wger fetch failed for "${exercise.name}": ${error.message}`);
        notFound.push({ id: exercise.id, name: exercise.name });
      }
      await sleep(300);
    }

    connection.release();
    res.json({ updated, notFound, requested: exerciseIds.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
