# Evidence Manifest — ML-P1 Slice 6 (closed)

| Field | Value |
| --- | --- |
| Disposition | **SLICE6_PRODUCTION_VALIDATION_PASS** |
| Exact A2 head | `02238f4edd506c0756e74d1dbd0f0640f999b5bb` |
| Flags | `invoice_auto_send_enabled=false` |
| E2E | sk_test harness `tools/ml-p1-s6-synth-sk-test-validation.mjs` — PASS |

## Migrations (checksums)

| Version | SHA-256 |
| --- | --- |
| `20260723140000_ml_p1_s6_payment_settings.sql` | `1E268248A1028DBAE04856B96F219ADEC5B43E8D4F1AEB307A68520CD7FFB0D9` |
| `20260723150000_ml_p1_s6_settlement_s4_writer_compat.sql` | `870E76CADFEAC37BA41AB789AD565EB18A9FCB28A076EDE8490444F5A5F38737` |
| `20260723151000_ml_p1_s6_refund_omit_generated_balance.sql` | `AB76A38B86736017BBE836F4044FE5DA7E795F6111614E8ABC5C3F3FF5663122` |

## Artifacts

- `ML-P1_SLICE6_A3_POSTAPPLY_CLOSEOUT.md`
- `ML-P1_SLICE6_FULL_THREAT_E2E_REPORT.md`
- `docs/governance/decisions/ML-P1_SLICE6_SETTLEMENT_S4_WRITER_INTERRUPT.md`
- `tools/ml-p1-s6-synth-sk-test-validation.mjs`
