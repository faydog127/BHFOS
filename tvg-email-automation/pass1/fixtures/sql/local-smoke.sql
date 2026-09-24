-- Local disposable database only, after the apply pack. Included from
-- fixtures/local-postgres-smoke.sh. Not for staging and not for production.

INSERT INTO public.contacts (id, tenant_id, email, phone, name)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'tvg', 'contact@example.com', '555-0101', 'SYNTH Contact'),
  ('10000000-0000-4000-8000-000000000002', 'other', 'other@example.com', '555-0199', 'SYNTH Other');

INSERT INTO public.leads (id, tenant_id, email, status, contact_id)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'tvg', 'contact@example.com', 'new', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'tvg', 'contact@example.com', 'Customer', '10000000-0000-4000-8000-000000000001');

INSERT INTO email_automation.intake_queue (
  id, tenant_id, mailbox, mailbox_resource_id, folder, uid, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 1001, 'pending'
);

DO $$
BEGIN
  INSERT INTO email_automation.intake_queue (
    id, tenant_id, mailbox, mailbox_resource_id, folder, uid, status
  ) VALUES (
    '30000000-0000-4000-8000-000000000099',
    'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 1001, 'pending'
  );
  RAISE EXCEPTION 'F2 duplicate insert succeeded';
EXCEPTION
  WHEN unique_violation THEN NULL;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM email_automation.intake_queue WHERE uid = 1001) <> 1 THEN
    RAISE EXCEPTION 'F2 pointer uniqueness failed';
  END IF;
END $$;

SELECT id FROM email_automation.claim_intake_batch('local-worker-a', 1);

DO $$
BEGIN
  IF (SELECT status FROM email_automation.intake_queue WHERE id = '30000000-0000-4000-8000-000000000001')
     IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'F18 first claim did not move the row to processing';
  END IF;
  IF (SELECT count(*) FROM email_automation.claim_intake_batch('local-worker-b', 1)) <> 0 THEN
    RAISE EXCEPTION 'F18 second claim returned a row';
  END IF;
END $$;

INSERT INTO email_automation.intake_queue (
  id, tenant_id, mailbox, mailbox_resource_id, folder, uid, status
) VALUES (
  '30000000-0000-4000-8000-000000000002',
  'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 1002, 'deferred_kill_switch'
);

\ir ../../apply/resume_deferred_kill_switch.sql

DO $$
BEGIN
  IF (SELECT status FROM email_automation.intake_queue WHERE id = '30000000-0000-4000-8000-000000000002')
     IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'F11b resume actor A did not move deferred_kill_switch to pending';
  END IF;
END $$;

UPDATE email_automation.automation_settings
SET value_json = 'false'::jsonb
WHERE tenant_id = 'tvg' AND key = 'intake_processing_enabled';

INSERT INTO email_automation.intake_queue (
  id, tenant_id, mailbox, mailbox_resource_id, folder, uid, status
) VALUES (
  '30000000-0000-4000-8000-000000000003',
  'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 1003, 'deferred_kill_switch'
);

\ir ../../apply/resume_deferred_kill_switch.sql

DO $$
BEGIN
  IF (SELECT status FROM email_automation.intake_queue WHERE id = '30000000-0000-4000-8000-000000000003')
     IS DISTINCT FROM 'deferred_kill_switch' THEN
    RAISE EXCEPTION 'resume ran while kill switch was false';
  END IF;
END $$;

UPDATE email_automation.automation_settings
SET value_json = 'true'::jsonb
WHERE tenant_id = 'tvg' AND key = 'intake_processing_enabled';

INSERT INTO email_automation.intake_queue (
  id, tenant_id, mailbox, mailbox_resource_id, folder, uid, status, locked_at, locked_by
) VALUES (
  '30000000-0000-4000-8000-000000000004',
  'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 1004, 'processing', now() - interval '30 minutes', 'stale-worker'
);

\ir ../../apply/reconcile_stale_to_hold.sql

DO $$
BEGIN
  IF (SELECT status FROM email_automation.intake_queue WHERE id = '30000000-0000-4000-8000-000000000004')
     IS DISTINCT FROM 'held' THEN
    RAISE EXCEPTION 'F13 stale row was not held';
  END IF;
  IF (SELECT hold_reason FROM email_automation.intake_queue WHERE id = '30000000-0000-4000-8000-000000000004')
     IS DISTINCT FROM 'stale_processing' THEN
    RAISE EXCEPTION 'F13 hold_reason mismatch';
  END IF;
END $$;

SET ROLE n8n_email_automation;

DO $$
DECLARE
  tvg_contacts int;
  other_contacts int;
BEGIN
  SELECT count(*) INTO tvg_contacts FROM public.contacts WHERE tenant_id = 'tvg';
  SELECT count(*) INTO other_contacts FROM public.contacts WHERE tenant_id = 'other';
  IF tvg_contacts <> 1 THEN
    RAISE EXCEPTION 'F19 n8n role did not see the tvg contact (saw %)', tvg_contacts;
  END IF;
  IF other_contacts <> 0 THEN
    RAISE EXCEPTION 'F19 n8n role saw a non-tvg contact';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.contacts (tenant_id, email) VALUES ('tvg', 'nope@example.com');
    RAISE EXCEPTION 'F19 n8n role inserted a contact';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN OTHERS THEN
      IF SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%new row violates%' THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.network_os_assurance_delivery_claims WHERE delivery_id = 'local-smoke') <> 1 THEN
    RAISE EXCEPTION 'network_os_assurance_delivery_claims row was not preserved';
  END IF;
  IF to_regclass('email_automation.email_responses') IS NOT NULL
     OR to_regclass('email_automation.email_send_queue') IS NOT NULL THEN
    RAISE EXCEPTION 'Pass 2 tables exist';
  END IF;
  IF (SELECT value_json FROM email_automation.automation_settings WHERE tenant_id = 'tvg' AND key = 'auto_send_enabled')
     IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'auto_send_enabled is not false';
  END IF;
END $$;
