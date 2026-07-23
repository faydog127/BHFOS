-- ML-P1 Slice 5 — additive invoice lineage + mutation ledger + void audit columns
-- SOURCE ONLY for this PR. Do not apply to production until Founder A3 auth.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_quote_version integer,
  ADD COLUMN IF NOT EXISTS approved_change_order_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS write_off_reason text,
  ADD COLUMN IF NOT EXISTS written_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS written_off_by uuid,
  ADD COLUMN IF NOT EXISTS s5_created boolean NOT NULL DEFAULT false;

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_source_kind_check'
  ) THEN
    ALTER TABLE public.invoice_items
      ADD CONSTRAINT invoice_items_source_kind_check
      CHECK (source_kind IS NULL OR source_kind IN ('quote', 'change_order', 'manual'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.invoice_execution_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  action text NOT NULL,
  client_mutation_id text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_execution_mutations_job_mut_uq UNIQUE (job_id, client_mutation_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_execution_mutations_invoice
  ON public.invoice_execution_mutations (invoice_id);

COMMENT ON TABLE public.invoice_execution_mutations IS 'ML-P1 S5 idempotency ledger for invoice create/issue/void';
COMMENT ON COLUMN public.invoices.s5_created IS 'True when created by canonical S5 writer; grandfathered rows remain false';
