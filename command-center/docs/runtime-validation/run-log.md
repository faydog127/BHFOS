# RVH Run Log (Reusable)

Copy this block for each runtime run.

---

Date:
Run ID:
Mode (LOCAL | STAGING | PROD-READONLY):
Chain (RVH-P0-A | RVH-P1-B | RVH-P1-C | other):
Result (PASS | FAIL | BLOCKED):

First failure point (if any):
- Step:
- Error (exact):
- Environment:

Artifact folder:
- `tmp/runtime/<date>/<env>/<run_id>/`

Notes:
- Safety gates passed: YES/NO
- Evidence tuple captured: YES/NO
- Teardown performed (LOCAL/STAGING only): YES/NO
- Blocker + minimum unblock step (if BLOCKED):

---

## Entries (append-only)

Date: 2026-04-16
Run ID: rvh_p1-b_20260416_003449_492938
Mode (LOCAL | STAGING | PROD-READONLY): LOCAL
Chain (RVH-P0-A | RVH-P1-B | RVH-P1-C | other): RVH-P1-B (Quote → Job → Dispatch)
Result (PASS | FAIL | BLOCKED): PASS

First failure point (if any):
- Step: (resolved) Quote approval → job creation trigger
- Error (exact): column "estimate_id" of relation "jobs" does not exist
- Environment: LOCAL

Artifact folder:
- `tmp/runtime/2026-04-16/local/rvh_p1-b_20260416_003449_492938/`

Notes:
- Safety gates passed: YES
- Evidence tuple captured: YES (HTTP response + DB row evidence + projection evidence)
- Teardown performed (LOCAL/STAGING only): YES (best-effort cleanup)
- Fix applied: `supabase/migrations/20260416043000_remove_estimate_id_from_quote_job_trigger.sql`

---

Date: 2026-04-16
Run ID: rvh-p0-a-20260416_005248
Mode (LOCAL | STAGING | PROD-READONLY): LOCAL
Chain (RVH-P0-A | RVH-P1-B | RVH-P1-C | other): RVH-P0-A (Revenue Chain)
Result (PASS | FAIL | BLOCKED): PASS

First failure point (if any):
- Step: (none) End-to-end succeeded
- Error (exact):
- Environment:

Artifact folder:
- (none yet; output is console + DB assertions) — consider running via `scripts/runtime/run-runtime-suite.ps1` for full artifact capture

Notes:
- Safety gates passed: YES (local-only FUNCTIONS_URL)
- Evidence tuple captured: YES (DB assertions: invoice paid; transactions_count=1; stripe_webhook_events_count=1)
- Teardown performed (LOCAL/STAGING only): YES (best-effort cleanup)

---

Date: 2026-04-16
Run ID: rvh-p0-a-20260416_014820
Mode (LOCAL | STAGING | PROD-READONLY): LOCAL
Chain (RVH-P0-A | RVH-P1-B | RVH-P1-C | other): RVH-P0-A (Revenue Chain, artifacted)
Result (PASS | FAIL | BLOCKED): PASS

First failure point (if any):
- Step:
- Error (exact):
- Environment:

Artifact folder:
- `tmp/runtime/2026-04-16/local/rvh-p0-a-20260416_014820/`

Notes:
- Safety gates passed: YES
- Evidence tuple captured: YES (HTTP responses + DB row evidence + idempotency)
- Teardown performed (LOCAL/STAGING only): YES (best-effort cleanup)

---

Date: 2026-04-16
Run ID: rvh-p0-a-20260416_084805
Mode (LOCAL | STAGING | PROD-READONLY): LOCAL
Chain (RVH-P0-A | RVH-P1-B | RVH-P1-C | other): RVH-P0-A (Revenue Chain, artifacted)
Result (PASS | FAIL | BLOCKED): PASS

First failure point (if any):
- Step: (none) End-to-end succeeded
- Error (exact):
- Environment:

Artifact folder:
- `tmp/runtime/2026-04-16/local/rvh-p0-a-20260416_084805/`

Notes:
- Safety gates passed: YES
- Evidence tuple captured: YES (DB assertions + webhook count + tx count)
- Teardown performed (LOCAL/STAGING only): YES (best-effort cleanup)
- Context: rerun after `supabase db reset` + local role bootstrap to clear invoice-screen runtime failures (RPC 404 / leads 400 / offline payment 403).

---

Date: 2026-04-16
Run ID: rvh_p1-c_20260416_015406_8f48c8
Mode (LOCAL | STAGING | PROD-READ-ONLY): LOCAL
Chain (RVH-P0-A | RVH-P1-B | RVH-P1-C | other): RVH-P1-C (Scheduling chain — appointments)
Result (PASS | FAIL | BLOCKED): PASS

First failure point (if any):
- Step:
- Error (exact):
- Environment:

Artifact folder:
- `tmp/runtime/2026-04-16/local/rvh_p1-c_20260416_015406_8f48c8/`

Notes:
- Safety gates passed: YES
- Evidence tuple captured: YES (create-appointment response + appointments list + DB row evidence)
- Teardown performed (LOCAL/STAGING only): YES (best-effort cleanup)

---

Date: 2026-04-16
Run ID: rvh_p1-d_20260416_020126_d0068d
Mode (LOCAL | STAGING | PROD-READ-ONLY): LOCAL
Chain (RVH-P0-A | RVH-P1-B | RVH-P1-C | other): RVH-P1-D (Job scheduling — work-order-update)
Result (PASS | FAIL | BLOCKED): PASS

First failure point (if any):
- Step:
- Error (exact):
- Environment:

Artifact folder:
- `tmp/runtime/2026-04-16/local/rvh_p1-d_20260416_020126_d0068d/`

Notes:
- Safety gates passed: YES
- Evidence tuple captured: YES (quote approval + work-order-update response + DB evidence + dispatch projection)
- Teardown performed (LOCAL/STAGING only): YES (best-effort cleanup)
