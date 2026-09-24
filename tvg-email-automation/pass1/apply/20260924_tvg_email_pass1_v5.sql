-- =============================================================================
-- TVG Email Pass 1 (pass1-v5) — STAGING APPLY PACK
-- STAGING ONLY / HOSTINGER OFF
--
-- Target project ref ONLY: glkrykpksbsqmmilmjhs
--   (Supabase name at audit time: "BHFOS n8n Assurance Preview" / TVG CRM Staging)
-- Production SoR wwyxohjnyqnegzbxtuxs: DO NOT RUN. Read-only. Never set the GUC there.
--
-- This file is NOT a supabase/migrations history entry. Do not copy it into
-- command-center/supabase/migrations or any tree that migrates production.
--
-- Operator latch (required in the same session, before this file):
--   SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);
-- Postgres cannot see the Supabase project ref. The latch is an operator
-- attestation. The real control is which database URL / MCP project_id you use.
--
-- Run as one transaction:
--   psql "$STAGING_URL" -v ON_ERROR_STOP=1 -1 -f 20260924_tvg_email_pass1_v5.sql
--
-- Preserves public.network_os_assurance_delivery_claims (no ALTER/DROP).
-- Does not create email_responses or email_send_queue.
-- Does not re-baseline CRM and does not copy production secrets.
-- DDL sections 1–12 below are the pass1-v5 design body.
-- =============================================================================

DO $$
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true) IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION
      'Refusing TVG Email Pass 1 apply. Set tvg_email_pass1.target_project to glkrykpksbsqmmilmjhs in this session, and only on staging. Never wwyxohjnyqnegzbxtuxs.';
  END IF;
END $$;

DO $$
DECLARE
  sig text;
  forced boolean;
  n int;
  contacts_ok boolean;
  leads_ok boolean;
BEGIN
  SELECT count(*) INTO n
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname = 'network_os_assurance_delivery_claims'
    AND c.relkind = 'r';
  IF n <> 1 THEN
    RAISE EXCEPTION 'public.network_os_assurance_delivery_claims must already exist; this pack must not create or replace it';
  END IF;

  SELECT c.relforcerowsecurity,
         md5(string_agg(a.attname || ':' || t.typname, ',' ORDER BY a.attnum))
    INTO forced, sig
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE ns.nspname = 'public'
    AND c.relname = 'network_os_assurance_delivery_claims'
  GROUP BY c.relforcerowsecurity;

  IF forced IS NOT TRUE THEN
    RAISE EXCEPTION 'network_os_assurance_delivery_claims must keep FORCE ROW LEVEL SECURITY';
  END IF;
  PERFORM set_config('tvg_email_pass1.claims_sig', sig, false);

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts'
      AND column_name = 'id' AND udt_name = 'uuid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'tenant_id'
  ) INTO contacts_ok;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads'
      AND column_name = 'id' AND udt_name = 'uuid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'tenant_id'
  ) INTO leads_ok;

  IF NOT contacts_ok OR NOT leads_ok THEN
    RAISE EXCEPTION 'CRM baseline public.contacts/public.leads (id uuid, tenant_id) is required. Do not re-baseline.';
  END IF;
END $$;

-- ENABLE RLS must not be the statement that first locks out the CRM app.
-- If RLS is already on, adding n8n SELECT policies is safe.
-- If RLS is off, refuse unless authenticated or service_role policies already exist.
DO $$
DECLARE
  rel record;
  pol_count int;
BEGIN
  FOR rel IN
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('contacts', 'leads')
      AND c.relkind = 'r'
  LOOP
    IF NOT rel.relrowsecurity THEN
      SELECT count(*) INTO pol_count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = rel.relname
        AND (
          roles && ARRAY['authenticated']::name[]
          OR roles && ARRAY['service_role']::name[]
        );
      IF pol_count = 0 THEN
        RAISE EXCEPTION
          'Refusing to ENABLE RLS on public.%: RLS is off and no authenticated/service_role policy exists',
          rel.relname;
      END IF;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 1) Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2) Schemas
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS email_automation;
CREATE SCHEMA IF NOT EXISTS integrations;

COMMENT ON SCHEMA email_automation IS
  'PRIVATE TVG email intake automation state. Pass 1: no response/send tables. '
  'Bootstrap: create role before GRANTs; ENABLE RLS + policies before relying on grants. '
  'REVOKE from PUBLIC/anon/authenticated; grant only n8n_email_automation '
  '(+ service_role / migration roles as needed).';
COMMENT ON SCHEMA integrations IS
  'Shared cross-system references (Hostinger, HCP, etc.). Not email_automation-owned.';

-- -----------------------------------------------------------------------------
-- 3) Roles (before any GRANT TO n8n_email_automation)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE n8n_email_automation LOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON ROLE n8n_email_automation IS
  'Least-privilege n8n DB role for TVG email intake. Not service_role. '
  'Pass 1: SELECT contacts/leads only; no CRM writes.';

