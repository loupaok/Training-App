import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

const QUESTION_TYPES = ['single_select', 'multi_select', 'text', 'number', 'textarea', 'url'];
// A "standard field" is a question the app relies on for a specific meaning
// (e.g. reading which day a client wants their weekly update) — at most one
// question can hold a given key, so consumers can look it up reliably
// instead of guessing by question type.
const UPDATE_DAY_OPTIONS = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
const UPDATE_DAY_QUESTION = 'Ημέρα Update';

function parseOptions(value) {
  try {
    return Array.isArray(value) ? value : JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function isLegacyUpdateDayQuestion(row) {
  const options = parseOptions(row.options);
  return options.length === UPDATE_DAY_OPTIONS.length
    && UPDATE_DAY_OPTIONS.every((day) => options.includes(day));
}

const seedQuestions = [
  {
    question: 'Ποιος είναι ο κύριος στόχος σου;',
    type: 'single_select',
    options: ['Απώλεια λίπους', 'Αύξηση μυϊκής μάζας', 'Γράμμωση', 'Βελτίωση αντοχής', 'Υγεία & ευεξία'],
    isRequired: true,
    placeholder: null,
    sortOrder: 1,
  },
  {
    question: 'Ποιο είναι το επίπεδό σου;',
    type: 'single_select',
    options: ['Αρχάριος (0-1 χρόνια)', 'Μέτριος (1-3 χρόνια)', 'Προχωρημένος (3+ χρόνια)'],
    isRequired: true,
    placeholder: null,
    sortOrder: 2,
  },
  {
    question: 'Πόσες μέρες μπορείς να προπονηθείς;',
    type: 'single_select',
    options: ['2 μέρες', '3 μέρες', '4 μέρες', '5 μέρες', '6 μέρες'],
    isRequired: true,
    placeholder: null,
    sortOrder: 3,
  },
  {
    question: 'Έχεις πρόσβαση σε γυμναστήριο;',
    type: 'single_select',
    options: ['Ναι, γυμναστήριο', 'Home gym', 'Όχι, bodyweight μόνο'],
    isRequired: true,
    placeholder: null,
    sortOrder: 4,
  },
  {
    question: 'Έχεις τραυματισμούς ή προβλήματα υγείας;',
    type: 'textarea',
    options: null,
    isRequired: false,
    placeholder: 'Περίγραψε αν υπάρχουν...',
    sortOrder: 5,
  },
  {
    question: 'Ποιο είναι το τρέχον βάρος σου (kg);',
    type: 'number',
    options: null,
    isRequired: true,
    placeholder: 'π.χ. 80',
    sortOrder: 6,
  },
  {
    question: 'Ποιο είναι το ύψος σου (cm);',
    type: 'number',
    options: null,
    isRequired: true,
    placeholder: 'π.χ. 175',
    sortOrder: 7,
  },
  {
    question: 'Έχεις διατροφικούς περιορισμούς ή αλλεργίες;',
    type: 'textarea',
    options: null,
    isRequired: false,
    placeholder: 'π.χ. χορτοφαγία, γλουτένη...',
    sortOrder: 8,
  },
  {
    question: 'Πότε θέλεις να στέλνεις το εβδομαδιαίο update;',
    type: 'multi_select',
    options: ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'],
    isRequired: true,
    placeholder: null,
    sortOrder: 9,
  },
  {
    question: 'Πώς μας βρήκες;',
    type: 'single_select',
    options: ['Instagram', 'TikTok', 'Google', 'Φίλος/Γνωστός', 'Άλλο'],
    isRequired: false,
    placeholder: null,
    sortOrder: 10,
  },
];

export async function ensureQuestionnaireSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS questionnaire_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      question TEXT NOT NULL,
      type ENUM('single_select', 'multi_select', 'text', 'number', 'textarea', 'url') NOT NULL,
      options JSON,
      is_required TINYINT(1) NOT NULL DEFAULT 1,
      placeholder VARCHAR(255),
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_active_order (is_active, sort_order)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS questionnaire_answers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      question_id INT NOT NULL,
      answer TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questionnaire_questions(id) ON DELETE CASCADE,
      INDEX idx_client_id (client_id),
      INDEX idx_question_id (question_id)
    )
  `);

  const [[typeColumn]] = await connection.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questionnaire_questions' AND COLUMN_NAME = 'type'`
  );
  if (typeColumn && !typeColumn.COLUMN_TYPE.includes("'url'")) {
    await connection.query(`
      ALTER TABLE questionnaire_questions
      MODIFY COLUMN type ENUM('single_select', 'multi_select', 'text', 'number', 'textarea', 'url') NOT NULL
    `);
  }

  for (const statement of [
    'ALTER TABLE questionnaire_questions ADD COLUMN allow_photos BOOLEAN DEFAULT FALSE',
    'ALTER TABLE questionnaire_questions ADD COLUMN max_photos INT DEFAULT 4',
    'ALTER TABLE questionnaire_questions ADD COLUMN allow_pdf BOOLEAN DEFAULT FALSE',
    'ALTER TABLE questionnaire_questions ADD COLUMN standard_key VARCHAR(30) NULL',
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }

  const [rows] = await connection.query('SELECT COUNT(*) AS total FROM questionnaire_questions');
  if (Number(rows[0]?.total || 0) === 0) {
    await connection.query(
      `INSERT INTO questionnaire_questions
        (question, type, options, is_required, placeholder, sort_order, is_active)
       VALUES ?`,
      [seedQuestions.map((q) => [
        q.question,
        q.type,
        q.options ? JSON.stringify(q.options) : null,
        q.isRequired ? 1 : 0,
        q.placeholder,
        q.sortOrder,
        1,
      ])]
    );
  }

  // The check-in day is a built-in registration field. It gives every client
  // one reliable value for their weekly update schedule.
  const [standardRows] = await connection.query(
    'SELECT * FROM questionnaire_questions WHERE standard_key = ? ORDER BY id ASC',
    ['update_day']
  );
  const [legacyRows] = await connection.query(
    'SELECT * FROM questionnaire_questions WHERE standard_key IS NULL ORDER BY sort_order ASC, id ASC'
  );
  const existing = standardRows[0] || legacyRows.find(isLegacyUpdateDayQuestion);
  let updateDayQuestionId;

  if (existing) {
    updateDayQuestionId = existing.id;
    await connection.query(
      `UPDATE questionnaire_questions
       SET question = ?, type = 'single_select', options = ?, is_required = 1,
           placeholder = NULL, allow_photos = 0, allow_pdf = 0, is_active = 1,
           standard_key = 'update_day'
       WHERE id = ?`,
      [UPDATE_DAY_QUESTION, JSON.stringify(UPDATE_DAY_OPTIONS), updateDayQuestionId]
    );
  } else {
    const [[sortRow]] = await connection.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM questionnaire_questions'
    );
    const [result] = await connection.query(
      `INSERT INTO questionnaire_questions
        (question, type, options, is_required, placeholder, allow_photos, max_photos, allow_pdf, sort_order, is_active, standard_key)
       VALUES (?, 'single_select', ?, 1, NULL, 0, 4, 0, ?, 1, 'update_day')`,
      [UPDATE_DAY_QUESTION, JSON.stringify(UPDATE_DAY_OPTIONS), sortRow.next_sort_order]
    );
    updateDayQuestionId = result.insertId;
  }

  await connection.query(
    'UPDATE questionnaire_questions SET standard_key = NULL WHERE standard_key = ? AND id != ?',
    ['update_day', updateDayQuestionId]
  );
}

