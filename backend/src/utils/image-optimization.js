import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const MAX_PIXELS = 40_000_000;

function optimizedPath(file) {
  const directory = path.dirname(file.path);
  const basename = path.basename(file.filename || file.path, path.extname(file.filename || file.path));
  return path.join(directory, `${basename}.webp`);
}

export async function optimizeUploadedImage(file, { maxWidth = 1600, quality = 82 } = {}) {
  if (!file?.path || !/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) return file;

  const targetPath = optimizedPath(file);
  await sharp(file.path, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toFile(targetPath);

  if (path.resolve(targetPath) !== path.resolve(file.path)) {
    await fs.unlink(file.path).catch(() => undefined);
  }

  const info = await fs.stat(targetPath);
  file.path = targetPath;
  file.filename = path.basename(targetPath);
  file.mimetype = 'image/webp';
  file.size = info.size;
  return file;
}

export async function optimizeUploadedImages(files, options) {
  return Promise.all((files || []).map((file) => optimizeUploadedImage(file, options)));
}

export async function optimizeImageBufferToFile(file, directory, filename, options) {
  if (!file?.buffer || !/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) return null;

  const { maxWidth = 1600, quality = 82 } = options || {};
  const targetPath = path.join(directory, `${path.basename(filename, path.extname(filename))}.webp`);
  await sharp(file.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toFile(targetPath);
  return targetPath;
}
