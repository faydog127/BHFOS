# I2 Aggregate Precheck — Adversarial Test

| Field | Value |
| --- | --- |
| Verdict | **PASS** |

| Case | Result |
| --- | --- |
| SELECT-only template | PASS |
| Extra params DENY | PASS |
| Agent SQL DENY | PASS |
| Outer SELECT has no tenant/lead/customer/token | PASS |
| Response sanitizer strips leak fields | PASS |
| Dry-run no SQL echo | PASS |
| Writable `/database/query` DENY | PASS |

Executed: `npm run test:supabase-diagnostics-adapter`.
