# Cockpit Re-baseline Status

**Date:** 2026-10-01  
**Branch:** `planning/cockpit-rebaseline-2026-10-01`  
**Baseline:** `main@17f9228951d74824d9b6fb0eb704832befed2afc`  
**Implementation:** NOT AUTHORIZED  
**Planning:** ACTIVE

## Founder direction captured

Cockpit is now being re-baselined around TVG as the proving ground for a unified cradle-to-grave service operating system.

Initial business objective:

> Enable TVG to reach and sustainably operate at $500K+ annual revenue while reducing owner dependency and preventing administrative complexity from growing proportionally with revenue.

## Current product center

**Client → Intake → Unified Work Order → Schedule / Dispatch → Field Execution → NTE / Change → Evidence / Closeout → Communications → Invoice → Payment / Payout → Reconciliation → Warranty / Follow-up**

## Current adjacent implementation lanes

### Finance
- PR #164
- Title: `DO NOT MERGE — FINANCE STEPS 1–6 ONLY`
- No persistence, migrations, production deploy, or Steps 7–8
- Cockpit must define an integration contract without assuming this is production-ready.

### Email
- PR #162
- TVG Email Pass 1 pointer-contract slice
- Draft / unmerged
- Cockpit must define communications integration without assuming live response automation is production-ready.

## Prior Cockpit artifacts

Existing September 29–30 artifacts remain evidence:

- Product Charter
- Product Definition
- Experience Definition
- Mockup v3
- Slice 1 Build Packet BHFOS-CPT-BUILD-001 v1.1

The prior Slice 1 packet must not be used unchanged for new implementation because it explicitly excludes capabilities now central to the product direction, including live field execution, external work-order actions, invoicing / payments, and multi-user technician / admin operation.

It remains historical approved evidence of the prior direction until formally superseded under document control.

## Re-baseline work queue

1. Re-baseline Product Charter
2. Re-baseline Product Definition
3. Cradle-to-grave workflow map
4. Domain and authority model
5. Role / experience model: Owner, Admin/Dispatcher, Technician
6. Customer-rule profile model
7. Finance integration contract
8. Communications integration contract
9. Connector feasibility matrix: HCP, Lessen, Lula, email, calendar, Pure Install / similar
10. Degraded-mode and reconciliation model
11. Release architecture and slice plan
12. Definition of Ready
13. Challenge review
14. Founder decisions only where materially required
15. New implementation packet
16. Explicit coding activation before Cursor implementation

## Command Center process correction

Command Center shall be treated as a decision authority, not a synchronous ACK dependency.

See `COMMAND_CENTER_CONTINUITY_PROTOCOL_DRAFT.md`.
