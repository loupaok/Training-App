import crypto from 'crypto';
import { pool } from '../index.js';

const SETTINGS_ID = 1;
const CACHE_TTL_MS = 30_000;
let cachedConfig = null;
let cacheExpiresAt = 0;

function encryptionKey() {
  return crypto
    .createHash('sha256')
    .update(process.env.DISCORD_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || 'discord-settings-local-key')
    .digest();
}

function encrypt(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(value) {
  if (!value) return null;
  try {
    const [iv, tag, encrypted] = String(value).split('.').map((part) => Buffer.from(part, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export async function ensureDiscordSettingsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS discord_settings (
      id TINYINT PRIMARY KEY,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      client_id VARCHAR(100) NULL,
      client_secret_encrypted TEXT NULL,
      bot_token_encrypted TEXT NULL,
      guild_id VARCHAR(100) NULL,
      redirect_uri VARCHAR(500) NULL,
      active_role_id VARCHAR(100) NULL,
      active_role_name VARCHAR(100) NULL,
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

function defaultConfig() {
  return {
    enabled: true,
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    botToken: process.env.DISCORD_BOT_TOKEN || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || '',
    activeRoleId: '',
    activeRoleName: 'Ενεργό Μέλος',
  };
}

async function loadDiscordConfig(connection) {
  await ensureDiscordSettingsSchema(connection);
  const [[row]] = await connection.query('SELECT * FROM discord_settings WHERE id = ?', [SETTINGS_ID]);
  const defaults = defaultConfig();
  if (!row) return defaults;
  return {
    enabled: Boolean(row.is_enabled),
    clientId: row.client_id || defaults.clientId,
    clientSecret: decrypt(row.client_secret_encrypted) || defaults.clientSecret,
    botToken: decrypt(row.bot_token_encrypted) || defaults.botToken,
    guildId: row.guild_id || defaults.guildId,
    redirectUri: row.redirect_uri || defaults.redirectUri,
    activeRoleId: row.active_role_id || defaults.activeRoleId,
    activeRoleName: row.active_role_name || defaults.activeRoleName,
  };
}

export async function getDiscordConfig() {
  if (cachedConfig && cacheExpiresAt > Date.now()) return cachedConfig;
  const connection = await pool.getConnection();
  try {
    cachedConfig = await loadDiscordConfig(connection);
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cachedConfig;
  } finally {
    connection.release();
  }
}

export function clearDiscordConfigCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

export async function getDiscordSettingsForAdmin(connection) {
  const config = await loadDiscordConfig(connection);
  const [[row]] = await connection.query('SELECT client_secret_encrypted, bot_token_encrypted, updated_at FROM discord_settings WHERE id = ?', [SETTINGS_ID]);
  return {
    enabled: config.enabled,
    clientId: config.clientId,
    guildId: config.guildId,
    redirectUri: config.redirectUri,
    activeRoleId: config.activeRoleId,
    activeRoleName: config.activeRoleName,
    hasClientSecret: Boolean(row?.client_secret_encrypted || process.env.DISCORD_CLIENT_SECRET),
    hasBotToken: Boolean(row?.bot_token_encrypted || process.env.DISCORD_BOT_TOKEN),
    updatedAt: row?.updated_at || null,
  };
}

export async function saveDiscordSettings(connection, input, updatedBy) {
  await ensureDiscordSettingsSchema(connection);
  const [[current]] = await connection.query('SELECT * FROM discord_settings WHERE id = ?', [SETTINGS_ID]);
  const clientSecret = String(input.clientSecret || '').trim();
  const botToken = String(input.botToken || '').trim();
  const values = {
    enabled: input.enabled === true ? 1 : 0,
    clientId: String(input.clientId || '').trim() || null,
    clientSecretEncrypted: clientSecret ? encrypt(clientSecret) : current?.client_secret_encrypted || null,
    botTokenEncrypted: botToken ? encrypt(botToken) : current?.bot_token_encrypted || null,
    guildId: String(input.guildId || '').trim() || null,
    redirectUri: String(input.redirectUri || '').trim() || null,
    activeRoleId: String(input.activeRoleId || '').trim() || null,
    activeRoleName: String(input.activeRoleName || '').trim() || 'Ενεργό Μέλος',
  };
  await connection.query(
    `INSERT INTO discord_settings
       (id, is_enabled, client_id, client_secret_encrypted, bot_token_encrypted, guild_id, redirect_uri, active_role_id, active_role_name, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       is_enabled = VALUES(is_enabled), client_id = VALUES(client_id), client_secret_encrypted = VALUES(client_secret_encrypted),
       bot_token_encrypted = VALUES(bot_token_encrypted), guild_id = VALUES(guild_id), redirect_uri = VALUES(redirect_uri),
       active_role_id = VALUES(active_role_id), active_role_name = VALUES(active_role_name), updated_by = VALUES(updated_by)`,
    [SETTINGS_ID, values.enabled, values.clientId, values.clientSecretEncrypted, values.botTokenEncrypted, values.guildId, values.redirectUri, values.activeRoleId, values.activeRoleName, updatedBy]
  );
  clearDiscordConfigCache();
  return getDiscordSettingsForAdmin(connection);
}
