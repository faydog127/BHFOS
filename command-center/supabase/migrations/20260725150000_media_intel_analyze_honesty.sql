-- Media Intelligence Library — analyze-function honesty statuses (single-company).
-- Additive only; not applied to any project by this change (see repo governance
-- docs under docs/media-intelligence/ — migrations here are unapplied until an
-- owner explicitly authorizes apply on a real Supabase project).
--
-- Widens mil_ai_analyses.status so the AI edge function can record honest,
-- non-fabricated outcomes instead of overloading 'succeeded' or 'failed':
--   skipped_unsupported             -> video analysis is not implemented yet
--   skipped_needs_ai_safe_derivative -> image exceeds the AI-safe byte cap and
--                                       no resize pipeline exists in this runtime
--
-- Never mark an unsupported/skipped case as 'succeeded'.

begin;

alter table public.mil_ai_analyses
  drop constraint if exists mil_ai_analyses_status_check;

alter table public.mil_ai_analyses
  add constraint mil_ai_analyses_status_check
  check (status in (
    'queued', 'running', 'succeeded', 'failed',
    'skipped_no_key', 'skipped_duplicate',
    'skipped_unsupported', 'skipped_needs_ai_safe_derivative'
  ));

commit;
