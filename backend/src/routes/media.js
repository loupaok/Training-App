import express from 'express';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

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

export default router;
