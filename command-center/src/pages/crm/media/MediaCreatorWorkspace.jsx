import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { listAssets, submitReelVersion } from '@/lib/mediaIntel/api';
import { requestSignedReelUrl } from '@/lib/mediaIntel/signedAccess';

const REEL_UPLOAD_UNAVAILABLE_MESSAGE =
  'Reel upload requires deployed media-intel-reel-upload — not available until staging deploy. ' +
  'Direct client writes to mil/reels/% are disabled (creators/staff have no storage or table ' +
  'insert access there under pre-staging hardening).';

/**
 * Mint a server-authorized reel upload target. Creators/staff must never write
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
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reelUploadDisabled, setReelUploadDisabled] = useState(false);

  const load = async () => {
    try {
      const assets = await listAssets({ archived: false, limit: 100 });
      setAvailable(assets);
      const { data: auth } = await supabase.auth.getUser();
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

  const uploadReel = async (file) => {
    if (!file) return;
    if (!caps.isCreator && !caps.isStaff) {
      setError('Only reel creators can upload reel drafts.');
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

      setMessage('Draft reel uploaded. Submit when ready for owner review.');
      setTitle('');
      setNotes('');
      await load();
    } catch (err) {
      // The edge mint/complete step is the only authorized path to create a reel
      // version. If it is unavailable, disable further attempts with an honest
      // message instead of silently falling back to a forbidden direct write.
      setReelUploadDisabled(true);
      setError(REEL_UPLOAD_UNAVAILABLE_MESSAGE);
      if (project?.id) {
        // Roll back the orphaned draft project — it has no version and never will.
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
      setReelUploadDisabled(true);
      setError(REEL_UPLOAD_UNAVAILABLE_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="media-creator-workspace">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Creator workspace</h2>
        <p className="text-sm text-slate-600">
          Only marketing-approved or assigned media is visible. Raw private intake and restricted assets are never shown here.
        </p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="font-medium text-slate-900">Available media</h3>
        {available.length === 0 ? (
          <p className="text-sm text-slate-600">No approved source media assigned yet.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {available.map((a) => (
              <li key={a.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-medium truncate">{a.original_filename}</div>
                <div className="text-xs text-slate-500">{a.media_kind}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="font-medium text-slate-900">Upload draft or completed reel</h3>
        {reelUploadDisabled ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {REEL_UPLOAD_UNAVAILABLE_MESSAGE}
          </p>
        ) : (
          <>
            <label className="block text-sm">
              <span className="font-medium">Title</span>
              <input className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Notes / questions for owner</span>
              <textarea className="mt-1 w-full rounded-md border px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <input ref={fileRef} type="file" accept="video/*,.mp4,.mov" className="hidden" onChange={(e) => uploadReel(e.target.files?.[0])} />
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm min-h-[44px]"
              onClick={() => fileRef.current?.click()}
            >
              {busy ? 'Uploading…' : 'Choose reel file'}
            </button>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium text-slate-900">Your reel projects</h3>
        {projects.map((p) => {
          const versions = (p.mil_reel_versions || []).sort((a, b) => b.version_number - a.version_number);
          const latest = versions[0];
          return (
            <div key={p.id} className="rounded-xl border bg-white p-4 space-y-2">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-slate-600">Project status: {p.status}</div>
              {latest && (
                <div className="text-sm text-slate-700">
                  Latest v{latest.version_number}: {latest.status}
                  {latest.review_notes ? ` · Owner notes: ${latest.review_notes}` : ''}
                  {latest.review_decision === 'denied' && !latest.review_notes ? ' · Denied (no notes provided)' : ''}
                </div>
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
                {!reelUploadDisabled && ['denied', 'revision_requested', 'approved_to_post'].includes(latest?.status) && (
                  <label className="rounded-md border px-3 py-2 text-sm min-h-[44px] inline-flex items-center cursor-pointer">
                    Upload new version
                    <input
                      type="file"
                      accept="video/*,.mp4,.mov"
                      className="hidden"
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
    </div>
  );
}
