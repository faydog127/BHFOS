import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { listAssets, submitReelVersion } from '@/lib/mediaIntel/api';
import { requestSignedMediaUrl, requestSignedReelUrl } from '@/lib/mediaIntel/signedAccess';

const REEL_UPLOAD_UNAVAILABLE_MESSAGE =
  'Submission upload requires deployed media-intel-reel-upload — not available until staging deploy. ' +
  'Direct client writes to mil/reels/% are disabled (contributors/staff have no storage or table ' +
  'insert access there under pre-staging hardening).';

/**
 * Mint a server-authorized reel upload target. Contributors/staff must never write
 * mil/reels/% storage or insert mil_reel_versions rows directly — RLS only allows
 * SELECT and owner-approve UPDATEs on that table now.
 */
async function mintReelUpload(body) {
  const { data, error } = await supabase.functions.invoke('media-intel-reel-upload', {
    body: { action: 'mint', ...body },
  });
  if (error || data?.error) {
    throw new Error(error?.message || data?.error || 'media-intel-reel-upload unavailable');
  }
  return data;
}

async function completeReelUpload(body) {
  const { data, error } = await supabase.functions.invoke('media-intel-reel-upload', {
    body: { action: 'complete', ...body },
  });
  if (error || data?.error) {
    throw new Error(error?.message || data?.error || 'media-intel-reel-upload unavailable');
  }
  return data;
}

async function putToMintedTarget(minted, file, mime) {
  if (minted.signedUrl) {
    const res = await fetch(minted.signedUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: file });
    if (!res.ok) throw new Error(`Reel upload failed (${res.status})`);
    return;
  }
  if (minted.token && minted.bucket && minted.path) {
    const { error } = await supabase.storage
      .from(minted.bucket)
      .uploadToSignedUrl(minted.path, minted.token, file, { contentType: mime });
    if (error) throw error;
    return;
  }
  throw new Error('No signed upload credentials returned');
}

