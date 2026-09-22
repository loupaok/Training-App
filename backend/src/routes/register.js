import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { ensureAuthSchema, generateAccessToken, generateRefreshToken, setAuthCookies } from './auth.js';
import { getDefaultCoachId, notifyCoaches, ensureNotificationsSchema } from './clients.js';
import { ensureQuestionnaireSchema } from './questionnaire.js';
import { ensurePricingPlansSchema } from './pricingPlans.js';
import { sendMail } from '../lib/mailer.js';
import { logClientActivity } from '../lib/client-activity-log.js';

// Registration-time intake photos/PDF. The user doesn't exist yet when the
// upload arrives, so files are buffered in memory and only written to
// uploads/media/progress/{userId}/ once the transaction below has actually
// created that user — never to a path keyed on a not-yet-real id.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPhoto = file.fieldname === 'photos' && /^image\/(jpeg|png|webp)$/.test(file.mimetype);
    const isPdf = file.fieldname === 'pdf' && file.mimetype === 'application/pdf';
    (isPhoto || isPdf) ? cb(null, true) : cb(new Error('Only JPG/PNG/WEBP photos or a PDF are allowed'));
  },
});

async function ensureClientIntakeFilesSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS client_intake_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      file_url VARCHAR(255) NOT NULL,
      file_type ENUM('photo', 'pdf') NOT NULL,
      original_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_client_id (client_id)
    )
  `);
}

// New public registration flow — replaces POST /auth/register as the primary
// signup path (collects account details + questionnaire + plan + payment in
// one transactional call). The old /auth/register, /clients/me/onboarding and
// /clients/me/billing endpoints are left untouched for any in-progress client
// already partway through that older flow.

const router = express.Router();

const WEEKDAY_INDEX = {
  Κυριακή: 0,
  Δευτέρα: 1,
  Τρίτη: 2,
  Τετάρτη: 3,
  Πέμπτη: 4,
  Παρασκευή: 5,
  Σάββατο: 6,
};

function nextDateForWeekday(day) {
  const now = new Date();
  const currentDay = now.getDay();
  const diff = (Number(day) - currentDay + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().slice(0, 10);
}

router.post('/check-email', [body('email').isEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Μη έγκυρο email.' });

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT id FROM users WHERE email = ?', [req.body.email]);
    connection.release();
    res.json({ available: rows.length === 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/bank-details', (req, res) => {
  res.json({
    bankName: process.env.BANK_NAME || '',
    beneficiary: process.env.BANK_BENEFICIARY || process.env.BANK_NAME || '',
    iban: process.env.BANK_IBAN || '',
    supportEmail: process.env.BANK_SUPPORT_EMAIL || '',
    supportPhone: process.env.BANK_SUPPORT_PHONE || '',
  });
});

router.post('/register', upload.fields([{ name: 'photos', maxCount: 4 }, { name: 'pdf', maxCount: 1 }]), [
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('email').isEmail(),
  body('phone').notEmpty(),
  body('password').isLength({ min: 6 }),
  body('dateOfBirth').optional({ nullable: true, checkFalsy: true }).isString(),
  body('gender').optional({ nullable: true, checkFalsy: true }).isIn(['male', 'female', 'other']),
  body('plan_id').isInt(),
  body('payment_method').isIn(['bank', 'stripe']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    dateOfBirth,
    gender,
    plan_id: planId,
    payment_method: paymentMethod,
  } = req.body;

  // The wizard sends plain JSON when Step 3 (photos/PDF) was skipped, and
  // multipart/form-data — with `answers` as a JSON string alongside the
  // files — only when there's actually something to upload.
  let answers = [];
  try {
    answers = typeof req.body.answers === 'string' ? JSON.parse(req.body.answers) : (req.body.answers || []);
  } catch {
    return res.status(400).json({ message: 'Μη έγκυρες απαντήσεις.' });
  }
  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: 'Μη έγκυρες απαντήσεις.' });
  }

  const connection = await pool.getConnection();

  try {
    await ensureAuthSchema(connection);
    await ensureQuestionnaireSchema(connection);
    await ensurePricingPlansSchema(connection);
    await ensureNotificationsSchema(connection);
    await ensureClientIntakeFilesSchema(connection);

    const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'Το email χρησιμοποιείται ήδη.' });
    }

    const [planRows] = await connection.query(
      'SELECT * FROM pricing_plans WHERE id = ? AND is_active = 1 LIMIT 1',
      [planId]
    );
    if (!planRows.length) {
      connection.release();
      return res.status(400).json({ message: 'Μη έγκυρο πλάνο.' });
    }
    const plan = planRows[0];

    const [activeQuestions] = await connection.query('SELECT * FROM questionnaire_questions WHERE is_active = 1');
    const requiredIds = activeQuestions.filter((q) => q.is_required).map((q) => q.id);
    const answeredIds = new Set(
      (answers || [])
        .filter((a) => a && String(a.answer ?? '').trim() !== '')
        .map((a) => Number(a.question_id))
    );
    const missing = requiredIds.filter((id) => !answeredIds.has(id));
    if (missing.length) {
      connection.release();
      return res.status(400).json({ message: 'Λείπουν υποχρεωτικές απαντήσεις στο ερωτηματολόγιο.', missingQuestionIds: missing });
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.beginTransaction();

    const [userResult] = await connection.query(
      `INSERT INTO users (email, password, full_name, first_name, last_name, role, status, payment_method)
       VALUES (?, ?, ?, ?, ?, 'client', 'pending_payment', ?)`,
      [email, hashedPassword, fullName, firstName, lastName, paymentMethod === 'stripe' ? 'stripe' : 'bank']
    );
    const userId = userResult.insertId;

    await connection.query(
      `INSERT INTO clients (user_id, date_of_birth, gender, phone)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE date_of_birth = VALUES(date_of_birth), gender = VALUES(gender), phone = VALUES(phone)`,
      [userId, dateOfBirth || null, gender || null, phone]
    );

    for (const entry of answers || []) {
      if (!entry || entry.question_id === undefined) continue;
      const value = Array.isArray(entry.answer) ? JSON.stringify(entry.answer) : (entry.answer ?? '');
      await connection.query(
        'INSERT INTO questionnaire_answers (client_id, question_id, answer) VALUES (?, ?, ?)',
        [userId, entry.question_id, String(value)]
      );
    }

    const coachId = await getDefaultCoachId(connection);
    if (coachId) {
      await connection.query(
        `INSERT INTO coach_clients (coach_id, client_id, status) VALUES (?, ?, 'active')
         ON DUPLICATE KEY UPDATE status = 'active'`,
        [coachId, userId]
      );

      // Best-effort: seed the weekly update-day schedule from the multi-select
      // "when do you want to send your update" answer, taking the first
      // selected day since update_schedule only supports a single weekday.
      const scheduleQuestion = activeQuestions.find((q) => q.type === 'multi_select');
      const scheduleAnswer = scheduleQuestion
        ? (answers || []).find((a) => a && Number(a.question_id) === scheduleQuestion.id)
        : null;
      let dayOfWeek = 1;
      if (scheduleAnswer) {
        try {
          const parsed = typeof scheduleAnswer.answer === 'string' ? JSON.parse(scheduleAnswer.answer) : scheduleAnswer.answer;
          const first = Array.isArray(parsed) ? parsed[0] : parsed;
          if (first && WEEKDAY_INDEX[first] !== undefined) dayOfWeek = WEEKDAY_INDEX[first];
        } catch {
          // Malformed answer — keep the default day rather than fail the signup.
        }
      }

      await connection.query(
        `INSERT INTO update_schedule (coach_id, client_id, frequency, day_of_week, reminder_enabled, next_due_date)
         VALUES (?, ?, 'weekly', ?, 1, ?)
         ON DUPLICATE KEY UPDATE day_of_week = VALUES(day_of_week), reminder_enabled = 1, next_due_date = VALUES(next_due_date)`,
        [coachId, userId, dayOfWeek, nextDateForWeekday(dayOfWeek)]
      );
    }

    const startDate = new Date().toISOString().slice(0, 10);
    const endDateObj = new Date();
    endDateObj.setMonth(endDateObj.getMonth() + 1);
    const endDate = endDateObj.toISOString().slice(0, 10);

    const [subscriptionResult] = await connection.query(
      `INSERT INTO subscriptions (client_id, coach_id, plan_name, plan_type, price, currency, start_date, end_date, status, notes)
       VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?, 'active', ?)`,
      [
        userId,
        coachId,
        plan.name,
        plan.price,
        plan.currency || 'EUR',
        startDate,
        endDate,
        paymentMethod === 'stripe' ? 'Stripe selected - integration pending' : 'Bank transfer selected',
      ]
    );

    const referenceNumber = `REG-${String(userId).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;
    const [paymentResult] = await connection.query(
      `INSERT INTO payments (client_id, coach_id, subscription_id, amount, currency, method, status, reference_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        userId,
        coachId,
        subscriptionResult.insertId,
        plan.price,
        plan.currency || 'EUR',
        paymentMethod === 'stripe' ? 'stripe' : 'bank_transfer',
        referenceNumber,
        paymentMethod === 'stripe' ? 'Stripe integration pending.' : 'Αναμένεται τραπεζικό έμβασμα.',
      ]
    );

    await logClientActivity(connection, {
      clientId: userId,
      action: 'Client created',
      performedBy: coachId || userId,
      performedByName: coachId ? null : fullName,
      details: `Registered for plan: ${plan.name}`,
    });

    await notifyCoaches(connection, {
      clientId: userId,
      paymentId: paymentResult.insertId,
      type: 'payment_request_created',
      title: 'Νέα εγγραφή πελάτη',
      body: `${fullName} εγγράφηκε στο πλάνο ${plan.name} (${Number(plan.price).toFixed(2)} ${plan.currency || 'EUR'}, ${paymentMethod === 'stripe' ? 'Stripe' : 'Τραπεζικό έμβασμα'}).`,
      linkUrl: `/clients/${userId}`,
    });

    const user = { id: userId, email, role: 'client', status: 'pending_payment', full_name: fullName };
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await connection.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
    );

    await connection.commit();

    const uploadedPhotos = req.files?.photos || [];
    const uploadedPdf = req.files?.pdf || [];
    if (uploadedPhotos.length || uploadedPdf.length) {
      const dir = path.join('uploads', 'media', 'progress', String(userId));
      fs.mkdirSync(dir, { recursive: true });
      const fileRows = [];
      for (const file of [...uploadedPhotos, ...uploadedPdf]) {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        fs.writeFileSync(path.join(dir, filename), file.buffer);
        fileRows.push([
          userId,
          path.join(dir, filename).replace(/\\/g, '/'),
          file.fieldname === 'pdf' ? 'pdf' : 'photo',
          file.originalname,
        ]);
      }
      try {
        await connection.query(
          'INSERT INTO client_intake_files (client_id, file_url, file_type, original_name) VALUES ?',
          [fileRows]
        );
      } catch (fileError) {
        console.error('Failed to record intake files (files were saved to disk):', fileError);
      }
    }

    connection.release();

    setAuthCookies(res, accessToken, refreshToken);

    sendMail(
      email,
      'Καλωσόρισες!',
      `<p>Γεια σου ${firstName},</p><p>Η εγγραφή σου στο πλάνο <strong>${plan.name}</strong> ολοκληρώθηκε. Ο coach θα επικοινωνήσει μαζί σου εντός 24 ωρών για να επιβεβαιώσει την πληρωμή και να ενεργοποιήσει τον λογαριασμό σου.</p>`
    ).catch((error) => console.error('Failed to send registration confirmation email:', error));

    res.status(201).json({
      success: true,
      clientId: userId,
      message: 'Η εγγραφή ολοκληρώθηκε.',
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        fullName,
        role: 'client',
        status: 'pending_payment',
        onboardingCompleted: true,
      },
      redirectTo: '/register/success',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
