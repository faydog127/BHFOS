import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { listAssets, listSubmissions, submitContentPackage, submitReelVersion } from '@/lib/mediaIntel/api';
import {
  DEFAULT_SUBMISSION_TYPE,
  PRIVACY_LABELS,
  SUBMISSION_REVIEW_LABELS,
  SUBMISSION_TYPES,
} from '@/lib/mediaIntel/constants';
import { requestSignedMediaUrl, requestSignedReelUrl } from '@/lib/mediaIntel/signedAccess';
import {
  createContributorUploadSession,
  uploadFilesToSession,
} from '@/lib/mediaIntel/uploadManager';
import {
  approvedUseChips,
  CONTRIBUTOR_SEARCH_MIN_COUNT,
  CONTRIBUTOR_STANDING_RULES,
  filterAssignedMedia,
  pickContributorThumbKind,
  summarizeContributorBrief,
} from '@/lib/mediaIntel/contributorWorkspace';

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

async function downloadWorkingCopyFile(assetId, filenameHint) {
  const signed = await requestSignedMediaUrl({
    assetId,
    purpose: 'download',
    derivativeKind: 'creator_download',
    allowOriginal: false,
  });
  if (!signed?.url) throw new Error('Working media is unavailable or still preparing.');
  const res = await fetch(signed.url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const base = String(filenameHint || assetId).replace(/\.(heic|heif)$/i, '') || assetId;
  const downloadName = /\.(jpe?g|png|webp)$/i.test(base) ? base : `${base}.jpg`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = downloadName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function MediaCreatorWorkspace({ caps: capsProp } = {}) {
  const outlet = useOutletContext() || {};
  const caps = capsProp || outlet.caps;
  const fileRef = useRef(null);
  const selfShotRef = useRef(null);
  const [available, setAvailable] = useState([]);
  const [myShots, setMyShots] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selfUploadBusy, setSelfUploadBusy] = useState(false);
  const [selfUploadNote, setSelfUploadNote] = useState(null);
  const [mediaBusyId, setMediaBusyId] = useState(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [thumbUrls, setThumbUrls] = useState({});
  const [submissionType, setSubmissionType] = useState(DEFAULT_SUBMISSION_TYPE);
  const [contextKind, setContextKind] = useState('general');
  const [contextLabel, setContextLabel] = useState('');
  const [caption, setCaption] = useState('');
  const [cta, setCta] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [platforms, setPlatforms] = useState('');
  const [readyAssetIds, setReadyAssetIds] = useState([]);
  const [submitConfirm, setSubmitConfirm] = useState(null);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [submitBusy, setSubmitBusy] = useState(false);

  const filteredMedia = useMemo(
    () => filterAssignedMedia(available, mediaSearch),
    [available, mediaSearch],
  );
  const jobBrief = useMemo(() => summarizeContributorBrief(assignments), [assignments]);
  const showMediaSearch = available.length > CONTRIBUTOR_SEARCH_MIN_COUNT;
  const activityLog = useMemo(() => {
    const rows = [];
    for (const a of myShots) {
      const review =
        a.human_review_status === 'verified'
          ? 'Verified by owner'
          : a.human_review_status === 'pending'
            ? 'Awaiting owner review'
            : String(a.human_review_status || 'Uploaded');
      rows.push({
        id: `shot-${a.id}`,
        at: a.created_at,
        kind: a.media_kind === 'video' ? 'Video upload' : 'Photo upload',
        title: a.original_filename || 'Untitled shot',
        status: review,
      });
    }
    for (const p of projects) {
      for (const v of p.mil_reel_versions || []) {
        rows.push({
          id: `reel-${v.id}`,
          at: v.created_at || v.updated_at || p.updated_at,
          kind: 'Draft submission',
          title: `${p.title || 'Untitled'} · v${v.version_number}`,
          status: String(v.status || 'draft').replace(/_/g, ' '),
        });
      }
    }
    return rows
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .slice(0, 40);
  }, [myShots, projects]);

  const loadThumbs = async (assets) => {
    const next = {};
    await Promise.all(
      (assets || []).map(async (asset) => {
        const kind = pickContributorThumbKind(asset.mil_derivatives);
        if (!kind) return;
        try {
          const signed = await requestSignedMediaUrl({
            assetId: asset.id,
            purpose: 'preview',
            derivativeKind: kind,
            allowOriginal: false,
          });
          if (signed?.url) next[asset.id] = signed.url;
        } catch {
          /* thumb is best-effort; Preview/Download remain authoritative */
        }
      }),
    );
    setThumbUrls(next);
  };

  const load = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const assets = await listAssets({ archived: false, trashed: false, limit: 100 });
      setAvailable(assets);

      let own = [];
      if (caps?.canContributorSelfUpload && auth?.user?.id) {
        own = await listAssets({
          archived: false,
          trashed: false,
          createdByUserId: auth.user.id,
          limit: 80,
        });
        setMyShots(own);
      } else {
        setMyShots([]);
      }
      void loadThumbs([...(assets || []), ...own]);

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

      if (auth?.user?.id) {
        try {
          const subs = await listSubmissions({
            contributorUserId: auth.user.id,
            includeDrafts: true,
            limit: 40,
          });
          setMySubmissions(subs);
        } catch {
          setMySubmissions([]);
        }
      } else {
        setMySubmissions([]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const uploadMyShots = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    if (!caps?.canContributorSelfUpload) {
      setError('Only contributors can upload their own shots here.');
      return;
    }
    if (submissionType === 'reel') {
      setError('Switch to Raw video or Social media post to upload media packages here. Reels use the draft uploader below.');
      return;
    }
    if (submissionType === 'raw_video') {
      const nonVideo = files.filter((f) => !String(f.type || '').startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(f.name || ''));
      if (nonVideo.length) {
        setError('Raw video submissions accept video files only.');
        return;
      }
    }
    setSelfUploadBusy(true);
    setError(null);
    setMessage(null);
    setSubmitConfirm(null);
    setSelfUploadNote(`Starting transfer of ${files.length} file(s)…`);
    try {
      const beforeIds = new Set(myShots.map((a) => a.id));
      const session = await createContributorUploadSession({
        sourcePerson: 'Contributor self-upload',
        expiresHours: 12,
      });
      if (!session?.token) throw new Error('Contributor upload session was not created.');
      const outcomes = new Map();
      await uploadFilesToSession({
        token: session.token,
        batchId: session.batchId,
        files,
        onFileUpdate: (item) => {
          if (item?.clientUploadId) outcomes.set(item.clientUploadId, item.status);
          const vals = [...outcomes.values()];
          const done = vals.filter((s) => s === 'uploaded' || s === 'duplicate').length;
          const failed = vals.filter((s) => s === 'failed').length;
          setSelfUploadNote(
            `Transfer progress: ${done} uploaded${failed ? `, ${failed} failed` : ''} (of ${files.length}).`,
          );
        },
      });
      const vals = [...outcomes.values()];
      const done = vals.filter((s) => s === 'uploaded' || s === 'duplicate').length;
      const failed = vals.filter((s) => s === 'failed').length;
      await load();
      const { data: auth } = await supabase.auth.getUser();
      const refreshed = auth?.user?.id
        ? await listAssets({
            archived: false,
            trashed: false,
            createdByUserId: auth.user.id,
            limit: 80,
          })
        : [];
      const newIds = (refreshed || []).filter((a) => !beforeIds.has(a.id)).map((a) => a.id);
      setReadyAssetIds((prev) => [...new Set([...prev, ...newIds])]);
      setMessage(
        failed
          ? `Uploaded ${done} file(s); ${failed} failed. Ready to submit when required fields are complete.`
          : `Uploaded ${done || files.length} file(s). Review details below, then Submit for Review.`,
      );
      setSelfUploadNote(null);
    } catch (err) {
      setError(err.message || 'Self-upload failed');
      setSelfUploadNote(null);
    } finally {
      setSelfUploadBusy(false);
      if (selfShotRef.current) selfShotRef.current.value = '';
    }
  };

  const submitPackageForReview = async () => {
    if (submitBusy) return;
    if (!['raw_video', 'social_post'].includes(submissionType)) {
      setError('Choose Raw video or Social media post to submit a media package.');
      return;
    }
    if (!readyAssetIds.length) {
      setError('Upload media first, then Submit for Review.');
      return;
    }
    if (submissionType === 'social_post' && !String(title || '').trim()) {
      setError('Social media posts require a post title.');
      return;
    }
    setSubmitBusy(true);
    setError(null);
    setMessage(null);
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `submit-${Date.now()}-${readyAssetIds.join('-')}`;
      const platformList = String(platforms || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const result = await submitContentPackage({
        submissionType,
        assetIds: readyAssetIds,
        title: title.trim() || undefined,
        contributorNotes: notes.trim() || undefined,
        contextKind,
        contextLabel: contextLabel.trim() || undefined,
        caption: caption.trim() || undefined,
        cta: cta.trim() || undefined,
        hashtags: hashtags.trim() || undefined,
        platforms: platformList.length ? platformList : undefined,
        idempotencyKey,
      });
      if (!result?.public_id) {
        throw new Error('Submission failed — no confirmation from server.');
      }
      const typeLabel =
        SUBMISSION_TYPES.find((t) => t.id === submissionType)?.label || 'Content';
      setSubmitConfirm({
        publicId: result.public_id,
        submittedAt: result.submitted_at || new Date().toISOString(),
        typeLabel,
        already: Boolean(result.already_submitted),
      });
      setMessage(null);
      setReadyAssetIds([]);
      setTitle('');
      setNotes('');
      setCaption('');
      setCta('');
      setHashtags('');
      setPlatforms('');
      setContextLabel('');
      await load();
    } catch (err) {
      setError(err.message || 'Submit for review failed');
      setSubmitConfirm(null);
    } finally {
      setSubmitBusy(false);
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

  const downloadOne = async (asset) => {
    setMediaBusyId(asset.id);
    setError(null);
    try {
      await downloadWorkingCopyFile(asset.id, asset.original_filename);
      setMessage('Working copy download started.');
    } catch (err) {
      const msg = String(err.message || '');
      if (/no approved|unavailable|not available|403|preparing/i.test(msg)) {
        setError(
          'Contributor-safe media is unavailable or still preparing — protected originals are never provided as a fallback.',
        );
      } else {
        setError(msg || 'Download failed');
      }
    } finally {
      setMediaBusyId(null);
    }
  };

  const downloadAllVisible = async () => {
    if (filteredMedia.length === 0) return;
    setBatchBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    try {
      for (const asset of filteredMedia) {
        try {
          await downloadWorkingCopyFile(asset.id, asset.original_filename);
          ok += 1;
          // Small gap helps browsers accept sequential save prompts.
          await new Promise((r) => setTimeout(r, 350));
        } catch {
          failed += 1;
        }
      }
      if (failed === 0) {
        setMessage(`Downloaded ${ok} working cop${ok === 1 ? 'y' : 'ies'} (JPEG).`);
      } else {
        setMessage(`Downloaded ${ok}; ${failed} unavailable or still preparing.`);
      }
    } finally {
      setBatchBusy(false);
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
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Contributor Workspace</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Brief → download working copies → upload your shots → submit draft.
        </p>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}

      <section className="rounded-xl border bg-white p-4 space-y-3" data-testid="contributor-job-brief">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Your brief</h3>
          {jobBrief.primaryDueAt && (
            <span className="text-sm font-medium text-slate-800" data-testid="contributor-due-date">
              Due {new Date(jobBrief.primaryDueAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-600">No active assignments yet.</p>
        ) : (
          <>
            {jobBrief.hasCreativeBrief ? (
              <div className="space-y-2">
                {jobBrief.briefs.map((text, i) => (
                  <p key={`brief-${i}`} className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                No written brief yet — use the output type below and the approved-use chips on each asset.
              </p>
            )}
            {jobBrief.packSummary && (
              <p className="text-xs text-slate-500" data-testid="contributor-pack-summary">
                {jobBrief.packSummary}
              </p>
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed border-t pt-3" data-testid="contributor-standing-rules">
              {CONTRIBUTOR_STANDING_RULES}
            </p>
          </>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Assigned media</h3>
          <button
            type="button"
            disabled={batchBusy || filteredMedia.length === 0}
            className="rounded-md bg-slate-900 text-white px-4 py-2.5 text-sm font-medium min-h-[44px] disabled:opacity-50"
            onClick={downloadAllVisible}
            data-testid="contributor-download-all"
          >
            {batchBusy ? 'Downloading…' : `Download all (${filteredMedia.length})`}
          </button>
        </div>

        {showMediaSearch && (
          <label className="block text-sm">
            <span className="sr-only">Search assigned media</span>
            <input
              type="search"
              value={mediaSearch}
              onChange={(e) => setMediaSearch(e.target.value)}
              placeholder="Search assigned media by filename…"
              className="w-full rounded-md border px-3 py-2 min-h-[44px] text-sm"
              data-testid="contributor-media-search"
            />
          </label>
        )}

        {available.length === 0 ? (
          <p className="text-sm text-slate-600">No contributor-safe source media assigned yet.</p>
        ) : filteredMedia.length === 0 ? (
          <p className="text-sm text-slate-600">No assigned media matches that search.</p>
        ) : (
          <ul className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredMedia.map((a) => {
              const chips = approvedUseChips(a.mil_permitted_uses);
              const thumb = thumbUrls[a.id];
              const thumbReady = Boolean(pickContributorThumbKind(a.mil_derivatives));
              return (
                <li key={a.id} className="rounded-md border overflow-hidden text-sm flex flex-col">
                  <div className="aspect-square bg-slate-100 relative">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 px-2 text-center">
                        {thumbReady ? 'Loading preview…' : 'Still preparing'}
                      </div>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5 flex-1 flex flex-col">
                    {chips.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {chips.map((c) => (
                          <span
                            key={c.key}
                            className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                          >
                            {c.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      <button
                        type="button"
                        disabled={mediaBusyId === a.id || batchBusy}
                        className="rounded-md border px-2.5 py-1.5 text-xs min-h-[36px] text-slate-700"
                        onClick={() => openAssignedMedia(a.id, 'preview')}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={mediaBusyId === a.id || batchBusy}
                        className="rounded-md border px-2.5 py-1.5 text-xs min-h-[36px] text-slate-700"
                        onClick={() => downloadOne(a)}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {available.length > 0 && (
          <p className="text-xs text-slate-500" data-testid="contributor-next-submit">
            Next: edit offline, then upload your draft under Submissions.
          </p>
        )}
      </section>

      {(caps?.canContributorSelfUpload || caps?.isCreator) && (
        <section className="rounded-xl border bg-white p-4 space-y-4" data-testid="contributor-upload-my-shots">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Submit Content</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload first, then deliberately submit for owner review. Approval is not publishing.
              Keep phone originals until the transfer is verified.
            </p>
          </div>

          <fieldset data-testid="contributor-submission-type">
            <legend className="text-sm font-medium text-slate-900 mb-2">What are you submitting?</legend>
            <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5" role="radiogroup" aria-label="Submission type">
              {SUBMISSION_TYPES.map((t) => (
                <label
                  key={t.id}
                  className={`rounded px-3 py-2 text-sm min-h-[40px] inline-flex items-center cursor-pointer ${
                    submissionType === t.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="submission-type"
                    value={t.id}
                    checked={submissionType === t.id}
                    onChange={() => {
                      setSubmissionType(t.id);
                      setSubmitConfirm(null);
                    }}
                    className="sr-only"
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5" data-testid="contributor-submission-type-default">
              Default: Reel
            </p>
          </fieldset>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">{submissionType === 'social_post' ? 'Post title' : 'Title'}</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Context</span>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px] bg-white"
                value={contextKind}
                onChange={(e) => setContextKind(e.target.value)}
              >
                <option value="general">General content</option>
                <option value="assignment">Assignment</option>
                <option value="campaign">Campaign</option>
                <option value="job">Job / service visit</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Context detail (optional)</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
                value={contextLabel}
                onChange={(e) => setContextLabel(e.target.value)}
                placeholder="Campaign or job label"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Notes for owner (optional)</span>
              <textarea
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {submissionType === 'social_post' && (
              <>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium">Proposed caption</span>
                  <textarea
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">CTA</span>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Platforms (comma-separated)</span>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
                    value={platforms}
                    onChange={(e) => setPlatforms(e.target.value)}
                    placeholder="instagram, facebook"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium">Hashtags</span>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                  />
                </label>
              </>
            )}
          </div>

          {submissionType === 'reel' ? (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs text-slate-500">
                Upload one reel draft, then Submit for Review. Uploading alone does not notify the owner.
              </p>
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
                {busy ? 'Uploading…' : 'Upload reel draft'}
              </button>
            </div>
          ) : caps?.canContributorSelfUpload ? (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs text-slate-500">
                {submissionType === 'raw_video'
                  ? 'Upload one or more videos, then Submit for Review. Uploads stay private until you submit.'
                  : 'Upload one or more media assets for the post package, then Submit for Review.'}
              </p>
              <input
                ref={selfShotRef}
                type="file"
                accept={
                  submissionType === 'raw_video'
                    ? 'video/*,.mp4,.mov,.m4v,.webm'
                    : 'image/*,video/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.mp4,.mov'
                }
                multiple
                className="hidden"
                onChange={(e) => uploadMyShots(e.target.files)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={selfUploadBusy}
                  className="rounded-md bg-slate-900 text-white px-4 py-2.5 text-sm font-medium min-h-[44px] disabled:opacity-50"
                  onClick={() => selfShotRef.current?.click()}
                  data-testid="contributor-upload-my-shots-btn"
                >
                  {selfUploadBusy ? 'Uploading…' : submissionType === 'raw_video' ? 'Upload videos' : 'Upload media'}
                </button>
                <button
                  type="button"
                  disabled={submitBusy || selfUploadBusy || !readyAssetIds.length}
                  className="rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm font-medium min-h-[44px] disabled:opacity-50"
                  onClick={submitPackageForReview}
                  data-testid="contributor-submit-for-review"
                >
                  {submitBusy ? 'Submitting…' : 'Submit for Review'}
                </button>
              </div>
              {readyAssetIds.length > 0 && (
                <p className="text-xs text-slate-600" data-testid="contributor-ready-to-submit">
                  {readyAssetIds.length} file(s) ready to submit.
                </p>
              )}
              {selfUploadNote && <p className="text-xs text-slate-600">{selfUploadNote}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-600 border-t pt-3">
              Media package upload requires contributor self-upload access.
            </p>
          )}

          {submitConfirm && (
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1"
              data-testid="contributor-submit-confirmation"
              role="status"
            >
              <p className="text-sm font-medium text-emerald-900">
                {submitConfirm.typeLabel} submitted successfully.
              </p>
              <p className="text-xs text-emerald-800">
                {new Date(submitConfirm.submittedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {' · '}Awaiting owner review
              </p>
              <p className="text-sm text-emerald-900">
                Submission ID: <span className="font-mono font-semibold">{submitConfirm.publicId}</span>
              </p>
              {submitConfirm.already && (
                <p className="text-xs text-emerald-700">Already submitted (idempotent retry).</p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2" data-testid="contributor-activity-log">
            <h4 className="text-sm font-medium text-slate-800">Upload Activity</h4>
            <p className="text-xs text-slate-500">Technical transfer history — not the same as owner Review.</p>
            {activityLog.length === 0 ? (
              <p className="text-sm text-slate-600">No uploads yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                {activityLog.map((row) => (
                  <li key={row.id} className="px-3 py-2.5 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{row.title}</div>
                      <div className="text-xs text-slate-500">
                        {row.kind}
                        {row.at
                          ? ` · ${new Date(row.at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}`
                          : ''}
                      </div>
                    </div>
                    <div className="text-xs font-medium text-slate-700 shrink-0">{row.status}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div data-testid="contributor-my-shots-list" className="space-y-2">
            <h4 className="text-sm font-medium text-slate-800">Uploaded files</h4>
            {myShots.length === 0 ? (
              <p className="text-sm text-slate-600">No self-uploads yet.</p>
            ) : (
              <ul className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {myShots.map((a) => {
                  const thumb = thumbUrls[a.id];
                  const privacy = PRIVACY_LABELS[a.privacy_status] || a.privacy_status;
                  const ready = readyAssetIds.includes(a.id);
                  return (
                    <li key={a.id} className="rounded-md border overflow-hidden text-sm flex flex-col">
                      <div className="aspect-square bg-slate-100 relative">
                        {thumb ? (
                          a.media_kind === 'video' ? (
                            <video src={thumb} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
                          ) : (
                            <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          )
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 px-2 text-center">
                            Preview preparing
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-[11px] text-slate-600">
                          {ready ? 'Ready to submit' : a.processing_status || 'Uploaded'} · {privacy}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{a.original_filename}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3" data-testid="contributor-my-submissions">
        <h3 className="font-medium text-slate-900">My Submissions</h3>
        <p className="text-xs text-slate-500">Business review state — same Submission ID across revisions.</p>
        {mySubmissions.length === 0 && projects.length === 0 && (
          <p className="text-sm text-slate-600">No submissions yet.</p>
        )}
        {mySubmissions.map((s) => {
          const typeBadge = SUBMISSION_TYPES.find((t) => t.id === s.submission_type)?.badge || s.submission_type;
          return (
            <div key={s.id} className="rounded-xl border bg-white p-4 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold tracking-wide rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                  {typeBadge}
                </span>
                <span className="font-mono text-xs text-slate-600">{s.public_id}</span>
              </div>
              <div className="font-medium text-slate-900">{s.title || 'Untitled'}</div>
              <div className="text-sm text-slate-600">
                {SUBMISSION_REVIEW_LABELS[s.review_status] || s.review_status}
                {s.submitted_at
                  ? ` · ${new Date(s.submitted_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}`
                  : ''}
                {` · v${s.latest_version_number || 1}`}
              </div>
              {s.context_kind && s.context_kind !== 'general' && (
                <div className="text-xs text-slate-500">
                  Context: {s.context_kind}
                  {s.context_label ? ` · ${s.context_label}` : ''}
                </div>
              )}
            </div>
          );
        })}
        {projects.map((p) => {
          const versions = (p.mil_reel_versions || []).sort((a, b) => b.version_number - a.version_number);
          const latest = versions[0];
          const alreadyListed = mySubmissions.some((s) => s.reel_project_id === p.id);
          if (alreadyListed) {
            return latest?.status === 'creator_draft' ? (
              <div key={`draft-actions-${p.id}`} className="rounded-xl border bg-white p-4 space-y-2">
                <div className="font-medium">{p.title}</div>
                <div className="text-sm text-slate-600">Draft reel — not yet submitted</div>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm min-h-[44px]"
                  onClick={async () => {
                    try {
                      await submitReelVersion(latest.id);
                      setSubmitConfirm({
                        publicId: '(see My Submissions)',
                        submittedAt: new Date().toISOString(),
                        typeLabel: 'Reel',
                      });
                      setMessage(null);
                      await load();
                    } catch (err) {
                      setError(err.message || 'Submit failed');
                    }
                  }}
                >
                  Submit for Review
                </button>
              </div>
            ) : null;
          }
          return (
            <div key={p.id} className="rounded-xl border bg-white p-4 space-y-2">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-slate-600">Status: {p.status}</div>
              {latest && (
                <div className="text-sm text-slate-700">
                  Current version v{latest.version_number}: {latest.status}
                  {latest.review_notes ? ` · Feedback: ${latest.review_notes}` : ''}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {latest?.status === 'creator_draft' && (
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm min-h-[44px]"
                    onClick={async () => {
                      try {
                        await submitReelVersion(latest.id);
                        setMessage(null);
                        setSubmitConfirm({
                          publicId: '(refreshing…)',
                          submittedAt: new Date().toISOString(),
                          typeLabel: 'Reel',
                        });
                        await load();
                        const { data: auth } = await supabase.auth.getUser();
                        if (auth?.user?.id) {
                          const subs = await listSubmissions({
                            contributorUserId: auth.user.id,
                            includeDrafts: true,
                            limit: 40,
                          });
                          const match = (subs || []).find((s) => s.reel_project_id === p.id);
                          if (match?.public_id) {
                            setSubmitConfirm({
                              publicId: match.public_id,
                              submittedAt: match.submitted_at || new Date().toISOString(),
                              typeLabel: 'Reel',
                            });
                          }
                        }
                      } catch (err) {
                        setError(err.message || 'Submit failed');
                      }
                    }}
                  >
                    Submit for Review
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
