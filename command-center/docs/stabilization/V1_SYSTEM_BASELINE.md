# V1 System Baseline

**Status:** Stabilization package — planning only  
**Source of truth:** `origin/main` @ `209823b67b7d0293ce9cff4aa0f06c28edd8c7b7`  
**Document date:** 2026-07-15  
**Production frontend:** `https://app.bhfos.com`  
**Production Supabase:** `wwyxohjnyqnegzbxtuxs` (TVG Website-CRM)

Anything not verified in this pass is labeled **UNKNOWN**.

---

## 1. Current production frontend version

| Field | Value | Evidence |
| --- | --- | --- |
| URL | `https://app.bhfos.com` | Live Hostinger static site |
| JS asset | `assets/index-fde7f80c.js` | Live HTML after hotfix #38 deploy |
| CSS asset | `assets/index-143e6852.css` | Live HTML after hotfix #38 deploy |
| Merge tip represented | `209823b` — `fix(inspections): harden lead property hydrate for production schema (#38)` | Git + deploy worktree |
| Prior broken tip (PR #36) | `3c0a74a` / assets `index-9f91c588.js` | Production smoke failure |
| Earlier known-good assets | `index-48b75569.js`, `index-6b5befcb.css` | Pre–field-UX-v2 Hostinger build |
| Host | Hostinger static (`public_html`) | Deploy tooling + `.htaccess` |

---

## 2. Current Edge Functions and versions

Repo contains **37** function slugs under `supabase/functions/` (plus stub `create-payment-intent` without `index.ts`).

Verified production versions (2026-07-15, `supabase functions list --project-ref wwyxohjnyqnegzbxtuxs`):

| Slug | Status | Version | verify_jwt |
| --- | --- | --- | --- |
| `inspection-report-pdf` | ACTIVE | **8** | false |
| `inspection-ai-analyze` | ACTIVE | 2 | false |
| `inspection-report-send` | ACTIVE | 2 | false |
| `leads` | ACTIVE | 66 | false |
| `send-estimate` | ACTIVE | 148 | false |
| `send-invoice` | ACTIVE | 82 | false |
| `public-pay` | ACTIVE | 58 | false |
| `stripe-webhook` | ACTIVE | 45 | false |

**Project function count observed:** 106 ACTIVE entries in list output (includes historical / non–command-center functions).  
**Full inventory of all 106 versions:** UNKNOWN (not enumerated in this package).  
**Repo `config.toml`:** most functions declare `verify_jwt = false`; `leads` / `github-issues-board` undeclared in config — production `leads` verified `verify_jwt=false`.

---

## 3. Current migration state

| Field | Value | Evidence |
| --- | --- | --- |
| Latest migration filename on main | `20260713212000_fix_mark_reviewed_transition_guc.sql` | `supabase/migrations/` |
| Local vs remote pairing (2026-07-15) | All listed migrations had matching local + remote timestamps | `supabase migration list --linked` |
| Pending migrations | **None observed** at list time | Same |
| Hotfix #37/#38 migrations | **None** (frontend-only) | PR file lists |
| History restoration | `2f5d244 chore(db): restore applied April migration history` | `origin/main` log |

**Migration-file immutability policy (written rule “never edit applied SQL”):** UNKNOWN as a formal docs rule. Practice is additive timestamped migrations + Ledger Lock governance.

---

## 4. Active modules

### CRM (`/:tenantId/crm/*`)

Hub, Leads, Pipeline/Opportunities, Jobs/Work Orders, Dispatch, Calendar/Appointments, Inspections (+ report), Estimates/Quotes, Flow Console (Money), Invoices, Contacts, Call Console, SMS, Marketing, Reporting, Partners, Settings, Ops Dashboard.

Feature-flagged via `FeatureFlagContext` + `bhf.config.json` (defaults mostly `true`; TVG marketing may be off).

### Tech PWA (`/:tenantId/tech/*`)

| Route | Page |
| --- | --- |
| `queue` | TechQueue |
| `jobs/:jobId` | TechJobDetail |
| `inspections/:inspectionId` | TechInspectionSession |
| `inspections/:inspectionId/review` | TechInspectionReview |

`TechSchedule.jsx` / `TechDashboard.jsx` exist on disk but are **not** mounted in `TechRoutes.jsx` (orphaned / unused entry points).

### Public

Quote token, invoice token, pay token, marketing contact pages.

---

## 5. Frozen or unused modules

| Item | Disposition | Evidence |
| --- | --- | --- |
| `TechSchedule` / `TechDashboard` pages | Present, not routed | Files exist; absent from `TechRoutes.jsx` |
| Legacy diagnostics routes | Routed but not primary nav | `backend-test`, `advanced-diagnostics` |
| Dual estimate table `estimates` | Legacy path still writable via UI modal | Used by `EstimateEditorModal.jsx`; **no CREATE migration in repo** |
| Marketing site nested duplicates | Outside V1 command-center scope | Root `.cursorrules` stale trees |
| `visualEditor` feature flag | Hard-disabled | `FeatureFlagContext` |
| Vercel as deploy target | Disconnected / residual only | Git disconnect + decorative CDN URL only |

---

## 6. Current deployment process

| Step | Reality |
| --- | --- |
| Frontend host | Hostinger → `app.bhfos.com` |
| Build | `npm run build` → `tools/build-production.mjs` (requires production `.env`, secret scan on `dist`) |
| CI build | `npm run build:local` (Vite only) |
| Deploy script on `origin/main` | **`tmp/deploy-hostinger-static.mjs` NOT on main**; `tools/deploy-lib.mjs` also **not on main** |
| Operator practice | Copy local deploy helpers into a **clean detached worktree**, compose production `.env` + `HOSTINGER_API_TOKEN`, zip `dist`, TUS upload to Hostinger |
| Edge functions | `npx supabase functions deploy <name> --project-ref wwyxohjnyqnegzbxtuxs` (operator-run; not CI) |
| Migrations in release | Explicit operator approval required; hotfix path intentionally skipped |
| Docs | `docs/INTEGRATIONS.md`, handoff release notes |

**Risk:** Deploy is repeatable by trained operators but **not codified on main**, so each release re-imports tooling.

---

## 7. Current branch / worktree inventory

Observed local worktrees (2026-07-15):

| Path | Ref | Notes |
| --- | --- | --- |
| `F:/Dev/BHFOS` | `inspection-production-rollout` | **Dirty / original — do not use for V1 work** |
| `F:/Dev/BHFOS-inspection-field-ux-v2` | `main` @ `209823b` | Clean-ish analysis/docs host |
| `F:/Dev/BHFOS-hotfix-lead-property-deploy` | detached `209823b` | Hotfix deploy tree |
| `F:/Dev/BHFOS-field-ux-v2-deploy` | detached `3c0a74a` | Stale PR #36 deploy |
| `F:/Dev/BHFOS-inspection-content-contract-deploy` | detached `2f5d244` | Prior content-contract deploy |
| `F:/Dev/BHFOS-inspection-rollout-clean` | `inspection-mobile-ux-phase5` | Older phase branch |
| Others | various feature/chore branches | Historical |

Remote: `origin/main` = `209823b`.

---

## 8. Known production dependencies

| Dependency | Role |
| --- | --- |
| Supabase Auth + PostgREST + Storage | App backend |
| Supabase Edge Functions | Quotes, invoices, payments, inspections PDF/AI/send |
| Hostinger hosting API + TUS | Frontend deploy |
| Stripe (+ webhooks) | Payments |
| PDFShift (edge secret) | Inspection PDF |
| Resend / SMS providers | UNKNOWN completeness in this pass (secrets exist; full matrix not re-audited) |
| OpenAI (inspection AI) | `inspection-ai-analyze` |

---

## 9. Known schema mismatches

| Mismatch | Local migrations assume | Production (verified / evidenced) |
| --- | --- | --- |
| `properties.id` | `uuid` in `20260101_create_money_loop_core_tables.sql` | **bigint** marketing/scouting table |
| `leads.property_id` | FK → `properties(id)` uuid | **uuid**, not joinable to bigint `properties.id` |
| Property address columns | `address1` / `address2` in money-loop DDL | Production uses **`address_line_1`** (no `address1`) |
| `properties.tenant_id` | Present in local DDL | **Absent** on production properties rows probed during hotfix |
| `technicians.tenant_id` | Sometimes assumed in app inserts | **Absent** (hotfix smoke hit schema cache error) |
| `estimates` table | Used by UI | **No CREATE migration in repo** — hosted DDL UNKNOWN |

---

## 10. Known legacy fallbacks

| Fallback | Location | Why |
| --- | --- | --- |
| Separate properties hydrate; skip UUID ids; never throw | `src/lib/inspectionFieldAddress.js` | Broken lead↔property relationship |
| Address priority: attached property → `property_formatted_address` → inspection/job → `leads.address` | Same | Cannot trust property join |
| New-lead field flow writes freeform lead address only | `InspectionFieldCustomerStep.jsx` | Cannot insert/link production `properties` safely |
| Quote UI labeled “Estimates” but uses `quotes` | `ProposalBuilder` / routes | Dual estimate systems |
| Invoice status overrides job `payment_status` in ops projection | `job_operational_state_v1` migration | Dual status fields |
| Appointment → job schedule mirror trigger | Packet 008 migration | Two schedule surfaces |

---

## 11. Known unresolved defects (seed for backlog)

1. Lead/property identity mismatch (UUID vs bigint) — **accepted with fallback for V1 field load; structural debt remains**
2. `paymentService.js` still selects `properties!fk_leads_property(address1…)` — likely production-fragile
3. Dual `estimates` vs `quotes` ownership
4. Deploy tooling not on main
5. Tech schedule page not in tech routes (phone scheduling incomplete)
6. Lead/customer/contact overlap (UI “customer” = lead)
7. Migration local DDL vs hosted drift
8. Field UX still young; founder real-device Ferret acceptance not closed in this package (**UNKNOWN field sign-off**)

---

## 12. Known preview / deployment integrations

| Integration | State |
| --- | --- |
| Hostinger | **Active** production frontend |
| Vercel GitHub App | **Disconnected** (operator action; residual decorative CDN URL only) |
| GitHub Actions CI | lint + build on PR/main |
| Ledger Lock workflow | Required check; review gate + tenant artifacts |
| Preview environments | **UNKNOWN** as a maintained system — Hostinger is SoT |

---

## 13. Current testing structure

| Layer | Location | In CI? |
| --- | --- | --- |
| Playwright smoke | `tests/smoke/` (~21 specs) | **No** |
| Helpers | `tests/smoke/helpers/supabaseAdmin.js` | — |
| Lint | `npm run lint` | Yes |
| Build | `npm run build:local` | Yes |
| Review gate | `npm run review:gate` | Via Ledger Lock when in scope |
| Ledger / Layer 1–3 | `artifacts/tenants/…` + ledger-lock.yml | Yes (scoped) |

Coverage concentration: inspection field UX / narrative / preflight. Money-loop UAT specs exist but are older and not CI-gated.

---

## 14. Current release gates

Documented / observed:

1. Branch from verified `origin/main`
2. PR required checks: **lint**, **build**, **ledger_lock**
3. Human approval before merge
4. Clean deploy worktree (not dirty `F:\Dev\BHFOS`)
5. Production smoke with synthetic data
6. No migration unless explicitly approved

`docs/governance/BRANCH_PROTECTION.md` documents required checks; **live GitHub branch-protection enforcement:** UNKNOWN from filesystem alone (assumed configured from prior releases).

---

## 15. Areas where production differs from local assumptions

1. **Property model** — local money-loop UUID properties vs hosted bigint scouting properties  
2. **PostgREST embeds** — local FK assumptions fail on hosted schema cache  
3. **Column names** — `address1` vs `address_line_1`; missing `tenant_id` on some tables  
4. **Deploy tooling** — present in operator machines / dirty trees, absent from main  
5. **Environment** — local Supabase often used for Playwright; production URL must be forced for release builds  
6. **`estimates` table** — app writes it; repo migrations do not define it  

---

## Explicitly documented items (checklist)

| Topic | Documented? |
| --- | --- |
| `leads.property_id` UUID vs `properties.id` bigint | Yes (§9, §10) |
| Technician identity (`technicians.id` vs `user_id`) | Yes — latest migrations FK to `technicians.id` for jobs/appointments/inspections; older unify-to-user_id migration superseded |
| Customer / lead / property overlap | Yes (§4–5, §10) |
| Inspection → job | Link `job_id` OR quote-from-inspection → accept → job trigger |
| Estimate → job | Legacy `estimates` optional → `quotes` → accept trigger → `jobs` |
| Invoice authority | Invoice status wins in `job_operational_state_v1` when invoice linked |
| Migration-history restoration | Commit `2f5d244`; list paired as of 2026-07-15 |
| Hostinger deployment path | Yes (§6) |
| Vercel removal | Yes (§5, §12) |
| Edge Function deploy process | Operator CLI deploy; not CI (§6) |

---

## Change log for this document

| Date | Note |
| --- | --- |
| 2026-07-15 | Initial baseline from `209823b` + production probes (functions list, prior hotfix smoke) |