-- -----------------------------------------------------------------------------
-- 4) Enums (namespaced in email_automation)
-- NOTE: No send_queue_status / response_status in Pass 1.
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE email_automation.email_event_status AS ENUM (
    'received',
    'queued',
    'fetching',
    'fetched',
    'filtered',
    'system_lessen',
    'held',
    'awaiting_pass2',
    'duplicate_ignored',
    'deferred_kill_switch',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE email_automation.intake_queue_status AS ENUM (
    'pending',
    'processing',
    'done',
    'duplicate',
    'error',
    'held',
    'deferred_kill_switch'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE email_automation.intake_queue_status IS
  'Queue state machine (v5): pending/processing/deferred_kill_switch are non-terminal; '
  'done/duplicate are terminal success/dup; held/error are terminal until explicit ops. '
  'See 06-n8n-intake-worker-reconcile.md §4.1. Atomic claim: pending→processing via '
  'FOR UPDATE SKIP LOCKED.';

DO $$ BEGIN
  CREATE TYPE email_automation.notification_kind AS ENUM (
    'hold_alert',
    'error_alert',
    'daily_filtered_digest',
    'stale_intake_hold',
    'auth_reject_sample'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE email_automation.filter_list_kind AS ENUM (
    'sender_deny',
    'sender_allow',
    'domain_deny',
    'domain_allow',
    'vendor',
    'noreply_pattern',
    'list_pattern'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE email_automation.filter_action AS ENUM (
    'deny',
    'hold',
    'system_lessen',
    'allow'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 5) Tables
-- -----------------------------------------------------------------------------

-- 5.1 automation_settings
CREATE TABLE IF NOT EXISTS email_automation.automation_settings (
  tenant_id     text NOT NULL DEFAULT 'tvg',
  key           text NOT NULL,
  value_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  description   text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text,
  PRIMARY KEY (tenant_id, key),
  CONSTRAINT automation_settings_tenant_tvg CHECK (tenant_id = 'tvg')
);

COMMENT ON TABLE email_automation.automation_settings IS
  'Runtime knobs. Pass 1/Stage 1 MUST keep auto_send_enabled=false. '
  'intake_processing_enabled is the operational kill switch (does NOT change Hostinger webhooks). '
  'No secrets. Every row tenant_id=tvg.';

-- 5.2 intake_queue — durable webhook acceptance / worker cursor
-- KEYED ON WEBHOOK POINTER; identity nullable; FETCH-FREE fast path
CREATE TABLE IF NOT EXISTS email_automation.intake_queue (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text NOT NULL DEFAULT 'tvg',
  mailbox               text NOT NULL,
  mailbox_resource_id   text NOT NULL,
  folder                text NOT NULL,
  uid                   bigint NOT NULL,
  message_id            text,                 -- nullable on fast path; set by worker
  fallback_hash         text,                 -- nullable on fast path; set by worker
  event_type            text,
  status                email_automation.intake_queue_status NOT NULL DEFAULT 'pending',
  attempt_count         int NOT NULL DEFAULT 0,
  locked_at             timestamptz,
  locked_by             text,
  last_error            text,
  hold_reason           text,
  hostinger_pointers    jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_received_at   timestamptz NOT NULL DEFAULT now(),
  email_event_id        uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intake_queue_tenant_tvg CHECK (tenant_id = 'tvg')
);

COMMENT ON TABLE email_automation.intake_queue IS
  'Fast-path durable write BEFORE HTTP 2xx. Keyed on webhook pointer '
  '(mailbox_resource_id, folder, uid). Identity fields nullable until worker fetch. '
  'Fast path is FETCH-FREE. tenant_id must be tvg. '
  'Worker MUST claim with atomic FOR UPDATE SKIP LOCKED (see 06). '
  'Terminal statuses: done, duplicate; held/error terminal until ops; '
  'deferred_kill_switch resumes to pending.';
COMMENT ON COLUMN email_automation.intake_queue.uid IS
  'Hostinger message UID as bigint. Locator only — not durable identity.';
COMMENT ON COLUMN email_automation.intake_queue.message_id IS
  'Nullable on insert; worker sets from authoritative fetch.';
COMMENT ON COLUMN email_automation.intake_queue.fallback_hash IS
  'Nullable on insert; worker sets per 07-idempotency.md when Message-ID missing.';
COMMENT ON COLUMN email_automation.intake_queue.locked_at IS
  'Lease timestamp set on atomic claim. Reconcile treats processing older than '
  'stale_processing_ttl_minutes as HOLD (stale_processing). Optional heartbeat: '
  'worker may refresh locked_at while still processing.';
COMMENT ON COLUMN email_automation.intake_queue.locked_by IS
  'Worker instance id that holds the lease (n8n execution id / hostname).';

-- 5.3 email_events — SoT per unique inbound message (identity uniqueness here)
CREATE TABLE IF NOT EXISTS email_automation.email_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text NOT NULL DEFAULT 'tvg',
  mailbox               text NOT NULL,
  mailbox_resource_id   text,
  message_id            text,
  fallback_hash         text,
  folder                text,
  uid                   bigint,
  event_type            text,
  status                email_automation.email_event_status NOT NULL DEFAULT 'received',
  filter_reason         text,
  hold_reason           text,
  from_raw              text,
  from_email            text,
  reply_to_raw          text,
  reply_to_email        text,
  to_raw                text,
  cc_raw                text,
  subject               text,
  message_date_header   text,
  body_hash             text,
  resolved_recipient    text,
  recipient_resolution  text,
  auto_submitted        text,
  precedence_header     text,
  return_path           text,
  content_type          text,
  authentication_results text,
  spf_pass              boolean,
  dkim_pass             boolean,
  dmarc_pass            boolean,
  is_dsn                boolean DEFAULT false,
  is_autoresponder      boolean DEFAULT false,
  is_list_mail          boolean DEFAULT false,
  body_text_excerpt     text,
  body_html_excerpt     text,
  has_attachments       boolean DEFAULT false,
  attachment_meta       jsonb DEFAULT '[]'::jsonb,
  form_fields           jsonb DEFAULT '{}'::jsonb,
  contact_id            uuid,
  lead_id               uuid,
  webhook_received_at   timestamptz,
  fetched_at            timestamptz,
  hostinger_pointers    jsonb DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_events_tenant_tvg CHECK (tenant_id = 'tvg'),
  CONSTRAINT email_events_identity_present
    CHECK (message_id IS NOT NULL OR fallback_hash IS NOT NULL)
);

COMMENT ON TABLE email_automation.email_events IS
  'Inbound email SoT. Message-ID primary; fallback_hash secondary. '
  'folder+uid are locators only. Every row tenant_id=tvg. '
  'Terminal Pass 1 statuses include filtered, system_lessen, held, awaiting_pass2, '
  'duplicate_ignored, error. form_auth_failure uses status=held.';
COMMENT ON COLUMN email_automation.email_events.fallback_hash IS
  'v2 hash: mailbox + norm sender + norm recipient + norm subject + Date header + body_hash — see 07.';
COMMENT ON COLUMN email_automation.email_events.uid IS
  'Hostinger message UID as bigint. Locator only.';
COMMENT ON COLUMN email_automation.email_events.body_hash IS
  'SHA-256 hex of BodyNormalization v1 output — see 07-idempotency.md.';
COMMENT ON COLUMN email_automation.email_events.contact_id IS
  'Person (contacts). FK ON DELETE SET NULL.';
COMMENT ON COLUMN email_automation.email_events.lead_id IS
  'Opportunity (leads). FK ON DELETE SET NULL.';
COMMENT ON COLUMN email_automation.email_events.hold_reason IS
  'Includes form_auth_failure when allowlisted form From fails Authentication-Results '
  '(HOLD — never filtered).';

-- 5.4 email_filter_lists
CREATE TABLE IF NOT EXISTS email_automation.email_filter_lists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text NOT NULL DEFAULT 'tvg',
  kind          email_automation.filter_list_kind NOT NULL,
  pattern       text NOT NULL,
  match_mode    text NOT NULL DEFAULT 'exact',  -- exact | domain | contains | regex
  action        email_automation.filter_action NOT NULL DEFAULT 'deny',
  reason_code   text NOT NULL,
  enabled       boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_filter_lists_tenant_tvg CHECK (tenant_id = 'tvg'),
  CONSTRAINT email_filter_lists_kind_pattern_unique UNIQUE (tenant_id, kind, pattern, match_mode)
);

COMMENT ON TABLE email_automation.email_filter_lists IS
  'Configurable allow/deny/hold/system_lessen patterns. n8n MUST read this table — '
  'no hard-coded Lessen/noreply lists in workflow code. '
  'Form auth failures are NOT filter_list outcomes — they HOLD (form_auth_failure).';

-- 5.5 automation_errors
CREATE TABLE IF NOT EXISTS email_automation.automation_errors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text NOT NULL DEFAULT 'tvg',
  email_event_id    uuid,
  intake_queue_id   uuid,
  stage             text NOT NULL,
  error_code        text,
  error_message     text NOT NULL,
  context_json      jsonb DEFAULT '{}'::jsonb,
  retryable         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_errors_tenant_tvg CHECK (tenant_id = 'tvg')
);

COMMENT ON TABLE email_automation.automation_errors IS
  'Fail-closed error log. Never store tokens/secrets; truncate PII. tenant_id=tvg.';

-- 5.6 known_form_senders — EMPTY seed
CREATE TABLE IF NOT EXISTS email_automation.known_form_senders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text NOT NULL DEFAULT 'tvg',
  from_email            text NOT NULL,
  label                 text,
  enabled               boolean NOT NULL DEFAULT true,
  trust_reply_to        boolean NOT NULL DEFAULT true,
  require_auth_results  boolean NOT NULL DEFAULT true,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, from_email),
  CONSTRAINT known_form_senders_tenant_tvg CHECK (tenant_id = 'tvg')
);

