# Status Contracts

## Rules (Applies to All Status Fields)
1. Status values are lowercase snake_case only.
2. New status values require:
   - update to this file
   - DB constraint/migration update
   - service transition update
3. UI must not invent or remap undocumented status strings.

## Job Lifecycle Status (`jobs.status`)
### Allowed Values
1. `pending`
2. `scheduled`
3. `en_route`
4. `in_progress`
5. `completed`
6. `cancelled`

### Allowed Transitions
1. `pending -> scheduled`
2. `scheduled -> en_route`
3. `en_route -> in_progress`
4. `in_progress -> completed`
5. `scheduled -> cancelled`
6. `en_route -> cancelled`
7. `in_progress -> cancelled` (requires override reason)
8. `completed -> in_progress` (reopen, requires override reason)

## Dispatch Status (`job_assignments.dispatch_status`)
### Allowed Values
1. `scheduled`
2. `en_route`
3. `on_site`
4. `completed`
5. `cancelled`

### Notes
1. Dispatch status tracks technician movement/assignment progress.
2. Job lifecycle and dispatch status are related but not the same field.

## Lead Status (`leads.status`)
### Allowed Values
1. `new`
2. `contacted`
3. `qualified`
4. `quoted`
5. `won`
6. `lost`

## Invoice Status (`invoices.status`)
### Allowed Values
1. `draft`
2. `sent`
3. `partially_paid`
4. `paid`
5. `void`

### Rules
1. Paid invoices are immutable for totals/line amounts (credit/refund path only).
2. Sent-but-unpaid invoices are editable only through explicit BillingService rules.

## Payment Status (`payments.status` or equivalent)
### Allowed Values
1. `pending`
2. `succeeded`
3. `failed`
4. `refunded`

## Validation Requirement
Service layer must reject unknown status values with a structured error code (for example `ERR_INVALID_STATUS`).
