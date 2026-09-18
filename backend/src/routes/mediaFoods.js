import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

// Sibling to mediaExercises.js — a third router mounted at the same
// '/api/media' prefix, purely additive. Manages only the foods.image_url
// field; does not import from or modify foods.js or the food library page.

const router = express.Router();
const foodUploadDir = path.join(process.cwd(), 'uploads', 'media', 'foods');
fs.mkdirSync(foodUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: foodUploadDir,
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      cb(null, `food-${req.params.id}-${Date.now()}${extension}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

const CATEGORIES = [
  'meat', 'fish', 'eggs', 'dairy', 'vegetables', 'fruits',
  'legumes', 'grains', 'nuts', 'oils', 'other',
];

router.get('/foods', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  const { search = '', category = '', hasImage = '' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 40));
  const offset = (page - 1) * limit;

  const where = [];
  const values = [];

  if (search) {
    where.push('(name_gr LIKE ? OR name_en LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }
  if (category && CATEGORIES.includes(category)) {
    where.push('category = ?');
    values.push(category);
  }
  if (hasImage === 'true') {
    where.push("image_url IS NOT NULL AND image_url <> ''");
  } else if (hasImage === 'false') {
    where.push("(image_url IS NULL OR image_url = '')");
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const connection = await pool.getConnection();
    const [[{ total }]] = await connection.query(`SELECT COUNT(*) AS total FROM foods ${whereSql}`, values);
    const [rows] = await connection.query(
      `SELECT id, name_gr AS nameGr, category, calories_per_100g AS caloriesPer100g, image_url AS imageUrl
       FROM foods ${whereSql} ORDER BY name_gr ASC LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
    connection.release();
    res.json({ items: rows, total: Number(total), page, limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/foods/stats', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN image_url IS NOT NULL AND image_url <> '' THEN 1 ELSE 0 END) AS withImage
       FROM foods`
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

router.put('/foods/:id/image', authorizeRole(['coach', 'admin']), upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file required (jpg, png or webp, max 2MB).' });
  }

  const imageUrl = `/uploads/media/foods/${req.file.filename}`;

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('UPDATE foods SET image_url = ? WHERE id = ?', [imageUrl, req.params.id]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Food not found' });
    }
    res.json({ message: 'Image replaced', imageUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/foods/:id/image', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('UPDATE foods SET image_url = NULL WHERE id = ?', [req.params.id]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Food not found' });
    }
    res.json({ message: 'Image removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
