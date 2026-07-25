# Media Library — Access Architecture

**Branch:** `feat/media-intelligence-library`  
**Baseline:** `9369d206bfbcaf32267e9e88518b222146e11de8`  
**App URL (existing):** `https://app.bhfos.com` (authenticated CRM; no new domain)  
**Governing correction:** `SINGLE_COMPANY_CORRECTION.md` — BHFOS is a single-company OS for The Vent Guys.

## Product routes (MIL)

| Audience | Route | Shell |
|---|---|---|
| Owner / staff | `/media/*` | Media library shell (CRM nav link for staff) |
| Mobile upload | `/media/upload` | Upload-only UI (+ optional `?session=` opaque token) |
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
→ upload-session scope
```

Enforced in: session guard, capability guard, RLS, storage policies, edge functions, signed-URL minting.

MIL does **not** require JWT `tenant_id`, route tenant segments, or `tenant_id` columns on `mil_*` tables.

### Role → MIL capability matrix

| Role | Browse library / originals | Upload (staff) | Verify / review | Approve reels | Invite/revoke creators | Create/revoke upload sessions | Promote website | Creator portal |
|---|---|---|---|---|---|---|---|---|
| `admin` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Inspect only |
| `manager` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Inspect only |
| `office` | Yes | Yes | Yes | No | No | No | No | No |
| `media_reviewer` | Yes | Yes | Yes | No | No | No | No | No |
| `technician` | **No** (default) | No | No | No | No | No | No | No |
| `phone_uploader` | No | Session/own batches only | No | No | No | No | No | No |
| `reel_creator` | Assigned media only | Reel drafts only | No | No | No | No | No | Yes |

Managers are treated as owner/admin for sensitive MIL actions (invite/revoke, upload sessions, website promote, reel approve). Technicians keep CRM/tech access outside MIL; they do **not** receive complete library/original access by default. Field phone dumps use scoped upload sessions minted by owner/admin.

### Creator isolation (role + resource — not tenancy)

Creators must not access CRM, customers/jobs, raw intake, private originals, restricted/unreviewed assets, unassigned work, owner/reviewer actions, rights admin, other creators’ assignments, website promotion, or social publishing.

- `reel_creation` permitted use makes an asset **eligible for assignment**, not globally visible to every creator.
- Access requires an **active** direct assignment or **active** assigned collection (revocation blocks new signed links).
- Creators have **no** broad storage SELECT on `mil/reels/%`. Reel preview/download uses `media-intel-sign` with project-ownership checks and audit.

### Upload-session scope

Opaque token hash, authorized batch/session, permitted upload actions, issuing actor, expiration, revocation. No tenant identity.

- Each mint creates a `mil_upload_grants` row binding session, batch, asset ID, exact object path, content type, max bytes, and expiry.
- `complete_file` accepts completion only once against that exact grant after inspecting stored-object metadata.
- Upload-only sessions cannot browse, search, preview, download, approve, or modify the library.

### Website promotion

```
Private original → public_safe derivative (EXIF stripped) → explicit promote copy to website-public-media
```

Promotion never copies private originals into the public bucket.

## Discovery notes (legacy V1 coexistence)

| Topic | Finding | MIL decision |
|---|---|---|
| CRM / tech routes | Still `/:tenantId/crm/*`, `/:tenantId/tech/*`, `TenantGuard` | Out of scope; MIL mounts beside them |
| Login | Still `/:tenantId/login` | MIL may deep-link as temporary **L** until `/login` cleanup |
| Roles | `app_user_roles` may still have a legacy `tenant_id` column | MIL role lookup by `user_id` only |
| Inspection storage | JWT tenant folder segments | Untouched (**U**) |

## Governing rules (enforced)

- Not built into public Vent Guys website
- Not a public gallery
- No bucket browsing as access
- Creator is not an unrestricted CRM account
- No native app required
- No new domain in this assignment
- Hidden nav is not authorization
- No social scheduling or publishing in this slice
