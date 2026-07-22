# Evidence Manifest — ML-P1 Slice 4 A2 (field execution + change orders)

| Field | Value |
| --- | --- |
| Authorized slice / scope | **ML-P1-S4 A2 coding** — job execution FSM, time/mileage, evidence gates, completion, change orders, invoice-on-complete gate, min tech+office UI |
| Coding auth base SHA | `24cec0e4d168a17384a5c16616c41e637a713fdc` (main / PR #93 planning) |
| Branch / worktree | `ml/p1-s4-job-execution` / `F:\Dev\BHFOS-ml-p1-s4` |
| Ratified PDs | 01=B · 02=A · 03=C · 04=B · 05=accept · 06=A |
| **Frozen review head** | 4484b2916744bf0c178f65a1ca2183703041482a |
| Prior code freeze (superseded) | `e6138dd7afc7a0e4b6c630c6132e56eeaf5da631` — does **not** cover control-amendment remediation |
| Migrations | see checksum table below |
| Tests executed | `node --test tests/unit/ml-p1-s4-execution.test.mjs` — **14/14 pass** |
| Tests skipped + reason | Live DB concurrency / production apply / Hostinger deploy / photo storage upload E2E — **not authorized** (A3) |
| Runtime environments tested | Local Node unit + migration/edge/UI source guards |
| Claims proven by **EXECUTED** | Source guards for schema/RPC/invoice gate; PD-S4-02 client deny; mutation-id RPC wiring; UI surfaces import canonical service |
| Claims supported by **SOURCE-ONLY** | Server transition matrix; CO immutability; break-glass proof; completion blockers; alt-writer trigger; S3 compat writer context; no invoice/quote mutate in S4 RPCs |
| Claims **PRODUCTION-UNVERIFIED** | Clean-apply on `wwyxohjnyqnegzbxtuxs`; live concurrent CO approve; live photo upload→readiness; Hostinger UI+edge deploy; appointment sync under guard |
| Known residuals | See `ML-P1_SLICE4_RESIDUAL_REGISTER.md` + open R-COH-08/12/14 |
| Rollback method | Before apply: close/revert PR. After A3: forward-fix function/trigger bodies; feature UI can be unused if RPCs revoked; do not invent invoice path |
| Required reviewers | Product · Data · Security · Financial Control · Architecture · UX/Field · Independent Adversarial Test |

## Migration checksums (working tree at evidence draft)

| File | SHA-256 |
| --- | --- |
| `20260722120000_ml_p1_s4_execution_schema.sql` | `FF131FDDC7D4ACF88B9716632FAA9C629751AEF0659B9314CFFD541508051530` |
| `20260722121000_ml_p1_s4_execution_rpcs.sql` | `0D675132AB0FDDE5F9E6AAB71333E5B344C86F586BE94392A0375287975E25CA` |
| `20260722122000_ml_p1_s4_s3_writer_compat.sql` | `F4817AFC795AC0B16A9F3CFA9BB9F122ED5BBAA605FA0402EC94247A1DD4C5B8` |
| `20260722130000_ml_p1_s4_control_amendment.sql` | `55BCAC7CB4974854A9819847E1964FB9DF4E08C751CD0476CEBFA68B0D43076F` |

**Hard stop:** no merge without exact-head Founder auth; no production migration apply; no Hostinger deploy; no Slice 5 / Stripe / invoice implementation / follow-up / TIS / G2.3.
