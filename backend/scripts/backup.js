import { createWriteStream } from 'fs';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
const backupPath = path.join(backupRoot, timestamp);
const uploadsPath = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'));
const dumpBinary = process.env.DB_DUMP_BIN || (process.platform === 'win32' ? 'mysqldump.exe' : 'mariadb-dump');
const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 30));

function runDump(outputFile) {
  const args = [
    '--single-transaction', '--routines', '--events', '--add-drop-table',
    '--host', process.env.DB_HOST || '127.0.0.1',
    '--port', String(process.env.DB_PORT || 3306),
    '--user', process.env.DB_USER || 'root',
    '--databases', process.env.DB_NAME || 'coach_management',
  ];

  return new Promise((resolve, reject) => {
    const processDump = spawn(dumpBinary, args, {
      env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const output = createWriteStream(outputFile, { flags: 'w' });
    let error = '';
    processDump.stdout.pipe(output);
    processDump.stderr.on('data', (chunk) => { error += chunk.toString(); });
    processDump.on('error', (cause) => reject(new Error(`Could not start ${dumpBinary}: ${cause.message}`)));
    processDump.on('close', (code) => {
      output.close();
      if (code === 0) resolve();
      else reject(new Error(`Database dump failed (${code}): ${error.trim()}`));
    });
  });
}

async function pruneExpiredBackups() {
  const expiresAt = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(backupRoot, { withFileTypes: true });
  await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const target = path.join(backupRoot, entry.name);
    const info = await stat(target);
    if (info.mtimeMs < expiresAt) await rm(target, { recursive: true, force: true });
  }));
}

try {
  await mkdir(backupPath, { recursive: true });
  const databaseFile = path.join(backupPath, 'database.sql');
  await runDump(databaseFile);
  try {
    await cp(uploadsPath, path.join(backupPath, 'uploads'), { recursive: true, force: false, errorOnExist: false });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(path.join(backupPath, 'uploads'));
  }
  await writeFile(path.join(backupPath, 'manifest.json'), JSON.stringify({
    createdAt: new Date().toISOString(),
    database: process.env.DB_NAME || 'coach_management',
    files: ['database.sql', 'uploads'],
  }, null, 2));
  await pruneExpiredBackups();
  console.log(`Backup completed: ${backupPath}`);
} catch (error) {
  console.error(`Backup failed: ${error.message}`);
  process.exitCode = 1;
}
