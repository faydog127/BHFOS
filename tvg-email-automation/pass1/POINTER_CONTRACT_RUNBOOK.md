# Pointer-contract live-window runbook — TVG Email Pass 1

This checklist is paperwork for a future window. It does not authorize any step. Every item marked ⛔ needs its own Command Center card. This session did not apply SQL, import n8n, change a Hostinger webhook, or merge.

Execution 3520 (Fast ACK, 2026-09-26 00:42:37 ET, HTTP 400 `pointer_incomplete`) is purged unopened. Do not cite it as retry evidence. The purge record is ID-only.

## Gate 0

- [ ] Draft branch is off PR #161 head `a4511343fd8bd7380f82d7b887598c9ff906ff1e`. PR #161 stays draft.
- [ ] Offline tests in this pack passed, including T32–T34 and M1–M8 on throwaway Postgres. Challenge post-implementation review (D10) is still required after CC accepts the evidence. This runbook does not perform that review.
- [ ] Workflow JSON diff reviewed. T17 passed.

## Gate 1 — staging database (⛔)

- [ ] Apply `apply/20260929_tvg_email_pass1_pointer_contract.sql` only on `glkrykpksbsqmmilmjhs`, with the staging latch set, if it is not already recorded. A read-only catalog check on 2026-09-30 found staging migration `20260929231456` (`tvg_email_pass1_pointer_contract_20260929`) already recorded. Counts stay 19 / 10 / 13, and all 19 existing queue rows are `legacy_pointer`.
- [ ] Then apply `apply/20260929b_tvg_email_pass1_pointer_identity_compat.sql` in the same kind of latched session. It replaces `intake_queue_pointer_or_webhook_identity` only. Fast ACK still inserts `folder='INBOX'` and `uid` NULL. That row is legal when `webhook_event_id` is present, including a missing Message-ID. The validated check does not use `NOT VALID`. A lock timeout or a violating row fails the whole transaction. The mailbox-id check is still exactly `^[A-Za-z0-9_-]{1,128}$`, written as `~ ('^[A-Za-z0-9_-]{1,128}' || chr(36))` so the SQL text has no `$'`. n8n deletes `$'` when a Code node passes SQL through `={{ $json.sql }}`. Re-import Fast ACK, Worker, and Health Heartbeat before the next live smoke. This commit does not perform that import.
- [ ] `hostinger_mailbox_map` is `{}`. A Fast ACK dry check returns 422.
- [ ] No dry check may send a missing-Message-ID payload to a real (non-mock) endpoint. That payload creates a `pending` row and is not held until a Worker run.
- [ ] ⛔ Seed the map before Fast ACK is published and before the webhook is re-enabled: `{"info@vent-guys.com":"AC8c52a994840722513e7cf775afb3"}`. Read it back. The migration must not be the thing that writes this value.
- [ ] `intake_processing_enabled=true`. Excluded uids include `924150001`. `auto_send`, `internal_sms`, `after_hours_ack`, `review_notify`, `health_alerts`, `digest`, and `hcp_writes` stay false. `resolve_max_pages=3`, `resolve_lookback_hours=48`, `resolve_backoff_minutes=[1,2,5,10,20]`, `resolve_429_max_consumed=2`.
- [ ] `resolve_max_attempts` is exactly `5`. That is the only supported controlled-live value, because it matches the five-entry `1/2/5/10/20` schedule. Do not open the window if the setting is anything else. There is no general support for a value above 5. Run `apply/20260929_tvg_email_pass1_resolve_max_attempts_preflight.sql` in the same session as the staging latch. It fails closed unless the stored JSON is exactly `5`. The seeded default stays `5`.
- [ ] Quiescent-queue proof, captured on the card immediately before apply: no `intake_queue` row is `processing`; the Worker and Fast ACK workflows are inactive; the Hostinger webhook is disabled. Also record `SELECT count(*) FROM email_automation.intake_queue WHERE status = 'processing'` as 0, and both of these as 0: `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle' AND query ILIKE '%intake_queue%' AND pid <> pg_backend_pid();` and `SELECT count(*) FROM pg_locks l JOIN pg_class c ON c.oid = l.relation WHERE c.relname = 'intake_queue' AND l.pid <> pg_backend_pid();`. Check for no idle-in-transaction n8n connections.
- [ ] The migration sets `lock_timeout` to 5 seconds inside its transaction. A lock timeout aborts the whole transaction. That is fail closed. Do not assume a partial apply. Reconcile the live state, then retry only in another quiescent window.

