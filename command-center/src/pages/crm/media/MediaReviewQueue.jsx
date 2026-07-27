import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  acceptAiSuggestions,
  archiveAsset,
  assetPreviewUrl,
  fetchReviewBundle,
  listAssets,
  queueAiAnalysis,
  restrictAsset,
  setPermittedUse,
  verifyAssetMetadata,
} from '@/lib/mediaIntel/api';

export default function MediaReviewQueue() {
  const { caps } = useOutletContext();
  const [assets, setAssets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const rows = await listAssets({ humanReviewStatus: 'pending', archived: false, limit: 100 });
      setAssets(rows);
      if (selectedId && !rows.some((r) => r.id === selectedId)) {
        setSelectedId(rows[0]?.id || null);
        if (!rows[0]) {
          setBundle(null);
          setPreviewUrl(null);
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
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    (async () => {
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
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const runArchiveAction = async (action) => {
    if (!caps.canVerify || !selectedId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (action === 'archive') {
        await archiveAsset(selectedId);
        setMessage('Asset archived.');
      } else {
        await restrictAsset(selectedId);
        setMessage('Asset restricted for privacy review.');
      }
      await loadQueue();
    } catch (err) {
      setError(err.message || `${action} failed`);
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
    <div className="grid lg:grid-cols-[280px_1fr] gap-4" data-testid="media-review-queue">
      <aside className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-medium text-slate-800">
          Awaiting review ({assets.length})
        </div>
        <ul className="max-h-[70vh] overflow-y-auto divide-y">
          {assets.length === 0 && (
            <li className="p-4 text-sm text-slate-500">Queue is clear. New uploads appear here after intake.</li>
          )}
          {assets.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left px-3 py-3 text-sm min-h-[44px] ${
                  selectedId === a.id ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                }`}
              >
                <div className="truncate font-medium">{a.original_filename}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {a.media_kind} · {a.processing_status}
                </div>
              </button>
            </li>
          ))}
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
                <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
                  <div className="font-medium text-violet-950">AI suggestions — not verified</div>
                  {latestAnalysis ? (
                    <ul className="mt-2 space-y-1 text-violet-900 text-xs">
                      <li>Confidence: {latestAnalysis.overall_confidence ?? '—'}</li>
                      <li>Provider/model: {latestAnalysis.provider}/{latestAnalysis.model || '—'}</li>
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
                            setMessage('Analysis started.');
                            await loadQueue();
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
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-violet-900 underline"
                      onClick={async () => {
                        await acceptAiSuggestions(selectedId, latestAnalysis.id);
                        setMessage('Accepted AI suggestions and marked verified.');
                        await loadQueue();
                      }}
                    >
                      Accept all suggestions and verify
                    </button>
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

            <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 border-t bg-white/95 backdrop-blur flex flex-wrap gap-2">
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
                onClick={() => runArchiveAction('archive')}
                className="rounded-md border px-4 py-2.5 text-sm min-h-[44px]"
                data-testid="media-review-archive"
              >
                Archive
              </button>
              <button
                type="button"
                disabled={saving || !selectedId}
                onClick={() => runArchiveAction('restrict')}
                className="rounded-md border border-amber-300 text-amber-900 px-4 py-2.5 text-sm min-h-[44px]"
                data-testid="media-review-restrict"
              >
                Restrict
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
