import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  acceptAiSuggestions,
  assetPreviewUrl,
  fetchReviewBundle,
  keepAsset,
  listAssets,
  listSubmissions,
  queueAiAnalysis,
  restrictAsset,
  reviewContentSubmission,
  setAssetLifecycle,
  setPermittedUse,
  verifyAssetMetadata,
} from '@/lib/mediaIntel/api';
import AnalysisOutcomeCard from '@/components/media/AnalysisOutcomeCard';
import { buildAnalysisOutcome } from '@/lib/mediaIntel/analysisDisplay';
import { REVIEW_QUEUE_FILTERS, SUBMISSION_REVIEW_LABELS, SUBMISSION_TYPES } from '@/lib/mediaIntel/constants';

function isContributorSelfAsset(asset) {
  const batch = asset?.mil_upload_batches;
  const row = Array.isArray(batch) ? batch[0] : batch;
  return row?.source_label === 'contributor_self';
}

function submissionPrimaryAsset(submission) {
  const links = [...(submission?.mil_submission_assets || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
  );
  return links[0]?.mil_assets || null;
}

export default function MediaReviewQueue({ contributorOnly = false } = {}) {
  const { caps } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromContributors =
    contributorOnly || searchParams.get('source') === 'contributor';
  const queueFilter = fromContributors
    ? 'needs_review'
    : searchParams.get('filter') || 'needs_review';
  const [assets, setAssets] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [thumbUrls, setThumbUrls] = useState({});
  const [thumbsReady, setThumbsReady] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const queueRows = useMemo(() => {
    const subRows = (submissions || []).map((s) => {
      const asset = submissionPrimaryAsset(s);
      const typeMeta = SUBMISSION_TYPES.find((t) => t.id === s.submission_type);
      return {
        kind: 'submission',
        id: `sub-${s.id}`,
        submissionId: s.id,
        assetId: asset?.id || null,
        reelVersionId: s.current_reel_version_id || null,
        submissionType: s.submission_type,
        typeBadge: typeMeta?.badge || s.submission_type,
        title: s.title || asset?.original_filename || 'Untitled',
        publicId: s.public_id,
        reviewStatus: s.review_status,
        actionOwner: s.action_owner,
        submittedAt: s.submitted_at,
        version: s.latest_version_number || 1,
        asset,
        submission: s,
      };
    });

    // Staff phone-dump intake (not contributor_self) stays visible in needs_review / all / raw.
    const showStaffIntake =
      !fromContributors &&
      (queueFilter === 'needs_review' || queueFilter === 'all' || queueFilter === 'raw_video');
    const staffRows = showStaffIntake
      ? (assets || [])
          .filter((a) => !isContributorSelfAsset(a))
          .map((a) => ({
            kind: 'asset',
            id: `asset-${a.id}`,
            submissionId: null,
            assetId: a.id,
            reelVersionId: null,
            submissionType: a.media_kind === 'video' ? 'raw_video' : 'social_post',
            typeBadge: a.media_kind === 'video' ? 'RAW VIDEO' : 'PHOTO',
            title: a.original_filename || 'Untitled',
            publicId: null,
            reviewStatus: 'awaiting_owner_review',
            actionOwner: 'owner',
            submittedAt: a.created_at,
            version: 1,
            asset: a,
            submission: null,
          }))
      : [];

    return [...subRows, ...staffRows].sort(
      (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0),
    );
  }, [submissions, assets, fromContributors, queueFilter]);

  /** Best-effort queue thumbs via authorized derivatives only (never originals). */
  const loadQueueThumbs = async (rows) => {
    setThumbsReady(false);
    const next = {};
    await Promise.all(
      (rows || []).map(async (row) => {
        const asset = row.asset;
        if (!asset?.id) return;
        try {
          const url = await assetPreviewUrl(asset);
          if (url) next[row.id] = url;
        } catch {
          /* thumbnail failure must not break the queue */
        }
      }),
    );
    setThumbUrls(next);
    setThumbsReady(true);
  };

  const loadQueue = async () => {
    setLoading(true);
    try {
      let subs = [];
      try {
        subs = await listSubmissions({
          queueFilter: fromContributors ? 'needs_review' : queueFilter,
          limit: 100,
        });
      } catch (err) {
        // Migration not applied yet — fall back to legacy asset queue.
        console.warn('listSubmissions unavailable; falling back to asset queue', err);
        subs = [];
      }

      let legacyAssets = [];
      if (!fromContributors && (queueFilter === 'needs_review' || queueFilter === 'all' || queueFilter === 'raw_video')) {
        legacyAssets = await listAssets({
          humanReviewStatus: 'pending',
          archived: false,
          trashed: false,
          limit: 100,
        });
      } else if (fromContributors && subs.length === 0) {
        // Compat: show contributor_self pending until backfill/migration is live.
        legacyAssets = await listAssets({
          humanReviewStatus: 'pending',
          archived: false,
          trashed: false,
          limit: 100,
          contributorSelf: true,
        });
      }

      setSubmissions(subs);
      setAssets(legacyAssets);

      const mapped = [];
      // thumbs loaded after rows computed in effect below
      const firstAssetId =
        submissionPrimaryAsset(subs[0])?.id ||
        legacyAssets.find((a) => fromContributors || !isContributorSelfAsset(a))?.id ||
        null;
      if (selectedId && !legacyAssets.some((r) => r.id === selectedId) && !subs.some((s) => submissionPrimaryAsset(s)?.id === selectedId)) {
        setSelectedId(firstAssetId);
        setSelectedSubmissionId(subs[0]?.id || null);
        if (!firstAssetId) {
          setBundle(null);
          setPreviewUrl(null);
          setThumbUrls({});
          setThumbsReady(true);
        }
      } else if (!selectedId && firstAssetId) {
        setSelectedId(firstAssetId);
        setSelectedSubmissionId(subs[0]?.id || null);
      }
      void mapped;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedId(null);
    setSelectedSubmissionId(null);
    setBundle(null);
    setPreviewUrl(null);
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromContributors, queueFilter]);

  useEffect(() => {
    void loadQueueThumbs(queueRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, assets, queueFilter, fromContributors]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    const loadBundle = async () => {
      try {
        const b = await fetchReviewBundle(selectedId);
        if (cancelled) return;
        setBundle(b);
        const verified = b.asset.mil_verified_metadata?.[0] || b.asset.mil_verified_metadata || {};
        const latestAi = b.analyses?.[0]?.suggested || {};
        setForm({
          service_category: verified.service_category || latestAi.service_category || '',
          work_phase: verified.work_phase || latestAi.work_phase || '',
          narrative: verified.narrative || latestAi.narrative || '',
          public_caption: verified.public_caption || latestAi.public_caption || '',
          alt_text: verified.alt_text || latestAi.alt_text || '',
          condition_notes: verified.condition_notes || latestAi.condition_notes || '',
          location_component: verified.location_component || latestAi.location_component || '',
        });
        const url = await assetPreviewUrl(b.asset);
        if (!cancelled) setPreviewUrl(url);
        return b;
      } catch (err) {
        if (!cancelled) setError(err.message);
        return null;
      }
    };

    void loadBundle();

    // Bounded poll while analysis is in flight so the owner does not need a manual refresh.
    const timer = setInterval(async () => {
      const b = await loadBundle();
      const processing = b?.asset?.processing_status;
      const analysisStatus = b?.analyses?.[0]?.status;
      const terminal =
        analysisStatus === 'succeeded' ||
        analysisStatus === 'failed' ||
        String(analysisStatus || '').startsWith('skipped_') ||
        processing === 'analyzed' ||
        processing === 'processing_failed';
      if (terminal) {
        clearInterval(timer);
        void loadQueue();
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e) => {
      if (!caps.canVerify) return;
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.tagName === 'SELECT') return;
      const idx = queueRows.findIndex((r) => r.assetId === selectedId || r.submissionId === selectedSubmissionId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        if (idx >= 0 && idx < queueRows.length - 1) {
          const next = queueRows[idx + 1];
          setSelectedId(next.assetId);
          setSelectedSubmissionId(next.submissionId);
        }
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        if (idx > 0) {
          const prev = queueRows[idx - 1];
          setSelectedId(prev.assetId);
          setSelectedSubmissionId(prev.submissionId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queueRows, selectedId, selectedSubmissionId, caps.canVerify]);

  const latestAnalysis = bundle?.analyses?.[0];
  const suggested = latestAnalysis?.suggested || {};

  const saveVerify = async () => {
    if (!caps.canVerify) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await verifyAssetMetadata(selectedId, form);
      setMessage('Verified. Human record saved.');
      await loadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runLifecycle = async (action) => {
    if (!caps.canLifecycleCleanup || !selectedId) return;
    const outcome = buildAnalysisOutcome(bundle?.asset, latestAnalysis);
    const reason =
      outcome?.qualityIssues?.[0] ||
      outcome?.recommendedAction ||
      (action === 'keep' ? 'review_keep' : action);
    if (action === 'trash' && !window.confirm('Move this photo to Trash? Recoverable for 30 days.')) {
      return;
    }
    if (
      action === 'archive' &&
      !window.confirm('Archive this photo? It leaves normal library, marketing, and creator views.')
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (action === 'keep') {
        await keepAsset(selectedId, reason);
        setMessage('Kept in active library (left Quality Cleanup).');
      } else {
        await setAssetLifecycle(selectedId, action, reason);
        setMessage(action === 'archive' ? 'Asset archived.' : 'Asset moved to Trash.');
      }
      await loadQueue();
    } catch (err) {
      setError(err.message || `${action} failed`);
    } finally {
      setSaving(false);
    }
  };

  const runRestrict = async () => {
    if (!caps.canVerify || !selectedId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await restrictAsset(selectedId);
      setMessage('Asset restricted for privacy review.');
      await loadQueue();
    } catch (err) {
      setError(err.message || 'Restrict failed');
    } finally {
      setSaving(false);
    }
  };

  if (!caps.canVerify) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
        Review and verification are limited to owners, admins, and internal reviewers. Creators cannot verify AI claims.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading review queue…
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      data-testid={fromContributors ? 'media-received-from-contributors' : 'media-review-queue'}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {fromContributors ? 'Received from contributors' : 'Review Queue'}
            </h2>
            <p className="text-sm text-slate-600">
              {fromContributors
                ? 'Contributor submissions awaiting owner action. Upload-only drafts never appear here.'
                : 'Unified queue for reels, raw media, and social posts — plus staff phone-dump intake.'}
            </p>
          </div>
          {contributorOnly && (
            <Link
              to="/media/review"
              className="text-sm text-blue-700 underline-offset-2 hover:underline min-h-[40px] inline-flex items-center"
            >
              Open full Review Queue
            </Link>
          )}
        </div>
        {!contributorOnly && (
          <div
            className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-1 text-sm"
            role="tablist"
            aria-label="Review queue filters"
            data-testid="media-review-queue-filters"
          >
            {REVIEW_QUEUE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={queueFilter === f.id}
                data-testid={
                  f.id === 'needs_review' ? 'media-review-from-contributors-tab' : `media-review-filter-${f.id}`
                }
                className={`rounded px-3 py-2 min-h-[40px] ${
                  queueFilter === f.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setSearchParams(f.id === 'needs_review' ? {} : { filter: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
      <aside className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-medium text-slate-800">
          {fromContributors ? 'Contributor submissions' : 'Queue'} ({queueRows.length})
        </div>
        <ul className="max-h-[70vh] overflow-y-auto divide-y" data-testid="media-review-queue-list">
          {queueRows.length === 0 && (
            <li className="p-4 text-sm text-slate-500">
              {fromContributors
                ? 'No contributor submissions waiting. Upload-only drafts stay out of this queue.'
                : 'Queue is clear for this filter.'}
            </li>
          )}
          {queueRows.map((row) => {
            const thumb = thumbUrls[row.id];
            const fallbackLabel =
              row.submissionType === 'reel'
                ? 'Reel'
                : row.asset?.media_kind === 'video'
                  ? 'Video'
                  : row.asset?.media_kind === 'photo'
                    ? 'Photo'
                    : 'Media';
            const selected =
              (row.submissionId && row.submissionId === selectedSubmissionId) ||
              (row.assetId && row.assetId === selectedId && !row.submissionId);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (row.submissionType === 'reel' && row.reelVersionId) {
                      navigate(`/media/reel-review?versionId=${encodeURIComponent(row.reelVersionId)}`);
                      return;
                    }
                    setSelectedId(row.assetId);
                    setSelectedSubmissionId(row.submissionId);
                  }}
                  className={`w-full text-left px-2.5 py-2 text-sm min-h-[52px] flex items-center gap-2.5 ${
                    selected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-slate-100">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        data-testid="media-review-queue-thumb"
                        onError={() => {
                          setThumbUrls((prev) => {
                            if (!prev[row.id]) return prev;
                            const copy = { ...prev };
                            delete copy[row.id];
                            return copy;
                          });
                        }}
                      />
                    ) : (
                      <span
                        className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] leading-tight text-slate-400"
                        data-testid="media-review-queue-thumb-fallback"
                      >
                        {thumbsReady ? fallbackLabel : '…'}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold tracking-wide text-slate-500">
                      {row.typeBadge}
                      {row.publicId ? ` · ${row.publicId}` : ''}
                    </span>
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {SUBMISSION_REVIEW_LABELS[row.reviewStatus] || row.reviewStatus}
                      {` · v${row.version}`}
                      {row.actionOwner === 'contributor' ? ' · waiting on contributor' : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        {error && <div className="text-sm text-red-700">{error}</div>}
        {message && <div className="text-sm text-emerald-700">{message}</div>}
        {!bundle && <p className="text-sm text-slate-500">Select an asset to review.</p>}
        {bundle && (
          <>
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="xl:w-1/2">
                <div className="aspect-[4/3] rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                  {previewUrl && bundle.asset.media_kind === 'video' ? (
                    <video src={previewUrl} controls className="max-h-full max-w-full" />
                  ) : previewUrl ? (
                    <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-sm text-slate-500 px-4 text-center">
                      Preview unavailable (HEIC may need a derivative). Original remains stored privately.
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Shortcuts: J/K or arrows to move queue. Each fact is verified separately.
                </p>
              </div>

              <div className="xl:w-1/2 space-y-3">
                <AnalysisOutcomeCard asset={bundle.asset} analysis={latestAnalysis} />

                <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
                  <div className="font-medium text-violet-950">AI suggestions — not verified</div>
                  {latestAnalysis ? (
                    <ul className="mt-2 space-y-1 text-violet-900 text-xs">
                      <li>Status: {latestAnalysis.status}</li>
                      <li>Confidence: {latestAnalysis.overall_confidence ?? '—'}</li>
                      <li>Provider/model: {latestAnalysis.provider}/{latestAnalysis.model || '—'}</li>
                      <li>Prompt: {latestAnalysis.prompt_version || '—'}</li>
                      <li>Tags: {(suggested.tags || []).join(', ') || '—'}</li>
                      <li>{latestAnalysis.explanation || suggested.explanation || 'No explanation stored.'}</li>
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-violet-900">
                      No analysis yet.{' '}
                      <button
                        type="button"
                        className="underline"
                        onClick={async () => {
                          try {
                            setError(null);
                            setMessage(null);
                            await queueAiAnalysis(selectedId);
                            setMessage('Analysis running — this panel updates automatically.');
                          } catch (err) {
                            setError(err.message || 'Analysis failed to start');
                          }
                        }}
                      >
                        Queue analysis
                      </button>
                    </p>
                  )}
                  {latestAnalysis && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="text-xs font-medium text-violet-900 underline"
                        onClick={async () => {
                          await acceptAiSuggestions(selectedId, latestAnalysis.id);
                          setMessage('Accepted AI suggestions and marked verified.');
                          await loadQueue();
                        }}
                      >
                        Accept all suggestions and verify
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-violet-900 underline"
                        onClick={async () => {
                          try {
                            setError(null);
                            await queueAiAnalysis(selectedId);
                            setMessage('Reanalysis running — updating automatically.');
                          } catch (err) {
                            setError(err.message || 'Reanalysis failed');
                          }
                        }}
                      >
                        Retry analysis
                      </button>
                    </div>
                  )}
                </div>

                {[
                  ['service_category', 'Service category'],
                  ['work_phase', 'Work phase (before/during/after/…)'],
                  ['location_component', 'Location / component'],
                  ['condition_notes', 'Condition notes'],
                  ['narrative', 'Searchable narrative'],
                  ['public_caption', 'Public caption'],
                  ['alt_text', 'Alt text'],
                ].map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="font-medium text-slate-700">{label}</span>
                    {suggested[key] && form[key] !== suggested[key] && (
                      <span className="ml-2 text-xs text-violet-700">AI suggested: {String(suggested[key])}</span>
                    )}
                    {key === 'narrative' || key === 'condition_notes' ? (
                      <textarea
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 min-h-[72px]"
                        value={form[key] || ''}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 min-h-[44px]"
                        value={form[key] || ''}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 border-t bg-white/95 backdrop-blur space-y-2">
              {selectedSubmissionId && (
                <div className="flex flex-wrap gap-2 pb-2 border-b" data-testid="media-review-submission-actions">
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
                    onClick={async () => {
                      setSaving(true);
                      setError(null);
                      try {
                        await reviewContentSubmission({
                          submissionId: selectedSubmissionId,
                          decision: 'accept_into_library',
                        });
                        setMessage('Submission accepted into library.');
                        await loadQueue();
                      } catch (err) {
                        setError(err.message || 'Accept failed');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Accept into library
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded-md border px-4 py-2.5 text-sm min-h-[44px]"
                    onClick={async () => {
                      setSaving(true);
                      setError(null);
                      try {
                        await reviewContentSubmission({
                          submissionId: selectedSubmissionId,
                          decision: 'request_changes',
                        });
                        setMessage('Changes requested — waiting on contributor.');
                        await loadQueue();
                      } catch (err) {
                        setError(err.message || 'Request changes failed');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded-md border border-red-300 text-red-800 px-4 py-2.5 text-sm min-h-[44px]"
                    onClick={async () => {
                      setSaving(true);
                      setError(null);
                      try {
                        await reviewContentSubmission({
                          submissionId: selectedSubmissionId,
                          decision: 'reject',
                        });
                        setMessage('Submission rejected.');
                        await loadQueue();
                      } catch (err) {
                        setError(err.message || 'Reject failed');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded-md border px-4 py-2.5 text-sm min-h-[44px]"
                    onClick={async () => {
                      setSaving(true);
                      setError(null);
                      try {
                        await reviewContentSubmission({
                          submissionId: selectedSubmissionId,
                          decision: 'restrict',
                        });
                        setMessage('Linked media restricted for privacy review.');
                        await loadQueue();
                      } catch (err) {
                        setError(err.message || 'Restrict failed');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Restrict
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !selectedId}
                  onClick={() => runLifecycle('keep')}
                  className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
                  data-testid="media-review-keep"
                >
                  Keep
                </button>
                <button
                  type="button"
                  disabled={saving || !selectedId}
                  onClick={() => runLifecycle('archive')}
                  className="rounded-md border px-4 py-2.5 text-sm min-h-[44px]"
                  data-testid="media-review-archive"
                >
                  Archive
                </button>
                <button
                  type="button"
                  disabled={saving || !selectedId}
                  onClick={() => runLifecycle('trash')}
                  className="rounded-md border border-amber-300 text-amber-950 px-4 py-2.5 text-sm min-h-[44px]"
                  data-testid="media-review-trash"
                >
                  Move to Trash
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveVerify}
                  className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
                >
                  {saving ? 'Saving…' : 'Save & verify'}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-4 py-2.5 text-sm min-h-[44px]"
                  onClick={async () => {
                    try {
                      await setPermittedUse(selectedId, 'reel_creation', true);
                      setMessage('Marked approved for reel creation (gates still enforce privacy/rights).');
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                >
                  Approve for reel creation
                </button>
                <button
                  type="button"
                  className="rounded-md border px-4 py-2.5 text-sm min-h-[44px]"
                  onClick={async () => {
                    try {
                      setError(null);
                      setMessage(null);
                      await queueAiAnalysis(selectedId);
                      setMessage('Reanalysis finished. Verified human fields will not be overwritten automatically.');
                      await loadQueue();
                    } catch (err) {
                      setError(err.message || 'Reanalysis failed');
                    }
                  }}
                >
                  Reanalyze (keep verified)
                </button>
                <button
                  type="button"
                  disabled={saving || !selectedId}
                  onClick={runRestrict}
                  className="rounded-md border border-amber-300 text-amber-900 px-4 py-2.5 text-sm min-h-[44px]"
                  data-testid="media-review-restrict"
                >
                  Restrict
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      </div>
    </div>
  );
}