COMMENT ON TABLE email_automation.known_form_senders IS
  'Allowlisted From addresses for website/system handoff. Seed EMPTY until real form samples. '
  'Trusted Reply-To ONLY when From is on this list, enabled, AND Authentication-Results SPF+DKIM+DMARC pass. '
  'If From matches allowlist (or form path) but auth fails → HOLD form_auth_failure (NOT filtered).';
COMMENT ON COLUMN email_automation.known_form_senders.trust_reply_to IS
  'If true and enabled and auth-results gate passes, Reply-To may be used as customer recipient.';
COMMENT ON COLUMN email_automation.known_form_senders.require_auth_results IS
  'Default true: require SPF+DKIM+DMARC pass before trusting this sender. Fail → HOLD.';

-- 5.7 notification_log
CREATE TABLE IF NOT EXISTS email_automation.notification_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text NOT NULL DEFAULT 'tvg',
  kind              email_automation.notification_kind NOT NULL,
  destination_ref   text NOT NULL,
  email_event_id    uuid,
  intake_queue_id   uuid,
  payload_summary   jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'queued',
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz,
  CONSTRAINT notification_log_tenant_tvg CHECK (tenant_id = 'tvg')
);

COMMENT ON TABLE email_automation.notification_log IS
  'Audit of HOLD/error/digest notifications. destination_ref must be Erron-approved internal only. Never customer addresses.';

