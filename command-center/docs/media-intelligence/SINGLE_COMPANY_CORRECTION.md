# Media Library — Single-Company Architectural Correction

**Status:** PAUSED — inspection complete; no migrations applied; no edge functions deployed; awaiting owner review before implementation continues.  
**Branch:** `feat/media-intelligence-library`  
**Baseline:** `9369d206bfbcaf32267e9e88518b222146e11de8`  
**Authoritative decision:** BHFOS is a single-company OS for The Vent Guys. Multi-tenant product architecture is rejected for Media Library V2.

---

## 1. Tenant-related occurrences introduced or modified by this branch

Classification key:

| Code | Meaning |
|---|---|
| **R** | Remove now |
| **N** | Rename to correct single-company concept |
| **L** | Legacy V1 dependency temporarily required (document + removal path) |
| **U** | Unrelated historical code outside this assignment (do not touch) |

### A. Routes & navigation (branch-introduced / modified)

| Occurrence | Location | Class | Notes |
|---|---|---|---|
| `/:tenantId/media/*` route tree | `App.jsx` | **R** | Replace with `/media/*` |
| `/:tenantId/creator/*` | `App.jsx` | **R** | Replace with `/creator/*` |
| `/:tenantId/crm/media/*` → `/:tenantId/media/*` alias | `App.jsx` `MediaCrmAliasRedirect` | **R** | Do not preserve tenant-prefixed media alias as permanent; optional short-lived redirect from `/crm/media/*` → `/media/*` only if needed for bookmarks |
| `tenantPath('/media/...')` | `MediaLibraryLayout.jsx`, `MediaDashboard.jsx`, `crmPrimaryNav` via sidebar | **R** | Nav to absolute `/media`, `/creator` |
| Creator redirects `/${tenantId}/creator` | `BHFCrmLayout.jsx`, `MediaOwnerShell.jsx`, `MediaCapabilityGuard.jsx` | **R** | Redirect to `/creator` |
| Upload QR path `/${tenantId}/media/upload?session=` | `media-intel-upload-session` | **R** | `/media/upload?session=` |
| Docs prescribing tenant-prefixed MIL routes | `ACCESS_ARCHITECTURE.md`, `PHASE0_PLAN.md`, `IMPLEMENTATION_STATUS.md` | **R** | Rewrite to single-company routes |
| Tests asserting `/:tenantId/media` | `media-intel-access.test.mjs` | **R** | Assert `/media`, `/creator` |
| `/:tenantId/crm/*`, `/:tenantId/login`, `TenantGuard`, `tenantPath` for CRM/tech | Existing app (`App.jsx`, sidebar, etc.) | **L** / **U** | Pre-existing V1 shell; MIL must not extend it. Removal of company-wide tenant routing is outside MIL assignment unless authorized |

### B. Schema / migrations (branch-introduced — **not applied**)

| Occurrence | Location | Class | Notes |
|---|---|---|---|
| `mil_jwt_tenant_id()` reading JWT `tenant_id` | `20260725120000_…sql` | **R** | Replace with auth helpers that do not encode multi-tenancy |
| `tenant_id text not null` on all `mil_*` tables | same migration | **R** | Drop from MIL schema; do not rename to `organization_id` without a real org lifecycle |
| Indexes / uniques keyed by `(tenant_id, …)` | same | **R** | Re-key on natural keys (`asset_id`, `checksum`, paths) |
| Storage path `{tenant_id}/batches/…` | migration comments + policies | **R** | Use `mil/batches/…`, `mil/assets/…`, `mil/reels/…` |
| Storage policies comparing folder[1] to `mil_jwt_tenant_id()` | same | **R** | Authorize by role/capability + path prefix `mil/` (or bucket-wide staff/creator rules) |
| Policy names “… by staff tenant” | same | **N** | Rename to staff/creator capability language |
| Seed `tenant_id = 'tvg'` in tag vocabulary | same | **R** | Seed without tenant key |
| `mil_upload_sessions.tenant_id` | `20260725130000_…sql` | **R** | Scope by session/batch/actor only |
| RLS `tenant_id = mil_jwt_tenant_id()` | both migrations | **R** | RLS: authenticated + role/capability + resource ownership/assignment |
| Role lookup filtered by `r.tenant_id` | `mil_current_role()` | **L→R for MIL** | Prefer `app_user_roles` by `user_id` only for MIL helpers; do not invent org abstraction. Legacy column on `app_user_roles` remains **U/L** until company-wide cleanup |

### C. Edge functions (branch-introduced — **not deployed**)

