import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

// One-time (re-runnable) script: finds every food with no image_url, looks it
// up on Unsplash using name_en, and stores the first result's photo URL.
// Safe to re-run — only ever touches rows where image_url IS NULL or ''.

const accessKey = process.env.UNSPLASH_ACCESS_KEY;

if (!accessKey) {
  console.error('UNSPLASH_ACCESS_KEY is not set in backend/.env — get one at https://unsplash.com/developers, then re-run this script.');
  process.exit(1);
}

async function searchUnsplash(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1`;
  const response = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } });

  if (response.status === 403) {
    throw new Error('RATE_LIMITED');
  }
  if (!response.ok) {
    throw new Error(`Unsplash request failed (${response.status})`);
  }

  const data = await response.json();
  return data.results?.[0]?.urls?.regular || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [foods] = await connection.query(
  `SELECT id, name_gr, name_en FROM foods WHERE image_url IS NULL OR image_url = '' ORDER BY id`
);

console.log(`Found ${foods.length} foods without an image.`);

let updated = 0;
let skipped = 0;
let failed = 0;

for (const food of foods) {
  const query = food.name_en || food.name_gr;
  try {
    const imageUrl = await searchUnsplash(query);
    if (imageUrl) {
      await connection.query('UPDATE foods SET image_url = ? WHERE id = ?', [imageUrl, food.id]);
      updated += 1;
      console.log(`✓ ${food.name_gr} (${query})`);
    } else {
      skipped += 1;
      console.log(`- ${food.name_gr} (${query}) — no Unsplash results`);
    }
  } catch (error) {
    if (error.message === 'RATE_LIMITED') {
      console.warn(`Unsplash rate limit hit after ${updated} updates. Stopping early — re-run this script later to continue with the rest.`);
      break;
    }
    failed += 1;
    console.warn(`✗ ${food.name_gr} (${query}) — ${error.message}`);
  }
  // Free-tier Unsplash allows 50 req/hour; a small delay keeps this well under that.
  await sleep(400);
}

console.log(`Done. Updated: ${updated}, no results: ${skipped}, failed: ${failed}.`);
await connection.end();
