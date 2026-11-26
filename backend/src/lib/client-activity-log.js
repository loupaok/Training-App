const EVENT_CATEGORIES = new Set(['update', 'workout', 'payment', 'points', 'plan', 'message', 'account']);
const EVENT_STATUSES = new Set(['pending', 'done', 'problem']);
let schemaReady = false;

function inferEvent(action = '') {
  const value = String(action).toLocaleLowerCase('en-US');
  if (value.includes('payment') || value.includes('πληρωμ') || value.includes('συνδρομ')) return { category: 'payment', type: 'payment.changed' };
  if (value.includes('point') || value.includes('πόντ')) return { category: 'points', type: 'points.changed' };
  if (value.includes('nutrition') || value.includes('διατροφ') || value.includes('training plan') || value.includes('προπονη')) return { category: 'plan', type: 'plan.changed' };
  if (value.includes('message') || value.includes('μήνυμα')) return { category: 'message', type: 'message.changed' };
  if (value.includes('weekly update') || value.includes('εβδομαδια')) return { category: 'update', type: 'update.changed' };
  if (value.includes('workout') || value.includes('προπόνησ')) return { category: 'workout', type: 'workout.changed' };
  return { category: 'account', type: 'account.changed' };
}

export async function ensureClientActivityLogSchema(connection) {
  if (schemaReady) return;
  await connection.query(`
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
    )
  `);

  // Preserve the activity that was recorded before the unified event stream.
  const [[legacyTable]] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'client_activity_log'`,
  );
  if (legacyTable) {
    const [[eventCount]] = await connection.query('SELECT COUNT(*) AS total FROM activity_events');
    if (Number(eventCount.total) === 0) {
      await connection.query(`
        INSERT INTO activity_events
          (client_id, created_at, category, type, actor, actor_user_id, title, detail, meta)
        SELECT log.client_id, log.created_at, 'account', 'legacy.import',
               CASE WHEN u.role = 'client' THEN 'client' WHEN u.id IS NULL THEN 'system' ELSE 'coach' END,
               CASE WHEN u.id IS NULL THEN NULL ELSE log.performed_by END, log.action, log.details,
               JSON_OBJECT('legacyId', log.id, 'performedByName', log.performed_by_name)
        FROM client_activity_log log
        INNER JOIN users client ON client.id = log.client_id
        LEFT JOIN users u ON u.id = log.performed_by
      `);
    }
  }

  // Older records were imported before categories existed. Classify them once
  // from their stored title so the Activity UI does not render every historic
  // payment or plan event with the generic sparkles icon.
  await connection.query(`
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
    WHERE type = 'legacy.import' OR (category = 'account' AND type = 'account.changed')
  `);
  schemaReady = true;
}

export async function logActivity(connection, event) {
  await ensureClientActivityLogSchema(connection);
  const inferred = inferEvent(event.title || event.action);
  const category = EVENT_CATEGORIES.has(event.category) ? event.category : inferred.category;
  const status = EVENT_STATUSES.has(event.status) ? event.status : null;
  const actor = ['client', 'coach', 'system'].includes(event.actor) ? event.actor : 'system';
  const ref = event.ref || null;
  const [result] = await connection.query(
    `INSERT INTO activity_events
      (client_id, category, type, actor, actor_user_id, title, detail, status, ref_kind, ref_id, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(event.clientId), category, String(event.type || inferred.type).slice(0, 120), actor, event.actorUserId ?? null,
      String(event.title || event.action || 'Ενημέρωση').slice(0, 255), event.detail ?? null, status,
      ref?.kind ?? null, ref?.id == null ? null : String(ref.id), event.meta == null ? null : JSON.stringify(event.meta)],
  );
  return result.insertId;
}

// Compatibility adapter: all existing action logs now use the canonical table.
export async function logClientActivity(connection, { clientId, action, performedBy, performedByName, details = null }) {
  let actor = 'system';
  if (performedBy) {
    const [rows] = await connection.query('SELECT role FROM users WHERE id = ? LIMIT 1', [performedBy]);
    actor = rows[0]?.role === 'client' ? 'client' : 'coach';
  }
  return logActivity(connection, {
    clientId, actor, actorUserId: performedBy || null, title: action,
    detail: details && typeof details === 'object' ? JSON.stringify(details) : details,
    meta: performedByName ? { performedByName } : null,
  });
}
