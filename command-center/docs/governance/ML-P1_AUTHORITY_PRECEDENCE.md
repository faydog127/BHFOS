# ML-P1 Authority Precedence Statement

| Field | Value |
| --- | --- |
| Effective | 2026-07-23 |
| Authority | Founder Erron (directive in Orchestrator control session) |
| Scope | ML-P1 Slice 8 remediation and all subsequent ML-P1 production actions |
| Does not rewrite | Prior A3 deploy/reachability closeout evidence |

## Conflict being resolved

Two governance streams can appear to disagree:

1. **Default human-authorization / access-matrix S**  
   `PRODUCTION_ACCESS_MATRIX.md` requires category **S** (separate explicit human authorization) for production mutate / merge / deploy / migrate actions. Agents may not self-authorize.

2. **ML-P1 Founder Delegated-Authority Policy (v2026-07-23)**  
   Allows Orchestrator auto-continue (peer review → CI green → auto-merge → A3 migrate/validate/Hostinger) inside ratified PD gates, escalating only for listed Major Decisions.

## Precedence (binding)

1. **Latest explicit Founder directive for the named release/action wins** over both the standing auto-continue pipeline and any older baton wording.
2. For **Slice 8 security & functional remediation** (this release):
   - Delegated auto-merge / auto-migrate / auto-deploy is **suspended**.
   - Merge, production migration apply, and Hostinger deploy require **explicit Founder authorization after evidence presentation** (Access Matrix **S** for those actions).
   - This is also Major Decision **#6** (auth/integrity FAIL) and **#8** (security invariant break) under `FOUNDER_DELEGATED_AUTHORITY_POLICY.md`.
3. Outside this remediation halt, the Delegated-Authority Policy remains the standing continue-automatically rule **unless** a newer Founder directive or Major Decision applies.
4. Access Matrix **P** (prohibited) and Founder Major Decision list always win over auto-continue.
5. Builder-generated “peer review APPROVED” stubs are **not** independent review and never satisfy review gates.

## Slice 8 acceptance posture (reconciled)

| Claim | Status |
| --- | --- |
| Deployed / reachable on production (A3 structural) | **True** — PR #109 merge `c04d0cae…`, tip docs PR #110 `f39045ca…`, migration `20260723160000` |
| Functional acceptance | **Withdrawn** |
| Security acceptance | **Withdrawn** |
| Field-usability acceptance | **Withdrawn** |
| Photo Bundles / S7 | **Deferred** — do not begin |

Disposition label:

**DEPLOYED/REACHABLE — FUNCTIONAL AND SECURITY ACCEPTANCE WITHDRAWN — REMEDIATION REQUIRED**
