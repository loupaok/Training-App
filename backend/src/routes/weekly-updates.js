import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';
import { notifyCoaches } from './clients.js';
import { sendMail } from '../lib/mailer.js';

const router = express.Router();

const UPDATE_QUESTION_TYPES = ['single_select', 'multi_select', 'text', 'number', 'textarea', 'url', 'rating', 'photos', 'pdf'];

const seedUpdateQuestions = [
  {
    question: 'Πώς ήταν η εβδομάδα σου;',
    type: 'rating',
    options: null,
    isRequired: true,
    placeholder: null,
    allowPhotos: false,
    maxPhotos: 4,
    allowPdf: false,
    sortOrder: 1,
  },
  {
    question: 'Τρέχον βάρος (kg);',
    type: 'number',
    options: null,
    isRequired: true,
    placeholder: 'π.χ. 82.5',
    allowPhotos: false,
    maxPhotos: 4,
    allowPdf: false,
    sortOrder: 2,
  },
  {
    question: 'Πώς πήγαν οι προπονήσεις;',
    type: 'rating',
    options: null,
    isRequired: true,
    placeholder: null,
    allowPhotos: false,
    maxPhotos: 4,
    allowPdf: false,
    sortOrder: 3,
  },
  {
    question: 'Πώς ήταν η διατροφή σου;',
    type: 'rating',
    options: null,
    isRequired: true,
    placeholder: null,
    allowPhotos: false,
    maxPhotos: 4,
    allowPdf: false,
    sortOrder: 4,
  },
  {
    question: 'Φωτογραφίες προόδου',
    type: 'photos',
    options: null,
    isRequired: false,
    placeholder: null,
    allowPhotos: true,
    maxPhotos: 4,
    allowPdf: false,
    sortOrder: 5,
  },
  {
    question: 'Σημειώσεις / Ερωτήσεις προς τον coach',
    type: 'textarea',
    options: null,
    isRequired: false,
    placeholder: 'Γράψε ό,τι θέλεις...',
    allowPhotos: false,
    maxPhotos: 4,
    allowPdf: false,
    sortOrder: 6,
  },
];

// weekly_updates/weekly_update_photos already existed (created by clientDashboard.js)
// with a fixed weight/training/nutrition-score schema and zero real submissions. This
// migrates that table to the flexible question/answer shape used here; the old photos
// table is left in place, orphaned, rather than dropped.
export async function ensureWeeklyUpdateSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS update_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      question TEXT NOT NULL,
      type ENUM('single_select', 'multi_select', 'text', 'number', 'textarea', 'url', 'rating', 'photos', 'pdf') NOT NULL,
      options JSON NULL,
      is_required BOOLEAN DEFAULT TRUE,
      placeholder VARCHAR(255) NULL,
      allow_photos BOOLEAN DEFAULT FALSE,
      max_photos INT DEFAULT 4,
      allow_pdf BOOLEAN DEFAULT FALSE,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_updates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      week_start DATE NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (client_id) REFERENCES users(id)
    )
  `);

  const [[isReadColumn]] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'weekly_updates' AND COLUMN_NAME = 'is_read'`
  );
  if (!isReadColumn) {
    await connection.query('ALTER TABLE weekly_updates ADD COLUMN is_read BOOLEAN DEFAULT FALSE');

    const [fkRows] = await connection.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'weekly_updates'
         AND COLUMN_NAME = 'coach_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    for (const fk of fkRows) {
      await connection.query(`ALTER TABLE weekly_updates DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
    }

    for (const column of ['weight_kg', 'training_score', 'nutrition_score', 'notes', 'coach_id']) {
      try {
        await connection.query(`ALTER TABLE weekly_updates DROP COLUMN ${column}`);
      } catch (error) {
        if (error.code !== 'ER_CANT_DROP_FIELD_OR_KEY' && error.code !== 'ER_BAD_FIELD_ERROR') throw error;
      }
    }
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_update_answers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      update_id INT NOT NULL,
      question_id INT NOT NULL,
      answer TEXT NULL,
      FOREIGN KEY (update_id) REFERENCES weekly_updates(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES update_questions(id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_update_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      update_id INT NOT NULL,
      question_id INT NULL,
      file_url VARCHAR(255) NOT NULL,
      file_type ENUM('photo', 'pdf') NOT NULL,
      original_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (update_id) REFERENCES weekly_updates(id) ON DELETE CASCADE
    )
  `);

  const [rows] = await connection.query('SELECT COUNT(*) AS total FROM update_questions');
  if (Number(rows[0]?.total || 0) === 0) {
    await connection.query(
      `INSERT INTO update_questions
        (question, type, options, is_required, placeholder, allow_photos, max_photos, allow_pdf, sort_order, is_active)
       VALUES ?`,
      [seedUpdateQuestions.map((q) => [
        q.question,
        q.type,
        q.options ? JSON.stringify(q.options) : null,
        q.isRequired ? 1 : 0,
        q.placeholder,
        q.allowPhotos ? 1 : 0,
        q.maxPhotos,
        q.allowPdf ? 1 : 0,
        q.sortOrder,
        1,
      ])]
    );
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('uploads', 'media', 'progress', String(req.user.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()) && /^image\//.test(file.mimetype);
    const isPdf = file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf';
    (isImage || isPdf) ? cb(null, true) : cb(new Error('Only image or PDF files are allowed'));
  },
});

