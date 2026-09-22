import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { sendMail } from '../lib/mailer.js';

const router = express.Router();

const cronSeeds = [
  ['update_reminder', 'Υπενθυμίσεις Update', 'Στέλνει email υπενθύμιση στους πελάτες που έχουν update σήμερα και δεν έχουν στείλει ακόμα.', 9, 0],
  ['subscription_expiry', 'Υπενθυμίσεις Λήξης Συνδρομής', 'Στέλνει email στους πελάτες που η συνδρομή λήγει σε 7 ημέρες.', 8, 0],
  ['subscription_status', 'Ενημέρωση Κατάστασης Συνδρομών', 'Ελέγχει και ενημερώνει αυτόματα το status όλων των συνδρομών.', 0, 0],
];

const emailTemplateSeeds = [
  [
    'update_reminder',
    'Υπενθύμιση Update',
    'Είναι η ώρα του update σου!',
    'Γεια {{clientName}},\n\nΣήμερα είναι η μέρα του εβδομαδιαίου update σου.\nΜπες στην εφαρμογή και στείλε το update σου!\n\n{{submitUrl}}',
    JSON.stringify(['clientName', 'submitUrl', 'coachName']),
  ],
  [
    'registration',
    'Επιβεβαίωση Εγγραφής',
    'Καλώς ήρθες! Η εγγραφή σου ολοκληρώθηκε',
    'Γεια {{clientName}},\n\nΗ εγγραφή σου ολοκληρώθηκε!\nΕπιλεγμένο πλάνο: {{planName}}\n\nΟ coach θα επικοινωνήσει εντός 24 ωρών.',
    JSON.stringify(['clientName', 'planName', 'coachName']),
  ],
  [
    'subscription_expiry',
    'Λήξη Συνδρομής',
    'Η συνδρομή σου λήγει σε {{daysLeft}} ημέρες',
    'Γεια {{clientName}},\n\nΗ συνδρομή σου λήγει σε {{daysLeft}} ημέρες.\nΑνανέωσε έγκαιρα για να συνεχίσεις!\n\n{{renewUrl}}',
    JSON.stringify(['clientName', 'daysLeft', 'renewUrl']),
  ],
  [
    'update_notification',
    'Νέο Update (προς Coach)',
    'Νέο update από {{clientName}}',
    'Ο/Η {{clientName}} έστειλε εβδομαδιαίο update.\n\nΒάρος: {{weight}}kg\nΠροπόνηση: {{trainingScore}}/5\nΔιατροφή: {{nutritionScore}}/5\n\n{{updateUrl}}',
    JSON.stringify(['clientName', 'weight', 'trainingScore', 'nutritionScore', 'updateUrl']),
  ],
];

export async function ensureSettingsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS cron_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_key VARCHAR(50) UNIQUE NOT NULL,
      job_name VARCHAR(150) NOT NULL,
      description TEXT,
      hour INT DEFAULT 9,
      minute INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      last_run TIMESTAMP NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_key VARCHAR(50) UNIQUE NOT NULL,
      template_name VARCHAR(150) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      variables JSON,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.query(
    `INSERT IGNORE INTO cron_settings (job_key, job_name, description, hour, minute)
     VALUES ?`,
    [cronSeeds]
  );
  await connection.query(
    `INSERT IGNORE INTO email_templates (template_key, template_name, subject, body, variables)
     VALUES ?`,
    [emailTemplateSeeds]
  );
}

function normalizeVariables(variables) {
  try {
    return typeof variables === 'string' ? JSON.parse(variables || '[]') : variables || [];
  } catch {
    return [];
  }
}

function normalizeCron(row) {
  return {
    jobKey: row.job_key,
    jobName: row.job_name,
    description: row.description || '',
    hour: Number(row.hour),
    minute: Number(row.minute),
    isActive: Boolean(row.is_active),
    lastRun: row.last_run,
    updatedAt: row.updated_at,
  };
}

function normalizeEmailTemplate(row) {
  return {
    key: row.template_key,
    name: row.template_name,
    subject: row.subject,
    body: row.body,
    variables: normalizeVariables(row.variables),
    updatedAt: row.updated_at,
  };
}

function renderTestTemplate(value) {
  const variables = {
    clientName: 'Δοκιμαστικός Πελάτης',
    coachName: 'CoachApp',
    submitUrl: 'https://example.com/client-dashboard',
    planName: 'Βασικό',
    daysLeft: '7',
    renewUrl: 'https://example.com/client-billing',
    weight: '75',
    trainingScore: '4',
    nutritionScore: '4',
    updateUrl: 'https://example.com/updates',
  };

  return String(value || '').replace(/\{\{([^}]+)\}\}/g, (_, key) => variables[key.trim()] || `{{${key}}}`);
}

router.use(authenticateToken, authorizeRole(['coach']));

router.get('/crons', async (_req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureSettingsSchema(connection);
    const [rows] = await connection.query('SELECT * FROM cron_settings ORDER BY id ASC');
    res.json(rows.map(normalizeCron));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.put('/crons/:jobKey', [
  body('hour').isInt({ min: 0, max: 23 }),
  body('minute').isInt({ min: 0, max: 59 }),
  body('isActive').isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    await ensureSettingsSchema(connection);
    const [result] = await connection.query(
      `UPDATE cron_settings
       SET hour = ?, minute = ?, is_active = ?
       WHERE job_key = ?`,
      [Number(req.body.hour), Number(req.body.minute), req.body.isActive ? 1 : 0, req.params.jobKey]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Cron setting not found' });

    const { rescheduleJob } = await import('../crons.js');
    await rescheduleJob(
      req.params.jobKey,
      Number(req.body.hour),
      Number(req.body.minute),
      req.body.isActive,
      connection
    );

    const [rows] = await connection.query('SELECT * FROM cron_settings WHERE job_key = ? LIMIT 1', [req.params.jobKey]);
    res.json(normalizeCron(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.get('/email-templates', async (_req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureSettingsSchema(connection);
    const [rows] = await connection.query('SELECT * FROM email_templates ORDER BY id ASC');
    res.json(rows.map(normalizeEmailTemplate));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.put('/email-templates/:key', [
  body('subject').trim().notEmpty().isLength({ max: 255 }),
  body('body').isString().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    await ensureSettingsSchema(connection);
    const [result] = await connection.query(
      'UPDATE email_templates SET subject = ?, body = ? WHERE template_key = ?',
      [req.body.subject.trim(), req.body.body, req.params.key]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Email template not found' });

    const [rows] = await connection.query('SELECT * FROM email_templates WHERE template_key = ? LIMIT 1', [req.params.key]);
    res.json(normalizeEmailTemplate(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.post('/email-templates/test', [
  body('templateKey').trim().notEmpty(),
  body('testEmail').isEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const connection = await pool.getConnection();
  try {
    await ensureSettingsSchema(connection);
    const [rows] = await connection.query('SELECT * FROM email_templates WHERE template_key = ? LIMIT 1', [req.body.templateKey]);
    if (!rows.length) return res.status(404).json({ message: 'Email template not found' });

    const template = normalizeEmailTemplate(rows[0]);
    const subject = renderTestTemplate(template.subject);
    const html = `<div style="font-family:Arial,sans-serif;white-space:pre-line">${renderTestTemplate(template.body)}</div>`;
    const result = await sendMail({ to: req.body.testEmail, subject, html });
    res.json({ message: result?.skipped ? 'Email is not configured' : 'Test email sent', skipped: Boolean(result?.skipped) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to send test email' });
  } finally {
    connection.release();
  }
});

export default router;
