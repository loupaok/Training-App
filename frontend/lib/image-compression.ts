const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputType?: string;
}

export async function compressImageFile(file: File, options: CompressImageOptions = {}): Promise<File> {
  const { maxWidth = 1400, maxHeight = 1400, quality = 0.82, outputType = "image/jpeg" } = options;

  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, quality);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const filename = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], filename, { type: outputType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

// Square-crops (centered) and compresses an avatar image to a fixed size, for profile photos.
export async function cropAndCompressImage(file: File, size = 512): Promise<Blob> {
  const imageUrl = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });

  const cropSize = Math.min(image.width, image.height);
  const sourceX = Math.floor((image.width - cropSize) / 2);
  const sourceY = Math.floor((image.height - cropSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context?.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, size, size);
  URL.revokeObjectURL(imageUrl);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Δεν ήταν δυνατή η επεξεργασία της εικόνας."));
      },
      "image/jpeg",
      0.82,
    );
  });
}
