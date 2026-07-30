# Media Intelligence — Upload Reconcile Operator Runbook

How operators run `media-intel-upload-reconcile` by hand. This slice does **not**
attach a cron or Supabase scheduler. Enabling a schedule is a separate decision
and requires **Founder authorization**.

Related: [`ENV_CONTRACT.md`](./ENV_CONTRACT.md) (`MIL_RECONCILE_KEY`),
[`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

## What stranded uploads look like

Phone (and desktop session) uploads can finish writing quarantine bytes and still
fail to prove the final library object. The upload session answers honestly with
HTTP **202** and status **`pending_reconcile`**.

| Signal | Meaning |
|---|---|
| Client / Transfer Uploads status `pending_reconcile` | File is **not** in the library. Keep the phone/original copy. |
| Grant `finalize_state` in `minted` / `placing` / `placed` | Still open for reconcile (or abandon after deadline). |
| Row in `mil_integrity_alerts` with `acknowledged_at` null | Server recorded an integrity concern (owner/admin can SELECT). |
| Manifest success counts unchanged | Counts come from grant state, not the browser — pending files stay out of "In library". |

Reconcile never invents success: storage must confirm the final object, or after
the deadline the grant is failed/abandoned.

### When reconcile already runs without an operator

`media-intel-upload-session` may call reconcile **edge-to-edge** for a single
grant during an indeterminate finalize (it reads `MIL_RECONCILE_KEY` only inside
the edge runtime). If that key is unset, the phone still gets `pending_reconcile`
and the grant stays stranded until an operator runs this function.

There is **no** CRM "Reconcile now" button. Putting `MIL_RECONCILE_KEY` in Vite
env, the browser bundle, or client source is forbidden. Prefer this runbook over
a fake UI control.

## Prerequisites

1. Edge functions `media-intel-upload-reconcile` (and upload-session, if testing
   the inline path) are deployed to the target project.
2. `MIL_RECONCILE_KEY` is set as a **Supabase Edge secret** for that project
   (generate ≥32 bytes of entropy; rotate independently of the service role key).
3. You have a project JWT for `Authorization: Bearer …` (`verify_jwt = true`):
   - a logged-in staff **access token**, or
   - the project **service role** JWT for break-glass ops (treat like a root secret;
     do not paste into chat logs or tickets).
4. You will send the reconcile secret only in the `x-mil-reconcile-key` header —
   never in query strings, client code, or committed files.

If `MIL_RECONCILE_KEY` is unset, every action returns **503**
`code: not_configured`. A wrong key returns **503** `code: not_available`
(same shape; do not probe).

## Scheduler policy (explicit)

| Fact | Standing |
|---|---|
| Cron / `pg_cron` / Supabase scheduled function for reconcile | **Not configured** in this slice |
| Who may activate a schedule | **Founder authorization required** (staging first) |
| Until a schedule exists | Stranded grants stay pending until inline finalize invoke or this manual run |

Do not add a schedule from this runbook.

## Invoke pattern

Replace placeholders. Prefer exporting secrets in a local shell session; do not
commit them.

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_JWT="<access_token_or_service_role_jwt>"
export MIL_RECONCILE_KEY="<edge-secret-value>"

# health — counts only; safe to run first
curl -sS -X POST "$SUPABASE_URL/functions/v1/media-intel-upload-reconcile" \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -H "x-mil-reconcile-key: $MIL_RECONCILE_KEY" \
  -d '{"action":"health"}'
```

Expected `health` fields (among others):

- `configured: true`
- `scheduler: "none — invocation is explicit in this slice"`
- `pendingGrants` — open finalize states
- `openIntegrityAlerts` — unacknowledged `mil_integrity_alerts`
- `quarantineCleanupDue` — committed/duplicate grants whose quarantine delete is due

### Run a batch (`action=run`)

Finishes or fails what storage can prove, abandons expired grants, then sweeps
quarantine bytes only for grants already `committed` / `duplicate` after the
cleanup deadline (failed/abandoned quarantine bytes are **kept**).

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/media-intel-upload-reconcile" \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -H "x-mil-reconcile-key: $MIL_RECONCILE_KEY" \
  -d '{"action":"run","limit":25,"abandonLimit":200,"cleanupLimit":50}'
```

Optional body ints (bounded server-side): `limit` (default 25, max 200),
`abandonLimit` (default 200), `cleanupLimit` (default 50, max 500).

### Single grant (`action=grant`)

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/media-intel-upload-reconcile" \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -H "x-mil-reconcile-key: $MIL_RECONCILE_KEY" \
  -d '{"action":"grant","grantId":"<mil_upload_grants.id>"}'
```

### Supabase CLI equivalent

```bash
supabase functions invoke media-intel-upload-reconcile \
  --project-ref <project-ref> \
  --headers "x-mil-reconcile-key=$MIL_RECONCILE_KEY" \
  --body '{"action":"health"}'
```

Ensure the CLI session supplies a JWT the gateway accepts (`verify_jwt = true`).

## After a run

1. Re-check Transfer Uploads / batch manifest — pending files should move to
   library, duplicate, failed, or abandoned; never silently "success" without
   catalog proof.
2. Owner/admin: `select * from mil_integrity_alerts where acknowledged_at is null
   order by created_at desc;` (SELECT-only for clients).
3. Re-run `health` until `pendingGrants` and due cleanup match expectations.
4. Remind the field team: phone originals stay until the transfer is confirmed
   in the library (or an independent backup exists).

## Integrity alerts

`mil_integrity_alerts` is written by server paths when finalization cannot be
proven cleanly. Owner/admin may read open rows; clients cannot insert/update/
delete. Alerts are a visibility channel — they do not replace running
`action=run` or fixing storage/config.

## Security checklist

- [ ] `MIL_RECONCILE_KEY` exists only in edge secrets (and operator secret store)
- [ ] Not in `VITE_*`, `.env` committed to git, CRM source, or browser DevTools
- [ ] No CRM button that calls reconcile with the key
- [ ] No scheduler enabled without Founder auth
- [ ] Curl history / ticket paste scrubbed of the key and service role JWT
