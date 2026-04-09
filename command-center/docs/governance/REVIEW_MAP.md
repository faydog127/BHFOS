# Review Map (Gate → Schema → Artifacts)

Purpose:
- Keep peer-review aligned to **machine-enforced requirements** (`review-policy.json` + `tools/review-gate.mjs`).
- Prevent drift in the **review-input schema** used for drafts and run artifacts.
- Give reviewers one document to map: policy → schema/template → evidence artifacts.

SSOT rule:
- If any doc/template conflicts with `review-policy.json` or `tools/review-gate.mjs`, the doc/template is wrong.

Anti-drift workflow:
- After changing `review-policy.json`, run `npm run generate:review-templates`.
- Before peer review / merging governance edits, run `npm run validate:review-governance`.

---

## 1) What is enforced (machine law)

Enforcement sources:
- Policy (SSOT): `review-policy.json`
- Gate (SSOT evaluator): `tools/review-gate.mjs`

Gate input:
- File: `review-input.json` (per-run / per-change submission)
- Command: `npm run review:gate`

Schema + template (human authoring aids):
- JSON Schema: `docs/templates/review-input.schema.json`
- Starter template: `docs/templates/review-input.template.json`

Crucible artifact (human-readable evidence index):
- Template: `docs/templates/CRUCIBLE_ARTIFACT.template.md`

---

## 2) Required top-level fields (schema locked)

Authoritative list:
- `review-policy.json.required_top_level_fields`

Schema source:
- `docs/templates/review-input.schema.json` mirrors `required_top_level_fields`.

Template source:
- `docs/templates/review-input.template.json` contains every required top-level key.

Peer-review rule:
- If someone proposes “just add a field to review-input”, that is a **policy change** and must update:
  - `review-policy.json.required_top_level_fields`
  - `docs/templates/review-input.schema.json` / `docs/templates/review-input.template.json` (via generator)
  - Any reviewers must run `npm run validate:review-governance`

---

## 3) Domain tags & trigger escalation (critical domains)

Authoritative trigger list:
- `review-policy.json.critical_domains`

Gate enforcement:
- `review:gate` rejects any `domain_tags[]` value not present in `review-policy.json.critical_domains`.

Required scenario categories when any critical domain is present:
- `review-policy.json.required_scenario_categories_when_triggered`

Critical-domain required verification keys:
- `review-policy.json.critical_change_requirements`

Doc alignment rule:
- The trigger list is duplicated in governance v2 docs (`docs/governance/AI_ROLES.md`, `docs/governance/APPROVAL_THRESHOLDS.md`, `docs/governance/AUTOPILOT_LOCAL_SPEC.md`) and must match policy.
- Drift is caught by `npm run validate:review-governance`.

---

## 4) Scenarios (required when triggered)

When `domain_tags` intersects `review-policy.json.critical_domains`, `review:gate` requires:
- Each scenario entry has: `category`, `scenario`, `expected_behavior`, `verification_method`, `evidence_required[]`
- Every category listed in `review-policy.json.required_scenario_categories_when_triggered` must be present at least once.
 - Every `evidence_required[]` entry must be a resolvable path (must exist on disk when `require_paths_exist=true`).

Peer-review rule:
- Each scenario’s `evidence_required[]` must point to concrete artifacts you can click/open (run logs, test results, DB outputs, manifests).

---

## 5) Artifacts (evidence rules)

Required artifact types:
- `review-policy.json.required_artifact_types`

Artifact rules:
- `review-policy.json.artifact_rules`

Forbidden as sole proof:
- `review-policy.json.forbidden_as_sole_proof`

Peer-review rule (practical):
- A “good story” without paths/snippets/logs/tests is invalid. Make reviewers ask: “Where is the artifact?”
- Prefer artifact links in a Crucible memo using `docs/templates/CRUCIBLE_ARTIFACT.template.md`.

---

## 6) Coverage requirements

Schema required keys:
- `review-policy.json.required_coverage_fields`

Gate hard rejections include:
- Missing any required coverage fields
- `coverage_report.files_analyzed` empty
- `coverage_report.files_analyzed` must include every `scope.included` file

Peer-review rule:
- “No issues found” is not acceptable unless coverage + uncertainty boundaries are explicit.

---

## 7) Findings requirements

Schema required finding keys:
- `review-policy.json.required_finding_fields`

Gate hard rejections include:
- No findings provided
- Missing finding fields
- Empty `proof[]` or empty `closure_evidence_required[]`

Peer-review rule:
- Findings are allowed to be “OK / no blockers”, but must still be concrete and evidenced.

---

## 8) Concurrency model requirements

Allowed models:
- `review-policy.json.allowed_concurrency_models`

Gate requirements:
- `concurrency_model.model` must be allowed
- `guarantees[]` and `non_guarantees[]` must be non-empty
- If `model=lock_based`, `concurrency_model.lock_strategy` is required

Peer-review rule:
- Treat `guarantees` / `non_guarantees` as contractual language; be explicit about what is *not* guaranteed.

---

## 9) Verification requirements (critical-domain specific)

Authoritative list:
- `review-policy.json.critical_change_requirements`

Gate behavior:
- For each triggered tag, every required `verification.<key>` must exist.

Peer-review rule:
- Verification keys must link to proof (test output, DB outputs, logs, code references).

---

## 10) Readiness requirements (schema + claims)

Allowed statuses:
- `review-policy.json.allowed_readiness`

Allowed labels:
- `review-policy.json.allowed_readiness_labels`

Gate rule:
- `readiness.status` must be allowed.
- If label includes `P0-02: PRODUCTION-VALIDATED`, then `readiness.production_artifacts[]` must be non-empty.

Peer-review rule:
- Do not write “production validated” anywhere unless the artifacts exist and are linked.

---

## 11) Minimal “start today” checklist (operator view)

- Start from `docs/templates/review-input.template.json` to create `review-input.json`.
- Add real paths for artifacts (they must exist when `review-policy.json.artifact_rules.require_paths_exist=true`).
- Run `npm run review:gate`.
- If it fails, the failure list is the reviewer checklist: fix the evidence, not the narrative.
