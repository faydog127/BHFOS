import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2, RotateCcw, Upload } from 'lucide-react';
import { UPLOAD_PHONE_NOTICE } from '@/lib/mediaIntel/constants';
import {
  UPLOAD_FILE_STATUS,
  UPLOAD_PHASE_LABELS,
  attachReselectedFile,
  bindUploadExitWarning,
  createUploadSession,
  fetchBatchManifest,
  isOnline,
  restoreUploadQueue,
  retryQueueItem,
  uploadFilesToSession,
} from '@/lib/mediaIntel/uploadManager';
import { listUploadSessions } from '@/lib/mediaIntel/uploadSessionStore';
import AnalysisOutcomeCard from '@/components/media/AnalysisOutcomeCard';

const STATUS_STYLES = {
  pending: 'text-slate-600',
  queued: 'text-slate-600',
  hashing: 'text-slate-700',
  uploading: 'text-blue-700',
  interrupted: 'text-amber-800',
  finalizing: 'text-blue-700',
  uploaded: 'text-emerald-700',
  analyzing: 'text-blue-700',
  analysis_complete: 'text-emerald-800',
  analysis_failed: 'text-amber-900',
  needs_reselect: 'text-amber-900',
  duplicate: 'text-amber-800',
  pending_reconcile: 'text-amber-800',
  in_progress: 'text-amber-800',
  skipped: 'text-slate-500',
  failed: 'text-red-700',
  expired: 'text-red-700',
  revoked: 'text-red-700',
};

const STATUS_LABELS = {
  ...UPLOAD_PHASE_LABELS,
  hashing: 'Reading file',
  uploading: 'Uploading',
  finalizing: 'Finalizing',
  uploaded: 'In the library',
  duplicate: 'Duplicate — existing copy kept',
  pending_reconcile: 'Not confirmed yet — reconciling',
  in_progress: 'Already finalizing elsewhere',
  skipped: 'Skipped',
  failed: 'Failed',
  expired: 'Upload link expired',
  revoked: 'Upload link revoked',
  queued: 'Queued',
  interrupted: 'Interrupted — retry available',
  analyzing: 'Analyzing',
  analysis_complete: 'Ready for review',
  analysis_failed: 'Analysis failed',
  needs_reselect: 'Reselect this file',
};

