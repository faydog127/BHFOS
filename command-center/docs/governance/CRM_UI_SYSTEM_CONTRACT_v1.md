# CRM UI — System Contract (v1)

Purpose: define what **must** be true across the CRM UI so the product feels cohesive, traceable, and workflow-first (not CRUD-first).

This contract is intentionally narrow (v1) and is written to be **testable** via UI contract tests.

## 0) Scope

In scope:
- global UI vocabulary (Estimate vs Quote, etc.)
- layout density rules (desktop + mobile)
- record traceability rules (click-through graph across connected records)
- minimum interaction standards (links, actions, states)

Out of scope (v1):
- full accounting / GL correctness
- pricing policy logic (that belongs upstream in SSOT)
- bespoke tenant theming

## 1) Vocabulary is a contract (no drift)

The UI must use stable, deliberate language. If the backend schema uses legacy terms, the UI must still follow this contract.

v1 locked terms:
- **Estimate**: the customer-facing pricing artifact in the CRM.
- **Work Order**: the fulfillment artifact for labor/material execution.
- **Invoice**: the AR artifact requesting payment.
- **Payment / Receipt**: the cash event artifact and its proof.

Prohibited (v1):
- showing “Quote” in the UI for an Estimate flow, unless explicitly labeled as legacy (e.g. “Legacy Quote (read-only)”).

## 2) Workflow-first information architecture (IA)

Every primary module must answer:
- “What is happening now?”
- “What do I do next?”
- “What is this connected to?”

Minimum module standard:
- a list view with searchable, scannable rows
- a detail view with a visible lifecycle state (status + timestamps)
- a right-rail or header area with primary actions
- a traceability section (links to connected records)

## 3) Desktop density rules (real estate is not optional)

On desktop widths, the UI must not appear “boxed-in” without intent.

Minimum expectations (v1):
- primary content area must expand to a large-width layout on desktop
- detail pages must present at least two columns of information when space allows:
  - left: record details / editor
  - right: totals + actions + traceability

Non-goal:
- filling space with decorative panels. Density must increase **information**, not noise.

## 4) Traceability is a first-class feature (record graph)

Any record identifier that functions as a tracking number must be clickable and must navigate to a detail view.

v1 traceability invariant:
- you must be able to walk backwards from:
  - Receipt/Payment → Invoice → Work Order → Estimate
- and forwards from:
  - Estimate → Work Order → Invoice → Receipt/Payment

Minimum UI requirement:
- each of the above detail pages must display links to the connected records (when present).

## 5) Actions must be safe + explicit

Primary actions must be obvious and reversible where possible.

Minimum action standard (v1):
- destructive actions require confirmation
- “Save” vs “Save & Send” must be distinct
- status changes must be visible (badge + timestamp)

## 6) Contracts by module

Module contracts live alongside this system contract:
- `docs/governance/ESTIMATES_UI_CONTRACT_v1.md`
- `docs/governance/MONEY_UI_CONTRACT_v1.md` (to be authored)

