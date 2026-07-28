import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/lib/customSupabaseClient';
import { getAiConfigState, listAssets, unpublishWebsiteMedia } from '@/lib/mediaIntel/api';
import { UPLOAD_PHONE_NOTICE } from '@/lib/mediaIntel/constants';

const CREATOR_ADMIN_UNAVAILABLE_MESSAGE =
  'Creator invite/roster requires deployed media-intel-creator-admin — not available until staging deploy.';

const PROMOTE_DISABLED_COPY =
  'Website promotion is paused pending a proven, end-to-end-validated public-safe transform pipeline (EXIF/metadata strip + derivative verification). Promotion must never copy a private original — see mil_website_promotions table comment for the current gate.';

/** Throws with `.edgeUnavailable = true` when the edge function itself cannot be reached. */
async function invokeCreatorAdmin(body) {
  const { data, error } = await supabase.functions.invoke('media-intel-creator-admin', { body });
  if (error || data?.error) {
    const message = error?.message || data?.error || 'media-intel-creator-admin unavailable';
    const err = new Error(message);
    err.edgeUnavailable = true;
    throw err;
  }
  return data;
}

export default function MediaSettings() {
  const { caps } = useOutletContext();
  const [ai, setAi] = useState(null);
  const [promoteAssetId, setPromoteAssetId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [unpublishAssetId, setUnpublishAssetId] = useState('');
  const [unpublishing, setUnpublishing] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [creatorEmail, setCreatorEmail] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [roster, setRoster] = useState([]);
  const [rosterUnavailable, setRosterUnavailable] = useState(false);
  const [assignCreatorId, setAssignCreatorId] = useState('');
  const [assignAssetId, setAssignAssetId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionLabel, setSessionLabel] = useState('Phone dump');
  const [createdSession, setCreatedSession] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const refreshRoster = async () => {
    try {
      const data = await invokeCreatorAdmin({ action: 'list_creators' });
      setRoster(data?.creators || []);
      setRosterUnavailable(false);
    } catch {
      setRosterUnavailable(true);
    }
  };

  const refreshAccess = async () => {
    if (caps.canManageCreatorAccess) {
      const { data } = await supabase
        .from('mil_creator_assignments')
        .select('id, creator_user_id, asset_id, collection_id, status, created_at, notes')
        .order('created_at', { ascending: false })
        .limit(40);
      setAssignments(data || []);

      const { data: sess } = await supabase.functions.invoke('media-intel-upload-session', {
        body: { action: 'list' },
      });
      setSessions(sess?.sessions || []);

      await refreshRoster();
    }
  };

  const refreshPromotions = async () => {
    const { data, error: promoErr } = await supabase
      .from('mil_website_promotions')
      .select('id, asset_id, website_media_id, promoted_at, notes, mil_assets(id, original_filename)')
      .order('promoted_at', { ascending: false })
      .limit(50);
    if (promoErr) throw promoErr;
    setPromotions(data || []);
  };

  useEffect(() => {
    getAiConfigState().then(setAi);
    if (caps.canPromoteWebsite) {
      listAssets({ humanReviewStatus: 'verified', privacyStatus: 'clear', archived: false, trashed: false, limit: 50 })
        .then(setCandidates)
        .catch((err) => setError(err.message));
      refreshPromotions().catch((err) => setError(err.message));
    }
    refreshAccess().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps.canPromoteWebsite, caps.canManageCreatorAccess]);

  const handleUnpublish = async (assetId) => {
    setError(null);
    setMessage(null);
    const id = (assetId || unpublishAssetId || '').trim();
    if (!id) {
      setError('Select a promoted asset to unpublish.');
      return;
    }
    setUnpublishing(true);
    try {
      const result = await unpublishWebsiteMedia(id);
      const count = Array.isArray(result?.results) ? result.results.length : 0;
      setMessage(
        count
          ? `Unpublished website promotion for asset ${id.slice(0, 8)}… (${count} record${count === 1 ? '' : 's'}).`
          : `Unpublished website promotion for asset ${id.slice(0, 8)}…`,
      );
      setUnpublishAssetId('');
      await refreshPromotions();
    } catch (err) {
      setError(err.message || 'Website unpublish failed');
    } finally {
      setUnpublishing(false);
    }
  };

  const inviteCreator = async () => {
    setError(null);
    setMessage(null);
    const email = creatorEmail.trim();
    if (!email) {
      setError('Enter a creator email first.');
      return;
    }
    try {
      const data = await invokeCreatorAdmin({ action: 'invite_creator', email });
      setMessage(
        data?.invited
          ? `Invite sent to ${email} (new account). Confirm actual delivery in Supabase Auth — this app does not track email delivery.`
          : `${email} already had an account — granted the reel_creator role directly (no new invite email).`,
      );
      setCreatorEmail('');
      await refreshRoster();
    } catch (err) {
      setError(err.edgeUnavailable ? CREATOR_ADMIN_UNAVAILABLE_MESSAGE : err.message);
    }
  };

  const assignCreator = async () => {
    setError(null);
    setMessage(null);
    const creatorUserId = assignCreatorId.trim();
    const assetId = assignAssetId.trim();
    if (!creatorUserId || !assetId) {
      setError('Creator user ID and asset ID are both required to assign.');
      return;
    }
    try {
      await invokeCreatorAdmin({ action: 'assign', creatorUserId, assetId, collectionId: null, notes: null });
      setMessage('Creator assignment created.');
      setAssignCreatorId('');
      setAssignAssetId('');
      await refreshAccess();
    } catch (err) {
      if (!err.edgeUnavailable) {
        setError(err.message);
        return;
      }
      // Edge not deployed yet — mil_assign_creator RPC already exists server-side
      // and enforces the same owner/admin-only check, so use it directly rather
      // than blocking a working capability on an undeployed edge function.
      const { error: rpcErr } = await supabase.rpc('mil_assign_creator', {
        p_creator_user_id: creatorUserId,
        p_asset_id: assetId,
        p_collection_id: null,
        p_notes: null,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setMessage('Creator assignment created via mil_assign_creator (media-intel-creator-admin not yet deployed).');
      setAssignCreatorId('');
      setAssignAssetId('');
      await refreshAccess();
    }
  };

  const revokeAssignment = async (assignmentId) => {
    setError(null);
    setMessage(null);
    try {
      await invokeCreatorAdmin({ action: 'revoke_assignment', assignmentId });
      setMessage('Creator assignment revoked. New signed links will fail.');
      await refreshAccess();
    } catch (err) {
      if (!err.edgeUnavailable) {
        setError(err.message);
        return;
      }
      const { error: rpcErr } = await supabase.rpc('mil_revoke_creator_assignment', {
        p_assignment_id: assignmentId,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setMessage('Creator assignment revoked via mil_revoke_creator_assignment (media-intel-creator-admin not yet deployed).');
      await refreshAccess();
    }
  };

  const createUploadSession = async () => {
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('media-intel-upload-session', {
      body: { action: 'create', label: sessionLabel, expiresHours: 12 },
    });
    if (err || data?.error) {
      setError(err?.message || data?.error || 'Could not create upload session');
      return;
    }
    setCreatedSession(data);
    // Fragment form: the token never travels in the query string (server logs,
    // browser history, and Referer headers can all leak query params but browsers
    // never send the URL fragment in a request).
    const absolute = `${window.location.origin}/media/upload#session=${encodeURIComponent(data.token)}`;
    const url = await QRCode.toDataURL(absolute, { margin: 1, width: 240 });
    setQrDataUrl(url);
    setMessage('Upload session created. Scan from the phone. Link is upload-only and expires.');
    await refreshAccess();
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="media-settings">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Media settings</h2>
        <p className="text-sm text-slate-600">Authorized media configuration only. No social platform connections. No new domains.</p>
      </div>

      <section className="rounded-xl border bg-white p-4 space-y-2">
        <h3 className="font-medium">AI analysis</h3>
        <p className="text-sm text-slate-700">{ai?.message || 'Checking…'}</p>
        <p className="text-xs text-slate-500">
          Server env: <code>OPENAI_API_KEY</code> (edge). Never place keys in the browser, repo, or database.
        </p>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-2">
        <h3 className="font-medium">Transfer policy</h3>
        <p className="text-sm text-slate-700">{UPLOAD_PHONE_NOTICE}</p>
      </section>

      {caps.isOwnerAdmin && (
        <section
          className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2"
          data-testid="reconcile-operator-settings"
        >
          <h3 className="font-medium text-slate-900">Upload reconciliation</h3>
          <p className="text-sm text-slate-700">
            Files stuck as <code className="text-xs">pending_reconcile</code> are not in the library.
            They stay that way until finalize invokes reconcile edge-to-edge, or an operator runs{' '}
            <code className="text-xs">media-intel-upload-reconcile</code> (
            <code className="text-xs">health</code> / <code className="text-xs">run</code> /{' '}
            <code className="text-xs">grant</code>) with a project JWT and the edge secret{' '}
            <code className="text-xs">MIL_RECONCILE_KEY</code>. Open integrity concerns appear in{' '}
            <code className="text-xs">mil_integrity_alerts</code> (read-only here).
          </p>
          <p className="text-sm text-slate-700">
            Runbook:{' '}
            <code className="text-xs">docs/media-intelligence/RECONCILE_OPERATOR.md</code>. No
            schedule is configured; Founder authorization is required to activate a scheduler. This
            UI does not call reconcile — the key must never enter Vite env or the browser bundle.
          </p>
        </section>
      )}

      {caps.canManageCreatorAccess && (
        <section className="rounded-xl border bg-white p-4 space-y-3" data-testid="upload-session-manager">
          <h3 className="font-medium">Phone upload session (QR)</h3>
          <p className="text-sm text-slate-600">
            Creates a short-lived, revocable, upload-only link. It cannot browse the library, download existing files, or access CRM.
          </p>
          <label className="block text-sm">
            <span className="font-medium">Session label</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm min-h-[44px]"
            onClick={createUploadSession}
          >
            Generate phone upload QR
          </button>
          {createdSession && (
            <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
              {qrDataUrl && <img src={qrDataUrl} alt="QR code for phone upload session" className="mx-auto" />}
              <p className="text-xs break-all text-slate-700">
                {`${window.location.origin}/media/upload#session=${encodeURIComponent(createdSession.token)}`}
              </p>
              <p className="text-xs text-slate-500">Expires {new Date(createdSession.expiresAt).toLocaleString()}</p>
              <button
                type="button"
                className="text-sm text-red-700 underline"
                onClick={async () => {
                  await supabase.functions.invoke('media-intel-upload-session', {
                    body: { action: 'revoke', sessionId: createdSession.sessionId },
                  });
                  setCreatedSession(null);
                  setQrDataUrl(null);
                  setMessage('Upload session revoked.');
                  await refreshAccess();
                }}
              >
                Revoke this session
              </button>
            </div>
          )}
          <ul className="text-xs text-slate-600 space-y-1">
            {sessions.slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between gap-2 border-t py-2">
                <span className="truncate">{s.label || s.id.slice(0, 8)} · {s.revoked_at ? 'revoked' : 'active'}</span>
                {!s.revoked_at && (
                  <button
                    type="button"
                    className="text-red-700 underline shrink-0"
                    onClick={async () => {
                      await supabase.functions.invoke('media-intel-upload-session', {
                        body: { action: 'revoke', sessionId: s.id },
                      });
                      await refreshAccess();
                    }}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {caps.canManageCreatorAccess && (
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <h3 className="font-medium">Creator access</h3>
          <p className="text-sm text-slate-600">
            Individual Supabase accounts only — no shared passwords. Role <code>reel_creator</code> enters <code>/creator</code> (focused portal, not CRM).
          </p>

          <label className="block text-sm">
            <span className="font-medium">Invite creator by email</span>
            <div className="mt-1 flex gap-2">
              <input
                className="flex-1 rounded-md border px-3 py-2 min-h-[44px]"
                value={creatorEmail}
                onChange={(e) => setCreatorEmail(e.target.value)}
                placeholder="creator@example.com"
              />
              <button type="button" className="rounded-md border px-4 py-2 text-sm min-h-[44px]" onClick={inviteCreator}>
                Send invite
              </button>
            </div>
          </label>
          {rosterUnavailable && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {CREATOR_ADMIN_UNAVAILABLE_MESSAGE} Grant <code>app_user_roles.role = 'reel_creator'</code> manually via
              Supabase Studio in the meantime — this UI will not fabricate a delivery confirmation it cannot verify.
            </p>
          )}
          {!rosterUnavailable && roster.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1">
              {roster.map((r) => (
                <li key={r.user_id} className="flex justify-between gap-2 border-t py-2">
                  <span className="truncate">{r.email || r.user_id}</span>
                  <span className="shrink-0 text-slate-500">{r.role}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2 border-t space-y-2">
            <h4 className="text-sm font-medium">Assign creator to an asset</h4>
            <p className="text-xs text-slate-500">
              Global reel-creation approval alone never grants visibility — assignment is per-asset (or per-collection) and required.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                className="rounded-md border px-3 py-2 min-h-[44px] text-sm"
                value={assignCreatorId}
                onChange={(e) => setAssignCreatorId(e.target.value)}
                placeholder="Creator user ID (uuid)"
              />
              <input
                className="rounded-md border px-3 py-2 min-h-[44px] text-sm"
                value={assignAssetId}
                onChange={(e) => setAssignAssetId(e.target.value)}
                placeholder="Asset ID (uuid)"
              />
            </div>
            <button type="button" className="rounded-md border px-4 py-2 text-sm min-h-[44px]" onClick={assignCreator}>
              Assign
            </button>
          </div>

          <h4 className="text-sm font-medium pt-2">Active assignments</h4>
          <ul className="space-y-2 text-sm">
            {assignments.filter((a) => a.status === 'active').length === 0 && (
              <li className="text-slate-500">No active assignments.</li>
            )}
            {assignments.filter((a) => a.status === 'active').map((a) => (
              <li key={a.id} className="flex justify-between gap-2 border rounded-md px-3 py-2">
                <span className="truncate text-xs">
                  {a.asset_id ? `Asset ${a.asset_id.slice(0, 8)}…` : `Collection ${a.collection_id?.slice(0, 8)}…`}
                </span>
                <button
                  type="button"
                  className="text-red-700 text-xs underline"
                  onClick={() => revokeAssignment(a.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {caps.canPromoteWebsite && (
        <section className="rounded-xl border bg-white p-4 space-y-3" data-testid="website-media-settings">
          <h3 className="font-medium">Website media</h3>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>Promote disabled.</strong> {PROMOTE_DISABLED_COPY}
          </div>
          <select
            className="w-full rounded-md border px-3 py-2 min-h-[44px] disabled:opacity-60"
            value={promoteAssetId}
            onChange={(e) => setPromoteAssetId(e.target.value)}
            disabled
            aria-label="Promote asset (disabled)"
          >
            <option value="">Select verified, privacy-clear asset…</option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>{a.original_filename}</option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md bg-slate-300 text-slate-600 px-4 py-2.5 text-sm min-h-[44px] cursor-not-allowed"
            disabled
            title="Disabled pending proven public-safe transform pipeline"
          >
            Promote public derivative (disabled)
          </button>

          <div className="pt-3 border-t space-y-3" data-testid="website-unpublish">
            <h4 className="text-sm font-medium">Unpublish existing promotions</h4>
            <p className="text-sm text-slate-600">
              Owner/admin only. Marks linked <code>website_media</code> unavailable and removes public storage
              objects for every promotion on the selected asset. Promote remains unavailable.
            </p>
            <select
              className="w-full rounded-md border px-3 py-2 min-h-[44px]"
              value={unpublishAssetId}
              onChange={(e) => setUnpublishAssetId(e.target.value)}
              disabled={unpublishing || promotions.length === 0}
              aria-label="Select promoted asset to unpublish"
            >
              <option value="">
                {promotions.length === 0 ? 'No website promotions recorded…' : 'Select promoted asset…'}
              </option>
              {[...new Map(promotions.map((p) => [p.asset_id, p])).values()].map((p) => {
                const name = p.mil_assets?.original_filename || `Asset ${p.asset_id.slice(0, 8)}…`;
                const when = p.promoted_at ? new Date(p.promoted_at).toLocaleString() : 'unknown date';
                return (
                  <option key={p.asset_id} value={p.asset_id}>
                    {name} · {when}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="rounded-md bg-red-700 text-white px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={unpublishing || !unpublishAssetId}
              onClick={() => handleUnpublish(unpublishAssetId)}
            >
              {unpublishing ? 'Unpublishing…' : 'Unpublish from website'}
            </button>
            <ul className="text-xs text-slate-600 space-y-1">
              {promotions.length === 0 && (
                <li className="text-slate-500">No rows in <code>mil_website_promotions</code>.</li>
              )}
              {promotions.slice(0, 12).map((p) => (
                <li key={p.id} className="flex justify-between gap-2 border-t py-2">
                  <span className="truncate">
                    {p.mil_assets?.original_filename || p.asset_id.slice(0, 8)}
                    {p.website_media_id ? ` · media ${p.website_media_id.slice(0, 8)}…` : ''}
                    {' · '}
                    {p.promoted_at ? new Date(p.promoted_at).toLocaleString() : '—'}
                  </span>
                  <button
                    type="button"
                    className="text-red-700 underline shrink-0 disabled:opacity-50"
                    disabled={unpublishing}
                    onClick={() => {
                      setUnpublishAssetId(p.asset_id);
                      handleUnpublish(p.asset_id);
                    }}
                  >
                    Unpublish
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
