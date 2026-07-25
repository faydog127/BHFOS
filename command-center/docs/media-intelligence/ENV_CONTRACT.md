# Media Intelligence — Environment Variable Contract

Never place these values in the browser bundle, client source, logs, repository, or database rows.

| Variable | Where | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Supabase Edge secrets | Vision/analysis for `media-intel-analyze` |
| `MIL_OPENAI_MODEL` | Optional edge secret | Defaults to `gpt-4o-mini` |
| `SUPABASE_URL` | Edge runtime (provided) | Storage + DB |
| `SUPABASE_ANON_KEY` | Edge runtime (provided) | User JWT validation |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge runtime (provided) | Private original download / website promote writes |
| `VITE_SUPABASE_URL` | Frontend env | Public project URL for TUS + API |
| `VITE_SUPABASE_ANON_KEY` | Frontend env | Authenticated client only |

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