-- 5.8 integrations.external_references (SHARED — entity_id is text)
CREATE TABLE IF NOT EXISTS integrations.external_references (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text NOT NULL DEFAULT 'tvg',
  system_name       text NOT NULL,
  external_id       text NOT NULL,
  entity_type       text NOT NULL,
  entity_id         text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, system_name, external_id, entity_type)
);

COMMENT ON TABLE integrations.external_references IS
  'Shared cross-system id map. entity_id is text (not uuid) to support heterogeneous ids. '
  'HCP writes remain disabled in Stage 1.';
COMMENT ON COLUMN integrations.external_references.entity_id IS
  'Internal entity id as text (uuid strings, numeric ids, etc.).';

-- -----------------------------------------------------------------------------
-- 6) Foreign keys (after all referenced tables exist)
-- -----------------------------------------------------------------------------
ALTER TABLE email_automation.email_events
  DROP CONSTRAINT IF EXISTS email_events_contact_id_fkey;
ALTER TABLE email_automation.email_events
  ADD CONSTRAINT email_events_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE email_automation.email_events
  DROP CONSTRAINT IF EXISTS email_events_lead_id_fkey;
ALTER TABLE email_automation.email_events
  ADD CONSTRAINT email_events_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE email_automation.intake_queue
  DROP CONSTRAINT IF EXISTS intake_queue_email_event_id_fkey;
ALTER TABLE email_automation.intake_queue
  ADD CONSTRAINT intake_queue_email_event_id_fkey
  FOREIGN KEY (email_event_id)
  REFERENCES email_automation.email_events(id)
  ON DELETE SET NULL;

ALTER TABLE email_automation.automation_errors
  DROP CONSTRAINT IF EXISTS automation_errors_email_event_id_fkey;
ALTER TABLE email_automation.automation_errors
  ADD CONSTRAINT automation_errors_email_event_id_fkey
  FOREIGN KEY (email_event_id) REFERENCES email_automation.email_events(id) ON DELETE SET NULL;

ALTER TABLE email_automation.automation_errors
  DROP CONSTRAINT IF EXISTS automation_errors_intake_queue_id_fkey;
ALTER TABLE email_automation.automation_errors
  ADD CONSTRAINT automation_errors_intake_queue_id_fkey
  FOREIGN KEY (intake_queue_id) REFERENCES email_automation.intake_queue(id) ON DELETE SET NULL;

ALTER TABLE email_automation.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_email_event_id_fkey;
ALTER TABLE email_automation.notification_log
  ADD CONSTRAINT notification_log_email_event_id_fkey
  FOREIGN KEY (email_event_id) REFERENCES email_automation.email_events(id) ON DELETE SET NULL;

