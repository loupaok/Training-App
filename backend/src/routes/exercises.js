import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const exerciseUploadDir = path.join(process.cwd(), 'uploads', 'exercises');

fs.mkdirSync(exerciseUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: exerciseUploadDir,
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      const safeName = `exercise-${req.params.id}-${Date.now()}${extension}`;
      cb(null, safeName);
    },
  }),
  fileFilter: (req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function ensureMediaArchiveTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS media_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES media_folders(id) ON DELETE SET NULL,
      INDEX idx_parent_id (parent_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      asset_type ENUM('photo', 'icon') DEFAULT 'photo',
      url VARCHAR(600) NOT NULL,
      source VARCHAR(80) DEFAULT 'upload',
      folder_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE SET NULL,
      INDEX idx_asset_type (asset_type),
      INDEX idx_source (source),
      INDEX idx_folder_id (folder_id)
    )
  `);
}

async function archiveCurrentExerciseImage(connection, exerciseId, nextImageUrl) {
  const [[exercise]] = await connection.query(
    'SELECT name, image_url AS imageUrl FROM exercises WHERE id = ?',
    [exerciseId]
  );

  if (!exercise?.imageUrl || exercise.imageUrl === nextImageUrl) {
    return;
  }

  await ensureMediaArchiveTable(connection);
  const [[existingAsset]] = await connection.query(
    'SELECT id FROM media_assets WHERE url = ? LIMIT 1',
    [exercise.imageUrl]
  );

  if (existingAsset) {
    return;
  }

  await connection.query(
    'INSERT INTO media_assets (title, asset_type, url, source, folder_id) VALUES (?, "photo", ?, "exercise_archive", NULL)',
    [`${exercise.name} - old thumbnail`, exercise.imageUrl]
  );
}

router.get('/', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  const { search = '', muscleGroup = '', equipment = '', level = '' } = req.query;
  const filters = [];
  const values = [];

  if (search) {
    filters.push('(name LIKE ? OR muscle_group LIKE ? OR equipment LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (muscleGroup) {
    filters.push('muscle_group = ?');
    values.push(muscleGroup);
  }
  if (equipment) {
    filters.push('equipment = ?');
    values.push(equipment);
  }
  if (level) {
    filters.push('level = ?');
    values.push(level);
  }

  try {
    const connection = await pool.getConnection();
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await connection.query(
      `SELECT id, name, muscle_group AS muscleGroup, secondary_muscles AS secondaryMuscles,
              equipment, level, type, image_url AS imageUrl, video_url AS videoUrl,
              instructions, programs_count AS programsCount
       FROM exercises
       ${where}
       ORDER BY name`,
      values
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/filters', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [muscleGroups] = await connection.query('SELECT DISTINCT muscle_group AS value FROM exercises ORDER BY muscle_group');
    const [equipment] = await connection.query('SELECT DISTINCT equipment AS value FROM exercises ORDER BY equipment');
    const [levels] = await connection.query('SELECT DISTINCT level AS value FROM exercises ORDER BY level');
    const [types] = await connection.query('SELECT DISTINCT type AS value FROM exercises ORDER BY type');
    connection.release();
    res.json({ muscleGroups, equipment, levels, types });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authorizeRole(['coach', 'admin']), [
  body('name').optional().isString(),
  body('muscleGroup').optional().isString(),
  body('equipment').optional().isString(),
  body('level').optional().isString(),
  body('type').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Δεν αποθηκεύτηκε η άσκηση.', errors: errors.array() });
  }

  const {
    imageUrl, videoUrl, instructions, programsCount = 0
  } = req.body;
  const name = (req.body.name || 'Νέα Άσκηση').trim();
  const muscleGroup = (req.body.muscleGroup || 'Γενική').trim();
  const equipment = (req.body.equipment || 'Χωρίς εξοπλισμό').trim();
  const level = req.body.level || 'Μεσαίο';
  const type = req.body.type || 'Δύναμη';
  const secondaryMuscles = req.body.secondaryMuscles || null;

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO exercises
        (name, muscle_group, secondary_muscles, equipment, level, type,
         image_url, video_url, instructions, programs_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, muscleGroup, secondaryMuscles, equipment, level, type,
       imageUrl || null, videoUrl || null, instructions || null, programsCount]
    );

    const [rows] = await connection.query(
      `SELECT id, name, muscle_group AS muscleGroup, secondary_muscles AS secondaryMuscles,
              equipment, level, type, image_url AS imageUrl, video_url AS videoUrl,
              instructions, programs_count AS programsCount
       FROM exercises
       WHERE id = ?`,
      [result.insertId]
    );

    connection.release();
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.put('/:id', authorizeRole(['coach', 'admin']), [
  body('name').optional().notEmpty(),
  body('muscleGroup').optional().notEmpty(),
  body('equipment').optional().notEmpty(),
  body('level').optional().isString(),
  body('type').optional().notEmpty(),
  body('secondaryMuscles').optional({ nullable: true }).isString(),
  body('imageUrl').optional({ nullable: true }).isString(),
  body('videoUrl').optional({ nullable: true }).isString(),
  body('instructions').optional({ nullable: true }).isString(),
  body('programsCount').optional().isInt({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name, muscleGroup, secondaryMuscles, equipment, level, type,
    imageUrl, videoUrl, instructions, programsCount
  } = req.body;

  try {
    const connection = await pool.getConnection();
    await archiveCurrentExerciseImage(connection, req.params.id, imageUrl || null);

    await connection.query(
      `UPDATE exercises
       SET name = COALESCE(?, name),
           muscle_group = COALESCE(?, muscle_group),
           secondary_muscles = ?,
           equipment = COALESCE(?, equipment),
           level = COALESCE(?, level),
           type = COALESCE(?, type),
           image_url = ?,
           video_url = ?,
           instructions = ?,
           programs_count = COALESCE(?, programs_count)
       WHERE id = ?`,
      [
        name || null,
        muscleGroup || null,
        secondaryMuscles || null,
        equipment || null,
        level || null,
        type || null,
        imageUrl || null,
        videoUrl || null,
        instructions || null,
        programsCount ?? null,
        req.params.id,
      ]
    );

    const [rows] = await connection.query(
      `SELECT id, name, muscle_group AS muscleGroup, secondary_muscles AS secondaryMuscles,
              equipment, level, type, image_url AS imageUrl, video_url AS videoUrl,
              instructions, programs_count AS programsCount
       FROM exercises
       WHERE id = ?`,
      [req.params.id]
    );

    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Exercise not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/video', authorizeRole(['coach', 'admin']), [
  body('videoUrl').optional({ nullable: true }).isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE exercises SET video_url = ? WHERE id = ?', [req.body.videoUrl || null, req.params.id]);
    connection.release();
    res.json({ message: 'Video link updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/media', authorizeRole(['coach', 'admin']), [
  body('imageUrl').optional({ nullable: true }).isString(),
  body('videoUrl').optional({ nullable: true }).isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const connection = await pool.getConnection();
    await archiveCurrentExerciseImage(connection, req.params.id, req.body.imageUrl || null);
    await connection.query(
      'UPDATE exercises SET image_url = ?, video_url = ? WHERE id = ?',
      [req.body.imageUrl || null, req.body.videoUrl || null, req.params.id]
    );
    connection.release();
    res.json({
      message: 'Exercise media updated',
      imageUrl: req.body.imageUrl || null,
      videoUrl: req.body.videoUrl || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/image', authorizeRole(['coach', 'admin']), upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file required' });
  }

  const imageUrl = `/uploads/exercises/${req.file.filename}`;

  try {
    const connection = await pool.getConnection();
    await archiveCurrentExerciseImage(connection, req.params.id, imageUrl);
    await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [imageUrl, req.params.id]);
    connection.release();
    res.json({ message: 'Exercise image uploaded', imageUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM exercises WHERE id = ?', [req.params.id]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Exercise not found' });
    }

    res.json({ message: 'Exercise deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
