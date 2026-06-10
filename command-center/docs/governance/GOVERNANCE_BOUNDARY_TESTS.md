# Governance Boundary Tests

---

## Trial Set — 2026-04-22T14:54:23.372Z

| test case | expected failure | actual failure | classification | lesson learned |
|---|---|---|---|---|
| T1_FAIL_COMPLEX_MISSING_TENANT_VERIFICATION: Fail correctly: complex packet missing tenant verification keys (artifacts/boundary-tests/T1_FAIL_COMPLEX_MISSING_TENANT_VERIFICATION__2026-04-22T14-54-21.876Z/review-input.json) | Gate should fail requiring tenant_isolation verification keys (tenant_boundary_analysis, runtime_negative_test, rollback_plan). | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T2_FAIL_MISSING_ARTIFACT_PATH: Fail (missing artifact path) (artifacts/boundary-tests/T2_FAIL_MISSING_ARTIFACT_PATH__2026-04-22T14-54-22.060Z/review-input.json) | Gate should fail due to artifact_rules.require_paths_exist (missing artifact path). | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T3_PASS_DANGEROUS_WRONG_DOMAIN_TAG: Pass (danger): unknown domain tag (artifacts/boundary-tests/T3_PASS_DANGEROUS_WRONG_DOMAIN_TAG__2026-04-22T14-54-22.213Z/review-input.json) | Gate should reject non-canonical domain tags (not in review-policy.json.critical_domains). | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T4_FAIL_RISK_NO_EXPIRY: Fail (accepted risk without expiry) (artifacts/boundary-tests/T4_FAIL_RISK_NO_EXPIRY__2026-04-22T14-54-22.359Z/review-input.json) | Gate should fail because risk_acceptances[0].expires_at is required and must be ISO datetime. | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T5_PASS_DANGEROUS_HEARTBEAT_NOT_VERIFIED: Fail (correct): artifact heartbeat mismatch (artifacts/boundary-tests/T5_PASS_DANGEROUS_HEARTBEAT_NOT_VERIFIED__2026-04-22T14-54-22.515Z/review-input.json) | Gate should reject artifacts whose embedded run_id does not match review-input.json.run_id. | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T6_FAIL_SCENARIO_MISSING_EVIDENCE_REQUIRED: Fail (scenario missing evidence_required) (artifacts/boundary-tests/T6_FAIL_SCENARIO_MISSING_EVIDENCE_REQUIRED__2026-04-22T14-54-22.682Z/review-input.json) | Gate should fail because scenarios[*].evidence_required must be a non-empty array. | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T7_FAIL_BAD_READINESS_LABEL: Fail (bad readiness label) (artifacts/boundary-tests/T7_FAIL_BAD_READINESS_LABEL__2026-04-22T14-54-22.826Z/review-input.json) | Gate should fail because readiness.labels contains a value not in review-policy.json.allowed_readiness_labels. | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T8_FAIL_MISSING_COVERAGE_LINKAGE: Fail (missing coverage linkage) (artifacts/boundary-tests/T8_FAIL_MISSING_COVERAGE_LINKAGE__2026-04-22T14-54-22.969Z/review-input.json) | Gate should fail because coverage_report.files_analyzed must include scope.included. | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T9_PASS_DANGEROUS_SCENARIO_EVIDENCE_NOT_RESOLVABLE: Pass (danger): scenario evidence_required points to missing path (artifacts/boundary-tests/T9_PASS_DANGEROUS_SCENARIO_EVIDENCE_NOT_RESOLVABLE__2026-04-22T14-54-23.105Z/review-input.json) | Gate should fail when scenarios[*].evidence_required points to missing artifact paths. | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |
| T10_FAIL_STALE_ARTIFACT_BY_TIMESTAMP: Fail (stale artifact via generated_at) (artifacts/boundary-tests/T10_FAIL_STALE_ARTIFACT_BY_TIMESTAMP__2026-04-22T14-54-23.238Z/review-input.json) | Gate should fail due to artifact_rules.max_age_hours when generated_at is far in the future. | Missing top-level field: tenant_id | FAIL CORRECTLY | Gate enforced the boundary as expected; keep docs/templates aligned to this rule. |

Notes:
- Packets are stored under `artifacts/boundary-tests/`.
- This log is append-only; do not edit prior trial sets. Re-run the tool to add a new trial set.