export default function MediaCreatorWorkspace({ caps: capsProp } = {}) {
  const outlet = useOutletContext() || {};
  const caps = capsProp || outlet.caps;
  const fileRef = useRef(null);
  const [available, setAvailable] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mediaBusyId, setMediaBusyId] = useState(null);

  const load = async () => {
    try {
      const assets = await listAssets({ archived: false, trashed: false, limit: 100 });
      setAvailable(assets);
      const { data: auth } = await supabase.auth.getUser();
      let assignQ = supabase
        .from('mil_creator_assignments')
        .select(
          'id, asset_id, collection_id, status, notes, instructions, due_at, requested_output, platform_format, created_at',
        )
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(40);
      if (caps.isCreator && !caps.isStaff) {
        assignQ = assignQ.eq('creator_user_id', auth.user.id);
      }
      const { data: assignRows, error: aErr } = await assignQ;
      if (aErr) throw aErr;
      setAssignments(assignRows || []);

      let q = supabase
        .from('mil_reel_projects')
        .select('*, mil_reel_versions(*)')
        .order('updated_at', { ascending: false });
      if (caps.isCreator && !caps.isStaff) {
        q = q.eq('creator_user_id', auth.user.id);
      }
      const { data, error: err } = await q;
      if (err) throw err;
      setProjects(data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [caps.isCreator, caps.isStaff]);

  const openAssignedMedia = async (assetId, purpose) => {
    setMediaBusyId(assetId);
    setError(null);
    try {
      // Never allowOriginal — missing safe derivative must fail closed (no original fallback).
      const signed = await requestSignedMediaUrl({
        assetId,
        purpose,
        derivativeKind: purpose === 'download' ? 'creator_download' : 'detail_preview',
        allowOriginal: false,
      });
      if (!signed?.url) throw new Error('Working media is unavailable or still preparing.');
      window.open(signed.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = String(err.message || '');
      if (/no approved|unavailable|not available|403|preparing/i.test(msg)) {
        setError(
          'Contributor-safe media is unavailable or still preparing — protected originals are never provided as a fallback.',
        );
      } else {
        setError(msg || 'Media access denied');
      }
    } finally {
      setMediaBusyId(null);
    }
  };

  const uploadReel = async (file) => {
    if (!file) return;
    if (!caps.isCreator && !caps.isStaff) {
      setError('Only contributors can upload deliverable drafts.');
      return;
    }
    setBusy(true);
    setError(null);
    let project = null;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const mime = file.type || 'video/mp4';
      const { data: created, error: pErr } = await supabase
        .from('mil_reel_projects')
        .insert({
          title: title.trim() || file.name,
          creator_user_id: auth.user.id,
          status: 'creator_draft',
        })
        .select('*')
        .single();
      if (pErr) throw pErr;
      project = created;

      const minted = await mintReelUpload({
        projectId: project.id,
        versionNumber: 1,
        filename: file.name,
        contentType: mime,
        byteSize: file.size,
        creatorNotes: notes || null,
      });
      await putToMintedTarget(minted, file, mime);
      await completeReelUpload({
        grantId: minted.grantId,
        versionId: minted.versionId,
        byteSize: file.size,
      });

      setMessage('Draft uploaded. Submit when ready for owner review.');
      setTitle('');
      setNotes('');
      await load();
    } catch (err) {
      setError(REEL_UPLOAD_UNAVAILABLE_MESSAGE);
      if (fileRef.current) fileRef.current.value = '';
      if (project?.id) {
        await supabase.from('mil_reel_projects').delete().eq('id', project.id).eq('status', 'creator_draft');
      }
    } finally {
      setBusy(false);
    }
  };

  const uploadRevision = async (project, file) => {
    setBusy(true);
    setError(null);
    try {
      const versions = project.mil_reel_versions || [];
      const nextNum = versions.reduce((m, v) => Math.max(m, v.version_number || 0), 0) + 1;
      const mime = file.type || 'video/mp4';

      const minted = await mintReelUpload({
        projectId: project.id,
        versionNumber: nextNum,
        filename: file.name,
        contentType: mime,
        byteSize: file.size,
        creatorNotes: notes || null,
      });
      await putToMintedTarget(minted, file, mime);
      await completeReelUpload({
        grantId: minted.grantId,
        versionId: minted.versionId,
        byteSize: file.size,
      });

      setMessage(`Version ${nextNum} uploaded. Fresh owner approval is required.`);
      await load();
    } catch (err) {
      setError(REEL_UPLOAD_UNAVAILABLE_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="media-creator-workspace">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Contributor Workspace</h2>
        <p className="text-sm text-slate-600">
          Assignments, submissions, and profile. Only assigned contributor-safe media is visible — protected
          originals never appear here.
        </p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="font-medium text-slate-900">Assignments</h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-600">No active assignments yet.</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id} className="rounded-md border px-3 py-2 text-sm space-y-1">
                <div className="font-medium">
                  {a.asset_id ? `Asset ${a.asset_id.slice(0, 8)}…` : `Collection ${a.collection_id?.slice(0, 8)}…`}
                </div>
                {(a.instructions || a.notes) && (
                  <p className="text-slate-600 whitespace-pre-wrap">{a.instructions || a.notes}</p>
                )}
                <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                  {a.due_at && <span>Due {new Date(a.due_at).toLocaleDateString()}</span>}
                  {a.requested_output && <span>Output: {a.requested_output}</span>}
                  {a.platform_format && <span>Format: {a.platform_format}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="font-medium text-slate-900">Assigned media</h3>
        {available.length === 0 ? (
          <p className="text-sm text-slate-600">No contributor-safe source media assigned yet.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {available.map((a) => (
              <li key={a.id} className="rounded-md border px-3 py-2 text-sm space-y-2">
                <div className="font-medium truncate">{a.original_filename}</div>
                <div className="text-xs text-slate-500">{a.media_kind}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={mediaBusyId === a.id}
                    className="rounded-md border px-3 py-1.5 text-xs min-h-[40px]"
                    onClick={() => openAssignedMedia(a.id, 'preview')}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    disabled={mediaBusyId === a.id}
                    className="rounded-md border px-3 py-1.5 text-xs min-h-[40px]"
                    onClick={() => openAssignedMedia(a.id, 'download')}
                  >
                    Download working copy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="font-medium text-slate-900">Submissions</h3>
        <p className="text-xs text-slate-500">
          Upload a draft, submit for review, and revise as a new version. Submitting a draft requests owner review
          only — approval is not publishing.
        </p>
        <label className="block text-sm">
          <span className="font-medium">Title</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Notes for owner</span>
          <textarea
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,.mp4,.mov"
          className="hidden"
          onChange={(e) => uploadReel(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          className="rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm min-h-[44px]"
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Uploading…' : 'Upload draft deliverable'}
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium text-slate-900">Your submissions</h3>
        {projects.length === 0 && <p className="text-sm text-slate-600">No submissions yet.</p>}
        {projects.map((p) => {
          const versions = (p.mil_reel_versions || []).sort((a, b) => b.version_number - a.version_number);
          const latest = versions[0];
          return (
            <div key={p.id} className="rounded-xl border bg-white p-4 space-y-2">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-slate-600">Status: {p.status}</div>
              {latest && (
                <div className="text-sm text-slate-700">
                  Current version v{latest.version_number}: {latest.status}
                  {latest.review_notes ? ` · Feedback: ${latest.review_notes}` : ''}
                  {latest.review_decision === 'denied' && !latest.review_notes ? ' · Rejected' : ''}
                </div>
              )}
              {versions.length > 1 && (
                <ul className="text-xs text-slate-500 space-y-0.5">
                  {versions.map((v) => (
                    <li key={v.id}>
                      v{v.version_number}: {v.status}
                      {v.id === latest?.id ? ' (current)' : ''}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {latest?.status === 'creator_draft' && (
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm min-h-[44px]"
                    onClick={async () => {
                      await submitReelVersion(latest.id);
                      setMessage('Submitted for owner review.');
                      await load();
                    }}
                  >
                    Submit for review
                  </button>
                )}
                {['denied', 'revision_requested', 'approved_to_post'].includes(latest?.status) && (
                  <label className="rounded-md border px-3 py-2 text-sm min-h-[44px] inline-flex items-center cursor-pointer">
                    Upload revision (new version)
                    <input
                      type="file"
                      accept="video/*,.mp4,.mov"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => e.target.files?.[0] && uploadRevision(p, e.target.files[0])}
                    />
                  </label>
                )}
                {latest && (
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm min-h-[44px]"
                    onClick={async () => {
                      try {
                        const signed = await requestSignedReelUrl(latest.id, 'preview');
                        window.open(signed.url, '_blank', 'noopener,noreferrer');
                      } catch (err) {
                        setError(err.message || 'Preview not authorized');
                      }
                    }}
                  >
                    Preview
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-1">
        <h3 className="font-medium text-slate-900">Profile</h3>
        <p className="text-sm text-slate-600">
          Signed in as a contributor. You cannot approve your own work, access CRM, delete owner media, or publish
          externally.
        </p>
      </section>
    </div>
  );
}
