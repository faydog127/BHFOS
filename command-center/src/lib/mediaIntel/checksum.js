export async function sha256Hex(blob) {
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
