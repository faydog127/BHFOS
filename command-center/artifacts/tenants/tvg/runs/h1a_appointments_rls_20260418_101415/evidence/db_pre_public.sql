--
-- PostgreSQL database dump
--

-- \restrict icDmPbWmh5wa9ICyCuRp0Rn05HqIdc8wCqlGRSqKpcNLNspWxas1Eq4NQgK7Uuq

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: lead_persona; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."lead_persona" AS ENUM (
    'unclassified',
    'homeowner',
    'realtor',
    'property_manager',
    'hoa',
    'government',
    'b2b',
    'hvac_partner',
    'contractor',
    'vendor',
    'other_partner'
);


ALTER TYPE "public"."lead_persona" OWNER TO "postgres";

--
-- Name: check_is_superuser(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."check_is_superuser"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1
    from public.superusers
    where email = (auth.jwt() ->> 'email')
      and is_active = true
  );
$$;


ALTER FUNCTION "public"."check_is_superuser"() OWNER TO "postgres";

--
-- Name: default_job_payment_terms("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."default_job_payment_terms"("p_customer_type" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case public.normalize_job_customer_type(p_customer_type)
    when 'property_management' then 'NET_30'
    when 'commercial' then 'NET_15'
    else 'NET_7'
  end
$$;


ALTER FUNCTION "public"."default_job_payment_terms"("p_customer_type" "text") OWNER TO "postgres";

--
-- Name: enforce_invoice_guardrails(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_invoice_guardrails"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_job_status text;
  v_contract_total numeric := 0;
  v_previously_billed numeric := 0;
  v_new_total numeric := coalesce(new.total_amount, 0);
  v_status text := lower(coalesce(new.status, 'draft'));
begin
  if new.job_id is null then
    raise exception 'WORK_ORDER_REQUIRED';
  end if;

  new.invoice_type := lower(coalesce(new.invoice_type, 'final'));
  if new.invoice_type not in ('deposit', 'progress', 'final') then
    raise exception 'INVALID_INVOICE_TYPE';
  end if;

  new.release_approved := coalesce(new.release_approved, false);

  select lower(coalesce(j.status, '')),
         coalesce(j.total_amount, 0)
    into v_job_status, v_contract_total
  from public.jobs j
  where j.id = new.job_id
    and (new.tenant_id is null or j.tenant_id is not distinct from new.tenant_id)
  limit 1;

  if v_job_status is null then
    raise exception 'WORK_ORDER_NOT_FOUND';
  end if;

  if v_job_status = 'cancelled' then
    raise exception 'CANCELLED_WORK_ORDER_NOT_BILLABLE';
  end if;

  if v_status = 'sent' and new.release_approved is distinct from true then
    raise exception 'RELEASE_APPROVAL_REQUIRED';
  end if;

  if new.release_approved and new.release_approved_at is null then
    new.release_approved_at := now();
  end if;

  if v_contract_total > 0 and v_status <> 'void' then
    select coalesce(sum(coalesce(i.total_amount, 0)), 0)
      into v_previously_billed
    from public.invoices i
    where i.job_id = new.job_id
      and i.tenant_id is not distinct from new.tenant_id
      and i.id is distinct from new.id
      and lower(coalesce(i.status, 'draft')) <> 'void';

    if (v_previously_billed + v_new_total) > (v_contract_total + 0.009) then
      raise exception 'INVOICE_EXCEEDS_REMAINING_BALANCE';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_invoice_guardrails"() OWNER TO "postgres";

--
-- Name: enqueue_quickbooks_sync(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enqueue_quickbooks_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  entity_type text;
  v_lead_id uuid;
begin
  if tg_table_name = 'invoices' then
    entity_type := 'invoice';
    v_lead_id := nullif(to_jsonb(new)->>'lead_id', '')::uuid;
  elsif tg_table_name = 'leads' then
    entity_type := 'customer';
    v_lead_id := new.id;
  else
    return new;
  end if;

  if (
    entity_type = 'invoice'
    and new.status in ('sent', 'paid', 'partial')
  ) or (
    entity_type = 'customer'
    and new.status = 'Customer'
  ) then
    insert into public.marketing_actions (
      lead_id,
      action_type,
      status,
      playbook_key,
      target_details
    ) values (
      v_lead_id,
      'quickbooks_sync',
      'pending',
      'system_sync',
      jsonb_build_object(
        'entity', entity_type,
        'entity_id', new.id,
        'reason', 'auto_trigger'
      )
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_quickbooks_sync"() OWNER TO "postgres";

--
-- Name: ensure_follow_up_task("text", "text", "uuid", "uuid", "text", timestamp with time zone, "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ensure_follow_up_task"("p_tenant_id" "text", "p_source_type" "text", "p_source_id" "uuid", "p_lead_id" "uuid", "p_title" "text", "p_due_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_priority" "text" DEFAULT 'medium'::"text", "p_notes" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_due_at timestamptz;
begin
  if p_tenant_id is null or p_source_type is null or p_source_id is null or p_title is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crm_tasks'
      and column_name = 'tenant_id'
  ) then
    return;
  end if;

  v_due_at := public.normalize_business_due_at(p_tenant_id, coalesce(p_due_at, now()));

  update public.crm_tasks
  set
    due_at = v_due_at,
    priority = coalesce(p_priority, priority),
    notes = coalesce(p_notes, notes),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
    updated_at = now()
  where tenant_id = p_tenant_id
    and type = 'follow_up'
    and source_type = p_source_type
    and source_id = p_source_id
    and title = p_title
    and status in ('open', 'new', 'pending', 'PENDING', 'in-progress');

  if found then
    return;
  end if;

  insert into public.crm_tasks (
    tenant_id,
    lead_id,
    source_type,
    source_id,
    type,
    title,
    status,
    due_at,
    priority,
    notes,
    metadata,
    created_at,
    updated_at
  ) values (
    p_tenant_id,
    p_lead_id,
    p_source_type,
    p_source_id,
    'follow_up',
    p_title,
    'open',
    v_due_at,
    p_priority,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  );
end;
$$;


ALTER FUNCTION "public"."ensure_follow_up_task"("p_tenant_id" "text", "p_source_type" "text", "p_source_id" "uuid", "p_lead_id" "uuid", "p_title" "text", "p_due_at" timestamp with time zone, "p_priority" "text", "p_notes" "text", "p_metadata" "jsonb") OWNER TO "postgres";

--
-- Name: ensure_job_and_optional_draft_invoice_for_accepted_quote(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ensure_job_and_optional_draft_invoice_for_accepted_quote"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_new_status text;
  v_old_status text;
  v_job_id uuid;
  v_auto text;
  v_should_invoice boolean := false;
  v_now timestamptz := now();
  v_service_address text;
begin
  v_new_status := public.normalize_quote_status(new.status);

  if tg_op = 'INSERT' then
    v_old_status := '';
  else
    v_old_status := public.normalize_quote_status(old.status);
  end if;

  if new.tenant_id is null or btrim(new.tenant_id) = '' then
    return new;
  end if;

  -- Resolve service address for job creation/backfill.
  v_service_address := nullif(btrim(coalesce(new.service_address, '')), '');
  if v_service_address is null and new.lead_id is not null then
    select nullif(
      btrim(
        concat_ws(
          ', ',
          nullif(btrim(concat_ws(' ', nullif(p.address1, ''), nullif(p.address2, ''))), ''),
          nullif(btrim(p.city), ''),
          nullif(btrim(p.state), ''),
          nullif(btrim(p.zip), '')
        )
      ),
      ''
    )
    into v_service_address
    from public.leads l
    left join public.properties p on p.id = l.property_id
    where l.id = new.lead_id
    limit 1;
  end if;

  -- Quote accepted: ensure exactly one job per quote (idempotent).
  if v_new_status = 'accepted' and v_old_status <> 'accepted' then
    insert into public.jobs (
      tenant_id,
      lead_id,
      quote_id,
      quote_number,
      status,
      payment_status,
      total_amount,
      service_address,
      work_order_number
    ) values (
      new.tenant_id,
      new.lead_id,
      new.id,
      new.quote_number,
      'unscheduled',
      'unpaid',
      coalesce(new.total_amount, 0),
      v_service_address,
      public.next_work_order_number(new.tenant_id, coalesce(new.created_at, v_now))
    )
    on conflict (quote_id) where quote_id is not null
    do update set
      updated_at = v_now,
      total_amount = coalesce(public.jobs.total_amount, excluded.total_amount),
      service_address = case
        when public.jobs.service_address is null or btrim(public.jobs.service_address) = '' then excluded.service_address
        else public.jobs.service_address
      end
    returning id into v_job_id;

    insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    values (new.tenant_id, 'quote', new.id, 'QuoteAccepted_JobEnsured', 'system', jsonb_build_object('job_id', v_job_id));

    select value into v_auto
    from public.global_config
    where key = 'auto_create_draft_invoice_on_acceptance'
    limit 1;

    v_should_invoice := lower(btrim(coalesce(v_auto, 'false'))) in ('1','true','yes','on');

    if v_should_invoice then
      insert into public.invoices (
        tenant_id,
        lead_id,
        quote_id,
        job_id,
        estimate_id,
        status,
        invoice_type,
        release_approved,
        subtotal,
        tax_rate,
        tax_amount,
        total_amount,
        issue_date,
        due_date,
        customer_email,
        customer_name,
        customer_phone,
        notes
      ) values (
        new.tenant_id,
        new.lead_id,
        new.id,
        v_job_id,
        new.estimate_id,
        'draft',
        'final',
        false,
        new.subtotal,
        new.tax_rate,
        new.tax_amount,
        coalesce(new.total_amount, 0),
        current_date,
        coalesce(new.valid_until, current_date + 14),
        new.customer_email,
        new.customer_name,
        new.customer_phone,
        case when new.quote_number is not null then 'Draft created on acceptance for Quote #' || new.quote_number else 'Draft created on acceptance' end
      )
      on conflict (tenant_id, job_id, invoice_type)
        where lower(coalesce(status, '')) = 'draft'
      do nothing;

      insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
      values (new.tenant_id, 'quote', new.id, 'QuoteAccepted_DraftInvoiceEnsured', 'system', jsonb_build_object('job_id', v_job_id));
    end if;

    return new;
  end if;

  -- Quote marked paid: sync job payment + invoice payment (idempotent).
  if lower(btrim(coalesce(new.status, ''))) = 'paid'
     and lower(btrim(coalesce(old.status, ''))) <> 'paid' then

    insert into public.jobs (
      tenant_id,
      lead_id,
      quote_id,
      quote_number,
      status,
      payment_status,
      total_amount,
      service_address,
      work_order_number
    ) values (
      new.tenant_id,
      new.lead_id,
      new.id,
      new.quote_number,
      'unscheduled',
      'paid',
      coalesce(new.total_amount, 0),
      v_service_address,
      public.next_work_order_number(new.tenant_id, coalesce(new.created_at, v_now))
    )
    on conflict (quote_id) where quote_id is not null
    do update set
      payment_status = 'paid',
      updated_at = v_now,
      service_address = case
        when public.jobs.service_address is null or btrim(public.jobs.service_address) = '' then excluded.service_address
        else public.jobs.service_address
      end
    returning id into v_job_id;

    update public.jobs
    set payment_status = 'paid',
        updated_at = v_now,
        service_address = case
          when (service_address is null or btrim(service_address) = '') then v_service_address
          else service_address
        end
    where quote_id = new.id
      and tenant_id is not distinct from new.tenant_id
      and lower(coalesce(status, '')) <> 'cancelled';

    -- Step 1: draft -> sent (idempotent)
    begin
      update public.invoices
      set status = 'sent',
          sent_at = coalesce(sent_at, v_now),
          release_approved = true,
          release_approved_at = coalesce(release_approved_at, v_now),
          updated_at = v_now
      where quote_id = new.id
        and tenant_id is not distinct from new.tenant_id
        and lower(coalesce(status, 'draft')) = 'draft';
    exception
      when others then
        update public.invoices
        set status = 'sent',
            sent_at = coalesce(sent_at, v_now),
            updated_at = v_now
        where quote_id = new.id
          and tenant_id is not distinct from new.tenant_id
          and lower(coalesce(status, 'draft')) = 'draft';
    end;

    -- Step 2: sent -> paid
    begin
      update public.invoices
      set status = 'paid',
          paid_at = coalesce(paid_at, v_now),
          amount_paid = case when coalesce(total_amount, 0) > 0 then coalesce(total_amount, 0) else coalesce(amount_paid, 0) end,
          balance_due = 0,
          payment_method = coalesce(payment_method, 'offline'),
          updated_at = v_now
      where quote_id = new.id
        and tenant_id is not distinct from new.tenant_id
        and lower(coalesce(status, 'draft')) <> 'void';
    exception
      when others then
        update public.invoices
        set status = 'paid',
            paid_at = coalesce(paid_at, v_now),
            amount_paid = case when coalesce(total_amount, 0) > 0 then coalesce(total_amount, 0) else coalesce(amount_paid, 0) end,
            payment_method = coalesce(payment_method, 'offline'),
            updated_at = v_now
        where quote_id = new.id
          and tenant_id is not distinct from new.tenant_id
          and lower(coalesce(status, 'draft')) <> 'void';
    end;

    insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    values (new.tenant_id, 'quote', new.id, 'QuotePaid_Synced', 'system', jsonb_build_object('job_id', v_job_id));

    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_job_and_optional_draft_invoice_for_accepted_quote"() OWNER TO "postgres";

--
-- Name: ensure_reconciliation_alert("text", "text", "uuid", "text", "text", "jsonb", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ensure_reconciliation_alert"("p_alert_key" "text", "p_tenant_id" "text", "p_invoice_id" "uuid", "p_anomaly_type" "text", "p_severity" "text" DEFAULT 'high'::"text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_provider_payment_id" "text" DEFAULT NULL::"text", "p_gateway_event_id" "text" DEFAULT NULL::"text", "p_provider" "text" DEFAULT 'stripe'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_alert_key is null or btrim(p_alert_key) = '' then
    raise exception 'ALERT_KEY_REQUIRED';
  end if;
  if p_anomaly_type is null or btrim(p_anomaly_type) = '' then
    raise exception 'ANOMALY_TYPE_REQUIRED';
  end if;

  insert into public.reconciliation_alerts (
    alert_key,
    tenant_id,
    invoice_id,
    provider,
    provider_payment_id,
    gateway_event_id,
    anomaly_type,
    severity,
    status,
    first_detected_at,
    last_detected_at,
    payload
  )
  values (
    p_alert_key,
    p_tenant_id,
    p_invoice_id,
    coalesce(nullif(lower(btrim(p_provider)), ''), 'stripe'),
    nullif(btrim(p_provider_payment_id), ''),
    nullif(btrim(p_gateway_event_id), ''),
    p_anomaly_type,
    coalesce(nullif(lower(btrim(p_severity)), ''), 'high'),
    'open',
    now(),
    now(),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (alert_key) do update
    set last_detected_at = now(),
        severity = excluded.severity,
        status = case when public.reconciliation_alerts.status = 'resolved' then 'open' else public.reconciliation_alerts.status end,
        payload = public.reconciliation_alerts.payload || excluded.payload
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."ensure_reconciliation_alert"("p_alert_key" "text", "p_tenant_id" "text", "p_invoice_id" "uuid", "p_anomaly_type" "text", "p_severity" "text", "p_payload" "jsonb", "p_provider_payment_id" "text", "p_gateway_event_id" "text", "p_provider" "text") OWNER TO "postgres";

--
-- Name: handle_booking_verification(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_booking_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_lead_email text;
  v_lead_name text;
begin
  -- Check if status changed from pending to confirmed (enum-safe).
  if old.status = 'pending' and new.status = 'confirmed' then
    select email, first_name
    into v_lead_email, v_lead_name
    from leads
    where id = new.lead_id;

    insert into marketing_actions (lead_id, action_type, status, subject_line, body)
    values (
      new.lead_id,
      'email',
      'pending',
      'Booking Confirmed: ' || to_char(new.scheduled_start, 'Mon DD, YYYY at HH:MI AM'),
      'Hi ' || coalesce(v_lead_name, 'there') || E',\n\n' ||
      'Your appointment has been officially confirmed for ' || to_char(new.scheduled_start, 'Mon DD, YYYY at HH:MI AM') || E'.\n\n' ||
      'Our technician will arrive within the 2-hour window. Please ensure someone over 18 is home.\n\n' ||
      'Thank you,\nThe Team'
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_booking_verification"() OWNER TO "postgres";

--
-- Name: handle_quote_acceptance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_quote_acceptance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if old.status != 'accepted' and new.status = 'accepted' then
    if not exists (select 1 from public.jobs where quote_id = new.id) then
      insert into public.jobs (lead_id, quote_id, estimate_id, total_amount, status, payment_status)
      values (new.lead_id, new.id, new.estimate_id, new.total_amount, 'unscheduled', 'unpaid');
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_quote_acceptance"() OWNER TO "postgres";

--
-- Name: handle_quote_approval_v2(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_quote_approval_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if old.status != 'approved' and new.status = 'approved' then
    if not exists (select 1 from public.jobs where quote_id = new.id) then
      insert into public.jobs (lead_id, quote_id, estimate_id, total_amount, status, payment_status)
      values (new.lead_id, new.id, new.estimate_id, new.total_amount, 'unscheduled', 'unpaid');
    else
      update public.jobs
      set payment_status = case
            when lower(btrim(coalesce(payment_status, ''))) in ('', 'pending', 'open') then 'unpaid'
            else payment_status
          end,
          updated_at = now()
      where quote_id = new.id;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_quote_approval_v2"() OWNER TO "postgres";

--
-- Name: next_work_order_number("text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."next_work_order_number"("p_tenant_id" "text", "p_created_at" timestamp with time zone DEFAULT "now"()) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_year integer;
  v_next integer;
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'p_tenant_id is required';
  end if;

  v_year := extract(year from coalesce(p_created_at, now()))::integer;

  insert into public.work_order_sequences (tenant_id, seq_year, last_value, updated_at)
  values (p_tenant_id, v_year, 1, now())
  on conflict (tenant_id, seq_year)
  do update
    set last_value = public.work_order_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_next;

  return format('WO-%s-%s', v_year, lpad(v_next::text, 4, '0'));
end;
$$;


ALTER FUNCTION "public"."next_work_order_number"("p_tenant_id" "text", "p_created_at" timestamp with time zone) OWNER TO "postgres";

--
-- Name: normalize_business_due_at("text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."normalize_business_due_at"("p_tenant_id" "text", "p_base_at" timestamp with time zone DEFAULT "now"()) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_timezone text := 'America/New_York';
  v_hours jsonb := '{
    "monday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "tuesday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "wednesday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "thursday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "friday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "saturday": {"isOpen": false, "start": "10:00", "end": "14:00"},
    "sunday": {"isOpen": false, "start": "10:00", "end": "14:00"}
  }'::jsonb;
  v_local_ts timestamp;
  v_candidate_date date;
  v_day_key text;
  v_day_hours jsonb;
  v_is_open boolean;
  v_start_at time;
  v_end_at time;
  v_minutes integer;
  v_has_tenant boolean;
  i integer;
begin
  if to_regclass('public.business_settings') is not null then
    v_has_tenant := exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'business_settings'
        and column_name = 'tenant_id'
    );

    if v_has_tenant then
      select
        coalesce(time_zone, v_timezone),
        coalesce(operating_hours, v_hours)
      into v_timezone, v_hours
      from public.business_settings
      where tenant_id = p_tenant_id
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1;
    else
      select
        coalesce(time_zone, v_timezone),
        coalesce(operating_hours, v_hours)
      into v_timezone, v_hours
      from public.business_settings
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1;
    end if;
  end if;

  v_local_ts := coalesce(p_base_at, now()) at time zone v_timezone;

  for i in 0..14 loop
    v_candidate_date := (v_local_ts::date + i);
    v_day_key := lower(trim(to_char(v_candidate_date, 'FMDay')));
    v_day_hours := coalesce(v_hours -> v_day_key, '{}'::jsonb);
    v_is_open := coalesce((v_day_hours ->> 'isOpen')::boolean, false);

    if not v_is_open then
      continue;
    end if;

    v_start_at := ((coalesce(v_day_hours ->> 'start', '09:00'))::time + interval '1 minute')::time;
    v_end_at := coalesce(v_day_hours ->> 'end', '17:00')::time;

    if i = 0 then
      v_minutes := extract(hour from v_local_ts)::int * 60 + extract(minute from v_local_ts)::int;
      if v_minutes >= extract(hour from v_start_at)::int * 60 + extract(minute from v_start_at)::int
        and v_minutes < extract(hour from v_end_at)::int * 60 + extract(minute from v_end_at)::int then
        return coalesce(p_base_at, now());
      end if;

      if v_minutes < extract(hour from v_start_at)::int * 60 + extract(minute from v_start_at)::int then
        return make_timestamptz(
          extract(year from v_candidate_date)::int,
          extract(month from v_candidate_date)::int,
          extract(day from v_candidate_date)::int,
          extract(hour from v_start_at)::int,
          extract(minute from v_start_at)::int,
          0,
          v_timezone
        );
      end if;

      continue;
    end if;

    return make_timestamptz(
      extract(year from v_candidate_date)::int,
      extract(month from v_candidate_date)::int,
      extract(day from v_candidate_date)::int,
      extract(hour from v_start_at)::int,
      extract(minute from v_start_at)::int,
      0,
      v_timezone
    );
  end loop;

  return coalesce(p_base_at, now());
end;
$$;


ALTER FUNCTION "public"."normalize_business_due_at"("p_tenant_id" "text", "p_base_at" timestamp with time zone) OWNER TO "postgres";

--
-- Name: normalize_job_customer_type("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."normalize_job_customer_type"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case upper(btrim(coalesce(p_value, '')))
    when 'COMMERCIAL' then 'commercial'
    when 'GOVERNMENT' then 'commercial'
    when 'PROPERTY_MANAGEMENT' then 'property_management'
    when 'PROPERTY MANAGEMENT' then 'property_management'
    when 'PROPERTY_MANAGER' then 'property_management'
    when 'PROPERTY MANAGER' then 'property_management'
    when 'PARTNER' then 'property_management'
    else 'residential'
  end
$$;


ALTER FUNCTION "public"."normalize_job_customer_type"("p_value" "text") OWNER TO "postgres";

--
-- Name: normalize_manual_reference("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."normalize_manual_reference"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select upper(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;


ALTER FUNCTION "public"."normalize_manual_reference"("p_value" "text") OWNER TO "postgres";

--
-- Name: normalize_quote_status("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."normalize_quote_status"("p_status" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case lower(btrim(coalesce(p_status, '')))
    when 'approved' then 'accepted'
    else lower(btrim(coalesce(p_status, '')))
  end
$$;


ALTER FUNCTION "public"."normalize_quote_status"("p_status" "text") OWNER TO "postgres";

--
-- Name: p0_02e_run_sweep(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."p0_02e_run_sweep"("p_min_age_minutes" integer DEFAULT 60, "p_limit" integer DEFAULT 200) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cutoff timestamptz := now() - (coalesce(p_min_age_minutes, 60) || ' minutes')::interval;
  v_processed int := 0;
  v_recovered int := 0;
  v_closed int := 0;
  v_flagged int := 0;
  v_skipped int := 0;

  r_attempt record;
  r_obs record;
  r_wh record;
  r_drift record;
  r_result record;

  v_event_id text;
  v_actor uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_tx_id uuid;
  v_alert_key text;
  v_invoice_tenant text;
begin
  -- 1) Dropped webhook recovery / ghost attempt closure (cold attempts only)
  for r_attempt in
    select a.*, i.status as invoice_status, i.balance_due as invoice_balance_due
    from public.public_payment_attempts a
    join public.invoices i on i.id = a.invoice_id
    where a.provider = 'stripe'
      and a.provider_payment_id is not null
      and lower(coalesce(a.attempt_status,'')) in ('initiated','pending')
      and a.created_at < v_cutoff
    order by a.created_at asc
    limit coalesce(p_limit, 200)
  loop
    v_processed := v_processed + 1;

    select *
    into r_obs
    from public.provider_payment_observations o
    where o.provider = 'stripe'
      and o.provider_payment_id = r_attempt.provider_payment_id
    order by o.observed_at desc
    limit 1;

    if not found then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if lower(r_obs.status) in ('failed','canceled','cancelled','expired') then
      update public.public_payment_attempts
      set attempt_status = case when lower(r_obs.status) = 'cancelled' then 'canceled' else lower(r_obs.status) end,
          updated_at = now()
      where id = r_attempt.id;

      v_alert_key := format('p0_02e:ghost_intent:%s', r_attempt.id);
      perform public.ensure_reconciliation_alert(
        v_alert_key,
        r_attempt.tenant_id,
        r_attempt.invoice_id,
        'GHOST_INTENT_CLEANUP',
        'medium',
        jsonb_build_object(
          'provider_payment_id', r_attempt.provider_payment_id,
          'status', lower(r_obs.status),
          'checkout_session_id', r_attempt.checkout_session_id,
          'attempt_id', r_attempt.id
        ),
        r_attempt.provider_payment_id,
        null,
        'stripe'
      );

      begin
        insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
        values (
          r_attempt.tenant_id,
          'payment_attempt',
          r_attempt.id,
          'PaymentAttemptClosed',
          'sweep',
          v_actor,
          jsonb_build_object(
            'provider_payment_id', r_attempt.provider_payment_id,
            'status', lower(r_obs.status),
            'checkout_session_id', r_attempt.checkout_session_id,
            'attempt_id', r_attempt.id
          )
        );
      exception when unique_violation then
      end;

      perform public.ensure_follow_up_task(
        r_attempt.tenant_id,
        'invoice',
        r_attempt.invoice_id,
        null,
        'Payment Attempt Closed – Verify',
        null,
        'medium',
        null,
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'status', lower(r_obs.status), 'attempt_id', r_attempt.id)
      );

      v_closed := v_closed + 1;
      continue;
    end if;

    if lower(r_obs.status) <> 'succeeded' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if r_obs.amount_cents is null or r_obs.amount_cents <= 0 then
      v_alert_key := format('p0_02e:missing_amount:%s', r_attempt.provider_payment_id);
      perform public.ensure_reconciliation_alert(
        v_alert_key,
        r_attempt.tenant_id,
        r_attempt.invoice_id,
        'OBSERVATION_MISSING_AMOUNT',
        'high',
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'attempt_id', r_attempt.id),
        r_attempt.provider_payment_id
      );

      perform public.ensure_follow_up_task(
        r_attempt.tenant_id,
        'invoice',
        r_attempt.invoice_id,
        null,
        'Payment Observation Missing Amount – Review',
        null,
        'high',
        null,
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'attempt_id', r_attempt.id)
      );

      v_flagged := v_flagged + 1;
      continue;
    end if;

    -- Recovery must use canonical webhook settlement path.
    v_event_id := format('sweep:%s', r_attempt.provider_payment_id);

    select *
    into r_result
    from public.record_stripe_webhook_payment(
      v_event_id,
      'payment_intent.succeeded',
      r_attempt.provider_payment_id,
      r_obs.amount_cents,
      coalesce(nullif(lower(btrim(r_obs.currency)),''),'usd'),
      coalesce(r_obs.payload, jsonb_build_object('source','sweep')),
      r_attempt.invoice_id
    )
    limit 1;

    if coalesce(r_result.reconciliation_required,false) or coalesce(r_result.quarantined,false) then
      update public.public_payment_attempts
      set attempt_status = 'needs_reconciliation',
          updated_at = now()
      where id = r_attempt.id;

      v_alert_key := format('p0_02e:reconciliation_required:%s:%s', r_attempt.invoice_id, r_attempt.provider_payment_id);
      perform public.ensure_reconciliation_alert(
        v_alert_key,
        r_attempt.tenant_id,
        r_attempt.invoice_id,
        'RECOVERY_REQUIRES_RECONCILIATION',
        'high',
        jsonb_build_object(
          'provider_payment_id', r_attempt.provider_payment_id,
          'gateway_event_id', v_event_id,
          'quarantine_reason', r_result.quarantine_reason,
          'attempt_id', r_attempt.id,
          'transaction_id', r_result.transaction_id
        ),
        r_attempt.provider_payment_id,
        v_event_id
      );

      perform public.ensure_follow_up_task(
        r_attempt.tenant_id,
        'invoice',
        r_attempt.invoice_id,
        null,
        'Payment Reconciliation Required',
        null,
        'high',
        null,
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'quarantine_reason', r_result.quarantine_reason, 'attempt_id', r_attempt.id)
      );

      v_flagged := v_flagged + 1;
      continue;
    end if;

    v_tx_id := r_result.transaction_id;

    if coalesce(r_result.financial_effect_created,false) then
      -- Emit canonical events once (DB indexes dedupe by transaction_id).
      begin
        insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
        values (
          r_attempt.tenant_id,
          'payment',
          r_attempt.invoice_id,
          'PaymentSucceeded',
          'sweep',
          v_actor,
          jsonb_build_object('transaction_id', v_tx_id, 'invoice_id', r_attempt.invoice_id, 'provider_payment_id', r_attempt.provider_payment_id)
        );
      exception when unique_violation then
      end;

      begin
        insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
        values (
          r_attempt.tenant_id,
          'invoice',
          r_attempt.invoice_id,
          'InvoicePaid',
          'sweep',
          v_actor,
          jsonb_build_object('transaction_id', v_tx_id, 'invoice_id', r_attempt.invoice_id, 'provider_payment_id', r_attempt.provider_payment_id)
        );
      exception when unique_violation then
      end;
    end if;

    update public.public_payment_attempts
    set attempt_status = 'succeeded',
        updated_at = now()
    where id = r_attempt.id;

    v_recovered := v_recovered + 1;
  end loop;

  -- 2) Quarantine surfacing (alerts only; no application/settlement changes)
  for r_wh in
    select e.event_id, e.provider_payment_id, e.invoice_id, e.quarantine_reason, e.processed_status, e.received_at
    from public.stripe_webhook_events e
    where coalesce(e.reconciliation_required,false) = true
      and e.received_at < v_cutoff
    order by e.received_at asc
    limit 200
  loop
    select tenant_id into v_invoice_tenant from public.invoices where id = r_wh.invoice_id limit 1;

    v_alert_key := format('p0_02e:webhook_quarantine:%s', r_wh.event_id);
    perform public.ensure_reconciliation_alert(
      v_alert_key,
      v_invoice_tenant,
      r_wh.invoice_id,
      'WEBHOOK_QUARANTINED',
      'high',
      jsonb_build_object(
        'gateway_event_id', r_wh.event_id,
        'provider_payment_id', r_wh.provider_payment_id,
        'quarantine_reason', coalesce(r_wh.quarantine_reason, r_wh.processed_status)
      ),
      r_wh.provider_payment_id,
      r_wh.event_id
    );

    if v_invoice_tenant is not null and r_wh.invoice_id is not null then
      perform public.ensure_follow_up_task(
        v_invoice_tenant,
        'invoice',
        r_wh.invoice_id,
        null,
        'Payment Webhook Quarantined – Triage',
        null,
        'high',
        null,
        jsonb_build_object('gateway_event_id', r_wh.event_id, 'provider_payment_id', r_wh.provider_payment_id, 'quarantine_reason', r_wh.quarantine_reason)
      );
    end if;

    v_flagged := v_flagged + 1;
  end loop;

  -- 3) Drift detection (flag + alert only; never patch invoice math)
  for r_drift in
    with app_sums as (
      select
        i.id as invoice_id,
        i.tenant_id,
        coalesce(sum(ta.applied_amount),0) as applied_paid
      from public.invoices i
      left join public.transaction_applications ta on ta.invoice_id = i.id and ta.tenant_id = i.tenant_id
      left join public.transactions t on t.id = ta.transaction_id and t.tenant_id = i.tenant_id
      where i.updated_at < v_cutoff
        and lower(coalesce(t.status,'')) in ('succeeded','paid','success')
      group by i.id, i.tenant_id
    )
    select
      i.id as invoice_id,
      i.tenant_id,
      i.total_amount,
      i.amount_paid as invoice_amount_paid,
      i.balance_due as invoice_balance_due,
      s.applied_paid as settlement_applied_paid
    from public.invoices i
    join app_sums s on s.invoice_id = i.id and i.tenant_id is not distinct from s.tenant_id
    where (
      abs(coalesce(i.amount_paid,0) - s.applied_paid) > 0.009
      or abs(coalesce(i.balance_due,0) - greatest(coalesce(i.total_amount,0) - s.applied_paid,0)) > 0.009
    )
    limit 200
  loop
    update public.invoices
    set reconciliation_required = true,
        reconciliation_reason = 'SETTLEMENT_DRIFT',
        updated_at = now()
    where id = r_drift.invoice_id;

    v_alert_key := format('p0_02e:settlement_drift:%s', r_drift.invoice_id);
    perform public.ensure_reconciliation_alert(
      v_alert_key,
      r_drift.tenant_id,
      r_drift.invoice_id,
      'SETTLEMENT_DRIFT',
      'high',
      jsonb_build_object(
        'invoice_amount_paid', r_drift.invoice_amount_paid,
        'invoice_balance_due', r_drift.invoice_balance_due,
        'settlement_applied_paid', r_drift.settlement_applied_paid,
        'total_amount', r_drift.total_amount
      )
    );

    if r_drift.tenant_id is not null then
      perform public.ensure_follow_up_task(
        r_drift.tenant_id,
        'invoice',
        r_drift.invoice_id,
        null,
        'Settlement Drift Detected – Review',
        null,
        'high',
        null,
        jsonb_build_object('invoice_id', r_drift.invoice_id)
      );
    end if;

    v_flagged := v_flagged + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'processed_attempts', v_processed,
    'recovered', v_recovered,
    'closed', v_closed,
    'flagged', v_flagged,
    'skipped', v_skipped
  );
end;
$$;


ALTER FUNCTION "public"."p0_02e_run_sweep"("p_min_age_minutes" integer, "p_limit" integer) OWNER TO "postgres";

--
-- Name: payment_terms_due_days("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."payment_terms_due_days"("p_payment_terms" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case upper(btrim(coalesce(p_payment_terms, '')))
    when 'NET_30' then 30
    when 'NET_15' then 15
    when 'DUE_ON_RECEIPT' then 0
    else 7
  end
$$;


ALTER FUNCTION "public"."payment_terms_due_days"("p_payment_terms" "text") OWNER TO "postgres";

--
-- Name: process_public_payment("uuid", numeric, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."process_public_payment"("p_token" "uuid", "p_amount" numeric, "p_method" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_mode text;
  v_invoice public.invoices%rowtype;
  v_transaction_id uuid;
begin
  select value into v_mode
  from public.global_config
  where key = 'payments_mode'
  limit 1;

  if coalesce(v_mode, '') <> 'mock' then
    raise exception 'Payment processing is not configured.';
  end if;

  select *
  into v_invoice
  from public.invoices
  where public_token = p_token
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount.';
  end if;

  if v_invoice.status = 'paid'
    or v_invoice.paid_at is not null
    or coalesce(v_invoice.balance_due, 0) <= 0 then
    select id
    into v_transaction_id
    from public.transactions
    where invoice_id = v_invoice.id
      and status = 'paid'
    order by created_at desc
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'mode', 'mock',
      'already_paid', true,
      'invoice_id', v_invoice.id,
      'transaction_id', v_transaction_id
    );
  end if;

  -- Update invoice to paid. Some environments treat balance_due as generated, so fall back.
  begin
    update public.invoices
    set status = 'paid',
        paid_at = now(),
        payment_method = p_method,
        amount_paid = coalesce(amount_paid, 0) + p_amount,
        balance_due = greatest(coalesce(balance_due, 0) - p_amount, 0),
        updated_at = now()
    where id = v_invoice.id;
  exception
    when others then
      update public.invoices
      set status = 'paid',
          paid_at = now(),
          payment_method = p_method,
          amount_paid = coalesce(amount_paid, 0) + p_amount,
          updated_at = now()
      where id = v_invoice.id;
  end;

  insert into public.transactions (
    tenant_id,
    invoice_id,
    amount,
    method,
    status
  ) values (
    v_invoice.tenant_id,
    v_invoice.id,
    p_amount,
    p_method,
    'paid'
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'ok', true,
    'mode', 'mock',
    'already_paid', false,
    'invoice_id', v_invoice.id,
    'transaction_id', v_transaction_id
  );
end;
$$;


ALTER FUNCTION "public"."process_public_payment"("p_token" "uuid", "p_amount" numeric, "p_method" "text") OWNER TO "postgres";

--
-- Name: rebuild_invoice_line_items("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."rebuild_invoice_line_items"("p_invoice_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_invoice_id is null then
    return;
  end if;

  update public.invoices i
  set line_items = coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', ii.id,
          'description', ii.description,
          'quantity', ii.quantity,
          'unit_price', ii.unit_price,
          'total_price', ii.total_price
        ) order by ii.created_at, ii.id
      )
      from public.invoice_items ii
      where ii.invoice_id = p_invoice_id
    ),
    '[]'::jsonb
  )
  where i.id = p_invoice_id;
end $$;


ALTER FUNCTION "public"."rebuild_invoice_line_items"("p_invoice_id" "uuid") OWNER TO "postgres";

--
-- Name: rebuild_quote_line_items("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."rebuild_quote_line_items"("p_quote_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_quote_id is null then
    return;
  end if;

  update public.quotes q
  set line_items = coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', qi.id,
          'description', qi.description,
          'quantity', qi.quantity,
          'unit_price', qi.unit_price,
          'total_price', qi.total_price
        ) order by qi.created_at, qi.id
      )
      from public.quote_items qi
      where qi.quote_id = p_quote_id
    ),
    '[]'::jsonb
  )
  where q.id = p_quote_id;
end $$;


ALTER FUNCTION "public"."rebuild_quote_line_items"("p_quote_id" "uuid") OWNER TO "postgres";

--
-- Name: recalculate_invoice_settlement("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."recalculate_invoice_settlement"("p_invoice_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invoice record;
  v_paid numeric := 0;
  v_total numeric := 0;
  v_due numeric := 0;
  v_last_payment_at timestamptz := null;
  v_status text := null;
  v_settlement_status text := null;
  v_method text := null;
begin
  if p_invoice_id is null then
    raise exception 'invoice_id is required';
  end if;

  select id, tenant_id, total_amount, amount_paid, status, paid_at, sent_at
  into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  select
    coalesce(sum(ta.applied_amount), 0),
    max(t.recorded_at),
    (array_agg(t.method order by t.recorded_at desc))[1]
  into v_paid, v_last_payment_at, v_method
  from public.transaction_applications ta
  join public.transactions t on t.id = ta.transaction_id
  where ta.invoice_id = p_invoice_id
    and ta.tenant_id = v_invoice.tenant_id
    and t.tenant_id = v_invoice.tenant_id
    and lower(coalesce(t.status, '')) in ('succeeded', 'paid', 'success');

  v_total := coalesce(v_invoice.total_amount, 0);
  v_due := greatest(v_total - v_paid, 0);

  if v_paid <= 0 then
    v_settlement_status := 'unpaid';
  elsif v_total <= 0 then
    v_settlement_status := 'paid';
  elsif v_due <= 0.009 then
    v_settlement_status := 'paid';
  else
    v_settlement_status := 'partial';
  end if;

  if v_paid > 0 then
    v_status := case when v_settlement_status = 'paid' then 'paid' else 'partial' end;
  end if;

  update public.invoices
  set
    amount_paid = v_paid,
    balance_due = v_due,
    settlement_status = v_settlement_status,
    last_payment_at = v_last_payment_at,
    payment_method = coalesce(v_method, payment_method),
    paid_at = case
      when v_settlement_status = 'paid' and paid_at is null then coalesce(v_last_payment_at, now())
      else paid_at
    end,
    status = case
      when v_status is not null then v_status
      else status
    end,
    updated_at = now()
  where id = p_invoice_id;
end;
$$;


ALTER FUNCTION "public"."recalculate_invoice_settlement"("p_invoice_id" "uuid") OWNER TO "postgres";

--
-- Name: reconcile_apply_webhook_transaction_to_invoice("uuid", "uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reconcile_apply_webhook_transaction_to_invoice"("p_transaction_id" "uuid", "p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tx record;
  v_invoice record;
  v_app_id uuid;
  v_existing_app uuid;
  v_effect_created boolean := false;
  v_has_invoice_paid_event boolean := false;
  v_has_payment_succeeded_event boolean := false;
begin
  if p_transaction_id is null then
    raise exception 'TRANSACTION_ID_REQUIRED';
  end if;
  if p_invoice_id is null then
    raise exception 'INVOICE_ID_REQUIRED';
  end if;

  select *
    into v_invoice
    from public.invoices
   where id = p_invoice_id
   for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  select *
    into v_tx
    from public.transactions
   where id = p_transaction_id
   for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;

  if lower(coalesce(v_tx.source, '')) <> 'webhook' then
    raise exception 'TRANSACTION_SOURCE_NOT_WEBHOOK';
  end if;

  if lower(coalesce(v_tx.status, '')) not in ('succeeded', 'paid', 'success') then
    raise exception 'TRANSACTION_NOT_SETTLED';
  end if;

  -- If the invoice has a pinned provider_payment_id, it must match this transaction's provider_reference when present.
  if v_invoice.provider_payment_id is not null and v_tx.provider_reference is not null
     and v_invoice.provider_payment_id <> v_tx.provider_reference then
    raise exception 'PROVIDER_PAYMENT_ID_MISMATCH';
  end if;

  -- Ensure transaction is bound to the invoice tenant/invoice.
  update public.transactions
  set
    tenant_id = v_invoice.tenant_id,
    invoice_id = v_invoice.id,
    recorded_at = coalesce(recorded_at, now())
  where id = p_transaction_id;

  -- Set invoice provider pointer if absent (immutability trigger allows first set only).
  if v_invoice.provider_payment_id is null and v_tx.provider_reference is not null then
    update public.invoices
    set provider_payment_id = v_tx.provider_reference,
        provider_payment_status = coalesce(provider_payment_status, 'succeeded'),
        updated_at = now()
    where id = v_invoice.id;
  end if;

  -- Application idempotency: at most one application per transaction/invoice.
  select id
    into v_existing_app
    from public.transaction_applications
   where transaction_id = p_transaction_id
     and invoice_id = v_invoice.id
   limit 1;

  if v_existing_app is null then
    insert into public.transaction_applications (
      tenant_id,
      transaction_id,
      invoice_id,
      applied_amount,
      application_type,
      created_by_user_id,
      metadata
    )
    values (
      v_invoice.tenant_id,
      p_transaction_id,
      v_invoice.id,
      v_tx.amount,
      'payment',
      p_actor_user_id,
      jsonb_build_object('reconciled', true, 'note', p_note)
    )
    returning id into v_app_id;
    v_effect_created := true;
  else
    v_app_id := v_existing_app;
    v_effect_created := false;
  end if;

  perform public.recalculate_invoice_settlement(v_invoice.id);

  update public.invoices
  set reconciliation_required = false,
      reconciliation_reason = null,
      updated_at = now()
  where id = v_invoice.id;

  update public.stripe_webhook_events
  set invoice_id = v_invoice.id,
      processed_status = 'processed_reconciled',
      processed_at = now(),
      reconciliation_required = false,
      quarantine_reason = null
  where resolved_transaction_id = p_transaction_id;

  -- Optional event emission: emit canonical events if missing (DB-level dedupe indexes protect duplicates).
  select exists(
    select 1 from public.events
    where entity_type = 'payment'
      and entity_id = v_invoice.id
      and event_type = 'PaymentSucceeded'
    limit 1
  ) into v_has_payment_succeeded_event;

  if not v_has_payment_succeeded_event then
    begin
      insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
      values (
        v_invoice.tenant_id,
        'payment',
        v_invoice.id,
        'PaymentSucceeded',
        'reconciliation',
        p_actor_user_id,
        jsonb_build_object('transaction_id', p_transaction_id, 'invoice_id', v_invoice.id, 'note', p_note)
      );
    exception when unique_violation then
      -- deduped
    end;
  end if;

  select exists(
    select 1 from public.events
    where entity_type = 'invoice'
      and entity_id = v_invoice.id
      and event_type = 'InvoicePaid'
    limit 1
  ) into v_has_invoice_paid_event;

  if not v_has_invoice_paid_event then
    begin
      insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
      values (
        v_invoice.tenant_id,
        'invoice',
        v_invoice.id,
        'InvoicePaid',
        'reconciliation',
        p_actor_user_id,
        jsonb_build_object('transaction_id', p_transaction_id, 'invoice_id', v_invoice.id, 'note', p_note)
      );
    exception when unique_violation then
      -- deduped
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', (not v_effect_created),
    'financial_effect_created', v_effect_created,
    'transaction_id', p_transaction_id,
    'invoice_id', v_invoice.id,
    'transaction_application_id', v_app_id
  );
end;
$$;


ALTER FUNCTION "public"."reconcile_apply_webhook_transaction_to_invoice"("p_transaction_id" "uuid", "p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") OWNER TO "postgres";

--
-- Name: reconcile_capture_legacy_invoice_opening_balance("uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reconcile_capture_legacy_invoice_opening_balance"("p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invoice record;
  v_has_apps boolean := false;
  v_idempotency_key text;
  v_tx_id uuid;
  v_app_id uuid;
  v_effect_created boolean := false;
begin
  if p_invoice_id is null then
    raise exception 'INVOICE_ID_REQUIRED';
  end if;

  select *
    into v_invoice
    from public.invoices
   where id = p_invoice_id
   for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if coalesce(v_invoice.amount_paid, 0) <= 0 then
    raise exception 'INVOICE_HAS_NO_LEGACY_AMOUNT_PAID';
  end if;

  select exists(
    select 1 from public.transaction_applications ta
    where ta.invoice_id = v_invoice.id
      and ta.tenant_id = v_invoice.tenant_id
  ) into v_has_apps;

  if v_has_apps then
    return jsonb_build_object('ok', true, 'duplicate', true, 'note', 'ledger_already_present');
  end if;

  if coalesce(v_invoice.total_amount, 0) > 0 and v_invoice.amount_paid > v_invoice.total_amount + 0.009 then
    raise exception 'LEGACY_AMOUNT_EXCEEDS_TOTAL';
  end if;

  v_idempotency_key := format('legacy_import:%s', v_invoice.id);

  insert into public.transactions (
    tenant_id,
    invoice_id,
    amount,
    method,
    status,
    created_at,
    source,
    currency,
    provider_reference,
    idempotency_key,
    recorded_at,
    created_by_user_id
  )
  values (
    v_invoice.tenant_id,
    v_invoice.id,
    v_invoice.amount_paid,
    'legacy_import',
    'succeeded',
    now(),
    'legacy_import',
    'usd',
    null,
    v_idempotency_key,
    now(),
    p_actor_user_id
  )
  on conflict (tenant_id, idempotency_key)
  do update set recorded_at = excluded.recorded_at
  returning id into v_tx_id;

  insert into public.transaction_applications (
    tenant_id,
    transaction_id,
    invoice_id,
    applied_amount,
    application_type,
    created_by_user_id,
    metadata
  )
  values (
    v_invoice.tenant_id,
    v_tx_id,
    v_invoice.id,
    v_invoice.amount_paid,
    'payment',
    p_actor_user_id,
    jsonb_build_object('legacy_opening_balance', true, 'note', p_note)
  )
  on conflict on constraint transaction_applications_tx_invoice_uniq
  do nothing
  returning id into v_app_id;

  v_effect_created := (v_app_id is not null);

  perform public.recalculate_invoice_settlement(v_invoice.id);

  update public.invoices
  set reconciliation_required = false,
      reconciliation_reason = null,
      updated_at = now()
  where id = v_invoice.id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', (not v_effect_created),
    'financial_effect_created', v_effect_created,
    'transaction_id', v_tx_id,
    'invoice_id', v_invoice.id,
    'transaction_application_id', v_app_id
  );
end;
$$;


ALTER FUNCTION "public"."reconcile_capture_legacy_invoice_opening_balance"("p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") OWNER TO "postgres";

--
-- Name: record_offline_manual_payment("text", "uuid", numeric, "text", "text", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."record_offline_manual_payment"("p_tenant_id" "text", "p_invoice_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_manual_reference_raw" "text", "p_actor_user_id" "uuid", "p_request_id" "text" DEFAULT NULL::"text") RETURNS TABLE("ok" boolean, "duplicate" boolean, "transaction_id" "uuid", "payment_attempt_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_reference_norm text;
  v_idempotency_key text;
  v_attempt record;
  v_invoice record;
  v_has_apps boolean := false;
  v_method text;
  v_transaction_id uuid;
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'TENANT_ID_REQUIRED';
  end if;
  if p_invoice_id is null then
    raise exception 'INVOICE_ID_REQUIRED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_INVALID';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'AMOUNT_PRECISION_INVALID';
  end if;

  v_reference_norm := public.normalize_manual_reference(p_manual_reference_raw);
  if v_reference_norm is null or btrim(v_reference_norm) = '' then
    raise exception 'MANUAL_REFERENCE_REQUIRED';
  end if;

  if length(v_reference_norm) < 4 or v_reference_norm ~ '^[0-9]{1,3}$' then
    raise exception 'MANUAL_REFERENCE_REJECTED';
  end if;

  if lower(v_reference_norm) in ('cash', 'paid', 'manual', 'offline', 'na', 'n/a', 'none', 'unknown', 'test') then
    raise exception 'MANUAL_REFERENCE_REJECTED';
  end if;

  v_idempotency_key := format('manual:%s:%s', p_invoice_id, v_reference_norm);
  v_method := coalesce(nullif(btrim(p_payment_method), ''), 'offline');

  select id, tenant_id, amount_paid, status
  into v_invoice
  from public.invoices
  where id = p_invoice_id
    and tenant_id is not distinct from p_tenant_id
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if lower(coalesce(v_invoice.status, '')) in ('void', 'voided', 'refunded') then
    raise exception 'INVOICE_NOT_PAYABLE';
  end if;

  select exists(
    select 1
    from public.transaction_applications ta
    where ta.invoice_id = p_invoice_id
      and ta.tenant_id = p_tenant_id
  ) into v_has_apps;

  if coalesce(v_invoice.amount_paid, 0) > 0 and not v_has_apps then
    raise exception 'LEGACY_MONEY_STATE_MIGRATION_REQUIRED';
  end if;

  insert into public.payment_attempts (
    tenant_id,
    invoice_id,
    writer_mode,
    idempotency_key,
    manual_reference_raw,
    manual_reference_norm,
    amount,
    payment_method,
    attempt_status,
    created_by_user_id,
    request_id,
    updated_at
  )
  values (
    p_tenant_id,
    p_invoice_id,
    'offline',
    v_idempotency_key,
    p_manual_reference_raw,
    v_reference_norm,
    p_amount,
    v_method,
    'received',
    p_actor_user_id,
    p_request_id,
    now()
  )
  on conflict (tenant_id, invoice_id, manual_reference_norm)
  do update
    set updated_at = now()
  returning * into v_attempt;

  if v_attempt.resolved_transaction_id is not null then
    ok := true;
    duplicate := true;
    transaction_id := v_attempt.resolved_transaction_id;
    payment_attempt_id := v_attempt.id;
    return next;
    return;
  end if;

  insert into public.transactions (
    tenant_id,
    invoice_id,
    amount,
    method,
    status,
    created_at,
    source,
    currency,
    provider_reference,
    idempotency_key,
    manual_reference_norm,
    created_by_user_id,
    recorded_at
  )
  values (
    p_tenant_id,
    p_invoice_id,
    p_amount,
    v_method,
    'succeeded',
    now(),
    'offline',
    'usd',
    null,
    v_idempotency_key,
    v_reference_norm,
    p_actor_user_id,
    now()
  )
  on conflict (tenant_id, idempotency_key)
  do update
    set recorded_at = excluded.recorded_at
  returning id into v_transaction_id;

  insert into public.transaction_applications (
    tenant_id,
    transaction_id,
    invoice_id,
    applied_amount,
    application_type,
    created_by_user_id,
    metadata
  )
  values (
    p_tenant_id,
    v_transaction_id,
    p_invoice_id,
    p_amount,
    'payment',
    p_actor_user_id,
    jsonb_build_object('manual_reference', v_reference_norm)
  )
  on conflict on constraint transaction_applications_tx_invoice_uniq
  do nothing;

  update public.payment_attempts
  set
    resolved_transaction_id = v_transaction_id,
    attempt_status = 'resolved',
    updated_at = now()
  where id = v_attempt.id;

  perform public.recalculate_invoice_settlement(p_invoice_id);

  ok := true;
  duplicate := false;
  transaction_id := v_transaction_id;
  payment_attempt_id := v_attempt.id;
  return next;
end;
$_$;


ALTER FUNCTION "public"."record_offline_manual_payment"("p_tenant_id" "text", "p_invoice_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_manual_reference_raw" "text", "p_actor_user_id" "uuid", "p_request_id" "text") OWNER TO "postgres";

--
-- Name: record_stripe_webhook_payment("text", "text", "text", bigint, "text", "jsonb", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."record_stripe_webhook_payment"("p_gateway_event_id" "text", "p_event_type" "text", "p_provider_payment_id" "text", "p_amount_cents" bigint, "p_currency" "text", "p_payload" "jsonb", "p_invoice_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("ok" boolean, "duplicate_event" boolean, "duplicate_payment" boolean, "financial_effect_created" boolean, "reconciliation_required" boolean, "quarantined" boolean, "quarantine_reason" "text", "transaction_id" "uuid", "invoice_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event record;
  v_invoice record;
  v_amount numeric;
  v_has_apps boolean := false;
  v_tx_id uuid;
  v_app_rows integer := 0;
  v_final_success boolean := false;
  v_event_inserted text;
  v_tx_inserted boolean := false;
begin
  if p_gateway_event_id is null or btrim(p_gateway_event_id) = '' then
    raise exception 'GATEWAY_EVENT_ID_REQUIRED';
  end if;

  if p_provider_payment_id is null or btrim(p_provider_payment_id) = '' then
    raise exception 'PROVIDER_PAYMENT_ID_REQUIRED';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'AMOUNT_INVALID';
  end if;

  v_final_success := lower(coalesce(p_event_type, '')) in ('payment_intent.succeeded', 'charge.succeeded');
  v_amount := (p_amount_cents::numeric / 100);

  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    payment_intent_id,
    provider_payment_id,
    payload,
    processed_status,
    received_at
  )
  values (
    p_gateway_event_id,
    p_event_type,
    p_provider_payment_id,
    p_provider_payment_id,
    p_payload,
    'received',
    now()
  )
  on conflict (event_id) do nothing
  returning event_id into v_event_inserted;

  duplicate_event := (v_event_inserted is null);

  select *
  into v_event
  from public.stripe_webhook_events
  where event_id = p_gateway_event_id;

  if not v_final_success then
    ok := true;
    duplicate_payment := false;
    financial_effect_created := false;
    reconciliation_required := false;
    quarantined := false;
    quarantine_reason := null;
    transaction_id := null;
    invoice_id := null;

    update public.stripe_webhook_events
    set processed_at = now(),
        processed_status = 'ignored_nonfinal'
    where event_id = p_gateway_event_id
      and processed_status <> 'processed';

    return next;
    return;
  end if;

  if p_invoice_id is not null then
    select id, tenant_id, amount_paid, status, total_amount
      into v_invoice
      from public.invoices
     where id = p_invoice_id
     for update;
  else
    select id, tenant_id, amount_paid, status, total_amount
      into v_invoice
      from public.invoices
     where provider_payment_id = p_provider_payment_id
     limit 1
     for update;
  end if;

  if not found then
    insert into public.transactions (
      tenant_id,
      invoice_id,
      amount,
      method,
      status,
      created_at,
      source,
      currency,
      provider_reference,
      idempotency_key,
      recorded_at
    )
    values (
      null,
      null,
      v_amount,
      'stripe',
      'succeeded',
      now(),
      'webhook',
      coalesce(nullif(lower(btrim(p_currency)), ''), 'usd'),
      p_provider_payment_id,
      format('stripe:%s', p_provider_payment_id),
      now()
    )
    on conflict (provider_reference) where source = 'webhook' and provider_reference is not null
    do update set recorded_at = excluded.recorded_at
    returning id, (xmax = 0) into v_tx_id, v_tx_inserted;

    update public.stripe_webhook_events
    set processed_at = now(),
        processed_status = 'quarantined_unmapped',
        invoice_id = null,
        provider_payment_id = p_provider_payment_id,
        resolved_transaction_id = v_tx_id,
        reconciliation_required = true,
        quarantine_reason = 'AMBIGUOUS_OR_MISSING_INVOICE_ASSOCIATION'
    where event_id = p_gateway_event_id;

    ok := true;
    duplicate_payment := (not v_tx_inserted);
    financial_effect_created := false;
    reconciliation_required := true;
    quarantined := true;
    quarantine_reason := 'AMBIGUOUS_OR_MISSING_INVOICE_ASSOCIATION';
    transaction_id := v_tx_id;
    invoice_id := null;
    return next;
    return;
  end if;

  invoice_id := v_invoice.id;

  select exists(
    select 1
      from public.transaction_applications ta
     where ta.invoice_id = v_invoice.id
       and ta.tenant_id is not distinct from v_invoice.tenant_id
  ) into v_has_apps;

  if coalesce(v_invoice.amount_paid, 0) > 0 and not v_has_apps then
    insert into public.transactions (
      tenant_id,
      invoice_id,
      amount,
      method,
      status,
      created_at,
      source,
      currency,
      provider_reference,
      idempotency_key,
      recorded_at
    )
    values (
      v_invoice.tenant_id,
      v_invoice.id,
      v_amount,
      'stripe',
      'succeeded',
      now(),
      'webhook',
      coalesce(nullif(lower(btrim(p_currency)), ''), 'usd'),
      p_provider_payment_id,
      format('stripe:%s', p_provider_payment_id),
      now()
    )
    on conflict (provider_reference) where source = 'webhook' and provider_reference is not null
    do update set recorded_at = excluded.recorded_at
    returning id, (xmax = 0) into v_tx_id, v_tx_inserted;

    update public.invoices
    set reconciliation_required = true,
        reconciliation_reason = coalesce(reconciliation_reason, 'LEGACY_MONEY_STATE_WITHOUT_LEDGER'),
        updated_at = now()
    where id = v_invoice.id;

    update public.stripe_webhook_events
    set processed_at = now(),
        processed_status = 'quarantined_legacy_state',
        invoice_id = v_invoice.id,
        provider_payment_id = p_provider_payment_id,
        resolved_transaction_id = v_tx_id,
        reconciliation_required = true,
        quarantine_reason = 'LEGACY_MONEY_STATE_WITHOUT_LEDGER'
    where event_id = p_gateway_event_id;

    ok := true;
    duplicate_payment := (not v_tx_inserted);
    financial_effect_created := false;
    reconciliation_required := true;
    quarantined := true;
    quarantine_reason := 'LEGACY_MONEY_STATE_WITHOUT_LEDGER';
    transaction_id := v_tx_id;
    return next;
    return;
  end if;

  insert into public.transactions (
    tenant_id,
    invoice_id,
    amount,
    method,
    status,
    created_at,
    source,
    currency,
    provider_reference,
    idempotency_key,
    recorded_at
  )
  values (
    v_invoice.tenant_id,
    v_invoice.id,
    v_amount,
    'stripe',
    'succeeded',
    now(),
    'webhook',
    coalesce(nullif(lower(btrim(p_currency)), ''), 'usd'),
    p_provider_payment_id,
    format('stripe:%s', p_provider_payment_id),
    now()
  )
  on conflict (provider_reference) where source = 'webhook' and provider_reference is not null
  do update set recorded_at = excluded.recorded_at
  returning id into v_tx_id;

  insert into public.transaction_applications (
    tenant_id,
    transaction_id,
    invoice_id,
    applied_amount,
    application_type,
    metadata
  )
  values (
    v_invoice.tenant_id,
    v_tx_id,
    v_invoice.id,
    v_amount,
    'payment',
    jsonb_build_object('provider', 'stripe', 'provider_payment_id', p_provider_payment_id, 'gateway_event_id', p_gateway_event_id)
  )
  on conflict on constraint transaction_applications_tx_invoice_uniq
  do nothing;

  get diagnostics v_app_rows = row_count;
  financial_effect_created := (v_app_rows = 1);

  perform public.recalculate_invoice_settlement(v_invoice.id);

  update public.invoices
  set provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id),
      provider_payment_status = coalesce(provider_payment_status, 'succeeded'),
      updated_at = now()
  where id = v_invoice.id;

  update public.stripe_webhook_events
  set processed_at = now(),
      processed_status = 'processed',
      invoice_id = v_invoice.id,
      provider_payment_id = p_provider_payment_id,
      resolved_transaction_id = v_tx_id,
      reconciliation_required = false,
      quarantine_reason = null
  where event_id = p_gateway_event_id;

  ok := true;
  duplicate_payment := (v_app_rows = 0);
  reconciliation_required := false;
  quarantined := false;
  quarantine_reason := null;
  transaction_id := v_tx_id;
  return next;
end;
$$;


ALTER FUNCTION "public"."record_stripe_webhook_payment"("p_gateway_event_id" "text", "p_event_type" "text", "p_provider_payment_id" "text", "p_amount_cents" bigint, "p_currency" "text", "p_payload" "jsonb", "p_invoice_id" "uuid") OWNER TO "postgres";

--
-- Name: sync_invoice_payment_from_job(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."sync_invoice_payment_from_job"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invoice record;
  v_total numeric := 0;
  v_status text;
  v_now timestamptz := now();
begin
  if lower(btrim(coalesce(new.payment_status, ''))) not in ('paid','partial') then
    return new;
  end if;

  select i.*
    into v_invoice
  from public.invoices i
  where i.job_id = new.id
    and i.tenant_id is not distinct from new.tenant_id
    and lower(coalesce(i.status,'draft')) <> 'void'
  order by i.created_at desc, i.id desc
  limit 1;

  if not found then
    return new;
  end if;

  v_total := coalesce(v_invoice.total_amount, new.total_amount, 0);
  v_status := case when lower(btrim(coalesce(new.payment_status,''))) = 'paid' then 'paid' else 'partial' end;

  if v_status = 'paid' then
    -- draft -> sent first
    begin
      update public.invoices
      set status = 'sent',
          sent_at = coalesce(sent_at, v_now),
          release_approved = true,
          release_approved_at = coalesce(release_approved_at, v_now),
          updated_at = v_now
      where id = v_invoice.id
        and lower(coalesce(status,'draft')) = 'draft';
    exception
      when others then
        update public.invoices
        set status = 'sent',
            sent_at = coalesce(sent_at, v_now),
            updated_at = v_now
        where id = v_invoice.id
          and lower(coalesce(status,'draft')) = 'draft';
    end;

    begin
      update public.invoices
      set status = 'paid',
          amount_paid = case when v_total > 0 then v_total else coalesce(amount_paid, 0) end,
          paid_at = coalesce(paid_at, v_now),
          balance_due = 0,
          payment_method = coalesce(payment_method, 'offline'),
          updated_at = v_now
      where id = v_invoice.id;
    exception
      when others then
        update public.invoices
        set status = 'paid',
            amount_paid = case when v_total > 0 then v_total else coalesce(amount_paid, 0) end,
            paid_at = coalesce(paid_at, v_now),
            payment_method = coalesce(payment_method, 'offline'),
            updated_at = v_now
        where id = v_invoice.id;
    end;
  else
    update public.invoices
    set status = 'partial',
        payment_method = coalesce(payment_method, 'offline'),
        updated_at = v_now
    where id = v_invoice.id;
  end if;

  insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
  values (new.tenant_id, 'job', new.id, 'JobPayment_SyncedInvoice', 'system', jsonb_build_object('invoice_id', v_invoice.id, 'invoice_status', v_status));

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_invoice_payment_from_job"() OWNER TO "postgres";

--
-- Name: sync_job_schedule_from_appointment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."sync_job_schedule_from_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_next_status text;
  v_ready boolean;
  v_addr text;
begin
  if new.job_id is null then
    return new;
  end if;

  v_addr := coalesce(nullif(btrim(new.service_address), ''), '');

  -- Conservative readiness check (server-side). UI/edge also enforces dispatchability.
  -- Address check is intentionally lightweight: we require non-empty and at least a comma plus a state token.
  v_ready :=
    new.scheduled_start is not null
    and new.scheduled_end is not null
    and new.technician_id is not null
    and v_addr <> ''
    and v_addr ~ ',\\s*[^,]+'
    and v_addr ~* '\\b[A-Z]{2}\\b';

  -- Minimal status mapping:
  -- - confirmed/rescheduled implies scheduled only if the appointment is dispatch-ready.
  -- - otherwise, do not override job status.
  if lower(coalesce(new.status, '')) in ('confirmed', 'rescheduled') and v_ready then
    v_next_status := 'scheduled';
  else
    v_next_status := null;
  end if;

  update public.jobs as j
  set
    scheduled_start = coalesce(new.scheduled_start, j.scheduled_start),
    scheduled_end = coalesce(new.scheduled_end, j.scheduled_end),
    technician_id = coalesce(new.technician_id, j.technician_id),
    service_address = coalesce(nullif(new.service_address, ''), j.service_address),
    status = case
      when v_next_status is not null
        and lower(coalesce(j.status, '')) in ('unscheduled', 'pending_schedule')
        then v_next_status
      else j.status
    end,
    updated_at = now()
  where j.id = new.job_id
    and j.tenant_id = new.tenant_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_job_schedule_from_appointment"() OWNER TO "postgres";

--
-- Name: trg_block_invoice_provider_payment_id_reassign(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trg_block_invoice_provider_payment_id_reassign"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.provider_payment_id is not null
     and new.provider_payment_id is distinct from old.provider_payment_id then
    raise exception 'PROVIDER_PAYMENT_ID_IMMUTABLE';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_block_invoice_provider_payment_id_reassign"() OWNER TO "postgres";

--
-- Name: trg_invoice_items_sync_line_items(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trg_invoice_items_sync_line_items"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_invoice_line_items(old.invoice_id);
    return old;
  end if;

  perform public.rebuild_invoice_line_items(new.invoice_id);
  return new;
end $$;


ALTER FUNCTION "public"."trg_invoice_items_sync_line_items"() OWNER TO "postgres";

--
-- Name: trg_money_loop_invoice_followups(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trg_money_loop_invoice_followups"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_status text;
  old_status text;
  v_lead_id uuid;
begin
  new_status := lower(coalesce(new.status, ''));
  old_status := lower(coalesce(old.status, ''));
  v_lead_id := nullif(to_jsonb(new)->>'lead_id', '')::uuid;

  if v_lead_id is null and new.job_id is not null then
    select j.lead_id
      into v_lead_id
    from public.jobs j
    where j.id = new.job_id
      and (new.tenant_id is null or j.tenant_id is not distinct from new.tenant_id)
    limit 1;
  end if;

  if tg_op = 'INSERT' then
    if new_status in ('sent', 'partial', 'overdue') then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'invoice',
        new.id,
        v_lead_id,
        'Invoice Unpaid – Follow Up',
        null,
        'high',
        null,
        jsonb_build_object('invoice_number', new.invoice_number, 'due_date', new.due_date)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new_status in ('sent', 'partial', 'overdue')
      and old_status not in ('sent', 'partial', 'overdue') then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'invoice',
        new.id,
        v_lead_id,
        'Invoice Unpaid – Follow Up',
        null,
        'high',
        null,
        jsonb_build_object('invoice_number', new.invoice_number, 'due_date', new.due_date)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_money_loop_invoice_followups"() OWNER TO "postgres";

--
-- Name: trg_money_loop_job_followups(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trg_money_loop_job_followups"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if lower(coalesce(new.status, '')) = 'unscheduled' then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'job',
        new.id,
        new.lead_id,
        'Schedule Job',
        null,
        'high',
        null,
        jsonb_build_object('quote_id', new.quote_id)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if lower(coalesce(new.status, '')) = 'unscheduled'
      and lower(coalesce(old.status, '')) <> 'unscheduled' then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'job',
        new.id,
        new.lead_id,
        'Schedule Job',
        null,
        'high',
        null,
        jsonb_build_object('quote_id', new.quote_id)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_money_loop_job_followups"() OWNER TO "postgres";

--
-- Name: trg_money_loop_quote_followups(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trg_money_loop_quote_followups"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if lower(coalesce(new.status, '')) = 'sent' then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'quote',
        new.id,
        new.lead_id,
        'Quote Sent – Follow Up',
        null,
        'medium',
        null,
        jsonb_build_object('quote_number', new.quote_number)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if lower(coalesce(new.status, '')) = 'sent'
      and lower(coalesce(old.status, '')) <> 'sent' then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'quote',
        new.id,
        new.lead_id,
        'Quote Sent – Follow Up',
        null,
        'medium',
        null,
        jsonb_build_object('quote_number', new.quote_number)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_money_loop_quote_followups"() OWNER TO "postgres";

--
-- Name: trg_quote_items_sync_line_items(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trg_quote_items_sync_line_items"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_quote_line_items(old.quote_id);
    return old;
  end if;

  perform public.rebuild_quote_line_items(new.quote_id);
  return new;
end $$;


ALTER FUNCTION "public"."trg_quote_items_sync_line_items"() OWNER TO "postgres";

--
-- Name: trg_quotes_normalize_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trg_quotes_normalize_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.status := public.normalize_quote_status(new.status);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_quotes_normalize_status"() OWNER TO "postgres";

--
-- Name: trigger_marketing_playbooks(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."trigger_marketing_playbooks"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Playbook 1: New lead for "Free Air Check"
  -- This runs ONLY on INSERT of a new lead with the correct service.
  if (TG_OP = 'INSERT') and (new.service = 'Free Air Check') then
    -- Action 1: Immediate Welcome Email
    insert into marketing_actions (
      lead_id, playbook_key, type, channel, status, target_details, scheduled_at
    ) values (
      new.id, 'free_air_check_welcome', 'email', 'api', 'generating',
      jsonb_build_object('name', new.first_name, 'email', new.email), now()
    );
    -- Action 2: Scheduled Follow-up Email in 3 days
    insert into marketing_actions (
      lead_id, playbook_key, type, channel, status, target_details, scheduled_at
    ) values (
      new.id, 'free_air_check_followup', 'email', 'scheduled', 'scheduled',
      jsonb_build_object('name', new.first_name, 'email', new.email), now() + interval '3 days'
    );
  end if;

  -- Playbook 2: Partner Referral SMS Alert
  if (TG_OP = 'INSERT') and (new.partner_referral_code is not null) then
      insert into marketing_actions (
        lead_id, playbook_key, type, channel, status, target_details, scheduled_at
      ) values (
        new.id, 'partner_referral_alert', 'sms', 'api', 'generating',
        jsonb_build_object('name', new.first_name, 'code', new.partner_referral_code), now()
      );
  end if;

  -- Playbook 3: Partner Welcome Email
  -- Only trigger if the lead is a partner AND the source was NOT a CRM approval
  -- CRM approvals are now handled directly in the frontend to bypass review.
  if (TG_OP = 'INSERT') and (new.is_partner = true) and (new.source_detail <> 'CRM Approval') then
    insert into marketing_actions (
      lead_id, playbook_key, type, channel, status, target_details, scheduled_at
    ) values (
      new.id, 'partner_welcome', 'email', 'api', 'generating', -- 'generating' requires review
      jsonb_build_object('name', new.first_name, 'email', new.email), now()
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trigger_marketing_playbooks"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: app_user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."app_user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "text" NOT NULL
);


ALTER TABLE "public"."app_user_roles" OWNER TO "postgres";

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'tvg'::"text" NOT NULL,
    "lead_id" "uuid",
    "technician_id" "uuid",
    "price_book_id" "uuid",
    "service_name" "text" NOT NULL,
    "service_category" "text",
    "pricing_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scheduled_start" timestamp with time zone NOT NULL,
    "scheduled_end" timestamp with time zone NOT NULL,
    "arrival_window_start" timestamp with time zone,
    "arrival_window_end" timestamp with time zone,
    "duration_minutes" integer DEFAULT 120 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "service_address" "text",
    "customer_notes" "text",
    "admin_notes" "text",
    "reminders_enabled" boolean DEFAULT true NOT NULL,
    "confirmation_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_id" "uuid"
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";

--
-- Name: automation_suspensions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."automation_suspensions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "suspended_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resumed_at" timestamp with time zone
);


ALTER TABLE "public"."automation_suspensions" OWNER TO "postgres";

--
-- Name: COLUMN "automation_suspensions"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."automation_suspensions"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: business_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."business_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "business_name" "text",
    "email" "text",
    "business_email" "text",
    "phone" "text",
    "website" "text",
    "address" "text",
    "logo_url" "text",
    "primary_brand_color" "text" DEFAULT '#000000'::"text",
    "service_area_radius" integer DEFAULT 25,
    "service_zip_codes" "text"[] DEFAULT '{}'::"text"[],
    "operating_hours" "jsonb" DEFAULT '{"friday": {"end": "17:00", "start": "09:00", "isOpen": true}, "monday": {"end": "17:00", "start": "09:00", "isOpen": true}, "sunday": {"end": "14:00", "start": "10:00", "isOpen": false}, "tuesday": {"end": "17:00", "start": "09:00", "isOpen": true}, "saturday": {"end": "14:00", "start": "10:00", "isOpen": false}, "thursday": {"end": "17:00", "start": "09:00", "isOpen": true}, "wednesday": {"end": "17:00", "start": "09:00", "isOpen": true}}'::"jsonb",
    "time_zone" "text" DEFAULT 'America/New_York'::"text",
    "default_currency" "text" DEFAULT 'USD'::"text",
    "tax_rate" numeric(10,2) DEFAULT 0,
    "default_tax_rate" numeric(10,2) DEFAULT 0,
    "payment_terms" "text" DEFAULT 'Due on Receipt'::"text",
    "appointment_slot_duration" integer DEFAULT 60,
    "appointment_buffer_time" integer DEFAULT 15,
    "appointment_lead_time_hours" integer DEFAULT 24,
    "license_info" "text",
    "additional_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_settings" OWNER TO "postgres";

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "first_name" "text",
    "last_name" "text",
    "company" "text",
    "email" "text",
    "phone" "text",
    "is_customer" boolean DEFAULT false NOT NULL,
    "customer_created_at" timestamp with time zone,
    "manual_convert_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "preferred_contact_method" "text"
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";

--
-- Name: crm_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "owner_user_id" "uuid",
    "lead_id" "uuid",
    "source_type" "text",
    "source_id" "uuid",
    "type" "text",
    "title" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "priority" "text",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."crm_tasks" OWNER TO "postgres";

--
-- Name: COLUMN "crm_tasks"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."crm_tasks"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_type" "text" NOT NULL,
    "actor_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";

--
-- Name: COLUMN "events"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."events"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: global_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."global_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "text" DEFAULT 'tvg'::"text" NOT NULL
);


ALTER TABLE "public"."global_config" OWNER TO "postgres";

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "description" "text",
    "quantity" numeric,
    "unit_price" numeric,
    "total_price" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "text"
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";

--
-- Name: COLUMN "invoice_items"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."invoice_items"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: invoice_line_items; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."invoice_line_items" AS
 SELECT "invoice_id",
    COALESCE("jsonb_agg"("jsonb_build_object"('id', "id", 'description', "description", 'quantity', "quantity", 'unit_price', "unit_price", 'total_price', "total_price") ORDER BY "id") FILTER (WHERE ("invoice_id" IS NOT NULL)), '[]'::"jsonb") AS "line_items"
   FROM "public"."invoice_items"
  GROUP BY "invoice_id";


ALTER VIEW "public"."invoice_line_items" OWNER TO "postgres";

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "appointment_id" "uuid",
    "quote_id" "uuid",
    "job_id" "uuid",
    "invoice_number" "text",
    "status" "text",
    "subtotal" numeric,
    "tax_rate" numeric,
    "tax_amount" numeric,
    "total_amount" numeric,
    "amount_paid" numeric,
    "balance_due" numeric,
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "payment_method" "text",
    "notes" "text",
    "terms" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "public_token" "uuid" DEFAULT "gen_random_uuid"(),
    "discount_amount" numeric,
    "pdf_url" "text",
    "issue_date" "date",
    "is_test_data" boolean,
    "customer_email" "text",
    "account_id" "uuid",
    "property_id" "uuid",
    "estimate_id" "uuid",
    "quickbooks_id" "text",
    "quickbooks_sync_status" "text",
    "tenant_id" "text",
    "provider_payment_id" "text",
    "provider_payment_status" "text",
    "line_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "invoice_type" "text" DEFAULT 'final'::"text",
    "release_approved" boolean DEFAULT false,
    "release_approved_at" timestamp with time zone,
    "release_approved_by" "uuid",
    "customer_name" "text",
    "customer_phone" "text",
    "settlement_status" "text",
    "last_payment_at" timestamp with time zone,
    "reconciliation_required" boolean DEFAULT false,
    "reconciliation_reason" "text",
    CONSTRAINT "invoices_invoice_type_check" CHECK (("lower"("invoice_type") = ANY (ARRAY['deposit'::"text", 'progress'::"text", 'final'::"text"]))),
    CONSTRAINT "invoices_line_items_is_array" CHECK (("jsonb_typeof"("line_items") = 'array'::"text"))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";

--
-- Name: COLUMN "invoices"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."invoices"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "lead_id" "uuid",
    "quote_id" "uuid",
    "status" "text" DEFAULT 'UNSCHEDULED'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_number" "text",
    "job_number" "text",
    "quote_number" "text",
    "scheduled_start" timestamp with time zone,
    "scheduled_end" timestamp with time zone,
    "technician_id" "uuid",
    "service_address" "text",
    "payment_status" "text",
    "total_amount" numeric,
    "priority" "text",
    "access_notes" "text",
    "completed_at" timestamp with time zone,
    "customer_type_snapshot" "text",
    "payment_terms" "text",
    "scope_summary" "text",
    "special_conditions" "text",
    "property_notes" "text",
    "execution_checklist" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "execution_findings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "execution_photos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "technician_notes" "text",
    "customer_summary" "text",
    "follow_up_required" boolean DEFAULT false NOT NULL,
    "follow_up_notes" "text",
    "report_url" "text"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";

--
-- Name: COLUMN "jobs"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."jobs"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "contact_id" "uuid",
    "property_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "company" "text",
    "email" "text",
    "phone" "text",
    "service" "text",
    "source" "text",
    "source_detail" "text",
    "partner_referral_code" "text",
    "is_partner" boolean DEFAULT false NOT NULL,
    "status" "text",
    "stage" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "persona" "public"."lead_persona" DEFAULT 'unclassified'::"public"."lead_persona" NOT NULL,
    "last_human_signal_at" timestamp with time zone,
    "preferred_document_delivery" "text",
    "sms_consent" boolean DEFAULT false,
    "sms_opt_out" boolean DEFAULT false,
    CONSTRAINT "leads_preferred_document_delivery_check" CHECK ((("preferred_document_delivery" IS NULL) OR ("preferred_document_delivery" = ANY (ARRAY['auto'::"text", 'email'::"text", 'sms'::"text"]))))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";

--
-- Name: COLUMN "leads"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."leads"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: COLUMN "leads"."persona"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."leads"."persona" IS 'Lead persona. Defaults to unclassified; must be set explicitly during intake.';


--
-- Name: COLUMN "leads"."last_human_signal_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."leads"."last_human_signal_at" IS 'Timestamp of last human interaction (quote view, invoice view, payment attempt)';


--
-- Name: job_operational_state_v1; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."job_operational_state_v1" WITH ("security_invoker"='true') AS
 WITH "latest_invoice" AS (
         SELECT DISTINCT ON ("i"."job_id") "i"."job_id",
            "i"."id",
            "lower"("btrim"(COALESCE("i"."status", ''::"text"))) AS "status",
            "i"."invoice_number",
            "i"."due_date",
            "i"."sent_at",
            "i"."balance_due",
            "i"."total_amount",
            "i"."created_at"
           FROM "public"."invoices" "i"
          WHERE ("i"."job_id" IS NOT NULL)
          ORDER BY "i"."job_id", "i"."created_at" DESC, "i"."id" DESC
        ), "base" AS (
         SELECT "j"."id",
            "j"."tenant_id",
            "lower"("btrim"(COALESCE("j"."status", 'unscheduled'::"text"))) AS "status",
            "lower"("btrim"(COALESCE("j"."payment_status", 'unpaid'::"text"))) AS "payment_status",
            "j"."scheduled_start",
            "j"."scheduled_end",
            "j"."service_address",
            "j"."technician_id",
            "j"."updated_at",
            "j"."completed_at",
            "j"."total_amount",
            "j"."work_order_number",
            "j"."job_number",
            "j"."quote_id",
            "j"."quote_number",
            "j"."lead_id",
            "j"."created_at",
            "upper"("btrim"(COALESCE("j"."payment_terms", "public"."default_job_payment_terms"("j"."customer_type_snapshot")))) AS "payment_terms",
            "public"."normalize_job_customer_type"("j"."customer_type_snapshot") AS "customer_type_snapshot",
            "li"."id" AS "latest_invoice_id",
            "li"."status" AS "latest_invoice_status",
            "li"."invoice_number" AS "latest_invoice_number",
            "li"."due_date" AS "latest_invoice_due_date",
            "li"."balance_due" AS "latest_invoice_balance_due",
            "l"."first_name" AS "lead_first_name",
            "l"."last_name" AS "lead_last_name",
            "l"."phone" AS "lead_phone",
            "l"."email" AS "lead_email"
           FROM (("public"."jobs" "j"
             LEFT JOIN "latest_invoice" "li" ON (("li"."job_id" = "j"."id")))
             LEFT JOIN "public"."leads" "l" ON (("l"."id" = "j"."lead_id")))
        ), "staged" AS (
         SELECT "b"."id",
            "b"."tenant_id",
            "b"."status",
            "b"."payment_status",
            "b"."scheduled_start",
            "b"."scheduled_end",
            "b"."service_address",
            "b"."technician_id",
            "b"."updated_at",
            "b"."completed_at",
            "b"."total_amount",
            "b"."work_order_number",
            "b"."job_number",
            "b"."quote_id",
            "b"."quote_number",
            "b"."lead_id",
            "b"."created_at",
            "b"."payment_terms",
            "b"."customer_type_snapshot",
            "b"."latest_invoice_id",
            "b"."latest_invoice_status",
            "b"."latest_invoice_number",
            "b"."latest_invoice_due_date",
            "b"."latest_invoice_balance_due",
            "b"."lead_first_name",
            "b"."lead_last_name",
            "b"."lead_phone",
            "b"."lead_email",
                CASE
                    WHEN (("b"."payment_status" = 'paid'::"text") OR ("b"."latest_invoice_status" = 'paid'::"text")) THEN 'paid'::"text"
                    WHEN (("b"."latest_invoice_id" IS NOT NULL) AND ("b"."latest_invoice_status" = 'draft'::"text")) THEN 'invoice_draft'::"text"
                    WHEN (("b"."latest_invoice_id" IS NOT NULL) AND ("b"."latest_invoice_status" = ANY (ARRAY['sent'::"text", 'partial'::"text", 'overdue'::"text", 'accepted'::"text", 'approved'::"text"]))) THEN 'invoiced'::"text"
                    WHEN ("b"."status" = ANY (ARRAY['unscheduled'::"text", 'pending_schedule'::"text", 'scheduled'::"text", 'en_route'::"text", 'in_progress'::"text", 'on_hold'::"text", 'completed'::"text", 'cancelled'::"text"])) THEN "b"."status"
                    ELSE 'unscheduled'::"text"
                END AS "operational_stage"
           FROM "base" "b"
        ), "timed" AS (
         SELECT "s"."id",
            "s"."tenant_id",
            "s"."status",
            "s"."payment_status",
            "s"."scheduled_start",
            "s"."scheduled_end",
            "s"."service_address",
            "s"."technician_id",
            "s"."updated_at",
            "s"."completed_at",
            "s"."total_amount",
            "s"."work_order_number",
            "s"."job_number",
            "s"."quote_id",
            "s"."quote_number",
            "s"."lead_id",
            "s"."created_at",
            "s"."payment_terms",
            "s"."customer_type_snapshot",
            "s"."latest_invoice_id",
            "s"."latest_invoice_status",
            "s"."latest_invoice_number",
            "s"."latest_invoice_due_date",
            "s"."latest_invoice_balance_due",
            "s"."lead_first_name",
            "s"."lead_last_name",
            "s"."lead_phone",
            "s"."lead_email",
            "s"."operational_stage",
                CASE
                    WHEN ("s"."operational_stage" = ANY (ARRAY['unscheduled'::"text", 'pending_schedule'::"text"])) THEN (COALESCE("s"."updated_at", "s"."created_at") + '24:00:00'::interval)
                    WHEN ("s"."operational_stage" = 'scheduled'::"text") THEN "s"."scheduled_start"
                    WHEN ("s"."operational_stage" = 'invoice_draft'::"text") THEN (COALESCE("s"."completed_at", "s"."updated_at", "s"."created_at") + '12:00:00'::interval)
                    WHEN ("s"."operational_stage" = 'invoiced'::"text") THEN COALESCE(("s"."latest_invoice_due_date")::timestamp with time zone, ("s"."completed_at" + "make_interval"("days" => "public"."payment_terms_due_days"("s"."payment_terms"))), ("s"."updated_at" + "make_interval"("days" => "public"."payment_terms_due_days"("s"."payment_terms"))))
                    ELSE NULL::timestamp with time zone
                END AS "due_at"
           FROM "staged" "s"
        )
 SELECT "id",
    "tenant_id",
    "status",
    "payment_status",
    "scheduled_start",
    "scheduled_end",
    "service_address",
    "technician_id",
    "updated_at",
    "completed_at",
    "total_amount",
    "work_order_number",
    "job_number",
    "quote_id",
    "quote_number",
    "lead_id",
    "created_at",
    "payment_terms",
    "customer_type_snapshot",
    "latest_invoice_id",
    "latest_invoice_status",
    "latest_invoice_number",
    "latest_invoice_due_date",
    "latest_invoice_balance_due",
    "lead_first_name",
    "lead_last_name",
    "lead_phone",
    "lead_email",
    "operational_stage",
    "due_at",
        CASE
            WHEN ("operational_stage" = ANY (ARRAY['unscheduled'::"text", 'pending_schedule'::"text"])) THEN 10
            WHEN ("operational_stage" = 'scheduled'::"text") THEN 20
            WHEN ("operational_stage" = 'en_route'::"text") THEN 30
            WHEN ("operational_stage" = 'in_progress'::"text") THEN 40
            WHEN ("operational_stage" = 'on_hold'::"text") THEN 45
            WHEN ("operational_stage" = 'invoice_draft'::"text") THEN 50
            WHEN ("operational_stage" = 'invoiced'::"text") THEN 60
            WHEN ("operational_stage" = 'completed'::"text") THEN 70
            WHEN ("operational_stage" = 'paid'::"text") THEN 80
            WHEN ("operational_stage" = 'cancelled'::"text") THEN 90
            ELSE 95
        END AS "operational_sort",
    (("due_at" IS NOT NULL) AND ("due_at" < "now"()) AND ("operational_stage" <> ALL (ARRAY['paid'::"text", 'cancelled'::"text"]))) AS "is_overdue",
        CASE
            WHEN ("due_at" IS NULL) THEN NULL::"text"
            WHEN ("due_at" >= "now"()) THEN NULL::"text"
            WHEN ("operational_stage" = ANY (ARRAY['unscheduled'::"text", 'pending_schedule'::"text"])) THEN 'Scheduling overdue'::"text"
            WHEN ("operational_stage" = 'scheduled'::"text") THEN 'Dispatch overdue'::"text"
            WHEN ("operational_stage" = 'invoice_draft'::"text") THEN 'Invoice draft overdue'::"text"
            WHEN ("operational_stage" = 'invoiced'::"text") THEN 'Invoice overdue'::"text"
            ELSE 'Attention needed'::"text"
        END AS "overdue_reason",
        CASE
            WHEN ("operational_stage" = ANY (ARRAY['unscheduled'::"text", 'pending_schedule'::"text"])) THEN 'Schedule'::"text"
            WHEN ("operational_stage" = 'scheduled'::"text") THEN 'Start'::"text"
            WHEN ("operational_stage" = ANY (ARRAY['en_route'::"text", 'in_progress'::"text"])) THEN 'Complete'::"text"
            WHEN ("operational_stage" = 'invoice_draft'::"text") THEN 'Send Invoice'::"text"
            WHEN ("operational_stage" = 'invoiced'::"text") THEN 'Collect Payment'::"text"
            WHEN ("operational_stage" = 'paid'::"text") THEN 'Closed'::"text"
            WHEN ("operational_stage" = 'on_hold'::"text") THEN 'Resume'::"text"
            ELSE 'Open'::"text"
        END AS "next_action_label"
   FROM "timed" "t";


ALTER VIEW "public"."job_operational_state_v1" OWNER TO "postgres";

--
-- Name: marketing_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."marketing_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "status" "text" DEFAULT 'needs_approval'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_actions" OWNER TO "postgres";

--
-- Name: now_queue; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."now_queue" AS
 WITH "open_statuses" AS (
         SELECT "unnest"(ARRAY['open'::"text", 'new'::"text", 'pending'::"text", 'PENDING'::"text", 'in-progress'::"text"]) AS "status"
        )
 SELECT 1 AS "priority",
    0 AS "subpriority",
    "l"."tenant_id",
    'lead'::"text" AS "item_type",
    "l"."id" AS "entity_id",
    "l"."id" AS "lead_id",
    "concat"('New lead: ', COALESCE("l"."first_name", ''::"text"), ' ', COALESCE("l"."last_name", ''::"text")) AS "title",
    "l"."created_at",
    NULL::timestamp with time zone AS "due_at",
    "jsonb_build_object"('status', "l"."status", 'stage', "l"."stage") AS "metadata"
   FROM "public"."leads" "l"
  WHERE (("lower"(COALESCE("l"."status", ''::"text")) = 'new'::"text") AND ("lower"(COALESCE("l"."stage", ''::"text")) = 'new'::"text"))
UNION ALL
 SELECT 2 AS "priority",
        CASE
            WHEN ("t"."title" ~~* 'Quote Viewed%'::"text") THEN 0
            ELSE 1
        END AS "subpriority",
    "t"."tenant_id",
    'task'::"text" AS "item_type",
    "t"."source_id" AS "entity_id",
    "t"."lead_id",
    "t"."title",
    "t"."created_at",
    "t"."due_at",
    "t"."metadata"
   FROM "public"."crm_tasks" "t"
  WHERE (("t"."type" = 'follow_up'::"text") AND ("t"."source_type" = 'quote'::"text") AND ("t"."status" IN ( SELECT "open_statuses"."status"
           FROM "open_statuses")))
UNION ALL
 SELECT 3 AS "priority",
    0 AS "subpriority",
    "t"."tenant_id",
    'task'::"text" AS "item_type",
    "t"."source_id" AS "entity_id",
    "t"."lead_id",
    "t"."title",
    "t"."created_at",
    "t"."due_at",
    "t"."metadata"
   FROM "public"."crm_tasks" "t"
  WHERE (("t"."type" = 'follow_up'::"text") AND ("t"."source_type" = 'job'::"text") AND ("t"."title" = 'Schedule Job'::"text") AND ("t"."status" IN ( SELECT "open_statuses"."status"
           FROM "open_statuses")))
UNION ALL
 SELECT 4 AS "priority",
        CASE
            WHEN ("t"."title" ~~* 'Invoice Viewed%'::"text") THEN 0
            ELSE 1
        END AS "subpriority",
    "t"."tenant_id",
    'task'::"text" AS "item_type",
    "t"."source_id" AS "entity_id",
    "t"."lead_id",
    "t"."title",
    "t"."created_at",
    "t"."due_at",
    "t"."metadata"
   FROM "public"."crm_tasks" "t"
  WHERE (("t"."type" = 'follow_up'::"text") AND ("t"."source_type" = 'invoice'::"text") AND ("t"."status" IN ( SELECT "open_statuses"."status"
           FROM "open_statuses")))
UNION ALL
 SELECT 5 AS "priority",
    0 AS "subpriority",
    "t"."tenant_id",
    'task'::"text" AS "item_type",
    "t"."id" AS "entity_id",
    "t"."lead_id",
    "t"."title",
    "t"."created_at",
    "t"."due_at",
    "t"."metadata"
   FROM "public"."crm_tasks" "t"
  WHERE (("t"."status" IN ( SELECT "open_statuses"."status"
           FROM "open_statuses")) AND (COALESCE("t"."type", ''::"text") <> 'follow_up'::"text"));


ALTER VIEW "public"."now_queue" OWNER TO "postgres";

--
-- Name: payment_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."payment_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "writer_mode" "text" DEFAULT 'offline'::"text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "manual_reference_raw" "text" NOT NULL,
    "manual_reference_norm" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "payment_method" "text" NOT NULL,
    "attempt_status" "text" DEFAULT 'received'::"text" NOT NULL,
    "resolved_transaction_id" "uuid",
    "created_by_user_id" "uuid",
    "request_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_attempts_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payment_attempts_reference_norm_matches" CHECK (("manual_reference_norm" = "public"."normalize_manual_reference"("manual_reference_raw")))
);


ALTER TABLE "public"."payment_attempts" OWNER TO "postgres";

--
-- Name: price_book; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."price_book" (
    "id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "base_price" numeric(10,2) NOT NULL,
    "price_type" "text",
    "description" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."price_book" OWNER TO "postgres";

--
-- Name: properties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "address1" "text",
    "address2" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."properties" OWNER TO "postgres";

--
-- Name: provider_payment_observations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."provider_payment_observations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "provider_payment_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "amount_cents" bigint,
    "currency" "text" DEFAULT 'usd'::"text",
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."provider_payment_observations" OWNER TO "postgres";

--
-- Name: public_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."public_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" NOT NULL,
    "tenant_id" "text",
    "quote_id" "uuid",
    "invoice_id" "uuid",
    "token_hash" "text",
    "ip_address" "text",
    "user_agent" "text",
    "status" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."public_events" OWNER TO "postgres";

--
-- Name: public_payment_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."public_payment_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "public_token" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "method" "text" DEFAULT 'card'::"text" NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "checkout_session_id" "text",
    "checkout_url" "text",
    "provider_payment_id" "text",
    "attempt_status" "text" DEFAULT 'initiated'::"text" NOT NULL,
    "run_id" "text",
    "client_ip" "text",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "public_payment_attempts_amount_positive" CHECK (("amount_cents" > 0))
);


ALTER TABLE "public"."public_payment_attempts" OWNER TO "postgres";

--
-- Name: quote_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."quote_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "description" "text",
    "quantity" numeric,
    "unit_price" numeric,
    "total_price" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "text"
);


ALTER TABLE "public"."quote_items" OWNER TO "postgres";

--
-- Name: COLUMN "quote_items"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."quote_items"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: quote_line_items; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."quote_line_items" AS
 SELECT "quote_id",
    COALESCE("jsonb_agg"("jsonb_build_object"('id', "id", 'description', "description", 'quantity', "quantity", 'unit_price', "unit_price", 'total_price', "total_price") ORDER BY "id") FILTER (WHERE ("quote_id" IS NOT NULL)), '[]'::"jsonb") AS "line_items"
   FROM "public"."quote_items"
  GROUP BY "quote_id";


ALTER VIEW "public"."quote_line_items" OWNER TO "postgres";

--
-- Name: quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "quote_number" "text",
    "status" "text",
    "subtotal" numeric,
    "tax_rate" numeric,
    "tax_amount" numeric,
    "total_amount" numeric,
    "valid_until" "date",
    "header_text" "text",
    "footer_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",
    "estimate_id" "uuid",
    "user_id" "uuid",
    "fulfillment_mode" "text",
    "customer_email" "text",
    "tenant_id" "text",
    "public_token" "uuid" DEFAULT "gen_random_uuid"(),
    "line_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "service_address" "text",
    "customer_name" "text",
    "customer_phone" "text",
    CONSTRAINT "quotes_line_items_is_array" CHECK (("jsonb_typeof"("line_items") = 'array'::"text"))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";

--
-- Name: COLUMN "quotes"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."quotes"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: COLUMN "quotes"."service_address"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."quotes"."service_address" IS 'Service address captured at quote stage. Used for travel-zone costing and downstream work-order scheduling.';


--
-- Name: reconciliation_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."reconciliation_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_key" "text" NOT NULL,
    "tenant_id" "text",
    "invoice_id" "uuid",
    "provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "provider_payment_id" "text",
    "gateway_event_id" "text",
    "anomaly_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'high'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "first_detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."reconciliation_alerts" OWNER TO "postgres";

--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "event_id" "text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text",
    "invoice_id" "uuid",
    "payment_intent_id" "text",
    "payload" "jsonb",
    "processed_at" timestamp with time zone,
    "processed_status" "text",
    "provider_payment_id" "text",
    "resolved_transaction_id" "uuid",
    "reconciliation_required" boolean DEFAULT false,
    "quarantine_reason" "text"
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";

--
-- Name: reconciliation_queue; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."reconciliation_queue" AS
 SELECT 'invoice'::"text" AS "item_type",
    "i"."tenant_id",
    "i"."id" AS "invoice_id",
    NULL::"uuid" AS "transaction_id",
    NULL::"text" AS "gateway_event_id",
    "i"."reconciliation_reason" AS "reason",
    "i"."updated_at",
    "i"."created_at"
   FROM "public"."invoices" "i"
  WHERE (COALESCE("i"."reconciliation_required", false) = true)
UNION ALL
 SELECT 'webhook_event'::"text" AS "item_type",
    "i"."tenant_id",
    "e"."invoice_id",
    "e"."resolved_transaction_id" AS "transaction_id",
    "e"."event_id" AS "gateway_event_id",
    COALESCE("e"."quarantine_reason", "e"."processed_status", 'reconciliation_required'::"text") AS "reason",
    COALESCE("e"."processed_at", "e"."received_at") AS "updated_at",
    "e"."received_at" AS "created_at"
   FROM ("public"."stripe_webhook_events" "e"
     LEFT JOIN "public"."invoices" "i" ON (("i"."id" = "e"."invoice_id")))
  WHERE (COALESCE("e"."reconciliation_required", false) = true);


ALTER VIEW "public"."reconciliation_queue" OWNER TO "postgres";

--
-- Name: superusers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."superusers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."superusers" OWNER TO "postgres";

--
-- Name: technicians; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."technicians" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "color_code" "text" DEFAULT '#3b82f6'::"text",
    "is_active" boolean DEFAULT true,
    "is_primary_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."technicians" OWNER TO "postgres";

--
-- Name: transaction_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."transaction_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "applied_amount" numeric NOT NULL,
    "application_type" "text" DEFAULT 'payment'::"text" NOT NULL,
    "created_by_user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transaction_applications_positive_amount" CHECK (("applied_amount" > (0)::numeric))
);


ALTER TABLE "public"."transaction_applications" OWNER TO "postgres";

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "invoice_id" "uuid",
    "amount" numeric,
    "method" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'legacy'::"text",
    "currency" "text" DEFAULT 'usd'::"text",
    "provider_reference" "text",
    "idempotency_key" "text" NOT NULL,
    "manual_reference_norm" "text",
    "created_by_user_id" "uuid",
    "recorded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";

--
-- Name: work_order_sequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."work_order_sequences" (
    "tenant_id" "text" NOT NULL,
    "seq_year" integer NOT NULL,
    "last_value" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."work_order_sequences" OWNER TO "postgres";

--
-- Name: app_user_roles app_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."app_user_roles"
    ADD CONSTRAINT "app_user_roles_pkey" PRIMARY KEY ("id");


--
-- Name: appointments appointments_job_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_job_id_unique" UNIQUE ("job_id");


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");


--
-- Name: automation_suspensions automation_suspensions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."automation_suspensions"
    ADD CONSTRAINT "automation_suspensions_pkey" PRIMARY KEY ("id");


--
-- Name: business_settings business_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id");


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");


--
-- Name: crm_tasks crm_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_tasks"
    ADD CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id");


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");


--
-- Name: global_config global_config_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."global_config"
    ADD CONSTRAINT "global_config_key_key" UNIQUE ("key");


--
-- Name: global_config global_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."global_config"
    ADD CONSTRAINT "global_config_pkey" PRIMARY KEY ("id");


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");


--
-- Name: invoices invoices_public_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_public_token_key" UNIQUE ("public_token");


--
-- Name: jobs jobs_customer_type_snapshot_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE "public"."jobs"
    ADD CONSTRAINT "jobs_customer_type_snapshot_check" CHECK ((("customer_type_snapshot" IS NULL) OR ("public"."normalize_job_customer_type"("customer_type_snapshot") = ANY (ARRAY['residential'::"text", 'commercial'::"text", 'property_management'::"text"])))) NOT VALID;


--
-- Name: jobs jobs_payment_status_contract_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE "public"."jobs"
    ADD CONSTRAINT "jobs_payment_status_contract_check" CHECK ((("payment_status" IS NULL) OR ("payment_status" = ANY (ARRAY['unpaid'::"text", 'partial'::"text", 'paid'::"text", 'refunded'::"text", 'void'::"text"])))) NOT VALID;


--
-- Name: jobs jobs_payment_terms_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE "public"."jobs"
    ADD CONSTRAINT "jobs_payment_terms_check" CHECK ((("payment_terms" IS NULL) OR ("upper"("btrim"("payment_terms")) = ANY (ARRAY['NET_7'::"text", 'NET_15'::"text", 'NET_30'::"text", 'DUE_ON_RECEIPT'::"text"])))) NOT VALID;


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");


--
-- Name: jobs jobs_status_contract_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE "public"."jobs"
    ADD CONSTRAINT "jobs_status_contract_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['pending'::"text", 'unscheduled'::"text", 'pending_schedule'::"text", 'scheduled'::"text", 'en_route'::"text", 'started'::"text", 'in_progress'::"text", 'on_hold'::"text", 'ready_to_invoice'::"text", 'open'::"text", 'completed'::"text", 'closed'::"text", 'cancelled'::"text"])))) NOT VALID;


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");


--
-- Name: marketing_actions marketing_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."marketing_actions"
    ADD CONSTRAINT "marketing_actions_pkey" PRIMARY KEY ("id");


--
-- Name: payment_attempts payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_attempts"
    ADD CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id");


--
-- Name: price_book price_book_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."price_book"
    ADD CONSTRAINT "price_book_pkey" PRIMARY KEY ("id");


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");


--
-- Name: provider_payment_observations provider_payment_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."provider_payment_observations"
    ADD CONSTRAINT "provider_payment_observations_pkey" PRIMARY KEY ("id");


--
-- Name: public_events public_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."public_events"
    ADD CONSTRAINT "public_events_pkey" PRIMARY KEY ("id");


--
-- Name: public_payment_attempts public_payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."public_payment_attempts"
    ADD CONSTRAINT "public_payment_attempts_pkey" PRIMARY KEY ("id");


--
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id");


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");


--
-- Name: quotes quotes_public_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_public_token_key" UNIQUE ("public_token");


--
-- Name: reconciliation_alerts reconciliation_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reconciliation_alerts"
    ADD CONSTRAINT "reconciliation_alerts_pkey" PRIMARY KEY ("id");


--
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("event_id");


--
-- Name: superusers superusers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."superusers"
    ADD CONSTRAINT "superusers_email_key" UNIQUE ("email");


--
-- Name: superusers superusers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."superusers"
    ADD CONSTRAINT "superusers_pkey" PRIMARY KEY ("id");


--
-- Name: technicians technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."technicians"
    ADD CONSTRAINT "technicians_pkey" PRIMARY KEY ("id");


--
-- Name: technicians technicians_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."technicians"
    ADD CONSTRAINT "technicians_user_id_key" UNIQUE ("user_id");


--
-- Name: transaction_applications transaction_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."transaction_applications"
    ADD CONSTRAINT "transaction_applications_pkey" PRIMARY KEY ("id");


--
-- Name: transaction_applications transaction_applications_tx_invoice_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."transaction_applications"
    ADD CONSTRAINT "transaction_applications_tx_invoice_uniq" UNIQUE ("transaction_id", "invoice_id");


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");


--
-- Name: price_book unique_code_per_tenant; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."price_book"
    ADD CONSTRAINT "unique_code_per_tenant" UNIQUE ("tenant_id", "code");


--
-- Name: work_order_sequences work_order_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."work_order_sequences"
    ADD CONSTRAINT "work_order_sequences_pkey" PRIMARY KEY ("tenant_id", "seq_year");


--
-- Name: app_user_roles_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "app_user_roles_tenant_id_idx" ON "public"."app_user_roles" USING "btree" ("tenant_id");


--
-- Name: appointments_job_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "appointments_job_id_idx" ON "public"."appointments" USING "btree" ("job_id");


--
-- Name: appointments_lead_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "appointments_lead_idx" ON "public"."appointments" USING "btree" ("lead_id");


--
-- Name: appointments_technician_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "appointments_technician_idx" ON "public"."appointments" USING "btree" ("technician_id", "scheduled_start");


--
-- Name: appointments_tenant_status_start_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "appointments_tenant_status_start_idx" ON "public"."appointments" USING "btree" ("tenant_id", "status", "scheduled_start");


--
-- Name: automation_suspensions_entity_active_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "automation_suspensions_entity_active_uq" ON "public"."automation_suspensions" USING "btree" ("entity_type", "entity_id") WHERE (("resumed_at" IS NULL) AND ("tenant_id" IS NULL));


--
-- Name: automation_suspensions_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "automation_suspensions_entity_idx" ON "public"."automation_suspensions" USING "btree" ("entity_type", "entity_id");


--
-- Name: automation_suspensions_tenant_active_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "automation_suspensions_tenant_active_uq" ON "public"."automation_suspensions" USING "btree" ("tenant_id", "entity_type", "entity_id") WHERE (("resumed_at" IS NULL) AND ("tenant_id" IS NOT NULL));


--
-- Name: automation_suspensions_tenant_suspended_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "automation_suspensions_tenant_suspended_idx" ON "public"."automation_suspensions" USING "btree" ("tenant_id", "suspended_at" DESC);


--
-- Name: business_settings_tenant_updated_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "business_settings_tenant_updated_idx" ON "public"."business_settings" USING "btree" ("tenant_id", "updated_at" DESC);


--
-- Name: contacts_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "contacts_email_idx" ON "public"."contacts" USING "btree" ("email");


--
-- Name: contacts_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "contacts_tenant_id_idx" ON "public"."contacts" USING "btree" ("tenant_id");


--
-- Name: crm_tasks_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_tasks_source_idx" ON "public"."crm_tasks" USING "btree" ("tenant_id", "source_type", "source_id");


--
-- Name: crm_tasks_status_base_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_tasks_status_base_idx" ON "public"."crm_tasks" USING "btree" ("status");


--
-- Name: crm_tasks_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_tasks_status_idx" ON "public"."crm_tasks" USING "btree" ("status");


--
-- Name: crm_tasks_tenant_due_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_tasks_tenant_due_idx" ON "public"."crm_tasks" USING "btree" ("tenant_id", "due_at");


--
-- Name: crm_tasks_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_tasks_tenant_id_idx" ON "public"."crm_tasks" USING "btree" ("tenant_id");


--
-- Name: events_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "events_entity_idx" ON "public"."events" USING "btree" ("entity_type", "entity_id", "created_at" DESC);


--
-- Name: events_event_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "events_event_type_idx" ON "public"."events" USING "btree" ("event_type", "created_at" DESC);


--
-- Name: events_invoice_paid_tx_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "events_invoice_paid_tx_uq" ON "public"."events" USING "btree" ((("payload" ->> 'transaction_id'::"text"))) WHERE (("event_type" = 'InvoicePaid'::"text") AND ("payload" ? 'transaction_id'::"text") AND (("payload" ->> 'transaction_id'::"text") IS NOT NULL));


--
-- Name: events_job_created_singleton_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "events_job_created_singleton_uq" ON "public"."events" USING "btree" ("entity_type", "entity_id", "event_type") WHERE (("entity_type" = 'job'::"text") AND ("event_type" = 'JobCreated'::"text"));


--
-- Name: events_offline_payment_recorded_tx_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "events_offline_payment_recorded_tx_uq" ON "public"."events" USING "btree" ((("payload" ->> 'transaction_id'::"text"))) WHERE (("event_type" = 'OfflinePaymentRecorded'::"text") AND ("payload" ? 'transaction_id'::"text") AND (("payload" ->> 'transaction_id'::"text") IS NOT NULL));


--
-- Name: events_payment_initiated_checkout_session_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "events_payment_initiated_checkout_session_uq" ON "public"."events" USING "btree" ((("payload" ->> 'checkout_session_id'::"text"))) WHERE (("event_type" = 'PaymentInitiated'::"text") AND ("payload" ? 'checkout_session_id'::"text") AND (("payload" ->> 'checkout_session_id'::"text") IS NOT NULL));


--
-- Name: events_payment_succeeded_tx_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "events_payment_succeeded_tx_uq" ON "public"."events" USING "btree" ((("payload" ->> 'transaction_id'::"text"))) WHERE (("event_type" = 'PaymentSucceeded'::"text") AND ("payload" ? 'transaction_id'::"text") AND (("payload" ->> 'transaction_id'::"text") IS NOT NULL));


--
-- Name: events_tenant_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "events_tenant_created_idx" ON "public"."events" USING "btree" ("tenant_id", "created_at" DESC);


--
-- Name: global_config_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "global_config_tenant_id_idx" ON "public"."global_config" USING "btree" ("tenant_id");


--
-- Name: idx_marketing_actions_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_marketing_actions_lead_id" ON "public"."marketing_actions" USING "btree" ("lead_id");


--
-- Name: idx_marketing_actions_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_marketing_actions_status_created" ON "public"."marketing_actions" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_price_book_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_price_book_name" ON "public"."price_book" USING "btree" ("name");


--
-- Name: idx_price_book_tenant_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_price_book_tenant_active" ON "public"."price_book" USING "btree" ("tenant_id", "active");


--
-- Name: idx_quotes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_quotes_status" ON "public"."quotes" USING "btree" ("status");


--
-- Name: idx_quotes_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_quotes_tenant_id" ON "public"."quotes" USING "btree" ("tenant_id");


--
-- Name: invoice_items_invoice_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoice_items_invoice_id_idx" ON "public"."invoice_items" USING "btree" ("invoice_id");


--
-- Name: invoices_job_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_job_id_idx" ON "public"."invoices" USING "btree" ("job_id");


--
-- Name: invoices_lead_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_lead_id_idx" ON "public"."invoices" USING "btree" ("lead_id");


--
-- Name: invoices_one_draft_per_job_type_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "invoices_one_draft_per_job_type_uq" ON "public"."invoices" USING "btree" ("tenant_id", "job_id", "invoice_type") WHERE (("job_id" IS NOT NULL) AND ("tenant_id" IS NOT NULL) AND ("lower"(COALESCE("status", ''::"text")) = 'draft'::"text"));


--
-- Name: invoices_provider_payment_id_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "invoices_provider_payment_id_uq" ON "public"."invoices" USING "btree" ("provider_payment_id") WHERE ("provider_payment_id" IS NOT NULL);


--
-- Name: invoices_public_token_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_public_token_idx" ON "public"."invoices" USING "btree" ("public_token");


--
-- Name: invoices_quote_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_quote_id_idx" ON "public"."invoices" USING "btree" ("quote_id");


--
-- Name: invoices_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_tenant_id_idx" ON "public"."invoices" USING "btree" ("tenant_id");


--
-- Name: invoices_tenant_job_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_tenant_job_idx" ON "public"."invoices" USING "btree" ("tenant_id", "job_id");


--
-- Name: jobs_lead_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "jobs_lead_id_idx" ON "public"."jobs" USING "btree" ("lead_id");


--
-- Name: jobs_quote_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "jobs_quote_id_idx" ON "public"."jobs" USING "btree" ("quote_id");


--
-- Name: jobs_quote_id_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "jobs_quote_id_unique" ON "public"."jobs" USING "btree" ("quote_id") WHERE ("quote_id" IS NOT NULL);


--
-- Name: INDEX "jobs_quote_id_unique"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX "public"."jobs_quote_id_unique" IS 'Prevent duplicate jobs for same quote';


--
-- Name: jobs_scheduled_start_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "jobs_scheduled_start_idx" ON "public"."jobs" USING "btree" ("scheduled_start");


--
-- Name: jobs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "jobs_status_idx" ON "public"."jobs" USING "btree" ("status");


--
-- Name: jobs_technician_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "jobs_technician_id_idx" ON "public"."jobs" USING "btree" ("technician_id");


--
-- Name: jobs_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "jobs_tenant_id_idx" ON "public"."jobs" USING "btree" ("tenant_id");


--
-- Name: jobs_tenant_quote_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "jobs_tenant_quote_unique" ON "public"."jobs" USING "btree" ("tenant_id", "quote_id") WHERE ("quote_id" IS NOT NULL);


--
-- Name: jobs_tenant_work_order_number_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "jobs_tenant_work_order_number_uidx" ON "public"."jobs" USING "btree" ("tenant_id", "work_order_number") WHERE ("work_order_number" IS NOT NULL);


--
-- Name: leads_contact_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "leads_contact_id_idx" ON "public"."leads" USING "btree" ("contact_id");


--
-- Name: leads_property_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "leads_property_id_idx" ON "public"."leads" USING "btree" ("property_id");


--
-- Name: leads_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "leads_tenant_id_idx" ON "public"."leads" USING "btree" ("tenant_id");


--
-- Name: payment_attempts_tenant_invoice_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payment_attempts_tenant_invoice_idx" ON "public"."payment_attempts" USING "btree" ("tenant_id", "invoice_id", "created_at" DESC);


--
-- Name: properties_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "properties_tenant_id_idx" ON "public"."properties" USING "btree" ("tenant_id");


--
-- Name: provider_payment_observations_dedupe_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "provider_payment_observations_dedupe_uq" ON "public"."provider_payment_observations" USING "btree" ("provider", "provider_payment_id", "status", "observed_at");


--
-- Name: provider_payment_observations_provider_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "provider_payment_observations_provider_id_idx" ON "public"."provider_payment_observations" USING "btree" ("provider", "provider_payment_id", "observed_at" DESC);


--
-- Name: public_payment_attempts_invoice_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "public_payment_attempts_invoice_idx" ON "public"."public_payment_attempts" USING "btree" ("invoice_id", "created_at" DESC);


--
-- Name: quote_items_quote_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "quote_items_quote_id_idx" ON "public"."quote_items" USING "btree" ("quote_id");


--
-- Name: quotes_lead_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "quotes_lead_id_idx" ON "public"."quotes" USING "btree" ("lead_id");


--
-- Name: quotes_public_token_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "quotes_public_token_idx" ON "public"."quotes" USING "btree" ("public_token");


--
-- Name: quotes_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "quotes_tenant_id_idx" ON "public"."quotes" USING "btree" ("tenant_id");


--
-- Name: quotes_tenant_lead_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "quotes_tenant_lead_active_unique" ON "public"."quotes" USING "btree" ("tenant_id", "lead_id") WHERE (("lead_id" IS NOT NULL) AND ("lower"(COALESCE("status", 'draft'::"text")) = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'sent'::"text", 'viewed'::"text"])));


--
-- Name: reconciliation_alerts_alert_key_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "reconciliation_alerts_alert_key_uq" ON "public"."reconciliation_alerts" USING "btree" ("alert_key");


--
-- Name: reconciliation_alerts_invoice_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "reconciliation_alerts_invoice_idx" ON "public"."reconciliation_alerts" USING "btree" ("invoice_id", "last_detected_at" DESC);


--
-- Name: reconciliation_alerts_provider_payment_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "reconciliation_alerts_provider_payment_idx" ON "public"."reconciliation_alerts" USING "btree" ("provider_payment_id", "last_detected_at" DESC);


--
-- Name: reconciliation_alerts_tenant_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "reconciliation_alerts_tenant_idx" ON "public"."reconciliation_alerts" USING "btree" ("tenant_id", "last_detected_at" DESC);


--
-- Name: stripe_webhook_events_invoice_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "stripe_webhook_events_invoice_id_idx" ON "public"."stripe_webhook_events" USING "btree" ("invoice_id");


--
-- Name: stripe_webhook_events_payment_intent_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "stripe_webhook_events_payment_intent_id_idx" ON "public"."stripe_webhook_events" USING "btree" ("payment_intent_id");


--
-- Name: stripe_webhook_events_provider_payment_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "stripe_webhook_events_provider_payment_id_idx" ON "public"."stripe_webhook_events" USING "btree" ("provider_payment_id");


--
-- Name: technicians_active_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "technicians_active_name_idx" ON "public"."technicians" USING "btree" ("is_active", "full_name");


--
-- Name: transaction_applications_invoice_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "transaction_applications_invoice_idx" ON "public"."transaction_applications" USING "btree" ("tenant_id", "invoice_id", "applied_at" DESC);


--
-- Name: transactions_invoice_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "transactions_invoice_id_idx" ON "public"."transactions" USING "btree" ("invoice_id");


--
-- Name: transactions_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "transactions_source_idx" ON "public"."transactions" USING "btree" ("source");


--
-- Name: transactions_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "transactions_tenant_id_idx" ON "public"."transactions" USING "btree" ("tenant_id");


--
-- Name: ux_events_payment_attempt_closed_attempt_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_events_payment_attempt_closed_attempt_id" ON "public"."events" USING "btree" ((("payload" ->> 'attempt_id'::"text"))) WHERE (("event_type" = 'PaymentAttemptClosed'::"text") AND (("payload" ->> 'attempt_id'::"text") IS NOT NULL));


--
-- Name: ux_payment_attempts_invoice_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_payment_attempts_invoice_reference" ON "public"."payment_attempts" USING "btree" ("tenant_id", "invoice_id", "manual_reference_norm");


--
-- Name: ux_payment_attempts_tenant_idempotency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_payment_attempts_tenant_idempotency" ON "public"."payment_attempts" USING "btree" ("tenant_id", "idempotency_key");


--
-- Name: ux_public_payment_attempts_checkout_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_public_payment_attempts_checkout_session_id" ON "public"."public_payment_attempts" USING "btree" ("checkout_session_id") WHERE ("checkout_session_id" IS NOT NULL);


--
-- Name: ux_public_payment_attempts_invoice_idempotency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_public_payment_attempts_invoice_idempotency" ON "public"."public_payment_attempts" USING "btree" ("invoice_id", "idempotency_key");


--
-- Name: ux_public_payment_attempts_provider_payment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_public_payment_attempts_provider_payment_id" ON "public"."public_payment_attempts" USING "btree" ("provider_payment_id") WHERE ("provider_payment_id" IS NOT NULL);


--
-- Name: ux_transaction_applications_tx_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_transaction_applications_tx_invoice" ON "public"."transaction_applications" USING "btree" ("transaction_id", "invoice_id");


--
-- Name: ux_transactions_tenant_idempotency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_transactions_tenant_idempotency" ON "public"."transactions" USING "btree" ("tenant_id", "idempotency_key");


--
-- Name: ux_transactions_tenant_provider_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_transactions_tenant_provider_reference" ON "public"."transactions" USING "btree" ("tenant_id", "provider_reference") WHERE ("provider_reference" IS NOT NULL);


--
-- Name: ux_transactions_webhook_provider_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ux_transactions_webhook_provider_reference" ON "public"."transactions" USING "btree" ("provider_reference") WHERE (("source" = 'webhook'::"text") AND ("provider_reference" IS NOT NULL));


--
-- Name: appointments trg_appointments_sync_job_schedule; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_appointments_sync_job_schedule" AFTER INSERT OR UPDATE OF "job_id", "status", "scheduled_start", "scheduled_end", "technician_id", "service_address" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_job_schedule_from_appointment"();


--
-- Name: invoices trg_block_invoice_provider_payment_id_reassign; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_block_invoice_provider_payment_id_reassign" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."trg_block_invoice_provider_payment_id_reassign"();


--
-- Name: invoice_items trg_invoice_items_sync_line_items; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_invoice_items_sync_line_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."invoice_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_invoice_items_sync_line_items"();


--
-- Name: invoices trg_invoices_guardrails; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_invoices_guardrails" BEFORE INSERT OR UPDATE OF "tenant_id", "job_id", "status", "invoice_type", "total_amount", "release_approved", "release_approved_at" ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_invoice_guardrails"();


--
-- Name: jobs trg_jobs_sync_invoice_payment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_jobs_sync_invoice_payment" AFTER INSERT OR UPDATE OF "payment_status" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_invoice_payment_from_job"();


--
-- Name: invoices trg_money_loop_invoice_followups; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_money_loop_invoice_followups" AFTER INSERT OR UPDATE OF "status" ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."trg_money_loop_invoice_followups"();


--
-- Name: jobs trg_money_loop_job_followups; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_money_loop_job_followups" AFTER INSERT OR UPDATE OF "status" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."trg_money_loop_job_followups"();


--
-- Name: quotes trg_money_loop_quote_followups; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_money_loop_quote_followups" AFTER INSERT OR UPDATE OF "status" ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_money_loop_quote_followups"();


--
-- Name: quote_items trg_quote_items_sync_line_items; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_quote_items_sync_line_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_quote_items_sync_line_items"();


--
-- Name: quotes trg_quotes_ensure_job_and_invoice; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_quotes_ensure_job_and_invoice" AFTER INSERT OR UPDATE OF "status" ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_job_and_optional_draft_invoice_for_accepted_quote"();


--
-- Name: quotes trg_quotes_normalize_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_quotes_normalize_status" BEFORE INSERT OR UPDATE OF "status" ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_quotes_normalize_status"();


--
-- Name: app_user_roles app_user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."app_user_roles"
    ADD CONSTRAINT "app_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: appointments appointments_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;


--
-- Name: appointments appointments_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;


--
-- Name: appointments appointments_price_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_price_book_id_fkey" FOREIGN KEY ("price_book_id") REFERENCES "public"."price_book"("id") ON DELETE SET NULL;


--
-- Name: appointments appointments_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("user_id") ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;


--
-- Name: invoices invoices_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;


--
-- Name: invoices invoices_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;


--
-- Name: invoices invoices_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;


--
-- Name: invoices invoices_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;


--
-- Name: jobs jobs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;


--
-- Name: jobs jobs_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;


--
-- Name: leads leads_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;


--
-- Name: leads leads_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;


--
-- Name: payment_attempts payment_attempts_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_attempts"
    ADD CONSTRAINT "payment_attempts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_resolved_transaction_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_attempts"
    ADD CONSTRAINT "payment_attempts_resolved_transaction_fk" FOREIGN KEY ("resolved_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;


--
-- Name: public_payment_attempts public_payment_attempts_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."public_payment_attempts"
    ADD CONSTRAINT "public_payment_attempts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;


--
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;


--
-- Name: quotes quotes_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;


--
-- Name: transaction_applications transaction_applications_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."transaction_applications"
    ADD CONSTRAINT "transaction_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;


--
-- Name: transaction_applications transaction_applications_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."transaction_applications"
    ADD CONSTRAINT "transaction_applications_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;


--
-- Name: transactions transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;


--
-- Name: app_user_roles Enable full access for service role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable full access for service role" ON "public"."app_user_roles" USING (true);


--
-- Name: global_config Enable full access for service role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable full access for service role" ON "public"."global_config" USING (true);


--
-- Name: app_user_roles Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON "public"."app_user_roles" FOR SELECT USING (true);


--
-- Name: global_config Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON "public"."global_config" FOR SELECT USING (true);


--
-- Name: invoice_items Invoice items deletable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoice items deletable by tenant" ON "public"."invoice_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND ("i"."tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text")))))));


--
-- Name: invoice_items Invoice items insertable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoice items insertable by tenant" ON "public"."invoice_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND ("i"."tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text")))))));


