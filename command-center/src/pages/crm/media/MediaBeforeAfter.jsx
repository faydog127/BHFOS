import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { confirmBeforeAfter } from '@/lib/mediaIntel/api';

export default function MediaBeforeAfter() {
  const { caps } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from('mil_asset_relationships')
      .select('*, left:mil_assets!mil_asset_relationships_left_asset_id_fkey(id, original_filename), right:mil_assets!mil_asset_relationships_right_asset_id_fkey(id, original_filename)')
      .in('relationship_type', ['possible_before_after', 'before_after'])
      .order('created_at', { ascending: false });
    if (err) {
      const simple = await supabase
        .from('mil_asset_relationships')
        .select('*')
        .in('relationship_type', ['possible_before_after', 'before_after'])
        .order('created_at', { ascending: false });
      if (simple.error) setError(simple.error.message);
      else setRows(simple.data || []);
      return;
    }
    setRows(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4 max-w-3xl" data-testid="media-before-after">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Before &amp; after</h2>
        <p className="text-sm text-slate-600">
          AI may propose pairs. Until a person confirms same job, system, order, and angle, relationships stay labeled unverified.
        </p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}
      <ul className="space-y-3">
        {rows.length === 0 && (
          <li className="rounded-xl border bg-white p-6 text-sm text-slate-600">
            No before/after proposals yet. They appear after analysis suggests nearby media relationships.
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border bg-white p-4 space-y-2">
            <div className="text-sm font-medium text-slate-900">
              {r.left?.original_filename || r.left_asset_id} → {r.right?.original_filename || r.right_asset_id}
            </div>
            {r.verification_status !== 'confirmed' ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Possible before-and-after match — verification required.
              </div>
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                Confirmed before-and-after.
              </div>
            )}
            {caps.canVerify && r.verification_status === 'unverified' && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm min-h-[44px]"
                  onClick={async () => {
                    await confirmBeforeAfter(r.id, true);
                    setMessage('Relationship confirmed.');
                    await load();
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm min-h-[44px]"
                  onClick={async () => {
                    await confirmBeforeAfter(r.id, false);
                    setMessage('Proposal rejected.');
                    await load();
                  }}
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
