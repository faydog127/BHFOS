# Media Intelligence — Environment Variable Contract

Never place these values in the browser bundle, client source, logs, repository, or database rows.

| Variable | Where | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Supabase Edge secrets | Vision/analysis for `media-intel-analyze` |
| `MIL_OPENAI_MODEL` | Optional edge secret | Defaults to `gpt-4o-mini` |
| `SUPABASE_URL` | Edge runtime (provided) | Storage + DB |
| `SUPABASE_ANON_KEY` | Edge runtime (provided) | User JWT validation |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge runtime (provided) | Private original download / website promote writes |
| `MIL_RECONCILE_KEY` | Supabase Edge secret (required for `media-intel-upload-reconcile`) | Shared secret that authorizes reconciliation runs |
| `MIL_MAX_UPLOAD_BYTES` | Optional edge secret | Per-file ceiling for `media-intel-upload-session`; defaults to 250 MB |
| `VITE_SUPABASE_URL` | Frontend env | Public project URL for TUS + API |
| `VITE_SUPABASE_ANON_KEY` | Frontend env | Authenticated client only |

## `MIL_RECONCILE_KEY`

`media-intel-upload-reconcile` finishes or fails upload grants that were stranded
between "bytes are in storage" and "the row exists in the library", and deletes
quarantine bytes whose grant is already safely committed or deduplicated. Those
are destructive-adjacent operations, so the function refuses to do anything
without proof of authorization:

- The function is deployed with `verify_jwt = true`, so a valid project JWT is
  required before the handler runs at all.
- The caller must additionally send `x-mil-reconcile-key` matching
  `MIL_RECONCILE_KEY`. The comparison is length-and-position independent.
- If `MIL_RECONCILE_KEY` is **not set**, the function returns **503** for every
  action, including `health`. It does not fall back to "no key required". An
  unconfigured reconciler is a visible outage, not a silent open door.
- `media-intel-upload-session` also reads `MIL_RECONCILE_KEY` so it can hand an
  indeterminate finalize straight to the reconciler. Without the secret it logs
  the miss and still answers the phone honestly with `pending_reconcile` — it
  never reports the upload as complete.

Generate a value with at least 32 bytes of entropy, set it as an edge secret in
each environment separately, and rotate it independently of anything else. It is
not a fallback for the service role key and must never reach the browser bundle.

### Scheduler

No schedule is configured by this change. Until an environment explicitly
schedules `action=run` (staging first), reconciliation only happens when
`media-intel-upload-session` invokes it during a failed finalize, or when an
operator calls it by hand. Stranded grants in an unscheduled environment stay
stranded and visible in `mil_integrity_alerts` rather than being silently
resolved.

## Behavior without `OPENAI_API_KEY`

- Uploads, manifests, previews, manual tagging, review, collections, creator access, and reel review continue to work.
- `media-intel-analyze` `action=config_status` reports `configured: false` with an honest message.
- Analysis jobs record `skipped_no_key` — no fabricated suggestion payloads.

## Buckets

| Bucket | Public | Role |
|---|---|---|
| `media-intel-originals` | No | Immutable private intake |
| `media-intel-derivatives` | No | Previews, creator downloads, reel versions |
| `website-public-media` | Yes (read) | Publication end only via explicit promote |
| `inspection-photos` / `inspection-reports` | No | Untouched |
