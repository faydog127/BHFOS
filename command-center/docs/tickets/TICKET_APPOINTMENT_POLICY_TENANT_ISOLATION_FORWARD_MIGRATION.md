# Ticket: appointment tenant isolation forward migration

Status: future remediation; not part of the inspection rollout.

## Objective

Remediate hosted `public.appointments` access with a new forward migration that deliberately removes or replaces the actual hosted permissive policy names while preserving the approved public-booking product behavior.

## Hosted policies requiring explicit disposition

- `Auth full access appointments`
- `Public insert appointments`
- `auth_can_insert_appointments`
- `auth_can_select_appointments`
- `tenant_insert_appointments`
- `tenant_select_appointments`

## Constraints

- Do not edit or rely on retroactively changing `20260417120000_h1a_appointments_rls_policies.sql`.
- Use a new timestamped forward migration.
- Tenant authorization must use the immutable JWT `app_metadata.tenant_id` claim.
- Anonymous users must not have direct table read, update, delete, or unrestricted insert access.
- Preserve public booking through a separately approved controlled server-side path.
- Derive tenant and status server-side and allow only approved public fields.
- Do not bundle this work into inspection deployment or migration-history repair.

## Required implementation review

1. Inventory the current hosted policies, grants, appointment schema, booking client, and appointment-creating server code.
2. Approve the controlled public-booking architecture before implementation.
3. Create a forward migration that drops every superseded hosted and local policy by its exact name and installs the approved least-privilege policies.
4. Add abuse controls appropriate to the selected server-side path.
5. Verify that application code using caller-JWT RLS cannot cross tenant boundaries.

## Acceptance tests

- Anonymous direct insert is denied.
- Anonymous select, update, and delete are denied.
- Controlled public booking succeeds and returns only minimum confirmation data.
- Public input cannot set tenant, status, technician, job, quote, invoice, or other internal fields.
- Invalid tenant and malformed requests are rejected.
- Same-tenant staff access succeeds using `app_metadata.tenant_id`.
- Cross-tenant authenticated select, insert, update, and delete are denied.
- Full local reset, schema lint, scheduling regression, public-booking UAT, and deployment dry-run pass.

## Exit condition

The issue is closed only after the forward migration and controlled booking path pass staging validation and receive separate production authorization. Inspection rollout completion does not close this ticket.
