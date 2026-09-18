import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

async function findOrCreateFolder(connection, name) {
  const [[folder]] = await connection.execute(
    'SELECT id FROM media_folders WHERE name = ? ORDER BY parent_id IS NULL DESC, id LIMIT 1',
    [name]
  );
  if (folder) return folder.id;

  const [result] = await connection.execute(
    'INSERT INTO media_folders (name, parent_id) VALUES (?, NULL)',
    [name]
  );
  return result.insertId;
}

async function addAssets(connection, rows, folderId) {
  let added = 0;
  for (const row of rows) {
    // The existing schema has no unique URL key, so check before inserting.
    const [result] = await connection.execute(
      `INSERT INTO media_assets (title, asset_type, url, source, folder_id)
       SELECT ?, 'photo', ?, 'upload', ?
       WHERE NOT EXISTS (SELECT 1 FROM media_assets WHERE url = ?)`,
      [row.title, row.image_url, folderId, row.image_url]
    );
    added += result.affectedRows;
  }
  return added;
}

let connection;
let locked = false;
try {
  connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Serialize script runs so simultaneous invocations cannot create duplicates.
  const [[lock]] = await connection.query(
    "SELECT GET_LOCK('seed-media-assets', 0) AS acquired"
  );
  if (Number(lock.acquired) !== 1) throw new Error('Another media seed is running.');
  locked = true;
  await connection.beginTransaction();

  const [exercises] = await connection.query(
    `SELECT id, name AS title, image_url FROM exercises
     WHERE image_url IS NOT NULL AND image_url != '' ORDER BY id`
  );
  const [foods] = await connection.query(
    `SELECT id, name_gr AS title, image_url FROM foods
     WHERE image_url IS NOT NULL AND image_url != '' ORDER BY id`
  );

  const exerciseFolderId = await findOrCreateFolder(connection, '\u0391\u03c3\u03ba\u03ae\u03c3\u03b5\u03b9\u03c2');
  const foodFolderId = await findOrCreateFolder(connection, '\u03a4\u03c1\u03cc\u03c6\u03b9\u03bc\u03b1');
  const exercisesAdded = await addAssets(connection, exercises, exerciseFolderId);
  const foodsAdded = await addAssets(connection, foods, foodFolderId);

  await connection.commit();
  console.log(`Added ${exercisesAdded} exercises, ${foodsAdded} foods to media_assets table`);
} catch (error) {
  if (connection) await connection.rollback();
  console.error(`Media seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (connection) {
    try {
      if (locked) await connection.query("SELECT RELEASE_LOCK('seed-media-assets')");
    } finally {
      await connection.end();
    }
  }
}
