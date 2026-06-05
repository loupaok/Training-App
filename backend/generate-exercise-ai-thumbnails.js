import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';

dotenv.config();

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.OPENAI_API_KEY;
const model = args.model || 'gpt-image-1-mini';
const size = args.size || '1536x1024';
const quality = args.quality || 'low';
const limit = Number(args.limit || 10);
const offset = Number(args.offset || 0);
const overwrite = Boolean(args.overwrite);
const dryRun = Boolean(args['dry-run']);
const outputDir = path.join(process.cwd(), 'uploads', 'exercises', 'ai');

if (!apiKey && !dryRun) {
  console.error('OPENAI_API_KEY is missing. Set it in backend/.env or your shell, or run with --dry-run.');
  process.exit(1);
}

if (!Number.isInteger(limit) || limit < 1) {
  console.error('--limit must be a positive number.');
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'coach_management',
});

try {
  await fs.mkdir(outputDir, { recursive: true });
  await ensureMediaTables(connection);

  const where = overwrite ? '' : "WHERE image_url IS NULL OR image_url = ''";
  const [exercises] = await connection.query(
    `SELECT id, name, muscle_group AS muscleGroup, secondary_muscles AS secondaryMuscles,
            equipment, level, type, image_url AS imageUrl
     FROM exercises
     ${where}
     ORDER BY id
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  if (!exercises.length) {
    console.log('No exercises found for this batch.');
    process.exit(0);
  }

  console.log(`Preparing ${exercises.length} exercise thumbnail(s). model=${model}, size=${size}, quality=${quality}, overwrite=${overwrite}`);

  for (const exercise of exercises) {
    const prompt = buildPrompt(exercise);
    console.log(`\n[${exercise.id}] ${exercise.name}`);
    console.log(prompt);

    if (dryRun) {
      continue;
    }

    const imageBuffer = await generateImage(prompt);
    const fileName = `exercise-ai-${exercise.id}-${slugify(exercise.name)}.png`;
    const filePath = path.join(outputDir, fileName);
    const imageUrl = `/uploads/exercises/ai/${fileName}`;

    await fs.writeFile(filePath, imageBuffer);
    await archiveCurrentExerciseImage(connection, exercise);
    await connection.query('UPDATE exercises SET image_url = ? WHERE id = ?', [imageUrl, exercise.id]);

    console.log(`Saved ${imageUrl}`);
  }

  console.log('\nDone.');
} finally {
  await connection.end();
}

async function generateImage(prompt) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      n: 1,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || `Image generation failed with ${response.status}`);
  }

  const base64 = data.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error('Image generation did not return b64_json.');
  }

  return Buffer.from(base64, 'base64');
}

function buildPrompt(exercise) {
  return [
    'Use case: photorealistic-natural',
    'Asset type: exercise library thumbnail for a coaching dashboard',
    `Primary request: photorealistic gym action photo of the exercise "${exercise.name}".`,
    `Exercise context: primary muscle group ${exercise.muscleGroup || 'unknown'}, equipment ${exercise.equipment || 'gym equipment'}, level ${exercise.level || 'intermediate'}, type ${exercise.type || 'strength training'}.`,
    'Scene/backdrop: modern dark commercial gym, black rubber flooring, squat racks, benches, plates, subtle mirrors, no brand logos.',
    'Subject: athletic adult demonstrating the exercise with correct form, realistic anatomy, neutral training clothes.',
    'Style/medium: high-end realistic fitness photography, not illustration, not cartoon.',
    'Composition/framing: landscape 3:2 thumbnail, full exercise movement visible, centered subject, enough padding for cropping in cards.',
    'Lighting/mood: dramatic but clean gym lighting, cool white LED strips, crisp focus, shallow background depth.',
    'Color palette: black, charcoal, steel, muted skin tones, small cool highlights.',
    'Constraints: one clear exercise demonstration, no text, no watermark, no logos, no distorted hands, no extra limbs, no unsafe equipment setup.',
    'Avoid: collage, diagrams, labels, over-stylized bodybuilding poster, blurry face, cropped equipment, fantasy lighting.',
  ].join('\n');
}

async function ensureMediaTables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS media_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES media_folders(id) ON DELETE SET NULL,
      INDEX idx_parent_id (parent_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      asset_type ENUM('photo', 'icon') DEFAULT 'photo',
      url VARCHAR(600) NOT NULL,
      source VARCHAR(80) DEFAULT 'upload',
      folder_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE SET NULL,
      INDEX idx_asset_type (asset_type),
      INDEX idx_source (source),
      INDEX idx_folder_id (folder_id)
    )
  `);
}

async function archiveCurrentExerciseImage(db, exercise) {
  if (!exercise.imageUrl) return;

  const [[existingAsset]] = await db.query(
    'SELECT id FROM media_assets WHERE url = ? LIMIT 1',
    [exercise.imageUrl]
  );

  if (existingAsset) return;

  await db.query(
    'INSERT INTO media_assets (title, asset_type, url, source, folder_id) VALUES (?, "photo", ?, "exercise_archive", NULL)',
    [`${exercise.name} - old thumbnail`, exercise.imageUrl]
  );
}

function parseArgs(values) {
  return values.reduce((parsed, value, index) => {
    if (!value.startsWith('--')) return parsed;

    const key = value.slice(2);
    const next = values[index + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    return parsed;
  }, {});
}

function slugify(value) {
  return String(value || 'exercise')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 80);
}
