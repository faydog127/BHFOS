# ML-P1 Slice 3 — A3 Pre-Apply Live Evidence (I2)

> Read-only. Project `wwyxohjnyqnegzbxtuxs`. Main `5cd7360aceb5492985cea6f3ff56253e5165bbea`.
> Companion: [`ML-P1_SLICE3_A3_APPLY_DECISION_PACKET.md`](../../governance/decisions/ML-P1_SLICE3_A3_APPLY_DECISION_PACKET.md)

## Artifact checksum (independent)

| Source | SHA-256 | Bytes | Notes |
| --- | --- | --- | --- |
| `git cat-file blob 40eaf143…` (LF) | `50E4362A34ED408C42C86A45DFACA66611A0903703765681C2CC42C4B3F7DD3D` | 28432 | **Authoritative for A3** |
| Working-tree checkout (CRLF) | `B618AF707546150773784B71728BE75CE27C0A2B6D7814CF43EEFD41626579B1` | 29332 | Prior report; non-authoritative |

## I2 ops executed

- `--self-test` PASS  
- `project-health` → db/auth/rest ACTIVE_HEALTHY  
- `catalog_migration_history`  
- `catalog_columns` jobs + quotes  
- `catalog_indexes` jobs  
- `catalog_triggers` quotes  
- `catalog_policies` jobs + quotes  
- `catalog_rls_flags` jobs + quotes  
- `catalog_function_signature` (S2 RPCs, ensure_job, WO, S3 writer, gate helpers)  
- `catalog_quotes_s2_active_unique_conflict_counts` → 0 / 0  

Audit appends to `%LOCALAPPDATA%\BHFOS\production-diagnostics\adapter-audit.jsonl` (no tokens/rows).

## Pre-apply snapshot (aggregate / catalog only)

| Item | Live |
| --- | --- |
| S3 migration version | absent |
| S3 writer function | absent |
| `jobs.source_quote_version` | absent |
| `jobs_quote_id_unique` | present |
| S2 gate belt trigger | present |
| `ensure_job` trigger | present |
| Quotes draft RLS | present |
| S2 active unique conflicts | 0 / 0 |
