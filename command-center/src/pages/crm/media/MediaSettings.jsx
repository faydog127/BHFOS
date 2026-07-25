import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import QRCode from 'qrcode';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';
import { supabase } from '@/lib/customSupabaseClient';
import { getAiConfigState, listAssets, audit } from '@/lib/mediaIntel/api';
import { UPLOAD_PHONE_NOTICE } from '@/lib/mediaIntel/constants';

export default function MediaSettings() {
  const { caps } = useOutletContext();
  const [ai, setAi] = useState(null);
  const [promoteAssetId, setPromoteAssetId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [creatorEmail, setCreatorEmail] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionLabel, setSessionLabel] = useState('Phone dump');
  const [createdSession, setCreatedSession] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

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
    }
  };

  useEffect(() => {
    getAiConfigState().then(setAi);
    if (caps.canPromoteWebsite) {
      listAssets({ humanReviewStatus: 'verified', privacyStatus: 'clear', archived: false, limit: 50 })
        .then(setCandidates)
        .catch((err) => setError(err.message));
    }
    refreshAccess().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps.canPromoteWebsite, caps.canManageCreatorAccess]);

  const promote = async () => {
    if (!caps.canPromoteWebsite || !promoteAssetId) return;
    setError(null);
    setMessage(null);
    const { data, error: err } = await supabase.functions.invoke('media-intel-promote-website', {
      body: { assetId: promoteAssetId },
    });
    if (err || data?.error) {
      setError(err?.message || data?.error || 'Promotion failed');
      return;
    }
    await audit('website_promotion', 'mil_assets', promoteAssetId, { websiteMediaId: data?.websiteMediaId });
    setMessage('Public derivative promoted to website-public-media. Private original unchanged.');
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
    const absolute = `${window.location.origin}${data.path}`;
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
              <p className="text-xs break-all text-slate-700">{`${window.location.origin}${createdSession.path}`}</p>
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
            <span className="font-medium">Creator email (invite documentation)</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 min-h-[44px]"
              value={creatorEmail}
              onChange={(e) => setCreatorEmail(e.target.value)}
              placeholder="creator@example.com"
            />
          </label>
          <pre className="text-xs bg-slate-50 border rounded-md p-3 overflow-x-auto">{`-- 1) Invite/create Auth user in Supabase (individual account)
-- 2) Grant creator role (revocable):
insert into app_user_roles (user_id, role)
select id, 'reel_creator'
from auth.users where email = '${creatorEmail || 'creator@example.com'}';
-- If legacy app_user_roles.tenant_id is NOT NULL, add tenant_id with DEFAULT or:
-- insert into app_user_roles (tenant_id, user_id, role)
-- select '${DEFAULT_TENANT_ID}', id, 'reel_creator' from auth.users where email = '...';
-- (tenant_id is legacy V1 CRM column — not MIL product tenancy)
-- 3) Creator signs in at /${DEFAULT_TENANT_ID}/login (legacy V1) then lands on /creator`}</pre>
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
                  onClick={async () => {
                    const { error: err } = await supabase.rpc('mil_revoke_creator_assignment', {
                      p_assignment_id: a.id,
                    });
                    if (err) setError(err.message);
                    else {
                      setMessage('Creator assignment revoked. New signed links will fail.');
                      await refreshAccess();
                    }
                  }}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {caps.canPromoteWebsite && (
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <h3 className="font-medium">Promote to website media</h3>
          <p className="text-sm text-slate-600">
            Explicit owner action only. Creates a privacy-stripped derivative in <code>website-public-media</code> and a <code>website_media</code> row. The website never reads private intake originals.
          </p>
          <select
            className="w-full rounded-md border px-3 py-2 min-h-[44px]"
            value={promoteAssetId}
            onChange={(e) => setPromoteAssetId(e.target.value)}
          >
            <option value="">Select verified, privacy-clear asset…</option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>{a.original_filename}</option>
            ))}
          </select>
          <button type="button" className="rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm min-h-[44px]" onClick={promote}>
            Promote public derivative
          </button>
        </section>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
