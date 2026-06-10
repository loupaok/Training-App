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

async function ensureExerciseImagesTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS exercise_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      exercise_id INT NOT NULL,
      image_url VARCHAR(600) NOT NULL,
      alt_text VARCHAR(255),
      sort_order INT DEFAULT 0,
      is_primary TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
      INDEX idx_exercise_id (exercise_id),
      INDEX idx_is_primary (is_primary)
    )
  `);

  await connection.query(`
    INSERT INTO exercise_images (exercise_id, image_url, sort_order, is_primary)
    SELECT e.id, e.image_url, 0, 1
    FROM exercises e
    WHERE e.image_url IS NOT NULL
      AND e.image_url <> ''
      AND NOT EXISTS (
        SELECT 1 FROM exercise_images ei
        WHERE ei.exercise_id = e.id AND ei.image_url = e.image_url
      )
  `);
}

async function addExerciseImage(connection, exerciseId, imageUrl, options = {}) {
  if (!imageUrl) return null;

  await ensureExerciseImagesTable(connection);
  const [[existing]] = await connection.query(
    'SELECT id FROM exercise_images WHERE exercise_id = ? AND image_url = ? LIMIT 1',
    [exerciseId, imageUrl]
  );

  const [[countRow]] = await connection.query(
    'SELECT COUNT(*) AS total FROM exercise_images WHERE exercise_id = ?',
    [exerciseId]
  );
  const isPrimary = Boolean(options.primary) || Number(countRow?.total || 0) === 0;

  if (isPrimary) {
    await connection.query('UPDATE exercise_images SET is_primary = 0 WHERE exercise_id = ?', [exerciseId]);
  }

  if (existing) {
    if (isPrimary) {
      await connection.query(
        'UPDATE exercise_images SET is_primary = 1 WHERE id = ?',
        [existing.id]
      );
      await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [imageUrl, exerciseId]);
    }
    return existing.id;
  }

  const [[sortRow]] = await connection.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextSort FROM exercise_images WHERE exercise_id = ?',
    [exerciseId]
  );
  const [result] = await connection.query(
    'INSERT INTO exercise_images (exercise_id, image_url, sort_order, is_primary) VALUES (?, ?, ?, ?)',
    [exerciseId, imageUrl, Number(sortRow?.nextSort || 0), isPrimary ? 1 : 0]
  );

  if (isPrimary) {
    await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [imageUrl, exerciseId]);
  }

  return result.insertId;
}

async function getExerciseImagesMap(connection, exerciseIds) {
  if (!exerciseIds.length) return new Map();

  await ensureExerciseImagesTable(connection);
  const [rows] = await connection.query(
    `SELECT id, exercise_id AS exerciseId, image_url AS imageUrl, alt_text AS altText,
            sort_order AS sortOrder, is_primary AS isPrimary
     FROM exercise_images
     WHERE exercise_id IN (?)
     ORDER BY is_primary DESC, sort_order ASC, id ASC`,
    [exerciseIds]
  );

  return rows.reduce((map, image) => {
    const list = map.get(image.exerciseId) || [];
    list.push({
      id: image.id,
      imageUrl: image.imageUrl,
      altText: image.altText || '',
      sortOrder: image.sortOrder || 0,
      isPrimary: Boolean(image.isPrimary),
    });
    map.set(image.exerciseId, list);
    return map;
  }, new Map());
}

function attachImages(rows, imagesMap) {
  return rows.map((row) => {
    const images = imagesMap.get(row.id) || [];
    return {
      ...row,
      images,
      imageUrls: images.map((image) => image.imageUrl),
    };
  });
}

async function archiveCurrentExerciseImage(connection, exerciseId, nextImageUrl) {
  const [[exercise]] = await connection.query(
    'SELECT name, image_url AS imageUrl FROM exercises WHERE id = ?',
    [exerciseId]
  );

  if (!exercise?.imageUrl || exercise.imageUrl === nextImageUrl) {
    return;
  }

  await addExerciseImage(connection, exerciseId, exercise.imageUrl);
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
    await ensureExerciseImagesTable(connection);
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
    const imagesMap = await getExerciseImagesMap(connection, rows.map((row) => row.id));
    connection.release();
    res.json(attachImages(rows, imagesMap));
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
    await ensureExerciseImagesTable(connection);
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
    if (imageUrl) {
      await addExerciseImage(connection, result.insertId, imageUrl, { primary: true });
    }
    const imagesMap = await getExerciseImagesMap(connection, [result.insertId]);

    connection.release();
    res.status(201).json(attachImages(rows, imagesMap)[0]);
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
    if (imageUrl) {
      await addExerciseImage(connection, req.params.id, imageUrl, { primary: true });
    }

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
    const imagesMap = await getExerciseImagesMap(connection, rows.map((row) => row.id));

    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Exercise not found' });
    }

    res.json(attachImages(rows, imagesMap)[0]);
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
    if (req.body.imageUrl) {
      await addExerciseImage(connection, req.params.id, req.body.imageUrl, { primary: true });
    }
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
    const imageId = await addExerciseImage(connection, req.params.id, imageUrl, { primary: true });
    connection.release();
    res.json({ message: 'Exercise image uploaded', imageId, imageUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/images', authorizeRole(['coach', 'admin']), [
  body('imageUrl').notEmpty().isString(),
  body('primary').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const connection = await pool.getConnection();
    const imageId = await addExerciseImage(connection, req.params.id, req.body.imageUrl, { primary: Boolean(req.body.primary) });
    const imagesMap = await getExerciseImagesMap(connection, [Number(req.params.id)]);
    connection.release();
    res.status(201).json({
      message: 'Exercise image added',
      imageId,
      images: imagesMap.get(Number(req.params.id)) || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/images/:imageId', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureExerciseImagesTable(connection);
    const [[image]] = await connection.query(
      'SELECT image_url AS imageUrl, is_primary AS isPrimary FROM exercise_images WHERE id = ? AND exercise_id = ?',
      [req.params.imageId, req.params.id]
    );

    if (!image) {
      connection.release();
      return res.status(404).json({ message: 'Image not found' });
    }

    await connection.query('DELETE FROM exercise_images WHERE id = ? AND exercise_id = ?', [req.params.imageId, req.params.id]);

    if (image.isPrimary) {
      const [[nextImage]] = await connection.query(
        'SELECT id, image_url AS imageUrl FROM exercise_images WHERE exercise_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1',
        [req.params.id]
      );
      if (nextImage) {
        await connection.query('UPDATE exercise_images SET is_primary = 1 WHERE id = ?', [nextImage.id]);
        await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [nextImage.imageUrl, req.params.id]);
      } else {
        await connection.query('UPDATE exercises SET image_url = NULL WHERE id = ?', [req.params.id]);
      }
    }

    const imagesMap = await getExerciseImagesMap(connection, [Number(req.params.id)]);
    connection.release();
    res.json({ message: 'Exercise image deleted', images: imagesMap.get(Number(req.params.id)) || [] });
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
