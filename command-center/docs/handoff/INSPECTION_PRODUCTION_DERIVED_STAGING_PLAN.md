# Inspection production-derived staging plan

Status: local preparation only; no hosted changes authorized.

## Scope

Prepare and validate the reconciled migration chain against a production-derived staging database before any production rollout. This plan does not authorize a migration push, migration-history repair, Edge Function deployment, frontend deployment, user-claim change, or hosted policy change.

## Migration-chain decision

`20260417120000_h1a_appointments_rls_policies.sql` remains in the normal migration sequence. It must not be omitted, renamed, marked as applied, or moved out of timestamp order.

Applying it alongside the hosted policies preserves current appointment behavior because it does not drop the actual hosted permissive policy names. Its tenant-scoped policies are additive and are OR-combined with the existing permissive policies. Appointment tenant isolation therefore remains unresolved and is explicitly out of scope for the inspection rollout.

## Reconciled staging sequence

Run all repository migrations in their existing filename order. The production-derived compatibility and inspection segment is:

1. `20260405012000_fix_job_operational_stage_invoice_authority.sql`
2. `20260405013000_legacy_paid_job_invoice_continuity_backfill.sql`
3. `20260407033000_ops_projects_registry.sql`
4. `20260407070000_ops_visibility_queues.sql`
5. `20260407082000_jobs_missing_fields_for_quote_approval.sql`
6. `20260407090000_postgrest_reload_schema_ops_visibility.sql`
7. `20260407130000_price_book_discounts_and_invoice_discount_functions.sql`
8. Existing repository migrations from `20260416043000` through `20260416231500`, unchanged except for the already reconciled property-address compatibility edits.
9. `20260417120000_h1a_appointments_rls_policies.sql`
10. `20260418171500_p0_vocab_legalize_jobs_invoiced.sql`
11. `20260419093000_db_tighten_jobs_status_contract_v1.sql`
12. `20260419110000_h1b_tenant_id_immutability_v1.sql`
13. `20260512170000_hosted_job_items_compatibility.sql`
14. `20260512180000_phase1_inspections_and_job_items.sql`
15. `20260512183000_phase1_integrity_guards.sql`
16. `20260512184500_phase1_fix_appointment_technician_fk.sql`
17. `20260512210000_phase1_5_jobs_technician_fk.sql`
18. `20260512211000_phase1_5_inspection_state_machine_and_audit.sql`
19. `20260512212000_phase1_5_inspection_reports_artifacts.sql`
20. `20260512213000_phase1_5_photo_upload_state.sql`
21. `20260512213100_phase1_5_photo_upload_guards.sql`
22. `20260512213200_phase1_5_complete_blocks_on_pending_uploads.sql`
23. `20260710120000_inspection_production_hardening.sql`

The seven `20260405`-`20260407` files above are hosted-origin migrations fetched without modification. `20260512170000` is the additive compatibility bridge for the hosted legacy `job_items` shape and must precede inspection creation at `20260512180000`.

## Staging gates

Before any staging write:

- Take a restorable staging database snapshot.
- Confirm staging was refreshed from production with secrets and customer access appropriately isolated.
- Capture `supabase migration list` and confirm the expected pending versions exactly.
- Run `supabase db push --dry-run` against staging and stop if the pending list differs from the reviewed chain.
- Confirm a representative authenticated JWT has the immutable `app_metadata.tenant_id` claim required by inspection policies.
- Confirm legacy `job_items` rows have valid `job_id`, derivable/matching `tenant_id`, and no orphan non-null `service_id`.
- Record the appointment-policy risk acceptance; do not interpret staging success as appointment isolation proof.

After applying the database migrations to staging, validate schema lint, frontend lint, production build, inspection RPC tests, inspection Playwright UAT, report generation, private storage access, and cross-tenant inspection denial. Appointment policy remediation and public-booking redesign remain outside this gate.

## Operator commands

Local chain proof:

```powershell
supabase start
supabase db reset
supabase db lint --local --level error
supabase migration list --local
npm run lint
npm run build:prod
npx playwright test tests/smoke/uat-local-inspection-report.spec.js
```

Production-derived staging preflight, from an isolated checkout with the staging database URL supplied only through the process environment:

```powershell
supabase migration list --db-url $env:STAGING_DB_URL
supabase db push --db-url $env:STAGING_DB_URL --dry-run
```

The following write command is intentionally not authorized by this document. Run it only after the dry-run evidence is reviewed and staging execution receives explicit approval:

```powershell
supabase db push --db-url $env:STAGING_DB_URL
```

Do not use `--linked`, `--include-all`, the production database URL, or `supabase migration repair` during staging validation.

## Stop conditions

Stop before applying to staging if:

- the dry-run includes an unreviewed migration;
- staging migration history differs from the production-derived baseline;
- compatibility checks find orphan or tenant-mismatched `job_items` rows;
- the staging staff JWT lacks `app_metadata.tenant_id`;
- an inspection foreign key resolves to an incompatible hosted type;
- the appointment migration is proposed as evidence of appointment tenant isolation.
