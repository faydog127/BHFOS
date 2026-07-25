import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listAssets } from '@/lib/mediaIntel/api';
import { supabase } from '@/lib/customSupabaseClient';
import { audit } from '@/lib/mediaIntel/api';

export default function MediaArchive() {
  const { caps } = useOutletContext();
  const [archived, setArchived] = useState([]);
  const [restricted, setRestricted] = useState([]);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const [a, r] = await Promise.all([
        listAssets({ archived: true, limit: 80 }),
        listAssets({ privacyStatus: 'restricted', archived: false, limit: 80 }),
      ]);
      setArchived(a);
      setRestricted(r);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6" data-testid="media-archive">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Archive / restricted</h2>
        <p className="text-sm text-slate-600">Archived duplicates and privacy-restricted assets. Originals remain recoverable; nothing is permanently destroyed here.</p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <section>
        <h3 className="font-medium text-slate-900 mb-2">Restricted</h3>
        <ul className="space-y-2">
          {restricted.length === 0 && <li className="text-sm text-slate-600">None</li>}
          {restricted.map((a) => (
            <li key={a.id} className="rounded-lg border bg-white px-3 py-2 text-sm flex justify-between gap-2">
              <span className="truncate">{a.original_filename}</span>
              {caps.canVerify && (
                <button
                  type="button"
                  className="text-blue-700 text-xs underline"
                  onClick={async () => {
                    await supabase.from('mil_assets').update({ privacy_status: 'needs_review' }).eq('id', a.id);
                    await audit('privacy_unrestrict', 'mil_assets', a.id, {});
                    await load();
                  }}
                >
                  Move to privacy review
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-medium text-slate-900 mb-2">Archived</h3>
        <ul className="space-y-2">
          {archived.length === 0 && <li className="text-sm text-slate-600">None</li>}
          {archived.map((a) => (
            <li key={a.id} className="rounded-lg border bg-white px-3 py-2 text-sm flex justify-between gap-2">
              <span className="truncate">{a.original_filename}</span>
              {caps.canVerify && (
                <button
                  type="button"
                  className="text-blue-700 text-xs underline"
                  onClick={async () => {
                    await supabase.from('mil_assets').update({ archived_at: null, human_review_status: 'pending' }).eq('id', a.id);
                    await audit('restore_archived', 'mil_assets', a.id, {});
                    await load();
                  }}
                >
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
