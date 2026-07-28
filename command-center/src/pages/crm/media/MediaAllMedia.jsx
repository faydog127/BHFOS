import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { assetPreviewUrl, fetchReviewBundle, listAssets } from '@/lib/mediaIntel/api';
import { HUMAN_REVIEW_LABELS, PRIVACY_LABELS } from '@/lib/mediaIntel/constants';
import AnalysisOutcomeCard from '@/components/media/AnalysisOutcomeCard';

function Thumb({ asset }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    assetPreviewUrl(asset).then((u) => {
      if (!cancelled) setUrl(u);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [asset]);
  return (
    <div className="aspect-square bg-slate-100 rounded-md overflow-hidden flex items-center justify-center">
      {url ? (
        asset.media_kind === 'video' ? (
          <video src={url} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        )
      ) : (
        <span className="text-[10px] text-slate-500 px-2 text-center">{asset.media_kind}</span>
      )}
    </div>
  );
}

export default function MediaAllMedia() {
  const { caps } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(params.get('q') || '');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const duplicatesOnly = params.get('dup') === '1';

  const filters = useMemo(
    () => ({
      mediaKind: params.get('kind') || undefined,
      humanReviewStatus: params.get('review') || undefined,
      privacyStatus: params.get('privacy') || undefined,
      search: params.get('q') || undefined,
      duplicatesOnly: params.get('dup') === '1' || undefined,
      archived: false,
      trashed: false,
      limit: 120,
    }),
    [params],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await listAssets(filters);
        if (!cancelled) {
          setAssets(rows);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    if (!selectedId || !caps.isStaff) {
      setSelectedBundle(null);
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const b = await fetchReviewBundle(selectedId);
        if (!cancelled) setSelectedBundle(b);
        return b;
      } catch {
        if (!cancelled) setSelectedBundle(null);
        return null;
      }
    };
    void load();
    const timer = setInterval(async () => {
      const b = await load();
      const status = b?.analyses?.[0]?.status;
      const processing = b?.asset?.processing_status;
      if (
        status === 'succeeded' ||
        status === 'failed' ||
        String(status || '').startsWith('skipped_') ||
        processing === 'analyzed' ||
        processing === 'processing_failed'
      ) {
        clearInterval(timer);
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId, caps.isStaff]);

  if (!caps.isStaff && !caps.isCreator) {
    return <div className="text-sm text-slate-600">Sign in with an authorized media role.</div>;
  }

  const activeSearch = (params.get('q') || '').trim();

  return (
    <div className="space-y-4" data-testid="media-all">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1 text-sm">
          <span className="font-medium text-slate-700">Search</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const next = new URLSearchParams(params);
                const trimmed = search.trim();
                if (trimmed) next.set('q', trimmed);
                else next.delete('q');
                setParams(next);
              }
            }}
            placeholder="Filename, tags, or id"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Type</span>
          <select
            className="mt-1 block rounded-md border px-3 py-2 min-h-[44px]"
            value={params.get('kind') || ''}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('kind', e.target.value);
              else next.delete('kind');
              setParams(next);
            }}
          >
            <option value="">All</option>
            <option value="photo">Photos</option>
            <option value="video">Videos</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Review</span>
          <select
            className="mt-1 block rounded-md border px-3 py-2 min-h-[44px]"
            value={params.get('review') || ''}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('review', e.target.value);
              else next.delete('review');
              setParams(next);
            }}
          >
            <option value="">Any</option>
            {Object.entries(HUMAN_REVIEW_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading media…
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-600">
          {duplicatesOnly
            ? 'No duplicate candidates match these filters.'
            : activeSearch
              ? 'No media matches this search.'
              : 'No media matches these filters. Upload a phone dump to populate the library.'}
        </div>
      ) : (
        <>
          <div className="text-sm text-slate-600">
            Showing {assets.length}
            {duplicatesOnly ? ' · duplicate candidates (linked via duplicate_of_asset_id)' : ''}
          </div>
          <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {assets.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className={`rounded-lg border bg-white p-2 text-left ${
                    selectedId === asset.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <div className="mb-2 text-[11px] text-slate-500 truncate">
                    {HUMAN_REVIEW_LABELS[asset.human_review_status]}
                  </div>
                  <Thumb asset={asset} />
                  <div className="mt-2 text-xs font-medium text-slate-800 truncate">{asset.original_filename}</div>
                  <div className="text-[11px] text-slate-500">{PRIVACY_LABELS[asset.privacy_status]}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">AI: {asset.processing_status || '—'}</div>
                  {asset.duplicate_of_asset_id && (
                    <div className="text-[10px] text-amber-800 mt-1 truncate" title={asset.duplicate_of_asset_id}>
                      Duplicate of {String(asset.duplicate_of_asset_id).slice(0, 8)}…
                    </div>
                  )}
                </button>
              ))}
            </div>
            {caps.isStaff && (
              <aside className="rounded-xl border bg-white p-3 space-y-2 sticky top-4" data-testid="media-all-analysis">
                <h3 className="text-sm font-medium text-slate-900">Selected media analysis</h3>
                {!selectedId && <p className="text-xs text-slate-500">Select an item to see AI outcome.</p>}
                {selectedId && !selectedBundle && (
                  <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </p>
                )}
                {selectedBundle && (
                  <AnalysisOutcomeCard
                    asset={selectedBundle.asset}
                    analysis={selectedBundle.analyses?.[0]}
                  />
                )}
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
