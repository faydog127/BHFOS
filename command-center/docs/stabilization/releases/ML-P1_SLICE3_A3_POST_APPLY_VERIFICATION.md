# ML-P1 Slice 3 — A3 Post-Apply I2 Verification

> Founder confirmed: **S3 A3 apply complete**  
> Project: `wwyxohjnyqnegzbxtuxs`  
> Main: `5cd7360aceb5492985cea6f3ff56253e5165bbea`  
> Applied artifact SHA-256 (LF): `50E4362A34ED408C42C86A45DFACA66611A0903703765681C2CC42C4B3F7DD3D`

## Disposition

# **POST_APPLY_VERIFICATION_PASS**

## Checks (I2 read-only catalog / health)

| Check | Result |
| --- | --- |
| `schema_migrations` includes `20260721200000` / `ml_p1_s3_canonical_job_writer` | **PASS** |
| `ml_p1_s3_ensure_job_for_accepted_quote` present, SECURITY DEFINER | **PASS** (args: `p_quote_id uuid, p_correlation_id text, p_actor_role text, p_source text`) |
| `jobs.source_quote_version` column | **PASS** |
| `trg_ml_p1_s2_require_job_gate_off_on_accept` dropped | **PASS** |
| `trg_quotes_ensure_job_and_invoice` still attached | **PASS** (expected — body neutralized by migration; not removed) |
| Jobs INSERT policy `quote_id IS NULL` | **PASS** |
| `jobs_quote_id_unique` retained | **PASS** |
| S2 active unique conflicts | **PASS** (`0` / `0`) |
| Quotes draft-only INSERT/UPDATE RLS | **PASS** |
| S2 lifecycle + public approve RPCs present | **PASS** |
| project-health db/auth/rest | **PASS** (`ACTIVE_HEALTHY`) |

## Not verified in this pass (out of scope / capability)

| Item | Note |
| --- | --- |
| `auto_create_job_on_quote_acceptance` live value | No standing I2 `global_config` op; do **not** flip to true |
| Live approve→job smoke | Requires Edge/frontend deploy (not authorized) + controlled test quote |
| Hostinger / Edge deploy | **Not authorized** |

## Hard locks still in force

No Hostinger deploy · no Edge deploy · no Slice 4 · no Stripe · no invoices · no autonomous follow-up · no TIS · no G2.3 reopen
