const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const isImageLike = (file) => /^image\//i.test(String(file?.type || ''));

export async function compressImageFile(
  file,
  opts = {},
) {
  const {
    maxDimension = 1600,
    targetMaxBytes = 500_000,
    minQuality = 0.55,
    startQuality = 0.82,
    mimeType = 'image/jpeg',
  } = opts || {};

  if (!file) throw new Error('Missing file.');
  if (!isImageLike(file)) throw new Error('Unsupported file type.');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new Error('Unable to decode image.');
  }

  const w = bitmap.width;
  const h = bitmap.height;

  const scale = Math.min(1, maxDimension / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  ctx.drawImage(bitmap, 0, 0, outW, outH);

  const encode = (quality) =>
    new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });

  let quality = clamp(startQuality, minQuality, 0.95);
  let blob = await encode(quality);
  if (!blob) throw new Error('Image compression failed.');

  // Downshift quality until we hit target size (or min quality).
  // This is intentionally simple; field reliability > perfect optimization.
  for (let i = 0; i < 6 && blob.size > targetMaxBytes && quality > minQuality; i += 1) {
    quality = clamp(quality - 0.07, minQuality, 0.95);
    // eslint-disable-next-line no-await-in-loop
    const next = await encode(quality);
    if (!next) break;
    blob = next;
  }

  return {
    blob,
    width: outW,
    height: outH,
    mimeType,
    quality,
    originalBytes: file.size,
    compressedBytes: blob.size,
  };
}

