# BHFOS Product Architecture — V1 / V2 Boundary (Authoritative)

> **Docs only.** Does not authorize implementation, migrations, deploy, or
> production mutation.
>
> Founder product decisions encoded here supersede earlier planning language that
> assumed **shared multi-tenancy** as a V2 destination.

---

## 1. V1 product model (current)

| Field | Value |
| --- | --- |
| Operator | **The Vent Guys (TVG)** only |
| Deployment | One operating company on the current V1 runtime |
| Money loop | Lead → quote → accept → job → invoice → **Stripe payment** → receipt/close |
| Follow-up | **Autonomous** customer/revenue follow-up required (approved rules; not open-ended AI) |
| Workflow engine | Subject to separate V1 analysis — **not** pre-classified as non-goal |
| Shared multi-tenancy | **Not applicable** |

### V1 security / integrity controls (retain)

Authentication · internal role authorization · least privilege · deny-by-default
server enforcement · unauthorized-write prevention · canonical money writers ·
auditability · idempotency · data integrity · secret isolation · backup/recovery ·
payment security · valid company (TVG) context on money writes (missing/malformed → DENY).

### V1 value focus

Money Loop and related work optimize **TVG operational value**: conversion,
collection speed, admin labor, field adoption, error reduction — not platform
generality for its own sake.

---

## 2. V2 authoritative product model

**BHFOS V2** is a **configurable, white-label, single-company** application
deployed as a **dedicated instance per operating company**.

| Property | V2 rule |
| --- | --- |
| Runtime | **One company ↔ one dedicated application instance** |
| Data | **Dedicated data environment** per company |
| Config | Dedicated company configuration |
| Auth | Dedicated authentication and roles |
| Payments | Dedicated Stripe/payment configuration |
| Brand | Dedicated branding and communications |
| Isolation | Isolated operational data — **no shared tenant runtime** |
| Codebase | Same product codebase may be reused; **no shared-tenant data model** |

**Shared multi-tenancy is removed from V2 scope.** Do not preserve it as an
assumed future requirement unless the Founder **explicitly reauthorizes** it
after customer demand and operating economics justify it.

---

## 3. Configurable white-label scope (V2)

Prefer **configuration** over company-specific code forks:

- Company identity and branding  
- Contact information and domain  
- Service catalog  
- Pricing  
- Tax and fee rules  
- Service areas  
- Users and internal roles  
- Stripe credentials and payment settings  
- Quote, job, invoice, and report templates  
- Communication templates  
- Follow-up timing and enable/disable controls  
- Workflow settings  
- Inspection forms  
- Status labels  
- Review-request rules  
- Business hours  
- Notifications  
- Document numbering  
- Integrations  

---

## 4. Multi-tenant assumption audit (reclassification)

| Prior assumption | Reclassification | Notes |
| --- | --- | --- |
| Shared multi-tenancy as V2 destination | **REMOVE** | Replaced by dedicated single-company instances |
| Cross-tenant isolation / G-03 cross-tenant suite | **NOT APPLICABLE** (V1 & V2 Money Loop) | No shared-tenant runtime |
| Tenant switching UX | **REMOVE** | One company per instance |
| Shared-runtime tenant provisioning | **REPLACE WITH SINGLE-COMPANY CONTROL** | Instance provisioning / config bootstrap |
| Shared-database tenant RLS (multi-org) | **NOT APPLICABLE** | Per-instance DB/env isolation |
| Tenant-level billing in shared runtime | **REPLACE WITH SINGLE-COMPANY CONTROL** | Per-instance commercial terms outside shared-tenant billing |
| Tenant-specific shared-runtime configuration | **REPLACE WITH SINGLE-COMPANY CONTROL** | White-label config on dedicated instance |
| Multi-tenant Stripe architecture | **REPLACE WITH SINGLE-COMPANY CONTROL** | Dedicated Stripe credentials per instance |
| Cross-tenant negative tests | **NOT APPLICABLE** | Do not block V1 or V2 Money Loop |
| `tenant_id` / company context on rows | **RETAIN FOR ANOTHER VALID REASON** | V1 TVG context integrity; V2 may keep company_id within a single instance for lineage — **not** multi-tenant RLS |
| Estimates INSERT DENY | **RETAIN FOR ANOTHER VALID REASON** | Canonical money path / dual-writer prevention — **not** multi-tenancy |
| Internal role matrix | **RETAIN FOR ANOTHER VALID REASON** | Single-company least privilege |
| Session/context required on money writes | **REPLACE WITH SINGLE-COMPANY CONTROL** | Valid company context; deny missing/malformed |

---

## 5. Value-proof rule (platform priority)

No major platform capability gains priority merely because it is architecturally
desirable. It must show a credible path to one or more of:

- revenue generation  
- higher conversion  
- faster payment collection  
- reduced administrative labor  
- improved field adoption  
- reduced operating error  
- stronger customer retention  
- meaningful product differentiation  
- validated customer willingness to pay  

For each major V2 capability, record:

| Field | Required |
| --- | --- |
| Business hypothesis | What improves for whom |
| Target user | Role / buyer |
| Expected operational or revenue effect | Quantified where possible |
| Measurement method | Metric + window |
| Minimum evidence required | Before continuing investment |
| Continuation / redesign / stop | Decision rule |

### Starter value-proof register (illustrative — fill at V2 kickoff)

| Capability | Hypothesis (draft) | Stop if |
| --- | --- | --- |
| White-label branding/config | Second company onboarded without fork | Requires code fork for every customer |
| Dedicated-instance deploy automation | Time-to-live instance < agreed SLA | Manual deploy remains cheaper than automation build |
| Configurable follow-up timing | Collection cycle time ↓ without eng changes | Operators never change timings |
| Visual workflow builder | Willingness-to-pay for self-serve flows | Lightweight config covers paid demand |

---

## 6. Dedicated-instance operations (minimum — do not overbuild early)

Before the **first external customer** is validated, prefer manual/runbook
ops. Automate only what blocks repeatable delivery.

| Capability | Early posture |
| --- | --- |
| Deployment automation | Scripted or documented deploy; full fleet orchestrator later |
| Instance configuration | Config pack / env + admin settings |
| Environment secrets | Per-instance secret store; never shared |
| Version inventory | Tagged release + instance version record |
| Upgrade process | Documented; one instance at a time |
| Migration compatibility | Additive migrations; expand/contract |
| Monitoring | Basic health + error alerts |
| Backup and restore | Proven restore drill per instance class |
| Rollback | Prior artifact rollback |
| Support diagnostics | Read-only diagnostics with Founder/ops auth |

---

## 7. Relationship to Money Loop / PR #68

- Cross-tenant G-03 is **not** a V1 or V2 Money Loop blocker.  
- Shared multi-tenant architecture is **not** a future design constraint.  
- R-S1-01 estimates INSERT DENY = **canonical money-path** only.  
- Internal role enforcement remains required.  
- **Stripe remains in V1.**  
- **Autonomous follow-up remains in V1.**  
- Workflow architecture remains subject to the separate V1 analysis.  
- Current Money Loop work stays focused on **TVG operational value.**
