# EV-2026-04-04 — P0-01 Tenant Isolation Lock (Public Endpoints)

## Summary
- Goal: remove request-authoritative tenant resolution from public token flows and eliminate any default tenant fallback.
- Result: public token endpoints now derive `tenant_id` from the token-bound record and reject tenant mismatches with `403`.

## Tenant Isolation Invariant (P0-01)
Invariant:
- A public request MUST NOT influence tenant resolution.
- Tenant context MUST be derived exclusively from the token-bound record.

Failure condition:
- any request field (including `tenant_id`) affects query scope or record selection prior to the token-bound lookup.

Detection:
- negative test suite: `supabase/tests/node/p0_01_tenant_isolation.test.js`
- fallback scan: `rg -n --hidden -S "(\\|\\||\\?\\?)\\s*'tvg'" supabase/functions/public-quote/index.ts supabase/functions/public-invoice/index.ts supabase/functions/public-pay/index.ts supabase/functions/public-quote-approve/index.ts`

## Scope (code)
- `supabase/functions/public-quote/index.ts`
- `supabase/functions/public-invoice/index.ts`
- `supabase/functions/public-pay/index.ts`
- `supabase/functions/public-quote-approve/index.ts` (was still defaulting to `tvg`)

## Scope (tests / artifacts)
- `supabase/tests/node/p0_01_tenant_isolation.test.js`
- `supabase/tests/node/run-p0-01.js`
- `tmp/p0-01-tenant-isolation-test.log`

## Tenant Binding Contract (implemented)
- Input: `token` is authoritative.
- Optional input: `tenant_id` is validation-only.
- Server behavior:
  - fetch record by `public_token`
  - derive `derivedTenantId = record.tenant_id`
  - if `tenant_id` was provided and differs → reject `403 Tenant mismatch`
  - proceed using `derivedTenantId` only

## Endpoint-by-endpoint behavior matrix (observed)
Source: `tmp/p0-01-tenant-isolation-test.log` via `node supabase/tests/node/run-p0-01.js`.

### `public-quote`
- Correct token + no `tenant_id` → `200`
- Correct token + correct `tenant_id` → `200`
- Correct token + wrong `tenant_id` → `403`

### `public-invoice`
- Correct token + no `tenant_id` → `200`
- Correct token + correct `tenant_id` → `200`
- Correct token + wrong `tenant_id` → `403`

### `public-pay`
- Correct token + no `tenant_id` → `200`
- Correct token + correct `tenant_id` → `200`
- Correct token + wrong `tenant_id` → `403`

### `public-quote-approve`
- Correct token + wrong `tenant_id` → `403`

## Addendum — Missing Tenant Behavior Clarification (2026-04-04)
Observation:
- Public endpoints return `200` when `tenant_id` is not provided.

Clarification:
- No default tenant (e.g. `tvg`) is used.
- Tenant is derived exclusively from the token-bound record (`public_token` lookup).
- The request does not control tenant context.

Implication:
- Requests without `tenant_id` are valid only when a valid token is provided.
- Requests cannot switch tenant context.
- Requests with incorrect `tenant_id` are explicitly rejected (`403`).

Evidence:
- See `tmp/p0-01-tenant-isolation-test.log`
- Verified cases (see `public-pay` lines in the log):
  - correct token + no `tenant_id` → success
  - correct token + wrong `tenant_id` → reject

Conclusion:
- Behavior is intentional and aligned with P0-01 target state.

## Code path notes (what changed)
- `public-quote-approve`: removed `tenant_id` default fallback to `tvg` and removed tenant filtering in the token lookup query (tenant is now derived from the quote row).
- `public-pay`: ensured all downstream operations use `tenantId = derivedTenantId` after mismatch validation (previously referenced `tenantId` before it was defined).
- `public-quote`: fixed worker boot error (`Identifier 'data' has already been declared`) by renaming the query response destructure (`data` → `fetchData`).

## Fallback Elimination Confirmation
- No `tenant_id || 'tvg'` or equivalent default tenant logic exists in the scoped public endpoints.
- Tenant resolution is exclusively token-derived.

Verification:
- Code inspection of all scoped endpoints
- Fallback scan returned no active usage in these paths:
  - `tmp/p0-01-fallback-scan.log`

## Logging / Event Context Note
- For successful (`200`) public flows, the tenant context written to `public_events` is the derived tenant (token-bound record tenant).
- For negative cases:
  - `not_found` before lookup may log `tenantId = requestedTenantId` (request context only; no derived tenant exists)
  - `tenant_mismatch` logs `tenantId = requestedTenantId` and includes `derived_tenant_id` in metadata

Status:
- Verified by code inspection for the scoped endpoints.
- Should be revalidated during event taxonomy unification (Phase 1).

