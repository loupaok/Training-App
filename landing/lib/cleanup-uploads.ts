import { readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";

const CONTENT_DIR = path.join(process.cwd(), "content");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const CONTENT_EXTENSIONS = new Set([".yaml", ".yml", ".json", ".md", ".mdoc"]);

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

// Keystatic's local-mode writer swaps an image field's filename value when
// you upload a replacement, but it never removes the file the old value
// pointed to — so every "change image" in the admin UI leaves the previous
// upload sitting in /public/uploads forever. This does a simple reachability
// sweep instead of parsing each field by schema: any uploaded filename that
// no longer appears as a substring in any content file is unreferenced and
// gets deleted.
export async function cleanupOrphanedUploads(): Promise<{ deleted: string[] }> {
  const [contentFiles, uploadEntries] = await Promise.all([
    walk(CONTENT_DIR),
    readdir(UPLOADS_DIR, { withFileTypes: true }).catch(() => []),
  ]);

  const relevantContentFiles = contentFiles.filter((file) => CONTENT_EXTENSIONS.has(path.extname(file)));
  const contentText = (
    await Promise.all(
      relevantContentFiles.map((file) => readFile(file, "utf8").catch(() => ""))
    )
  ).join("\n");

  const deleted: string[] = [];
  for (const entry of uploadEntries) {
    if (!entry.isFile()) continue;
    if (entry.name === ".gitkeep") continue;
    if (!contentText.includes(entry.name)) {
      const fullPath = path.join(UPLOADS_DIR, entry.name);
      try {
        const info = await stat(fullPath);
        // Skip anything uploaded in the last 30s — it may be a file that was
        // just written but whose referencing content entry hasn't saved yet.
        if (Date.now() - info.mtimeMs < 30_000) continue;
        await unlink(fullPath);
        deleted.push(entry.name);
      } catch (error) {
        console.error(`Failed to delete orphaned upload ${entry.name}:`, error);
      }
    }
  }

  if (deleted.length) {
    console.log(`Cleaned up ${deleted.length} orphaned upload(s):`, deleted);
  }
  return { deleted };
}
