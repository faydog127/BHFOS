import { normalizeInspectionImageFile } from '@/lib/imageCompression';

const variance = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
};

const sha256 = async (blob) => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const assessInspectionPhotoQuality = async (file, knownHashes = []) => {
  const normalized = await normalizeInspectionImageFile(file, {
    maxDimension: 900,
    targetMaxBytes: 500_000,
    startQuality: 0.82,
    minQuality: 0.6,
  });
  const bitmap = await createImageBitmap(normalized.blob);
  const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(24, Math.round(bitmap.width * scale));
  const height = Math.max(24, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const pixels = context.getImageData(0, 0, width, height).data;
  const luminance = [];
  let dark = 0;
  let bright = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const value = (0.2126 * pixels[index]) + (0.7152 * pixels[index + 1]) + (0.0722 * pixels[index + 2]);
    luminance.push(value);
    if (value < 24) dark += 1;
    if (value > 245) bright += 1;
  }
  const edges = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width) + x;
      edges.push((4 * luminance[index]) - luminance[index - 1] - luminance[index + 1] - luminance[index - width] - luminance[index + width]);
    }
  }
  const total = luminance.length || 1;
  const metrics = {
    blur_score: Math.round(variance(edges)),
    brightness: Math.round(luminance.reduce((sum, value) => sum + value, 0) / total),
    dark_ratio: Number((dark / total).toFixed(3)),
    glare_ratio: Number((bright / total).toFixed(3)),
    detail_score: Math.round(variance(luminance)),
    normalized_hash: await sha256(normalized.blob),
  };
  const warnings = [];
  if (metrics.blur_score < 90) warnings.push('Image appears excessively blurry or unreadable.');
  if (metrics.brightness < 35 || metrics.dark_ratio > 0.72) warnings.push('Image is severely dark.');
  if (metrics.glare_ratio > 0.38) warnings.push('Image has excessive glare or overexposure.');
  if (metrics.detail_score < 130) warnings.push('Image has extremely low visible detail.');
  if (knownHashes.includes(metrics.normalized_hash)) warnings.push('This appears to be an exact duplicate photo.');
  return { status: warnings.length ? 'retake_recommended' : 'good', warnings, metrics };
};