--
-- Name: invoice_items Invoice items readable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoice items readable by tenant" ON "public"."invoice_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND ("i"."tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text")))))));


--
-- Name: invoice_items Invoice items service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoice items service role full access" ON "public"."invoice_items" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: invoice_items Invoice items updatable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoice items updatable by tenant" ON "public"."invoice_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND ("i"."tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND ("i"."tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text")))))));


--
-- Name: invoices Invoices are deletable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoices are deletable by tenant" ON "public"."invoices" FOR DELETE TO "authenticated" USING (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))));


--
-- Name: invoices Invoices are insertable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoices are insertable by tenant" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))));


--
-- Name: invoices Invoices are readable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoices are readable by tenant" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))));


--
-- Name: invoices Invoices are updatable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoices are updatable by tenant" ON "public"."invoices" FOR UPDATE TO "authenticated" USING (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text")))) WITH CHECK (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))));


--
-- Name: invoices Invoices service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invoices service role full access" ON "public"."invoices" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: jobs Jobs are deletable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Jobs are deletable by tenant" ON "public"."jobs" FOR DELETE TO "authenticated" USING (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))));


--
-- Name: jobs Jobs are insertable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Jobs are insertable by tenant" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))));


--
-- Name: jobs Jobs are readable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Jobs are readable by tenant" ON "public"."jobs" FOR SELECT TO "authenticated" USING (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))));


