/**
 * ML-P1 S4 — job execution before/after photo upload.
 * Reuses inspection-photos bucket with a job-execution prefix (no new prod bucket invent).
 * Rejects blob:/fake URLs at readiness time (server checks kind presence; client must upload first).
 */

import { supabase } from '@/lib/customSupabaseClient';

export const JOB_EXECUTION_PHOTO_BUCKET = 'inspection-photos';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

export function isUsableJobPhotoRef(photo) {
  const url = asText(photo?.url || photo?.ref || photo?.object_path);
  if (!url) return false;
  if (/^blob:/i.test(url)) return false;
  if (/^pending-upload:/i.test(url)) return false;
  return true;
}

export async function uploadJobExecutionPhoto({
  tenantId,
  jobId,
  kind,
  file,
  clientMutationId,
}) {
  if (!tenantId || !jobId) throw new Error('tenantId and jobId required');
  if (!file) throw new Error('file required');
  const normalizedKind = String(kind || '')
    .trim()
    .toLowerCase();
  if (!['before', 'after'].includes(normalizedKind)) {
    throw new Error('kind must be before or after');
  }

  const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
  const mutation = asText(clientMutationId) || crypto.randomUUID();
  const objectPath = `${tenantId}/job-execution/${jobId}/${normalizedKind}/${mutation}.${ext}`;

  const { error } = await supabase.storage.from(JOB_EXECUTION_PHOTO_BUCKET).upload(objectPath, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  return {
    kind: normalizedKind,
    bucket_id: JOB_EXECUTION_PHOTO_BUCKET,
    object_path: objectPath,
    url: objectPath,
    name: file.name || `${normalizedKind}.${ext}`,
    uploaded_at: new Date().toISOString(),
  };
}
