import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';
import { supabase } from '@/lib/customSupabaseClient';
import { UPLOAD_PHONE_NOTICE } from '@/lib/mediaIntel/constants';
import { sha256Hex, clientFileKey } from '@/lib/mediaIntel/checksum';
import { resolveMimeType, validateMediaFile } from '@/lib/mediaIntel/formats';
import {
  createUploadBatch,
  uploadFilesToBatch,
} from '@/lib/mediaIntel/uploadManager';
import { fetchMilRole, milCapabilities } from '@/lib/mediaIntel/roles';

async function invokeSession(body) {
  const { data, error } = await supabase.functions.invoke('media-intel-upload-session', { body });
  if (error) throw new Error(error.message || 'Upload session error');
  if (data?.error) {
    const err = new Error(data.error);
    err.code = data.code;
    throw err;
  }
  return data;
}

export default function MediaMobileUpload() {
  const outlet = useOutletContext() || {};
  const [caps, setCaps] = useState(outlet.caps || null);
  const [params] = useSearchParams();
  const sessionToken = params.get('session') || '';

  const inputRef = useRef(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [fileStates, setFileStates] = useState({});
  const [busy, setBusy] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [staffBatch, setStaffBatch] = useState(null);

  const mode = sessionToken ? 'session' : 'authenticated';

  useEffect(() => {
    if (!sessionToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await invokeSession({ action: 'validate', token: sessionToken });
        if (!cancelled) setSessionInfo(data);
      } catch (err) {
        if (!cancelled) setSessionError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken || outlet.caps) {
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
  }, [sessionToken, outlet.caps]);

  const onFileUpdate = useCallback((update) => {
    setFileStates((prev) => ({
      ...prev,
      [update.clientKey]: { ...prev[update.clientKey], ...update },
    }));
  }, []);

  const uploadViaSession = async (files) => {
    setBusy(true);
    setSessionError(null);
    try {
      for (const file of files) {
        const key = clientFileKey(file);
        const validation = validateMediaFile(file);
        if (!validation.ok) {
          onFileUpdate({ clientKey: key, filename: file.name, status: 'skipped', message: validation.reason });
          continue;
        }
        onFileUpdate({ clientKey: key, filename: file.name, status: 'hashing', percent: 0 });
        const checksum = await sha256Hex(file);
        const mime = resolveMimeType(file);

        onFileUpdate({ clientKey: key, filename: file.name, status: 'uploading', percent: 5 });
        const minted = await invokeSession({
          action: 'mint_upload',
          token: sessionToken,
          filename: file.name,
          contentType: mime,
        });

        let uploadError = null;
        if (minted.signedUrl) {
          const res = await fetch(minted.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mime },
            body: file,
          });
          if (!res.ok) uploadError = new Error(`Upload failed (${res.status})`);
        } else if (minted.token) {
          const { error } = await supabase.storage
            .from(minted.bucket)
            .uploadToSignedUrl(minted.path, minted.token, file, { contentType: mime });
          uploadError = error;
        } else {
          uploadError = new Error('No signed upload credentials returned');
        }
        if (uploadError) throw uploadError;

        onFileUpdate({ clientKey: key, filename: file.name, status: 'uploading', percent: 90 });
        const completed = await invokeSession({
          action: 'complete_file',
          token: sessionToken,
          assetId: minted.assetId,
          objectPath: minted.objectPath,
          checksumSha256: checksum,
          mimeType: mime,
          byteSize: file.size,
          originalFilename: file.name,
        });
        onFileUpdate({
          clientKey: key,
          filename: file.name,
          status: completed.status === 'duplicate' ? 'duplicate' : 'uploaded',
          percent: 100,
          message: completed.status === 'duplicate' ? 'Exact duplicate — kept existing file' : undefined,
        });
      }
      const m = await invokeSession({ action: 'manifest', token: sessionToken });
      setManifest(m);
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadAuthenticated = async (files) => {
    if (!caps?.canUpload) {
      setSessionError('Sign in with an upload-authorized account, or use a valid phone upload link.');
      return;
    }
    setBusy(true);
    try {
      const batch =
        staffBatch ||
        (await createUploadBatch({
          sourceLabel: 'Mobile browser upload',
        }));
      setStaffBatch(batch);
      await uploadFilesToBatch({
        batch,
        files,
        onFileUpdate,
        controllersRef: { current: {} },
      });
      const { fetchBatchManifest } = await import('@/lib/mediaIntel/uploadManager');
      setManifest(await fetchBatchManifest(batch.id));
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startUpload = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (mode === 'session') return uploadViaSession(files);
    return uploadAuthenticated(files);
  };

  const totals = useMemo(() => {
    const acc = {};
    Object.values(fileStates).forEach((f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
    });
    return acc;
  }, [fileStates]);

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

      {mode === 'session' && sessionInfo && (
        <div className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700">
          Batch ready · expires {new Date(sessionInfo.expiresAt).toLocaleString()}
        </div>
      )}

      {mode === 'authenticated' && !caps?.canUpload && (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
          Open a phone upload link from the owner, or sign in with an authorized uploader account.
          <div className="mt-3">
            {/* Legacy V1 login path until company-wide auth cleanup */}
            <Link className="text-blue-700 underline" to={`/${DEFAULT_TENANT_ID}/login?next=/media/upload`}>
              Sign in
            </Link>
          </div>
        </div>
      )}

      {(mode === 'session' ? sessionInfo : caps?.canUpload) && (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <Upload className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-800">Select photos and videos from this phone</p>
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

      {Object.keys(fileStates).length > 0 && (
        <div className="rounded-xl border bg-white p-3 space-y-2 text-sm">
          <div className="flex flex-wrap gap-3">
            <span className="text-emerald-700">Success: {totals.uploaded || 0}</span>
            <span className="text-amber-800">Duplicates: {totals.duplicate || 0}</span>
            <span className="text-slate-600">Skipped: {totals.skipped || 0}</span>
            <span className="text-red-700">Failed: {totals.failed || 0}</span>
          </div>
          <ul className="divide-y max-h-64 overflow-y-auto">
            {Object.values(fileStates).map((f) => (
              <li key={f.clientKey} className="py-2">
                <div className="truncate font-medium">{f.filename}</div>
                <div className="text-xs text-slate-500">
                  {f.status}
                  {typeof f.percent === 'number' ? ` · ${f.percent}%` : ''}
                  {f.message ? ` · ${f.message}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {manifest?.batch && (
        <div className="rounded-xl border bg-white p-3 text-sm" data-testid="mobile-transfer-manifest">
          <h3 className="font-medium">Transfer result</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            <div><dt className="text-slate-500">Success</dt><dd>{manifest.batch.success_count}</dd></div>
            <div><dt className="text-slate-500">Failed</dt><dd>{manifest.batch.failed_count}</dd></div>
            <div><dt className="text-slate-500">Skipped</dt><dd>{manifest.batch.skipped_count}</dd></div>
            <div><dt className="text-slate-500">Duplicates</dt><dd>{manifest.batch.duplicate_count}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
