import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { reviewReelVersion } from '@/lib/mediaIntel/api';
import { requestSignedReelUrl } from '@/lib/mediaIntel/signedAccess';

export default function MediaReelReview() {
  const { caps } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState({});
  const [preview, setPreview] = useState({});
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from('mil_reel_versions')
      .select('*, mil_reel_projects(id, title, creator_user_id, status)')
      .eq('status', 'submitted_for_review')
      .order('submitted_at', { ascending: true });
    if (err) setError(err.message);
    else setRows(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  if (!caps.canApproveReels) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
        Only owners/admins can approve or deny reels. Creators cannot approve their own work.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="media-reel-review">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Reel review</h2>
        <p className="text-sm text-slate-600">
          Approve organizes the exact version for manual posting later. Nothing is scheduled or published from here. Denial notes are optional.
        </p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}
      {rows.length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">No reels awaiting review.</div>
      )}
      {rows.map((v) => (
        <article key={v.id} className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h3 className="font-medium text-slate-900">{v.mil_reel_projects?.title || 'Reel'}</h3>
              <p className="text-sm text-slate-600">Version {v.version_number} · Submitted {v.submitted_at ? new Date(v.submitted_at).toLocaleString() : '—'}</p>
              <p className="text-sm text-slate-600 mt-1">Creator notes: {v.creator_notes || '—'}</p>
            </div>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm min-h-[44px]"
              onClick={async () => {
                try {
                  const signed = await requestSignedReelUrl(v.id, 'preview');
                  setPreview((p) => ({ ...p, [v.id]: signed.url }));
                } catch (err) {
                  setError(err.message || 'Preview not authorized');
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
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-emerald-600 text-white px-4 py-2.5 text-sm min-h-[44px]"
              onClick={async () => {
                await reviewReelVersion({ versionId: v.id, decision: 'approved', notes: notes[v.id] });
                setMessage('Approved to post (manual). Nothing was published.');
                await load();
              }}
            >
              Approve
            </button>
            <button
              type="button"
              className="rounded-md border border-red-300 text-red-800 px-4 py-2.5 text-sm min-h-[44px]"
              onClick={async () => {
                await reviewReelVersion({ versionId: v.id, decision: 'denied', notes: notes[v.id] });
                setMessage(notes[v.id]?.trim() ? 'Denied with notes.' : 'Denied without notes. No reason inferred.');
                await load();
              }}
            >
              Deny
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2.5 text-sm min-h-[44px]"
              onClick={async () => {
                await reviewReelVersion({
                  versionId: v.id,
                  decision: 'revision_requested',
                  notes: notes[v.id],
                });
                setMessage('Revision requested.');
                await load();
              }}
            >
              Request revision
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
