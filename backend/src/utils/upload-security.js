import fs from 'fs/promises';
import path from 'path';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function hasPrefix(buffer, prefix) {
  return buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix);
}

function isJpeg(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
}

function isSafeSvg(buffer) {
  const source = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  const normalized = source.toLowerCase();

  if (!/^(?:<\?xml\s[\s\S]*?\?>\s*)?<svg\b/i.test(source) || !/\/svg>\s*$/i.test(source)) return false;

  // SVG is XML and can carry active content. Branding/media SVGs are limited to
  // static vector markup with no scripting, embedded documents, or remote assets.
  const blocked = [
    /<!doctype/i,
    /<!entity/i,
    /<script\b/i,
    /<foreignobject\b/i,
    /<(?:iframe|object|embed|audio|video|canvas)\b/i,
    /<style\b/i,
    /\son[a-z]+\s*=/i,
    /(?:javascript|vbscript)\s*:/i,
    /\bdata\s*:/i,
    /url\s*\(/i,
    /<(?:image|use)\b[^>]*(?:href|xlink:href)\s*=\s*["']\s*(?!#)/i,
    /<\?(?!xml\b)/i,
  ];

  return !blocked.some((pattern) => pattern.test(normalized));
}

export async function validateImageUpload(file, { allowSvg = false } = {}) {
  if (!file) throw new Error('Image file is required');

  const extension = path.extname(file.originalname || file.filename || '').toLowerCase();
  const content = file.buffer || await fs.readFile(file.path);

  if (extension === '.jpg' || extension === '.jpeg') {
    if (!isJpeg(content)) throw new Error('The uploaded file is not a valid JPEG image');
    return 'jpeg';
  }

  if (extension === '.png') {
    if (!hasPrefix(content, PNG_SIGNATURE)) throw new Error('The uploaded file is not a valid PNG image');
    return 'png';
  }

  if (extension === '.svg' && allowSvg) {
    if (!isSafeSvg(content)) throw new Error('The SVG contains unsupported active content');
    return 'svg';
  }

  throw new Error('Only JPG and PNG images are allowed');
}

export async function removeUploadedFile(file) {
  if (!file?.path) return;
  await fs.unlink(file.path).catch(() => undefined);
}
