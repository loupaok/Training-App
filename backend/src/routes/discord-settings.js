import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { clearDiscordRoleCache, getGuildRoles } from '../lib/discord.js';
import { ensureDiscordSettingsSchema, getDiscordSettingsForAdmin, saveDiscordSettings } from '../lib/discord-settings.js';

const router = express.Router();
router.use(authenticateToken, authorizeRole(['coach', 'admin']));

router.get('/', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureDiscordSettingsSchema(connection);
    res.json(await getDiscordSettingsForAdmin(connection));
  } catch (error) {
    console.error('Discord settings load failed:', error);
    res.status(500).json({ message: 'Could not load Discord settings.' });
  } finally {
    connection.release();
  }
});

router.put('/', [
  body('enabled').optional().toBoolean().isBoolean(),
  body('clientId').optional({ checkFalsy: true }).isString().trim(),
  body('clientSecret').optional().isString(),
  body('botToken').optional().isString(),
  body('guildId').optional({ checkFalsy: true }).isString().trim(),
  body('redirectUri').optional({ checkFalsy: true }).custom((value) => {
    try {
      const url = new URL(String(value).trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      throw new Error('Το Redirect URI πρέπει να είναι πλήρες URL, π.χ. https://app.example.com/discord/callback.');
    }
  }),
  body('activeRoleId').optional().isString().trim(),
  body('activeRoleName').optional().isString().trim().isLength({ max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((error) => `${error.path}: ${error.msg}`).join(' ');
    return res.status(400).json({ message: details, errors: errors.array() });
  }
  const connection = await pool.getConnection();
  try {
    const settings = await saveDiscordSettings(connection, req.body, req.user.id);
    clearDiscordRoleCache();
    res.json(settings);
  } catch (error) {
    console.error('Discord settings save failed:', error);
    res.status(500).json({ message: 'Could not save Discord settings.' });
  } finally {
    connection.release();
  }
});

router.get('/roles', async (req, res) => {
  try {
    const roles = await getGuildRoles();
    res.json((roles || []).map((role) => ({ id: role.id, name: role.name })).filter((role) => role.name !== '@everyone'));
  } catch (error) {
    console.error('Discord roles load failed:', error);
    res.status(502).json({ message: error.message || 'Could not connect to Discord.' });
  }
});

router.post('/test', async (req, res) => {
  try {
    const roles = await getGuildRoles();
    res.json({ success: true, rolesFound: roles?.length || 0 });
  } catch (error) {
    console.error('Discord connection test failed:', error);
    res.status(502).json({ message: error.message || 'Could not connect to Discord.' });
  }
});

export default router;
