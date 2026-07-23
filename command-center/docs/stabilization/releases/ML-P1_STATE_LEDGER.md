# ML-P1 State Ledger

| Field | Value |
| --- | --- |
| Updated | 2026-07-23 |
| Repo | https://github.com/faydog127/BHFOS |
| Worktree | `F:\Dev\BHFOS-ml-p1-s3` (main) |
| origin/main | `ced9bfbbe19289a2747c64bb0ce7206872601a06` |
| Persistent orchestrator prompt | Adopted 2026-07-23; obeys `FOUNDER_DELEGATED_AUTHORITY_POLICY.md` |
| Price-book PR | **MERGED** https://github.com/faydog127/BHFOS/pull/100 @ head `a1c822b` |

## Slice / gate posture

| Slice | Gate | Status |
| --- | --- | --- |
| S1–S3 | Closed | Production coherent; residuals tracked separately |
| **S4** Field execution | **A3 complete** | `SLICE4_PRODUCTION_VALIDATION_PASS`; R-S4-06 remediated; soft residue R-S4-07 (tenant_id stamps) |
| HCP price-book import | **A2-MERGED** | Prod apply PASS earlier; source synced via PR #100 merge `ced9bfb` |
| **S5** Invoice generation | **Planning / PD open** | PR #99 docs; waiting **PD-S5-01…07**; **no A2 coding auth** |

## Production surfaces (known)

| Surface | Note |
| --- | --- |
| Supabase | `wwyxohjnyqnegzbxtuxs` |
| Prod UI | https://app.bhfos.com |
| Invoice-on-Complete | **OFF** until Slice 5 |

## Migrations applied (linked prod, relevant)

| Migration | Topic |
| --- | --- |
| `20260722120000`…`20260722130000` | S4 execution schema/RPCs/control amendment |
| `20260722140000` | R-S4-06 emit actor_id UUID |
| `20260722150000`…`20260722152000` | Price-book HCP fields + code unique + id/updated_at defaults (schema on prod; repo now matched) |

## Price-book (PD-PB-01…04)

| Item | Value |
| --- | --- |
| Status | **A2-MERGED** (PR #100) |
| HCP CSV SHA-256 | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| Evidence bundle SHA-256 | `260C5CB28EE1A7F5E4E76A488C38749926CDC8435608F83A1B421808E90A4158` |
| Detail | `ML-P1_EVIDENCE_MANIFEST.md` / `ML-P1_PRICEBOOK_EVIDENCE_MANIFEST.md` |

## Outstanding residuals / blockers

1. **S5 product decisions** — PD-S5-01…07 unanswered → coding blocked.
2. **R-S4-07** — Soft: row `tenant_id` stamps (non-blocking).
3. **R-PB-01** — Closed by PR #100 merge (source synced).
4. Stale open docs PRs (#94, #87, #86, #85) — hygiene only.

## Standing policies in force

- Auto-continue inside granted slice scope per Founder prompt + `FOUNDER_DELEGATED_AUTHORITY_POLICY.md`.
- Three peer-review rounds before any future code PR merges to `main`.
- Synthetic-only production validation; cleanup required.
- S4 CO / make-safe / invoice-on-complete OFF until Slice 5.

## Halt

**No migrations, deploys, or Slice 5 work** until Founder provides explicit PD-S5 answers.
