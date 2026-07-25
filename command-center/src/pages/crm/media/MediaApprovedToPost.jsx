import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { signedUrl } from '@/lib/mediaIntel/api';

export default function MediaApprovedToPost() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('mil_reel_versions')
        .select('*, mil_reel_projects(title, creator_user_id)')
        .eq('status', 'approved_to_post')
        .order('reviewed_at', { ascending: false });
      if (err) setError(err.message);
      else setRows(data || []);
    })();
  }, []);

  return (
    <div className="space-y-4" data-testid="media-approved-to-post">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Approved to post</h2>
        <p className="text-sm text-slate-600">
          Ready for manual posting outside this app. No social connection, scheduling, or automatic publishing is included.
        </p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">No approved reels yet.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((v) => (
            <li key={v.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-medium">{v.mil_reel_projects?.title}</div>
                <div className="text-sm text-slate-600">
                  v{v.version_number} · approved {v.reviewed_at ? new Date(v.reviewed_at).toLocaleString() : '—'}
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border px-4 py-2.5 text-sm min-h-[44px]"
                onClick={async () => {
                  const url = await signedUrl(v.storage_bucket, v.storage_path, 600);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                Download / preview
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
