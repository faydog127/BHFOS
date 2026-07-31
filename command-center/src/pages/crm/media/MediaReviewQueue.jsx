import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  acceptAiSuggestions,
  assetPreviewUrl,
  fetchReviewBundle,
  keepAsset,
  listSubmissions,
  queueAiAnalysis,
  resolveReviewPreviewAccess,
  resolveReviewReelPreviewAccess,
  restrictAsset,
  reviewContentSubmission,
  setAssetLifecycle,
  setPermittedUse,
  verifyAssetMetadata,
} from '@/lib/mediaIntel/api';
import { requestSignedMediaUrl } from '@/lib/mediaIntel/signedAccess';
import { PREVIEW_STATES, buildReelReviewPath } from '@/lib/mediaIntel/previewAccess';
import {
  buildSubmissionQueueRows,
  shouldIncludeStaffIntakeAssets,
  submissionPrimaryAsset,
} from '@/lib/mediaIntel/reviewQueueModel';
import AnalysisOutcomeCard from '@/components/media/AnalysisOutcomeCard';
import { buildAnalysisOutcome } from '@/lib/mediaIntel/analysisDisplay';
import { REVIEW_QUEUE_FILTERS, SUBMISSION_REVIEW_LABELS } from '@/lib/mediaIntel/constants';

