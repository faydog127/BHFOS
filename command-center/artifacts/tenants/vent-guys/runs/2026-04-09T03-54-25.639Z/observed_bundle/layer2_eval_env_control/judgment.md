TEST RUN VERDICT: `DEPLOY_CAUTION`
SCOPE: bundle=tmp\orchestrator-v2\examples\03_environment_failure lane=race
RUN SUMMARY: run_id=run_03_environment_failure pass=0 fail=1 mode=deterministic
RESULT BY TEST:
- race_credit_single_winner: FAIL
PROVEN PROPERTY STATUS:
CONFIDENCE CHANGE: unavailable_no_prior_run
DEPLOYMENT RISKS STILL OPEN:
- No correctness signal; environment prevented execution.
NEXT ACTION TYPE: `environment_fix`
NEXT BEST ACTION: Resolve the blocking/caution condition and rerun the same evaluator.
RAW ARTIFACT GAPS:
- artifacts/race_credit_single_winner/stderr.txt
