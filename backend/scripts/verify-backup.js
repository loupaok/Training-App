import { access, readFile } from 'fs/promises';
import path from 'path';

const backupPath = process.argv[2];

if (!backupPath) {
  console.error('Usage: node scripts/verify-backup.js <backup-folder>');
  process.exit(1);
}

try {
  const manifest = JSON.parse(await readFile(path.join(backupPath, 'manifest.json'), 'utf8'));
  await access(path.join(backupPath, 'database.sql'));
  await access(path.join(backupPath, 'uploads'));
  console.log(`Backup is structurally valid: ${manifest.createdAt}`);
} catch (error) {
  console.error(`Backup verification failed: ${error.message}`);
  process.exitCode = 1;
}