function normalizeQuestion(row) {
  let options = [];
  try {
    options = typeof row.options === 'string' ? JSON.parse(row.options || '[]') : (row.options || []);
  } catch {
    options = [];
  }

  return {
    id: row.id,
    question: row.question,
    type: row.type,
    options,
    isRequired: Boolean(row.is_required),
    placeholder: row.placeholder || '',
    allowPhotos: Boolean(row.allow_photos),
    maxPhotos: row.max_photos,
    allowPdf: Boolean(row.allow_pdf),
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
  };
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  return toLocalDateString(current);
}

function isUpdateDay(schedule) {
  if (!schedule || schedule.day_of_week === undefined || schedule.day_of_week === null) return false;
  return Number(schedule.day_of_week) === new Date().getDay();
}

function nextDateForWeekday(day) {
  const now = new Date();
  const currentDay = now.getDay();
  const diff = (Number(day) - currentDay + 7) % 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return toLocalDateString(next);
}

// Matches the same question-stem heuristic used by the coach updates page
// (frontend/components/pages/coach-updates-page.tsx) so the email summary
// and the dashboard cards agree on which rating is which.
function buildQuickStatsSummary(answers, questions) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const parts = [];
  for (const entry of answers) {
    const question = questionById.get(Number(entry.question_id));
    if (!question || !entry.answer) continue;
    if (question.type === 'number') {
      parts.push(`⚖️ ${entry.answer}kg`);
    } else if (question.type === 'rating') {
      const text = question.question || '';
      if (text.includes('προπον')) parts.push(`🏋️⭐${entry.answer}/5`);
      else if (text.includes('διατροφ')) parts.push(`🥗⭐${entry.answer}/5`);
      else parts.push(`⭐ ${entry.answer}/5`);
    }
  }
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Client endpoints
// ---------------------------------------------------------------------------