export async function syncUpdateDayQuestionnaireAnswer(connection, clientId, dayOfWeek) {
  const normalizedDay = Number(dayOfWeek);
  const answer = UPDATE_DAY_OPTIONS[normalizedDay === 0 ? 6 : normalizedDay - 1];
  if (!answer) return;

  const [rows] = await connection.query(
    'SELECT id FROM questionnaire_questions WHERE standard_key = ? LIMIT 1',
    ['update_day']
  );
  const questionId = rows[0]?.id;
  if (!questionId) return;

  await connection.query(
    'DELETE FROM questionnaire_answers WHERE client_id = ? AND question_id = ?',
    [clientId, questionId]
  );
  await connection.query(
    'INSERT INTO questionnaire_answers (client_id, question_id, answer) VALUES (?, ?, ?)',
    [clientId, questionId, answer]
  );
}

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
    standardKey: row.standard_key || null,
  };
}

// Public — no auth required.
router.get('/questions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureQuestionnaireSchema(connection);
    const [rows] = await connection.query(
      'SELECT * FROM questionnaire_questions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    connection.release();
    res.json(rows.map(normalizeQuestion));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Coach only — every question, active + inactive, for the admin builder.
router.get('/manage', authenticateToken, authorizeRole(['coach']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureQuestionnaireSchema(connection);
    const [rows] = await connection.query('SELECT * FROM questionnaire_questions ORDER BY sort_order ASC, id ASC');
    connection.release();
    res.json(rows.map(normalizeQuestion));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/questions/reorder', authenticateToken, authorizeRole(['coach']), [
  body('ids').isArray({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensureQuestionnaireSchema(connection);
    const { ids } = req.body;
    for (let index = 0; index < ids.length; index += 1) {
      await connection.query('UPDATE questionnaire_questions SET sort_order = ? WHERE id = ?', [index, ids[index]]);
    }
    connection.release();
    res.json({ message: 'Questions reordered' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/questions', authenticateToken, authorizeRole(['coach']), [
  body('question').notEmpty(),
  body('type').isIn(QUESTION_TYPES),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensureQuestionnaireSchema(connection);

    const [result] = await connection.query(
      `INSERT INTO questionnaire_questions
        (question, type, options, is_required, placeholder, allow_photos, max_photos, allow_pdf, sort_order, is_active, standard_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        null,
      ]
    );

    const [rows] = await connection.query('SELECT * FROM questionnaire_questions WHERE id = ?', [result.insertId]);
    connection.release();
    res.status(201).json(normalizeQuestion(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/questions/:id', authenticateToken, authorizeRole(['coach']), [
  body('question').notEmpty(),
  body('type').isIn(QUESTION_TYPES),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensureQuestionnaireSchema(connection);

    const [existingRows] = await connection.query(
      'SELECT standard_key FROM questionnaire_questions WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (existingRows[0]?.standard_key === 'update_day') {
      connection.release();
      return res.status(403).json({ message: 'The standard update-day question cannot be changed.' });
    }

    await connection.query(
      `UPDATE questionnaire_questions
       SET question = ?, type = ?, options = ?, is_required = ?, placeholder = ?, allow_photos = ?, max_photos = ?, allow_pdf = ?, sort_order = ?, is_active = ?, standard_key = ?
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
        null,
        req.params.id,
      ]
    );

    const [rows] = await connection.query('SELECT * FROM questionnaire_questions WHERE id = ?', [req.params.id]);
    connection.release();
    if (!rows.length) return res.status(404).json({ message: 'Question not found' });
    res.json(normalizeQuestion(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/questions/:id', authenticateToken, authorizeRole(['coach']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureQuestionnaireSchema(connection);
    const [existingRows] = await connection.query(
      'SELECT standard_key FROM questionnaire_questions WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (existingRows[0]?.standard_key === 'update_day') {
      connection.release();
      return res.status(403).json({ message: 'The standard update-day question cannot be deleted.' });
    }
    await connection.query('DELETE FROM questionnaire_questions WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
