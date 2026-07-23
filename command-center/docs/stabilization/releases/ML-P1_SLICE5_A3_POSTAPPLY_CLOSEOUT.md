# ML-P1 Slice 5 — A3 Post-Apply / Deploy Closeout

| Field | Value |
| --- | --- |
| Classification at close | **PASS** (DB + Edge + Hostinger + synth structural) |
| Authority | Founder Delegated-Authority Policy v2026-07-22 |
| Merged main tip (deployed) | `2b37985e25f2afbd6ac209982f724aadd4da404d` |
| Exact code SHA | `f5f0e0969ace339854dda582bd2c9e66a77b3199` |
| Project | `wwyxohjnyqnegzbxtuxs` |
| Live UI | `https://app.bhfos.com` |

## Migrations applied (exact set only)

| Version / file | SHA-256 | Result |
| --- | --- | --- |
| `20260723120000_…_schema.sql` | `1ACE47BFFC160A3E…9F8E59` | APPLIED |
| `20260723121000_…_rpcs.sql` | `A142DB9301EA9556…7AB268` | APPLIED |
| `20260723122000_…_auto_draft_trigger.sql` | `95C29577922944BC…F19C91` | APPLIED |

Method: `supabase db query --linked -f` (not blind `db push`).  
Versions recorded in `supabase_migrations.schema_migrations`.

## I2 post-apply (EXECUTED)

- Table: `invoice_execution_mutations` present
- RPCs: readiness, create, draft_update, issue, void + role helpers
- Triggers: `trg_ml_p1_s5_job_completed_auto_draft`, `trg_ml_p1_s5_invoice_immutable`
- Grandfather: **25** invoices, `s5_created=0`, `total_sum=11985.19` unchanged

## Edge deploy (EXECUTED)

- `work-order-update` → `wwyxohjnyqnegzbxtuxs` (S5 alt-writer deny)

## Synthetic validation (no real-customer mutations)

| Check | Result |
| --- | --- |
| Grandfather count/sum unchanged | PASS |
| `ml_p1_s5_invoice_readiness` callable | PASS |
| Issued financial immutability probe | **PASS_ISSUED_IMMUTABLE** |
| Auto-draft trigger present | PASS |
| Create/issue on live customer jobs | **NOT RUN** (would mutate real money path) |

## Hostinger deploy (EXECUTED)

- Built from exact SHA `2b37985…`
- Secret scan: 0 findings
- Archive: `crm-2b37985e25f2.zip`
- Live `build-info.json` `commitSha` = `2b37985e25f2afbd6ac209982f724aadd4da404d`
- `migrationVersion` = `20260723122000`
- health-probe: **HEALTHY**
- Routes: `/` 200, `/tvg/crm/quotes` 200, `/build-info.json` 200

## Residuals

| ID | Note |
| --- | --- |
| R-S5-04 | Grandfather lineage incomplete (by design) |
| R-S5-07 | Auto-draft soft-fail → events insert |
| R-S5-08 | Write-off RPC/UI deferred (S5b/S6-compatible) |

## Explicit non-claims / still blocked without Major Decision

- Invoice **auto-send** / **auto-charge** remain OFF (policy escalation #3)
- No Stripe settlement / revenue recognition (Slice 6 — next under delegated auth)
- No historical financial rewrite
- No column/table drops
