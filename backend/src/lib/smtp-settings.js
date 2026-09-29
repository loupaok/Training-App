import crypto from 'crypto';

const defaults = {
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: Number.parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  username: process.env.SMTP_USER || '',
  fromEmail: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  fromName: process.env.EMAIL_FROM_NAME || '',
};

function encryptionKey() {
  const secret = process.env.SMTP_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  return secret ? crypto.createHash('sha256').update(secret).digest() : null;
}

function encrypt(value) {
  const key = encryptionKey();
  if (!key) throw new Error('SMTP encryption key is not configured. Set SMTP_SETTINGS_ENCRYPTION_KEY or JWT_SECRET.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(value) {
  const key = encryptionKey();
  if (!key || !value) return '';
  const [ivValue, tagValue, encryptedValue] = String(value).split('.');
  if (!ivValue || !tagValue || !encryptedValue) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64')), decipher.final()]).toString('utf8');
}

export async function ensureSmtpSettingsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS smtp_settings (
      id TINYINT PRIMARY KEY,
      host VARCHAR(255) NOT NULL,
      port INT NOT NULL DEFAULT 587,
      secure BOOLEAN NOT NULL DEFAULT FALSE,
      username VARCHAR(255) NOT NULL DEFAULT '',
      password_encrypted TEXT NULL,
      from_email VARCHAR(255) NOT NULL DEFAULT '',
      from_name VARCHAR(255) NOT NULL DEFAULT '',
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function getRow(connection) {
  await ensureSmtpSettingsSchema(connection);
  const [rows] = await connection.query('SELECT * FROM smtp_settings WHERE id = 1 LIMIT 1');
  return rows[0] || null;
}

export async function getSmtpSettingsForAdmin(connection) {
  const row = await getRow(connection);
  return {
    host: row?.host || defaults.host,
    port: Number(row?.port || defaults.port),
    secure: row ? Boolean(row.secure) : defaults.secure,
    username: row?.username || defaults.username,
    fromEmail: row?.from_email || defaults.fromEmail,
    fromName: row?.from_name || defaults.fromName,
    hasPassword: Boolean(row?.password_encrypted || process.env.SMTP_PASS),
    updatedAt: row?.updated_at || null,
  };
}

export async function saveSmtpSettings(connection, values, userId) {
  const current = await getRow(connection);
  const password = String(values.password || '').trim();
  const passwordEncrypted = password ? encrypt(password) : current?.password_encrypted || null;
  await connection.query(
    `INSERT INTO smtp_settings (id, host, port, secure, username, password_encrypted, from_email, from_name, updated_by)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE host = VALUES(host), port = VALUES(port), secure = VALUES(secure),
       username = VALUES(username), password_encrypted = VALUES(password_encrypted),
       from_email = VALUES(from_email), from_name = VALUES(from_name), updated_by = VALUES(updated_by)`,
    [values.host.trim(), Number(values.port), values.secure ? 1 : 0, values.username.trim(), passwordEncrypted, values.fromEmail.trim(), values.fromName.trim(), userId],
  );
  return getSmtpSettingsForAdmin(connection);
}

export async function getRuntimeSmtpSettings(connection) {
  let ownConnection = false;
  if (!connection) {
    const { pool } = await import('../index.js');
    connection = await pool.getConnection();
    ownConnection = true;
  }
  try {
    const row = await getRow(connection);
    if (!row) return { ...defaults, password: process.env.SMTP_PASS || '' };
    return {
      host: row.host || defaults.host,
      port: Number(row.port || defaults.port),
      secure: Boolean(row.secure),
      username: row.username || defaults.username,
      password: decrypt(row.password_encrypted) || process.env.SMTP_PASS || '',
      fromEmail: row.from_email || row.username || defaults.fromEmail,
      fromName: row.from_name || defaults.fromName,
    };
  } finally {
    if (ownConnection) connection.release();
  }
}
