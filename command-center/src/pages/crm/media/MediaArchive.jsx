import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  listAssets,
  permanentlyDeleteAsset,
  restoreAsset,
  unrestrictAsset,
} from '@/lib/mediaIntel/api';
import {
  isPermanentDeleteEligible,
  permanentDeleteCountdownLabel,
} from '@/lib/mediaIntel/lifecycleHelpers';

export default function MediaArchive() {
  const { caps } = useOutletContext();
  const [tab, setTab] = useState('archived');
  const [archived, setArchived] = useState([]);
  const [trashed, setTrashed] = useState([]);
  const [restricted, setRestricted] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = async () => {
    try {
      const [a, t, r] = await Promise.all([
        listAssets({ archived: true, trashed: false, limit: 80 }),
        listAssets({ trashed: true, archived: false, limit: 80 }),
        listAssets({ privacyStatus: 'restricted', archived: false, trashed: false, limit: 80 }),
      ]);
      setArchived(a);
      setTrashed(t);
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
        <h2 className="text-lg font-semibold text-slate-900">Archive / Trash / Restricted</h2>
        <p className="text-sm text-slate-600">
          Archived and trashed media leave normal library, search, marketing, and creator views. Trash is
          recoverable for 30 days; permanent delete is owner/admin only after that. AI never deletes originals.
        </p>
        <p className="text-sm mt-2">
          <Link className="text-blue-700 underline" to="/media/quality-cleanup">
            Open Quality Cleanup
          </Link>
        </p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          ['archived', `Archived (${archived.length})`],
          ['trash', `Trash (${trashed.length})`],
          ['restricted', `Restricted (${restricted.length})`],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm min-h-[40px] ${
              tab === id ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'restricted' && (
        <section>
          <ul className="space-y-2">
            {restricted.length === 0 && <li className="text-sm text-slate-600">None</li>}
            {restricted.map((a) => (
              <li key={a.id} className="rounded-lg border bg-white px-3 py-2 text-sm flex justify-between gap-2">
                <span className="truncate">{a.original_filename}</span>
                {caps.canVerify && (
                  <button
                    type="button"
                    className="text-blue-700 text-xs underline shrink-0"
                    onClick={async () => {
                      try {
                        await unrestrictAsset(a.id);
                        await load();
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  >
                    Move to privacy review
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'archived' && (
        <section>
          <ul className="space-y-2">
            {archived.length === 0 && <li className="text-sm text-slate-600">None</li>}
            {archived.map((a) => (
              <li key={a.id} className="rounded-lg border bg-white px-3 py-2 text-sm flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.original_filename}</div>
                  {a.lifecycle_reason ? (
                    <div className="text-xs text-slate-500">Reason: {a.lifecycle_reason}</div>
                  ) : null}
                </div>
                {caps.canLifecycleCleanup && (
                  <button
                    type="button"
                    className="text-blue-700 text-xs underline shrink-0"
                    onClick={async () => {
                      try {
                        setError(null);
                        await restoreAsset(a.id);
                        setMessage('Restored to active library.');
                        await load();
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'trash' && (
        <section>
          <p className="text-xs text-slate-500 mb-2">
            Permanent delete is available only after 30 days in Trash, and only for owner/admin.
          </p>
          <ul className="space-y-2">
            {trashed.length === 0 && <li className="text-sm text-slate-600">Trash is empty</li>}
            {trashed.map((a) => {
              const eligible = isPermanentDeleteEligible(a);
              return (
                <li key={a.id} className="rounded-lg border bg-white px-3 py-2 text-sm space-y-1">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.original_filename}</div>
                      <div className="text-xs text-slate-500">{permanentDeleteCountdownLabel(a)}</div>
                      {a.lifecycle_reason ? (
                        <div className="text-xs text-slate-500">Reason: {a.lifecycle_reason}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      {caps.canLifecycleCleanup && (
                        <button
                          type="button"
                          className="text-blue-700 text-xs underline"
                          onClick={async () => {
                            try {
                              setError(null);
                              await restoreAsset(a.id);
                              setMessage('Restored from Trash.');
                              await load();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Restore
                        </button>
                      )}
                      {caps.canPermanentDelete && (
                        <button
                          type="button"
                          disabled={!eligible}
                          className="text-red-700 text-xs underline disabled:opacity-40 disabled:no-underline"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                'Permanently delete this original? This cannot be undone.',
                              )
                            ) {
                              return;
                            }
                            try {
                              setError(null);
                              await permanentlyDeleteAsset(a.id, 'retention_elapsed');
                              setMessage('Permanently deleted.');
                              await load();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Permanent delete
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