## Gate 2 — retention

- [ ] Fast ACK: success none, error none, manual none. Read back after import.
- [ ] Worker automatic success and error saves are none.
- [ ] **Activation-gate item:** set the Worker's `saveManualExecutions` to **false** in the live workflow UI and in the repo JSON for the activation build. Read it back and screenshot it. The staging JSON in this slice ships `true` on purpose.
- [ ] Re-read `saveManualExecutions` after any later re-import of the Worker JSON. A re-import of the staging JSON can restore `true`.
- [ ] The Worker execution list is empty, or every listed manual run is under 24 hours old, with an ID-only purge record.
- [ ] Any manual or debug Worker run is purged within 24 hours. A saved manual run holds PII (list envelopes and fetched bodies).
- [ ] 3520 purge confirmed done (ID-only record). No inspection step.
- [ ] No global retention change.

## Gate 3 — workflows (⛔ import; both stay inactive)

- [ ] Import Worker, Fast ACK, and Mock. Read back `httpRequest` methods: literal `GET`.
- [ ] Credential name stays `TVG Staging Hostinger Mail API` (Header Auth, unchanged).
- [ ] ⛔ Settings window: base URL `https://api.mail.hostinger.com`, allowlist `["api.mail.hostinger.com"]`, `live_fetch=true`. Reset these at teardown.

## Gate 4 — webhook (separate CC gate)

- [ ] Webhook `01a0dbc8-ad6e-70b2-8abd-eebf8a081f2e` stays DISABLED until CC says otherwise.
- [ ] ⛔ Explicit go to re-enable, after gates 0–3, with the Founder ready to send one email.
- [ ] After Fast ACK is published, repeat the 403 checks (no auth, wrong auth).

## Window (one message)

The Reconcile workflow stays inactive. Its schedule node is `disabled: true` (`Schedule disabled` in `n8n/tvg-email-intake-reconcile.json`). The stale sweep does not run on a timer. A crashed `processing` row stays `processing` until an operator runs that workflow under a separate card, or reviews the row with the stranded query below. This runbook does not activate Reconcile and does not add an alert, SMS, or heartbeat signal.

- [ ] Founder sends one email. CC re-enables the webhook.
- [ ] At every checkpoint in this window, run the read-only query `apply/20260929_tvg_email_pass1_stranded_rows.sql` and paste the result on the card. It lists held rows, error rows, processing rows past `stale_processing_ttl_minutes`, and pending rows with `next_attempt_at` NULL older than 10 minutes, including rows whose `email_event_id` is NULL. Manual observation is the control for this one-message window. Do not add a Founder notification from this query.
- [ ] Checkpoint 1: exactly one new `intake_queue` row, `resolution_status='unresolved'`, `webhook_event_id` set. A duplicate `eventId` adds no row.
- [ ] If a missing-Message-ID row exists, it stays `pending` until the manual Worker run, then `held` / `message_id_missing`, one `automation_errors` row, and zero Hostinger calls.
- [ ] One manual Worker run: resolved uid matches the Hostinger UI, and the existing fetch path completes.
- [ ] If any checkpoint fails, CC disables the webhook first.
- [ ] Read-state checkpoint: the message shows `\Seen` after the Worker fetch. That is the expected result of `GET /source`, not a failure. `\Seen` does not mean a human opened it. No unread restore is authorized.

## Teardown

- [ ] Webhook disabled. Fast ACK unpublished. Base URL disabled, allowlist empty, `live_fetch=false`.
- [ ] Worker `saveManualExecutions` confirmed false. Manual executions purged.
- [ ] Record final counts for `intake_queue`, `email_events`, and `automation_errors`.

## Stale-processing recovery (separate card)

