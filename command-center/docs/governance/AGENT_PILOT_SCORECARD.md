# Agent Pilot Scorecard — v2.2

Governance version: **v2.2**
Scope: **governance only.** Lightweight, **agent-maintained** effectiveness
signals. **No mandatory meeting and no founder reporting is required.** The
founder never maintains this scorecard.

Parent model:
[`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md).

Purpose: detect when governance is becoming **heavier than the risk it manages**
and capture lessons relevant to future agent use / V2. This is a signal, not a
performance ritual. If maintaining it ever becomes a burden, simplify it.

---

## 1. Content rules

- Agent-maintained; the founder does **not** update it.
- **No** credentials, secrets, customer data, copied logs, or screenshots.
- Aggregated signals only; no free-form sensitive production detail.
- Reference releases/incidents by identifier (per the Ledger), not by content.

---

## 2. Metrics

### Founder Focus and Energy
- founder interruptions
- approvals requested
- founder minutes (approx.)
- technical actions assigned to the founder (target: **0**)
- repeated evidence requests (target: **0**)
- Tier 1 releases completed **without** founder mechanics

### Delivery
- release cycle time (planning → completion)
- defects caught **before merge**
- defects caught **before deployment**
- handoff failures
- correctly triggered stop conditions (HALT / scope stop / Founder Burden stop)

### Production and incidents
- incidents (by severity)
- mean time to recovery (MTTR)
- production incidents **caused by agent actions** (target: **0**)

### Learning
- lessons relevant to future agent use / V2

---

## 3. Example entry (illustrative only)

```yaml
period: "2026-Q3"                     # reporting window (agent-chosen)
founder_focus:
  interruptions: 0
  approvals_requested: 0
  founder_minutes: 0
  technical_actions_assigned_to_founder: 0
  repeated_evidence_requests: 0
  tier1_releases_without_founder_mechanics: 0
delivery:
  release_cycle_time_hours_median: null
  defects_caught_before_merge: 0
  defects_caught_before_deployment: 0
  handoff_failures: 0
  correctly_triggered_stop_conditions: 0
production:
  incidents: { p0: 0, p1: 0, p2: 0, p3: 0 }
  mttr_minutes_median: null
  incidents_caused_by_agent_actions: 0
lessons:
  - "example: <lesson relevant to future agent use> (release/incident id)"
```

The example above contains **no** real data, secrets, or customer information.
