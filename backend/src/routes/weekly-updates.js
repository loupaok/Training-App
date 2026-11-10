import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';
import { notifyCoaches } from './clients.js';
import { getEmailTemplate, sendMail } from '../lib/mailer.js';
import { updateNotificationEmail } from '../lib/email-templates.js';
import { registerWeeklyUpdatePhotos } from './media.js';
import { optimizeUploadedImages } from '../utils/image-optimization.js';
import { awardWeeklyUpdatePoints } from './points.js';

const router = express.Router();

const UPDATE_QUESTION_TYPES = ['single_select', 'multi_select', 'text', 'number', 'textarea', 'url', 'rating', 'photos', 'pdf'];
const UPDATE_SECTIONS = [
  { key: 'nutrition_training', label: 'Διατροφή & προπόνηση', sortOrder: 1 },
  { key: 'weight', label: 'Βάρος & δραστηριότητα', sortOrder: 2 },
  { key: 'sleep_recovery', label: 'Ύπνος & αποκατάσταση', sortOrder: 3 },
  { key: 'health_week', label: 'Υγεία & επόμενη εβδομάδα', sortOrder: 4 },
  { key: 'photos', label: 'Φωτογραφίες', sortOrder: 5 },
];
// A "standard field" is a question the app relies on for a specific meaning
// (e.g. reading the client's weekly weight) — at most one question can hold
// a given key, so consumers can look it up reliably instead of guessing by
// question type or matching text.
const UPDATE_QUESTION_STANDARD_KEYS = ['nutrition_consistency', 'nutrition_changes', 'nutrition_details', 'training_details', 'training_tags', 'training_consistency', 'sleep_hours', 'sleep_quality', 'sleep_details', 'recovery_quality', 'recovery_details', 'weight_kg', 'weight_measured_on', 'average_weekly_weight', 'steps_per_day', 'cardio_completed', 'cardio_planned', 'health_change', 'health_details', 'next_week_tags', 'next_week_needs', 'other_notes', 'progress_photos'];

