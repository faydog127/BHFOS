-- =============================================================================
-- TVG Email Pass 1 — resume actor A
-- STAGING ONLY / HOSTINGER OFF
-- Project: glkrykpksbsqmmilmjhs only. Never wwyxohjnyqnegzbxtuxs.
--
-- Named actor while the n8n Reconcile schedule is INACTIVE:
--   this ops SQL, run by the staging migration/owner role.
-- Actor B (not active in this build): the Reconcile workflow's resume node,
-- which stays unscheduled until Founder authorizes Pre-webhook.
--
-- Moves intake_queue deferred_kill_switch → pending only when
-- intake_processing_enabled is true.
-- Does not clear held, error, done, or duplicate.
-- Does not change Hostinger webhook configuration.
-- Does not send mail.
-- =============================================================================

UPDATE email_automation.intake_queue q
SET status = 'pending',
    locked_at = NULL,
    locked_by = NULL
WHERE q.tenant_id = 'tvg'
  AND q.status = 'deferred_kill_switch'
  AND EXISTS (
    SELECT 1
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg'
      AND s.key = 'intake_processing_enabled'
      AND s.value_json = 'true'::jsonb
  );
