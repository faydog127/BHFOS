# 🧾 TICKET — P0-02.E Sweep Production-Survivability Test Spec (Post-Local)

**Title:**  
P0-02.E — Sweep Production-Survivability Hardening (Test Spec + Invariants)

**Type:**  
Hardening / Test Spec (Post-Local)

**Priority:**  
High

**Timing:**  
Before declaring `.E` production-hardened (can ship local proof without this; do not claim “production-survivable” without it).

---

## 🎯 Objective

Raise `.E` from **locally proven** to **production-survivable** by adding:

- missing regression tests
- explicit invariants (static + runtime)
- concurrency/overlap expectations that are actually enforceable

This ticket is **tests-first**. Patch only if a test proves a real gap.

---

## 🧭 Scope

### In scope

- Sweep RPC: `public.p0_02e_run_sweep(...)`
- Alert latch: `public.reconciliation_alerts` + `public.ensure_reconciliation_alert(...)`
- Follow-up task dedupe via `public.ensure_follow_up_task(...)`
- Node test pack(s) for sweep behavior and invariants

### Out of scope (belongs to production validation ticket)

- Real Stripe API outages / Stripe API querying from sweeper
- Live Stripe checkout / live webhook delivery

Reference: `docs/tickets/TICKET_P0-02_production-validation_post-local-gate.md`

---

## 🔒 Locked Doctrine (Non-Negotiable)

`.E` is a **verifier + recovery router**, not a settlement engine.

- Allowed:
  - replay into canonical finalization (`record_stripe_webhook_payment`)
  - set reconciliation flags/reasons
  - create deduped alerts/tasks with deterministic identity
- Not allowed:
  - direct money math “fixes”
  - `amount_paid`/`balance_due` patching as a “correction”
  - applying money under ambiguous association

---

## ✅ Prerequisites / Decisions (Make Explicit)

These tests require the implementation to define which guarantee is intended:

1. **Batch failure isolation**
   - If required: sweep must catch per-item errors, emit alert/trace, and continue.
   - If not implemented: adjust expectations to “fail-fast; no partial progress guarantee”.

2. **Overlapping sweep execution**
   - If required: define lock strategy (e.g., advisory lock per `invoice_id` or `provider_payment_id`).
   - If not implemented: reduce expectation to “dedupe prevents duplicate financial effect” (not “no duplicate attempts”).

Ticket must record which option is chosen.

---

## 🧪 Required Tests (Refined Set)

### CORE (keep)

1. Buffer cutoff (skip hot data)
2. No-op on already-settled invoice
3. Alert/task dedupe
4. Two distinct payments concurrency (same invoice)
5. Out-of-order non-final after success (no financial effect; no downgrade)

### REQUIRED ADDITIONS

6. **Canonical pipeline enforcement (static + runtime)**
   - Static invariant gate:
     - prove `p0_02e_run_sweep` does **not** `UPDATE invoices SET amount_paid/balance_due/paid_at/status` (except reconciliation flags/reason).
   - Runtime invariant:
     - drift scenario proves sweep flags only; totals unchanged.

7. **Zero-side-effect no-op proof**
   - For a clean/settled invoice, prove:
     - no new rows in `transactions`
     - no new rows in `transaction_applications`
     - no new rows in `reconciliation_alerts`
     - no new rows in `crm_tasks`

8. **Latch lifecycle**
   - flagged → reset/resolved → re-detected
   - exactly one new alert identity (no missed re-alert, no spam loop)
   - includes `alert_key` proof (deterministic identity)

9. **Partial batch failure isolation** *(only if prerequisite #1 is chosen)*
   - one failing item does not stop the batch
   - rerun only reprocesses failed items
   - no duplicate work on already-processed items

10. **Batch-level idempotency**
   - same sweep run twice over same dataset
   - no new effects
   - identical result counts

11. **Overlapping sweeps** *(only if prerequisite #2 is chosen)*
   - two sweeps running concurrently
   - no duplicate recovery
   - no duplicate alerts/tasks
   - no race-induced double application

12. **DB/Edge dependency degradation (not Stripe API)**
   - when RPC fails / DB query fails / Edge call fails:
     - no partial money writes
     - deterministic alert/trace created
     - safe to retry (rerun does not double-apply)

13. **Alert payload completeness**
   - each anomaly must include:
     - `alert_key`
     - `invoice_id` (when known)
     - `provider_payment_id` (when known)
     - `anomaly_type`
     - `first_detected_at` + `last_detected_at`
     - reason fields sufficient for operator action

---

## 📊 Required Artifacts

- Test log(s) with proof objects per scenario
- DB snapshot queries captured for:
  - attempts
  - transactions
  - applications
  - invoices (projection + reconciliation flags)
  - reconciliation alerts (identity/dedupe proof)
  - follow-up tasks (dedupe proof)
- Static scan output for canonical-pipeline enforcement

---

## ✅ PASS Criteria

- `.E` never becomes a second money authority
- All “no-op” cases prove **zero unintended writes**
- Alerts/tasks are latched and deduped deterministically (`alert_key`)
- Concurrency/overlap behavior matches the explicit decision above
- Degradation paths fail safely and are retry-safe

---

## ❌ FAIL Conditions

Stop and create a remediation task if any of these occur:

- sweep writes invoice totals directly as a “fix”
- duplicate financial effect (2 tx/apps for one provider payment)
- alert spam (no deterministic dedupe identity)
- overlap causes double-apply or split-brain
- partial failure leaves ambiguous state without alert/trace

