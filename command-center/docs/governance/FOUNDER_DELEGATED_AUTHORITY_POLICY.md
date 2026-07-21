# Founder Delegated Authority Policy

> Governance / control-plane only. Grants no production credentials and does not
> authorize merge, migration apply, deploy, Slice 2, Stripe, TIS, or G2.3 reopen.
>
> Parent: [`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md)  
> Aligns with: [`APPROVAL_THRESHOLDS.md`](./APPROVAL_THRESHOLDS.md),
> [`PRODUCTION_ACCESS_MATRIX.md`](./PRODUCTION_ACCESS_MATRIX.md),
> [`FOUNDER_RUN_READINESS.md`](./FOUNDER_RUN_READINESS.md)

**Purpose:** Protect Founder Focus. Stop interrupting the Founder for low-risk,
non-intrusive, read-only, reversible work. The Orchestrator acts under **standing
authority** for bounded Category A work and **proceed-and-notify** for Category B.
Category C still requires explicit Founder authorization.

**ML-P1 Slice 2–3:** Also apply the
[`REDUCED_AI_DEVELOPMENT_ASSURANCE_PILOT.md`](./REDUCED_AI_DEVELOPMENT_ASSURANCE_PILOT.md)
**A0–A3** matrix and limited docs-merge rule for the pilot window. The pilot does
not repeal Category C consequential gates.

---

## Decision test

Ask for Founder authorization **only** when one or more are true:

1. Production state changes.  
2. Customer-visible behavior changes.  
3. Financial state changes.  
4. Secrets are exposed, changed, or newly accessed beyond approved diagnostic use.  
5. The action is destructive or difficult to reverse.  
6. A new implementation scope begins.  
7. Material unresolved risk is accepted.  
8. A product or business decision is required.

If **none** apply → proceed under standing authority (A) or proceed-and-notify (B).

**Do not** turn every routine action into a Founder approval gate.  
**Do not** confuse notification with authorization.

---

## Category A — Standing authority (no Founder approval)

The Orchestrator may perform and coordinate these without prior Founder authorization:

### Repository and evidence

- Inspect repository files, code, schemas, migrations, tests, logs, and documentation  
- Search Git history, PRs, issues, commits, and branches  
- Verify SHA, checksum, ancestry, worktree, and PR-head state  
- Compare reviewed and current heads  
- Inspect existing migrations and migration history (repo + approved hosted metadata paths)  
- Identify duplicate, obsolete, or alternate code paths  
- Inspect configuration and dependency versions  
- Maintain evidence indexes and status records  

### Read-only verification

- Run lint, build, type checks, tests, contract checks, and static analysis  
- Run local or disposable test environments  
- Perform bounded read-only checks against **approved** production or hosted systems  
- Inspect **database metadata**: tables, schemas, columns, indexes, functions, triggers, RLS flags, policies, grants, migration state  
- Inspect application, infrastructure, API, Stripe, Supabase, DNS, certificate, tunnel, and deployment **metadata**  
- Inspect logs and health information (no unnecessary customer content)  
- Verify availability and configuration without mutation  

Read-only access **must not** retrieve unnecessary customer row data, payment details, secrets, tokens, or message content.

### Planning and governance

- Draft and revise planning documents  
- Prepare Decision Packets  
- Maintain the Release Baton  
- Map known issues to slices  
- Classify evidence and residual risk  
- Update review matrices  
- Research official documentation and proven industry patterns  
- Reconcile planning documents with established Founder decisions  

### Review coordination

- Dispatch required reviewers  
- Freeze exact PR heads  
- Reject stale reviews  
- Reconcile reviewer findings  
- Require remediation when CI or reviews fail  
- Rerun reviews after remediation  
- Return one consolidated Founder Decision Packet  

### Safe preparation

- Create isolated branches and worktrees from an authorized base  
- Install dependencies locally  
- Generate draft migrations **without applying** them  
- Generate read-only SQL checks  
- Prepare rollback scripts  
- Create fixtures and tests  
- Prepare commands and runbooks without executing consequential actions  
- Push corrections to an existing PR when they remain within its already-authorized scope  
- Open a **draft** PR for already-authorized work  

---

## Category B — Proceed and notify (no prior approval)

The Orchestrator may proceed and then report:

- Creation of an isolated worktree  
- Rerunning CI or reviews  
- Marking a review stale  
- Updating a stale baton  
- Pushing bounded remediation to an already-authorized branch  
- Opening a draft PR within authorized scope  
- Performing a bounded read-only production posture check (approved path only)  
- Documenting a newly discovered issue  
- Pausing work due to a failed test, stale SHA, or unmet gate  
- Correcting non-substantive documentation errors  
- Reassigning reviewers when a review capability fails  

Notification is **not** authorization for Category C actions.

---

## Category C — Explicit Founder authorization required

Require Founder authorization before:

- Merging any PR into `main` (except activated `LOW-RISK_CONTROL_PLANE_CORRECTION` when every eligibility gate is true)  
- Applying any migration  
- Deploying or changing production  
- Inserting, updating, or deleting production data  
- Changing RLS, grants, roles, authentication, or security policies  
- Accessing or rotating secrets beyond approved diagnostic use  
- Sending customer communications  
- Initiating, capturing, refunding, voiding, or changing payments  
- Changing pricing, taxes, fees, discounts, or financial rules  
- Beginning a new implementation slice  
- Materially expanding authorized scope  
- Accepting material residual risk  
- Deleting branches, environments, records, or customer files  
- Committing to vendors, subscriptions, or expenses  
- Making product-boundary or business-policy decisions  
- Enabling autonomous customer-facing behavior  
- Exposing new public endpoints  
- Changing DNS or domain routing  
- Reopening TIS, G2.3, or another explicitly frozen area  

---

## Intra-scope auto-continue (after Category C authorization)

Once the Founder authorizes a slice, deployment, migration, or bounded remediation
**scope**, the Orchestrator may continue through all **previously defined gates
inside that scope** without returning for repeated approval, provided every
required condition has been met and no material scope, artifact, risk, or
production-impact change has occurred.

When all predefined checks pass → **proceed automatically** to the next
authorized action and **report the result**.

**Stop and return to the Founder only when:**

- scope expands;
- the exact artifact or SHA changes outside the reviewed lineage;
- a new migration, deployment target, payment action, customer communication,
  destructive action, or product decision was **not** already included;
- a required check fails;
- material risk changes;
- rollback is unavailable;
- or safe execution is otherwise uncertain.

**Do not** ask the Founder to re-authorize an action that was already
conditionally authorized and whose conditions have now been satisfied.

Examples (Slice 3 pattern):

| Founder line already given | Auto-continue when conditions met |
| --- | --- |
| Merge auth at exact tip | Merge (no second ask) |
| A3 migration apply at exact SHA | Prepare package → Founder SQL apply if Diagnostics cannot write → I2 post-apply |
| Deploy auth at exact tip + Edge set + Hostinger | Edge deploy → Hostinger deploy → post-deploy verification |

First Category C authorization for a new consequential action (e.g. deploy after
only merge/apply were authorized) is still required. Auto-continue applies
**within** that authorization's defined gates, not across unrelated Category C
surfaces.

---

## Guardrails

1. Standing authority does **not** permit bypassing an unavailable capability through an unsafe tool (e.g. banned `execute-sql`, service-role mutation, Dashboard write).  
2. Read-only work must use **approved** read-only paths.  
3. Do not retrieve customer row data when metadata is sufficient.  
4. Do not display secrets, tokens, payment data, or unnecessary PII.  
5. Stop and escalate when a supposedly read-only action could mutate state.  
6. Record material read-only evidence in the applicable Decision Packet.  
7. Do not turn routine Category A/B work into Founder approval gates.  
8. Do not confuse Category B notification with Category C authorization.  
9. `FOUNDER_RUN_READINESS` remains mandatory before asking the Founder to run terminals, OAuth consent, credential entry, dashboards, or protected launchers — and those asks should be rare under this policy.  
10. Intra-scope auto-continue does **not** invent new Category C actions outside the authorized line.  

---

## Metadata vs row data (database)

| Allowed under A (approved path) | Not allowed under A |
| --- | --- |
| `pg_class` / RLS flags, `pg_policy`, grants, indexes, columns, migration version lists | `SELECT` of customer/payment/message rows |
| Policy names, commands, roles, USING/WITH CHECK expressions | Dumping table contents “to see if it works” |
| Health / project status metadata via I2 allowlist | Invoking `execute-sql` Edge Function |

If no approved metadata path exists → disposition **LIVE_CHECK_UNAVAILABLE** (or equivalent). Escalate for **capability provisioning** (Category C product/governance decision), not for “Founder please run this SQL for me” as the default.

---

## Audit and logging

For Category A/B material actions that touch hosted systems or unblock Category C:

- Record path used (adapter operation, dump id, local command) — never secret values  
- Record time (UTC), exact repo SHA, and evidence class (`SOURCE-ONLY` / `HOSTED-METADATA` / `LIVE-METADATA`)  
- Attach summary to the Decision Packet or Release Ledger note  
- Category B: include a short notify line in the Orchestrator status report  

---

## Relationship to other documents

| Document | Relationship |
| --- | --- |
| `OPERATING_MODEL_v2.2.md` | This policy elaborates Founder Focus §6–§7 and §12 without repealing merge/deploy controls |
| `APPROVAL_THRESHOLDS.md` | Auto-continue expanded to match Categories A/B; human approval list remains Category C |
| `PRODUCTION_ACCESS_MATRIX.md` | Orchestrator / Diagnostics **metadata** reads are standing (A) on approved paths; customer row reads remain S/P |
| `FOUNDER_RUN_READINESS.md` | Still gates Founder manual actions; Orchestrator must not invent Founder manual work for Category A tasks |

---

## Version

| Field | Value |
| --- | --- |
| Policy id | `FOUNDER_DELEGATED_AUTHORITY` |
| Governance | v2.2 additive |
| Draft base | `80acb8eb9bcff8771027f76c47257de657a2103e` |
| Status | Proposed for Founder adoption via docs merge |
