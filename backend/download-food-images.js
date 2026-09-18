import dotenv from 'dotenv';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';

dotenv.config();

// One-time (re-runnable) script: downloads every externally-hosted food
// image (currently Unsplash URLs) to backend/uploads/foods/ and updates
// image_url to the local path. Safe to re-run — only touches rows whose
// image_url still points to an external http(s) URL; already-local rows
// (starting with /uploads/) are left untouched.

const uploadDir = path.join(process.cwd(), 'uploads', 'foods');
fs.mkdirSync(uploadDir, { recursive: true });

function extensionFromContentType(contentType) {
  if (!contentType) return '.jpg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  return '.jpg';
}

async function downloadImage(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());
  const finalPath = destPath + extensionFromContentType(contentType);
  fs.writeFileSync(finalPath, buffer);
  return finalPath;
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [foods] = await connection.query(
  `SELECT id, name_gr, image_url FROM foods WHERE image_url LIKE 'http%' ORDER BY id`
);

console.log(`Found ${foods.length} foods with an externally-hosted image.`);

let downloaded = 0;
let failed = 0;

for (const food of foods) {
  try {
    const destBase = path.join(uploadDir, `food-${food.id}-${Date.now()}`);
    const finalPath = await downloadImage(food.image_url, destBase);
    const publicUrl = `/uploads/foods/${path.basename(finalPath)}`;
    await connection.query('UPDATE foods SET image_url = ? WHERE id = ?', [publicUrl, food.id]);
    downloaded += 1;
    console.log(`✓ ${food.name_gr} -> ${publicUrl}`);
  } catch (error) {
    failed += 1;
    console.warn(`✗ ${food.name_gr} — ${error.message}`);
  }
}

console.log(`Done. Downloaded: ${downloaded}, failed: ${failed}.`);
await connection.end();
