import { MIL_MAX_FILE_BYTES, MIL_SUPPORTED_MIME } from './constants';

const EXT_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
};

export function extensionOf(filename = '') {
  const parts = String(filename).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

export function resolveMimeType(file) {
  if (file?.type && MIL_SUPPORTED_MIME.includes(file.type)) return file.type;
  const ext = extensionOf(file?.name);
  return EXT_MIME[ext] || file?.type || 'application/octet-stream';
}

export function mediaKindFromMime(mime) {
  if (String(mime).startsWith('image/')) return 'photo';
  if (String(mime).startsWith('video/')) return 'video';
  return 'other';
}

export function validateMediaFile(file) {
  if (!file) return { ok: false, reason: 'No file selected.' };
  const mime = resolveMimeType(file);
  if (!MIL_SUPPORTED_MIME.includes(mime) && !EXT_MIME[extensionOf(file.name)]) {
    return { ok: false, reason: `Unsupported type: ${file.name}` };
  }
  if (file.size > MIL_MAX_FILE_BYTES) {
    return { ok: false, reason: `File too large (max 2 GB): ${file.name}` };
  }
  if (file.size <= 0) {
    return { ok: false, reason: `Empty file: ${file.name}` };
  }
  return { ok: true, mime, kind: mediaKindFromMime(mime) };
}

export function safeStorageSegment(name) {
  return String(name || 'file')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180) || 'file';
}

export function orientationFromDimensions(width, height) {
  if (!width || !height) return 'unknown';
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}
