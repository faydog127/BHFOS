# Phase 0: Release Model Lock

## Goal

Lock the document-control rules before continuing quote, invoice, and receipt implementation.

## Public Document Rules

- Public quote access is token-only.
- Public invoice access is token-only.
- Public receipt access is token-only when exposed.
- Raw internal record IDs must not resolve customer-facing documents.
- Staff editing remains ID-based behind authenticated CRM routes only.

## Lifecycle Meaning

- `estimate`: internal drafting object only, editable, never customer-approvable
- `quote`: released commercial document, customer-facing, approvable, immutable after release
- `invoice`: issued financial demand document derived from accepted quote and completed work
- `receipt`: immutable payment proof derived from settled invoice/payment event

## State Model

Use separate control and response states.

### Release State

- `draft`
- `released`
- `superseded`
- `void`

### Response State

- `pending`
- `viewed`
- `approved`
- `declined`

## State Rules

- Only `draft` documents are editable.
- Releasing a quote creates a snapshot-backed customer artifact.
- Approval may only target a `released` quote snapshot.
- Editing a released quote creates a revision draft; it does not mutate the released artifact.
- Only one active public approval target may exist per released quote version.

## Snapshot Rules

Each released artifact must stand on its own and include:

- document type
- document version
- public token
- source record reference
- release timestamp
- released-by actor
- canonical customer-facing metadata
- canonical `line_items`
- totals/tax summary
- terms and approval metadata
- rendering payload version

## Builder Rule

After release, all downstream consumers must read the same canonical snapshot output.

- no total rebuilding in email senders
- no scope reconstruction in public views
- no post-release line-item regeneration from live services tables

## Immediate Phase 1 Exit Criteria

- No customer-facing document can be opened by raw internal ID.
- Public quote/invoice pages resolve by token only.
- Public demo fallbacks are gated to development only.
