export async function ensureClientActivityLogSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS client_activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      performed_by INT NOT NULL,
      performed_by_name VARCHAR(150),
      details TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_client_activity_log_client_created (client_id, created_at)
    )
  `);
}

export async function logClientActivity(connection, { clientId, action, performedBy, performedByName, details = null }) {
  await ensureClientActivityLogSchema(connection);

  let actorName = performedByName || null;
  if (!actorName) {
    const [rows] = await connection.query(
      'SELECT full_name, email FROM users WHERE id = ? LIMIT 1',
      [performedBy]
    );
    actorName = rows[0]?.full_name || rows[0]?.email || null;
  }

  const serializedDetails = details && typeof details === 'object' ? JSON.stringify(details) : details;
  await connection.query(
    `INSERT INTO client_activity_log (client_id, action, performed_by, performed_by_name, details)
     VALUES (?, ?, ?, ?, ?)`,
    [clientId, action, performedBy, actorName, serializedDetails]
  );
}