ALTER TABLE email_automation.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_intake_queue_id_fkey;
ALTER TABLE email_automation.notification_log
  ADD CONSTRAINT notification_log_intake_queue_id_fkey
  FOREIGN KEY (intake_queue_id) REFERENCES email_automation.intake_queue(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 7) Indexes
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_intake_queue_webhook_pointer
  ON email_automation.intake_queue (tenant_id, mailbox_resource_id, folder, uid);

CREATE INDEX IF NOT EXISTS idx_intake_queue_pending
  ON email_automation.intake_queue (status, created_at)
  WHERE status IN ('pending', 'processing', 'error', 'deferred_kill_switch');

CREATE INDEX IF NOT EXISTS idx_intake_queue_message_id
  ON email_automation.intake_queue (tenant_id, mailbox, message_id)
  WHERE message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_events_mailbox_message_id
  ON email_automation.email_events (tenant_id, mailbox, message_id)
  WHERE message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_events_mailbox_fallback_hash
  ON email_automation.email_events (tenant_id, mailbox, fallback_hash)
  WHERE fallback_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_status
  ON email_automation.email_events (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_email_events_created
  ON email_automation.email_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_from
  ON email_automation.email_events (tenant_id, lower(from_email));
CREATE INDEX IF NOT EXISTS idx_email_events_folder_uid
  ON email_automation.email_events (tenant_id, mailbox, folder, uid);
CREATE INDEX IF NOT EXISTS idx_email_events_filtered_digest
  ON email_automation.email_events (tenant_id, status, created_at DESC)
  WHERE status IN ('filtered', 'system_lessen');

CREATE INDEX IF NOT EXISTS idx_email_filter_lists_enabled
  ON email_automation.email_filter_lists (tenant_id, enabled, kind);

CREATE INDEX IF NOT EXISTS idx_automation_errors_created
  ON email_automation.automation_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_created
  ON email_automation.notification_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_references_entity
  ON integrations.external_references (tenant_id, entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- 8) Functions + triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION email_automation.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Atomic claim helper (DESIGN reference — n8n may inline equivalent SQL)
-- Two workers cannot claim the same row.
CREATE OR REPLACE FUNCTION email_automation.claim_intake_batch(
  p_worker_id text,
  p_limit int DEFAULT 1
)
RETURNS SETOF email_automation.intake_queue
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH claim AS (
    SELECT q.id
    FROM email_automation.intake_queue q
    WHERE q.tenant_id = 'tvg'
      AND q.status = 'pending'
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  )
  UPDATE email_automation.intake_queue q
  SET status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      attempt_count = q.attempt_count + 1,
      updated_at = now()
  FROM claim
  WHERE q.id = claim.id
  RETURNING q.*;
END;
$$;

COMMENT ON FUNCTION email_automation.claim_intake_batch(text, int) IS
  'Atomic worker claim: pending → processing using FOR UPDATE SKIP LOCKED. '
  'n8n may call this function or inline the same UPDATE…RETURNING pattern. '
  'Never claim with SELECT-then-UPDATE without a lock.';

DO $$ BEGIN
  CREATE TRIGGER trg_intake_queue_updated
    BEFORE UPDATE ON email_automation.intake_queue
    FOR EACH ROW EXECUTE FUNCTION email_automation.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_email_events_updated
    BEFORE UPDATE ON email_automation.email_events
    FOR EACH ROW EXECUTE FUNCTION email_automation.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_email_filter_lists_updated
    BEFORE UPDATE ON email_automation.email_filter_lists
    FOR EACH ROW EXECUTE FUNCTION email_automation.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_automation_settings_updated
    BEFORE UPDATE ON email_automation.automation_settings
    FOR EACH ROW EXECUTE FUNCTION email_automation.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_known_form_senders_updated
    BEFORE UPDATE ON email_automation.known_form_senders
    FOR EACH ROW EXECUTE FUNCTION email_automation.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_external_references_updated
    BEFORE UPDATE ON integrations.external_references
    FOR EACH ROW EXECUTE FUNCTION email_automation.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 9) RLS ENABLE (tables must exist; policies follow)
-- Grants alone are insufficient — policies required.
-- -----------------------------------------------------------------------------
ALTER TABLE email_automation.automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation.intake_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation.automation_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation.known_form_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation.email_filter_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.external_references ENABLE ROW LEVEL SECURITY;

-- CRM tables: ensure RLS enabled (may already be on staging/prod). Policies below.
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 10) Policies
-- -----------------------------------------------------------------------------

