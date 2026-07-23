import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, UploadCloud } from 'lucide-react';

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
import { INSPECTION_IMAGE_ACCEPT } from '@/lib/imageCompression';
import { mediaQueue } from '@/lib/offlineInspectionMediaQueue';
import {
  enqueueInspectionPhotoFiles,
  flushInspectionPhotoQueue,
} from '@/lib/inspectionPhotoPipeline';
import { assessInspectionPhotoQuality } from '@/lib/inspectionPhotoQuality';
import { normalizeInspectionStatus } from '@/lib/inspectionStatus';
import InspectionFieldStepper, { stepHref } from '@/components/tech/InspectionFieldStepper';
import {
  LEAD_FIELD_SELECT,
  hydrateLeadsWithProperties,
  resolveServiceAddress,
} from '@/lib/inspectionFieldAddress';
import InspectionFieldCustomerStep from '@/components/tech/InspectionFieldCustomerStep';
import InspectionChecklistPanel from '@/components/tech/InspectionChecklistPanel';
import { DEFAULT_OFFLINE_CACHE_MB } from '@/lib/offlineInspectionMediaQueue';

const PHOTO_BUCKET = 'inspection-photos';

const asText = (v) => (typeof v === 'string' ? v.trim() : '');

const getCustomerName = (lead) =>
  asText(lead?.company) ||
  `${asText(lead?.first_name)} ${asText(lead?.last_name)}`.trim() ||
  asText(lead?.email) ||
  'Customer';

const queueStatusLabel = (item) => {
  const status = asText(item?.status).toLowerCase();
  const stage = asText(item?.stage).toLowerCase();
  if (status === 'failed' || stage === 'failed') return 'Failed';
  if (status === 'uploading' || stage === 'uploading') return 'Uploading';
  if (status === 'complete' || status === 'uploaded' || stage === 'complete') return 'Uploaded';
  if (stage === 'processing' || stage === 'normalize' || stage === 'converting') return 'Processing';
  return 'Waiting to upload';
};

const evidenceLabelValue = (isBefore) => {
  if (isBefore === true) return 'before';
  if (isBefore === false) return 'after';
  return 'observed';
};

