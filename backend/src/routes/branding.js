import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { removeUploadedFile, validateImageUpload } from '../utils/upload-security.js';

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
      ADD COLUMN IF NOT EXISTS login_background_url VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS login_logo_url VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS eshop_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS eshop_url VARCHAR(500) NULL,
      ADD COLUMN IF NOT EXISTS eshop_banner_title VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS eshop_banner_accent_text VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS eshop_banner_text VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS eshop_button_text VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS eshop_banner_image_url VARCHAR(255) NULL
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
    loginLogoUrl: row.login_logo_url,
    faviconUrl: row.favicon_url,
    loginBackgroundUrl: row.login_background_url,
    eshopEnabled: Boolean(row.eshop_enabled),
    eshopUrl: row.eshop_url,
    eshopBannerTitle: row.eshop_banner_title,
    eshopBannerAccentText: row.eshop_banner_accent_text,
    eshopBannerText: row.eshop_banner_text,
    eshopButtonText: row.eshop_button_text || 'Πήγαινε στο eshop',
    eshopBannerImageUrl: row.eshop_banner_image_url,
  };
}

async function getBranding(connection) {
  const [rows] = await connection.query('SELECT * FROM branding WHERE id = 1');
  return normalizeBranding(rows[0]);
}

function createUpload({ kind, maxSize, allowSvg = false }) {
  return multer({
    storage: multer.diskStorage({
      destination: brandingDirectory,
      filename: (_req, file, callback) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        callback(null, `${kind}${extension}`);
      },
    }),
    fileFilter: (req, file, callback) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      const isSvg = extension === '.svg';
      const allowedExtensions = isSvg && allowSvg && req.user?.role === 'admin'
        ? ['.svg']
        : ['.jpg', '.jpeg', '.png'];
      const allowedMimeTypes = isSvg && allowSvg && req.user?.role === 'admin'
        ? ['image/svg+xml']
        : ['image/jpeg', 'image/png'];

      if (!allowedExtensions.includes(extension) || !allowedMimeTypes.includes(file.mimetype)) {
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
  allowSvg: true,
}));
const uploadLoginLogo = uploadSingle(createUpload({
  kind: 'login-logo',
  maxSize: 2 * 1024 * 1024,
  allowSvg: true,
}));
const uploadFavicon = uploadSingle(createUpload({
  kind: 'favicon',
  maxSize: 512 * 1024,
  allowSvg: true,
}));
const uploadLoginBackground = uploadSingle(createUpload({
  kind: 'login-background',
  maxSize: 5 * 1024 * 1024,
}));
const uploadEshopBanner = uploadSingle(createUpload({
  kind: 'eshop-banner',
  maxSize: 5 * 1024 * 1024,
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
  body('eshopEnabled').optional().isBoolean(),
  body('eshopUrl').optional({ nullable: true }).isURL({ protocols: ['https'], require_protocol: true }),
  body('eshopBannerTitle').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('eshopBannerAccentText').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('eshopBannerText').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('eshopButtonText').optional({ nullable: true }).isString().isLength({ max: 100 }),
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
           button_color = ?, button_hover_color = ?, button_text_color = ?,
           eshop_enabled = ?, eshop_url = ?, eshop_banner_title = ?, eshop_banner_accent_text = ?,
           eshop_banner_text = ?, eshop_button_text = ?
       WHERE id = 1`,
      [
        req.body.appName,
        req.body.primaryColor,
        req.body.fontColor,
        req.body.titleColor,
        req.body.buttonColor,
        req.body.buttonHoverColor,
        req.body.buttonTextColor,
        req.body.eshopEnabled ? 1 : 0,
        req.body.eshopUrl || null,
        req.body.eshopBannerTitle || null,
        req.body.eshopBannerAccentText || null,
        req.body.eshopBannerText || null,
        req.body.eshopButtonText || 'Πήγαινε στο eshop',
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

  try {
    await validateImageUpload(req.file, { allowSvg: req.user.role === 'admin' });
  } catch (error) {
    await removeUploadedFile(req.file);
    return res.status(400).json({ message: error.message || 'Invalid branding image' });
  }

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
router.post('/login-logo', authenticateToken, authorizeRole(['coach']), uploadLoginLogo, (req, res) => saveBrandImage(req, res, 'login_logo_url'));
router.post('/favicon', authenticateToken, authorizeRole(['coach']), uploadFavicon, (req, res) => saveBrandImage(req, res, 'favicon_url'));
router.post('/login-background', authenticateToken, authorizeRole(['coach']), uploadLoginBackground, (req, res) => saveBrandImage(req, res, 'login_background_url'));
router.post('/eshop-banner', authenticateToken, authorizeRole(['coach']), uploadEshopBanner, (req, res) => saveBrandImage(req, res, 'eshop_banner_image_url'));

export default router;