const standardUpdateQuestions = [
  { standardKey: 'nutrition_consistency', section: 'nutrition_training', question: '1. Πόσο συνεπής ήσουν στη διατροφή σου;', type: 'rating', isRequired: true, placeholder: '5: πλήρης εφαρμογή · 4: σχεδόν πλήρης · 3: περίπου τις μισές ημέρες · 2: λίγες ημέρες · 1: ουσιαστικά καθόλου', sortOrder: 1 },
  { standardKey: 'nutrition_changes', question: 'Τι άλλαξε από το πλάνο;', type: 'multi_select', options: ['Έφαγα έξω', 'Παρέλειψα γεύμα', 'Τσιμπολόγημα', 'Αλκοόλ', 'Άλλαξα ποσότητες'], isRequired: false, placeholder: null, sortOrder: 2 },
  { standardKey: 'nutrition_details', question: 'Λεπτομέρειες διατροφής', type: 'textarea', isRequired: false, placeholder: 'Ποιο γεύμα, πόσες φορές και για ποιον λόγο;', sortOrder: 3 },
  { standardKey: 'training_consistency', question: 'Πόσο συνεπής ήσουν στο πρόγραμμα;', type: 'rating', isRequired: true, placeholder: null, helpText: 'Η αύξηση δύναμης δεν είναι απαραίτητη για να επιλέξεις 5.', sortOrder: 4 },
  { standardKey: 'training_tags', question: 'Κάτι για την προπόνηση;', type: 'multi_select', options: ['Πόνος / ενόχληση', 'Δυσκολία σε άσκηση', 'Έλειψα (υποχρεώσεις)', 'Ένιωσα δυνατός'], isRequired: false, placeholder: null, sortOrder: 5 },
  { standardKey: 'training_details', question: 'Σημειώσεις προπόνησης', type: 'textarea', isRequired: false, placeholder: 'Γράψε τι σε δυσκόλεψε ή σε ποια άσκηση είδες πρόοδο.', sortOrder: 6 },
  { standardKey: 'sleep_hours', question: '3. Μέσες ώρες ύπνου', type: 'single_select', options: ['<5', '5–6', '6–7', '7–8', '8+'], isRequired: true, placeholder: null, sortOrder: 7 },
  { standardKey: 'sleep_quality', question: 'Ποιότητα ύπνου', type: 'rating', isRequired: true, placeholder: null, sortOrder: 8 },
  { standardKey: 'sleep_details', question: 'Κακός ύπνος ή κάτι που τον επηρέασε;', type: 'textarea', isRequired: false, placeholder: 'Πόσες νύχτες και τι τον επηρέασε;', sortOrder: 9 },
  { standardKey: 'recovery_quality', question: '4. Πώς ήταν η αποκατάστασή σου;', type: 'rating', isRequired: true, placeholder: null, sortOrder: 10 },
  { standardKey: 'recovery_details', question: 'Ένιωθες έτοιμος για την επόμενη προπόνηση;', type: 'textarea', isRequired: false, placeholder: 'Κόπωση, πιάσιμο, ύπνος, στρες, εργασία ή κάτι άλλο;', sortOrder: 11 },
  { standardKey: 'weight_kg', question: '5. Τελευταίο πρωινό βάρος (kg)', type: 'number', isRequired: true, placeholder: 'π.χ. 82,5', sortOrder: 12 },
  { standardKey: 'weight_measured_on', question: 'Ημερομηνία μέτρησης', type: 'text', isRequired: true, placeholder: 'π.χ. 10 Νοεμβρίου', sortOrder: 13 },
  { standardKey: 'average_weekly_weight', question: 'Μέσο εβδομαδιαίο βάρος', type: 'number', isRequired: false, placeholder: 'π.χ. 82,1', sortOrder: 14 },
  { standardKey: 'steps_per_day', question: 'Μέσος αριθμός βημάτων ανά ημέρα', type: 'number', isRequired: false, placeholder: 'π.χ. 8.500', sortOrder: 15 },
  { standardKey: 'cardio_planned', question: 'Προγραμματισμένα αερόβια', type: 'number', isRequired: false, placeholder: 'π.χ. 3', sortOrder: 16 },
  { standardKey: 'cardio_completed', question: 'Αερόβια που ολοκλήρωσες', type: 'number', isRequired: false, placeholder: 'π.χ. 2', sortOrder: 17 },
  { standardKey: 'health_change', question: 'Υπήρξε αλλαγή στην υγεία σου;', type: 'single_select', options: ['Όχι', 'Ναι'], isRequired: true, placeholder: null, sortOrder: 18 },
  { standardKey: 'health_details', question: 'Διευκρίνισε την αλλαγή στην υγεία', type: 'textarea', isRequired: false, placeholder: 'Τραυματισμός, ασθένεια, επίμονος πόνος, φάρμακα ή οδηγία γιατρού.', sortOrder: 19 },
  { standardKey: 'next_week_tags', question: 'Τι χρειάζεσαι για την επόμενη εβδομάδα;', type: 'multi_select', options: ['Ταξίδι', 'Βάρδιες', 'Εκδήλωση', 'Λιγότερος χρόνος', 'Τίποτα'], isRequired: false, placeholder: null, sortOrder: 20 },
  { standardKey: 'next_week_needs', question: 'Λεπτομέρειες επόμενης εβδομάδας', type: 'textarea', isRequired: false, placeholder: 'Ποια ήταν η μεγαλύτερη δυσκολία σου ή τι χρειάζεται να λάβουμε υπόψη;', sortOrder: 21 },
  { standardKey: 'other_notes', question: 'Κάτι άλλο για τον coach;', type: 'textarea', isRequired: false, placeholder: 'Γράψε ελεύθερα…', sortOrder: 22 },
  { standardKey: 'progress_photos', question: 'Φωτογραφίες & υποβολή', type: 'photos', isRequired: false, placeholder: 'Μπροστά, πλάι και πίσω, με ίδιο φωτισμό, απόσταση και στάση όπως στις προηγούμενες φωτογραφίες, χωρίς φίλτρα.', allowPhotos: true, maxPhotos: 3, sortOrder: 23 },
];

function sectionForStandardKey(standardKey) {
  if (['weight_kg', 'weight_measured_on', 'average_weekly_weight', 'steps_per_day', 'cardio_planned', 'cardio_completed'].includes(standardKey)) return 'weight';
  if (['nutrition_consistency', 'nutrition_changes', 'nutrition_details', 'training_consistency', 'training_tags', 'training_details'].includes(standardKey)) return 'nutrition_training';
  if (['sleep_hours', 'sleep_quality', 'sleep_details', 'recovery_quality', 'recovery_details'].includes(standardKey)) return 'sleep_recovery';
  if (['progress_photos'].includes(standardKey)) return 'photos';
  return 'health_week';
}

