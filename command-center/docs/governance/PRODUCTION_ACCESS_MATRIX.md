# Production Access and Action Matrix — v2.2

Governance version: **v2.2**
Scope: **governance only.** This document defines *intended* action-level
permissions. It **grants no actual access, provisions no credential, and
configures no production capability.** Actual provisioning is a later, separately
approved controlled implementation.

Parent model:
[`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md). Prior canon remains
authoritative: [`AI_ROLES.md`](./AI_ROLES.md),
[`APPROVAL_THRESHOLDS.md`](./APPROVAL_THRESHOLDS.md).

---

## 1. Authorization categories

Every production action maps to exactly one category. Vague wording such as "may
access production" is prohibited.

| Code | Category | Meaning |
| --- | --- | --- |
| **A** | Allowed within standing authority | Permitted for this role without additional per-release approval, within its defined function. |
| **R** | Allowed only within exact release authorization | Permitted **only** for the exact release/incident, PR, and SHA named in the authorization; invalid outside that scope. |
| **S** | Requires separate explicit human authorization | Permitted **only** after a distinct, explicit human authorization for that specific action, in addition to any release authorization. |
| **P** | Prohibited | Never permitted for this role in v2.2. |

Cross-cutting rules:

- **No role reads raw secret _values_** in v2.2. Secret handling is limited to an
  inventory/map **without values** (see
  [`INCIDENT_AND_PRODUCTION_READINESS.md`](./INCIDENT_AND_PRODUCTION_READINESS.md)).
- **No agent self-authorizes.** "S" always means a human authorization distinct
  from the actor.
- **Builder and Architecture Guard are prohibited from routine production
  operation.**
- Independent UAT production capability is **read/verify-only**, restricted to
  registered synthetic records under a least-privilege test identity, and only
  when the Release Baton authorizes production UAT.
- Incident Commander elevated authorities are scoped to an **active declared
  incident** and recorded in the Ledger; they lapse when the incident closes.

---

## 2. Action-level matrix

Roles: **PO** = Production Operator · **PD** = Production Diagnostics ·
**IC** = Production Incident Commander · **UAT** = Independent UAT ·
**BLD** = V1 Builder · **AG** = Architecture Guard · **REL** = Release Agent ·
**Founder** = Founder / Human Decider.

| Action | PO | PD | IC | UAT | BLD | AG | REL | Founder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Deployment logs (read) | A | A | A | S | P | P | R | A |
| Application logs (read) | A | A | A | S | P | P | R | A |
| Supabase / Edge Function logs (read) | A | A | A | S | P | P | R | A |
| Deployment status (read) | A | A | A | R | P | P | R | A |
| Environment fingerprint / build identity (read) | A | A | A | R | P | P | R | A |
| Health checks (read) | A | A | A | R | P | P | R | A |
| Production authentication (operate) | S | P | S | S (test identity only) | P | P | P | A |
| Synthetic records (read) | R | R | R | R | P | P | P | A |
| Synthetic records (create / cleanup) | R | P | R | S (defined cleanup) | P | P | P | A |
| Real customer records (read) | S | S | S | P | P | P | P | A |
| Real customer records (write) | S | P | S | P | P | P | P | S |
| Controlled production workflow UAT | P | P | S | R (Baton-authorized) | P | P | P | A |
| Deployment (approved SHA) | R | P | R | P | P | P | S | A |
| Rollback (predefined) | R | P | R (containment) | P | P | P | S | A |
| Migrations | S | P | S | P | P | P | S | S |
| Database reads | S | S | S | P | P | P | P | A |
| Database writes | S | P | S | P | P | P | P | S |
| Environment configuration | S | P | S | P | P | P | P | S |
| Secrets (values) | P | P | P | P | P | P | P | S |
| Secret inventory (names only, no values) | R | R | R | P | P | P | P | A |
| Security controls | S | P | S | P | P | P | P | S |
| Customer communications | S | P | S | P | P | P | P | S |
| Invoices | S | P | S | P | P | P | P | S |
| Payments | S | P | S | P | P | P | P | S |
| Refunds | S | P | S | P | P | P | P | S |
| Other financial actions | S | P | S | P | P | P | P | S |
| Destructive operations | S | P | S | P | P | P | P | S |

Legend: **A** allowed within standing authority · **R** allowed only within exact
release authorization · **S** requires separate explicit human authorization ·
**P** prohibited.

---

## 3. Per-role summary

### Production Operator (PO)
Authorized production mechanics only within an exact release/incident
authorization: deploy an approved SHA, verify deployment identity, bounded smoke
testing, explicitly authorized migrations (**S**), health verification,
predefined rollback, approved synthetic-record create/cleanup, and release
reporting. Financial, destructive, security-control, environment-config,
database-write, migration, real-customer-data, and customer-communication actions
each require a **separate explicit** human authorization (**S**). **Never
self-authorizes; never reads secret values.**

### Production Diagnostics (PD)
**Read-only by default.** May read logs, deployment status, Supabase/Edge Function
diagnostics, auth-failure signals, database and migration **state** (read),
environment fingerprints, deployed build identity, browser/network errors, and
health checks. May **not** deploy, write data, run migrations, change
secrets/security controls, send customer communications, or perform financial
actions. Any repair returns to Builder or Production Operator under a **new exact
authorization**.

### Production Incident Commander (IC)
Coordination authority during an **active declared incident** (P0/P1/qualifying
P2). May **direct** PO and PD and choose contain / rollback / bounded forward
repair. Elevated authorities (e.g. real-customer-record read/write, database
writes, financial actions) are **S** — separately authorized, incident-scoped,
ledger-recorded. **Does not** write application code, edit production data
directly, enter credentials, or self-authorize high-risk actions.

### Independent UAT (UAT)
Production access is **read/verify-only**, gated on Baton
`production_test_authorization`, restricted to **registered synthetic records**
under a **least-privilege production test identity**. May perform controlled
production workflow UAT (**R**) only when the Baton authorizes it. May **not**
open real customer/financial records, send communications, or perform any
mutating financial/security/destructive action. Log reads require separate
authorization (**S**).

### V1 Builder (BLD) and Architecture Guard (AG)
**Prohibited from routine production operation.** Both are **P** for essentially
all production actions in this matrix. This is unchanged from their existing
definitions; neither agent file is modified by v2.2 unless a concrete conflict is
demonstrated and separately approved.

### Release Agent (REL)
Mechanical merge of one exact human-authorized PR. May read deployment/logs at
**R** to verify a merge/handoff; deployment, rollback, and migrations are **S**
(separate explicit authorization) — merge authorization alone never authorizes
deployment or migration. Does not operate production beyond the authorized
mechanical merge.

### Founder / Human Decider
Holds ultimate authority; **grants** the **S** authorizations above rather than
performing mechanical work. The founder is not expected to personally execute
deployments, migrations, log review, or credential handling — those are routed to
the designated agent roles under the founder's authorization. Reading production
state is available to the founder (**A**) but is **not required** of the founder
by governance.

---

## 4. Non-provisioning statement

This matrix is a **specification**. No credential is created, no access is
granted, no environment is configured, and no production capability is enabled by
this governance release. Every "A", "R", and "S" above describes what the later
controlled implementation may wire up **under explicit human authorization** — not
anything active today.
