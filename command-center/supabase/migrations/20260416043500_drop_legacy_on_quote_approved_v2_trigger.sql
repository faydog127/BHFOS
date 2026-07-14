begin;

-- PROD drift cleanup (idempotent):
-- - PROD currently has a legacy trigger `on_quote_approved_v2` that creates jobs on status='approved'
-- - Canonical flow is handled by:
--   - `trg_quotes_normalize_status` (approved -> accepted)
--   - `trg_quotes_ensure_job_and_invoice` (accepted -> ensure job)
-- This drop keeps behavior but removes the non-canonical job creation path.

drop trigger if exists on_quote_approved_v2 on public.quotes;

commit;

