# Synthetic-Data Registry

> **BHFOS Operating Model v2.2 — G2.3A foundations (structure only).**
> This document defines the registry that will track every **synthetic** record
> created for controlled production UAT and drills. In G2.3A this is
> **structure only**: no real or synthetic production records are created here.
> The registry is populated later, under separate authorization (G2.3D).
>
> Maintenance: agent-maintained. The founder never edits this file.

## Purpose

When production workflows are exercised (G2.3D onward), they must use
**registered synthetic records** — never real customer or financial data. This
registry is the single, auditable record of what synthetic data exists, why it
was created, who may clean it up, and whether it has been cleaned up. It exists
so synthetic data is never confused with real data and is always removable.

## Binding rules

1. **Synthetic-only.** Only clearly synthetic records are registered. No real
   customer information, and no real financial charges, ever.
2. **No records in G2.3A.** This phase creates the structure and one clearly
   marked *example* entry only. No production data action occurs.
3. **Register before/at creation.** Any synthetic record created in a later
   phase must have a corresponding registry entry.
4. **No live charges.** Payments use a synthetic simulation or a non-financial
   substitute; never a real charge, refund, or invoice against a real account.
5. **No customer contact.** Synthetic workflows must suppress customer
   communications (email/SMS) — verified before any UAT run.
6. **Cleanup authority is explicit.** Each entry names the role authorized to
   clean it up. A `protected_from_cleanup` flag guards records that must not be
   auto-removed.
7. **No secrets or real PII.** Entries contain identifiers and non-sensitive
   notes only — never secret values, passwords, tokens, or real personal data.
8. **Append + update status; never fabricate.** Cleanup status transitions are
   recorded truthfully; an action that did not occur is never recorded.

## Record types covered

The registry supports the following synthetic record types:

- `user`
- `lead` / `customer`
- `property`
- `inspection`
- `appointment`
- `job` / work order
- `estimate`
- `invoice`
- `payment_simulation` (synthetic payment simulation or a non-financial
  substitute — never a live charge)

## Per-record fields

Each entry (see `synthetic-data-registry.template.yaml`) records:

| Field | Meaning |
| --- | --- |
| `record_type` | One of the record types above. |
| `record_identifier` | The synthetic record's id/reference (non-sensitive). |
| `tenant` | Tenant slug the record belongs to. |
| `purpose` | Why the record exists (e.g. "R4A UAT smoke"). |
| `creator_role` | Role that created it (e.g. Production Operator, Independent UAT). |
| `release_or_incident_reference` | Release/incident id the record is tied to. |
| `created_timestamp` | ISO timestamp of creation. |
| `cleanup_status` | `pending` \| `not_required` \| `cleaned` \| `retained`. |
| `cleanup_authority` | Role authorized to clean it up. |
| `protected_from_cleanup` | `true` to prevent automatic cleanup. |
| `notes` | Non-sensitive notes only. |

## Lifecycle

1. **Create + register** (later phase): a synthetic record is created and an
   entry is appended with `cleanup_status: pending`.
2. **Verify:** the workflow is exercised; results recorded by reference in the
   Release Ledger (no data pasted).
3. **Cleanup:** the authorized role removes the record and updates
   `cleanup_status: cleaned`, unless `protected_from_cleanup: true`.
4. **Audit:** the registry plus the Release Ledger show what existed and what was
   removed.

## Files

- `SYNTHETIC_DATA_REGISTRY.md` — this document (purpose, rules, lifecycle).
- `synthetic-data-registry.template.yaml` — schema + one example entry.

The template's example entry is clearly marked `EXAMPLE` and is **not** a real
or synthetic production record.
