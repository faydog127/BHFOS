# LOW-RISK_CONTROL_PLANE_CORRECTION Lane

Governance version: **v2.2** (Founder Focus additive)
Scope: **governance / control-plane only.**

Parent model: [`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md).
Authority source: Founder Decision — G2.3 Founder Focus Governance (Option B).

## Activation

Delegated Release Agent merge authority described here becomes active **only
after** the governance PR that introduces this lane is itself reviewed,
Founder-authorized by exact PR/SHA, and merged to `main`. Until then, Founder
exact PR/SHA merge authorization remains mandatory for every PR, including this
one.

## Purpose

Allow mechanical merge of low-risk control-plane corrections without Founder
merge authorization **only** when every eligibility gate below is true. This
does not weaken Founder authority for credentials, OAuth, production,
diagnostics, deploy, migration, financial, customer, or residual-risk work.

## Eligible examples

- launcher quoting and path handling
- stale SHA-pin corrections
- readiness-check defects
- status-output formatting
- governance and documentation alignment
- regression and self-test additions
- non-production local-tooling corrections

## Required flow

1. Builder implements and opens PR
2. Automated checks pass on the exact head
3. Architecture Guard exact-head review
4. Orchestrator verifies lane eligibility and records the basis
5. Release Agent performs only the mechanical merge with exact-head guard

## Eligibility gates (all must be true)

1. No credential creation, rotation, storage, scope, or access change
2. No OAuth consent, token issuance, refresh, revocation, or use
3. No production read or write begins
4. No production diagnostics begins
5. No deployment or rollback authority changes
6. No database or Edge Function migration
7. No production mutation
8. No financial action
9. No customer or external communication
10. No customer-facing application behavior changes
11. No security boundary is weakened
12. No material residual risk is accepted
13. Architecture Guard approves the exact head
14. All required checks pass on the exact head
15. Orchestrator verifies lane eligibility and records the basis
16. Release Agent performs only the mechanical merge with exact-head guard

If any gate is false or uncertain → **stop**. Founder exact PR/SHA merge
authorization remains mandatory.

## Explicitly excluded (Founder merge always required)

- credentials
- OAuth
- production access
- production diagnostics
- deployment
- rollback activation
- migrations
- production mutation
- financial actions
- customer communication
- material residual-risk acceptance
- customer-facing behavior
- this governance change itself (bootstrap: Founder merge required)

## Orchestrator recording requirement

Before Release Agent may use delegated merge, the Orchestrator must record on
the Release Baton (or equivalent handoff):

- lane: `LOW-RISK_CONTROL_PLANE_CORRECTION`
- exact PR and head SHA
- yes/no for each eligibility gate
- Architecture Guard verdict and head SHA
- required checks green evidence
- statement that Founder merge authorization is omitted under this lane

## Release Agent constraints

- Merge only the named PR at the exact approved head SHA
- Re-verify gates 13–16 immediately before merge
- If the head moves, eligibility is void
- Never deploy, migrate, or access production from this lane
- Record TECHNICAL RESULT / GOVERNANCE STATUS / AUTHORIZED NEXT STATE
