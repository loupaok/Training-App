import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const mediaUploadDir = path.join(process.cwd(), 'uploads', 'media');

fs.mkdirSync(mediaUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: mediaUploadDir,
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      cb(null, `media-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.mimetype));
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

async function ensureMediaTable(connection) {
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

  const [columns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'media_assets'
       AND COLUMN_NAME = 'folder_id'`
  );

  if (columns.length === 0) {
    await connection.query('ALTER TABLE media_assets ADD COLUMN folder_id INT NULL');
    await connection.query('ALTER TABLE media_assets ADD INDEX idx_folder_id (folder_id)');
  }
}

router.get('/', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);

    const [mediaRows] = await connection.query(
      `SELECT ma.id, ma.title, ma.asset_type AS assetType, ma.url, ma.source,
              ma.folder_id AS folderId, mf.name AS folderName, 'media_asset' AS kind
       FROM media_assets ma
       LEFT JOIN media_folders mf ON mf.id = ma.folder_id
       ORDER BY ma.updated_at DESC`
    );

    const [exerciseRows] = await connection.query(
      `SELECT id, name AS title, image_url AS url, 'photo' AS assetType,
              'exercise' AS source, CONCAT('Μυϊκή Ομάδα: ', muscle_group) AS folderName,
              CONCAT('muscle-', muscle_group) AS folderId, 'exercise_image' AS kind
       FROM exercises
       WHERE image_url IS NOT NULL AND image_url <> ''
       ORDER BY name`
    );

    connection.release();
    res.json([...mediaRows, ...exerciseRows]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/folders', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);

    const [folders] = await connection.query(
      `SELECT mf.id, mf.name, mf.parent_id AS parentId,
              (SELECT COUNT(*) FROM media_assets ma WHERE ma.folder_id = mf.id) AS itemCount
       FROM media_folders mf
       ORDER BY mf.name`
    );

    connection.release();
    res.json(folders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/folders', authorizeRole(['coach', 'admin']), [
  body('name').trim().notEmpty(),
  body('parentId').optional({ nullable: true }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);
    const [result] = await connection.query(
      'INSERT INTO media_folders (name, parent_id) VALUES (?, ?)',
      [req.body.name, req.body.parentId || null]
    );
    connection.release();
    res.status(201).json({ id: result.insertId, name: req.body.name, parentId: req.body.parentId || null, itemCount: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/folders/:id', authorizeRole(['coach', 'admin']), [
  body('name').trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);

    const [result] = await connection.query(
      'UPDATE media_folders SET name = ? WHERE id = ?',
      [req.body.name, req.params.id]
    );
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    res.json({ id: Number(req.params.id), name: req.body.name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Deleting a folder is non-destructive to its contents: both the assets filed
// directly in it and any child subfolders are moved up to its own parent
// (or to the root, if it had none) before the folder row itself is removed.
router.delete('/folders/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);

    const [[folder]] = await connection.query('SELECT parent_id AS parentId FROM media_folders WHERE id = ?', [req.params.id]);
    if (!folder) {
      connection.release();
      return res.status(404).json({ message: 'Folder not found' });
    }

    await connection.query('UPDATE media_assets SET folder_id = ? WHERE folder_id = ?', [folder.parentId, req.params.id]);
    await connection.query('UPDATE media_folders SET parent_id = ? WHERE parent_id = ?', [folder.parentId, req.params.id]);
    await connection.query('DELETE FROM media_folders WHERE id = ?', [req.params.id]);
    connection.release();

    res.json({ message: 'Folder deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/upload', authorizeRole(['coach', 'admin']), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Media file required' });
  }

  const title = req.body.title || req.file.originalname || 'Media asset';
  const assetType = req.body.assetType === 'icon' ? 'icon' : 'photo';
  const folderId = req.body.folderId || null;
  const url = `/uploads/media/${req.file.filename}`;

  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);
    const [result] = await connection.query(
      'INSERT INTO media_assets (title, asset_type, url, source, folder_id) VALUES (?, ?, ?, "upload", ?)',
      [title, assetType, url, folderId]
    );
    connection.release();
    res.status(201).json({ id: result.insertId, title, assetType, url, folderId, source: 'upload', kind: 'media_asset' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/assets/:id/folder', authorizeRole(['coach', 'admin']), [
  body('folderId').optional({ nullable: true }),
], async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);
    const [result] = await connection.query(
      'UPDATE media_assets SET folder_id = ? WHERE id = ?',
      [req.body.folderId || null, req.params.id]
    );
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    res.json({ message: 'Asset moved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/assets/bulk-move', authorizeRole(['coach', 'admin']), [
  body('ids').isArray({ min: 1 }),
  body('folderId').optional({ nullable: true }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);
    await connection.query(
      'UPDATE media_assets SET folder_id = ? WHERE id IN (?)',
      [req.body.folderId || null, req.body.ids]
    );
    connection.release();
    res.json({ message: 'Assets moved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:kind/:id', authorizeRole(['coach', 'admin']), [
  body('title').optional().isString(),
  body('url').optional({ nullable: true }).isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { kind, id } = req.params;
  const { title, url } = req.body;

  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);

    if (kind === 'exercise_image') {
      await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [url || null, id]);
      connection.release();
      return res.json({ message: 'Exercise image updated' });
    }

    await connection.query(
      `UPDATE media_assets SET title = COALESCE(?, title) WHERE id = ?`,
      [title || null, id]
    );
    connection.release();
    res.json({ message: 'Media asset updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:kind/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  const { kind, id } = req.params;

  try {
    const connection = await pool.getConnection();
    await ensureMediaTable(connection);

    if (kind === 'exercise_image') {
      await connection.query('UPDATE exercises SET image_url = NULL WHERE id = ?', [id]);
      connection.release();
      return res.json({ message: 'Exercise image removed' });
    }

    const [[asset]] = await connection.query('SELECT url FROM media_assets WHERE id = ?', [id]);
    await connection.query('DELETE FROM media_assets WHERE id = ?', [id]);
    connection.release();

    if (asset?.url?.startsWith('/uploads/media/')) {
      const filePath = path.join(process.cwd(), asset.url.replace(/^\//, ''));
      fs.unlink(filePath, () => {});
    }

    res.json({ message: 'Media asset deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
