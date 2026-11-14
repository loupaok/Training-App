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
import { awardWeeklyUpdatePoints, ensurePointsSchema } from './points.js';
import { defaultUpdateForm } from '../lib/update-form/default-form.js';
import { computeScore, isVisible, validateStep } from '../lib/update-form/logic.js';

const router = express.Router();
// Bump this only when the shipped default questionnaire changes. Existing
// published forms stay immutable, while new client drafts move to the latest
// definition so the client and the builder always share one FormDefinition.
const DEFAULT_UPDATE_FORM_REVISION = 3;

async function addColumnIfMissing(connection, table, column, definition) {
  const [[existing]] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!existing) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
}

function parseLegacyAnswer(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

const legacyAnswerKeys = {
  nutrition_consistency: 'diet_score',
  nutrition_changes: 'diet_changes',
  training_consistency: 'training_score',
  training_tags: 'training_notes',
  sleep_quality: 'sleep_quality',
  recovery_quality: 'recovery',
  weight_kg: 'weight_kg',
  health_change: 'health_changed',
  health_details: 'health_details',
  next_week_tags: 'next_week',
  other_notes: 'coach_note',
};

function answersFromLegacyEntries(entries, questions) {
  const questionsById = new Map(questions.map((question) => [Number(question.id), question]));
  const result = {};
  for (const entry of entries) {
    const question = questionsById.get(Number(entry?.question_id));
    const key = legacyAnswerKeys[question?.standard_key];
    if (!key) continue;
    let value = entry.answer;
    if (key === 'health_changed' && typeof value === 'string') value = value.trim().toLowerCase() === 'ναι';
    if ((key === 'diet_changes' || key === 'training_notes' || key === 'next_week') && Array.isArray(value)) value = { chips: value, text: '' };
    result[key] = value;
  }
  return result;
}

async function ensurePublishedUpdateForm(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS update_forms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      version INT NOT NULL,
      status ENUM('draft', 'published') NOT NULL,
      definition JSON NOT NULL,
      published_at TIMESTAMP NULL DEFAULT NULL,
      published_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      draft_guard TINYINT GENERATED ALWAYS AS (IF(status = 'draft', 1, NULL)) STORED,
      UNIQUE KEY unique_update_form_version (version),
      UNIQUE KEY unique_update_form_draft (draft_guard)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS update_form_metadata (
      meta_key VARCHAR(80) PRIMARY KEY,
      meta_value VARCHAR(255) NOT NULL
    )
  `);

  const [[published]] = await connection.query(
    "SELECT id, version FROM update_forms WHERE status = 'published' ORDER BY version DESC LIMIT 1",
  );
  const [[revisionRow]] = await connection.query(
    "SELECT meta_value FROM update_form_metadata WHERE meta_key = 'default_update_form_revision'",
  );
  const storedRevision = Number(revisionRow?.meta_value || 0);

  if (published && storedRevision >= DEFAULT_UPDATE_FORM_REVISION) return published.id;

  const [[versionRow]] = await connection.query('SELECT COALESCE(MAX(version), 0) AS maxVersion FROM update_forms');
  const nextVersion = Number(versionRow?.maxVersion || 0) + 1;

  const [result] = await connection.query(
    "INSERT INTO update_forms (version, status, definition, published_at) VALUES (?, 'published', ?, NOW())",
    [nextVersion, JSON.stringify(defaultUpdateForm)],
  );
  await connection.query(
    `INSERT INTO update_form_metadata (meta_key, meta_value)
     VALUES ('default_update_form_revision', ?)
     ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
    [String(DEFAULT_UPDATE_FORM_REVISION)],
  );

  // A stale builder draft would otherwise mask the revised published form.
  // Reset it once as part of this explicit shipped-form migration.
  await connection.query(
    "UPDATE update_forms SET definition = ?, version = ? WHERE status = 'draft'",
    [JSON.stringify(defaultUpdateForm), nextVersion + 1],
  );

  // Unsubmitted forms remain editable and can safely receive the revised
  // definition. Submitted updates keep their original immutable form version.
  const [[weeklyStatusColumn]] = await connection.query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'weekly_updates' AND COLUMN_NAME = 'status'
    LIMIT 1
  `);
  if (weeklyStatusColumn) {
    await connection.query("UPDATE weekly_updates SET form_id = ? WHERE status = 'draft'", [result.insertId]);
  }
  return result.insertId;
}

function parseFormDefinition(value) {
  if (!value) return null;
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
}

function validateFormDefinition(definition, { publish = false } = {}) {
  const errors = {};
  if (!definition || typeof definition !== 'object') return { form: 'Μη έγκυρη φόρμα.' };
  if (!Array.isArray(definition.steps) || !definition.steps.length) errors.steps = 'Χρειάζεται τουλάχιστον ένα βήμα.';
  const ids = new Set();
  for (const [stepIndex, step] of (definition.steps || []).entries()) {
    if (!step?.id || !String(step.id).trim()) errors[`steps.${stepIndex}.id`] = 'Το id του βήματος είναι υποχρεωτικό.';
    if (publish && !String(step?.title || '').trim()) errors[`steps.${stepIndex}.title`] = 'Το όνομα του βήματος είναι υποχρεωτικό.';
    if (!Array.isArray(step?.questions)) errors[`steps.${stepIndex}.questions`] = 'Οι ερωτήσεις δεν είναι έγκυρες.';
    for (const [questionIndex, question] of (step?.questions || []).entries()) {
      const key = `steps.${stepIndex}.questions.${questionIndex}`;
      if (!question?.id || ids.has(question.id)) errors[`${key}.id`] = 'Κάθε ερώτηση χρειάζεται μοναδικό id.';
      ids.add(question?.id);
      if (publish && !String(question?.label || '').trim()) errors[`${key}.label`] = 'Η ερώτηση χρειάζεται κείμενο.';
      if (!['scale', 'text', 'number', 'yes_no', 'chips', 'auto', 'photos'].includes(question?.type)) errors[`${key}.type`] = 'Μη έγκυρος τύπος ερώτησης.';
    }
  }
  for (const step of definition.steps || []) for (const question of step.questions || []) {
    if (question?.showIf && !ids.has(question.showIf.questionId)) errors[`question.${question.id}.showIf`] = 'Η συνθήκη αναφέρεται σε ανύπαρκτη ερώτηση.';
  }
  if (publish) {
    const tiers = [...(definition.scoreTiers || [])].sort((a, b) => Number(a.min) - Number(b.min));
    if (!tiers.length || Number(tiers[0]?.min) !== 0 || Number(tiers.at(-1)?.max) !== 100) errors.scoreTiers = 'Τα ranges του σκορ πρέπει να καλύπτουν 0–100.';
    if (tiers.some((tier, index) => !String(tier.title || '').trim() || !String(tier.message || '').trim() || Number(tier.min) > Number(tier.max) || (index && Number(tier.min) !== Number(tiers[index - 1].max) + 1))) errors.scoreTiers = 'Τα ranges του σκορ έχουν κενά ή επικαλύψεις.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(definition.settings?.deadlineTime || ''))) errors.deadlineTime = 'Βάλε έγκυρη ώρα προθεσμίας.';
    if (!Array.isArray(definition.settings?.allowedDays) || definition.settings.allowedDays.some((day) => !Number.isInteger(day) || day < 1 || day > 6)) errors.allowedDays = 'Επίλεξε ημέρες Δευτέρα έως Σάββατο.';
  }
  return errors;
}

async function getOrCreateUpdateDraft(connection) {
  const [drafts] = await connection.query("SELECT * FROM update_forms WHERE status = 'draft' LIMIT 1");
  if (drafts[0]) return drafts[0];
  const [publishedRows] = await connection.query("SELECT * FROM update_forms WHERE status = 'published' ORDER BY version DESC LIMIT 1");
  const source = publishedRows[0] || { version: 0, definition: defaultUpdateForm };
  const [created] = await connection.query(
    "INSERT INTO update_forms (version, status, definition) VALUES (?, 'draft', ?)",
    [Number(source.version || 0) + 1, JSON.stringify(parseFormDefinition(source.definition) || defaultUpdateForm)],
  );
  const [rows] = await connection.query('SELECT * FROM update_forms WHERE id = ?', [created.insertId]);
  return rows[0];
}

async function migrateLegacyWeeklyUpdates(connection, formId) {
  const [updates] = await connection.query('SELECT id, weekly_score, is_timely FROM weekly_updates WHERE form_id IS NULL');
  if (!updates.length) return;

  const [legacyAnswers] = await connection.query(`
    SELECT answer.update_id, answer.answer, question.standard_key, question.question
    FROM weekly_update_answers answer
    JOIN update_questions question ON question.id = answer.question_id
    WHERE answer.update_id IN (?)`,
    [updates.map((update) => update.id)],
  );
  const answersByUpdate = new Map();
  for (const row of legacyAnswers) {
    const key = legacyAnswerKeys[row.standard_key];
    if (!key) continue;
    const answers = answersByUpdate.get(row.update_id) || {};
    answers[key] = parseLegacyAnswer(row.answer);
    answersByUpdate.set(row.update_id, answers);
  }

  for (const update of updates) {
    const answers = answersByUpdate.get(update.id) || {};
    const calculated = computeScore(defaultUpdateForm, answers);
    const score = Number.isFinite(Number(update.weekly_score)) ? Number(update.weekly_score) : calculated.score;
    const tier = score === null ? null : defaultUpdateForm.scoreTiers.find((item) => score >= item.min && score <= item.max)?.title || null;
    await connection.query(
      `UPDATE weekly_updates
       SET form_id = ?, answers = ?, auto_snapshot = ?, status = 'submitted',
           score = ?, score_tier_title = ?, on_time = COALESCE(is_timely, TRUE)
       WHERE id = ?`,
      [formId, JSON.stringify(answers), JSON.stringify({ migratedFromLegacy: true }), score, tier, update.id],
    );
  }
}

async function archiveDuplicateWeeklyUpdates(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_update_duplicate_archive (
      id INT AUTO_INCREMENT PRIMARY KEY,
      original_update_id INT NOT NULL,
      client_id INT NOT NULL,
      week_start DATE NOT NULL,
      payload JSON NOT NULL,
      answers JSON NULL,
      files JSON NULL,
      archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_archived_weekly_update (original_update_id)
    )
  `);
  const [duplicates] = await connection.query(`
    SELECT client_id, week_start FROM weekly_updates
    GROUP BY client_id, week_start HAVING COUNT(*) > 1
  `);
  for (const duplicate of duplicates) {
    const [rows] = await connection.query(
      'SELECT * FROM weekly_updates WHERE client_id = ? AND week_start = ? ORDER BY submitted_at DESC, id DESC',
      [duplicate.client_id, duplicate.week_start],
    );
    for (const row of rows.slice(1)) {
      const [answers] = await connection.query('SELECT question_id, answer FROM weekly_update_answers WHERE update_id = ?', [row.id]);
      const [files] = await connection.query('SELECT question_id, file_url, file_type, original_name, angle, created_at FROM weekly_update_files WHERE update_id = ?', [row.id]);
      await connection.query(
        `INSERT IGNORE INTO weekly_update_duplicate_archive
          (original_update_id, client_id, week_start, payload, answers, files)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.client_id, row.week_start, JSON.stringify(row), JSON.stringify(answers), JSON.stringify(files)],
      );
      await connection.query('DELETE FROM weekly_updates WHERE id = ?', [row.id]);
    }
  }
}

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

  // Remove the accidental development-only question and its old answers before
  // preserving the new form definition. It has no stable identifier to migrate.
  await connection.query(`
    DELETE answer FROM weekly_update_answers answer
    JOIN update_questions question ON question.id = answer.question_id
    WHERE LOWER(TRIM(question.question)) = 'asasdas'
  `);
  await connection.query("DELETE FROM update_questions WHERE LOWER(TRIM(question)) = 'asasdas'");

  const publishedFormId = await ensurePublishedUpdateForm(connection);
  await addColumnIfMissing(connection, 'weekly_updates', 'form_id', 'form_id INT NULL AFTER client_id');
  await addColumnIfMissing(connection, 'weekly_updates', 'answers', 'answers JSON NULL AFTER form_id');
  await addColumnIfMissing(connection, 'weekly_updates', 'auto_snapshot', 'auto_snapshot JSON NULL AFTER answers');
  await addColumnIfMissing(connection, 'weekly_updates', 'status', "status ENUM('draft', 'submitted') NOT NULL DEFAULT 'submitted' AFTER auto_snapshot");
  await addColumnIfMissing(connection, 'weekly_updates', 'score', 'score INT NULL AFTER status');
  await addColumnIfMissing(connection, 'weekly_updates', 'score_tier_title', 'score_tier_title VARCHAR(120) NULL AFTER score');
  await addColumnIfMissing(connection, 'weekly_updates', 'on_time', 'on_time BOOLEAN NOT NULL DEFAULT TRUE AFTER score_tier_title');
  await connection.query('ALTER TABLE weekly_updates MODIFY submitted_at TIMESTAMP NULL DEFAULT NULL');

  const [[formForeignKey]] = await connection.query(`
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'weekly_updates'
      AND COLUMN_NAME = 'form_id' AND REFERENCED_TABLE_NAME = 'update_forms'
    LIMIT 1
  `);
  if (!formForeignKey) {
    await connection.query('ALTER TABLE weekly_updates ADD CONSTRAINT fk_weekly_updates_form FOREIGN KEY (form_id) REFERENCES update_forms(id)');
  }

  await migrateLegacyWeeklyUpdates(connection, publishedFormId);
  await archiveDuplicateWeeklyUpdates(connection);

  const [[uniqueClientWeek]] = await connection.query(`
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'weekly_updates'
      AND INDEX_NAME = 'unique_client_week'
    LIMIT 1
  `);
  if (!uniqueClientWeek) {
    await connection.query('ALTER TABLE weekly_updates ADD UNIQUE INDEX unique_client_week (client_id, week_start)');
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

router.get('/builder/draft', authorizeRole(['coach', 'admin']), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await ensurePublishedUpdateForm(connection);
    const draft = await getOrCreateUpdateDraft(connection);
    res.json({ id: draft.id, version: draft.version, definition: parseFormDefinition(draft.definition) || defaultUpdateForm });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Δεν φορτώθηκε το πρόχειρο του update.' });
  } finally { connection?.release(); }
});

router.put('/builder/draft', authorizeRole(['coach', 'admin']), async (req, res) => {
  let connection;
  try {
    const definition = req.body?.definition;
    const errors = validateFormDefinition(definition);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Μη έγκυρο πρόχειρο.', errors });
    connection = await pool.getConnection();
    await ensurePublishedUpdateForm(connection);
    const draft = await getOrCreateUpdateDraft(connection);
    await connection.query('UPDATE update_forms SET definition = ? WHERE id = ?', [JSON.stringify(definition), draft.id]);
    res.json({ id: draft.id, version: draft.version, definition });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Δεν αποθηκεύτηκε το πρόχειρο.' });
  } finally { connection?.release(); }
});

router.post('/builder/publish', authorizeRole(['coach', 'admin']), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await ensurePublishedUpdateForm(connection);
    const draft = await getOrCreateUpdateDraft(connection);
    const definition = parseFormDefinition(draft.definition) || defaultUpdateForm;
    const errors = validateFormDefinition(definition, { publish: true });
    if (Object.keys(errors).length) {
      return res.status(400).json({
        message: 'Διόρθωσε πριν τη δημοσίευση: ' + Object.values(errors).join(' '),
        errors,
      });
    }
    await connection.query("UPDATE update_forms SET status = 'published', published_at = NOW(), published_by = ? WHERE id = ?", [req.user.id, draft.id]);
    // A client may already have opened this week's update. Keep its answers,
    // but point that unfinished draft at the newly saved form immediately.
    await connection.query("UPDATE weekly_updates SET form_id = ? WHERE status = 'draft'", [draft.id]);
    res.json({ id: draft.id, version: draft.version, definition, publishedAt: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Δεν δημοσιεύτηκε το ερωτηματολόγιο.' });
  } finally { connection?.release(); }
});

router.get('/form', authorizeRole(['client']), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const weekStart = getWeekStart();
    let [[update]] = await connection.query(
      `SELECT weekly.id, weekly.status, weekly.answers, weekly.auto_snapshot AS autoSnapshot,
              weekly.score, weekly.score_tier_title AS scoreTierTitle, weekly.on_time AS onTime,
              form.id AS formId, form.definition
       FROM weekly_updates weekly
       JOIN update_forms form ON form.id = weekly.form_id
       WHERE weekly.client_id = ? AND weekly.week_start = ? LIMIT 1`,
      [req.user.id, weekStart],
    );
    // Submitted updates must retain the exact form version they were answered
    // with. A draft, however, must always render the latest published version
    // after the coach presses “Αποθήκευση”, otherwise the client stays on a
    // stale JSON definition until a new weekly update is created.
    const [publishedRows] = await connection.query(
      "SELECT id AS formId, definition FROM update_forms WHERE status = 'published' ORDER BY version DESC LIMIT 1",
    );
    const activeFormRow = publishedRows[0];
    const [[demoClient]] = await connection.query(
      'SELECT is_demo, demo_updates_enabled FROM clients WHERE user_id = ? LIMIT 1',
      [req.user.id],
    );
    const repeatableDemoUpdate = Boolean(demoClient?.is_demo && demoClient?.demo_updates_enabled);

    // The dedicated demo account is intentionally repeatable: opening the
    // form again after a submission starts a fresh draft for testing. Real
    // clients always retain their submitted result for the current week.
    if (repeatableDemoUpdate && update?.status === 'submitted' && activeFormRow) {
      await connection.query(
        `UPDATE weekly_updates
         SET form_id = ?, answers = '{}', auto_snapshot = '{}', status = 'draft',
             score = NULL, weekly_score = NULL, score_tier_title = NULL,
             on_time = 0, is_timely = 0, submitted_at = NULL
         WHERE id = ?`,
        [activeFormRow.formId, update.id],
      );
      await connection.query('DELETE FROM weekly_update_files WHERE update_id = ?', [update.id]);
      update = {
        ...update,
        status: 'draft',
        answers: '{}',
        autoSnapshot: '{}',
        score: null,
        scoreTierTitle: null,
        onTime: 0,
        formId: activeFormRow.formId,
        definition: activeFormRow.definition,
      };
    }
    let formRow = update?.status === 'submitted' ? update : activeFormRow;
    if (update?.status === 'draft' && activeFormRow && Number(update.formId) !== Number(activeFormRow.formId)) {
      await connection.query('UPDATE weekly_updates SET form_id = ? WHERE id = ?', [activeFormRow.formId, update.id]);
    }
    const form = typeof formRow?.definition === 'string' ? JSON.parse(formRow.definition) : formRow?.definition;
    await ensurePointsSchema(connection);
    const [[pointsSettings]] = await connection.query('SELECT weekly_update_points, is_active FROM points_settings WHERE id = 1');
    const timelyPoints = pointsSettings?.is_active ? Number(pointsSettings.weekly_update_points || 0) : 0;
    // Summary data for the sidebar: current answers stay in the draft, while
    // the comparison and consistency run come only from submitted updates.
    const [[previousUpdate]] = await connection.query(
      `SELECT answers FROM weekly_updates
       WHERE client_id = ? AND status = 'submitted' AND week_start < ?
       ORDER BY week_start DESC, id DESC LIMIT 1`,
      [req.user.id, weekStart],
    );
    const [timelyUpdates] = await connection.query(
      `SELECT DATE_FORMAT(week_start, '%Y-%m-%d') AS weekStart
       FROM weekly_updates
       WHERE client_id = ? AND status = 'submitted' AND on_time = 1 AND week_start < ?
       ORDER BY week_start DESC, id DESC LIMIT 52`,
      [req.user.id, weekStart],
    );
    let timelyStreak = 0;
    const expectedWeek = new Date(`${weekStart}T12:00:00.000Z`);
    expectedWeek.setUTCDate(expectedWeek.getUTCDate() - 7);
    for (const timelyUpdate of timelyUpdates) {
      if (String(timelyUpdate.weekStart) !== expectedWeek.toISOString().slice(0, 10)) break;
      timelyStreak += 1;
      expectedWeek.setUTCDate(expectedWeek.getUTCDate() - 7);
    }
    connection.release();
    if (!formRow || !form) return res.status(404).json({ message: 'Δεν υπάρχει δημοσιευμένη φόρμα update.' });
    res.json({
      formId: formRow.formId,
      form: { ...form, settings: { ...(form.settings || {}), weeklyUpdatePoints: timelyPoints } },
      draft: update?.status === 'draft' ? {
        updateId: update.id,
        answers: typeof update.answers === 'string' ? JSON.parse(update.answers || '{}') : (update.answers || {}),
        autoSnapshot: typeof update.autoSnapshot === 'string' ? JSON.parse(update.autoSnapshot || '{}') : (update.autoSnapshot || {}),
      } : null,
      submitted: update?.status === 'submitted' ? {
        score: update.score,
        tierTitle: update.scoreTierTitle,
        onTime: Boolean(update.onTime),
        answers: typeof update.answers === 'string' ? JSON.parse(update.answers || '{}') : (update.answers || {}),
        showScoreToClient: form.settings?.showScoreToClient !== false,
        scoreNote: form.scoreNote || '',
        tier: update.score !== null && update.score !== undefined
          ? (form.scoreTiers || []).find((item) => Number(update.score) >= Number(item.min) && Number(update.score) <= Number(item.max)) || null
          : null,
      } : null,
      timelyPoints,
      previousAnswers: previousUpdate
        ? (typeof previousUpdate.answers === 'string' ? JSON.parse(previousUpdate.answers || '{}') : (previousUpdate.answers || {}))
        : {},
      timelyStreak,
    });
  } catch (error) {
    connection?.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/draft', authorizeRole(['client']), async (req, res) => {
  let connection;
  try {
    const answers = req.body?.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return res.status(400).json({ message: 'Μη έγκυρο πρόχειρο update.' });
    connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const weekStart = getWeekStart();
    const [[existing]] = await connection.query('SELECT id, status FROM weekly_updates WHERE client_id = ? AND week_start = ? LIMIT 1', [req.user.id, weekStart]);
    if (existing?.status === 'submitted') {
      connection.release();
      return res.status(409).json({ message: 'Το update αυτής της εβδομάδας έχει ήδη υποβληθεί.' });
    }
    const [[published]] = await connection.query("SELECT id FROM update_forms WHERE status = 'published' ORDER BY version DESC LIMIT 1");
    if (!published) throw new Error('Δεν υπάρχει δημοσιευμένη φόρμα update.');
    const snapshot = req.body?.autoSnapshot && typeof req.body.autoSnapshot === 'object' ? req.body.autoSnapshot : {};
    let updateId = existing?.id;
    if (updateId) {
      await connection.query('UPDATE weekly_updates SET answers = ?, auto_snapshot = ?, form_id = ?, status = \'draft\', submitted_at = NULL WHERE id = ?', [JSON.stringify(answers), JSON.stringify(snapshot), published.id, updateId]);
    } else {
      const [result] = await connection.query(
        "INSERT INTO weekly_updates (client_id, form_id, week_start, answers, auto_snapshot, status, submitted_at) VALUES (?, ?, ?, ?, ?, 'draft', NULL)",
        [req.user.id, published.id, weekStart, JSON.stringify(answers), JSON.stringify(snapshot)],
      );
      updateId = result.insertId;
    }
    connection.release();
    res.json({ updateId, savedAt: new Date().toISOString() });
  } catch (error) {
    connection?.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/submit-form', authorizeRole(['client']), upload.array('files', 12), async (req, res) => {
  let connection;
  try {
    const answers = JSON.parse(req.body?.answers || '{}');
    let fileSlots = [];
    try { fileSlots = JSON.parse(req.body?.fileSlots || '[]'); } catch { fileSlots = []; }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return res.status(400).json({ message: 'Μη έγκυρες απαντήσεις.' });
    connection = await pool.getConnection();
    await ensureWeeklyUpdateSchema(connection);
    const weekStart = getWeekStart();
    const [[update]] = await connection.query(
      `SELECT weekly.id, weekly.status, weekly.form_id AS formId, form.definition
       FROM weekly_updates weekly JOIN update_forms form ON form.id = weekly.form_id
       WHERE weekly.client_id = ? AND weekly.week_start = ? LIMIT 1`,
      [req.user.id, weekStart],
    );
    if (update?.status === 'submitted') return res.status(409).json({ message: 'Το update αυτής της εβδομάδας έχει ήδη υποβληθεί.' });
    let formRow = update;
    if (!formRow) {
      const [rows] = await connection.query("SELECT id AS formId, definition FROM update_forms WHERE status = 'published' ORDER BY version DESC LIMIT 1");
      formRow = rows[0];
    }
    if (!formRow) throw new Error('Δεν υπάρχει δημοσιευμένη φόρμα update.');
    const form = typeof formRow.definition === 'string' ? JSON.parse(formRow.definition) : formRow.definition;
    const errors = Object.assign({}, ...form.steps.map((step) => validateStep(step, answers, form.settings?.photosRequired)));
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Λείπουν υποχρεωτικές απαντήσεις.', errors });
    try { await optimizeUploadedImages((req.files || []).filter((file) => file.mimetype !== 'application/pdf')); } catch { return res.status(400).json({ message: 'Μία φωτογραφία δεν είναι έγκυρη.' }); }
    const [scheduleRows] = await connection.query('SELECT * FROM update_schedule WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1', [req.user.id]);
    const timing = getWeeklyUpdateTiming(scheduleRows[0] || null);
    const result = computeScore(form, answers);
    let updateId = update?.id;
    await connection.beginTransaction();
    if (updateId) {
      await connection.query(`UPDATE weekly_updates SET answers = ?, status = 'submitted', score = ?, weekly_score = ?, score_tier_title = ?, on_time = ?, is_timely = ?, submitted_at = NOW() WHERE id = ?`, [JSON.stringify(answers), result.score, result.score, result.tier?.title || null, timing.isTimely ? 1 : 0, timing.isTimely ? 1 : 0, updateId]);
    } else {
      const [created] = await connection.query(`INSERT INTO weekly_updates (client_id, form_id, week_start, answers, auto_snapshot, status, score, weekly_score, score_tier_title, on_time, is_timely, submitted_at) VALUES (?, ?, ?, ?, '{}', 'submitted', ?, ?, ?, ?, ?, NOW())`, [req.user.id, formRow.formId, weekStart, JSON.stringify(answers), result.score, result.score, result.tier?.title || null, timing.isTimely ? 1 : 0, timing.isTimely ? 1 : 0]);
      updateId = created.insertId;
    }
    if (req.files?.length) await connection.query(
      'INSERT INTO weekly_update_files (update_id, file_url, file_type, original_name, angle) VALUES ?',
      [req.files.map((file, index) => {
        const slot = String(fileSlots[index] || '').toLocaleLowerCase('el-GR');
        const angle = slot.includes('μπροστ') ? 'front' : slot.includes('πλ') ? 'side' : slot.includes('πισ') ? 'back' : 'other';
        return [updateId, file.path.replace(/\\/g, '/'), file.mimetype === 'application/pdf' ? 'pdf' : 'photo', file.originalname, angle];
      })],
    );
    await connection.commit();
    try {
      await registerWeeklyUpdatePhotos(connection, req.user.id);
    } catch (mediaError) {
      // The update is valid even if the non-critical Media Library mirror
      // cannot be refreshed. A later Media visit backfills it safely.
      console.error('Weekly update media-library sync failed:', mediaError);
    }
    const pointsResult = await awardWeeklyUpdatePoints(connection, { clientId: req.user.id, updateId, weekStart, timely: timing.isTimely });
    // Keep the coach workflow connected to the versioned update: the
    // notification opens this exact submission rather than the generic list.
    try {
      const [[client]] = await connection.query('SELECT full_name, email FROM users WHERE id = ? LIMIT 1', [req.user.id]);
      const clientName = client?.full_name || client?.email || 'Πελάτης';
      await notifyCoaches(connection, {
        clientId: req.user.id,
        type: 'new_update',
        title: 'Νέο εβδομαδιαίο update',
        body: `${clientName} υπέβαλε το εβδομαδιαίο update του.`,
        linkUrl: `/coach/updates/${updateId}`,
      });
    } catch (notificationError) {
      // A notification problem must never undo a submitted update.
      console.error('Coach update notification failed:', notificationError);
    }
    connection.release();
    res.status(201).json({ updateId, score: result.score, tier: result.tier, showScoreToClient: form.settings?.showScoreToClient !== false, scoreNote: form.scoreNote, pointsAwarded: Boolean(pointsResult?.awarded), pointsEarned: Number(pointsResult?.points || 0), weeklyStreak: Number(pointsResult?.streak || 0), nextStreakBonusIn: pointsResult?.nextBonusIn ?? null, nextStreakBonusPoints: Number(pointsResult?.nextStreakBonusPoints || 0), streakBonusAwarded: Boolean(pointsResult?.bonusAwarded) });
  } catch (error) {
    try { await connection?.rollback(); } catch {}
    connection?.release();
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
    const [[activeForm]] = await connection.query(
      "SELECT id, definition FROM update_forms WHERE status = 'published' ORDER BY version DESC LIMIT 1",
    );
    const formDefinition = typeof activeForm?.definition === 'string'
      ? JSON.parse(activeForm.definition)
      : (activeForm?.definition || defaultUpdateForm);
    const answerDocument = answersFromLegacyEntries(answers, activeQuestions);
    const requiredIds = activeQuestions.filter((q) => q.is_required).map((q) => q.id);
    const answeredIds = new Set(
      answers.filter((a) => a && String(a.answer ?? '').trim() !== '').map((a) => Number(a.question_id))
    );
    const missing = requiredIds.filter((id) => !answeredIds.has(id));
    if (missing.length) {
      connection.release();
      return res.status(400).json({ message: 'Λείπουν υποχρεωτικές απαντήσεις.', missingQuestionIds: missing });
    }
    const formErrors = Object.assign({}, ...formDefinition.steps.map((step) => validateStep(step, answerDocument, formDefinition.settings?.photosRequired)));
    if (Object.keys(formErrors).length) {
      connection.release();
      return res.status(400).json({ message: 'Λείπουν υποχρεωτικές απαντήσεις.', errors: formErrors });
    }

    try {
      await optimizeUploadedImages((req.files || []).filter((file) => file.mimetype !== 'application/pdf'));
    } catch {
      connection.release();
      return res.status(400).json({ message: 'Μία από τις φωτογραφίες δεν είναι έγκυρη.' });
    }

    await connection.beginTransaction();

    const calculatedScore = computeScore(formDefinition, answerDocument);
    const weeklyScore = calculatedScore.score ?? calculateWeeklyScore(answers, activeQuestions);
    const [result] = await connection.query(
      `INSERT INTO weekly_updates
        (client_id, form_id, week_start, is_timely, weekly_score, answers, auto_snapshot, status, score, score_tier_title, on_time, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, NOW())`,
      [req.user.id, activeForm?.id || null, weekStart, timing.isTimely ? 1 : 0, weeklyScore, JSON.stringify(answerDocument), JSON.stringify({}), weeklyScore, calculatedScore.tier?.title || null, timing.isTimely ? 1 : 0]
    );
    const updateId = result.insertId;

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
  const [fileRows] = await connection.query(
    'SELECT update_id, question_id, file_url, file_type, original_name, angle FROM weekly_update_files WHERE update_id IN (?)',
    [ids]
  );

  const formIds = [...new Set(updates.map((update) => update.form_id).filter(Boolean))];
  const [forms] = formIds.length
    ? await connection.query('SELECT id, definition FROM update_forms WHERE id IN (?)', [formIds])
    : [[]];
  const formsById = new Map(forms.map((form) => [form.id, parseFormDefinition(form.definition)]));

  return updates.map((update) => {
    const form = formsById.get(update.form_id);
    const document = parseFormDefinition(update.answers) || {};
    const versionedAnswers = form
      ? form.steps.flatMap((step) => step.questions
        .filter((question) => question.showToCoach && isVisible(question, document) && document[question.id] !== undefined)
        .map((question) => ({ question_id: question.id, question: question.label, short_label: question.shortLabel, type: question.type, answer: document[question.id], step: step.title, standard_key: question.id })))
      : [];
    return {
      ...update,
      answers: versionedAnswers,
      autoSnapshot: parseFormDefinition(update.auto_snapshot) || {},
      files: fileRows.filter((row) => row.update_id === update.id),
    };
  });
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
    if (req.query.scoreBelow === '60') {
      filters.push('COALESCE(w.score, w.weekly_score) < 60');
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [[{ total }]] = await connection.query(`SELECT COUNT(*) AS total FROM weekly_updates w ${whereClause}`, values);
    const [rows] = await connection.query(
      `SELECT w.id, w.client_id, w.form_id, w.answers, w.auto_snapshot, w.submitted_at, DATE_FORMAT(w.week_start, '%Y-%m-%d') AS week_start, w.is_read, w.weekly_score,
              COALESCE(w.score, w.weekly_score) AS score, w.score_tier_title,
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
      `SELECT w.id, w.client_id, w.form_id, w.answers, w.auto_snapshot, w.submitted_at, DATE_FORMAT(w.week_start, '%Y-%m-%d') AS week_start, w.is_read, w.weekly_score,
              COALESCE(w.score, w.weekly_score) AS score, w.score_tier_title,
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