router.get('/questions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const [rows] = await connection.query('SELECT * FROM update_questions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
    connection.release();
    res.json(rows.map(normalizeQuestion));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Coach only — every question, active + inactive, for the admin builder.
router.get('/questions/manage', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const [rows] = await connection.query('SELECT * FROM update_questions ORDER BY sort_order ASC, id ASC');
    connection.release();
    res.json(rows.map(normalizeQuestion));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/questions/reorder', authorizeRole(['coach', 'admin']), [
  body('ids').isArray({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const { ids } = req.body;
    for (let index = 0; index < ids.length; index += 1) {
      await connection.query('UPDATE update_questions SET sort_order = ? WHERE id = ?', [index, ids[index]]);
    }
    connection.release();
    res.json({ message: 'Questions reordered' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/questions', authorizeRole(['coach', 'admin']), [
  body('question').notEmpty(),
  body('type').isIn(UPDATE_QUESTION_TYPES),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);

    const [result] = await connection.query(
      `INSERT INTO update_questions
        (question, type, options, is_required, placeholder, allow_photos, max_photos, allow_pdf, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.question,
        req.body.type,
        req.body.options ? JSON.stringify(req.body.options) : null,
        req.body.isRequired === false ? 0 : 1,
        req.body.placeholder || null,
        req.body.allowPhotos === true ? 1 : 0,
        req.body.maxPhotos || 4,
        req.body.allowPdf === true ? 1 : 0,
        req.body.sortOrder || 0,
        req.body.isActive === false ? 0 : 1,
      ]
    );

    const [rows] = await connection.query('SELECT * FROM update_questions WHERE id = ?', [result.insertId]);
    connection.release();
    res.status(201).json(normalizeQuestion(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/questions/:id', authorizeRole(['coach', 'admin']), [
  body('question').notEmpty(),
  body('type').isIn(UPDATE_QUESTION_TYPES),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);

    await connection.query(
      `UPDATE update_questions
       SET question = ?, type = ?, options = ?, is_required = ?, placeholder = ?, allow_photos = ?, max_photos = ?, allow_pdf = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [
        req.body.question,
        req.body.type,
        req.body.options ? JSON.stringify(req.body.options) : null,
        req.body.isRequired === false ? 0 : 1,
        req.body.placeholder || null,
        req.body.allowPhotos === true ? 1 : 0,
        req.body.maxPhotos || 4,
        req.body.allowPdf === true ? 1 : 0,
        req.body.sortOrder || 0,
        req.body.isActive === false ? 0 : 1,
        req.params.id,
      ]
    );

    const [rows] = await connection.query('SELECT * FROM update_questions WHERE id = ?', [req.params.id]);
    connection.release();
    if (!rows.length) return res.status(404).json({ message: 'Question not found' });
    res.json(normalizeQuestion(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/questions/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    await connection.query('DELETE FROM update_questions WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/can-submit/:clientId', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const [scheduleRows] = await connection.query(
      'SELECT * FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      [req.params.clientId]
    );
    const schedule = scheduleRows[0] || null;
    const weekStart = getWeekStart();
    const [existing] = await connection.query(
      'SELECT id FROM weekly_updates WHERE client_id = ? AND week_start = ?',
      [req.params.clientId, weekStart]
    );
    connection.release();

    const alreadySubmittedThisWeek = existing.length > 0;
    const nextSubmitDate = schedule && schedule.day_of_week !== undefined && schedule.day_of_week !== null
      ? nextDateForWeekday(schedule.day_of_week)
      : null;

    res.json({
      canSubmit: isUpdateDay(schedule) && !alreadySubmittedThisWeek,
      nextSubmitDate,
      alreadySubmittedThisWeek,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/submit', authorizeRole(['client']), upload.array('files', 12), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureWeeklyUpdateSchema(connection);

    let answers = [];
    try {
      answers = req.body.answers ? JSON.parse(req.body.answers) : [];
    } catch {
      connection.release();
      return res.status(400).json({ message: 'Μη έγκυρες απαντήσεις.' });
    }
    let fileQuestionIds = [];
    try {
      fileQuestionIds = req.body.fileQuestionIds ? JSON.parse(req.body.fileQuestionIds) : [];
    } catch {
      fileQuestionIds = [];
    }

    const [scheduleRows] = await connection.query(
      'SELECT * FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      [req.user.id]
    );
    const schedule = scheduleRows[0] || null;
    if (!isUpdateDay(schedule)) {
      connection.release();
      return res.status(403).json({ message: 'Το εβδομαδιαίο update ανοίγει μόνο την ημέρα που έχει επιλεγεί.' });
    }

    const weekStart = getWeekStart();
    const [existing] = await connection.query(
      'SELECT id FROM weekly_updates WHERE client_id = ? AND week_start = ?',
      [req.user.id, weekStart]
    );
    if (existing.length) {
      connection.release();
      return res.status(400).json({ message: 'Το update αυτής της εβδομάδας έχει ήδη υποβληθεί.' });
    }

    const [activeQuestions] = await connection.query('SELECT * FROM update_questions WHERE is_active = 1');
    const requiredIds = activeQuestions.filter((q) => q.is_required).map((q) => q.id);
    const answeredIds = new Set(
      answers.filter((a) => a && String(a.answer ?? '').trim() !== '').map((a) => Number(a.question_id))
    );
    const missing = requiredIds.filter((id) => !answeredIds.has(id));
    if (missing.length) {
      connection.release();
      return res.status(400).json({ message: 'Λείπουν υποχρεωτικές απαντήσεις.', missingQuestionIds: missing });
    }

    await connection.beginTransaction();

    const [result] = await connection.query('INSERT INTO weekly_updates (client_id, week_start) VALUES (?, ?)', [req.user.id, weekStart]);
    const updateId = result.insertId;

    for (const entry of answers) {
      if (!entry || entry.question_id === undefined) continue;
      const value = Array.isArray(entry.answer) || (entry.answer && typeof entry.answer === 'object')
        ? JSON.stringify(entry.answer)
        : (entry.answer ?? '');
      await connection.query(
        'INSERT INTO weekly_update_answers (update_id, question_id, answer) VALUES (?, ?, ?)',
        [updateId, entry.question_id, String(value)]
      );
    }

    if (req.files?.length) {
      await connection.query(
        'INSERT INTO weekly_update_files (update_id, question_id, file_url, file_type, original_name) VALUES ?',
        [req.files.map((file, index) => [
          updateId,
          fileQuestionIds[index] || null,
          file.path.replace(/\\/g, '/'),
          file.mimetype === 'application/pdf' ? 'pdf' : 'photo',
          file.originalname,
        ])]
      );
    }

    const [userRows] = await connection.query('SELECT full_name, email FROM users WHERE id = ?', [req.user.id]);
    const clientName = userRows[0]?.full_name || userRows[0]?.email || 'Πελάτης';

    await connection.commit();
    connection.release();

    try {
      const notifyConn = await pool.getConnection();
      await notifyCoaches(notifyConn, {
        clientId: req.user.id,
        type: 'new_update',
        title: 'Νέο εβδομαδιαίο update',
        body: `${clientName} υπέβαλε το εβδομαδιαίο update του.`,
        linkUrl: `/coach/updates?id=${updateId}`,
      });
      const [coachRows] = await notifyConn.query("SELECT email FROM users WHERE role IN ('admin', 'coach') AND is_active = 1");
      notifyConn.release();

      const submittedAt = new Date().toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' });
      const quickStats = buildQuickStatsSummary(answers, activeQuestions);
      const updatesLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/coach/updates?id=${updateId}`;

      coachRows.forEach((coach) => {
        sendMail(
          coach.email,
          `Νέο update από ${clientName}`,
          `<p>Ο πελάτης <strong>${clientName}</strong> υπέβαλε νέο εβδομαδιαίο update στις ${submittedAt}.</p>` +
            (quickStats ? `<p>${quickStats}</p>` : '') +
            `<p><a href="${updatesLink}">Δείτε το update →</a></p>`
        ).catch((error) => console.error('Failed to send update notification email:', error));
      });
    } catch (notifyError) {
      console.error('Failed to notify coaches of new update:', notifyError);
    }

    res.status(201).json({ message: 'Το update υποβλήθηκε.', updateId });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Coach endpoints
// ---------------------------------------------------------------------------

async function attachAnswersAndFiles(connection, updates) {
  if (!updates.length) return updates;
  const ids = updates.map((u) => u.id);
  const [answerRows] = await connection.query(
    `SELECT wa.update_id, wa.question_id, wa.answer, q.question, q.type
     FROM weekly_update_answers wa
     JOIN update_questions q ON q.id = wa.question_id
     WHERE wa.update_id IN (?)`,
    [ids]
  );
  const [fileRows] = await connection.query(
    'SELECT update_id, question_id, file_url, file_type, original_name FROM weekly_update_files WHERE update_id IN (?)',
    [ids]
  );

  return updates.map((update) => ({
    ...update,
    answers: answerRows.filter((row) => row.update_id === update.id),
    files: fileRows.filter((row) => row.update_id === update.id),
  }));
}

router.get('/stats', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);

    const [[unreadRow]] = await connection.query('SELECT COUNT(*) AS total FROM weekly_updates WHERE is_read = 0');

    const weekStart = getWeekStart();
    const todayDow = new Date().getDay();
    const mappedToday = todayDow === 0 ? 7 : todayDow;

    const [clientRows] = await connection.query(
      `SELECT u.id, u.full_name, u.email, us.day_of_week
       FROM users u
       JOIN coach_clients cc ON cc.client_id = u.id AND cc.status = 'active'
       JOIN update_schedule us ON us.client_id = u.id
       WHERE u.role = 'client' AND u.is_active = 1
         AND NOT EXISTS (SELECT 1 FROM weekly_updates wu WHERE wu.client_id = u.id AND wu.week_start = ?)`,
      [weekStart]
    );

    const pendingClients = clientRows.filter((client) => {
      const mappedDay = Number(client.day_of_week) === 0 ? 7 : Number(client.day_of_week);
      return mappedDay <= mappedToday;
    });

    connection.release();
    res.json({
      totalUnread: Number(unreadRow?.total || 0),
      pendingClients: pendingClients.map((client) => ({ id: client.id, fullName: client.full_name, email: client.email, dayOfWeek: client.day_of_week })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const filters = [];
    const values = [];
    if (req.query.clientId) {
      filters.push('w.client_id = ?');
      values.push(req.query.clientId);
    }
    if (req.query.unreadOnly === 'true') {
      filters.push('w.is_read = 0');
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [[{ total }]] = await connection.query(`SELECT COUNT(*) AS total FROM weekly_updates w ${whereClause}`, values);
    const [rows] = await connection.query(
      `SELECT w.id, w.client_id, w.submitted_at, DATE_FORMAT(w.week_start, '%Y-%m-%d') AS week_start, w.is_read,
              u.full_name AS client_name, u.email AS client_email, u.profile_photo AS client_photo
       FROM weekly_updates w
       JOIN users u ON u.id = w.client_id
       ${whereClause}
       ORDER BY w.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    const withAnswers = await attachAnswersAndFiles(connection, rows);
    connection.release();

    res.json({
      updates: withAnswers,
      page,
      limit,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);

    const [rows] = await connection.query(
      `SELECT w.id, w.client_id, w.submitted_at, DATE_FORMAT(w.week_start, '%Y-%m-%d') AS week_start, w.is_read,
              u.full_name AS client_name, u.email AS client_email, u.profile_photo AS client_photo
       FROM weekly_updates w
       JOIN users u ON u.id = w.client_id
       WHERE w.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      connection.release();
      return res.status(404).json({ message: 'Update not found' });
    }

    const [withAnswers] = await attachAnswersAndFiles(connection, rows);
    connection.release();
    res.json(withAnswers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/read', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const isRead = req.body.isRead !== false;
    await connection.query('UPDATE weekly_updates SET is_read = ? WHERE id = ?', [isRead ? 1 : 0, req.params.id]);
    connection.release();
    res.json({ message: 'Ενημερώθηκε.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
