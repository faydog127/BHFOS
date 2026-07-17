# Incident Response and Production Readiness — v2.2

Governance version: **v2.2**
Scope: **governance only.** This document is a **specification**. It configures no
monitoring, provisions no credential, implements no drift detection, and executes
no fire drill. Everything marked "future" or "specification" requires the later,
separately approved controlled implementation.

Parent model:
[`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md). Access categories:
[`PRODUCTION_ACCESS_MATRIX.md`](./PRODUCTION_ACCESS_MATRIX.md).

---

## 1. Incident severity model (P0–P3)

| Severity | Definition | Activation | Founder interruption |
| --- | --- | --- | --- |
| **P0** | Security exposure, possible data corruption, or total business outage. | Incident Commander activates immediately. | May interrupt immediately, including quiet hours. |
| **P1** | Core operational or money workflow unavailable. | Incident Commander activates immediately. | May interrupt immediately, including quiet hours. |
| **P2** | Important degradation with a workable fallback. | Incident Commander activates for **qualifying** P2 (customer-visible, or risk of escalation, or a rollback is likely). | Interrupt only when business judgment or extraordinary authority is required; otherwise batched. |
| **P3** | Minor defect handled through normal stabilization. | No incident; routed to the normal release pipeline. | Batched into one Decision Packet. |

Time-boxed decision expectations (recommended, tune during the pilot): P0 —
immediate; P1 — minutes; qualifying P2 — same business day; P3 — normal backlog.
These are expectations, not automated timers.

---

## 2. Production Incident Commander

The Incident Commander is the **single active coordinating owner** of a declared
incident (recorded as `current_owner` on the Release Baton) until the incident is
closed and the system returns to normal release governance. Full role definition:
[`../../.cursor/agents/production-incident-commander.md`](../../.cursor/agents/production-incident-commander.md).

**The Incident Commander must:**

- activate for **P0, P1, and qualifying P2** incidents;
- establish **severity** and **business impact**;
- identify the **deployed** state and the **known-good** state;
- **pause conflicting releases** (HALT scope — see
  [`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md) §9);
- coordinate **Production Diagnostics** for read-only investigation;
- choose **contain**, **rollback**, or **bounded forward repair**;
- **direct the Production Operator** to execute authorized mechanics;
- request a **Builder hotfix** when a code change is needed (new exact
  authorization; Builder does not operate production);
- maintain **one** active response plan;
- **minimize founder interruption** and never route routine technical
  investigation to the founder;
- **verify recovery** against the known-good/health criteria;
- **close the incident** and record it to the Ledger;
- **return the system to normal release governance.**

**The Incident Commander must not:**

- write application code;
- edit production data directly;
- enter credentials;
- self-authorize high-risk actions (financial, destructive, security-control,
  migration, real-customer-data — each is separately human-authorized per the
  access matrix);
- expand an incident into redesign or unrelated cleanup;
- involve the founder in routine technical investigation.

**Restore before improve:** incidents restore service first; improvement or
redesign is separate follow-up work, not part of the incident.

---

## 3. Post-incident learning

A post-incident review is **required** for every **P0/P1** and for any **P2 that
required a rollback**; it is **optional** otherwise. The review is lightweight and
agent-drafted, focuses on cause, containment, and prevention, and feeds the
[`AGENT_PILOT_SCORECARD.md`](./AGENT_PILOT_SCORECARD.md). **No mandatory meeting**
and no founder reporting ceremony is required.

---

## 4. Production drift detection (requirement — not implemented)

Drift detection is a **future requirement**, specified here but **not built** in
v2.2. When implemented, it must check:

- **expected vs deployed SHA** (does the running build match the authorized SHA?);
- **expected vs actual migration state**;
- **environment / configuration fingerprint**;
- **feature flags**;
- **release-ledger consistency** (does the Ledger match observed production?).

**Rule:** **unresolved drift must stop new production releases** until resolved or
explicitly, separately authorized by the founder.

---

## 5. Production readiness baseline (specification — no credentials)

The following must exist before production capabilities are *later* provisioned.
**None is configured in v2.2**, and no values or secrets appear here.

- documented **deployment process**;
- documented **rollback process**;
- **production environment identity** (how to prove which environment is live);
- **secret inventory without values** (names/locations only, never values);
- **migration state** visibility;
- **health checks**;
- **logging sources** (deployment, application, Supabase/Edge Function);
- **dedicated production test identities** (least privilege);
- **synthetic-data registry**;
- **visible deployed build identity** (a way to read the running SHA/build);
- **authority and escalation contacts.**

> **No production access or credentials are configured in this governance
> release.** Actual provisioning is a later controlled implementation.

---

## 6. Synthetic production-test data rules

- Only **clearly labeled synthetic records** may be used for production testing.
- Every synthetic record is **registered** in the synthetic-data registry.
- Synthetic records are **created and cleaned up only by authorized roles**
  (Production Operator, or Independent UAT under a defined cleanup authority) per
  [`PRODUCTION_ACCESS_MATRIX.md`](./PRODUCTION_ACCESS_MATRIX.md).
- Synthetic data is **never mixed** with real customer or financial data.
- **No customer contact and no live charges** may result from synthetic testing.

---

## 7. Synthetic incident fire-drill plan (plan only — not executed)

A controlled fire drill is **planned, not executed** in v2.2. When run, it uses a
staging / isolated environment and exercises: failed deployment; incorrect
deployed SHA; login failure; unavailable Edge Function; failed migration;
health-check failure; rollback execution. Its purpose is to test **authority,
evidence, handoffs, containment, and founder burden** — not to create recurring
ceremony. No fire drill is run as part of this governance release.

---

## 8. Future technical emergency controls

Documented as **future** (not built in v2.2; require the later controlled
implementation):

- **cancel workflows** (stop in-flight automation);
- **pause deployments**;
- **revoke credentials**;
- **disable scheduled production actions.**

Until these exist, HALT is a **governance command** (see
[`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md) §9) and is not claimed to
technically cancel independent sessions or running jobs.