| Occurrence | Location | Class | Notes |
|---|---|---|---|
| Require/compare `app_metadata.tenant_id` | analyze, promote, sign, upload-session | **R** | Authorize via role + resource checks |
| `"Tenant mismatch"` errors | analyze, promote | **R** | Remove; use forbidden/not-found |
| `tenant_id` writes into `mil_*` | all four functions | **R** | Stop writing the column after schema drop |
| Storage paths prefixed with tenant | upload-session, promote, derivatives | **R** | `mil/…` prefix |
| Role query `.eq('tenant_id', tenantId)` | sign, upload-session, promote | **L→R for MIL** | Query role by `user_id` (and ignore client-supplied role) |

### D. Client libraries & UI (branch-introduced)

| Occurrence | Location | Class | Notes |
|---|---|---|---|
| Function params `tenantId` throughout | `api.js`, `uploadManager.js`, `derivatives.js`, pages | **R** | Drop param; auth context + RLS/edge enforce |
| `.eq('tenant_id', tenantId)` filters | same | **R** | Remove once column gone |
| `fetchMilRole(tenantId)` matching `app_user_roles.tenant_id` | `roles.js` | **R** | `fetchMilRole()` by `auth.uid()` only |
| Outlet context `tenantId` | `MediaLibraryLayout` | **R** | Pass `caps` / user only |
| Invite SQL showing `tenant_id` in `app_user_roles` | `MediaSettings.jsx` | **L** | Column may still exist on legacy table; document insert without treating tenant as product concept; prefer role-only insert if column nullable/defaulted |
| Hardcoded `'tvg'` defaults | multiple pages | **R** | Remove from MIL surfaces |

### E. Unrelated historical (outside assignment — do not “fix” in this branch)

| Occurrence | Class |
|---|---|
| CRM `TenantGuard`, `/:tenantId/crm/*`, `/:tenantId/tech/*`, `SelectTenant`, `TenantSwitcher`, inspection/job `tenant_id` columns, existing RLS using JWT tenant | **U** (legacy V1) |
| Website `website_media` (no tenant product model) | **U** |

---

## 2. Classification summary

- **Remove now (R):** All MIL product routing, schema columns, storage folder tenancy, edge tenant checks, client `tenantId` plumbing, multi-tenant docs/tests introduced on this branch.
- **Rename (N):** Policy/helper names and UI copy that say “tenant isolation” → role/capability/resource isolation.
- **Legacy temporarily required (L):** Touching shared `app_user_roles.tenant_id` column and V1 CRM route shell while MIL mounts beside it; login may still live at `/:tenantId/login` until a company-wide auth route cleanup is authorized.
- **Unrelated (U):** Rest of CRM/inspection multi-tenant residue — out of scope.

**Do not** mechanically rename `tenant_id` → `account_id` / `organization_id`. No artificial organization entity.

---

## 3. Corrected route architecture

| Audience | Canonical route | Shell |
|---|---|---|
| Owner / staff | `/media/*` | Media library shell; link “Back to Hub” → `/crm` or existing hub path per conventions |
| Phone upload | `/media/upload` | Upload-only; `?session=` scoped token OK without staff session |
| Reel creator | `/creator/*` | Focused portal; **no CRM chrome** |
| Public | none for MIL | Website uses only promoted `website_media` |

**Compatibility (optional, temporary):**

- If bookmarks exist: `/crm/media/*` → `/media/*` (no tenant segment).
- Do **not** keep `/:tenantId/media/*` as a supported product route.
- Removal path: delete redirects after one release cycle once owners use `/media`.

**Auth entry:** Prefer existing login; if V1 only exposes `/:tenantId/login`, MIL may deep-link there as **L** with plan to canonicalize `/login` under a later company-wide change — not as MIL multi-tenancy.

---

## 4. Corrected ownership & authorization model

Single company. Authorization dimensions:

1. Authenticated user (`auth.uid()`)
2. Account identity (Supabase Auth user)
3. Role (`app_user_roles.role`: admin/manager/office/media_reviewer/reel_creator/phone_uploader/…)
4. Capability derived from role (upload, verify, approve reels, manage access, promote website)
5. Asset permission / media status (review, privacy, rights, permitted uses)
6. Creator assignment (asset or collection; revocable)
7. Upload-session scope (session id, batch, expiry, revocation, permitted actions)
8. Collection membership

**Creator isolation** = role + resource checks inside one company (CRM denied, raw intake denied, originals denied, unassigned projects denied) — **not** “tenant isolation.”

---

## 5. Required migration changes

Rewrite **unapplied** migrations (replace in place; do not apply old versions):