export default function MediaUploads() {
  const { caps } = useOutletContext();
  const inputRef = useRef(null);
  const folderRef = useRef(null);
  const fileMapRef = useRef({});
  // The session token stays in memory for the life of the tab. It is an upload
  // credential, so it is never written to storage or the URL.
  const tokenRef = useRef(null);

  const [sourceLabel, setSourceLabel] = useState('');
  const [sourcePhone, setSourcePhone] = useState('');
  const [sourcePerson, setSourcePerson] = useState('');
  const [session, setSession] = useState(null);
  const [fileStates, setFileStates] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [offline, setOffline] = useState(!isOnline());
  const reselectRef = useRef(null);
  const reselectTargetRef = useRef(null);

  const onFileUpdate = useCallback((update) => {
    const key = update.clientKey || update.clientUploadId;
    setFileStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...update },
    }));
  }, []);

  useEffect(() => {
    const onOff = () => setOffline(!isOnline());
    window.addEventListener('online', onOff);
    window.addEventListener('offline', onOff);
    return () => {
      window.removeEventListener('online', onOff);
      window.removeEventListener('offline', onOff);
    };
  }, []);

  useEffect(() => {
    return bindUploadExitWarning(() => busy || Object.values(fileStates).some((f) =>
      ['queued', 'uploading', 'hashing', 'finalizing', 'interrupted', 'retrying'].includes(f.status || f.phase),
    ));
  }, [busy, fileStates]);

  useEffect(() => {
    if (!caps.isOwnerAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await restoreUploadQueue({
          token: tokenRef.current,
          onFileUpdate,
          autoResume: Boolean(tokenRef.current),
        });
      } catch {
        if (!cancelled) {
          // restore is best-effort
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caps.isOwnerAdmin, onFileUpdate]);

  const startUpload = async (fileList) => {
    if (!caps.isOwnerAdmin) {
      setError(
        'Only owner/admin may start a transfer session. Ask an owner to mint an upload link for you.',
      );
      return;
    }
    const files = Array.from(fileList || []);
    if (!files.length) return;

    files.forEach((f) => {
      fileMapRef.current[`${f.name}::${f.size}::${f.lastModified}`] = f;
    });

    setBusy(true);
    setError(null);
    try {
      let active = session;
      if (!active || !tokenRef.current) {
        active = await createUploadSession({
          label: sourceLabel || 'Desktop transfer',
          sourcePhone,
          sourcePerson,
        });
        tokenRef.current = active.token;
        setSession(active);
      }

      await uploadFilesToSession({
        token: tokenRef.current,
        batchId: active.batchId,
        files,
        onFileUpdate,
      });
      setManifest(await fetchBatchManifest(active.batchId));
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    startUpload(e.dataTransfer.files);
  };

  const recoverSessions = async () => {
    const sessions = await listUploadSessions();
    if (!sessions.length) {
      setError('No previous transfer batches were recorded in this browser.');
      return;
    }
    const latest = sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    setManifest(await fetchBatchManifest(latest.batchId));
  };

  const entries = Object.values(fileStates);
  const totals = entries.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  if (!caps.isStaff) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        Upload is limited to owner, admin, and internal staff. Creators use the Creator Workspace for reel drafts only.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl" data-testid="media-uploads">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Transfer uploads</h2>
        <p className="text-sm text-slate-600 mt-1">
          Files are written to a server-minted quarantine path, re-hashed by the server, and only then
          added to the library. A file counts as transferred when this page says “In the library”.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950" role="note">
        {UPLOAD_PHONE_NOTICE}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-1" role="note">
        <p>
          Uploads use resumable transfer when the browser supports it. Keep this page open during large
          transfers when you can — if the screen locks or the network drops, MIL keeps a durable queue and
          will resume or ask you to reselect the file. Practical per-file limit is 250 MB.
        </p>
        <p className="text-xs text-slate-500">
          Screen wake lock is requested when available; it is a helper, not a guarantee on phones.
        </p>
      </div>

      {offline && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          You appear offline. Queued uploads will retry when connectivity returns.
        </div>
      )}

      {caps.isOwnerAdmin && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-1"
          role="note"
          data-testid="reconcile-operator-note"
        >
          <p className="font-medium">If a file stays “Not confirmed yet — reconciling”</p>
          <p>
            It is not in the library. Keep the original until the transfer manifest shows it uploaded.
            The server may finish that grant during finalize; otherwise an operator must run{' '}
            <code className="text-xs">media-intel-upload-reconcile</code> (see{' '}
            <code className="text-xs">docs/media-intelligence/RECONCILE_OPERATOR.md</code>). No
            reconcile schedule is configured — Founder authorization is required to add one. This
            page cannot start reconcile: the reconcile key never lives in the browser.
          </p>
        </div>
      )}

      {!caps.isOwnerAdmin && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You can browse transfers, but only owner/admin may start one.
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm block">
          <span className="text-slate-700 font-medium">Source / collection</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 min-h-[44px]"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="e.g. Tech phone dump — July"
          />
        </label>
        <label className="text-sm block">
          <span className="text-slate-700 font-medium">Phone (optional)</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 min-h-[44px]"
            value={sourcePhone}
            onChange={(e) => setSourcePhone(e.target.value)}
            placeholder="iPhone 15 / Pixel"
          />
        </label>
        <label className="text-sm block">
          <span className="text-slate-700 font-medium">Person (optional)</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 min-h-[44px]"
            value={sourcePerson}
            onChange={(e) => setSourcePerson(e.target.value)}
            placeholder="Who is transferring"
          />
        </label>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'
        }`}
      >
        <Upload className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
        <p className="mt-3 text-sm font-medium text-slate-800">Drag and drop photos and videos</p>
        <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP, HEIC/HEIF, MOV, MP4, and common phone formats</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white min-h-[44px] disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
            disabled={busy || !caps.isOwnerAdmin}
          >
            Choose files
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 min-h-[44px] disabled:opacity-50"
            onClick={() => folderRef.current?.click()}
            disabled={busy || !caps.isOwnerAdmin}
          >
            Choose folder
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 min-h-[44px]"
            onClick={recoverSessions}
            disabled={busy}
          >
            Show last batch
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,.heic,.heif,.mov,.mp4"
          className="hidden"
          onChange={(e) => startUpload(e.target.files)}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          // @ts-expect-error webkitdirectory
          webkitdirectory=""
          directory=""
          onChange={(e) => startUpload(e.target.files)}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {(busy || entries.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {busy && (
              <span className="inline-flex items-center gap-2 text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </span>
            )}
            <span className="text-emerald-700">In library: {totals[UPLOAD_FILE_STATUS.UPLOADED] || 0}</span>
            <span className="text-amber-800">Duplicates: {totals[UPLOAD_FILE_STATUS.DUPLICATE] || 0}</span>
            <span className="text-amber-800">
              Reconciling: {totals[UPLOAD_FILE_STATUS.PENDING_RECONCILE] || 0}
            </span>
            <span className="text-slate-600">Skipped: {totals[UPLOAD_FILE_STATUS.SKIPPED] || 0}</span>
            <span className="text-red-700">Failed: {totals[UPLOAD_FILE_STATUS.FAILED] || 0}</span>
            {session?.batchId && <span className="text-slate-500">Batch {session.batchId.slice(0, 8)}…</span>}
          </div>

          {(totals[UPLOAD_FILE_STATUS.PENDING_RECONCILE] || 0) > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-1">
              <p>
                Some files could not be confirmed in final storage yet. They are not in the library.
                Keep the originals until the transfer manifest shows them as uploaded.
              </p>
              {caps.isOwnerAdmin && (
                <p>
                  Stranded files can stay pending until reconcile runs (inline during finalize, or
                  an operator invoke per{' '}
                  <code className="text-xs">docs/media-intelligence/RECONCILE_OPERATOR.md</code>).
                  There is no in-app “Reconcile now” — that would require a secret that must not
                  enter this browser.
                </p>
              )}
            </div>
          )}

          <ul className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
            {entries.map((f) => (
              <li key={f.clientKey || f.clientUploadId} className="py-2 text-sm space-y-2">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{f.filename}</div>
                    <div className={STATUS_STYLES[f.status] || 'text-slate-600'}>
                      {STATUS_LABELS[f.status] || STATUS_LABELS[f.phase] || f.status}
                      {typeof f.percent === 'number' &&
                      (f.status === UPLOAD_FILE_STATUS.UPLOADING || f.phase === 'uploading' || f.phase === 'retrying')
                        ? ` · ${f.percent}%`
                        : ''}
                      {f.message ? ` · ${f.message}` : ''}
                      {f.errorLayer ? ` · (${f.errorLayer})` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {(f.status === 'interrupted' || f.phase === 'interrupted') && tokenRef.current && (
                      <button
                        type="button"
                        className="text-xs text-blue-700 underline"
                        disabled={busy}
                        onClick={async () => {
                          try {
                            setBusy(true);
                            await retryQueueItem({
                              token: tokenRef.current,
                              clientUploadId: f.clientUploadId || f.clientKey,
                              onFileUpdate,
                            });
                          } catch (err) {
                            setError(err.message || 'Retry failed');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Retry
                      </button>
                    )}
                    {(f.status === 'needs_reselect' || f.phase === 'needs_reselect') && (
                      <button
                        type="button"
                        className="text-xs text-blue-700 underline"
                        disabled={busy}
                        onClick={() => {
                          reselectTargetRef.current = f.clientUploadId || f.clientKey;
                          reselectRef.current?.click();
                        }}
                      >
                        Reselect
                      </button>
                    )}
                  </div>
                </div>
                {f.analysisOutcome ? (
                  <AnalysisOutcomeCard
                    asset={{ processing_status: f.phase === 'analysis_complete' ? 'analyzed' : 'queued', media_kind: 'photo' }}
                    analysis={{
                      status: f.phase === 'analysis_failed' ? 'failed' : f.phase === 'analysis_complete' ? 'succeeded' : 'queued',
                      suggested: {
                        narrative: f.analysisOutcome.description,
                        tags: f.analysisOutcome.tags,
                        condition_notes: f.analysisOutcome.observations,
                        recommended_uses: f.analysisOutcome.recommendedUses,
                        unsuitable_uses: f.analysisOutcome.unsuitableUses,
                        privacy_risks: f.analysisOutcome.privacyWarnings,
                        work_phase: f.analysisOutcome.classification?.[0],
                        service_category: f.analysisOutcome.classification?.[1],
                      },
                      overall_confidence: f.analysisOutcome.confidence,
                      explanation: f.analysisOutcome.errorMessage,
                    }}
                    compact
                  />
                ) : null}
              </li>
            ))}
          </ul>
          <input
            ref={reselectRef}
            type="file"
            accept="image/*,video/*,.heic,.heif,.mov,.mp4"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              const target = reselectTargetRef.current;
              e.target.value = '';
              if (!file || !target) return;
              try {
                setBusy(true);
                if (!tokenRef.current) {
                  const active = await createUploadSession({
                    label: sourceLabel || 'Desktop transfer',
                    sourcePhone,
                    sourcePerson,
                  });
                  tokenRef.current = active.token;
                  setSession(active);
                }
                await attachReselectedFile({
                  clientUploadId: target,
                  file,
                  token: tokenRef.current,
                  onFileUpdate,
                  autoStart: true,
                });
              } catch (err) {
                setError(err.message || 'Reselect failed');
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      )}

      {manifest?.batch && (
        <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="transfer-manifest">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-slate-900">Transfer manifest</h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-blue-700"
              onClick={async () => setManifest(await fetchBatchManifest(manifest.batch.id))}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            These counts are recomputed by the server from upload grant states — they are not written by this browser.
          </p>
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><dt className="text-slate-500">Batch</dt><dd className="font-mono text-xs break-all">{manifest.batch.id}</dd></div>
            <div><dt className="text-slate-500">Source</dt><dd>{manifest.batch.source_label || '—'}</dd></div>
            <div><dt className="text-slate-500">Started</dt><dd>{new Date(manifest.batch.started_at).toLocaleString()}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd>{manifest.batch.status}</dd></div>
            <div><dt className="text-slate-500">In library</dt><dd>{manifest.batch.success_count}</dd></div>
            <div><dt className="text-slate-500">Failed</dt><dd>{manifest.batch.failed_count}</dd></div>
            <div><dt className="text-slate-500">Abandoned</dt><dd>{manifest.batch.abandoned_count ?? 0}</dd></div>
            <div><dt className="text-slate-500">Duplicates</dt><dd>{manifest.batch.duplicate_count}</dd></div>
          </dl>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="py-2 pr-3">Filename</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Checksum</th>
                  <th className="py-2 pr-3">Upload</th>
                  <th className="py-2 pr-3">Duplicate</th>
                </tr>
              </thead>
              <tbody>
                {(manifest.entries || []).map((e) => (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 max-w-[200px] truncate">{e.original_filename}</td>
                    <td className="py-2 pr-3">{e.byte_size ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono">{e.checksum_sha256 ? `${e.checksum_sha256.slice(0, 12)}…` : '—'}</td>
                    <td className="py-2 pr-3">{e.upload_status}</td>
                    <td className="py-2 pr-3">{e.duplicate_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