export default function TechInspectionSession() {
  const tenantId = getTenantId();
  const { inspectionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [inspection, setInspection] = useState(null);
  const [findings, setFindings] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [uploading, setUploading] = useState(false);

  const revision = inspection?.revision || 1;
  const normalizedStatus = normalizeInspectionStatus(inspection?.status);
  const locked = normalizedStatus !== 'draft';
  const canFulfillUploads = ['draft', 'submitted', 'completed'].includes(normalizedStatus);
  const syncState = useMemo(() => {
    const unresolved = (queueItems || []).filter((q) => ['queued', 'uploading', 'failed'].includes(q.status)).length;
    const failed = (queueItems || []).filter((q) => q.status === 'failed').length;
    return { unresolved, failed, syncing: unresolved > 0 };
  }, [queueItems]);

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
          lead:leads(${LEAD_FIELD_SELECT}),
          job:jobs(id, work_order_number, service_address),
          technician:technicians(id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('id', inspectionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Inspection not found.');

      const rawLead = Array.isArray(data.lead) ? data.lead[0] : data.lead;
      const hydratedLead = await hydrateLeadsWithProperties(supabase, tenantId, rawLead);
      const normalized = {
        ...data,
        lead: hydratedLead,
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

  const refreshQueue = useCallback(async () => {
    const localQueue = await mediaQueue.list({ tenantId, inspectionId });
    setQueueItems(localQueue);
    return localQueue;
  }, [inspectionId, tenantId]);

  const enqueueFiles = async (files) => {
    if (!files?.length) return;
    if (locked) {
      toast({ variant: 'destructive', title: 'Locked', description: 'Inspection is locked. Reopen to edit.' });
      return;
    }

    try {
      const qualityResults = new Map();
      const knownHashes = photos.map((photo) => photo?.quality_metrics?.normalized_hash).filter(Boolean);
      for (const file of Array.from(files || [])) {
        // Quality feedback is deliberately shown before the normal upload finishes.
        // eslint-disable-next-line no-await-in-loop
        const quality = await assessInspectionPhotoQuality(file, knownHashes);
        if (quality.status === 'retake_recommended') {
          const keep = window.confirm(`Retake recommended for ${file.name}: ${quality.warnings.join(' ')}\n\nSelect OK to Keep anyway, or Cancel to retake.`);
          if (!keep) continue;
          quality.status = 'kept_with_warning';
        }
        qualityResults.set(file, quality);
        knownHashes.push(quality.metrics.normalized_hash);
      }
      const retainedFiles = Array.from(files || []).filter((file) => qualityResults.has(file));
      if (!retainedFiles.length) return;

      const { accepted, rejected } = await enqueueInspectionPhotoFiles({
        files: retainedFiles,
        tenantId,
        inspectionId,
        revision,
        qualityResults,
        cacheMb: DEFAULT_OFFLINE_CACHE_MB,
      });
      await refreshQueue();
      if (rejected.length) {
        toast({
          variant: 'destructive',
          title: rejected.length === 1 ? 'Photo rejected' : 'Some photos were rejected',
          description: rejected.map((item) => `${item.fileName}: ${item.error}`).join(' '),
        });
      }
      // Best-effort auto-upload if online.
      if (accepted.length) flushUploads().catch(() => null);
    } catch (error) {
      await refreshQueue().catch(() => null);
      toast({
        variant: 'destructive',
        title: 'Photo upload failed',
        description: error?.message || 'The photo was not queued. Select it again to retry.',
      });
    }
  };

  const flushUploads = useCallback(async () => {
    if (uploading) return;
    if (!navigator.onLine) return;
    if (!canFulfillUploads) return;

    setUploading(true);
    try {
      await flushInspectionPhotoQueue({
        tenantId,
        inspectionId,
        revision,
        technicianId: inspection?.technician_id || null,
        userId: user?.id || null,
        onQueueChange: setQueueItems,
        onPhotoComplete: async (updated) => {
          const withUrl = await hydratePhotoUrls([updated]);
          setPhotos((prev) => (
            prev.some((photo) => photo.id === updated.id)
              ? prev.map((photo) => (photo.id === updated.id ? withUrl[0] : photo))
              : [...prev, withUrl[0]]
          ));
        },
      });
    } finally {
      await refreshQueue();
      setUploading(false);
    }
  }, [canFulfillUploads, hydratePhotoUrls, inspection?.technician_id, inspectionId, refreshQueue, revision, tenantId, uploading, user?.id]);

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
  const status = normalizedStatus;
  const serviceAddressReady = Boolean(
    resolveServiceAddress({
      property: Array.isArray(inspection?.lead?.property)
        ? inspection.lead.property[0]
        : inspection?.lead?.property,
      inspectionServiceAddress: inspection?.service_address,
      jobServiceAddress: inspection?.job?.service_address,
      lead: inspection?.lead,
    }),
  );
  const customerReady = Boolean(inspection?.lead_id) && serviceAddressReady;
  const photosReady = photos.some((photo) => photo && photo.is_voided !== true);
  const photosWaveComplete = Boolean(inspection?.photos_wave_complete_at) || photosReady;
  const requestedStep = asText(searchParams.get('step')).toLowerCase();
  const currentStep = ['customer', 'photos', 'checklist'].includes(requestedStep)
    ? requestedStep
    : (customerReady ? 'photos' : 'customer');
  const completionByStep = {
    customer: customerReady,
    photos: photosWaveComplete,
    checklist: false,
    findings: false,
    recommendation: false,
    finish: false,
  };

  const goToStep = (stepId) => {
    setSearchParams({ step: stepId }, { replace: true });
  };

  const markPhotosWaveAndContinue = async () => {
    if (!photosReady) {
      toast({
        variant: 'destructive',
        title: 'Photos required',
        description: 'Capture at least one photo before continuing (photos-first wave).',
      });
      return;
    }
    try {
      const { error } = await supabase.rpc('ml_p1_s8_mark_photos_wave_complete', {
        p_inspection_id: inspectionId,
      });
      if (error) throw error;
      setInspection((current) => ({
        ...current,
        photos_wave_complete_at: current?.photos_wave_complete_at || new Date().toISOString(),
      }));
      goToStep('checklist');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not complete photo wave',
        description: err?.message || String(err),
      });
    }
  };

  return (
    <div className="space-y-4 pb-24">
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

      <InspectionFieldStepper
        inspectionId={inspectionId}
        currentStep={currentStep}
        completionByStep={completionByStep}
      />

      {currentStep === 'customer' ? (
        <InspectionFieldCustomerStep
          tenantId={tenantId}
          inspection={inspection}
          locked={locked}
          onLinked={(next) => setInspection(next)}
          onContinue={() => goToStep('photos')}
        />
      ) : null}

      {currentStep === 'photos' ? (
        <>
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
            <Button variant="outline" className="gap-2" onClick={() => flushUploads()} disabled={uploading || !canFulfillUploads || !navigator.onLine}>
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
            <Button
              type="button"
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={markPhotosWaveAndContinue}
              disabled={!photosReady}
            >
              <CheckCircle2 className="h-4 w-4" />
              Checklist
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!customerReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              Add a customer and service address first.
              <Button type="button" variant="outline" className="mt-2 min-h-11 w-full" onClick={() => goToStep('customer')}>
                Open Customer step
              </Button>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 gap-2"
              onClick={() => cameraInputRef.current?.click()}
              disabled={locked}
              data-testid="take-photo-button"
            >
              <Camera className="h-5 w-5" />
              Take Photo
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full min-h-12 gap-2"
              onClick={() => libraryInputRef.current?.click()}
              disabled={locked}
              data-testid="choose-from-library-button"
            >
              <ImagePlus className="h-5 w-5" />
              Choose From Library
            </Button>
          </div>
          <Button size="lg" variant="outline" className="w-full min-h-11" onClick={createFinding} disabled={locked}>
            + Finding
          </Button>

          <input
            ref={cameraInputRef}
            type="file"
            accept={INSPECTION_IMAGE_ACCEPT}
            capture="environment"
            className="hidden"
            data-testid="camera-file-input"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              enqueueFiles(files).catch(() => null);
            }}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept={INSPECTION_IMAGE_ACCEPT}
            multiple
            className="hidden"
            data-testid="library-file-input"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
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
                      {queueStatusLabel(q)}
                      {q.error ? ` • ${q.error}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline">{queueStatusLabel(q)}</Badge>
                </div>
                {q.status === 'failed' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={() => flushUploads()}
                    disabled={uploading || !canFulfillUploads}
                  >
                    Try again
                  </Button>
                ) : null}
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label={`Upload progress for ${q.file_name || 'photo'}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(q.progress || 0)}
                >
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, Number(q.progress || 0)))}%` }}
                  />
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
                    <Label className="text-xs">Evidence label</Label>
                    <Select
                      value={evidenceLabelValue(q.is_before)}
                      onValueChange={(value) => updateQueueItem(q.id, { is_before: value === 'before' ? true : value === 'after' ? false : null })}
                      disabled={locked}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="observed">Observed</SelectItem>
                        <SelectItem value="before">Before</SelectItem>
                        <SelectItem value="after">After</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Note</Label>
                  <Input
                    value={q.caption || ''}
                    onChange={(e) => updateQueueItem(q.id, { caption: e.target.value })}
                    placeholder="Short note (optional)"
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
                  <Badge variant="outline" className="w-fit">
                    {asText(p.upload_state).toLowerCase() === 'complete' || !asText(p.upload_state) ? 'Uploaded' : 'Processing'}
                  </Badge>
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
                      <Label className="text-xs">Evidence label</Label>
                      <Select
                        value={evidenceLabelValue(p.is_before)}
                        onValueChange={(value) => updateServerPhoto(p.id, { is_before: value === 'before' ? true : value === 'after' ? false : null })}
                        disabled={locked}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="observed">Observed</SelectItem>
                          <SelectItem value="before">Before</SelectItem>
                          <SelectItem value="after">After</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Note</Label>
                    <Input
                      value={p.caption || ''}
                      onChange={(e) => updateServerPhoto(p.id, { caption: e.target.value })}
                      placeholder="Short note (optional)"
                      disabled={locked}
                    />
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <Button
          type="button"
          size="lg"
          className="w-full min-h-12 bg-blue-600 hover:bg-blue-700"
          onClick={markPhotosWaveAndContinue}
          disabled={!photosReady}
        >
          Continue to Checklist
        </Button>
      </div>
        </>
      ) : null}

      {currentStep === 'checklist' ? (
        <div className="space-y-4">
          {!photosWaveComplete ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-3 text-sm text-amber-950">
                Complete the photo wave before checklist and report.
                <Button type="button" variant="outline" className="mt-2 min-h-11 w-full" onClick={() => goToStep('photos')}>
                  Back to Photos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <InspectionChecklistPanel
                inspectionId={inspectionId}
                workType={inspection?.work_type || inspection?.service_type || null}
                locked={locked}
              />
              <div className="sticky bottom-0 z-10 -mx-1 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
                <Button asChild size="lg" className="w-full min-h-12 bg-blue-600 hover:bg-blue-700">
                  <Link to={stepHref(inspectionId, 'findings')}>Continue to Findings</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
