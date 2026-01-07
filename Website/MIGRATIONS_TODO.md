# Migrations TODO / Schema Debt Tracker

- Use this to list upcoming schema changes tied to component work.
- Clear items once a migration is added and applied.

## Pending
- [ ] Review legacy/duplicate tables: campaigns vs marketing_campaigns, contacts vs leads, quotes vs estimates; decide canonical and mark legacy.
- [ ] Add any missing status/enums alignment checks (e.g., pipeline_stage values) to the schema validator.

## Completed
- [x] Align marketing_actions schema (type/channel, status check, indexes, updated_at trigger). Migration: 20251219_align_marketing_actions.sql
- [x] Add property_inspections, rep_checklists, and signals view shim. Migration: 20251219_add_call_console_tables.sql
