# Decision Packet — ML-P1 Slice 4 R-S4-06 remediation

| Field | Value |
| --- | --- |
| Disposition | **REMEDIATION_CODING_AUTHORIZED** (Founder 2026-07-22) |
| Defect | **R-S4-06** — `ml_p1_s4_emit_job_event` wrote text into `events.actor_id` (uuid) |
| Base main | `b6118c83aecf6c3c22985bf28b2d4045afa80e9a` |
| Branch | `fix/ml-p1-s4-r-s4-06-emit-actor-uuid` |
| Migration | `20260722140000_ml_p1_s4_emit_actor_id_uuid.sql` |
| SHA-256 (LF) | `6F13129B4F934E48C165CB1390828AD9FF4A61E44FB29F15442732897531F776` |

## Scope (exact)

- Replace emit helper body so `actor_id = auth.uid()` (uuid) or **NULL** when unauthenticated.
- Do not cast free-form text to UUID.
- Forward migration only (do not edit applied `…221210…`).
- Preserve S4 authz, CO, completion, time/mileage, invoice gating.

## Out of scope

Slice 5 · invoice · Stripe · TIS · G2.3 · R-S4-03/04 · tenant model redesign (R-S4-07 soft residue only).

## Emitter scan

| Emitter | Path | Result |
| --- | --- | --- |
| `ml_p1_s4_emit_job_event` | all S4 job audits | **FIXED** by this migration |
| `job_time_events.actor_id` | transition side-effect | Already `auth.uid()` uuid — OK |
| S3 compat `events` inserts | `…221220…` | Already `NULL` actor — OK |
| Direct `auth.uid()::text` elsewhere in S4 amend | — | None |

## Tests

`node --test tests/unit/ml-p1-s4-execution.test.mjs` — **20/20 pass** (includes R-S4-06 regression suite).