1. **Drop** `mil_jwt_tenant_id` and all `tenant_id` columns on `mil_*`.
2. **RLS:** `authenticated` + `mil_is_*` role helpers + resource predicates (`mil_creator_can_view_asset`, batch ownership for uploaders, assignment checks). Fail closed.
3. **Storage paths:** `mil/batches/{batchId}/originals/{assetId}/…`, `mil/assets/{assetId}/derivatives/…`, `mil/reels/{projectId}/v{n}/…`.
4. **Storage policies:** staff read/insert under `mil/` prefix (or bucket-level staff); no update/delete on originals for authenticated; creators insert/read only `mil/reels/…`; service role for session uploads & signing.
5. **Upload sessions:** no tenant field; bind `batch_id`, `created_by`, `expires_at`, `revoked_at`, `token_hash`.
6. **Tag vocabulary:** unique on `slug` only (company-wide).
7. Keep marketing-use gates, creator visibility, audit, immutability of originals.

---

## 6. Required edge-function changes

| Function | Changes |
|---|---|
| `media-intel-upload-session` | No tenant in create/validate/mint; QR → `/media/upload?session=`; paths under `mil/`; role via `user_id` |
| `media-intel-sign` | No tenant; authz = role + assignment + derivative kind; short TTL unchanged; creators never get originals |
| `media-intel-analyze` | No tenant mismatch; load asset by id + role staff/reviewer |
| `media-intel-promote-website` | No tenant; admin/manager + verified/privacy/rights/website use gates |

---

## 7. Required RLS & storage-policy changes

- Remove all `tenant_id = mil_jwt_tenant_id()` predicates from MIL.
- Enforce: unauthenticated deny; wrong role deny; creator only assigned/approved clear verified assets; upload-session writes only via service role after token validation; no permanent public URLs on private buckets.
- Security strength must not decrease.

---

## 8. Required test changes

**Remove:** “uses app_metadata tenant only”, cross-tenant / tenant-mismatch tests, route assertions for `/:tenantId/media`.

**Add / replace with:**

- Unauthenticated access fails  
- Unauthorized role access fails  
- Creator cannot access CRM routes/APIs  
- Creator cannot access raw/restricted/unassigned media or another creator’s projects  
- Upload-only session cannot browse existing media  
- Asset id swap does not bypass checks  
- Revoked assignment blocks new signed links  
- Expired/revoked upload sessions fail  
- Public cannot access private originals  
- Owner-only actions enforced server-side  

---

## 9. Legacy V1 dependencies preventing immediate company-wide removal

| Dependency | Impact on MIL | Removal path |
|---|---|---|
| SPA routes `/:tenantId/crm/*`, `TenantGuard`, `tenantPath` | CRM shell still tenant-prefixed | Mount MIL at `/media` & `/creator` **beside** CRM without extending tenant IA; company-wide route cleanup = separate authorization |
| `app_user_roles.tenant_id` column | Role rows may still store a value | MIL role lookup by `user_id` only; stop requiring JWT tenant for MIL; later migration to drop/ignore column company-wide |
| JWT `app_metadata.tenant_id` | Still set for V1 CRM RLS | MIL must not require or teach it as a product boundary |
| Login at `/:tenantId/login` | Deep links may still use it | Temporary **L**; propose `/login` in future auth cleanup |
| Inspection/job `tenant_id` + storage folders | Untouched | **U** — out of scope |

None of these justify keeping multi-tenant **product** design inside MIL.

---

## 10. Updated implementation plan (post-review)

1. Owner reviews this correction.  
2. Rewrite unapplied SQL migrations (single-company schema).  
3. Rewrite four `media-intel-*` edge functions (no tenant).  
4. Rewire client: routes `/media/*`, `/creator/*`; strip `tenantId` from MIL APIs; fix nav.  
5. Replace tests with single-company authz suite.  
6. Update docs (`ACCESS_ARCHITECTURE`, Phase 0, status, backup paths).  
7. Only then: apply migrations + deploy functions to **authorized staging**, then E2E.  
8. No merge/production/new domain without separate authorization.

---

## 11. Confirmation — nothing deployed

- Migrations `20260725120000` and `20260725130000` were **not** applied to any Supabase project from this work.  
- Edge functions `media-intel-analyze`, `media-intel-promote-website`, `media-intel-sign`, `media-intel-upload-session` were **not** deployed.  
- No staging E2E was started.  
- No merge to `main`. No production deploy. No new domain.

---

## Final governing rule (restated)

BHFOS is a single-company operating system for The Vent Guys. Preserve role- and resource-based isolation. Remove multi-tenant product language and architecture from the Media Library. Do not retain speculative SaaS / franchise tenancy infrastructure.
