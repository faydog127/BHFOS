-- ML-P1 Slice 4 bounded remediation R-S4-06: events.actor_id uuid for S4 emitters.
-- Root cause: ml_p1_s4_emit_job_event wrote auth.uid() cast to text into events.actor_id (uuid).
-- Fix: write auth.uid() as uuid; NULL when unauthenticated (approved nullable/system convention).
-- Do not cast free-form text into UUID.
-- All S4 job audit emissions route through this helper (assign/schedule, transitions,
-- evidence, make-safe, CO propose/transition). S3 compat emitters already use NULL actor_id.
-- Does not alter authorization, CO/completion/time/mileage semantics, or invoice gating.

CREATE OR REPLACE FUNCTION public.ml_p1_s4_emit_job_event(
  p_tenant_id text,
  p_job_id uuid,
  p_event_type text,
  p_actor_role text,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid(); -- nullable when no authenticated session
BEGIN
  -- Fail closed on audit write errors (except legacy schemas missing actor_id).
  -- Callers run inside the same transaction as job mutations; emit failure rolls back.
  INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
  VALUES (
    p_tenant_id,
    'job',
    p_job_id,
    p_event_type,
    p_actor_role,
    v_actor,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('slice', 'ml-p1-s4')
  );
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    VALUES (
      p_tenant_id,
      'job',
      p_job_id,
      p_event_type,
      p_actor_role,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('slice', 'ml-p1-s4')
    );
END;
$$;

COMMENT ON FUNCTION public.ml_p1_s4_emit_job_event(text, uuid, text, text, jsonb) IS
  'ML-P1 S4 job audit emitter. events.actor_id = auth.uid() (uuid) or NULL; never text-cast.';
