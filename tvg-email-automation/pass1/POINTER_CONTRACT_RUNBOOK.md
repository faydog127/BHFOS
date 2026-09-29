# Pointer-contract live-window runbook — TVG Email Pass 1

This checklist is paperwork for a future window. It does not authorize any step. Every item marked ⛔ needs its own Command Center card. This session did not apply SQL, import n8n, change a Hostinger webhook, or merge.

Execution 3520 (Fast ACK, 2026-09-26 00:42:37 ET, HTTP 400 `pointer_incomplete`) is purged unopened. Do not cite it as retry evidence. The purge record is ID-only.

## Gate 0

- [ ] Draft branch is off PR #161 head `a4511343fd8bd7380f82d7b887598c9ff906ff1e`. PR #161 stays draft.
- [ ] Offline tests in this pack passed, including T32–T34 and M1–M8 on throwaway Postgres. Challenge post-implementation review (D10) is still required after CC accepts the evidence. This runbook does not perform that review.
- [ ] Workflow JSON diff reviewed. T17 passed.

## Gate 1 — staging database (⛔)

- [ ] Apply `apply/20260929_tvg_email_pass1_pointer_contract.sql` only on `glkrykpksbsqmmilmjhs`, with the staging latch set. Counts stay 19 / 10 / 13, and all 19 existing queue rows are `legacy_pointer`.
- [ ] `hostinger_mailbox_map` is `{}`. A Fast ACK dry check returns 422.
- [ ] No dry check may send a missing-Message-ID payload to a real (non-mock) endpoint. That payload creates a `pending` row and is not held until a Worker run.
- [ ] ⛔ Seed the map before Fast ACK is published and before the webhook is re-enabled: `{"info@vent-guys.com":"AC8c52a994840722513e7cf775afb3"}`. Read it back. The migration must not be the thing that writes this value.
- [ ] `intake_processing_enabled=true`. Excluded uids include `924150001`. `auto_send`, `internal_sms`, `after_hours_ack`, `review_notify`, `health_alerts`, `digest`, and `hcp_writes` stay false. `resolve_max_pages=3`, `resolve_lookback_hours=48`, `resolve_max_attempts=5`, `resolve_backoff_minutes=[1,2,5,10,20]`, `resolve_429_max_consumed=2`.

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

- [ ] Founder sends one email. CC re-enables the webhook.
- [ ] Checkpoint 1: exactly one new `intake_queue` row, `resolution_status='unresolved'`, `webhook_event_id` set. A duplicate `eventId` adds no row.
- [ ] If a missing-Message-ID row exists, it stays `pending` until the manual Worker run, then `held` / `message_id_missing`, one `automation_errors` row, and zero Hostinger calls.
- [ ] One manual Worker run: resolved uid matches the Hostinger UI, and the existing fetch path completes.
- [ ] If any checkpoint fails, CC disables the webhook first.
- [ ] Read-state checkpoint: the message shows `\Seen` after the Worker fetch. That is the expected result of `GET /source`, not a failure. `\Seen` does not mean a human opened it. No unread restore is authorized.

## Teardown

- [ ] Webhook disabled. Fast ACK unpublished. Base URL disabled, allowlist empty, `live_fetch=false`.
- [ ] Worker `saveManualExecutions` confirmed false. Manual executions purged.
- [ ] Record final counts for `intake_queue`, `email_events`, and `automation_errors`.

## Rollback

`apply/20260929_tvg_email_pass1_pointer_contract_ROLLBACK.sql` is one transaction. It locks `intake_queue` before it checks for NULL uids, and it locks `automation_settings` before it deletes the six migration-owned keys. It refuses while any `uid` is NULL. Export those rows and resolve or delete them under a separate CC action before running it. This session did not run it on staging.
