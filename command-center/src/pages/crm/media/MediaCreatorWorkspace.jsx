import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { audit, listAssets, submitReelVersion } from '@/lib/mediaIntel/api';
import { MIL_DERIVATIVES_BUCKET } from '@/lib/mediaIntel/constants';
import { safeStorageSegment } from '@/lib/mediaIntel/formats';
import { requestSignedReelUrl } from '@/lib/mediaIntel/signedAccess';

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
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data: project, error: pErr } = await supabase
        .from('mil_reel_projects')
        .insert({
          title: title.trim() || file.name,
          creator_user_id: auth.user.id,
          status: 'creator_draft',
        })
        .select('*')
        .single();
      if (pErr) throw pErr;

      const versionId = crypto.randomUUID();
      const path = `mil/reels/${project.id}/v1/${versionId}-${safeStorageSegment(file.name)}`;
      const up = await supabase.storage.from(MIL_DERIVATIVES_BUCKET).upload(path, file, {
        contentType: file.type || 'video/mp4',
        upsert: false,
      });
      if (up.error) throw up.error;

      const { data: version, error: vErr } = await supabase
        .from('mil_reel_versions')
        .insert({
          id: versionId,
          project_id: project.id,
          version_number: 1,
          status: 'creator_draft',
          storage_bucket: MIL_DERIVATIVES_BUCKET,
          storage_path: path,
          mime_type: file.type || 'video/mp4',
          byte_size: file.size,
          creator_notes: notes || null,
        })
        .select('*')
        .single();
      if (vErr) throw vErr;

      await audit('reel_upload', 'mil_reel_versions', version.id, {
        projectId: project.id,
        version: 1,
      });
      setMessage('Draft reel uploaded. Submit when ready for owner review.');
      setTitle('');
      setNotes('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadRevision = async (project, file) => {
    setBusy(true);
    try {
      const versions = project.mil_reel_versions || [];
      const nextNum = versions.reduce((m, v) => Math.max(m, v.version_number || 0), 0) + 1;
      const versionId = crypto.randomUUID();
      const path = `mil/reels/${project.id}/v${nextNum}/${versionId}-${safeStorageSegment(file.name)}`;
      const up = await supabase.storage.from(MIL_DERIVATIVES_BUCKET).upload(path, file, {
        contentType: file.type || 'video/mp4',
        upsert: false,
      });
      if (up.error) throw up.error;

      await supabase
        .from('mil_reel_versions')
        .update({ status: 'superseded' })
        .eq('project_id', project.id)
        .in('status', ['denied', 'revision_requested', 'approved_to_post']);

      const { data: version, error } = await supabase
        .from('mil_reel_versions')
        .insert({
          id: versionId,
          project_id: project.id,
          version_number: nextNum,
          status: 'creator_draft',
          storage_bucket: MIL_DERIVATIVES_BUCKET,
          storage_path: path,
          mime_type: file.type || 'video/mp4',
          byte_size: file.size,
          creator_notes: notes || null,
        })
        .select('*')
        .single();
      if (error) throw error;

      await supabase
        .from('mil_reel_projects')
        .update({ status: 'creator_draft' })
        .eq('id', project.id);

      await audit('reel_upload', 'mil_reel_versions', version.id, {
        projectId: project.id,
        version: nextNum,
        revision: true,
      });
      setMessage(`Version ${nextNum} uploaded. Fresh owner approval is required.`);
      await load();
    } catch (err) {
      setError(err.message);
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
                {['denied', 'revision_requested', 'approved_to_post'].includes(latest?.status) && (
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
