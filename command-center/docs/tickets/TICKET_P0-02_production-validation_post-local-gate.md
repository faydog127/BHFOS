# 🧾 TICKET — P0-02 Production Validation (Post-Local Gate)

**Title:**  
P0-02 — Production Validation Run (Stripe + Webhook + Reconciliation)

**Type:**  
Production Validation / Post-Local Gate

**Priority:**  
High (Required before declaring payment system production-safe)

**Timing:**  
Next production patch window

---

## 🎯 Objective

Execute a **real end-to-end production validation run** of the payment system to confirm that:

- public-pay initiation
- Stripe checkout
- webhook ingestion
- ledger settlement
- reconciliation visibility

all behave correctly under real infrastructure conditions.

This is the **production validation gate** for P0-02 after local proof.

---

## 📦 Scope

### In scope

- Real Stripe checkout (live or controlled test-mode in production env)
- Real webhook delivery (Stripe → deployed Supabase function)
- Ledger writes (transactions + applications)
- Settlement correctness
- Event emission behavior
- Reconciliation visibility (no silent drift)

### Out of scope

- refunds / reversals
- UI redesign
- event taxonomy changes
- performance/load testing

---

## 🧪 Required Scenarios

### 1. Standard payment flow

- Initiate via `public-pay`
- Complete Stripe checkout
- Webhook confirms

**PASS requires:**

- 1 transaction
- 1 application
- correct invoice settlement
- no duplicate events

---

### 2. Duplicate initiation attempt

- Trigger multiple `public-pay` requests (refresh/double-click)

**PASS requires:**

- single provider payment intent
- no duplicate charge path
- safe idempotent response

---

### 3. Webhook replay

- Manually replay webhook event (Stripe CLI or dashboard)

**PASS requires:**

- no duplicate transaction
- no duplicate application
- no duplicate canonical payment event

---

### 4. Delayed webhook

- Simulate delay between initiation and webhook arrival

**PASS requires:**

- system remains in pending state
- webhook later finalizes correctly
- no drift or double effect

---

### 5. Concurrent payment edge (controlled)

- Attempt two payments close together

**PASS requires:**

- correct final settlement
- no last-writer-wins drift
- no over-application

---

### 6. Reconciliation visibility

- Verify no hidden inconsistencies

**PASS requires:**

- no silent mismatch between:
  - invoice totals
  - transaction_applications
- no unexpected `reconciliation_required` flags

---

## 📊 Required Artifacts

Capture and store:

- Stripe dashboard event logs
- webhook request logs (Supabase logs)
- DB snapshots:
  - `payment_attempts`
  - `transactions`
  - `transaction_applications`
  - invoice state
- event logs (money-loop / canonical events)
- test notes for each scenario

---

## ✅ PASS Criteria

- No duplicate financial effect under any scenario
- Settlement matches ledger truth exactly
- Webhook replay is safe
- Public-pay + webhook converge on same `provider_payment_id`
- No silent reconciliation drift
- All results reproducible and documented

---

## ❌ FAIL Conditions

Stop and investigate if:

- duplicate transaction or application occurs
- invoice settlement mismatches ledger
- duplicate canonical payment events emitted
- webhook replay creates side effects
- payment appears successful but ledger is incomplete
- reconciliation inconsistencies appear without flags

---

## 🧠 Notes / Constraints

- This is **validation only**, not feature development
- Do not patch production mid-test unless critical
- Any failure becomes a **new P0-02 remediation task**
- Maintain strict traceability between Stripe events and DB records

---

## 🏁 Exit Condition

Ticket is complete when:

- all scenarios pass
- artifacts are captured
- results documented
- system can be labeled:

> **P0-02: PRODUCTION-VALIDATED (pending ongoing monitoring)**

---

## 🔒 Position in Roadmap

- Follows: P0-02.B / C / D / E (local proof)
- Runs alongside: early rollout of P0-02.E (reconciliation sweep)
- Does **not** unblock Phase 1 (P0-03 / P0-04 still required)

