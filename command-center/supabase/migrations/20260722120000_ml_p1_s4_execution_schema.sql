-- ML-P1 Slice 4 — schema: status legalization, time/mileage, change orders, writer guard.
-- Base: 24cec0e4d168a17384a5c16616c41e637a713fdc
-- PD: 01=B make-safe, 02=A no tech self-approve, 03=C optional ack+waiver,
--     04=B price-book, 05=accept vocab, 06=A customer CO + break-glass.
-- Does NOT create invoices. Does NOT flip auto_create_job_on_quote_acceptance.

BEGIN;

-- ---------------------------------------------------------------------------
-- M1: Legalize S4 execution statuses (additive; NOT VALID for legacy rows)
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_status_contract_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_contract_check
  CHECK (
    status IS NULL
    OR status IN (
      'pending',
      'unscheduled',
      'pending_schedule',
      'scheduled',
      'en_route',
      'arrived',
      'started',
      'in_progress',
      'on_hold',
      'no_access',
      'reschedule_required',
      'completion_pending',
      'ready_to_invoice',
      'open',
      'invoiced',
      'completed',
      'closed',
      'cancelled'
    )
  ) NOT VALID;

-- ---------------------------------------------------------------------------
-- M2: Job execution columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS execution_row_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS customer_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_ack_method text,
  ADD COLUMN IF NOT EXISTS customer_ack_waiver_reason text,
  ADD COLUMN IF NOT EXISTS customer_ack_waived_by uuid,
  ADD COLUMN IF NOT EXISTS materials_none boolean,
  ADD COLUMN IF NOT EXISTS make_safe_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS make_safe_summary text,
  ADD COLUMN IF NOT EXISTS completion_blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS s4_invoice_on_complete_disabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.jobs.s4_invoice_on_complete_disabled IS
  'ML-P1 S4: invoice-on-complete is gated off; Slice 5 owns invoicing.';