`apply/20260929_tvg_email_pass1_stale_processing_recovery.sql` is a reviewed one-row template. It is not applied by the migration, not imported into n8n, and not an automatic or bulk requeue. Execution requires its own controlled-live action card. Staging latch required. Replace the placeholder queue id, actor, and reason before that card runs it. The unmodified file refuses the placeholder.

Safeguards in the statement: `tenant_id = 'tvg'`, exact `id`, `status = 'held'`, `hold_reason = 'stale_processing'`, `resolution_status = 'unresolved'`, `uid IS NULL`. It clears `locked_at` and `locked_by`, sets `status` back to `pending`, and clears `hold_reason` only after that match. It does not change `uid`, `resolve_attempts`, or `attempt_count`. It writes one `automation_errors` audit row (`actor`, `reason`, `stale_processing_return_to_pending`) and a proof SELECT for the card. It does not send to a customer.

A row that does not match is left unchanged and the transaction rolls back.

## Rollback

The earlier rollback text is superseded. Do not run a rollback that drops `webhook_message_id` or executes `ALTER COLUMN uid SET NOT NULL`. That would destroy the 2026-09-27 identity column and the nullable folder/uid pair that staging already had.

`apply/20260929_tvg_email_pass1_pointer_contract_ROLLBACK.sql` is the one rollback for both the 2026-09-29 pointer-contract migration and `apply/20260929b_tvg_email_pass1_pointer_identity_compat.sql`. It returns the schema to the post-20260927 / pre-20260929 state. It is one transaction. Immediately after `BEGIN` it sets `lock_timeout` to 5 seconds. It locks `intake_queue` in `ACCESS EXCLUSIVE` mode before it checks for NULL uids, and it locks `automation_settings` before it deletes the six migration-owned keys. It refuses while any `uid` is NULL.

It preserves `webhook_message_id`, `uq_intake_queue_webhook_message`, and `uq_intake_queue_webhook_pointer`. It removes `uq_intake_queue_webhook_event` because that index is from 2026-09-29. Folder and uid stay nullable. It restores the 2026-09-27 definition of `intake_queue_pointer_or_webhook_identity` and the 2026-09-27 `webhook_message_id` comment. It removes only the seven columns added in 2026-09-29 (`webhook_event_id`, `webhook_envelope_id`, `webhook_event_at`, `resolution_status`, `resolved_at`, `resolve_attempts`, `next_attempt_at`), the four constraints those columns required, `idx_intake_queue_next_attempt`, `resolve_intake_uid`, and the six settings. `webhook_message_id` already existed in `20260927154647` and is not one of those seven.

A lock timeout fails closed. The transaction rolls back. Do not assume a partial rollback. Reconcile the live state and retry only in a quiescent window: no `processing` rows, Worker and Fast ACK inactive, webhook disabled.

Before any rollback, export and attach to the card:

- `intake_queue` for tenant `tvg` (id, status, hold_reason, resolution_status, uid, webhook_event_id, webhook_message_id, resolve_attempts, next_attempt_at, locked_at, locked_by, email_event_id). In particular keep every row with `uid IS NULL`.
- The six settings, including the seeded `hostinger_mailbox_map`: `hostinger_mailbox_map`, `resolve_max_pages`, `resolve_lookback_hours`, `resolve_max_attempts`, `resolve_backoff_minutes`, `resolve_429_max_consumed`.

```sql
SELECT id, status, hold_reason, resolution_status, uid, webhook_event_id,
       webhook_message_id, resolve_attempts, next_attempt_at, locked_at,
       locked_by, email_event_id
  FROM email_automation.intake_queue
 WHERE tenant_id = 'tvg';

SELECT key, value_json
  FROM email_automation.automation_settings
 WHERE tenant_id = 'tvg'
   AND key IN (
     'hostinger_mailbox_map',
     'resolve_max_pages',
     'resolve_lookback_hours',
     'resolve_max_attempts',
     'resolve_backoff_minutes',
     'resolve_429_max_consumed'
   );
```

Resolve or delete NULL-uid rows only under a separate CC action. Do not blanket-delete them to make the rollback succeed. This session did not run the rollback on staging.
