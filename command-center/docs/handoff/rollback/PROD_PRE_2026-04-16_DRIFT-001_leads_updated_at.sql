-- PROD rollback/evidence artifact for DRIFT-001 (public.leads.updated_at).
--
-- Purpose:
-- - Capture the pre-rollout evidence that PROD public.leads lacks updated_at.
-- - Provide an emergency-only rollback command (not recommended).
--
-- Evidence source:
-- - tmp/prod_public.sql (generated 2026-04-16) shows public.leads definition without updated_at.
--
-- IMPORTANT:
-- - Preferred rollback is "no rollback" because this change is additive and required by app code.
-- - Dropping updated_at reintroduces the original runtime failure (dispatch/scheduling writes).

-- Emergency-only rollback (NOT RECOMMENDED):
-- alter table public.leads drop column if exists updated_at;

