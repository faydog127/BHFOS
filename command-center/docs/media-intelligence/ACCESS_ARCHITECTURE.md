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

### Creator isolation (role + resource — not tenancy)

Creators must not access CRM, customers/jobs, raw intake, private originals, restricted/unreviewed assets, unassigned work, owner/reviewer actions, rights admin, other creators’ assignments, website promotion, or social publishing. They receive only authorized creator derivatives.

### Upload-session scope

Opaque token hash, authorized batch/session, permitted upload actions, issuing actor, expiration, revocation. No tenant identity. Upload-only sessions cannot browse, search, preview, download, approve, or modify the library.

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
