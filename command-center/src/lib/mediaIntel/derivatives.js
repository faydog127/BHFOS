import { supabase } from '@/lib/customSupabaseClient';
import { MIL_DERIVATIVES_BUCKET } from './constants';

/** Create a grid thumbnail derivative. Never overwrites the original. */
export async function createImageGridThumb({ assetId, file }) {
  if (!file?.type?.startsWith('image/') || /heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
    return null;
  }

  const bitmap = await createImageBitmap(file);
  const maxEdge = 480;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('thumb encode failed'))), 'image/jpeg', 0.82);
  });

  const objectPath = `mil/derivatives/${assetId}/grid_thumb.jpg`;
  const up = await supabase.storage.from(MIL_DERIVATIVES_BUCKET).upload(objectPath, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (up.error && !String(up.error.message || '').toLowerCase().includes('already exists')) {
    throw up.error;
  }

  const { data, error } = await supabase
    .from('mil_derivatives')
    .upsert(
      {
        asset_id: assetId,
        kind: 'grid_thumb',
        bucket: MIL_DERIVATIVES_BUCKET,
        object_path: objectPath,
        mime_type: 'image/jpeg',
        byte_size: blob.size,
        width,
        height,
        strip_exif: true,
      },
      { onConflict: 'bucket,object_path' },
    )
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}
