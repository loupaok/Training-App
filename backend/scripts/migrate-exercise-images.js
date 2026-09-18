import dotenv from 'dotenv';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';

dotenv.config();

// One-time (re-runnable) script: downloads every exercise image still hosted
// on GitHub's raw.githubusercontent.com (the free-exercise-db seed source)
// to backend/uploads/exercises/, points exercises.image_url at the local
// copy, and keeps the exercise_images gallery table's matching row in sync
// so the gallery/thumbnail doesn't still point at the old external URL.
//
// Safe to re-run: the WHERE clause only ever selects rows still pointing at
// githubusercontent.com, so already-migrated rows are skipped automatically.
// If a previous run downloaded the file but crashed before the DB update,
// the existing file is reused instead of re-downloaded.

const uploadDir = path.join(process.cwd(), 'uploads', 'exercises');
fs.mkdirSync(uploadDir, { recursive: true });

const RETRY_DELAY_MS = 500;
const REQUEST_DELAY_MS = 75;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadImage(url, destPath, attempt = 1) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
  } catch (error) {
    if (attempt >= 2) throw error;
    await sleep(RETRY_DELAY_MS);
    return downloadImage(url, destPath, attempt + 1);
  }
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [exercises] = await connection.query(
  `SELECT id, name, image_url FROM exercises
   WHERE image_url IS NOT NULL AND image_url LIKE '%githubusercontent.com%'
   ORDER BY id`
);

console.log(`Found ${exercises.length} exercises with a githubusercontent.com image.\n`);

let downloaded = 0;
let failed = 0;

for (const exercise of exercises) {
  const filename = `exercise_${exercise.id}.jpg`;
  const destPath = path.join(uploadDir, filename);
  const publicUrl = `/uploads/exercises/${filename}`;

  try {
    if (!fs.existsSync(destPath)) {
      await downloadImage(exercise.image_url, destPath);
      await sleep(REQUEST_DELAY_MS);
    }

    await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [publicUrl, exercise.id]);
    // Keep the gallery table's row for this same (now-stale) URL in sync too,
    // otherwise the exercise detail page's thumbnail strip still shows the
    // old external image even though exercises.image_url was updated.
    await connection.query(
      'UPDATE exercise_images SET image_url = ? WHERE exercise_id = ? AND image_url = ?',
      [publicUrl, exercise.id, exercise.image_url]
    );

    downloaded += 1;
    console.log(`✓ [${exercise.id}] ${exercise.name} -> ${publicUrl}`);
  } catch (error) {
    failed += 1;
    console.warn(`✗ [${exercise.id}] ${exercise.name} — ${error.message}`);
  }
}

console.log(`\nDownloaded ${downloaded} / Failed ${failed}`);
await connection.end();
