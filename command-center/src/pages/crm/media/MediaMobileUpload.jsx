import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';
import { UPLOAD_PHONE_NOTICE } from '@/lib/mediaIntel/constants';
import {
  UPLOAD_FILE_STATUS,
  UPLOAD_PHASE_LABELS,
  attachReselectedFile,
  bindUploadExitWarning,
  createUploadSession,
  fetchSessionManifest,
  reconcileStaleUploadQueue,
  restoreUploadQueue,
  retryQueueItem,
  uploadFilesToSession,
  validateUploadSession,
} from '@/lib/mediaIntel/uploadManager';
import { fetchMilRole, milCapabilities } from '@/lib/mediaIntel/roles';
import AnalysisOutcomeCard from '@/components/media/AnalysisOutcomeCard';

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
  interrupted: 'Interrupted — tap Retry',
  analyzing: 'Analyzing',
  analysis_complete: 'Ready for review',
  analysis_failed: 'Analysis failed',
  needs_reselect: 'Reselect this file',
  queued: 'Queued',
};

/**
 * Prefer the URL fragment (#session=) over the query string (?session=): fragments
 * are never sent to the server in the request line, never logged by reverse
 * proxies/analytics, and are stripped before the Referer header is generated.
 * Legacy ?session= links are still honored for backward compatibility.
 */
