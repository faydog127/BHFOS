# EV-2026-03-18 Manual UX

Status: Pending capture
Owner: Founder

## Scope

Real operator walkthrough with no dev shortcuts

## Raw Artifacts

- Pending

## Result

- Pending

---

## Addendum (2026-04-04) — P0-01 Tenant Isolation Lock (Public Endpoints)

- Patched public tenant resolution to be token-derived + mismatch-reject (no `tenant_id || 'tvg'` fallbacks):
  - `supabase/functions/public-quote/index.ts:316`
  - `supabase/functions/public-invoice/index.ts:346`
  - `supabase/functions/public-pay/index.ts:179`
  - `supabase/functions/public-quote-approve/index.ts:459`
- Added + ran the P0-01 negative test pack:
  - Test: `supabase/tests/node/p0_01_tenant_isolation.test.js:1`
  - Runner: `supabase/tests/node/run-p0-01.js:1`
  - Output log: `tmp/p0-01-tenant-isolation-test.log`
- Evidence pack:
  - `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-01_tenant-isolation-lock.md:1`

## Addendum — Missing Tenant Behavior Clarification (2026-04-04)

Observation:
- `public-pay` endpoint returns `200` when `tenant_id` is not provided.

Clarification:
- tenant is NOT defaulted
- tenant is derived from the token-bearing record server-side
- no fallback (e.g. `'tvg'`) is used

Implication:
- request without `tenant_id` is valid ONLY when token is valid
- request cannot switch tenant context
- wrong `tenant_id` is explicitly rejected (`403`)

Evidence:
- see `tmp/p0-01-tenant-isolation-test.log`
- test cases:
  - correct token + no `tenant_id` → success
  - correct token + wrong `tenant_id` → reject

Conclusion:
- behavior is intentional and aligned with P0-01 target state

## Service-Role Boundary Note

- public endpoints still use service-role (`supabaseAdmin`)
- tenant isolation is currently enforced at application layer (token-derived)
- RLS is not yet enforced for these paths

Status:
- acceptable for Phase 0
- must be revisited in later phase if moving toward full DB-enforced isolation