-- ---------------------------------------------------------------------------
-- M3: Idempotency / mutation ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_execution_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  action text NOT NULL,
  client_mutation_id text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  from_status text,
  to_status text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_execution_mutations_action_nonempty CHECK (btrim(action) <> ''),
  CONSTRAINT job_execution_mutations_mutation_nonempty CHECK (btrim(client_mutation_id) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS job_execution_mutations_job_mutation_uidx
  ON public.job_execution_mutations (job_id, client_mutation_id);

CREATE INDEX IF NOT EXISTS job_execution_mutations_tenant_job_idx
  ON public.job_execution_mutations (tenant_id, job_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- M4: Time / mileage events (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_time_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  miles numeric(12, 2),
  source text NOT NULL DEFAULT 'technician',
  actor_id uuid,
  reason_code text,
  note text,
  client_mutation_id text,
  superseded_by uuid REFERENCES public.job_time_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_time_events_type_check CHECK (
    event_type IN (
      'travel_start', 'travel_end', 'arrival', 'onsite_start', 'onsite_end',
      'pause', 'resume', 'work_end', 'correction'
    )
  ),
  CONSTRAINT job_time_events_source_check CHECK (
    source IN ('technician', 'office', 'system')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS job_time_events_job_mutation_uidx
  ON public.job_time_events (job_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_time_events_job_idx
  ON public.job_time_events (job_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- M5: Change orders (first-class)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  source_quote_id uuid REFERENCES public.quotes(id) ON DELETE RESTRICT,
  source_quote_version integer,
  change_order_number text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  supersedes_change_order_id uuid REFERENCES public.change_orders(id),
  status text NOT NULL DEFAULT 'draft',
  reason text NOT NULL,
  financial_delta_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  pricing_mode text NOT NULL DEFAULT 'price_book',
  free_form_pricing boolean NOT NULL DEFAULT false,
  free_form_office_approved boolean NOT NULL DEFAULT false,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposed_by uuid,
  proposed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  approval_method text,
  break_glass_reason text,
  customer_auth_proof text,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  cancelled_by uuid,
  cancelled_at timestamptz,
  client_mutation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT change_orders_status_check CHECK (
    status IN (
      'draft', 'proposed', 'pending_approval', 'approved',
      'rejected', 'cancelled', 'superseded'
    )
  ),
  CONSTRAINT change_orders_pricing_mode_check CHECK (
    pricing_mode IN ('price_book', 'free_form')
  ),
  CONSTRAINT change_orders_approval_method_check CHECK (
    approval_method IS NULL
    OR approval_method IN ('customer_token', 'office', 'break_glass')
  ),
  CONSTRAINT change_orders_reason_nonempty CHECK (btrim(reason) <> ''),
  CONSTRAINT change_orders_break_glass_proof CHECK (
    approval_method IS DISTINCT FROM 'break_glass'
    OR (
      break_glass_reason IS NOT NULL AND btrim(break_glass_reason) <> ''
      AND customer_auth_proof IS NOT NULL AND btrim(customer_auth_proof) <> ''
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS change_orders_tenant_number_version_uidx
  ON public.change_orders (tenant_id, change_order_number, version);

CREATE UNIQUE INDEX IF NOT EXISTS change_orders_job_mutation_uidx
  ON public.change_orders (job_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

-- At most one non-terminal CO actively pending per job (pending_approval).
CREATE UNIQUE INDEX IF NOT EXISTS change_orders_one_pending_approval_per_job_uidx
  ON public.change_orders (job_id)
  WHERE status = 'pending_approval';

CREATE INDEX IF NOT EXISTS change_orders_job_status_idx
  ON public.change_orders (job_id, status);

CREATE TABLE IF NOT EXISTS public.change_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  change_order_id uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  line_action text NOT NULL,
  price_book_item_id uuid,
  description text NOT NULL,
  quantity numeric(12, 3) NOT NULL DEFAULT 1,
  unit_price_cents bigint NOT NULL DEFAULT 0,
  line_delta_cents bigint NOT NULL DEFAULT 0,
  is_credit boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT change_order_items_action_check CHECK (
    line_action IN ('add', 'remove', 'qty_change', 'price_change', 'credit')
  ),
  CONSTRAINT change_order_items_description_nonempty CHECK (btrim(description) <> '')
);

CREATE INDEX IF NOT EXISTS change_order_items_co_idx
  ON public.change_order_items (change_order_id, sort_order);

CREATE TABLE IF NOT EXISTS public.change_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  change_order_id uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  from_status text,
  to_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS change_order_events_co_idx
  ON public.change_order_events (change_order_id, created_at);

-- ---------------------------------------------------------------------------
-- M6: Make-safe records (PD-S4-01 Policy B) — never billable by themselves
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_make_safe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  summary text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  billable boolean NOT NULL DEFAULT false,
  actor_user_id uuid,
  client_mutation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_make_safe_action_check CHECK (
    action_type IN (
      'stop_equipment', 'disconnect_appliance', 'secure_component',
      'document_condition', 'advise_customer'
    )
  ),
  CONSTRAINT job_make_safe_never_billable CHECK (billable = false),
  CONSTRAINT job_make_safe_summary_nonempty CHECK (btrim(summary) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS job_make_safe_job_mutation_uidx
  ON public.job_make_safe_events (job_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- M7: Writer session helper + status/schedule guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_set_writer_context()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.ml_p1_s4_writer', '1', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s4_writer_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('app.ml_p1_s4_writer', true), ''), '') = '1';
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s4_guard_job_execution_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status_changed boolean;
  v_schedule_changed boolean;
  v_tech_changed boolean;
  v_money_changed boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF public.ml_p1_s4_writer_enabled() THEN
    RETURN NEW;
  END IF;

  v_status_changed := NEW.status IS DISTINCT FROM OLD.status;
  v_schedule_changed :=
    NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
    OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end;
  v_tech_changed := NEW.technician_id IS DISTINCT FROM OLD.technician_id;
  v_money_changed :=
    NEW.total_amount IS DISTINCT FROM OLD.total_amount
    OR coalesce(NEW.payment_status, '') IS DISTINCT FROM coalesce(OLD.payment_status, '');

  IF v_status_changed OR v_schedule_changed OR v_tech_changed OR v_money_changed THEN
    RAISE EXCEPTION 'ML_P1_S4_ALT_WRITER_DENY: job execution fields require ml_p1_s4_* writer'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ml_p1_s4_guard_job_execution_write ON public.jobs;
CREATE TRIGGER trg_ml_p1_s4_guard_job_execution_write
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.ml_p1_s4_guard_job_execution_write();

-- Allow appointment sync (documented schedule writer) under S4 guard.
CREATE OR REPLACE FUNCTION public.sync_job_schedule_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_status text;
BEGIN
  IF NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(coalesce(NEW.status, '')) IN ('confirmed', 'rescheduled') THEN
    v_next_status := 'scheduled';
  ELSE
    v_next_status := NULL;
  END IF;

  PERFORM public.ml_p1_s4_set_writer_context();

  UPDATE public.jobs AS j
  SET
    scheduled_start = coalesce(NEW.scheduled_start, j.scheduled_start),
    scheduled_end = coalesce(NEW.scheduled_end, j.scheduled_end),
    technician_id = coalesce(NEW.technician_id, j.technician_id),
    service_address = coalesce(nullif(NEW.service_address, ''), j.service_address),
    status = CASE
      WHEN v_next_status IS NOT NULL
        AND lower(coalesce(j.status, '')) IN ('unscheduled', 'pending_schedule', 'reschedule_required')
        THEN v_next_status
      ELSE j.status
    END,
    updated_at = now(),
    execution_row_version = coalesce(j.execution_row_version, 1) + 1
  WHERE j.id = NEW.job_id
    AND j.tenant_id = NEW.tenant_id;

  RETURN NEW;
END;
$$;

-- S3 ensure job must still insert/update under guard (inserts unaffected; updates need flag).
CREATE OR REPLACE FUNCTION public.ml_p1_s4_wrap_s3_writer_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- No-op placeholder marker for source guards; S3 function patched in RPC migration.
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- M8: RLS (tenant read; mutations via SECURITY DEFINER RPCs)
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_execution_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_time_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_make_safe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_execution_mutations_tenant_select ON public.job_execution_mutations;
CREATE POLICY job_execution_mutations_tenant_select ON public.job_execution_mutations
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT DISTINCT FROM nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')), '')
  );

DROP POLICY IF EXISTS job_time_events_tenant_select ON public.job_time_events;
CREATE POLICY job_time_events_tenant_select ON public.job_time_events
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT DISTINCT FROM nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')), '')
  );

DROP POLICY IF EXISTS change_orders_tenant_select ON public.change_orders;
CREATE POLICY change_orders_tenant_select ON public.change_orders
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT DISTINCT FROM nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')), '')
  );

DROP POLICY IF EXISTS change_order_items_tenant_select ON public.change_order_items;
CREATE POLICY change_order_items_tenant_select ON public.change_order_items
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT DISTINCT FROM nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')), '')
  );

DROP POLICY IF EXISTS change_order_events_tenant_select ON public.change_order_events;
CREATE POLICY change_order_events_tenant_select ON public.change_order_events
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT DISTINCT FROM nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')), '')
  );

DROP POLICY IF EXISTS job_make_safe_events_tenant_select ON public.job_make_safe_events;
CREATE POLICY job_make_safe_events_tenant_select ON public.job_make_safe_events
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT DISTINCT FROM nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')), '')
  );

-- No direct INSERT/UPDATE/DELETE policies for authenticated on S4 tables (RPC-only writes).

COMMIT;
