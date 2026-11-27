import 'dotenv/config';
import mysql from 'mysql2/promise';
import { defaultMonthlyReviewForm } from '../src/lib/update-form/default-monthly-review-form.js';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'coach_management',
});

try {
  await connection.query("ALTER TABLE update_forms ADD COLUMN kind ENUM('weekly', 'monthly') NOT NULL DEFAULT 'weekly' AFTER id").catch((error) => {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  });
  await connection.query("ALTER TABLE update_forms ADD COLUMN draft_kind VARCHAR(32) GENERATED ALWAYS AS (IF(status = 'draft', kind, NULL)) STORED").catch((error) => {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  });
  const [[oldIndex]] = await connection.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'update_forms' AND INDEX_NAME = 'unique_update_form_draft' LIMIT 1");
  if (oldIndex) await connection.query('ALTER TABLE update_forms DROP INDEX unique_update_form_draft');
  const [[kindIndex]] = await connection.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'update_forms' AND INDEX_NAME = 'unique_update_form_draft_kind' LIMIT 1");
  if (!kindIndex) await connection.query('ALTER TABLE update_forms ADD UNIQUE INDEX unique_update_form_draft_kind (draft_kind)');

  const [[monthly]] = await connection.query("SELECT id FROM update_forms WHERE kind = 'monthly' AND status = 'published' ORDER BY version DESC LIMIT 1");
  if (!monthly) {
    const [[version]] = await connection.query('SELECT COALESCE(MAX(version), 0) AS maxVersion FROM update_forms');
    await connection.query("INSERT INTO update_forms (kind, version, status, definition, published_at) VALUES ('monthly', ?, 'published', ?, NOW())", [Number(version.maxVersion || 0) + 1, JSON.stringify(defaultMonthlyReviewForm)]);
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS monthly_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      cycle_no INT NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      form_version_id INT NOT NULL,
      answers JSON NULL,
      auto_snapshot JSON NULL,
      status ENUM('open', 'draft', 'submitted', 'reviewed', 'expired') NOT NULL DEFAULT 'open',
      due_at DATETIME NOT NULL,
      submitted_at DATETIME NULL,
      reviewed_at DATETIME NULL,
      coach_reply TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_monthly_review_cycle (client_id, cycle_no),
      KEY idx_monthly_reviews_status_due (status, due_at),
      CONSTRAINT fk_monthly_reviews_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_monthly_reviews_form FOREIGN KEY (form_version_id) REFERENCES update_forms(id)
    )
  `);
  try { await connection.query('ALTER TABLE monthly_reviews ADD COLUMN auto_snapshot JSON NULL AFTER answers'); } catch (error) {
    if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
  }
  await connection.query(`
    CREATE TABLE IF NOT EXISTS monthly_review_deliveries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      review_id INT NOT NULL,
      delivery_type ENUM('reminder') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_monthly_review_delivery (review_id, delivery_type),
      CONSTRAINT fk_monthly_review_delivery_review
        FOREIGN KEY (review_id) REFERENCES monthly_reviews(id) ON DELETE CASCADE
    )
  `);
  console.log('Monthly review schema is ready.');
} finally {
  await connection.end();
}