function extractSessionToken() {
  if (typeof window === 'undefined') return '';
  const hashMatch = /(?:^#|[#&])session=([^&]+)/.exec(window.location.hash || '');
  if (hashMatch) {
    try {
      return decodeURIComponent(hashMatch[1]);
    } catch {
      return hashMatch[1];
    }
  }
  return new URLSearchParams(window.location.search).get('session') || '';
}

export default function MediaMobileUpload() {
  const outlet = useOutletContext() || {};
  const [caps, setCaps] = useState(outlet.caps || null);
  const [linkToken] = useState(extractSessionToken);
  // Session minted for a signed-in owner/admin who opened this page without a link.
  // Keep token + batchId in a ref so the first upload after createUploadSession
  // does not read a stale sessionInfo from before setState flushes.
  const mintedSessionRef = useRef(null);

  useEffect(() => {
    if (!linkToken) return;
    // Move the token to memory only, then strip it from the visible URL
    // immediately so it never lingers in browser history, screen recordings,
    // or gets accidentally shared by copying the address bar.
    window.history.replaceState(null, '', window.location.pathname);
  }, [linkToken]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let meta = document.querySelector('meta[name="referrer"]');
    const created = !meta;
    const previous = meta?.getAttribute('content') ?? null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'referrer');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'no-referrer');
    return () => {
      if (created) meta.remove();
      else if (previous !== null) meta.setAttribute('content', previous);
    };
  }, []);

  const inputRef = useRef(null);
  const reselectRef = useRef(null);
  const reselectTargetRef = useRef(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [fileStates, setFileStates] = useState({});
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [sentToReview, setSentToReview] = useState(0);
  const [manifest, setManifest] = useState(null);

  const mode = linkToken ? 'session' : 'authenticated';

  useEffect(() => {
    if (!linkToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await validateUploadSession(linkToken);
        if (!cancelled) setSessionInfo(data);
      } catch (err) {
        if (!cancelled) setSessionError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkToken]);

  useEffect(() => {
    if (linkToken || outlet.caps) {
      if (outlet.caps) setCaps(outlet.caps);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const role = await fetchMilRole();
      if (!cancelled) setCaps(milCapabilities(role));
    })();
    return () => {
      cancelled = true;
    };
  }, [linkToken, outlet.caps]);

  const onFileUpdate = useCallback((update) => {
    const key = update.clientKey || update.clientUploadId;
    const phase = update.phase || update.status;
    if (phase === 'analysis_complete' || update.dismissFromUploads) {
      setFileStates((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSentToReview((n) => n + 1);
      return;
    }
    setFileStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...update },
    }));
  }, []);

  useEffect(() => {
    return bindUploadExitWarning(() => busy);
  }, [busy]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Always restore queue rows after refresh — do not wait for a session token.
        let items = await restoreUploadQueue({
          token: null,
          onFileUpdate,
          autoResume: false,
        });
        if (cancelled) return;

        let token = linkToken || mintedSessionRef.current?.token || null;
        const resumable = (items || []).some(
          (i) =>
            i.blob instanceof Blob &&
            [
              'interrupted',
              'queued',
              'uploading',
              'retrying',
              'finalizing',
              'awaiting_authorization',
              'preparing',
            ].includes(i.phase),
        );

        if (!token && resumable && mode === 'authenticated' && caps?.isOwnerAdmin) {
          const created = await createUploadSession({ label: 'Mobile browser upload (resume)' });
          if (cancelled) return;
          mintedSessionRef.current = { token: created.token, batchId: created.batchId };
          setSessionInfo(created);
          token = created.token;
        }

        if (token) {
          items = await restoreUploadQueue({
            token,
            onFileUpdate,
            autoResume: true,
          });
        }
      } catch {
        if (!cancelled) {
          // best-effort restore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkToken, onFileUpdate, mode, caps?.isOwnerAdmin]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await reconcileStaleUploadQueue({ onFileUpdate });
      } catch {
        // best-effort
      }
    };
    run();
    const timer = window.setInterval(() => {
      if (!cancelled) run();
    }, 12000);
    const onVis = () => {
      if (document.visibilityState === 'visible' && !cancelled) run();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [onFileUpdate]);

  /**
   * Both modes end up on the same server contract: mint a grant, resumable TUS
   * (signed), ask the server to finalize. The only difference is where the
   * session token came from.
   */
  const runUpload = async (files, token, batchId) => {
    setBusy(true);
    setSessionError(null);
    try {
      await uploadFilesToSession({ token, batchId, files, onFileUpdate });
      setManifest(await fetchSessionManifest(token));
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ensureMobileToken = async () => {
    const existing = linkToken || mintedSessionRef.current?.token;
    if (existing) return existing;
    if (mode !== 'authenticated' || !caps?.isOwnerAdmin) {
      throw new Error('Open a phone upload link, or sign in as owner/admin to resume.');
    }
    const created = await createUploadSession({ label: 'Mobile browser upload (resume)' });
    mintedSessionRef.current = { token: created.token, batchId: created.batchId };
    setSessionInfo(created);
    return created.token;
  };

  const startUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (mode === 'session') {
      return runUpload(files, linkToken, sessionInfo?.batchId);
    }

    if (!caps?.isOwnerAdmin) {
      setSessionError(
        'Open a phone upload link from the owner. Only owner/admin accounts can start a transfer directly.',
      );
      return undefined;
    }

    try {
      if (!mintedSessionRef.current) {
        const created = await createUploadSession({ label: 'Mobile browser upload' });
        mintedSessionRef.current = { token: created.token, batchId: created.batchId };
        setSessionInfo(created);
      }
    } catch (err) {
      setSessionError(err.message);
      return undefined;
    }
    const minted = mintedSessionRef.current;
    return runUpload(files, minted.token, minted.batchId);
  };

  const totals = useMemo(() => {
    const acc = {};
    Object.values(fileStates).forEach((f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
    });
    return acc;
  }, [fileStates]);

  const entries = useMemo(() => {
    return Object.values(fileStates)
      .filter((f) => (f.status || f.phase) !== 'analysis_complete')
      .sort((a, b) => {
        const rank = (f) => {
          const s = f.status || f.phase || '';
          if (
            ['uploading', 'retrying', 'hashing', 'finalizing', 'queued', 'interrupted', 'needs_reselect', 'preparing'].includes(
              s,
            )
          ) {
            return 0;
          }
          if (['uploaded', 'analyzing', 'queued_for_analysis'].includes(s)) return 1;
          return 2;
        };
        return rank(a) - rank(b);
      });
  }, [fileStates]);

  const inFlightCount = entries.filter((f) =>
    ['queued', 'uploading', 'hashing', 'finalizing', 'interrupted', 'retrying', 'needs_reselect', 'preparing'].includes(
      f.status || f.phase,
    ),
  ).length;

  const canPickFiles = mode === 'session' ? Boolean(sessionInfo) : Boolean(caps?.isOwnerAdmin);

  if (mode === 'session' && !sessionInfo && !sessionError) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Checking upload link…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4" data-testid="media-mobile-upload">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Phone media transfer</h2>
        <p className="text-sm text-slate-600 mt-1">
          Upload-only. This page cannot open the media library, CRM, or other batches.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-950" role="note">
        {sessionInfo?.notice || UPLOAD_PHONE_NOTICE}
      </div>

      {sessionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{sessionError}</div>
      )}

      {sentToReview > 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {sentToReview} file{sentToReview === 1 ? '' : 's'} finished analysis and left this list.{' '}
          {mode === 'authenticated' ? (
            <Link className="underline font-medium" to="/media/review">
              Open Review Queue
            </Link>
          ) : (
            <span>Open Review Queue on a staff computer.</span>
          )}
        </div>
      )}

      {sessionInfo?.expiresAt && (
        <div className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700">
          Batch ready · expires {new Date(sessionInfo.expiresAt).toLocaleString()}
        </div>
      )}

      {mode === 'authenticated' && !caps?.isOwnerAdmin && (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
          Open a phone upload link from the owner, or sign in with an owner/admin account.
          <div className="mt-3">
            {/* Legacy V1 login path until company-wide auth cleanup */}
            <Link className="text-blue-700 underline" to={`/${DEFAULT_TENANT_ID}/login?next=/media/uploads`}>
              Sign in
            </Link>
          </div>
        </div>
      )}

      {canPickFiles && (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <Upload className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-800">Select photos and videos from this phone</p>
          <p className="mt-1 text-xs text-slate-500">
            Resumable when the browser allows it. Keep MIL open during large transfers. Up to 250 MB per file.
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white min-h-[48px] w-full max-w-xs"
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Uploading…' : 'Choose files'}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,.heic,.heif,.mov,.mp4"
            capture={undefined}
            className="hidden"
            onChange={(e) => startUpload(e.target.files)}
          />
        </div>
      )}

      {entries.length > 0 && (
        <div className="rounded-xl border bg-white p-3 space-y-2 text-sm">
          <div className="flex flex-wrap gap-3">
            {inFlightCount > 0 && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-950 font-medium">
                {inFlightCount} still transferring — listed first
              </span>
            )}
            <span className="text-emerald-700">In library: {totals[UPLOAD_FILE_STATUS.UPLOADED] || 0}</span>
            <span className="text-amber-800">Duplicates: {totals[UPLOAD_FILE_STATUS.DUPLICATE] || 0}</span>
            <span className="text-amber-800">
              Reconciling: {totals[UPLOAD_FILE_STATUS.PENDING_RECONCILE] || 0}
            </span>
            <span className="text-slate-600">Skipped: {totals[UPLOAD_FILE_STATUS.SKIPPED] || 0}</span>
            <span className="text-red-700">Failed: {totals[UPLOAD_FILE_STATUS.FAILED] || 0}</span>
          </div>
          {(totals[UPLOAD_FILE_STATUS.PENDING_RECONCILE] || 0) > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-amber-900">
              Some files are not in the library yet. Keep them on this phone until the transfer result
              below shows them as uploaded.
            </div>
          )}
          <ul className="divide-y">
            {entries.map((f) => (
              <li key={f.clientKey || f.clientUploadId} className="py-2 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{f.filename}</div>
                    <div className="text-xs text-slate-500">
                      {STATUS_LABELS[f.status] || STATUS_LABELS[f.phase] || f.status}
                      {typeof f.percent === 'number' ? ` · ${f.percent}%` : ''}
                      {f.message ? ` · ${f.message}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {(() => {
                      const id = f.clientUploadId || f.clientKey;
                      const phase = f.status || f.phase;
                      const canRetry =
                        f.hasLocalFile !== false &&
                        ['interrupted', 'uploading', 'retrying', 'queued', 'finalizing'].includes(phase);
                      const needsReselect =
                        phase === 'needs_reselect' ||
                        (['interrupted', 'uploading', 'retrying'].includes(phase) && f.hasLocalFile === false);
                      return (
                        <>
                          {canRetry && (
                            <button
                              type="button"
                              className="text-xs text-blue-700 underline"
                              disabled={actingId === id}
                              onClick={async () => {
                                try {
                                  setActingId(id);
                                  setSessionError(null);
                                  const token = await ensureMobileToken();
                                  await retryQueueItem({
                                    token,
                                    clientUploadId: id,
                                    onFileUpdate,
                                  });
                                } catch (err) {
                                  setSessionError(err.message || 'Retry failed');
                                } finally {
                                  setActingId(null);
                                }
                              }}
                            >
                              {actingId === id ? 'Retrying…' : 'Retry'}
                            </button>
                          )}
                          {needsReselect && (
                            <button
                              type="button"
                              className="text-xs text-blue-700 underline"
                              disabled={actingId === id}
                              onClick={() => {
                                reselectTargetRef.current = id;
                                reselectRef.current?.click();
                              }}
                            >
                              Reselect
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                {f.analysisOutcome && (f.phase === 'analysis_failed' || f.status === 'analysis_failed') ? (
                  <AnalysisOutcomeCard
                    asset={{ processing_status: 'queued' }}
                    analysis={{
                      status: 'failed',
                      suggested: {
                        narrative: f.analysisOutcome.description,
                        tags: f.analysisOutcome.tags,
                        condition_notes: f.analysisOutcome.observations,
                        recommended_uses: f.analysisOutcome.recommendedUses,
                        privacy_risks: f.analysisOutcome.privacyWarnings,
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
                const token = await ensureMobileToken();
                await attachReselectedFile({
                  clientUploadId: target,
                  file,
                  token,
                  onFileUpdate,
                  autoStart: true,
                });
              } catch (err) {
                setSessionError(err.message || 'Reselect failed');
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      )}

      {manifest?.batch && (
        <div className="rounded-xl border bg-white p-3 text-sm" data-testid="mobile-transfer-manifest">
          <h3 className="font-medium">Transfer result</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            <div><dt className="text-slate-500">In library</dt><dd>{manifest.batch.success_count}</dd></div>
            <div><dt className="text-slate-500">Failed</dt><dd>{manifest.batch.failed_count}</dd></div>
            <div><dt className="text-slate-500">Abandoned</dt><dd>{manifest.batch.abandoned_count ?? 0}</dd></div>
            <div><dt className="text-slate-500">Duplicates</dt><dd>{manifest.batch.duplicate_count}</dd></div>
            {typeof manifest.pendingCount === 'number' && (
              <div><dt className="text-slate-500">Still finalizing</dt><dd>{manifest.pendingCount}</dd></div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
