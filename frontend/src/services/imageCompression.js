const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function compressImageFile(file, options = {}) {
  const {
    maxWidth = 1400,
    maxHeight = 1400,
    quality = 0.82,
    outputType = 'image/jpeg',
  } = options;

  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, outputType, quality);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const filename = file.name.replace(/\.[^.]+$/, '.jpg');
    return new File([blob], filename, { type: outputType, lastModified: Date.now() });
  } catch {
    return file;
  }
}
