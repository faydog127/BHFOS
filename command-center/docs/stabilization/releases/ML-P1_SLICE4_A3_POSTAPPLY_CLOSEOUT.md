# ML-P1 Slice 4 — A3 Post-Apply / Deploy Closeout

| Field | Value |
| --- | --- |
| Classification at close | **PASS** (DB + Edge + Hostinger identity) |
| Authority | Founder merge + conditional production auth 2026-07-22 |
| Merged main tip | `aa2dd72c312dfccc9f43bec3652b651873e2277a` |
| Reviewed code freeze ancestor | `4484b2916744bf0c178f65a1ca2183703041482a` |
| Project | `wwyxohjnyqnegzbxtuxs` |
| Live UI | `https://app.bhfos.com` |

## Merge

- PR [#95](https://github.com/faydog127/BHFOS/pull/95) merged (merge commit, no bypass)
- Tip at merge: `54aef5b70b3eb6ed466ae13356bacf8649b1edbb` (docs-only descendant of code freeze)
- CI: all required checks SUCCESS before merge

## Migrations applied (exact set only)

| Version / file | SHA-256 | Result |
| --- | --- | --- |
| `20260722120000_…_schema.sql` | `FF131FDD…051530` | APPLIED |
| `20260722121000_…_rpcs.sql` | `0D675132…5E25CA` | APPLIED |
| `20260722122000_…_s3_writer_compat.sql` | `F4817AFC…D4C5B8` | APPLIED |
| `20260722130000_…_control_amendment.sql` | `55BCAC7C…0D43076F` | APPLIED |

Method: `supabase db query --linked -f` (not blind `db push`).  
Excluded: `20260721120000_ml_p1_rs101_…` (local-only history conflict; outside S4 set).

## I2 post-apply (EXECUTED)

- Tables present: `change_orders`, `job_time_events`, `job_make_safe_events`, `job_execution_mutations`
- RPCs present: transition, assign/schedule, readiness, make-safe, CO propose/transition, correct_time_event, set_writer_context
- Guard trigger present: `trg_ml_p1_s4_guard_job_execution_write`
- Status contract includes `arrived`, `no_access`, `reschedule_required`, `completion_pending`
- Alt-writer deny probe: **PASS_ALT_WRITER_DENY** (probe function dropped after)

## Edge deploy (EXECUTED)

- `work-order-update` → deployed to `wwyxohjnyqnegzbxtuxs`
- `kanban-move` → deployed to `wwyxohjnyqnegzbxtuxs`

## Hostinger deploy (EXECUTED)

- Built from exact SHA `aa2dd72…`
- Secret scan: 0 findings
- Archive: `crm-aa2dd72c312d.zip`
- Live `build-info.json` `commitSha` = `aa2dd72c312dfccc9f43bec3652b651873e2277a`
- `migrationVersion` = `20260722130000`
- health-probe: **HEALTHY**
- Routes smoke: `/` 200, `/tvg/crm/quotes` 200, `/build-info.json` 200

## Controlled production validation

| Check | Class | Result |
| --- | --- | --- |
| Schema/RPC/guard presence | EXECUTED | PASS |
| Alt writer DENY | EXECUTED | PASS |
| Live UI identity | EXECUTED | PASS |
| Authenticated tech/office workflow E2E | PRODUCTION-PARTIAL | Not run (requires authenticated synthetic operator session) |
| Synthetic job create/cleanup | NOT RUN | No synthetic mutation without dedicated UAT identity this session |

## Residuals (unchanged / open)

- R-COH-08, R-COH-12, R-COH-14
- R-S4-03 customer CO token UI
- R-S4-04 stale S3 unit path test
- Local/remote migration history gap for `20260721120000` (process residual; RS101 previously applied by other means)

## Explicit non-claims

No Slice 5 · no invoice generation · no Stripe · no autonomous follow-up · no TIS · no G2.3 · residuals not closed without evidence.
