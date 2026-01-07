-- Migration: Align marketing_actions schema with frontend expectations
-- Adds missing columns, widens status enum, backfills type/channel, and adds helpful indexes/trigger.

-- 1) Columns
-- Tenant defaults to claim in user/app_metadata. Adjust path if needed.
ALTER TABLE public.marketing_actions
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS reviewer_notes text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ALTER COLUMN tenant_id SET DEFAULT (
    COALESCE(
      current_setting('request.jwt.claims', true)::json #>> '{app_metadata,tenant_id}',
      current_setting('request.jwt.claims', true)::json #>> '{user_metadata,tenant_id}'
    )
  );

-- 2) Backfill type/channel from legacy action_type
UPDATE public.marketing_actions
SET
  type = COALESCE(type, action_type),
  channel = COALESCE(channel, action_type)
WHERE type IS NULL OR channel IS NULL;

-- 3) Relax status constraint to match app usage (includes 'pending')
ALTER TABLE public.marketing_actions
  DROP CONSTRAINT IF EXISTS marketing_actions_status_check;

ALTER TABLE public.marketing_actions
  ADD CONSTRAINT marketing_actions_status_check CHECK (
    status IN (
      'draft',
      'generating',
      'pending',
      'pending_approval',
      'needs_approval',
      'approved',
      'rejected',
      'sent',
      'failed'
    )
  );

-- 4) Indexes for queue and joins
CREATE INDEX IF NOT EXISTS idx_marketing_actions_status_created
  ON public.marketing_actions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_actions_lead_id
  ON public.marketing_actions (lead_id);

-- 5) updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_marketing_actions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_timestamp_marketing_actions ON public.marketing_actions;

CREATE TRIGGER set_timestamp_marketing_actions
BEFORE UPDATE ON public.marketing_actions
FOR EACH ROW
EXECUTE FUNCTION public.handle_marketing_actions_updated_at();
