import React, { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  acceptAiSuggestions,
  assetPreviewUrl,
  fetchReviewBundle,
  keepAsset,
  listAssets,
  queueAiAnalysis,
  restrictAsset,
  setAssetLifecycle,
  setPermittedUse,
  verifyAssetMetadata,
} from '@/lib/mediaIntel/api';
import AnalysisOutcomeCard from '@/components/media/AnalysisOutcomeCard';
import { buildAnalysisOutcome } from '@/lib/mediaIntel/analysisDisplay';

function isContributorSelfAsset(asset) {
  const batch = asset?.mil_upload_batches;
  const row = Array.isArray(batch) ? batch[0] : batch;
  return row?.source_label === 'contributor_self';
}

export default function MediaReviewQueue({ contributorOnly = false } = {}) {
  const { caps } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromContributors =
    contributorOnly || searchParams.get('source') === 'contributor';
  const [assets, setAssets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [thumbUrls, setThumbUrls] = useState({});
  const [thumbsReady, setThumbsReady] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  /** Best-effort queue thumbs via authorized derivatives only (never originals). */
  const loadQueueThumbs = async (rows) => {
    setThumbsReady(false);
    const next = {};
    await Promise.all(
      (rows || []).map(async (asset) => {
        try {
          const url = await assetPreviewUrl(asset);
          if (url) next[asset.id] = url;
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
      const rows = await listAssets({
        humanReviewStatus: 'pending',
        archived: false,
        trashed: false,
        limit: 100,
        contributorSelf: fromContributors || undefined,
      });
      setAssets(rows);
      void loadQueueThumbs(rows);
      if (selectedId && !rows.some((r) => r.id === selectedId)) {
        setSelectedId(rows[0]?.id || null);
        if (!rows[0]) {
          setBundle(null);
          setPreviewUrl(null);
          setThumbUrls({});
          setThumbsReady(true);
        }
      } else if (!selectedId && rows[0]) {
        setSelectedId(rows[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedId(null);
    setBundle(null);
    setPreviewUrl(null);
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromContributors]);

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
      if (e.key === 'j' || e.key === 'ArrowDown') {
        const idx = assets.findIndex((a) => a.id === selectedId);
        if (idx >= 0 && idx < assets.length - 1) setSelectedId(assets[idx + 1].id);
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        const idx = assets.findIndex((a) => a.id === selectedId);
        if (idx > 0) setSelectedId(assets[idx - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assets, selectedId, caps.canVerify]);

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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {fromContributors ? 'Received from contributors' : 'Review Queue'}
          </h2>
          <p className="text-sm text-slate-600">
            {fromContributors
              ? 'Phone shots and videos contributors sent via Upload my shots. Privacy/quality check before library use.'
              : 'All pending intake — staff phone dumps and contributor uploads.'}
          </p>
        </div>
        {!contributorOnly && (
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-sm" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!fromContributors}
              className={`rounded px-3 py-2 min-h-[40px] ${
                !fromContributors ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setSearchParams({})}
            >
              All pending
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={fromContributors}
              data-testid="media-review-from-contributors-tab"
              className={`rounded px-3 py-2 min-h-[40px] ${
                fromContributors ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setSearchParams({ source: 'contributor' })}
            >
              From contributors
            </button>
          </div>
        )}
        {contributorOnly && (
          <Link
            to="/media/review"
            className="text-sm text-blue-700 underline-offset-2 hover:underline min-h-[40px] inline-flex items-center"
          >
            Open full Review Queue
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
      <aside className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-medium text-slate-800">
          {fromContributors ? 'Contributor uploads' : 'Awaiting review'} ({assets.length})
        </div>
        <ul className="max-h-[70vh] overflow-y-auto divide-y" data-testid="media-review-queue-list">
          {assets.length === 0 && (
            <li className="p-4 text-sm text-slate-500">
              {fromContributors
                ? 'No contributor uploads waiting. When a creator uses Upload my shots, files appear here.'
                : 'Queue is clear. New uploads appear here after intake.'}
            </li>
          )}
          {assets.map((a) => {
            const thumb = thumbUrls[a.id];
            const fallbackLabel = a.media_kind === 'video' ? 'Video' : a.media_kind === 'photo' ? 'Photo' : 'Media';
            const fromCreator = isContributorSelfAsset(a);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left px-2.5 py-2 text-sm min-h-[52px] flex items-center gap-2.5 ${
                    selectedId === a.id ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
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
                            if (!prev[a.id]) return prev;
                            const copy = { ...prev };
                            delete copy[a.id];
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
                    <span className="block truncate font-medium">{a.original_filename}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {a.media_kind} · {a.processing_status}
                      {fromCreator ? ' · contributor' : ''}
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
