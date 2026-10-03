# Pre-staging regression summary

Local evidence only. This document does not claim a staging apply, a deploy, or a production check.

## Security and RLS, stages A–D

SQL tests `supabase/tests/finance/01` through `06` remain the regression for:

- RLS enabled and forced on `finance_plans` and `finance_monthly_actuals`
- anon, owner, manager, and viewer denied
- no DELETE grant for authenticated
- one draft per tenant and one approved plan per tenant
- approval, supersede, and version conflict
- actual comparison basis stays attached when a plan is superseded
- actual schema stays version 1
- version 1 plans still have no `monthly_basis`
- version 2 requires `monthly_basis` plus `structural`, `stages`, `staffing`, `owner_field_replacement`, `cost_pools`, `channels`, and `services`
- month `0000-01-01` is rejected
- a negative-zero amount text is rejected when JSONB preserves it; JSONB normalizing `-0` to `0` is the recorded database behavior
- channel ceiling and known-channel rules are unchanged

`npm run test:finance` includes the CRM analytics guards (`analytics-dashboard-guard`, `analytics-dashboard-guard-structural`, and the wiring asserts). Those guards still block inferred Business Analytics figures. Owner remains denied. Client-side hiding is not the authorization check.

## Visual and smoke

The release CI job `finance_e2e` resets a local Supabase started on the runner, creates a synthetic admin in memory, and runs `tests/finance/monthly-checkin.spec.js` and `tests/finance/reports.spec.js`. No GitHub secret is required. The service role from that local stack is not passed into the browser spec and is not stored in the repo.

The report spec checks:

- report figures match the screen for the shared revenue, cash, and jobs values
- unsaved Guided edits survive Reports and Check-In navigation and are not saved by that navigation
- leaving Finance asks Stay, Cancel, or Discard
- a seeded superseded version 1 plan shows schema `1` and `--` plan revenue on Plan vs. Actual
- print hides navigation and inputs
- Letter and A4, portrait and landscape, keep a 7-digit signed value on one line
- repeated table headers use `table-header-group`

Generated report timestamps are labeled UTC.

## Not in this regression

Remote staging, production, and the n8n preview were not contacted. Real TVG finance data was not loaded. Entity logo and color tokens are not approved in this repository, so the brand layer renders the BHFOS product name and records the missing inputs.