--
-- Name: jobs Jobs are updatable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Jobs are updatable by tenant" ON "public"."jobs" FOR UPDATE TO "authenticated" USING (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text")))) WITH CHECK (("tenant_id" = COALESCE((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))));


--
-- Name: jobs Jobs service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Jobs service role full access" ON "public"."jobs" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: leads Leads are deletable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Leads are deletable by tenant" ON "public"."leads" FOR DELETE TO "authenticated" USING (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")));


--
-- Name: leads Leads are insertable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Leads are insertable by tenant" ON "public"."leads" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")));


--
-- Name: leads Leads are readable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Leads are readable by tenant" ON "public"."leads" FOR SELECT USING (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")));


--
-- Name: leads Leads are updatable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Leads are updatable by tenant" ON "public"."leads" FOR UPDATE TO "authenticated" USING (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")));


--
-- Name: leads Leads service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Leads service role full access" ON "public"."leads" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: quote_items Quote items deletable by parent quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quote items deletable by parent quote" ON "public"."quote_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quote_items"."quote_id") AND (("q"."tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("q"."user_id" = "auth"."uid"()))))));


--
-- Name: quote_items Quote items readable by parent quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quote items readable by parent quote" ON "public"."quote_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quote_items"."quote_id") AND (("q"."tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("q"."user_id" = "auth"."uid"()))))));


