# Reduced AI Development Assurance Pilot

> Governance / process only. Covers **ML-P1 Slice 2 and Slice 3** only.
> Does **not** authorize product implementation, migration apply, deploy,
> production mutation, Stripe, autonomous follow-up, TIS, or G2.3 reopen.
>
> Parent: [`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md)  
> Complements: [`FOUNDER_DELEGATED_AUTHORITY_POLICY.md`](./FOUNDER_DELEGATED_AUTHORITY_POLICY.md)

**Status:** Active upon merge to `main`.  
**Duration:** Begins immediately; ends after Slice 3 acceptance.  
**Then evaluate each control:** STANDARDIZE | ADJUST | REMOVE (measured evidence only).

---

## Purpose

Improve at least one of:

1. Development speed  
2. Defect prevention  
3. Reduction of rework  
4. Reduction of Founder interruptions  
5. Quality of executed evidence  

Any control that does not produce one of those benefits must be simplified or removed.

This pilot operates **inside** active Money Loop development. It is **not** a
separate project, prerequisite phase, or reason to delay R-S1-01 or Slice 2.

---

## 1. Delegated authority (A0–A3)

Maps onto and refines
[`FOUNDER_DELEGATED_AUTHORITY_POLICY.md`](./FOUNDER_DELEGATED_AUTHORITY_POLICY.md)
for the pilot window. Where both apply, use this matrix for Slice 2/3 work.

### A0 — Observe (no approval, no advance notification)

- Inspect repo, schemas, tests, migrations, docs  
- Inspect Git/PR/review state; verify SHAs, checksums, ancestry, worktrees  
- Run lint, build, type checks, tests, contract checks, static analysis  
- Bounded read-only DB **catalog/metadata** via approved paths  
- Inspect Stripe/Supabase/DNS/API/cert/infra **metadata** without mutation  
- Research official docs and proven patterns  
- Identify duplicate paths, deprecated writers, dead code, unresolved risks  

**Never** under A0: customer rows, payment-card data, private communications,
secrets, tokens, credentials. Prefer metadata when sufficient.

### A1 — Prepare and remediate (proceed and notify)

- Isolated branches/worktrees from approved base; local deps  
- Decision Packets; draft migrations (**unapplied**); rollback/verify scripts  
- Tests, fixtures, disposable local envs  
- Baton / evidence updates; draft PRs in authorized scope  
- Rerun CI/reviews; mark stale; dispatch replacement reviewers  
- Non-substantive doc corrections  
- Push remediation that **directly** resolves CI failures, assigned reviewer
  blockers, or defects against **authorized** acceptance criteria  

**A1 must not** introduce new product capabilities, business behavior, public
endpoints, unrelated schema, material new dependencies, or expanded scope.

### A2 — Implement (one Founder auth per slice)

After Founder authorizes a slice, Orchestrator coordinates the full
implementation and review cycle **without** returning for routine actions:

- Implementation within authorized scope  
- Bounded remediation; new commits on authorized branch  
- CI/review reruns; exact-head freezes; evidence collection  
- Final merge Decision Packet preparation  

Do **not** request Founder approval for every remediation commit, test rerun,
or review cycle.

### A3 — Consequential (explicit Founder authorization)

- Merge **product** code into `main`  
- Apply any migration; deploy; change production  
- Insert/update/delete production data; change financial state  
- Payments (initiate/capture/void/refund)  
- Customer communications outside already enabled approved rules  
- Pricing/taxes/discounts/fees/business policies  
- Auth / RLS / grants / roles / security policies  
- Expose or rotate secrets  
- Start a new implementation slice; materially expand scope  
- Accept material residual risk  
- Delete environments/records/customer files  
- Change product boundaries; enable new autonomous customer-facing workflow  
- Reopen TIS, G2.3, or another frozen area  

---

## 2. Limited docs-merge authority (pilot only)

Orchestrator may merge a clearly non-consequential **documentation or
generated-evidence** correction **without** separate Founder authorization
**only when all** are true:

- no product decision changes  
- no governance authority expands  
- no product code changes  
- no schema or migration changes  
- no dependency or configuration changes  
- no security / customer-visible / financial / runtime behavior changes  
- change remains inside already approved scope  
- required CI green  
- merge recorded and reported to Founder  

If **any** condition is uncertain → do **not** use this authority.

Still require Founder approval: roadmaps, product boundaries, implementation
authorizations, risk acceptances, **material policy** changes (including this
pilot’s adoption onto `main`).

---

## 3. Risk-based review

Use only reviewers justified by actual risk. Do **not** assign five reviewers
because five roles exist.

| Change class | Reviewers |
| --- | --- |
| Docs / nonfunctional | Product or Governance; CI where applicable |
| Low-risk isolated code | Product; one relevant technical reviewer; CI |
| Field workflow | Product; UX/Field; relevant technical; real-device when required |
| Data or schema | Data Guard; Architecture Guard; Security only if authz/sensitive data |
| Authorization or security | Security; Architecture; Product if workflow changes |
| Money state | Product; Data; Security; Financial Control; Architecture when schema/txn/concurrency/state boundaries affected |
| Production apply or deploy | Relevant technical; Release/Production; live posture evidence; **Founder auth** |

Independence = different **methods** (spec-derived tests, diff inspection,
runtime, negatives, financial-control, business-workflow, real-device) — not
role names alone.

---

## 4. Lightweight evidence manifest

Every implementation PR includes one concise
[`templates/EVIDENCE_MANIFEST.template.md`](./templates/EVIDENCE_MANIFEST.template.md).

Rules: auto-fill where practical; link artifacts; no essay; &lt;5 minutes manual
effort; Builder cannot self-certify executed claims without durable evidence;
reviewer cannot approve above the manifest’s evidence level.

---

## 5. Independent adversarial testing

Required only for consequential work involving: money states, identity,
authorization, idempotency, automation, migrations, external event processing.

Test role derives cases from approved spec, contracts, acceptance criteria, and
known issues — **not** from the Builder’s claim of what was implemented.

Skip for trivial documentation or cosmetic work.

---

## 6. Small BHFOS Sentinel Suite

See [`../stabilization/releases/ML-P1_PILOT_SENTINEL_SUITE.md`](../stabilization/releases/ML-P1_PILOT_SENTINEL_SUITE.md).

Five to seven initial cases only. Run relevant subset per PR. Sentinel creation
**must not** delay Slice 2. No benchmark platform.

---

## 7. Pilot measurements (S2 + S3 only)

See [`../stabilization/releases/ML-P1_PILOT_MEASUREMENTS.yaml`](../stabilization/releases/ML-P1_PILOT_MEASUREMENTS.yaml).

Track only: Founder interruptions; elapsed auth→reviewed PR; remediation rounds;
defects pre- vs post-merge; governance time % of slice effort.

---

## 8. Stop and simplification

Simplify, suspend, or remove a control when it: creates new low-risk Founder
approvals; exceeds ~5 minutes recordkeeping per PR; delays critical path without
finding material defects; duplicates reviewers without new evidence; raises
governance effort without reducing rework; or cannot show credible benefit.

When uncertain between two non-consequential levels → choose the lower-friction
level. Escalate only for defined consequential conditions.

---

## 9. Duration and exit

| Milestone | Action |
| --- | --- |
| Now (on `main`) | Pilot active for S2/S3 |
| After Slice 3 acceptance | Evaluate every control: STANDARDIZE / ADJUST / REMOVE |
| Before that review | Do **not** make the pilot permanent |

---

## 10. Program impact (hard locks)

The pilot must **not**:

- create a separate assurance implementation phase  
- delay R-S1-01 posture check or migration gate  
- delay Slice 2  
- reopen V1/V2 product planning  
- alter the approved Money Loop roadmap  
- independently authorize migration, deploy, or production mutation  
- authorize Stripe, autonomous follow-up, TIS, or G2.3  

---

## Decision test (shortcut)

Ask Founder only if production / customer-visible / financial / secrets /
destructive / new scope / material risk / product decision. Otherwise A0–A2.
