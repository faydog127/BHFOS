const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const INSPECTION_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';
export const MAX_INSPECTION_IMAGE_BYTES = 30 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);
const MIME_EXTENSION_GROUPS = Object.freeze({
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/jpg': new Set(['jpg', 'jpeg']),
  'image/png': new Set(['png']),
  'image/webp': new Set(['webp']),
  'image/heic': new Set(['heic', 'heif']),
  'image/heif': new Set(['heic', 'heif']),
});

const fileExtension = (name) => {
  const value = String(name || '').trim().toLowerCase();
  const dot = value.lastIndexOf('.');
  return dot >= 0 ? value.slice(dot + 1) : '';
};

export const isHeicLike = (file) => {
  const mime = String(file?.type || '').trim().toLowerCase();
  return HEIC_MIME_TYPES.has(mime) || ['heic', 'heif'].includes(fileExtension(file?.name));
};

export const validateInspectionImageFile = (
  file,
  { maxOriginalBytes = MAX_INSPECTION_IMAGE_BYTES } = {},
) => {
  if (!file) throw new Error('Missing image file.');

  const mime = String(file.type || '').trim().toLowerCase();
  const extension = fileExtension(file.name);
  if (!SUPPORTED_MIME_TYPES.has(mime) && !SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, WebP, HEIC, or HEIF.');
  }
  if (mime && extension && SUPPORTED_MIME_TYPES.has(mime) && SUPPORTED_EXTENSIONS.has(extension)
    && !MIME_EXTENSION_GROUPS[mime]?.has(extension)) {
    throw new Error('Image file type does not match its filename. Choose the original photo or export it again.');
  }

  const size = Number(file.size || 0);
  if (!Number.isFinite(size) || size <= 0) throw new Error('The selected image is empty.');
  if (size > maxOriginalBytes) {
    throw new Error(`Image is too large. Maximum original size is ${Math.round(maxOriginalBytes / 1024 / 1024)} MB.`);
  }

  return { mime, extension, size, isHeic: isHeicLike(file) };
};

const decodeHeic = async (file) => {
  let heicTo;
  try {
    ({ heicTo } = await import('heic-to/next'));
  } catch {
    throw new Error('HEIC conversion is unavailable in this browser.');
  }

  let converted;
  try {
    converted = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.94 });
  } catch {
    throw new Error('Unable to decode this HEIC/HEIF image. The file may use an unsupported encoding profile.');
  }

  const blob = converted;
  if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('HEIC conversion returned an empty image.');
  return blob;
};

const decodeBitmap = async (blob) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      try {
        return await createImageBitmap(blob);
      } catch {
        // Continue to the HTML image fallback below.
      }
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return image;
  } catch {
    throw new Error('Unable to decode image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));

export async function normalizeInspectionImageFile(file, opts = {}) {
  const {
    maxDimension = 1800,
    targetMaxBytes = 850_000,
    minQuality = 0.55,
    startQuality = 0.86,
    mimeType = 'image/jpeg',
    maxOriginalBytes = MAX_INSPECTION_IMAGE_BYTES,
  } = opts || {};

  const validation = validateInspectionImageFile(file, { maxOriginalBytes });
  const decodeBlob = validation.isHeic ? await decodeHeic(file) : file;
  const bitmap = await decodeBitmap(decodeBlob);

  try {
    const sourceWidth = Number(bitmap.naturalWidth || bitmap.width || 0);
    const sourceHeight = Number(bitmap.naturalHeight || bitmap.height || 0);
    if (!sourceWidth || !sourceHeight) throw new Error('Decoded image has invalid dimensions.');

    const initialScale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    let outWidth = Math.max(1, Math.round(sourceWidth * initialScale));
    let outHeight = Math.max(1, Math.round(sourceHeight * initialScale));
    let quality = clamp(startQuality, minQuality, 0.95);
    let blob = null;

    for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outHeight;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas unavailable.');

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, outWidth, outHeight);
      context.drawImage(bitmap, 0, 0, outWidth, outHeight);

      quality = clamp(startQuality, minQuality, 0.95);
      blob = await canvasToBlob(canvas, mimeType, quality);
      if (!blob) throw new Error('Image normalization failed.');

      for (let qualityAttempt = 0; qualityAttempt < 6 && blob.size > targetMaxBytes && quality > minQuality; qualityAttempt += 1) {
        quality = clamp(quality - 0.06, minQuality, 0.95);
        const next = await canvasToBlob(canvas, mimeType, quality);
        if (!next) break;
        blob = next;
      }

      if (blob.size <= targetMaxBytes || Math.max(outWidth, outHeight) <= 1200) break;
      outWidth = Math.max(1, Math.round(outWidth * 0.84));
      outHeight = Math.max(1, Math.round(outHeight * 0.84));
    }

    if (!blob?.size) throw new Error('Image normalization returned an empty JPEG.');

    return {
      blob,
      width: outWidth,
      height: outHeight,
      mimeType,
      quality,
      originalBytes: Number(file.size || 0),
      normalizedBytes: blob.size,
      compressedBytes: blob.size,
      originalMimeType: validation.mime || null,
      wasHeic: validation.isHeic,
    };
  } finally {
    if (typeof bitmap.close === 'function') bitmap.close();
  }
}

// Backward-compatible name used by older callers.
export const compressImageFile = normalizeInspectionImageFile;
