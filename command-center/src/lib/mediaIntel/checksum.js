/**
 * WebCrypto's SubtleCrypto.digest() has no incremental/streaming API, so hashing a
 * file requires materializing it in memory as an ArrayBuffer. There is no chunked
 * SHA-256 implementation already vendored in this repo, so rather than silently
 * hanging or OOM-ing on very large phone videos, we advertise and enforce a
 * practical hashing ceiling. Files above this size are refused with a clear error
 * instead of attempting an unbounded in-memory hash.
 */
export const MAX_PRACTICAL_HASH_BYTES = 250 * 1024 * 1024; // 250 MB

export async function sha256Hex(blob) {
  if (blob && typeof blob.size === 'number' && blob.size > MAX_PRACTICAL_HASH_BYTES) {
    throw new Error(
      `File is too large to checksum in the browser (max ${Math.round(MAX_PRACTICAL_HASH_BYTES / (1024 * 1024))} MB). ` +
        'A chunked/incremental hashing worker is required before larger files can be supported.',
    );
  }
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function clientFileKey(file) {
  return [
    file?.name || 'unnamed',
    file?.size || 0,
    file?.lastModified || 0,
  ].join('::');
}
