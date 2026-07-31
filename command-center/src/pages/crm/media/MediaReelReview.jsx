import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { reviewReelVersion } from '@/lib/mediaIntel/api';
import { requestSignedReelUrl } from '@/lib/mediaIntel/signedAccess';

export default function MediaReelReview() {
  const { caps } = useOutletContext();
  const [searchParams] = useSearchParams();
  const focusVersionId = searchParams.get('versionId');
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState({});
  const [preview, setPreview] = useState({});
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from('mil_reel_versions')
      .select('*, mil_reel_projects(id, title, creator_user_id, status)')
      .eq('status', 'submitted_for_review')
      .order('submitted_at', { ascending: true });
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setError(null);
      setRows(data || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const orderedRows = useMemo(() => {
    if (!focusVersionId || !rows.length) return rows;
    const focused = rows.filter((r) => r.id === focusVersionId);
    const rest = rows.filter((r) => r.id !== focusVersionId);
    return [...focused, ...rest];
  }, [rows, focusVersionId]);

  useEffect(() => {
    if (!focusVersionId) return;
    const el = document.getElementById(`reel-version-${focusVersionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusVersionId, orderedRows]);

  const decide = async (versionId, decision) => {
    if (busyId) return;
    setBusyId(versionId);
    setError(null);
    setMessage(null);
    try {
      await reviewReelVersion({
        versionId,
        decision,
        notes: notes[versionId],
      });
      if (decision === 'approved') {
        setMessage('Approved to post (manual). Nothing was published or scheduled.');
      } else if (decision === 'denied') {
        setMessage(
          notes[versionId]?.trim()
            ? 'Denied with notes.'
            : 'Denied without notes. No reason inferred.',
        );
      } else {
        setMessage('Revision requested.');
      }
      await load();
    } catch (err) {
      setError(err?.message || `Reel ${decision} failed`);
    } finally {
      setBusyId(null);
    }
  };

  if (!caps.canApproveReels) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
        Only owners/admins can approve or deny reels. Creators cannot approve their own work.
        Approve marks a version ready for manual posting later — this product does not publish or schedule posts.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="media-reel-review">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Reel review</h2>
        <p className="text-sm text-slate-600">
          Specialized reel workspace — also reachable from the unified Review Queue. Approve marks the
          exact version as ready for manual posting later. This screen does not schedule posts or send
          them to any network. Denial notes are optional.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          <Link to="/media/review?filter=reel" className="text-blue-700 underline-offset-2 hover:underline">
            Back to Review Queue · Reels
          </Link>
          {focusVersionId ? ` · Focusing version ${focusVersionId.slice(0, 8)}…` : ''}
        </p>
      </div>
      {error && (
        <div className="text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {message && <div className="text-sm text-emerald-700">{message}</div>}
      {orderedRows.length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">No reels awaiting review.</div>
      )}
      {orderedRows.map((v) => (
        <article
          key={v.id}
          id={`reel-version-${v.id}`}
          className={`rounded-xl border bg-white p-4 space-y-3 ${
            focusVersionId === v.id ? 'ring-2 ring-blue-500' : ''
          }`}
          data-testid="media-reel-review-row"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h3 className="font-medium text-slate-900">{v.mil_reel_projects?.title || 'Reel'}</h3>
              <p className="text-sm text-slate-600">Version {v.version_number} · Submitted {v.submitted_at ? new Date(v.submitted_at).toLocaleString() : '—'}</p>
              <p className="text-xs text-slate-500 mt-1">Status: {v.status}</p>
              <p className="text-sm text-slate-600 mt-1">Creator notes: {v.creator_notes || '—'}</p>
            </div>
            <button
              type="button"
              disabled={Boolean(busyId)}
              className="rounded-md border px-3 py-2 text-sm min-h-[44px] disabled:opacity-60"
              onClick={async () => {
                setError(null);
                try {
                  const signed = await requestSignedReelUrl(v.id, 'preview');
                  setPreview((p) => ({ ...p, [v.id]: signed.url }));
                } catch (err) {
                  setError(err?.message || 'Preview not authorized');
                }
              }}
            >
              Load preview
            </button>
          </div>
          {preview[v.id] && (
            <video src={preview[v.id]} controls className="w-full max-h-96 rounded-lg bg-black" />
          )}
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Optional notes (for deny or revision)</span>
            <textarea
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={notes[v.id] || ''}
              onChange={(e) => setNotes((n) => ({ ...n, [v.id]: e.target.value }))}
              placeholder="Leave blank to deny without notes"
              disabled={Boolean(busyId)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busyId)}
              className="rounded-md bg-emerald-600 text-white px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60"
              onClick={() => decide(v.id, 'approved')}
            >
              {busyId === v.id ? 'Saving…' : 'Approve'}
            </button>
            <button
              type="button"
              disabled={Boolean(busyId)}
              className="rounded-md border border-red-300 text-red-800 px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60"
              onClick={() => decide(v.id, 'denied')}
            >
              Deny
            </button>
            <button
              type="button"
              disabled={Boolean(busyId)}
              className="rounded-md border px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60"
              onClick={() => decide(v.id, 'revision_requested')}
            >
              Request revision
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
