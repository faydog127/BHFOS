import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { confirmBeforeAfter } from '@/lib/mediaIntel/api';

export default function MediaBeforeAfter() {
  const { caps } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);

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
      if (simple.error) {
        setError(simple.error.message);
        setRows([]);
      } else {
        setError(null);
        setRows(simple.data || []);
      }
      return;
    }
    setError(null);
    setRows(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (relationshipId, confirm) => {
    if (busyId) return;
    setBusyId(relationshipId);
    setError(null);
    setMessage(null);
    try {
      await confirmBeforeAfter(relationshipId, confirm);
      setMessage(confirm ? 'Relationship confirmed.' : 'Proposal rejected.');
      await load();
    } catch (err) {
      setError(err?.message || (confirm ? 'Confirm failed' : 'Reject failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl" data-testid="media-before-after">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Before &amp; after</h2>
        <p className="text-sm text-slate-600">
          AI may propose pairs. Until a reviewer confirms same job, system, order, and angle,
          relationships stay unverified — never treated as marketing-ready.
        </p>
      </div>
      {error && <div className="text-sm text-red-700" role="alert">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}
      <ul className="space-y-3">
        {rows.length === 0 && (
          <li className="rounded-xl border bg-white p-6 text-sm text-slate-600">
            No before/after proposals yet. They appear after analysis suggests nearby media relationships.
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border bg-white p-4 space-y-2" data-testid="media-before-after-row">
            <div className="text-sm font-medium text-slate-900">
              {r.left?.original_filename || r.left_asset_id} → {r.right?.original_filename || r.right_asset_id}
            </div>
            <div className="text-xs text-slate-500">
              Status: {r.verification_status}
              {r.relationship_type ? ` · ${r.relationship_type}` : ''}
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
                  disabled={Boolean(busyId)}
                  className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm min-h-[44px] disabled:opacity-60"
                  onClick={() => decide(r.id, true)}
                >
                  {busyId === r.id ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  className="rounded-md border px-3 py-2 text-sm min-h-[44px] disabled:opacity-60"
                  onClick={() => decide(r.id, false)}
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
