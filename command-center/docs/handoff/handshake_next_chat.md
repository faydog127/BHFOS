# Next Chat Handshake (Phase 0 / Reconciliation Locks)

Date: 2026-04-05  
Repo: `c:\BHFOS\command-center`  
Local Supabase: `http://127.0.0.1:25431`

---

## Minimal Env (prevents 401/JWT failures)

Set **before** running any Node proof runners:

- `SUPABASE_EDGE_URL=http://127.0.0.1:25431/functions/v1`
- `SUPABASE_REST_URL=http://127.0.0.1:25431/rest/v1`
- `SUPABASE_SERVICE_KEY=<from supabase status: Secret>`
- `TEST_MODE=true`

If these aren’t set correctly, tests commonly fail with:
- `Expected 3 parts in JWT; got 1`

### One-paste PowerShell bootstrap (auto-extract local service key)

```powershell
$env:SUPABASE_EDGE_URL = 'http://127.0.0.1:25431/functions/v1'
$env:SUPABASE_REST_URL = 'http://127.0.0.1:25431/rest/v1'
$env:TEST_MODE = 'true'

$status = & C:\Users\ol_ma\.supabase\bin\supabase.exe status | Out-String
$serviceKey = [regex]::Match($status, 'sb_secret_[A-Za-z0-9_-]+').Value
if (-not $serviceKey) { throw 'Could not extract local SUPABASE_SERVICE_KEY from `supabase status` output.' }
$env:SUPABASE_SERVICE_KEY = $serviceKey
```

---

## DO NOT CLAIM (governance language)

- Do **not** claim “payment is production-safe” until ticket `P0-02-PROD-VALIDATION` is executed and artifacts are captured.
- Allowed labels:
  - `P0-02: LOCAL_PROVEN` (B/C/D/E tests passing locally)
  - `P0-02: PRODUCTION-VALIDATED` **only after** `P0-02-PROD-VALIDATION` artifacts exist

---

## Overlap Model Truth (avoid overstating guarantees)

- Sweep/webhook convergence safety is **DB idempotency/uniqueness based** (financially safe).
- It is **not** “no duplicate attempts” safe unless we add an explicit lock strategy.
- This is why `P0-02E-SWEEP-HARDEN` exists.

---

## Money Truth (one-liner)

`invoice.amount_paid` is a projection; truth is `SUM(transaction_applications.applied_amount)` for successful transactions.

Phase-0 violation example: reintroducing additive mutation (e.g., `amount_paid += x`) as authority.

---

## High-Risk Regression Points (watch list)

- Reintroducing service-role public flows that trust request tenant context (P0-01 regression).
- Any new writer path that can create `transactions` / `transaction_applications` outside canonical RPC(s).
- Any change to event emission logic without dedupe (creates audit/ops spam even if money is correct).
- Env var drift (`STRIPE_WEBHOOK_SECRET`) between local/prod (or renamed secrets without normalization).

---

## Rerun Key Local Proofs

- P0-01: `node supabase/tests/node/run-p0-01.js`
- P0-02.B: `node supabase/tests/node/run-p0-02b.js`
- P0-02.C: `node supabase/tests/node/run-p0-02c.js`
- P0-02.D: `node supabase/tests/node/run-p0-02d.js`
- P0-02.E tools: `node supabase/tests/node/run-p0-02e.js`
- P0-02.E sweep: `node supabase/tests/node/run-p0-02e-sweep.js`
- Review gate: `npm run review:gate`

---

## Single Place for “What is Currently True”

- Phase 0 board: `tmp/phase_0_remediation_board.md`
- Evidence packets: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-0*.md`
- Phase 0 snapshot: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-05_phase-0-snapshot_local-proof.md`
- Tickets (single source in-repo): `tmp/tickets_board.md`

---

## Active Ticket IDs

- `P0-02-PROD-VALIDATION`
- `P0-02E-SWEEP-HARDEN`
