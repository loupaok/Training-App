CREATE TABLE IF NOT EXISTS activity_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category ENUM('update','workout','payment','points','plan','message','account') NOT NULL,
  type VARCHAR(120) NOT NULL,
  actor ENUM('client','coach','system') NOT NULL DEFAULT 'system',
  actor_user_id INT NULL,
  title VARCHAR(255) NOT NULL,
  detail TEXT NULL,
  status ENUM('pending','done','problem') NULL,
  ref_kind ENUM('update','payment','message','workout','plan') NULL,
  ref_id VARCHAR(80) NULL,
  meta JSON NULL,
  INDEX idx_activity_events_client_created (client_id, created_at DESC),
  INDEX idx_activity_events_client_status (client_id, status),
  CONSTRAINT fk_activity_events_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

UPDATE activity_events
SET category = CASE
  WHEN LOWER(title) LIKE '%payment%' OR LOWER(title) LIKE '%πληρωμ%' OR LOWER(title) LIKE '%συνδρομ%' THEN 'payment'
  WHEN LOWER(title) LIKE '%point%' OR LOWER(title) LIKE '%πόντ%' THEN 'points'
  WHEN LOWER(title) LIKE '%nutrition%' OR LOWER(title) LIKE '%διατροφ%' OR LOWER(title) LIKE '%training plan%' OR LOWER(title) LIKE '%προπονη%' THEN 'plan'
  WHEN LOWER(title) LIKE '%message%' OR LOWER(title) LIKE '%μήνυμα%' THEN 'message'
  WHEN LOWER(title) LIKE '%weekly update%' OR LOWER(title) LIKE '%εβδομαδια%' THEN 'update'
  WHEN LOWER(title) LIKE '%personal information%' OR LOWER(title) LIKE '%προσωπικ%' THEN 'account'
  WHEN LOWER(title) LIKE '%workout%' OR LOWER(title) LIKE '%ολοκλήρωσε προπόνηση%' THEN 'workout'
  ELSE category
END
WHERE type = 'legacy.import' OR (category = 'account' AND type = 'account.changed');
