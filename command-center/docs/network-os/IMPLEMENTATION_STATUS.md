# Network OS — Implementation Status

**Branch:** `cursor/nos-convention-queue-closeout-f5df`  
**Verified product commit (tests/build):** `495093fb7ec95f577cccb500f20149fab240864f`  
**Draft PR:** https://github.com/faydog127/BHFOS/pull/148  
**Mission:** `NOS-CONVENTION-QUEUE-CLOSEOUT-01` / BUILDER  
**Parent / production merge SHA:** `c4d344b13715914f0a452222fdb0a0417061d0bb` (`hotfix/v1-crm-layout-hooks` tip)  
**Rollback identity (frontend redeploy):** `0d6bcbb8aa14a43b16dafa5314e156d852785ff5`  
**Product / R1 / Slice 1 activation:** **None**  
**FAST_LANE_COMPLETE:** **Not declared**  
**Hostinger dist / hosted SQL / schema / security model:** **Not this hop**

## Live baseline (verified before edit)

| Field | Value |
|---|---|
| Origin branch | `hotfix/v1-crm-layout-hooks` |
| Exact SHA | `c4d344b13715914f0a452222fdb0a0417061d0bb` |
| Worktree | clean detached checkout, then this branch |
| Foundation queue source | PR 142 path `/network-os/convention/intake` |

## Surgical port (this hop)

Ported **only** the already-built protected operator queue onto the live CRM SPA. Public join/confirmation and CRM login / tenant / deep-links stay in place. Demo shell `/network-os/convention/*` was **not** ported.

| Surface | Path | Auth |
|---|---|---|
| Join form | `/network-os/convention/join` | Public — no `TenantGuard`, no session |
| Confirmation | `/network-os/convention/join/thanks` | Public — no internal identifiers |
| Operator queue | `/network-os/convention/intake` | Session + `network_os_actor_has_bhis_convention_intake()` then RLS SELECT / status-only UPDATE on `network_os_provider_interest_intake` |
| CRM login / tenant / deep-links | `/select-tenant`, `/:tenantId/login`, `/:tenantId/crm/*`, `/quotes/:token`, `/quote-confirmation` | Unchanged except a surgical `next=` allowlist for the exact intake path |

Queue client never `from('app_user_roles')` and never reads customer tables (`leads` / `contacts` / `partner_prospects` / `submissions` / `events`). No new role. No RLS/helper SQL change. No seed/insert of `app_user_roles`.

## Local verification (this HEAD)

| Command | Result |
|---|---|
| `npm run lint` | 0 errors (25 pre-existing warnings) |
| `npm run guard:identity` | PASSED (577 files) |
| `npm run test:identity-helpers` | 8 pass |
| `npm run test:network-os-convention-intake` | 19 pass (join public; intake protected; CRM tenant/login/quote deep-links still present) |
| `npm run test:ux-refactor-helpers` | pass (includes CRM layout-hooks contract) |
| `npm run test:intake-helpers` | 6 pass |
| `npm run test:ml-p1-s1-helpers` | 15 pass |
| `npm run test:ml-p1-s2-helpers` | 24 pass |
| `npm run test:media-intel-helpers` | pass |
| `npm run test:ux-polish-helpers` / `test:uxv2-helpers` / `test:scheduling-helpers` | pass |
| `npm run test:supabase-oauth-helper` | pass |
| `npm run test:founder-run-readiness` | pass |
| `npm run test:control-plane-lane` | pass |
| `npm run build:local` | pass — chunks `ConventionJoinRoutes-30a30029.js` and `ConventionIntakeRoutes-ba46c8f9.js` present |

## Evidence (label honestly)

| Claim | Tier |
|---|---|
| Production merge SHA resolve | Git verified this session |
| Queue + CRM/join preservation | **locally verified** at `495093fb7ec95f577cccb500f20149fab240864f` |
| Hosted `https://app.bhfos.com` replace | **Not done** |
| Hosted SQL / function deploy | **Not done** |
| R1 / Slice 1 | **Inactive** |
| FAST_LANE_COMPLETE | **Not declared** |

## Not this hop

- PRs 140–147 are not push targets.
- No merge, deploy, SQL apply, schema, or security-model change.
- No n8n. No R1/S1.
- Website/bhfos-site is not the convention app.
- Demo shell `/network-os/convention/*` remains unported.

## Exact next action

Independent Architecture/Contract Guard reviews the draft closeout PR. Do not merge. Do not deploy. Hostinger replace is a later runner.
