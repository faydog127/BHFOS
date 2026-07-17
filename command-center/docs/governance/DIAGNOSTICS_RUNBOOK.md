# Production Diagnostics Runbook (I2)

> **BHFOS Operating Model v2.2 — G2.3B-B1.** How Production Diagnostics (PD)
> investigates without founder mechanics. **Specification only — no live access
> in B1.**
>
> Content rules: no credentials, no secret values, no raw logs, no customer data.

---

## 1. When to use this runbook

Use when a Founder-authorized investigation assigns the Production Diagnostics
agent (`production-diagnostics.md`) under an exact Release Baton / Decision
Packet authorization for **read-only** diagnosis.

**Do not use this runbook as authorization.** B1 documents the procedure; B2–B4
authorizations enable live steps.

---

## 2. Preconditions before any live step

1. Exact authorization reference naming role PD / identity I2 and scope
2. I2 credentials provisioned under B2 (not founder-personal / shared-admin /
   service-role for routine use)
3. B3 negative mutation tests already passed for the systems in scope, **or**
   this investigation is itself a B3 verification under explicit authorization
4. Masking rules in `DIAGNOSTICS_ACCESS.md` acknowledged
5. Evidence will be captured with `templates/DIAGNOSTICS_EVIDENCE.template.md`

If any precondition fails → **stop** and report missing authorization or access.

---

## 3. Investigation sequence (read-only)

1. **Record scope** — release/incident id, systems in scope, time window,
   authorization reference.
2. **Build identity** — GET production `build-info.json` (anonymous). Note SHA,
   environment, release id fields. Do not fabricate values; use `unknown` when
   undeterminable.
3. **Health** — run non-destructive health probe only if authorized; no mutating
   HTTP methods.
4. **GitHub** — read PR/check/workflow state and branch-protection state as
   needed; mask workflow logs before any excerpt.
5. **Hostinger** — read deployment status/history/version identity/errors; mask
   logs.
6. **Supabase** — read project status, migration metadata, schema metadata,
   function inventory, and authorized log surfaces; **never** invoke
   `execute-sql`; **never** use service-role; **never** browse customer table data.
7. **Browser** — console/network failures only; no customer impersonation; no
   cookie/token export.
8. **Reconcile** — if inventory or schema questions arise, follow
   `RECONCILIATION_G2-3B.md` procedures; do not repair.
9. **Conclude** — fill evidence template: observed failure, likely cause,
   confidence, severity, containment, rollback-vs-forward-fix, missing evidence,
   handoff authorization needed.
10. **Dispose** — no raw logs retained; masked evidence ≤ 30 days unless incident
    requires longer.

---

## 4. Required return (aligns with PD agent definition)

1. Assignment and scope
2. Observed failure
3. Affected system
4. Likely root cause
5. Confidence
6. Severity (P0/P1/P2/P3 per `INCIDENT_AND_PRODUCTION_READINESS.md`)
7. Containment recommendation
8. Rollback-versus-forward-fix recommendation
9. Missing evidence
10. Handoff (Builder or Production Operator) and exact authorization needed
11. Confirmation no write, deploy, migration, or elevated action occurred
12. Exact stopping point

---

## 5. Stop and escalate

Stop immediately when:

- Required read access is unavailable or unclear
- Evidence is insufficient for a supported root cause
- Investigation would require write, deploy, migration, or elevated action
- Token appears over-scoped or write succeeds
- Logs expose unexpected sensitive data that cannot be masked in-platform
- `execute-sql` would need to be invoked
- Audit attribution to I2 is missing
- Scope expands into deployment, migration, or data repair

Escalate with a single consolidated summary to the Founder / Incident Commander
as appropriate. Do **not** self-authorize repairs.

---

## 6. Explicit non-authorization

This runbook does **not** authorize: credential provisioning, production access,
deployment, migration, database writes, external configuration changes,
financial actions, customer communications, or merge.
