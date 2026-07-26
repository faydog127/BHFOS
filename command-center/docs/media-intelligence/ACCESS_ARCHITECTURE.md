# Media Library — Access Architecture

**Branch:** `feat/media-intelligence-library`  
**Baseline:** `9369d206bfbcaf32267e9e88518b222146e11de8`  
**App URL (existing):** `https://app.bhfos.com` (authenticated CRM; no new domain)  
**Governing correction:** `SINGLE_COMPANY_CORRECTION.md` — BHFOS is a single-company OS for The Vent Guys.

## Product routes (MIL)

| Audience | Route | Shell |
|---|---|---|
| Owner / staff | `/media/*` | Media library shell (CRM nav link for staff) |
| Mobile upload | `/media/upload` | Upload-only UI; bearer token via **`#session=TOKEN`** (preferred) or legacy `?session=TOKEN` |
| Reel creator | `/creator/*` | Focused creator portal — **no CRM chrome** |
| Public website | existing `website_media` only | No MIL routes |

### Temporary non-tenant alias

- `/crm/media/*` → `/media/*` (also from nested CRM `…/crm/media/*` under the legacy V1 CRM tree)
- **Why:** Historical CRM nesting / bookmarks may use `/crm/media`
- **Auth:** Destination enforces `MediaSessionGuard` + capability guards + RLS; alias grants nothing
- **Loops:** One-way `Navigate replace`; `/media` never redirects to `/crm/media`
- **Removal:** After MIL is sole entry and V1 IA no longer implies `/crm/media`

**Not supported (never deployed; no compatibility aliases):**

- Tenant-prefixed media library trees
- Tenant-prefixed creator portal trees
- Tenant-prefixed CRM-media product routes (nested CRM alias redirects away only)

## Authorization model

```
authenticated identity
→ role (app_user_roles by user_id)
→ capability
→ requested action
→ asset status & permitted use
→ collection / creator assignment
→ derivative type
→ upload-session scope (bearer token — not a library role)
```

Enforced in: session guard, capability guard, RLS, storage policies, edge functions, signed-URL minting.

MIL does **not** require JWT `tenant_id`, route tenant segments, or `tenant_id` columns on `mil_*` tables.

### Role → MIL capability matrix

Legend: **Y** = allowed via RLS/RPC/edge when gates pass · **—** = denied · **S** = scoped bearer session only (no library browse)

| Capability | Admin / Manager | Reviewer (`media_reviewer`) | Office | Creator (`reel_creator`) | Session bearer |
|---|---|---|---|---|---|
| Browse library / derivatives | Y | Y | Y | Assigned only | — |
| Browse private originals | Y | Y | Y | — (assigned previews via sign edge) | — |
| Staff upload (desktop) | Y | Y | Y | — | — |
| Phone / field upload | Y (mint session) | — | — | — | **S** (grant-bound TUS to quarantine) |
| Verify / review writes | Y | Y | **—** (`mil_is_reviewer` excludes office) | — | — |
| Approve / deny reels | Y | — | — | — | — |
| Invite / assign / revoke creators | Y (edge `media-intel-creator-admin`) | — | — | — | — |
| Create / revoke upload sessions | Y | — | — | — | — |
| Website promote | **Disabled (503)** — see below | — | — | — | — |
| Website unpublish | Y | — | — | — | — |
| Creator portal | Inspect only | — | — | Y | — |
| CRM / tech surfaces | Y | Y | Y | — | — |

**Admin and manager** share the owner-admin column (`mil_is_owner_admin()`). Managers are treated as owner/admin for sensitive MIL actions (invite/revoke creators, upload sessions, reel approve; website promote when enabled). **Technician:** **No** MIL library access (CRM/tech routes only) — not a column in the matrix above because technicians never receive MIL capabilities.

**`phone_uploader` is not a product library role.** Legacy rows may exist in `app_user_roles`, but phone dumps are authorized **only** by opaque bearer upload session tokens (`mil_upload_sessions` + `mil_upload_grants`). Do not grant library capabilities to `phone_uploader` in UI or docs.

**Reviewer vs office:** Office may browse and upload (`mil_can_browse_library()`), but reviewer write policies use `mil_is_reviewer()` which is **admin, manager, media_reviewer only** — office cannot write verified metadata, privacy findings, asset tags, or B&A relationships via RLS.

### Session bearer (phone upload)

- Opaque token (hash stored server-side); URL fragment `#session=` preferred so tokens are less likely to leak via referrer logs.
- Each mint creates `mil_upload_grants` binding session, batch, asset ID, exact quarantine path, content type, max bytes (default **250 MB**), expiry.
- `complete_file` re-downloads the quarantine bytes and SHA-256 hashes them on every attempt, then drives the finalization state machine through service_role-only RPCs — **`mil_begin_upload_finalize`** (lease) → placement with `upsert:false` → **`mil_mark_upload_placed`** → **`mil_commit_upload_finalize`**, which proves the final object is visible in the storage catalog inside the committing transaction. The client checksum is advisory only, and an unproven outcome is reported as `pending_reconcile` (202), never as success.
- Upload-only: cannot browse, search, preview library, approve, or promote.

### Creator isolation (role + resource — not tenancy)

Creators must not access CRM, customers/jobs, raw intake, private originals, restricted/unreviewed assets, unassigned work, owner/reviewer actions, rights admin, other creators’ assignments, website promotion, or social publishing.

- `reel_creation` permitted use makes an asset **eligible for assignment**, not globally visible to every creator.
- Access requires an **active** direct assignment or **active** assigned collection (revocation blocks new signed links).
- Creators have **no** broad storage SELECT on `mil/reels/%`. Reel preview/download uses `media-intel-sign` / `media-intel-reel-upload` with project-ownership checks and audit.

### Website promotion (**disabled**)

```
Private original → public_safe derivative (decode/re-encode + strip — NOT IMPLEMENTED)
                → explicit promote copy to website-public-media
```

**Current state:** `media-intel-promote-website` returns **503 `not_implemented`** for `prepare_public_safe` and `promote`. Marker-only EXIF stripping does not prove public safety. **`unpublish`** remains for owner/admin to pull existing public copies.

Promotion never copies private originals directly into the public bucket.

## Discovery notes (legacy V1 coexistence)

| Topic | Finding | MIL decision |
|---|---|---|
| CRM / tech routes | Still `/:tenantId/crm/*`, `/:tenantId/tech/*`, `TenantGuard` | Out of scope; MIL mounts beside them |
| Login | Still `/:tenantId/login` | MIL may deep-link as temporary **L** until `/login` cleanup |
| Roles | `app_user_roles` may still have a legacy `tenant_id` column | MIL role lookup by `user_id` only |
| Inspection storage | JWT tenant folder segments | Untouched (**U**) |

## Governing rules (enforced in source; staging proof pending)

- Not built into public Vent Guys website
- Not a public gallery
- No bucket browsing as access
- Creator is not an unrestricted CRM account
- No native app required
- No new domain in this assignment
- Hidden nav is not authorization
- No social scheduling or publishing in this slice
- Single-company — no tenant ownership abstractions for MIL