## Service-Role Boundary Note (Refined)
- Public endpoints still use `supabaseAdmin` (service-role).
- Tenant isolation is currently enforced at the application layer via token-derived tenant binding.
- RLS is not applied to these public flows.

Risk classification:
- If tenant binding logic regresses, impact is high due to service-role bypass.

Status:
- Acceptable for Phase 0 containment.
- Must be revisited for DB-enforced isolation in a later phase.

## Coverage Boundary
This lock applies ONLY to:
- public token-based endpoints in scope (above)

Not covered:
- authenticated CRM endpoints
- internal/admin flows
- any non-token public endpoints (if introduced later)

Implication:
- tenant isolation enforcement for those paths requires separate audit + evidence.

## Enforcement Map
Invariant → Enforcement → Detection
- Token-derived tenant binding
  - enforced in: endpoint logic (lookup-by-token then derive `tenantId`)
  - detected by: `p0_01_tenant_isolation.test.js`
- Mismatch rejection (`403`)
  - enforced in: runtime validation (`requestedTenantId` vs `derivedTenantId`)
  - detected by: `p0_01_tenant_isolation.test.js`
- Fallback elimination
  - enforced in: code (no fallback branches)
  - detected by: fallback scan + test suite

## Regression Safeguards
- Automated test: `supabase/tests/node/p0_01_tenant_isolation.test.js`
- Required checks:
  - wrong `tenant_id` → `403`
  - missing `tenant_id` → allowed only via token-derived tenant (no fallback tenant)
- Client hardening:
  - public pages no longer send `tenant_id` for token-based endpoints (removes UI-driven mismatch risk)
- Code scan requirement:
  - no default tenant fallback patterns
  - no request-driven tenant filtering before token lookup

Merge rule:
- Any modification to scoped public endpoints MUST pass:
  - `node supabase/tests/node/run-p0-01.js`
  - fallback scan (command in `Tenant Isolation Invariant (P0-01)`)

## App-Side Hardening Follow-Through

### Change
Public-token client calls now omit `tenant_id` wherever possible.

### Code Surfaces
- `src/lib/publicDocumentApi.js`
- `src/pages/public/QuoteView.jsx`
- `src/pages/public/PaymentPage.jsx`

### Why This Matters
- Removes avoidable UI-driven tenant mismatch errors
- Keeps tenant selection fully server-derived from the token-bound record
- Reduces the chance of client-side drift reintroducing tenant confusion

### Constraint
This is a hardening improvement, not the primary security control.
The true control remains server-side tenant derivation + mismatch rejection.

### Expected Behavior
- Public token flows succeed without requiring client-supplied `tenant_id`
- Wrong tenant cannot be selected by the browser
- Missing `tenant_id` does not imply fallback tenant selection

## Failure Modes
| Scenario | Expected behavior |
| --- | --- |
| missing `token` | `404` |
| invalid `token` | `404` |
| correct `token` + missing `tenant_id` | `200` (token-derived tenant) |
| correct `token` + wrong `tenant_id` | `403` |
| token collision (non-unique) | `409` (`token_ambiguous`) |

## Dependencies
- `quotes.public_token` and `invoices.public_token` exist and are unique (schema migrations declare `unique`).
- token lookup returns the correct record for the provided token.
- token-bearing records store the correct `tenant_id`.
- downstream queries (if any) use derived tenant only (not request tenant).

## Blast Radius (If This Breaks)
If tenant isolation regresses:
- cross-tenant data exposure becomes possible
- public token endpoints become a pivot point
- service-role amplifies impact (full-table access risk)

Severity:
- CRITICAL

Operational response:
- Treat as incident: immediately block/disable public endpoints or rotate/expire tokens, then revert changes and redeploy.

## Forward Constraint (Phase Upgrade Requirement)
P0-01 is considered COMPLETE only when:
- tenant isolation is enforced at DB level (RLS or equivalent)
- service-role is removed or strictly constrained for public flows
- public endpoints cannot bypass tenant boundaries at DB layer

Current status:
- application-layer enforced (intermediate state)

## Proof Map
- Test runner: `supabase/tests/node/run-p0-01.js`
- Test file: `supabase/tests/node/p0_01_tenant_isolation.test.js`
- Execution log: `tmp/p0-01-tenant-isolation-test.log`
- Fallback scan log: `tmp/p0-01-fallback-scan.log`
- Code scope:
  - `supabase/functions/public-quote/index.ts`
  - `supabase/functions/public-invoice/index.ts`
  - `supabase/functions/public-pay/index.ts`
  - `supabase/functions/public-quote-approve/index.ts`

## Rollback note
- Revert the changes in the scope files and redeploy edge functions.
- Rollback success criteria: endpoints still boot and return to prior behavior (not recommended because it reintroduces cross-tenant exposure risk).