const legacyUpdateQuestions = ['Πώς ήταν η εβδομάδα σου;', 'Τρέχον βάρος (kg);', 'Πώς πήγαν οι προπονήσεις;', 'Πώς ήταν η διατροφή σου;', 'Φωτογραφίες προόδου', 'Σημειώσεις / Ερωτήσεις προς τον coach'];

async function ensureStandardUpdateQuestions(connection) {
  // Retire only the original defaults; coach-created additions remain intact.
  await connection.query(
    'UPDATE update_questions SET is_active = 0 WHERE standard_key IS NULL AND question IN (?)',
    [legacyUpdateQuestions],
  );
  // A retired standard field must not remain visible beside the current form.
  await connection.query(
    'UPDATE update_questions SET is_active = 0 WHERE standard_key IS NOT NULL AND standard_key NOT IN (?)',
    [UPDATE_QUESTION_STANDARD_KEYS],
  );
  // Keep one canonical row for each standard field. Older development versions
  // could create a second identical row; it must not render twice for clients.
  const [duplicateStandardKeys] = await connection.query(
    `SELECT standard_key FROM update_questions
     WHERE standard_key IS NOT NULL AND is_deleted = 0
     GROUP BY standard_key HAVING COUNT(*) > 1`,
  );
  for (const duplicate of duplicateStandardKeys) {
    const [rows] = await connection.query(
      'SELECT id FROM update_questions WHERE standard_key = ? AND is_deleted = 0 ORDER BY id ASC',
      [duplicate.standard_key],
    );
    const retiredIds = rows.slice(1).map((row) => row.id);
    if (retiredIds.length) await connection.query('UPDATE update_questions SET is_active = 0, is_deleted = 1 WHERE id IN (?)', [retiredIds]);
  }

  for (const item of standardUpdateQuestions) {
    const [rows] = await connection.query(
      'SELECT id FROM update_questions WHERE standard_key = ? ORDER BY id ASC',
      [item.standardKey],
    );
    const values = [
      item.question,
      item.type,
      item.options ? JSON.stringify(item.options) : null,
      item.isRequired ? 1 : 0,
      item.placeholder || null,
      item.helpText || null,
      item.allowPhotos ? 1 : 0,
      item.maxPhotos || 4,
      0,
      item.sortOrder,
      1,
      item.standardKey,
      item.section || sectionForStandardKey(item.standardKey),
    ];
    if (rows[0]) {
      await connection.query(
        `UPDATE update_questions
         SET question = ?, type = ?, options = ?, is_required = ?, placeholder = ?, help_text = ?,
             allow_photos = ?, max_photos = ?, allow_pdf = ?, sort_order = ?, is_active = ?, standard_key = ?, section = ?
         WHERE id = ?`,
        [...values, rows[0].id],
      );
    } else {
      await connection.query(
        `INSERT INTO update_questions
          (question, type, options, is_required, placeholder, help_text, allow_photos, max_photos, allow_pdf, sort_order, is_active, standard_key, section)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values,
      );
    }
  }
}

// weekly_updates/weekly_update_photos already existed (created by clientDashboard.js)
// with a fixed weight/training/nutrition-score schema and zero real submissions. This
// migrates that table to the flexible question/answer shape used here; the old photos
// table is left in place, orphaned, rather than dropped.
export async function ensureWeeklyUpdateSchema(connection) {
  for (const statement of [
    'ALTER TABLE clients ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE clients ADD COLUMN demo_updates_enabled TINYINT(1) NOT NULL DEFAULT 0',
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
  await connection.query(`
    CREATE TABLE IF NOT EXISTS update_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      question TEXT NOT NULL,
      type ENUM('single_select', 'multi_select', 'text', 'number', 'textarea', 'url', 'rating', 'photos', 'pdf') NOT NULL,
      options JSON NULL,
      is_required BOOLEAN DEFAULT TRUE,
      placeholder VARCHAR(255) NULL,
      help_text TEXT NULL,
      allow_photos BOOLEAN DEFAULT FALSE,
      max_photos INT DEFAULT 4,
      allow_pdf BOOLEAN DEFAULT FALSE,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_update_sections (
      section_key VARCHAR(40) PRIMARY KEY,
      label VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_update_settings (
      id TINYINT PRIMARY KEY,
      deadline_time TIME NOT NULL DEFAULT '23:59:00',
      reminder VARCHAR(40) NOT NULL DEFAULT 'same_day_10',
      photos_required BOOLEAN NOT NULL DEFAULT FALSE,
      show_score_to_client BOOLEAN NOT NULL DEFAULT TRUE,
      autosave BOOLEAN NOT NULL DEFAULT TRUE,
      score_note TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_update_score_tiers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      min_score TINYINT NOT NULL,
      max_score TINYINT NOT NULL,
      title VARCHAR(120) NOT NULL,
      message TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    )
  `);
  await connection.query(
    `INSERT IGNORE INTO weekly_update_settings (id, deadline_time, reminder, photos_required, show_score_to_client, autosave, score_note)
     VALUES (1, '23:59:00', 'same_day_10', FALSE, TRUE, TRUE, ?)` ,
    ['Το σκορ βοηθά την αξιολόγηση. Η τελική καθοδήγηση λαμβάνει υπόψη τις απαντήσεις σου, την πρόοδο και τις συνθήκες της εβδομάδας.'],
  );
  const [[scoreTierCount]] = await connection.query('SELECT COUNT(*) AS total FROM weekly_update_score_tiers');
  if (!Number(scoreTierCount.total)) {
    await connection.query(
      `INSERT INTO weekly_update_score_tiers (min_score, max_score, title, message, sort_order) VALUES
       (80, 100, 'Πολύ καλή εβδομάδα', 'Συνέχισε έτσι. Ο coach θα αξιολογήσει τις λεπτομέρειες του update σου.', 1),
       (60, 79, 'Καλή βάση', 'Υπάρχουν σημεία να δουλέψουμε. Ο coach θα σου δώσει συγκεκριμένη κατεύθυνση.', 2),
       (40, 59, 'Εβδομάδα με δυσκολίες', 'Συμβαίνει. Θα δούμε μαζί τι σε δυσκόλεψε και πώς το προσαρμόζουμε.', 3),
       (0, 39, 'Δύσκολη εβδομάδα', 'Μην αγχώνεσαι. Γράψε στον coach σου τι χρειάζεσαι για την επόμενη εβδομάδα.', 4)`,
    );
  }
  for (const section of UPDATE_SECTIONS) {
    await connection.query(
      'INSERT IGNORE INTO weekly_update_sections (section_key, label, sort_order) VALUES (?, ?, ?)',
      [section.key, section.label, section.sortOrder],
    );
  }

  try {
    await connection.query('ALTER TABLE update_questions ADD COLUMN standard_key VARCHAR(30) NULL');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
  try {
    await connection.query('ALTER TABLE update_questions ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
  try {
    await connection.query("ALTER TABLE update_questions ADD COLUMN section VARCHAR(40) NOT NULL DEFAULT 'health_week'");
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
  try {
    await connection.query('ALTER TABLE update_questions ADD COLUMN help_text TEXT NULL AFTER placeholder');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_updates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      week_start DATE NOT NULL,
      is_timely BOOLEAN NOT NULL DEFAULT TRUE,
      is_read BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (client_id) REFERENCES users(id)
    )
  `);

  try {
    await connection.query('ALTER TABLE weekly_updates ADD COLUMN is_timely BOOLEAN NOT NULL DEFAULT TRUE AFTER week_start');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
  try {
    await connection.query('ALTER TABLE weekly_updates ADD COLUMN weekly_score TINYINT NULL AFTER is_timely');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }

  // The application enforces one update per week for normal clients. Removing the
  // legacy database constraint lets demo accounts submit multiple test updates.
  try {
    await connection.query('ALTER TABLE weekly_updates DROP INDEX unique_client_week');
  } catch (error) {
    if (error.code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw error;
  }

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

  try {
    await connection.query("ALTER TABLE weekly_update_files ADD COLUMN angle ENUM('front', 'side', 'back', 'other') NOT NULL DEFAULT 'other' AFTER original_name");
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }

  await ensureStandardUpdateQuestions(connection);
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
    helpText: row.help_text || '',
    allowPhotos: Boolean(row.allow_photos),
    maxPhotos: row.max_photos,
    allowPdf: Boolean(row.allow_pdf),
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    standardKey: row.standard_key || null,
    section: row.section || sectionForStandardKey(row.standard_key),
  };
}

export function calculateWeeklyScore(answers, questions) {
  const byId = new Map((questions || []).map((question) => [Number(question.id), question]));
  const ratings = {};
  for (const entry of answers || []) {
    const question = byId.get(Number(entry.question_id ?? entry.questionId));
    const rating = Number(entry.answer);
    if (!question || !Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    if (['nutrition_consistency', 'training_consistency', 'sleep_quality', 'recovery_quality'].includes(question.standard_key)) {
      ratings[question.standard_key] = rating;
    }
  }
  if (Object.keys(ratings).length !== 4) return null;
  return Math.max(0, Math.min(100,
    40 - (5 - ratings.nutrition_consistency) * 10
    + 20 - (5 - ratings.training_consistency) * 5
    + 20 - (5 - ratings.sleep_quality) * 5
    + 20 - (5 - ratings.recovery_quality) * 5,
  ));
}

function athensDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), weekday };
}

function toLocalDateString(date) {
  const { year, month, day } = athensDateParts(date);
  return `${year}-${month}-${day}`;
}

export function getWeekStart(date = new Date()) {
  const athens = athensDateParts(date);
  const current = new Date(Date.UTC(athens.year, athens.month - 1, athens.day));
  current.setUTCDate(current.getUTCDate() - (athens.weekday === 0 ? 6 : athens.weekday - 1));
  return current.toISOString().slice(0, 10);
}

// Calculated server-side in Europe/Athens: timely means 00:00–23:59:59 on
// the selected day. Later in the same Monday–Sunday week is allowed, but late.
export function getWeeklyUpdateTiming(schedule, date = new Date()) {
  if (!schedule || schedule.day_of_week === undefined || schedule.day_of_week === null) {
    return { canSubmit: false, isTimely: false, isLate: false };
  }
  const scheduledDay = Number(schedule.day_of_week);
  if (!Number.isInteger(scheduledDay) || scheduledDay < 0 || scheduledDay > 6) {
    return { canSubmit: false, isTimely: false, isLate: false };
  }
  const { weekday } = athensDateParts(date);
  const todayIndex = weekday === 0 ? 6 : weekday - 1;
  const scheduledIndex = scheduledDay === 0 ? 6 : scheduledDay - 1;
  const isTimely = todayIndex === scheduledIndex;
  const isLate = todayIndex > scheduledIndex;
  return { canSubmit: isTimely || isLate, isTimely, isLate };
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
function extractUpdateStats(answers, questions) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  let weight = null;
  let trainingScore = null;
  let nutritionScore = null;
  for (const entry of answers) {
    const question = questionById.get(Number(entry.question_id));
    if (!question || !entry.answer) continue;
    if (question.standard_key === 'weight_kg' && weight === null) {
      weight = entry.answer;
    } else if (question.standard_key === 'training_consistency') {
      trainingScore = entry.answer;
    } else if (question.standard_key === 'nutrition_consistency') {
      nutritionScore = entry.answer;
    }
  }
  return { weight, trainingScore, nutritionScore };
}

// ---------------------------------------------------------------------------
// Client endpoints
// ---------------------------------------------------------------------------

router.get('/sections', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const [rows] = await connection.query('SELECT section_key AS `key`, label, sort_order AS sortOrder FROM weekly_update_sections ORDER BY sort_order ASC, section_key ASC');
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/sections/manage', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const [rows] = await connection.query('SELECT section_key AS `key`, label, sort_order AS sortOrder FROM weekly_update_sections ORDER BY sort_order ASC, section_key ASC');
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/sections', authorizeRole(['coach', 'admin']), [
  body('sections').isArray({ min: 5, max: 5 }),
  body('sections.*.key').isIn(UPDATE_SECTIONS.map((section) => section.key)),
  body('sections.*.label').trim().isLength({ min: 1, max: 120 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const suppliedKeys = req.body.sections.map((section) => section.key);
  if (new Set(suppliedKeys).size !== UPDATE_SECTIONS.length || UPDATE_SECTIONS.some((section) => !suppliedKeys.includes(section.key))) {
    return res.status(400).json({ message: 'Invalid section list' });
  }
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    for (let index = 0; index < req.body.sections.length; index += 1) {
      const section = req.body.sections[index];
      await connection.query('UPDATE weekly_update_sections SET label = ?, sort_order = ? WHERE section_key = ?', [section.label.trim(), index + 1, section.key]);
    }
    const [rows] = await connection.query('SELECT section_key AS `key`, label, sort_order AS sortOrder FROM weekly_update_sections ORDER BY sort_order ASC, section_key ASC');
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/builder-settings', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const [[settings]] = await connection.query(`SELECT deadline_time AS deadlineTime, reminder, photos_required AS photosRequired,
      show_score_to_client AS showScoreToClient, autosave, score_note AS scoreNote FROM weekly_update_settings WHERE id = 1`);
    const [tiers] = await connection.query('SELECT id, min_score AS minScore, max_score AS maxScore, title, message, sort_order AS sortOrder FROM weekly_update_score_tiers ORDER BY sort_order ASC, min_score DESC');
    connection.release();
    res.json({ settings: { ...settings, deadlineTime: String(settings.deadlineTime || '23:59').slice(0, 5), photosRequired: Boolean(settings.photosRequired), showScoreToClient: Boolean(settings.showScoreToClient), autosave: Boolean(settings.autosave) }, tiers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/builder-settings', authorizeRole(['coach', 'admin']), [
  body('settings.deadlineTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('settings.reminder').isString().isLength({ min: 1, max: 40 }),
  body('settings.photosRequired').isBoolean(),
  body('settings.showScoreToClient').isBoolean(),
  body('settings.autosave').isBoolean(),
  body('settings.scoreNote').optional({ nullable: true }).isLength({ max: 3000 }),
  body('tiers').isArray({ min: 1, max: 10 }),
  body('tiers.*.minScore').isInt({ min: 0, max: 100 }),
  body('tiers.*.maxScore').isInt({ min: 0, max: 100 }),
  body('tiers.*.title').trim().isLength({ min: 1, max: 120 }),
  body('tiers.*.message').trim().isLength({ min: 1, max: 3000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const tiers = req.body.tiers.map((tier) => ({ ...tier, minScore: Number(tier.minScore), maxScore: Number(tier.maxScore) }));
  const validRanges = tiers.every((tier) => tier.minScore <= tier.maxScore)
    && [...tiers].sort((a, b) => a.minScore - b.minScore).every((tier, index, rows) => index === 0 ? tier.minScore === 0 : tier.minScore === rows[index - 1].maxScore + 1)
    && Math.max(...tiers.map((tier) => tier.maxScore)) === 100;
  if (!validRanges) return res.status(400).json({ message: 'Τα εύρη score πρέπει να καλύπτουν συνεχόμενα το 0–100.' });
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    await connection.beginTransaction();
    const settings = req.body.settings;
    await connection.query(`UPDATE weekly_update_settings SET deadline_time = ?, reminder = ?, photos_required = ?, show_score_to_client = ?, autosave = ?, score_note = ? WHERE id = 1`,
      [settings.deadlineTime, settings.reminder, settings.photosRequired ? 1 : 0, settings.showScoreToClient ? 1 : 0, settings.autosave ? 1 : 0, settings.scoreNote || null]);
    await connection.query('DELETE FROM weekly_update_score_tiers');
    for (let index = 0; index < tiers.length; index += 1) {
      const tier = tiers[index];
      await connection.query('INSERT INTO weekly_update_score_tiers (min_score, max_score, title, message, sort_order) VALUES (?, ?, ?, ?, ?)',
        [tier.minScore, tier.maxScore, tier.title.trim(), tier.message.trim(), index]);
    }
    await connection.commit();
    connection.release();
    res.json({ message: 'Οι ρυθμίσεις του update αποθηκεύτηκαν.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/questions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const [rows] = await connection.query('SELECT * FROM update_questions WHERE is_active = 1 AND is_deleted = 0 ORDER BY sort_order ASC, id ASC');
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
    const [rows] = await connection.query('SELECT * FROM update_questions WHERE is_deleted = 0 ORDER BY sort_order ASC, id ASC');
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
  body('standardKey').optional({ nullable: true }).isIn(UPDATE_QUESTION_STANDARD_KEYS),
  body('section').optional().isIn(['weight', 'nutrition_training', 'sleep_recovery', 'health_week', 'photos']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);

    const standardKey = req.body.standardKey || null;
    if (standardKey) {
      await connection.query('UPDATE update_questions SET standard_key = NULL WHERE standard_key = ?', [standardKey]);
    }

    const [result] = await connection.query(
      `INSERT INTO update_questions
        (question, type, options, is_required, placeholder, help_text, allow_photos, max_photos, allow_pdf, sort_order, is_active, standard_key, section)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.question,
        req.body.type,
        req.body.options ? JSON.stringify(req.body.options) : null,
        req.body.isRequired === false ? 0 : 1,
        req.body.placeholder || null,
        req.body.helpText || null,
        req.body.allowPhotos === true ? 1 : 0,
        req.body.maxPhotos || 4,
        req.body.allowPdf === true ? 1 : 0,
        req.body.sortOrder || 0,
        req.body.isActive === false ? 0 : 1,
        standardKey,
        req.body.section || 'health_week',
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
  body('standardKey').optional({ nullable: true }).isIn(UPDATE_QUESTION_STANDARD_KEYS),
  body('section').optional().isIn(['weight', 'nutrition_training', 'sleep_recovery', 'health_week', 'photos']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);

    const [existingRows] = await connection.query('SELECT standard_key FROM update_questions WHERE id = ? LIMIT 1', [req.params.id]);
    if (existingRows[0]?.standard_key) {
      connection.release();
      return res.status(403).json({ message: 'Οι σταθερές ερωτήσεις του εβδομαδιαίου update δεν αλλάζουν.' });
    }

    const standardKey = req.body.standardKey || null;
    if (standardKey) {
      await connection.query('UPDATE update_questions SET standard_key = NULL WHERE standard_key = ? AND id != ?', [standardKey, req.params.id]);
    }

    await connection.query(
      `UPDATE update_questions
       SET question = ?, type = ?, options = ?, is_required = ?, placeholder = ?, help_text = ?, allow_photos = ?, max_photos = ?, allow_pdf = ?, sort_order = ?, is_active = ?, standard_key = ?, section = ?
       WHERE id = ?`,
      [
        req.body.question,
        req.body.type,
        req.body.options ? JSON.stringify(req.body.options) : null,
        req.body.isRequired === false ? 0 : 1,
        req.body.placeholder || null,
        req.body.helpText || null,
        req.body.allowPhotos === true ? 1 : 0,
        req.body.maxPhotos || 4,
        req.body.allowPdf === true ? 1 : 0,
        req.body.sortOrder || 0,
        req.body.isActive === false ? 0 : 1,
        standardKey,
        req.body.section || 'health_week',
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
    const [existingRows] = await connection.query('SELECT standard_key FROM update_questions WHERE id = ? LIMIT 1', [req.params.id]);
    if (existingRows[0]?.standard_key) {
      connection.release();
      return res.status(403).json({ message: 'Οι σταθερές ερωτήσεις του εβδομαδιαίου update δεν διαγράφονται.' });
    }
    const [result] = await connection.query('UPDATE update_questions SET is_active = 0, is_deleted = 1 WHERE id = ?', [req.params.id]);
    connection.release();
    if (!result.affectedRows) return res.status(404).json({ message: 'Question not found' });
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
    const [[demoClient]] = await connection.query(
      'SELECT is_demo, demo_updates_enabled FROM clients WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    const demoUpdatesEnabled = Boolean(demoClient?.is_demo && demoClient?.demo_updates_enabled);
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

    const timing = getWeeklyUpdateTiming(schedule);
    res.json({
      canSubmit: demoUpdatesEnabled || (timing.canSubmit && !alreadySubmittedThisWeek),
      isTimely: timing.isTimely,
      isLate: timing.isLate,
      nextSubmitDate,
      alreadySubmittedThisWeek: demoUpdatesEnabled ? false : alreadySubmittedThisWeek,
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
    let fileAngles = [];
    try {
      fileAngles = req.body.fileAngles ? JSON.parse(req.body.fileAngles) : [];
    } catch {
      fileAngles = [];
    }

    const [[demoClient]] = await connection.query(
      'SELECT is_demo, demo_updates_enabled FROM clients WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    const demoUpdatesEnabled = Boolean(demoClient?.is_demo && demoClient?.demo_updates_enabled);

    const [scheduleRows] = await connection.query(
      'SELECT * FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      [req.user.id]
    );
    const schedule = scheduleRows[0] || null;
    const timing = getWeeklyUpdateTiming(schedule);
    if (!demoUpdatesEnabled && !timing.canSubmit) {
      connection.release();
      return res.status(403).json({ message: 'Το εβδομαδιαίο update ανοίγει από την προγραμματισμένη ημέρα και έως το τέλος της εβδομάδας.' });
    }

    const weekStart = getWeekStart();
    const [existing] = await connection.query(
      'SELECT id FROM weekly_updates WHERE client_id = ? AND week_start = ?',
      [req.user.id, weekStart]
    );
    if (!demoUpdatesEnabled && existing.length) {
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

    try {
      await optimizeUploadedImages((req.files || []).filter((file) => file.mimetype !== 'application/pdf'));
    } catch {
      connection.release();
      return res.status(400).json({ message: 'Μία από τις φωτογραφίες δεν είναι έγκυρη.' });
    }

    await connection.beginTransaction();

    const weeklyScore = calculateWeeklyScore(answers, activeQuestions);
    const [result] = await connection.query(
      'INSERT INTO weekly_updates (client_id, week_start, is_timely, weekly_score) VALUES (?, ?, ?, ?)',
      [req.user.id, weekStart, timing.isTimely ? 1 : 0, weeklyScore]
    );
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
        'INSERT INTO weekly_update_files (update_id, question_id, file_url, file_type, original_name, angle) VALUES ?',
        [req.files.map((file, index) => [
          updateId,
          fileQuestionIds[index] || null,
          file.path.replace(/\\/g, '/'),
          file.mimetype === 'application/pdf' ? 'pdf' : 'photo',
          file.originalname,
          file.mimetype === 'application/pdf' ? 'other' : (['front', 'side', 'back', 'other'].includes(fileAngles[index]) ? fileAngles[index] : 'other'),
        ])]
      );
    }

    const [userRows] = await connection.query('SELECT full_name, email FROM users WHERE id = ?', [req.user.id]);
    const clientName = userRows[0]?.full_name || userRows[0]?.email || 'Πελάτης';

    await connection.commit();
    await awardWeeklyUpdatePoints(connection, { clientId: req.user.id, updateId, weekStart, timely: timing.isTimely });
    try {
      await registerWeeklyUpdatePhotos(connection, req.user.id);
    } catch (mediaError) {
      console.error('Weekly update media-library sync failed:', mediaError);
    }
    connection.release();

    try {
      const notifyConn = await pool.getConnection();
      await notifyCoaches(notifyConn, {
        clientId: req.user.id,
        type: 'new_update',
        title: 'Νέο εβδομαδιαίο update',
        body: `${clientName} υπέβαλε το εβδομαδιαίο update του.`,
        linkUrl: `/coach/updates/${updateId}`,
      });
      const [coachRows] = await notifyConn.query("SELECT email FROM users WHERE role IN ('admin', 'coach') AND is_active = 1");
      notifyConn.release();

      const { weight, trainingScore, nutritionScore } = extractUpdateStats(answers, activeQuestions);
      const updatesLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/coach/updates/${updateId}`;

      const databaseTemplate = await getEmailTemplate('update_notification', {
        clientName,
        weight,
        trainingScore,
        nutritionScore,
        updateUrl: updatesLink,
      });

      coachRows.forEach((coach) => {
        try {
          const template = databaseTemplate
            || updateNotificationEmail(clientName, weight, trainingScore, nutritionScore, updatesLink);
          sendMail({ to: coach.email, ...template }).catch((error) => console.error('Email failed', error));
        } catch (error) {
          console.error('Email failed', error);
        }
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
    `SELECT wa.update_id, wa.question_id, wa.answer, q.question, q.type, q.standard_key
     FROM weekly_update_answers wa
     JOIN update_questions q ON q.id = wa.question_id
     WHERE wa.update_id IN (?)`,
    [ids]
  );
  const [fileRows] = await connection.query(
    'SELECT update_id, question_id, file_url, file_type, original_name, angle FROM weekly_update_files WHERE update_id IN (?)',
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
      `SELECT w.id, w.client_id, w.submitted_at, DATE_FORMAT(w.week_start, '%Y-%m-%d') AS week_start, w.is_read, w.weekly_score,
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
      `SELECT w.id, w.client_id, w.submitted_at, DATE_FORMAT(w.week_start, '%Y-%m-%d') AS week_start, w.is_read, w.weekly_score,
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
