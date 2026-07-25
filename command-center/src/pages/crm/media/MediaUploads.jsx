import React, { useCallback, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2, Pause, Play, RotateCcw, Upload, X } from 'lucide-react';
import { UPLOAD_PHONE_NOTICE } from '@/lib/mediaIntel/constants';
import {
  createUploadBatch,
  fetchBatchManifest,
  uploadFilesToBatch,
} from '@/lib/mediaIntel/uploadManager';
import { listUploadSessions } from '@/lib/mediaIntel/uploadSessionStore';

const STATUS_STYLES = {
  pending: 'text-slate-600',
  hashing: 'text-slate-700',
  uploading: 'text-blue-700',
  uploaded: 'text-emerald-700',
  duplicate: 'text-amber-800',
  skipped: 'text-slate-500',
  failed: 'text-red-700',
  cancelled: 'text-slate-500',
};

export default function MediaUploads() {
  const { caps } = useOutletContext();
  const inputRef = useRef(null);
  const folderRef = useRef(null);
  const controllersRef = useRef({});
  const fileMapRef = useRef({});

  const [sourceLabel, setSourceLabel] = useState('');
  const [sourcePhone, setSourcePhone] = useState('');
  const [sourcePerson, setSourcePerson] = useState('');
  const [batch, setBatch] = useState(null);
  const [fileStates, setFileStates] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const onFileUpdate = useCallback((update) => {
    setFileStates((prev) => ({
      ...prev,
      [update.clientKey]: { ...prev[update.clientKey], ...update },
    }));
  }, []);

  const startUpload = async (fileList) => {
    if (!caps.canUpload) {
      setError('You do not have permission to upload private intake media.');
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
      const created =
        batch ||
        (await createUploadBatch({
          sourceLabel,
          sourcePhone,
          sourcePerson,
        }));
      setBatch(created);
      await uploadFilesToBatch({
        batch: created,
        files,
        onFileUpdate,
        controllersRef,
      });
      const m = await fetchBatchManifest(created.id);
      setManifest(m);
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
      setError('No interrupted upload sessions found in this browser.');
      return;
    }
    const latest = sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    const m = await fetchBatchManifest(latest.batchId);
    setBatch(m.batch);
    setManifest(m);
  };

  const entries = Object.values(fileStates);
  const totals = entries.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    },
    {},
  );

  if (!caps.canUpload && !caps.isStaff) {
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
          Designed for large phone dumps. Uploads are resumable. Exact duplicates are flagged — originals are never auto-deleted.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950" role="note">
        {UPLOAD_PHONE_NOTICE}
      </div>

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
            className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            Choose files
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 min-h-[44px]"
            onClick={() => folderRef.current?.click()}
            disabled={busy}
          >
            Choose folder
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 min-h-[44px]"
            onClick={recoverSessions}
            disabled={busy}
          >
            Recover session
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
            <span className="text-emerald-700">Success: {totals.uploaded || 0}</span>
            <span className="text-amber-800">Duplicates: {totals.duplicate || 0}</span>
            <span className="text-slate-600">Skipped: {totals.skipped || 0}</span>
            <span className="text-red-700">Failed: {totals.failed || 0}</span>
            {batch && <span className="text-slate-500">Batch {batch.id.slice(0, 8)}…</span>}
          </div>

          <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {entries.map((f) => (
              <li key={f.clientKey} className="py-2 flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800">{f.filename}</div>
                  <div className={STATUS_STYLES[f.status] || 'text-slate-600'}>
                    {f.status}
                    {typeof f.percent === 'number' ? ` · ${f.percent}%` : ''}
                    {f.message ? ` · ${f.message}` : ''}
                  </div>
                  {f.status === 'uploading' && (
                    <div className="mt-1 h-1.5 rounded bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${f.percent || 0}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {f.status === 'uploading' && (
                    <>
                      <button
                        type="button"
                        aria-label="Pause"
                        className="p-2 rounded hover:bg-slate-100 min-h-[40px] min-w-[40px]"
                        onClick={() => controllersRef.current[f.clientKey]?.pause?.()}
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Resume"
                        className="p-2 rounded hover:bg-slate-100 min-h-[40px] min-w-[40px]"
                        onClick={() => controllersRef.current[f.clientKey]?.resume?.()}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel"
                        className="p-2 rounded hover:bg-slate-100 min-h-[40px] min-w-[40px]"
                        onClick={() => controllersRef.current[f.clientKey]?.abort?.()}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><dt className="text-slate-500">Batch</dt><dd className="font-mono text-xs break-all">{manifest.batch.id}</dd></div>
            <div><dt className="text-slate-500">Source</dt><dd>{manifest.batch.source_label || '—'}</dd></div>
            <div><dt className="text-slate-500">Started</dt><dd>{new Date(manifest.batch.started_at).toLocaleString()}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd>{manifest.batch.status}</dd></div>
            <div><dt className="text-slate-500">Success</dt><dd>{manifest.batch.success_count}</dd></div>
            <div><dt className="text-slate-500">Failed</dt><dd>{manifest.batch.failed_count}</dd></div>
            <div><dt className="text-slate-500">Skipped</dt><dd>{manifest.batch.skipped_count}</dd></div>
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
