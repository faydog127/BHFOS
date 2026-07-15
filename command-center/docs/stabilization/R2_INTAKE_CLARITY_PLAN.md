# R2 — Intake Clarity Plan

**Branch:** `stabilize/r2-intake-clarity`  
**Worktree:** `F:\Dev\BHFOS-stabilize-r2-intake`  
**Base:** `origin/main` @ `fca55c14c14d320c48b91742bfd368690b79c3ab` (R1C tip)

## Goal

Reliable lead/customer creation with clear required fields and loud failures.

## Includes

| ID | Intent |
| --- | --- |
| B-006 | Single intake checklist: name + phone + address; stop inventing property rows |
| B-015 | Explicit required-column contract; fail loud (no silent create-time column strip) |
| B-018 | **Accepted / deferred** — Contacts sidebar not required for this release |

## Excludes

- Property table / FK redesign
- Billing, quotes, ProposalBuilder create fallbacks
- New CRM modules
- Migrations

## Contract (V1)

New leads require:

1. **Name** — first name, last name, or company  
2. **Phone** — valid 10-digit US number  
3. **Service address** — freeform string (or structured street/city/state/ZIP in field)

Persist address on the lead only:

- `leads.address`
- `leads.property_formatted_address` (same value)
- **Do not** set `property_id` or insert into `properties`

Shared module: `src/lib/leadIntakeContract.js`

## Surfaces

| Surface | Change |
| --- | --- |
| CRM `Leads.jsx` Add Lead | Address field + contract validation; no column-strip retry on create |
| `appointmentService.createCustomer` | Contract payload; loud DB errors |
| Field `InspectionFieldCustomerStep` | Phone required; single insert with address |
| Appointment scheduler Add Customer | Phone + address required (same contract) |

## Acceptance

- Create lead from CRM and field with address  
- Missing required field blocked with plain language  
- Create-time missing-column errors surface plainly (no silent field drop)

## Stop conditions

- Touches billing or quote triggers  
- Proposes property schema migration  

## Validation

```bash
npm run test:intake-contracts
npm run lint
npm run build:local
```

## Production verification (after deploy)

Synthetic lead create (CRM + field or scheduler) then delete; confirm address on lead and no new `properties` row.
