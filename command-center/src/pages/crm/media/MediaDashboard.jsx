import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { fetchDashboardStats } from '@/lib/mediaIntel/api';

function Stat({ label, value, to, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200 bg-white',
    warn: 'border-amber-200 bg-amber-50',
    danger: 'border-red-200 bg-red-50',
    ok: 'border-emerald-200 bg-emerald-50',
  };
  const body = (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">
      {body}
    </Link>
  );
}

export default function MediaDashboard() {
  const { caps } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchDashboardStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading overview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
        {error}
        <p className="mt-2 text-red-700">
          If mil_* tables are missing, apply the Media Intelligence migrations on this project first
          (see docs/media-intelligence/STAGING_APPLY_PACKET.md). Zeros are not shown when the query fails.
        </p>
      </div>
    );
  }

  const libraryEmpty =
    (stats.totalPhotos || 0) === 0 &&
    (stats.totalVideos || 0) === 0 &&
    (stats.recentlyUploaded || 0) === 0;

  return (
    <div className="space-y-6" data-testid="media-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Operations overview</h2>
          <p className="text-sm text-slate-600">
            Live counts from private media intake — not sample data.
            {libraryEmpty
              ? ' Library is empty until uploads land (or migrations are applied on this project).'
              : ''}
          </p>
        </div>
        {caps.canUpload && (
          <Link
            to="/media/uploads"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 min-h-[44px]"
          >
            Start phone dump upload
          </Link>
        )}
      </div>

      {libraryEmpty && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700" data-testid="media-dashboard-empty">
          No media rows yet. AI and review queues stay empty until files finalize into the library.
          Analysis is invoke-on-demand only — there is no background worker draining the queue.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <Stat label="Photos" value={stats.totalPhotos} to="/media/all?kind=photo" />
        <Stat label="Videos" value={stats.totalVideos} to="/media/all?kind=video" />
        <Stat label="Uploaded last 7 days" value={stats.recentlyUploaded} />
        <Stat
          label="Awaiting on-demand AI"
          value={stats.awaitingAi}
          to="/media/review"
          tone={stats.awaitingAi ? 'warn' : 'default'}
        />
        <Stat label="Awaiting human review" value={stats.awaitingHumanReview} to="/media/review" tone={stats.awaitingHumanReview ? 'warn' : 'default'} />
        <Stat label="Possible duplicates" value={stats.possibleDuplicates} to="/media/all?dup=1" />
        <Stat label="Possible before & after" value={stats.possibleBeforeAfter} to="/media/before-after" />
        <Stat label="Privacy warnings" value={stats.privacyWarnings} to="/media/review" tone={stats.privacyWarnings ? 'danger' : 'default'} />
        <Stat label="Approved for marketing use" value={stats.approvedForMarketing} tone="ok" />
        <Stat label="Assigned to creator" value={stats.assignedToCreator} to="/media/settings" />
        <Stat label="Reels awaiting review" value={stats.reelsAwaitingReview} to="/media/reel-review" tone={stats.reelsAwaitingReview ? 'warn' : 'default'} />
        <Stat label="Approved reels (manual post)" value={stats.approvedReelsReady} to="/media/approved-to-post" tone="ok" />
        <Stat label="Failed processing jobs" value={stats.failedJobs} tone={stats.failedJobs ? 'danger' : 'default'} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="font-medium text-slate-900">Next actions</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            <Link className="text-blue-700 underline-offset-2 hover:underline" to="/media/uploads">
              Upload from phones
            </Link>
            {' '}— phone or desktop transfer with honest pending/failed states (not resumable yet).
          </li>
          <li>
            <Link className="text-blue-700 underline-offset-2 hover:underline" to="/media/review">
              Review AI suggestions
            </Link>
            {' '}— nothing is verified until a person confirms it. AI runs only when explicitly invoked.
          </li>
          <li>
            <Link className="text-blue-700 underline-offset-2 hover:underline" to="/media/reel-review">
              Review creator reels
            </Link>
            {' '}— approve, deny (notes optional), or request revision. Approval never publishes.
          </li>
        </ul>
      </div>
    </div>
  );
}
