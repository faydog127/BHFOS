TEST RUN VERDICT: `DEPLOY_BLOCKED`
SCOPE: bundle=tmp\orchestrator-v2\examples\04_invariant_violation_deploy_blocked lane=race
RUN SUMMARY: run_id=run_04_invariant_violation_deploy_blocked pass=0 fail=1 mode=deterministic
RESULT BY TEST:
- race_credit_single_winner: FAIL
PROVEN PROPERTY STATUS:
- single_winner_credit_allocation: unproven
- refund_cap_under_contention: unproven
CONFIDENCE CHANGE: unavailable_no_prior_run
DEPLOYMENT RISKS STILL OPEN:
- Invariant violation: over-allocation observed.
NEXT ACTION TYPE: `code_fix`
NEXT BEST ACTION: Resolve the blocking/caution condition and rerun the same evaluator.
RAW ARTIFACT GAPS:
- artifacts/race_credit_single_winner/stdout.txt
- artifacts/race_credit_single_winner/stderr.txt
- artifacts/race_credit_single_winner/db_snapshot.json
- artifacts/race_credit_single_winner/workers.json
- artifacts/race_credit_single_winner/timing.json