export default function MediaReviewQueue({ contributorOnly = false } = {}) {
  const { caps } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromContributors =
    contributorOnly || searchParams.get('source') === 'contributor';
  const queueFilter = fromContributors
    ? 'needs_review'
    : searchParams.get('filter') || 'needs_review';
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [selectedReelVersionId, setSelectedReelVersionId] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewAccess, setPreviewAccess] = useState(null);
  const [thumbUrls, setThumbUrls] = useState({});
  const [thumbsReady, setThumbsReady] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Fix C: actionable queues are mil_submissions only (never staff/legacy assets).
  const queueRows = useMemo(
    () =>
      buildSubmissionQueueRows(submissions).sort(
        (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0),
      ),
    [submissions],
  );

  const selectedRow = useMemo(
    () =>
      queueRows.find(
        (r) =>
          (r.submissionId && r.submissionId === selectedSubmissionId)
          || (r.assetId && r.assetId === selectedId && !r.submissionId),
      ) || null,
    [queueRows, selectedId, selectedSubmissionId],
  );

  /** Select in place — never auto-navigate (Fix B). */
  const selectQueueRow = (row) => {
    setSelectedId(row?.assetId || null);
    setSelectedSubmissionId(row?.submissionId || null);
    setSelectedReelVersionId(
      row?.submissionType === 'reel' && row?.reelVersionId ? row.reelVersionId : null,
    );
    setError(null);
    setMessage(null);
  };

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
        // Do not fall back to staff/legacy asset lists — that polluted Needs review / Raw media.
        console.warn('listSubmissions unavailable; showing empty submission queue', err);
        subs = [];
      }

      // Guard: staff intake must never re-enter this view-model (Uploads / All Media / Phone upload instead).
      if (shouldIncludeStaffIntakeAssets()) {
        throw new Error('Staff intake assets must not be merged into Review Queue filters');
      }

      setSubmissions(subs);

      const firstSub = subs[0] || null;
      const firstAssetId = submissionPrimaryAsset(firstSub)?.id || null;
      const firstReelVersionId =
        firstSub?.submission_type === 'reel' ? firstSub.current_reel_version_id || null : null;
      const selectionStillPresent =
        (selectedSubmissionId && subs.some((s) => s.id === selectedSubmissionId))
        || (selectedId && subs.some((s) => submissionPrimaryAsset(s)?.id === selectedId));

      if (!selectionStillPresent) {
        if (firstSub) {
          setSelectedId(firstAssetId);
          setSelectedSubmissionId(firstSub.id);
          setSelectedReelVersionId(firstReelVersionId);
        } else {
          setSelectedId(null);
          setSelectedSubmissionId(null);
          setSelectedReelVersionId(null);
          setBundle(null);
          setPreviewUrl(null);
          setPreviewAccess(null);
          setThumbUrls({});
          setThumbsReady(true);
        }
      } else if (!selectedId && !selectedSubmissionId && firstSub) {
        setSelectedId(firstAssetId);
        setSelectedSubmissionId(firstSub.id);
        setSelectedReelVersionId(firstReelVersionId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedId(null);
    setSelectedSubmissionId(null);
    setSelectedReelVersionId(null);
    setBundle(null);
    setPreviewUrl(null);
    setPreviewAccess(null);
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromContributors, queueFilter]);

  useEffect(() => {
    void loadQueueThumbs(queueRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, queueFilter, fromContributors]);

  useEffect(() => {
    if (!selectedId && !selectedReelVersionId) {
      setBundle(null);
      setPreviewUrl(null);
      setPreviewAccess(null);
      return undefined;
    }
    let cancelled = false;
    const loadSelection = async () => {
      try {
        setPreviewUrl(null);
        setPreviewAccess(null);

        // Reel versions preview from mil_reel_versions signing (not asset originals).
        if (selectedReelVersionId) {
          if (!selectedId) setBundle(null);
          const access = await resolveReviewReelPreviewAccess(selectedReelVersionId);
          if (cancelled) return null;
          setPreviewAccess(access);
          setPreviewUrl(access?.canPreview ? access.url : null);
        }

        if (!selectedId) return null;

        const b = await fetchReviewBundle(selectedId);
        if (cancelled) return null;
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
        // Linked asset on a reel is secondary — reel version preview already set above.
        if (!selectedReelVersionId) {
          const access = await resolveReviewPreviewAccess(b.asset);
          if (!cancelled) {
            setPreviewAccess(access);
            setPreviewUrl(access?.canPreview ? access.url : null);
          }
        }
        return b;
      } catch (err) {
        if (!cancelled) setError(err.message);
        return null;
      }
    };

    void loadSelection();

    // Bounded poll while analysis is in flight so the owner does not need a manual refresh.
    const timer = setInterval(async () => {
      if (!selectedId || selectedReelVersionId) return;
      const b = await loadSelection();
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
  }, [selectedId, selectedReelVersionId]);

  useEffect(() => {
    const onKey = (e) => {
      if (!caps.canVerify) return;
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.tagName === 'SELECT') return;
      const idx = queueRows.findIndex((r) => r.assetId === selectedId || r.submissionId === selectedSubmissionId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        if (idx >= 0 && idx < queueRows.length - 1) {
          selectQueueRow(queueRows[idx + 1]);
        }
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        if (idx > 0) {
          selectQueueRow(queueRows[idx - 1]);
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
                : 'Unified queue for finalized contributor submissions — reels, raw media, and social posts. Staff phone-dump and library intake stay in Uploads / All Media / Phone upload.'}
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

      <div className="grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-4 min-w-0">
      <aside className="rounded-xl border border-slate-200 bg-white overflow-hidden min-w-0">
        <div className="px-3 py-2 border-b text-sm font-medium text-slate-800">
          {fromContributors ? 'Contributor submissions' : 'Queue'}{' '}
          <span data-testid="media-review-queue-count">({queueRows.length})</span>
        </div>
        <ul className="max-h-[70vh] overflow-y-auto divide-y" data-testid="media-review-queue-list">
          {queueRows.length === 0 && (
            <li className="p-4 text-sm text-slate-500" data-testid="media-review-queue-empty">
              {fromContributors
                ? 'No contributor submissions waiting. Upload-only drafts stay out of this queue.'
                : 'No finalized contributor submissions for this filter. Staff intake is not listed here.'}
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
                  data-testid="media-review-queue-row"
                  data-submission-type={row.submissionType || ''}
                  data-reel-version-id={row.reelVersionId || ''}
                  onClick={() => selectQueueRow(row)}
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

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 min-w-0">
        {error && <div className="text-sm text-red-700">{error}</div>}
        {message && <div className="text-sm text-emerald-700">{message}</div>}
        {!selectedRow && <p className="text-sm text-slate-500">Select an item to review.</p>}
        {selectedRow && (
          <>
            <div className="flex flex-col xl:flex-row gap-4 min-w-0">
              <div className="xl:w-1/2 min-w-0">
                <div
                  className="aspect-[4/3] rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center"
                  data-testid="media-review-preview-pane"
                  data-preview-state={previewAccess?.state || 'loading'}
                >
                  {previewUrl && (selectedReelVersionId || bundle?.asset?.media_kind === 'video') ? (
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-full max-w-full"
                      data-testid="media-review-inline-video"
                    />
                  ) : previewUrl ? (
                    <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div
                      className="px-4 text-center space-y-1 max-w-md"
                      data-testid="media-review-preview-fallback"
                    >
                      <div
                        className={`text-sm font-medium ${
                          previewAccess?.state === PREVIEW_STATES.SOURCE_MISSING
                            ? 'text-red-800'
                            : 'text-slate-800'
                        }`}
                      >
                        {previewAccess?.title || 'Loading preview…'}
                      </div>
                      <p className="text-sm text-slate-600">
                        {previewAccess?.message
                          || 'Checking storage and preview availability…'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!previewAccess?.canDownload || saving}
                    className="rounded-md border px-3 py-2 text-xs min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="media-review-download"
                    title={
                      previewAccess?.state === PREVIEW_STATES.SOURCE_MISSING
                        ? 'Download unavailable — source file missing from storage'
                        : previewAccess?.canDownload
                          ? 'Download via authorized short-lived URL'
                          : 'Download unavailable'
                    }
                    onClick={async () => {
                      if (!previewAccess?.canDownload) return;
                      try {
                        setError(null);
                        const signed = selectedReelVersionId
                          ? await requestSignedMediaUrl({
                            reelVersionId: selectedReelVersionId,
                            purpose: 'download',
                          })
                          : await requestSignedMediaUrl({
                            assetId: selectedId,
                            purpose: 'download',
                            allowOriginal: true,
                          });
                        if (!signed?.url) throw new Error('Download URL unavailable');
                        const a = document.createElement('a');
                        a.href = signed.url;
                        a.download = selectedRow?.title || bundle?.asset?.original_filename || 'media';
                        a.rel = 'noopener';
                        a.target = '_blank';
                        a.click();
                      } catch (err) {
                        setError(err.message || 'Download failed');
                      }
                    }}
                  >
                    Download
                  </button>
                  {selectedReelVersionId && (
                    <Link
                      to={buildReelReviewPath(selectedReelVersionId)}
                      className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900 min-h-[40px] inline-flex items-center"
                      data-testid="media-review-open-reel-review"
                    >
                      Open in Reel Review
                    </Link>
                  )}
                  <p className="text-xs text-slate-500">
                    Shortcuts: J/K or arrows to move queue. Each fact is verified separately.
                  </p>
                </div>
              </div>

              <div className="xl:w-1/2 space-y-3 min-w-0">
                {selectedRow.kind === 'submission' && (
                  <div
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm space-y-1"
                    data-testid="media-review-submission-meta"
                  >
                    <div className="font-medium text-slate-900">{selectedRow.title}</div>
                    <div className="text-xs text-slate-600">
                      {selectedRow.typeBadge}
                      {selectedRow.publicId ? ` · Submission ID ${selectedRow.publicId}` : ''}
                      {` · v${selectedRow.version}`}
                    </div>
                    <div className="text-xs text-slate-600">
                      Status: {SUBMISSION_REVIEW_LABELS[selectedRow.reviewStatus] || selectedRow.reviewStatus}
                      {selectedRow.actionOwner === 'contributor' ? ' · waiting on contributor' : ''}
                    </div>
                    {selectedRow.submission?.contributor_notes ? (
                      <div className="text-xs text-slate-600">
                        Notes: {selectedRow.submission.contributor_notes}
                      </div>
                    ) : null}
                    {selectedReelVersionId ? (
                      <div className="text-xs text-slate-500 break-all">
                        Reel version: {selectedReelVersionId}
                      </div>
                    ) : null}
                  </div>
                )}

                {bundle?.asset ? (
                  <AnalysisOutcomeCard asset={bundle.asset} analysis={latestAnalysis} />
                ) : selectedReelVersionId ? (
                  <p className="text-sm text-slate-600" data-testid="media-review-reel-only-note">
                    Reel submission — inspect the inline preview here, use submission actions below, or open
                    the specialized Reel Review workspace for approve / deny / revision.
                  </p>
                ) : null}

                {bundle?.asset && (
                <>

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
                </>
                )}
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
