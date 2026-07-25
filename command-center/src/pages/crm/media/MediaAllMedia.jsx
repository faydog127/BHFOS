import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { assetPreviewUrl, listAssets } from '@/lib/mediaIntel/api';
import { HUMAN_REVIEW_LABELS, PRIVACY_LABELS } from '@/lib/mediaIntel/constants';

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
  const [selected, setSelected] = useState(() => new Set());

  const filters = useMemo(
    () => ({
      mediaKind: params.get('kind') || undefined,
      humanReviewStatus: params.get('review') || undefined,
      privacyStatus: params.get('privacy') || undefined,
      search: params.get('q') || undefined,
      archived: false,
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
        if (!cancelled) setAssets(rows);
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

  if (!caps.isStaff && !caps.isCreator) {
    return <div className="text-sm text-slate-600">Sign in with an authorized media role.</div>;
  }

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
                if (search) next.set('q', search);
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
          No media matches these filters. Upload a phone dump to populate the library.
        </div>
      ) : (
        <>
          <div className="text-sm text-slate-600">
            Showing {assets.length} · selected {selected.size}
            {selected.size > 0 && caps.canVerify && (
              <span className="ml-2 text-slate-500">Bulk actions available in review for safe repeated metadata.</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {assets.map((asset) => (
              <label key={asset.id} className="block rounded-lg border bg-white p-2 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selected.has(asset.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(asset.id);
                        else next.delete(asset.id);
                        return next;
                      });
                    }}
                  />
                  <span className="text-[11px] text-slate-500 truncate">{HUMAN_REVIEW_LABELS[asset.human_review_status]}</span>
                </div>
                <Thumb asset={asset} />
                <div className="mt-2 text-xs font-medium text-slate-800 truncate">{asset.original_filename}</div>
                <div className="text-[11px] text-slate-500">{PRIVACY_LABELS[asset.privacy_status]}</div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
