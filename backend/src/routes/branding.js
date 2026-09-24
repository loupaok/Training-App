import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const brandingDirectory = path.join(process.cwd(), 'uploads', 'media', 'branding');
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

fs.mkdirSync(brandingDirectory, { recursive: true });

export async function ensureBrandingSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS branding (
      id INT DEFAULT 1 PRIMARY KEY,
      app_name VARCHAR(100) DEFAULT 'CoachApp',
      primary_color VARCHAR(7) DEFAULT '#e74c3c',
      logo_url VARCHAR(255) NULL,
      favicon_url VARCHAR(255) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await connection.query(
    "INSERT IGNORE INTO branding (id, app_name, primary_color) VALUES (1, 'CoachApp', '#e74c3c')"
  );
  await connection.query(`
    ALTER TABLE branding
      ADD COLUMN IF NOT EXISTS font_color VARCHAR(7) DEFAULT '#1a1a2e',
      ADD COLUMN IF NOT EXISTS title_color VARCHAR(7) DEFAULT '#1a1a2e',
      ADD COLUMN IF NOT EXISTS button_color VARCHAR(7) DEFAULT '#e74c3c',
      ADD COLUMN IF NOT EXISTS button_hover_color VARCHAR(7) DEFAULT '#c0392b',
      ADD COLUMN IF NOT EXISTS button_text_color VARCHAR(7) DEFAULT '#ffffff',
      ADD COLUMN IF NOT EXISTS login_background_url VARCHAR(255) NULL
  `);
}

function normalizeBranding(row) {
  return {
    appName: row.app_name,
    primaryColor: row.primary_color,
    fontColor: row.font_color,
    titleColor: row.title_color,
    buttonColor: row.button_color,
    buttonHoverColor: row.button_hover_color,
    buttonTextColor: row.button_text_color,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    loginBackgroundUrl: row.login_background_url,
  };
}

async function getBranding(connection) {
  const [rows] = await connection.query('SELECT * FROM branding WHERE id = 1');
  return normalizeBranding(rows[0]);
}

function createUpload({ kind, maxSize, extensions, mimeTypes }) {
  return multer({
    storage: multer.diskStorage({
      destination: brandingDirectory,
      filename: (_req, file, callback) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        callback(null, `${kind}${extension}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      if (!extensions.includes(extension) || !mimeTypes.includes(file.mimetype)) {
        callback(new Error('Unsupported branding image type'));
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: maxSize },
  });
}

function uploadSingle(upload) {
  return (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (!error) return next();
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : error.message || 'Upload failed';
      return res.status(400).json({ message });
    });
  };
}

const uploadLogo = uploadSingle(createUpload({
  kind: 'logo',
  maxSize: 2 * 1024 * 1024,
  extensions: ['.jpg', '.jpeg', '.png', '.svg', '.webp'],
  mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
}));
const uploadFavicon = uploadSingle(createUpload({
  kind: 'favicon',
  maxSize: 512 * 1024,
  extensions: ['.png', '.ico', '.svg'],
  mimeTypes: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'],
}));
const uploadLoginBackground = uploadSingle(createUpload({
  kind: 'login-background',
  maxSize: 5 * 1024 * 1024,
  extensions: ['.jpg', '.jpeg', '.png', '.webp'],
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
}));

router.get('/', async (_req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await ensureBrandingSchema(connection);
    res.json(await getBranding(connection));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection?.release();
  }
});

router.put('/', authenticateToken, authorizeRole(['coach']), [
  body('appName').trim().isLength({ min: 1, max: 100 }),
  body('primaryColor').matches(hexColorPattern),
  body('fontColor').matches(hexColorPattern),
  body('titleColor').matches(hexColorPattern),
  body('buttonColor').matches(hexColorPattern),
  body('buttonHoverColor').matches(hexColorPattern),
  body('buttonTextColor').matches(hexColorPattern),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  let connection;
  try {
    connection = await pool.getConnection();
    await ensureBrandingSchema(connection);
    await connection.query(
      `UPDATE branding
       SET app_name = ?, primary_color = ?, font_color = ?, title_color = ?,
           button_color = ?, button_hover_color = ?, button_text_color = ?
       WHERE id = 1`,
      [
        req.body.appName,
        req.body.primaryColor,
        req.body.fontColor,
        req.body.titleColor,
        req.body.buttonColor,
        req.body.buttonHoverColor,
        req.body.buttonTextColor,
      ]
    );
    res.json(await getBranding(connection));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection?.release();
  }
});

async function saveBrandImage(req, res, column) {
  if (!req.file) return res.status(400).json({ message: 'Branding image is required' });

  let connection;
  try {
    connection = await pool.getConnection();
    await ensureBrandingSchema(connection);
    const url = `/uploads/media/branding/${req.file.filename}`;
    await connection.query(`UPDATE branding SET ${column} = ? WHERE id = 1`, [url]);
    return res.json(await getBranding(connection));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    connection?.release();
  }
}

router.post('/logo', authenticateToken, authorizeRole(['coach']), uploadLogo, (req, res) => saveBrandImage(req, res, 'logo_url'));
router.post('/favicon', authenticateToken, authorizeRole(['coach']), uploadFavicon, (req, res) => saveBrandImage(req, res, 'favicon_url'));
router.post('/login-background', authenticateToken, authorizeRole(['coach']), uploadLoginBackground, (req, res) => saveBrandImage(req, res, 'login_background_url'));

export default router;
