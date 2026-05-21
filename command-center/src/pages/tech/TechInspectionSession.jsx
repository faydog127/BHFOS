import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { compressImageFile } from '@/lib/imageCompression';
import { mediaQueue } from '@/lib/offlineInspectionMediaQueue';
import { normalizeInspectionStatus } from '@/lib/inspectionStatus';

const PHOTO_BUCKET = 'inspection-photos';

const asText = (v) => (typeof v === 'string' ? v.trim() : '');

const getCustomerName = (lead) =>
  asText(lead?.company) ||
  `${asText(lead?.first_name)} ${asText(lead?.last_name)}`.trim() ||
  asText(lead?.email) ||
  'Customer';

export default function TechInspectionSession() {
  const tenantId = getTenantId();
  const { inspectionId } = useParams();
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [inspection, setInspection] = useState(null);
  const [findings, setFindings] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [uploading, setUploading] = useState(false);

  const revision = inspection?.revision || 1;
  const normalizedStatus = normalizeInspectionStatus(inspection?.status);
  const locked = normalizedStatus !== 'draft';
  const canFulfillUploads =
    normalizedStatus === 'draft' || normalizedStatus === 'submitted' || normalizedStatus === 'completed';

  const syncState = useMemo(() => {
    const unresolved = (queueItems || []).filter((q) => ['queued', 'uploading', 'failed'].includes(q.status)).length;
    const failed = (queueItems || []).filter((q) => q.status === 'failed').length;
    return { unresolved, failed, syncing: unresolved > 0 };
  }, [queueItems]);

  const uploadIntegrity = useMemo(() => {
    const relevant = (photos || []).filter((p) => p && p.is_voided !== true);
    const serverBlocking = relevant.filter((p) => {
      const state = asText(p.upload_state).toLowerCase() || 'complete';
      return state !== 'complete';
    }).length;
    const serverPending = relevant.filter((p) => asText(p.upload_state).toLowerCase() === 'pending').length;
    const serverFailed = relevant.filter((p) => asText(p.upload_state).toLowerCase() === 'failed').length;

    return {
      localUnresolved: syncState.unresolved,
      localFailed: syncState.failed,
      serverBlocking,
      serverPending,
      serverFailed,
      blocksCompletion: serverBlocking > 0,
    };
  }, [photos, syncState.failed, syncState.unresolved]);

  const hydratePhotoUrls = useCallback(async (rows) => {
    const next = [];
    for (const row of rows) {
      if (row.is_voided) {
        next.push({ ...row, signed_url: null });
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const { data } = await supabase.storage.from(row.bucket_id || PHOTO_BUCKET).createSignedUrl(row.object_path, 60 * 30);
        next.push({ ...row, signed_url: data?.signedUrl || null });
      } catch {
        next.push({ ...row, signed_url: null });
      }
    }
    return next;
  }, []);

  const load = useCallback(async () => {
    if (!inspectionId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select(
          `
          *,
          lead:leads(id, first_name, last_name, company, email, phone),
          job:jobs(id, work_order_number, service_address),
          technician:technicians(id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('id', inspectionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Inspection not found.');

      const normalized = {
        ...data,
        lead: Array.isArray(data.lead) ? data.lead[0] : data.lead,
        job: Array.isArray(data.job) ? data.job[0] : data.job,
        technician: Array.isArray(data.technician) ? data.technician[0] : data.technician,
      };
      setInspection(normalized);

      const [findingRes, photoRes] = await Promise.all([
        supabase
          .from('inspection_findings')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('inspection_photos')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId)
          .order('uploaded_at', { ascending: true }),
      ]);

      if (findingRes.error) throw findingRes.error;
      if (photoRes.error) throw photoRes.error;

      setFindings(findingRes.data || []);
      setPhotos(await hydratePhotoUrls(photoRes.data || []));

      const localQueue = await mediaQueue.list({ tenantId, inspectionId });
      setQueueItems(localQueue);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Load failed', description: err?.message || 'Could not load inspection.' });
    } finally {
      setLoading(false);
    }
  }, [hydratePhotoUrls, inspectionId, tenantId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshQueue = async () => {
    const localQueue = await mediaQueue.list({ tenantId, inspectionId });
    setQueueItems(localQueue);
  };

  const enqueueFiles = async (files) => {
    if (!files?.length) return;
    if (locked) {
      toast({ variant: 'destructive', title: 'Locked', description: 'Inspection is locked. Reopen to edit.' });
      return;
    }

    const next = [];
    for (const file of Array.from(files)) {
      const id = uuidv4();
      const item = await mediaQueue.add({
        id,
        tenant_id: tenantId,
        inspection_id: inspectionId,
        inspection_revision: revision,
        status: 'queued',
        photo_row_id: null,
        object_path: null,
        file,
        file_name: file?.name || `photo-${id}.jpg`,
        content_type: file?.type || 'image/*',
        caption: '',
        finding_id: null,
        is_before: null,
      });
      next.push(item);
    }

    await refreshQueue();
    // Best-effort auto-upload if online.
    flushUploads().catch(() => null);
  };

  const flushUploads = useCallback(async () => {
    if (uploading) return;
    if (!navigator.onLine) return;
    if (locked) return;

    setUploading(true);
    try {
      let local = await mediaQueue.list({ tenantId, inspectionId });
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = local.find((q) => q.status === 'queued' || q.status === 'failed');
        if (!next) break;

        // Mark uploading
        await mediaQueue.patch(next.id, { status: 'uploading', error: null });
        await refreshQueue();

        try {
          const rawFile = next.file;
          if (!rawFile) throw new Error('Missing file payload.');

          // Ensure there is a persisted DB evidence row BEFORE uploading media.
          // This allows submission while uploads are still resolving.
          let photoRowId = next.photo_row_id;
          let objectPath = next.object_path;

          if (!photoRowId || !objectPath) {
            photoRowId = uuidv4();
            objectPath = `${tenantId}/inspections/${inspectionId}/revision-${revision}/photos/${photoRowId}.jpg`;

            const nowIso = new Date().toISOString();
            const { error: insertError } = await supabase
              .from('inspection_photos')
              .insert({
                id: photoRowId,
                tenant_id: tenantId,
                inspection_id: inspectionId,
                finding_id: next.finding_id || null,
                technician_id: inspection?.technician_id || null,
                created_by_user_id: user?.id || null,
                bucket_id: PHOTO_BUCKET,
                object_path: objectPath,
                file_name: next.file_name || null,
                content_type: 'image/jpeg',
                byte_size: null,
                caption: asText(next.caption) || null,
                category: asText(next.category) || null,
                is_before: typeof next.is_before === 'boolean' ? next.is_before : null,
                taken_at: next.taken_at || null,
                upload_state: 'pending',
                storage_error: null,
                storage_uploaded_at: null,
                uploaded_at: nowIso,
                created_at: nowIso,
                updated_at: nowIso,
              });

            if (insertError) throw insertError;

            await mediaQueue.patch(next.id, { photo_row_id: photoRowId, object_path: objectPath });
            await refreshQueue();
          }

          // Compression is locked early (Phase 1.5 rule).
          // eslint-disable-next-line no-await-in-loop
          const compressed = await compressImageFile(rawFile, {
            maxDimension: 1600,
            targetMaxBytes: 500_000,
            startQuality: 0.82,
            minQuality: 0.55,
          });

          // eslint-disable-next-line no-await-in-loop
          const upload = await supabase.storage.from(PHOTO_BUCKET).upload(objectPath, compressed.blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });
          if (upload.error) throw upload.error;

          const { data: updated, error: updateError } = await supabase
            .from('inspection_photos')
            .update({
              content_type: 'image/jpeg',
              byte_size: compressed.compressedBytes,
              upload_state: 'complete',
              storage_error: null,
              storage_uploaded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId)
            .eq('inspection_id', inspectionId)
            .eq('id', photoRowId)
            .select('*')
            .single();

          if (updateError) throw updateError;

          // Remove from queue once persisted.
          await mediaQueue.remove(next.id);

          // Refresh server photos list (append for speed).
          const withUrl = await hydratePhotoUrls([updated]);
          setPhotos((prev) => [...prev, withUrl[0]]);
        } catch (err) {
          // Best-effort: mark DB evidence row as failed too (if it exists).
          // (We re-read the queue item because photo_row_id may have been created earlier in this iteration.)
          const currentQueue = await mediaQueue.list({ tenantId, inspectionId });
          const current = currentQueue.find((q) => q.id === next.id) || next;

          if (current.photo_row_id) {
            await supabase
              .from('inspection_photos')
              .update({
                upload_state: 'failed',
                storage_error: err?.message || 'upload_failed',
                updated_at: new Date().toISOString(),
              })
              .eq('tenant_id', tenantId)
              .eq('inspection_id', inspectionId)
              .eq('id', current.photo_row_id)
              .then(() => null)
              .catch(() => null);
          }

          await mediaQueue.patch(next.id, { status: 'failed', error: err?.message || 'upload_failed' });
        }

        local = await mediaQueue.list({ tenantId, inspectionId });
      }
    } finally {
      await refreshQueue();
      setUploading(false);
    }
  }, [hydratePhotoUrls, inspection?.technician_id, inspectionId, locked, revision, tenantId, uploading, user?.id]);

  useEffect(() => {
    const onOnline = () => flushUploads().catch(() => null);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushUploads]);

  const createFinding = async () => {
    if (locked) return;
    const title = window.prompt('Finding title:');
    if (!asText(title)) return;

    if (!navigator.onLine) {
      toast({ variant: 'destructive', title: 'Offline', description: 'Finding creation requires connectivity (for now).' });
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('inspection_findings')
        .insert({
          tenant_id: tenantId,
          inspection_id: inspectionId,
          title: asText(title),
          category: 'general',
          severity: 'medium',
          sort_order: findings.length,
          created_by_user_id: user?.id || null,
          created_at: nowIso,
          updated_at: nowIso,
          is_customer_visible: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      setFindings((prev) => [...prev, data]);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Finding failed', description: err?.message || 'Could not create finding.' });
    }
  };

  const updateServerPhoto = async (photoId, patch) => {
    if (locked) return;
    const { data, error } = await supabase
      .from('inspection_photos')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('inspection_id', inspectionId)
      .eq('id', photoId)
      .select('*')
      .single();
    if (error) throw error;
    const withUrl = await hydratePhotoUrls([data]);
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? withUrl[0] : p)));
  };

  const updateQueueItem = async (id, patch) => {
    await mediaQueue.patch(id, patch);
    await refreshQueue();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading inspection...
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild className="gap-2">
          <Link to="../queue">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspection Not Found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const customer = getCustomerName(inspection?.lead || null);
  const status = statusText(inspection?.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" asChild className="gap-2">
          <Link to="../queue">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={status === 'submitted' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}>
            {status}
          </Badge>
          <Badge variant="outline">Rev {revision}</Badge>
        </div>
      </div>

      {syncState.syncing ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">Syncing</div>
              <div className="text-xs">
                {syncState.unresolved} queued item{syncState.unresolved === 1 ? '' : 's'}
                {syncState.failed ? ` • ${syncState.failed} failed` : ''}
              </div>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => flushUploads()} disabled={uploading || locked || !navigator.onLine}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{inspection?.title || `Inspection - ${customer}`}</CardTitle>
            <div className="text-xs text-slate-500 truncate">{customer}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={load} disabled={uploading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button asChild className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Link to={`../inspections/${inspectionId}/review`}>
                <CheckCircle2 className="h-4 w-4" />
                Review
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={locked}
            >
              <Camera className="h-5 w-5" />
              Capture Photo
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={createFinding} disabled={locked}>
              + Finding
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              e.target.value = '';
              enqueueFiles(files).catch(() => null);
            }}
          />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Upload Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {queueItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
              No queued photos.
            </div>
          ) : (
            queueItems.map((q) => (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{q.file_name || 'Photo'}</div>
                    <div className="text-xs text-slate-500">
                      {q.status}
                      {q.error ? ` • ${q.error}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline">{q.status}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Finding</Label>
                    <Select
                      value={q.finding_id || 'unlinked'}
                      onValueChange={(value) => updateQueueItem(q.id, { finding_id: value === 'unlinked' ? null : value })}
                      disabled={locked}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Unlinked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unlinked">Unlinked</SelectItem>
                        {findings.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Before/After</Label>
                    <Select
                      value={q.is_before === true ? 'before' : q.is_before === false ? 'after' : 'unspecified'}
                      onValueChange={(value) => updateQueueItem(q.id, { is_before: value === 'before' ? true : value === 'after' ? false : null })}
                      disabled={locked}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unspecified">Unspecified</SelectItem>
                        <SelectItem value="before">Before</SelectItem>
                        <SelectItem value="after">After</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Caption</Label>
                  <Input
                    value={q.caption || ''}
                    onChange={(e) => updateQueueItem(q.id, { caption: e.target.value })}
                    placeholder="Short caption (optional)"
                    disabled={locked}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Uploaded Photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {photos.filter((p) => p && p.is_voided !== true).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
              No uploaded photos yet.
            </div>
          ) : (
            photos
              .filter((p) => p && p.is_voided !== true)
              .map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  {asText(p.upload_state).toLowerCase() && asText(p.upload_state).toLowerCase() !== 'complete' ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 w-fit">
                      {String(p.upload_state).toLowerCase()}
                    </Badge>
                  ) : null}
                  {p.signed_url ? (
                    <img src={p.signed_url} alt={p.caption || p.file_name || 'photo'} className="w-full rounded-lg border border-slate-200" />
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600 text-sm">
                      Preview unavailable
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Finding</Label>
                      <Select
                        value={p.finding_id || 'unlinked'}
                        onValueChange={(value) => updateServerPhoto(p.id, { finding_id: value === 'unlinked' ? null : value })}
                        disabled={locked}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Unlinked" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unlinked">Unlinked</SelectItem>
                          {findings.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Before/After</Label>
                      <Select
                        value={p.is_before === true ? 'before' : p.is_before === false ? 'after' : 'unspecified'}
                        onValueChange={(value) => updateServerPhoto(p.id, { is_before: value === 'before' ? true : value === 'after' ? false : null })}
                        disabled={locked}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unspecified">Unspecified</SelectItem>
                          <SelectItem value="before">Before</SelectItem>
                          <SelectItem value="after">After</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Caption</Label>
                    <Input
                      value={p.caption || ''}
                      onChange={(e) => updateServerPhoto(p.id, { caption: e.target.value })}
                      placeholder="Short caption (recommended)"
                      disabled={locked}
                    />
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
