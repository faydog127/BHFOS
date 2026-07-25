# Media Intelligence Library — Implementation Status

**Branch:** `feat/media-intelligence-library`  
**Baseline:** `9369d206bfbcaf32267e9e88518b222146e11de8`  
**Architecture:** Single-company (see `SINGLE_COMPANY_CORRECTION.md`)  
**Working tree:** correction implementation — no migration apply / no edge deploy / no merge / no prod

## Delivered in this slice

- Phase 0 plan + risk assessment + single-company correction
- Schema migrations (unapplied, rewritten): `mil_*` tables **without** `tenant_id`, role helpers via `auth.uid()`, RLS, private buckets under `mil/…`, marketing-use gates
- Product routes: `/media/*`, `/media/upload`, `/creator/*` (+ temporary `/crm/media/*` → `/media/*`)
- Session auth via `MediaSessionGuard` (not CRM `TenantGuard`)
- Resumable TUS upload + checksum exact de-dupe + transfer manifests + IndexedDB session recovery
- Grid thumbnail derivatives (JPEG) without touching originals
- AI edge adapter (`media-intel-analyze`) with no-key honest fallback; suggestions never auto-verify
- Review queue with accept/edit/verify and reanalyze-without-overwrite contract
- Collections, before/after confirmation, creator workspace, reel versioning, optional denial notes, approved-to-post
- Explicit website promote edge function (gates only; no social publish)
- Upload sessions + signed media edge (`media-intel-sign`)
- Backup/export/rollback + env contract docs
- Unit/contract + security authorization tests (`npm run test:media-intel-helpers`)
- Security repair: assignment-only creator access, no broad reel storage SELECT, grant-bound upload completion, public_safe EXIF-stripped promote, technicians excluded from library staff

## Access surfaces

| Surface | Route |
|---|---|
| Owner / staff library | `/media/*` |
| Phone upload | `/media/upload` (+ `?session=` scoped token) |
| Creator portal | `/creator/*` (no CRM chrome) |
| Temporary CRM alias | `/crm/media/*` → `/media/*` |

See `ACCESS_ARCHITECTURE.md`.

## Remaining for full Definition of Done (requires separate authorization)

1. Apply migrations + deploy edge functions to an authorized staging Supabase project
2. End-to-end runs of acceptance scenarios with evidence
3. Near-duplicate perceptual similarity (beyond exact checksum)
4. HEIC preview conversion worker; video thumbs/transcripts/key moments
5. Accessibility + responsive screenshot suite
6. Large synthetic library performance harness
7. RLS/storage integration tests against live staging
8. Owner authorization before any CRM staging deploy / merge

## Explicit non-goals (confirmed not built)

Social connections, scheduling, automatic publishing, facial recognition, phone deletion, destructive de-dupe, production deploy, vent-guys.com changes, new domains/subdomains, multi-tenant MIL product architecture, artificial organization/account/company/workspace ownership entities for MIL.
