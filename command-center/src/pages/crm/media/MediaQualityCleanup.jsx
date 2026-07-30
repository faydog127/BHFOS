import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  listAssets,
  setAssetsLifecycle,
  setAssetLifecycle,
} from '@/lib/mediaIntel/api';
import {
  LIFECYCLE_RECOMMENDATION_LABELS,
  QUALITY_ISSUE_LABELS,
} from '@/lib/mediaIntel/lifecycleHelpers';
import AnalysisOutcomeCard from '@/components/media/AnalysisOutcomeCard';

export default function MediaQualityCleanup() {
  const { caps } = useOutletContext();
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAssets({ qualityCleanup: true, limit: 100 });
      setAssets(rows);
      setSelected(new Set());
      if (detailId && !rows.some((r) => r.id === detailId)) setDetailId(rows[0]?.id || null);
      else if (!detailId && rows[0]) setDetailId(rows[0].id);
    } catch (err) {
      setError(err.message || 'Unable to load quality cleanup queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detail = useMemo(() => assets.find((a) => a.id === detailId) || null, [assets, detailId]);
  const selectedIds = useMemo(() => [...selected], [selected]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === assets.length) setSelected(new Set());
    else setSelected(new Set(assets.map((a) => a.id)));
  };

  const runBulk = async (action) => {
    if (!caps.canLifecycleCleanup) return;
    const ids = selectedIds.length ? selectedIds : detailId ? [detailId] : [];
    if (!ids.length) {
      setError('Select one or more photos first.');
      return;
    }
    if (action === 'trash' && !window.confirm(`Move ${ids.length} photo(s) to Trash? Recoverable for 30 days.`)) {
      return;
    }
    if (action === 'archive' && !window.confirm(`Archive ${ids.length} photo(s)? They leave normal library, marketing, and creator views.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (ids.length === 1) {
        await setAssetLifecycle(ids[0], action, action === 'archive' ? 'quality_cleanup' : 'quality_cleanup');
      } else {
        const result = await setAssetsLifecycle(ids, action, 'quality_cleanup');
        if (result?.failed) {
          setError(`${result.failed} failed; ${result.succeeded} succeeded.`);
        }
      }
      setMessage(
        action === 'archive'
          ? `Archived ${ids.length} photo(s).`
          : action === 'trash'
            ? `Moved ${ids.length} photo(s) to Trash.`
            : `Kept ${ids.length} photo(s).`,
      );
      await load();
    } catch (err) {
      setError(err.message || 'Lifecycle action failed');
    } finally {
      setBusy(false);
    }
  };

  if (!caps.canLifecycleCleanup) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
        Quality Cleanup is limited to owners, admins, and media reviewers.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading quality cleanup…
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="media-quality-cleanup">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Quality Cleanup</h2>
          <p className="text-sm text-slate-600 mt-1">
            AI suggests Archive or Trash for poor-quality media. You decide. Originals are never
            permanently deleted here.
          </p>
        </div>
        <Link className="text-sm text-blue-700 underline" to="/media/archive">
          Open Archive / Trash
        </Link>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || (!selectedIds.length && !detailId)}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white min-h-[44px] disabled:opacity-50"
          onClick={() => runBulk('keep')}
        >
          Keep
        </button>
        <button
          type="button"
          disabled={busy || (!selectedIds.length && !detailId)}
          className="rounded-md border px-3 py-2 text-sm min-h-[44px] disabled:opacity-50"
          onClick={() => runBulk('archive')}
        >
          Archive
        </button>
        <button
          type="button"
          disabled={busy || (!selectedIds.length && !detailId)}
          className="rounded-md border border-amber-300 text-amber-950 px-3 py-2 text-sm min-h-[44px] disabled:opacity-50"
          onClick={() => runBulk('trash')}
        >
          Move to Trash
        </button>
        <button type="button" className="rounded-md border px-3 py-2 text-sm min-h-[44px]" onClick={toggleAll}>
          {selected.size === assets.length && assets.length ? 'Clear selection' : 'Select all'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <ul className="rounded-xl border bg-white divide-y">
          {assets.length === 0 && (
            <li className="p-4 text-sm text-slate-500">No quality cleanup candidates right now.</li>
          )}
          {assets.map((a) => {
            const issues = (a.ai_quality_issues || []).map((i) => QUALITY_ISSUE_LABELS[i] || i);
            return (
              <li key={a.id} className={`px-3 py-3 ${detailId === a.id ? 'bg-blue-50/60' : ''}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    aria-label={`Select ${a.original_filename}`}
                  />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetailId(a.id)}>
                    <div className="truncate font-medium text-slate-900">{a.original_filename}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {LIFECYCLE_RECOMMENDATION_LABELS[a.ai_lifecycle_recommendation] ||
                        a.ai_lifecycle_recommendation ||
                        'Review'}
                      {a.ai_usability ? ` · ${a.ai_usability}` : ''}
                    </div>
                    {issues.length ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {issues.map((label) => (
                          <span key={label} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-950">
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="rounded-xl border bg-white p-3 space-y-3">
          <h3 className="font-medium text-slate-900">Selected detail</h3>
          {!detail && <p className="text-sm text-slate-500">Select a row.</p>}
          {detail && (
            <>
              <p className="text-sm truncate font-medium">{detail.original_filename}</p>
              <AnalysisOutcomeCard
                asset={detail}
                analysis={{
                  status: detail.processing_status === 'analyzed' ? 'succeeded' : 'queued',
                  suggested: {
                    lifecycle_recommendation: detail.ai_lifecycle_recommendation,
                    quality_issues: detail.ai_quality_issues,
                    usability: detail.ai_usability,
                  },
                }}
                compact
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