-- email_automation / integrations (tenant tvg)
DROP POLICY IF EXISTS n8n_automation_settings_tvg ON email_automation.automation_settings;
CREATE POLICY n8n_automation_settings_tvg ON email_automation.automation_settings
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_intake_queue_tvg ON email_automation.intake_queue;
CREATE POLICY n8n_intake_queue_tvg ON email_automation.intake_queue
  FOR ALL TO n8n_email_automation
  USING (tenant_id = 'tvg') WITH CHECK (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_email_events_tvg ON email_automation.email_events;
CREATE POLICY n8n_email_events_tvg ON email_automation.email_events
  FOR ALL TO n8n_email_automation
  USING (tenant_id = 'tvg') WITH CHECK (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_automation_errors_tvg ON email_automation.automation_errors;
CREATE POLICY n8n_automation_errors_tvg ON email_automation.automation_errors
  FOR ALL TO n8n_email_automation
  USING (tenant_id = 'tvg') WITH CHECK (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_known_form_senders_tvg ON email_automation.known_form_senders;
CREATE POLICY n8n_known_form_senders_tvg ON email_automation.known_form_senders
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_email_filter_lists_tvg ON email_automation.email_filter_lists;
CREATE POLICY n8n_email_filter_lists_tvg ON email_automation.email_filter_lists
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_notification_log_tvg ON email_automation.notification_log;
CREATE POLICY n8n_notification_log_tvg ON email_automation.notification_log
  FOR ALL TO n8n_email_automation
  USING (tenant_id = 'tvg') WITH CHECK (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_external_references_tvg ON integrations.external_references;
CREATE POLICY n8n_external_references_tvg ON integrations.external_references
  FOR ALL TO n8n_email_automation
  USING (tenant_id = 'tvg') WITH CHECK (tenant_id = 'tvg');

-- -----------------------------------------------------------------------------
-- CRM contacts / leads — SELECT only for Pass 1 identity linking (CC item 1)
-- Least privilege: NO INSERT/UPDATE/DELETE policies for n8n_email_automation.
-- Pass 1 does not create or mutate CRM rows; any future write must be explicit + justified.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS n8n_contacts_tvg_select ON public.contacts;
CREATE POLICY n8n_contacts_tvg_select ON public.contacts
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_leads_tvg_select ON public.leads;
CREATE POLICY n8n_leads_tvg_select ON public.leads
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');

-- Anon / authenticated: no policies on email PII tables → deny by default under RLS.
-- (Do not create permissive policies for anon/authenticated on email_automation.)

-- service_role break-glass (migrations / ops)
DROP POLICY IF EXISTS service_role_automation_settings ON email_automation.automation_settings;
CREATE POLICY service_role_automation_settings ON email_automation.automation_settings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_intake_queue ON email_automation.intake_queue;
CREATE POLICY service_role_intake_queue ON email_automation.intake_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_email_events ON email_automation.email_events;
CREATE POLICY service_role_email_events ON email_automation.email_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_automation_errors ON email_automation.automation_errors;
CREATE POLICY service_role_automation_errors ON email_automation.automation_errors
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_known_form_senders ON email_automation.known_form_senders;
CREATE POLICY service_role_known_form_senders ON email_automation.known_form_senders
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_email_filter_lists ON email_automation.email_filter_lists;
CREATE POLICY service_role_email_filter_lists ON email_automation.email_filter_lists
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_notification_log ON email_automation.notification_log;
CREATE POLICY service_role_notification_log ON email_automation.notification_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_external_references ON integrations.external_references;
CREATE POLICY service_role_external_references ON integrations.external_references
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 11) REVOKE / GRANT (after role + tables + policies exist)
-- -----------------------------------------------------------------------------
REVOKE ALL ON SCHEMA email_automation FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA email_automation FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA email_automation FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA email_automation FROM PUBLIC;

REVOKE ALL ON SCHEMA email_automation FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA email_automation FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA email_automation FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA email_automation FROM anon, authenticated;

REVOKE ALL ON SCHEMA integrations FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA integrations FROM PUBLIC;
REVOKE ALL ON SCHEMA integrations FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA integrations FROM anon, authenticated;

GRANT USAGE ON SCHEMA email_automation TO n8n_email_automation;
GRANT USAGE ON SCHEMA email_automation TO service_role;
GRANT USAGE ON SCHEMA integrations TO n8n_email_automation;
GRANT USAGE ON SCHEMA integrations TO service_role;
GRANT USAGE ON SCHEMA public TO n8n_email_automation;

ALTER DEFAULT PRIVILEGES IN SCHEMA email_automation
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA integrations
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON email_automation.intake_queue TO n8n_email_automation;
GRANT SELECT, INSERT, UPDATE ON email_automation.email_events TO n8n_email_automation;
GRANT SELECT, INSERT ON email_automation.automation_errors TO n8n_email_automation;
GRANT SELECT ON email_automation.automation_settings TO n8n_email_automation;
GRANT SELECT ON email_automation.known_form_senders TO n8n_email_automation;
GRANT SELECT ON email_automation.email_filter_lists TO n8n_email_automation;
GRANT SELECT, INSERT, UPDATE ON email_automation.notification_log TO n8n_email_automation;
GRANT SELECT, INSERT, UPDATE ON integrations.external_references TO n8n_email_automation;
GRANT SELECT ON public.contacts, public.leads TO n8n_email_automation;
GRANT EXECUTE ON FUNCTION email_automation.claim_intake_batch(text, int) TO n8n_email_automation;

-- -----------------------------------------------------------------------------
-- 12) Seeds / settings (after tables + grants; idempotent)
-- -----------------------------------------------------------------------------

-- Intentionally NO known_form_senders seed rows.
-- Never treat mail as a form submission solely because From is our own mailbox.

INSERT INTO email_automation.automation_settings (tenant_id, key, value_json, description) VALUES
  ('tvg', 'auto_send_enabled', 'false'::jsonb,
   'Stage 2 master switch. Stage 1: ALWAYS false.'),
  ('tvg', 'intake_processing_enabled', 'true'::jsonb,
   'Operational kill switch: false stops worker/reconcile processing WITHOUT removing or changing Hostinger webhook configuration.'),
  ('tvg', 'kill_switch_ack_mode', '"park_2xx"'::jsonb,
   'When intake_processing_enabled=false: park durable row + HTTP 2xx (default) so Hostinger does not retry-storm; webhook config unchanged.'),
  ('tvg', 'kill_switch_resume_mode', '"deferred_to_pending"'::jsonb,
   'When switch returns true: set intake_queue deferred_kill_switch → pending. Does NOT auto-unHOLD stale HOLD rows.'),
  ('tvg', 'primary_mailbox', '"info@vent-guys.com"'::jsonb,
   'Primary intake mailbox'),
  ('tvg', 'hold_on_ambiguous_recipient', 'true'::jsonb,
   'Fail closed on recipient ambiguity'),
  ('tvg', 'hold_on_message_moved_uncertain', 'true'::jsonb,
   'Fail closed on uncertain Message-ID search'),
  ('tvg', 'hold_on_phone_conflict', 'true'::jsonb,
   'HOLD when phone matches a contact whose email differs from resolved customer email'),
  ('tvg', 'hold_on_reply_to_domain_mismatch', 'true'::jsonb,
   'Ordinary cross-domain Reply-To mismatch → HOLD (registrable domain via PSL)'),
  ('tvg', 'hold_on_form_auth_failure', 'true'::jsonb,
   'When From matches known_form_senders (or form path) but SPF/DKIM/DMARC fail → HOLD form_auth_failure. NEVER filtered.'),
  ('tvg', 'idempotency_fallback_enabled', 'true'::jsonb,
   'Fallback hash when Message-ID missing (includes body hash)'),
  ('tvg', 'reconcile_interval_minutes', '12'::jsonb,
   'n8n Schedule reconcile every 10–15 minutes (default 12). Schedule stays INACTIVE until Founder authorizes controlled testing. Not pg_cron.'),
  ('tvg', 'reconcile_inbox_lookback_hours', '24'::jsonb,
   'Reconcile lists recent INBOX messages within this lookback and enqueues gaps.'),
  ('tvg', 'stale_processing_ttl_minutes', '10'::jsonb,
   'Processing lock older than this → HOLD for review. NEVER silently retry into any future send path. Also defines claim lease TTL.'),
  ('tvg', 'worker_claim_batch_size', '1'::jsonb,
   'Rows claimed per atomic claim_intake_batch call (FOR UPDATE SKIP LOCKED).'),
  ('tvg', 'hcp_writes_enabled', 'false'::jsonb,
   'HCP zero writes in Stage 1'),
  ('tvg', 'lessen_routing', '"system_lessen"'::jsonb,
   'Lessen → system_lessen only; no customer reply path. Patterns live in email_filter_lists, not n8n.'),
  ('tvg', 'form_require_auth_results_pass', 'true'::jsonb,
   'Require Authentication-Results SPF+DKIM+DMARC pass before trusting any allowlisted form sender. Fail → HOLD (not filtered).'),
  ('tvg', 'open_lead_statuses', '["new","contacted","qualified","escalated"]'::jsonb,
   'PRODUCTION-REALISTIC open allowlist for auto-linking lead_id. Active pipeline only. '
   'NOT "whatever is in lead_status_enum". leads.status is free text in CRM. '
   'EXCLUDES terminal/converted: Customer (inventory-backed). Also treat closed/won/lost/'
   'abandoned/cancelled/archived/disqualified as non-open if present. Founder/CC-confirmable — '
   'census production distinct statuses before implement if possible.'),
  ('tvg', 'review_notify_enabled', 'false'::jsonb,
   'HOLD/error internal notify; enable only after Erron-approved destination is bound AND tested (Pre-webhook gate)'),
  ('tvg', 'review_notify_destination', 'null'::jsonb,
   'Erron-approved internal only (his email or approved Slack). NEVER a customer address. Must be set+tested before controlled testing.'),
  ('tvg', 'daily_filtered_digest_enabled', 'false'::jsonb,
   'Daily filtered digest via n8n Schedule; schedule INACTIVE until authorized'),
  ('tvg', 'daily_filtered_digest_destination', 'null'::jsonb,
   'Erron-approved internal only. NEVER a customer address. Must be set+tested before controlled testing.'),
  ('tvg', 'rejected_webhook_sample_per_hour', '5'::jsonb,
   'Max auth-reject samples logged/notified per hour (rate limit)')
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO email_automation.email_filter_lists
  (tenant_id, kind, pattern, match_mode, action, reason_code, notes) VALUES
  ('tvg', 'domain_deny', 'lessen.com', 'domain', 'system_lessen', 'vendor_lessen',
   'Lessen vendor traffic → system_lessen; no customer reply path'),
  ('tvg', 'vendor', 'lessen.com', 'domain', 'system_lessen', 'vendor_lessen',
   'Belt+suspenders vendor kind for Lessen'),
  ('tvg', 'noreply_pattern', 'noreply', 'contains', 'deny', 'noreply',
   'Generic no-reply local-part'),
  ('tvg', 'noreply_pattern', 'no-reply', 'contains', 'deny', 'noreply',
   'Generic no-reply local-part'),
  ('tvg', 'noreply_pattern', 'donotreply', 'contains', 'deny', 'noreply',
   'Generic do-not-reply'),
  ('tvg', 'sender_deny', 'mailer-daemon@', 'contains', 'deny', 'bounce_daemon',
   'Bounce / DSN style'),
  ('tvg', 'list_pattern', 'list-id', 'contains', 'deny', 'mailing_list',
   'Belt+suspenders with header checks')
ON CONFLICT (tenant_id, kind, pattern, match_mode) DO NOTHING;

-- =============================================================================
-- END design draft — DO NOT APPLY until Pre-build gate PASS + Founder OK
-- Confirm after any future migrate:
--   auto_send_enabled=false
--   intake_processing_enabled present (kill switch; does not touch Hostinger webhooks)
--   NO email_responses / email_send_queue tables
--   every email_automation row CHECK tenant_id='tvg'
--   known_form_senders empty until real samples
--   email_filter_lists present (no hard-coded n8n lists)
--   open_lead_statuses is production-realistic allowlist (excludes Customer/terminals)
--   hold_on_form_auth_failure=true
--   claim_intake_batch present (or equivalent worker SQL)
--   RLS policies on contacts/leads for n8n SELECT
--   external_references.entity_id is text; uid columns are bigint
--   real FKs ON DELETE SET NULL; real REVOKE/GRANT; complete RLS policies
--   bootstrap order followed (11-bootstrap-order.md)
--   no knowledge_* created
--   network_os_assurance_delivery_claims untouched
-- =============================================================================

-- Search path lock for the two functions. Bodies stay schema-qualified.
ALTER FUNCTION email_automation.set_updated_at() SET search_path = email_automation, pg_temp;
ALTER FUNCTION email_automation.claim_intake_batch(text, int) SET search_path = email_automation, pg_temp;

DO $$
DECLARE
  sig text;
  forced boolean;
  auto_send jsonb;
  form_hold jsonb;
  form_senders int;
BEGIN
  SELECT c.relforcerowsecurity,
         md5(string_agg(a.attname || ':' || t.typname, ',' ORDER BY a.attnum))
    INTO forced, sig
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE ns.nspname = 'public'
    AND c.relname = 'network_os_assurance_delivery_claims'
  GROUP BY c.relforcerowsecurity;

  IF forced IS NOT TRUE
     OR sig IS DISTINCT FROM current_setting('tvg_email_pass1.claims_sig', true) THEN
    RAISE EXCEPTION 'network_os_assurance_delivery_claims changed during Pass 1 apply';
  END IF;

  IF to_regclass('email_automation.email_responses') IS NOT NULL THEN
    RAISE EXCEPTION 'email_responses must not exist in Pass 1';
  END IF;
  IF to_regclass('email_automation.email_send_queue') IS NOT NULL THEN
    RAISE EXCEPTION 'email_send_queue must not exist in Pass 1';
  END IF;

  SELECT value_json INTO auto_send
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'auto_send_enabled';
  IF auto_send IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'auto_send_enabled must be false';
  END IF;

  SELECT value_json INTO form_hold
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'hold_on_form_auth_failure';
  IF form_hold IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'hold_on_form_auth_failure must be true';
  END IF;

  SELECT count(*) INTO form_senders FROM email_automation.known_form_senders;
  IF form_senders <> 0 THEN
    RAISE EXCEPTION 'known_form_senders must stay empty until a real form sample is captured';
  END IF;
END $$;