--
-- Name: quote_items Quote items updatable by parent quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quote items updatable by parent quote" ON "public"."quote_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quote_items"."quote_id") AND (("q"."tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("q"."user_id" = "auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quote_items"."quote_id") AND (("q"."tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("q"."user_id" = "auth"."uid"()))))));


--
-- Name: quote_items Quote items writable by parent quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quote items writable by parent quote" ON "public"."quote_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quote_items"."quote_id") AND (("q"."tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("q"."user_id" = "auth"."uid"()))))));


--
-- Name: quotes Quotes deletable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quotes deletable by tenant" ON "public"."quotes" FOR DELETE USING ((("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("user_id" = "auth"."uid"())));


--
-- Name: quotes Quotes readable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quotes readable by tenant" ON "public"."quotes" FOR SELECT USING ((("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("user_id" = "auth"."uid"())));


--
-- Name: quotes Quotes updatable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quotes updatable by tenant" ON "public"."quotes" FOR UPDATE USING ((("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("user_id" = "auth"."uid"()))) WITH CHECK ((("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("user_id" = "auth"."uid"())));


--
-- Name: quotes Quotes writable by authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quotes writable by authenticated users" ON "public"."quotes" FOR INSERT WITH CHECK ((("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")) OR ("user_id" = "auth"."uid"())));


--
-- Name: quote_items Service role full access to quote items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access to quote items" ON "public"."quote_items" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: quotes Service role full access to quotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access to quotes" ON "public"."quotes" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: app_user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."app_user_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: global_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."global_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;

--
-- Name: public_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."public_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."quote_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;

--
-- Name: superusers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."superusers" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "check_is_superuser"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."check_is_superuser"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_superuser"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_superuser"() TO "service_role";


--
-- Name: FUNCTION "default_job_payment_terms"("p_customer_type" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."default_job_payment_terms"("p_customer_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."default_job_payment_terms"("p_customer_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."default_job_payment_terms"("p_customer_type" "text") TO "service_role";


--
-- Name: FUNCTION "enforce_invoice_guardrails"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."enforce_invoice_guardrails"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_invoice_guardrails"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_invoice_guardrails"() TO "service_role";


--
-- Name: FUNCTION "enqueue_quickbooks_sync"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."enqueue_quickbooks_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_quickbooks_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_quickbooks_sync"() TO "service_role";


--
-- Name: FUNCTION "ensure_follow_up_task"("p_tenant_id" "text", "p_source_type" "text", "p_source_id" "uuid", "p_lead_id" "uuid", "p_title" "text", "p_due_at" timestamp with time zone, "p_priority" "text", "p_notes" "text", "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."ensure_follow_up_task"("p_tenant_id" "text", "p_source_type" "text", "p_source_id" "uuid", "p_lead_id" "uuid", "p_title" "text", "p_due_at" timestamp with time zone, "p_priority" "text", "p_notes" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_follow_up_task"("p_tenant_id" "text", "p_source_type" "text", "p_source_id" "uuid", "p_lead_id" "uuid", "p_title" "text", "p_due_at" timestamp with time zone, "p_priority" "text", "p_notes" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_follow_up_task"("p_tenant_id" "text", "p_source_type" "text", "p_source_id" "uuid", "p_lead_id" "uuid", "p_title" "text", "p_due_at" timestamp with time zone, "p_priority" "text", "p_notes" "text", "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "ensure_job_and_optional_draft_invoice_for_accepted_quote"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."ensure_job_and_optional_draft_invoice_for_accepted_quote"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_job_and_optional_draft_invoice_for_accepted_quote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_job_and_optional_draft_invoice_for_accepted_quote"() TO "service_role";


--
-- Name: FUNCTION "ensure_reconciliation_alert"("p_alert_key" "text", "p_tenant_id" "text", "p_invoice_id" "uuid", "p_anomaly_type" "text", "p_severity" "text", "p_payload" "jsonb", "p_provider_payment_id" "text", "p_gateway_event_id" "text", "p_provider" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."ensure_reconciliation_alert"("p_alert_key" "text", "p_tenant_id" "text", "p_invoice_id" "uuid", "p_anomaly_type" "text", "p_severity" "text", "p_payload" "jsonb", "p_provider_payment_id" "text", "p_gateway_event_id" "text", "p_provider" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_reconciliation_alert"("p_alert_key" "text", "p_tenant_id" "text", "p_invoice_id" "uuid", "p_anomaly_type" "text", "p_severity" "text", "p_payload" "jsonb", "p_provider_payment_id" "text", "p_gateway_event_id" "text", "p_provider" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_reconciliation_alert"("p_alert_key" "text", "p_tenant_id" "text", "p_invoice_id" "uuid", "p_anomaly_type" "text", "p_severity" "text", "p_payload" "jsonb", "p_provider_payment_id" "text", "p_gateway_event_id" "text", "p_provider" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_reconciliation_alert"("p_alert_key" "text", "p_tenant_id" "text", "p_invoice_id" "uuid", "p_anomaly_type" "text", "p_severity" "text", "p_payload" "jsonb", "p_provider_payment_id" "text", "p_gateway_event_id" "text", "p_provider" "text") TO "service_role";


--
-- Name: FUNCTION "handle_booking_verification"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_booking_verification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_booking_verification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_booking_verification"() TO "service_role";


--
-- Name: FUNCTION "handle_quote_acceptance"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_quote_acceptance"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_quote_acceptance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_quote_acceptance"() TO "service_role";


--
-- Name: FUNCTION "handle_quote_approval_v2"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_quote_approval_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_quote_approval_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_quote_approval_v2"() TO "service_role";


--
-- Name: FUNCTION "next_work_order_number"("p_tenant_id" "text", "p_created_at" timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."next_work_order_number"("p_tenant_id" "text", "p_created_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."next_work_order_number"("p_tenant_id" "text", "p_created_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_work_order_number"("p_tenant_id" "text", "p_created_at" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "normalize_business_due_at"("p_tenant_id" "text", "p_base_at" timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."normalize_business_due_at"("p_tenant_id" "text", "p_base_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_business_due_at"("p_tenant_id" "text", "p_base_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_business_due_at"("p_tenant_id" "text", "p_base_at" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "normalize_job_customer_type"("p_value" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."normalize_job_customer_type"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_job_customer_type"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_job_customer_type"("p_value" "text") TO "service_role";


--
-- Name: FUNCTION "normalize_manual_reference"("p_value" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."normalize_manual_reference"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_manual_reference"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_manual_reference"("p_value" "text") TO "service_role";


--
-- Name: FUNCTION "normalize_quote_status"("p_status" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."normalize_quote_status"("p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_quote_status"("p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_quote_status"("p_status" "text") TO "service_role";


--
-- Name: FUNCTION "p0_02e_run_sweep"("p_min_age_minutes" integer, "p_limit" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."p0_02e_run_sweep"("p_min_age_minutes" integer, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."p0_02e_run_sweep"("p_min_age_minutes" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."p0_02e_run_sweep"("p_min_age_minutes" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."p0_02e_run_sweep"("p_min_age_minutes" integer, "p_limit" integer) TO "service_role";


--
-- Name: FUNCTION "payment_terms_due_days"("p_payment_terms" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."payment_terms_due_days"("p_payment_terms" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."payment_terms_due_days"("p_payment_terms" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."payment_terms_due_days"("p_payment_terms" "text") TO "service_role";


--
-- Name: FUNCTION "process_public_payment"("p_token" "uuid", "p_amount" numeric, "p_method" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."process_public_payment"("p_token" "uuid", "p_amount" numeric, "p_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_public_payment"("p_token" "uuid", "p_amount" numeric, "p_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_public_payment"("p_token" "uuid", "p_amount" numeric, "p_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_public_payment"("p_token" "uuid", "p_amount" numeric, "p_method" "text") TO "service_role";


--
-- Name: FUNCTION "rebuild_invoice_line_items"("p_invoice_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."rebuild_invoice_line_items"("p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_invoice_line_items"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_invoice_line_items"("p_invoice_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "rebuild_quote_line_items"("p_quote_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."rebuild_quote_line_items"("p_quote_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_quote_line_items"("p_quote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_quote_line_items"("p_quote_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "recalculate_invoice_settlement"("p_invoice_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."recalculate_invoice_settlement"("p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_invoice_settlement"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_invoice_settlement"("p_invoice_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "reconcile_apply_webhook_transaction_to_invoice"("p_transaction_id" "uuid", "p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."reconcile_apply_webhook_transaction_to_invoice"("p_transaction_id" "uuid", "p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_apply_webhook_transaction_to_invoice"("p_transaction_id" "uuid", "p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_apply_webhook_transaction_to_invoice"("p_transaction_id" "uuid", "p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_apply_webhook_transaction_to_invoice"("p_transaction_id" "uuid", "p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") TO "service_role";


--
-- Name: FUNCTION "reconcile_capture_legacy_invoice_opening_balance"("p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."reconcile_capture_legacy_invoice_opening_balance"("p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_capture_legacy_invoice_opening_balance"("p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_capture_legacy_invoice_opening_balance"("p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_capture_legacy_invoice_opening_balance"("p_invoice_id" "uuid", "p_actor_user_id" "uuid", "p_note" "text") TO "service_role";


--
-- Name: FUNCTION "record_offline_manual_payment"("p_tenant_id" "text", "p_invoice_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_manual_reference_raw" "text", "p_actor_user_id" "uuid", "p_request_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."record_offline_manual_payment"("p_tenant_id" "text", "p_invoice_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_manual_reference_raw" "text", "p_actor_user_id" "uuid", "p_request_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_offline_manual_payment"("p_tenant_id" "text", "p_invoice_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_manual_reference_raw" "text", "p_actor_user_id" "uuid", "p_request_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_offline_manual_payment"("p_tenant_id" "text", "p_invoice_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_manual_reference_raw" "text", "p_actor_user_id" "uuid", "p_request_id" "text") TO "service_role";


--
-- Name: FUNCTION "record_stripe_webhook_payment"("p_gateway_event_id" "text", "p_event_type" "text", "p_provider_payment_id" "text", "p_amount_cents" bigint, "p_currency" "text", "p_payload" "jsonb", "p_invoice_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."record_stripe_webhook_payment"("p_gateway_event_id" "text", "p_event_type" "text", "p_provider_payment_id" "text", "p_amount_cents" bigint, "p_currency" "text", "p_payload" "jsonb", "p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_stripe_webhook_payment"("p_gateway_event_id" "text", "p_event_type" "text", "p_provider_payment_id" "text", "p_amount_cents" bigint, "p_currency" "text", "p_payload" "jsonb", "p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_stripe_webhook_payment"("p_gateway_event_id" "text", "p_event_type" "text", "p_provider_payment_id" "text", "p_amount_cents" bigint, "p_currency" "text", "p_payload" "jsonb", "p_invoice_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "sync_invoice_payment_from_job"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."sync_invoice_payment_from_job"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_invoice_payment_from_job"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_invoice_payment_from_job"() TO "service_role";


--
-- Name: FUNCTION "sync_job_schedule_from_appointment"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."sync_job_schedule_from_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_job_schedule_from_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_job_schedule_from_appointment"() TO "service_role";


--
-- Name: FUNCTION "trg_block_invoice_provider_payment_id_reassign"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."trg_block_invoice_provider_payment_id_reassign"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_block_invoice_provider_payment_id_reassign"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_block_invoice_provider_payment_id_reassign"() TO "service_role";


--
-- Name: FUNCTION "trg_invoice_items_sync_line_items"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."trg_invoice_items_sync_line_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_invoice_items_sync_line_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_invoice_items_sync_line_items"() TO "service_role";


--
-- Name: FUNCTION "trg_money_loop_invoice_followups"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."trg_money_loop_invoice_followups"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_money_loop_invoice_followups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_money_loop_invoice_followups"() TO "service_role";


--
-- Name: FUNCTION "trg_money_loop_job_followups"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."trg_money_loop_job_followups"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_money_loop_job_followups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_money_loop_job_followups"() TO "service_role";


--
-- Name: FUNCTION "trg_money_loop_quote_followups"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."trg_money_loop_quote_followups"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_money_loop_quote_followups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_money_loop_quote_followups"() TO "service_role";


--
-- Name: FUNCTION "trg_quote_items_sync_line_items"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."trg_quote_items_sync_line_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_quote_items_sync_line_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_quote_items_sync_line_items"() TO "service_role";


--
-- Name: FUNCTION "trg_quotes_normalize_status"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."trg_quotes_normalize_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_quotes_normalize_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_quotes_normalize_status"() TO "service_role";


--
-- Name: FUNCTION "trigger_marketing_playbooks"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."trigger_marketing_playbooks"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_marketing_playbooks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_marketing_playbooks"() TO "service_role";


--
-- Name: TABLE "app_user_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."app_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."app_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."app_user_roles" TO "service_role";


--
-- Name: TABLE "appointments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";


--
-- Name: TABLE "automation_suspensions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."automation_suspensions" TO "anon";
GRANT ALL ON TABLE "public"."automation_suspensions" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_suspensions" TO "service_role";


--
-- Name: TABLE "business_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."business_settings" TO "anon";
GRANT ALL ON TABLE "public"."business_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."business_settings" TO "service_role";


--
-- Name: TABLE "contacts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";


--
-- Name: TABLE "crm_tasks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."crm_tasks" TO "anon";
GRANT ALL ON TABLE "public"."crm_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_tasks" TO "service_role";


--
-- Name: TABLE "events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";


--
-- Name: TABLE "global_config"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."global_config" TO "anon";
GRANT ALL ON TABLE "public"."global_config" TO "authenticated";
GRANT ALL ON TABLE "public"."global_config" TO "service_role";


--
-- Name: TABLE "invoice_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";


--
-- Name: TABLE "invoice_line_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."invoice_line_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_line_items" TO "service_role";


--
-- Name: TABLE "invoices"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";


--
-- Name: TABLE "jobs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";


--
-- Name: TABLE "leads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";


--
-- Name: TABLE "job_operational_state_v1"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."job_operational_state_v1" TO "anon";
GRANT ALL ON TABLE "public"."job_operational_state_v1" TO "authenticated";
GRANT ALL ON TABLE "public"."job_operational_state_v1" TO "service_role";


--
-- Name: TABLE "marketing_actions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."marketing_actions" TO "anon";
GRANT ALL ON TABLE "public"."marketing_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_actions" TO "service_role";


--
-- Name: TABLE "now_queue"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."now_queue" TO "anon";
GRANT ALL ON TABLE "public"."now_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."now_queue" TO "service_role";


--
-- Name: TABLE "payment_attempts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."payment_attempts" TO "anon";
GRANT ALL ON TABLE "public"."payment_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_attempts" TO "service_role";


--
-- Name: TABLE "price_book"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."price_book" TO "anon";
GRANT ALL ON TABLE "public"."price_book" TO "authenticated";
GRANT ALL ON TABLE "public"."price_book" TO "service_role";


--
-- Name: TABLE "properties"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";


--
-- Name: TABLE "provider_payment_observations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."provider_payment_observations" TO "anon";
GRANT ALL ON TABLE "public"."provider_payment_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_payment_observations" TO "service_role";


--
-- Name: TABLE "public_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."public_events" TO "anon";
GRANT ALL ON TABLE "public"."public_events" TO "authenticated";
GRANT ALL ON TABLE "public"."public_events" TO "service_role";


--
-- Name: TABLE "public_payment_attempts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."public_payment_attempts" TO "anon";
GRANT ALL ON TABLE "public"."public_payment_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."public_payment_attempts" TO "service_role";


--
-- Name: TABLE "quote_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."quote_items" TO "anon";
GRANT ALL ON TABLE "public"."quote_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_items" TO "service_role";


--
-- Name: TABLE "quote_line_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."quote_line_items" TO "anon";
GRANT ALL ON TABLE "public"."quote_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_line_items" TO "service_role";


--
-- Name: TABLE "quotes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";


--
-- Name: TABLE "reconciliation_alerts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reconciliation_alerts" TO "anon";
GRANT ALL ON TABLE "public"."reconciliation_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."reconciliation_alerts" TO "service_role";


--
-- Name: TABLE "stripe_webhook_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";


--
-- Name: TABLE "reconciliation_queue"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reconciliation_queue" TO "anon";
GRANT ALL ON TABLE "public"."reconciliation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."reconciliation_queue" TO "service_role";


--
-- Name: TABLE "superusers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."superusers" TO "anon";
GRANT ALL ON TABLE "public"."superusers" TO "authenticated";
GRANT ALL ON TABLE "public"."superusers" TO "service_role";


--
-- Name: TABLE "technicians"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."technicians" TO "anon";
GRANT ALL ON TABLE "public"."technicians" TO "authenticated";
GRANT ALL ON TABLE "public"."technicians" TO "service_role";


--
-- Name: TABLE "transaction_applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."transaction_applications" TO "anon";
GRANT ALL ON TABLE "public"."transaction_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_applications" TO "service_role";


--
-- Name: TABLE "transactions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";


--
-- Name: TABLE "work_order_sequences"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."work_order_sequences" TO "anon";
GRANT ALL ON TABLE "public"."work_order_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_sequences" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

-- \unrestrict icDmPbWmh5wa9ICyCuRp0Rn05HqIdc8wCqlGRSqKpcNLNspWxas1Eq4NQgK7Uuq

