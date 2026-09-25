# Staging corrective smoke runbook — TVG Email Pass 1

**STAGING ONLY.** Project `glkrykpksbsqmmilmjhs`. Forbidden project `wwyxohjnyqnegzbxtuxs`.

This runbook is the coordinator's manual procedure. It is not evidence that the smokes have been run. Workflows stay **inactive**. The Hostinger webhook stays **unregistered**. Do not merge the pull request.

Local unit tests cover the same decisions without n8n or Supabase. They are not a substitute for these staging executions.

## Before any smoke

1. Confirm the SQL session is `glkrykpksbsqmmilmjhs`. Stop if the ref is `wwyxohjnyqnegzbxtuxs`.
2. If `apply/20260924_tvg_email_pass1_incremental.sql` is not already applied, apply it with `apply/STAGING_APPLY_CHECKLIST.md`. Do not re-apply `apply/20260924_tvg_email_pass1_v5.sql`.
3. Apply `apply/20260925_tvg_email_pass1_corrective_fetch.sql` with the staging latch in that checklist.
4. Read back:

```sql
SELECT key, value_json
FROM email_automation.automation_settings
WHERE tenant_id = 'tvg'
  AND key IN (
    'hostinger_mail_api_base_url',
    'hostinger_mail_api_allowed_hosts',
    'hostinger_live_fetch_enabled',
    'hostinger_fetch_timeout_ms',
    'hostinger_fetch_max_body_bytes',
    'hostinger_fetch_excluded_uids',
    'intake_processing_enabled',
    'hold_on_form_auth_failure',
    'auto_send_enabled',
    'internal_sms_enabled'
  )
ORDER BY key;
```

Expect `hostinger_mail_api_base_url` = `"disabled"`, `hostinger_live_fetch_enabled` = `false`, `hostinger_fetch_excluded_uids` includes `924150001`, `auto_send_enabled` = `false`, `internal_sms_enabled` = `false`, `hold_on_form_auth_failure` = `true`, `intake_processing_enabled` = `true`.

5. Import these JSON files into **staging** n8n and leave every workflow inactive:

- `n8n/tvg-email-intake-fast-ack.json`
- `n8n/tvg-email-intake-worker.json`
- `n8n/tvg-email-hostinger-mock.json`

Re-link the Fast ACK webhook credential to the existing credential named `TVG Staging Hostinger Webhook Header Auth`. Header Auth stays `Authorization: Bearer`. Do not change that design. The JSON id `REPLACE_WITH_STAGING_HEADER_AUTH_CRED_ID` is the placeholder from the live export.

6. Create an n8n credential named `TVG Staging Hostinger Mail API`, type Header Auth. Header name `Authorization`. For these mock smokes the value is a dummy `Bearer` that is **not** the real Hostinger token. The Founder replaces that value out of band only at the later live window. Do not put the value in git, chat, or screenshots. Attach it to `Fetch metadata`, `Fetch text`, and `Fetch source` if n8n did not bind the placeholder id.

7. Confirm all three workflows show Inactive. Confirm the mock and the Fast ACK are not registered on a Hostinger mailbox. Confirm the worker has no schedule. Confirm `Twilio send disabled` on the dispatcher, if that workflow is opened, is still disabled and disconnected.

## Stuck row uid 924150001

**Handling: excluded from claim and left untouched.** It stays `pending`. The worker does not fetch it from the mock or from `api.mail.hostinger.com`.

If a copy of that non-synthetic row is ever passed into the planner, the planner returns HOLD `excluded_stuck_uid` and builds no URL. The claim SQL also skips it, including when `hostinger_live_fetch_enabled` is later set true.

Record this before and after every worker smoke:

```sql
SELECT id, uid, status, hold_reason, locked_by,
       hostinger_pointers ? 'synthetic_message' AS synthetic
FROM email_automation.intake_queue
WHERE tenant_id = 'tvg' AND uid = 924150001;
```

Expect the same `pending` row, `synthetic` false, and no new `email_events` row for that uid.

## A. Fast ACK malformed payload

Workflow stays inactive. In the Fast ACK editor, use **Listen for test event** / the test URL. Do not activate the workflow. That would register a production webhook path inside n8n; do not point Hostinger at it.

1. POST with the valid Bearer and a JSON body that omits `uid` (example: `mailbox`, `mailboxResourceId`, and `folder` only).
2. Expect HTTP **400** and body `{"ok":false,"error":"pointer_incomplete"}`. A workflow error or n8n's default success body is a failure of this smoke.
3. Confirm no new `intake_queue` row:

```sql
SELECT count(*) FROM email_automation.intake_queue
WHERE tenant_id = 'tvg' AND created_at > now() - interval '10 minutes';
```

4. POST the same Bearer with `mailbox` `info@vent-guys.com`, `mailboxResourceId` `mbx_smoke_ack`, `folder` `INBOX`, `uid` `910111`. Expect HTTP **200** and one new row for that pointer. A second POST of the same pointer still returns 200 and does not add a second row.
5. POST the valid pointer with the Authorization header missing or wrong. Expect HTTP **403** from Header Auth, and no additional row.

Capture: the three HTTP status codes, the response bodies, and the `intake_queue` count query.

## B. Point the worker at the mock

Do this only after section A. Do not set the base URL to `https://api.mail.hostinger.com`.

1. Open `[STAGING] TVG Email — Hostinger Mock`. Leave it inactive. Click **Listen for test event**.
2. Copy the test URL through `.../webhook-test/tvg/staging-mock/mail` (no message path after `mail`).
3. Set only that host and that base URL:

```sql
UPDATE email_automation.automation_settings
SET value_json = to_jsonb('<PASTE_TEST_BASE_URL>'::text),
    updated_by = 'corrective-smoke'
WHERE tenant_id = 'tvg' AND key = 'hostinger_mail_api_base_url';

UPDATE email_automation.automation_settings
SET value_json = jsonb_build_array('<PASTE_N8N_HOSTNAME_ONLY>'),
    updated_by = 'corrective-smoke'
WHERE tenant_id = 'tvg' AND key = 'hostinger_mail_api_allowed_hosts';
```

`hostinger_live_fetch_enabled` stays `false`. The hostname is the host of the test URL, not `api.mail.hostinger.com`.

The mock must be listening before each worker run, because an inactive workflow does not serve the production webhook URL. Use the test URL only.

Mock UIDs:

| UID | Case | Expected queue outcome | `email_events` |
|---|---|---|---|
| 910001 | happy | `done`, status `awaiting_pass2` | one row |
| 910404 | 404 | `held`, `message_moved_uncertain` | none |
| 910500 | 500 | `error`, `hostinger_upstream_error` | none |
| 910408 | 12 second delay | `error`, `hostinger_timeout` | none |
| 910601 | source without Authentication-Results | `held`, `identity_uncertain` | one held row |
| 910602 | source and metadata without Message-ID and Date | `done`, `awaiting_pass2`, fallback hash, `message_id` null | one row |
| 910603 | text body over 262144 bytes | `held`, `hostinger_body_too_large` | none |

Insert **one** pending row, run the worker **once**, then record the result. The claim takes the oldest pending row and the batch size is 1. Do not insert these while another claimable pending row (other than the excluded uid 924150001) is waiting.

```sql
INSERT INTO email_automation.intake_queue (
  tenant_id, mailbox, mailbox_resource_id, folder, uid, status, hostinger_pointers
) VALUES (
  'tvg',
  'info@vent-guys.com',
  'mbx_mock',
  'INBOX',
  910001,
  'pending',
  jsonb_build_object(
    'mailbox_resource_id', 'mbx_mock',
    'folder', 'INBOX',
    'uid', '910001',
    'source', 'corrective_mock_smoke'
  )
);
```

Change `910001` for each case. `hostinger_pointers` must not contain `synthetic_message`.

Execute `[STAGING] TVG Email Intake — Worker` with **Test workflow** / manual execution. Do not activate it and do not add a schedule.

For uid 910408 the mock waits 12 seconds. The worker timeout is 8000 ms. Expect `hostinger_timeout`. If the execution errors instead of writing the queue row, stop and record that; do not point the base URL at the live API to "finish" the row.

After each run:

```sql
SELECT q.uid, q.status, q.hold_reason, q.last_error,
       q.hostinger_pointers->>'fetch_base_url' AS fetch_base_url,
       q.hostinger_pointers->>'fetch_mode' AS fetch_mode,
       e.id AS email_event_id, e.status AS event_status, e.hold_reason AS event_hold,
       e.message_id, e.fallback_hash
FROM email_automation.intake_queue q
LEFT JOIN email_automation.email_events e ON e.id = q.email_event_id
WHERE q.tenant_id = 'tvg' AND q.uid = 910001;
```

`fetch_base_url` must be the mock test base you set, on every row this worker writes. Capture the worker execution id and the node path. `Fetch metadata`, `Fetch text`, and `Fetch source` run only on the fetch path. Their method in the execution detail is GET.

Duplicate check, after the happy row exists: insert a second pointer with uid `9100012` only if you also need a second queue row. The idempotent case for the **same message** is the synthetic duplicate in section C, because a second mock uid still has the same Message-ID `<mock-910001@example.com>` only when the uid in the fixture is 910001. To prove no second event, run the worker again against a **new** pending row whose mock uid is still `910001` and whose queue pointer is different... The mock response Message-ID is derived from the uid, so uid 910001 always returns the same Message-ID. A second queue row with the same mailbox, folder, and uid will not insert (`intake_queue` pointer uniqueness). Use section C for the duplicate `email_events` proof.

## C. Synthetic regression

Run this only when no claimable real pending row remains (the excluded uid 924150001 may still be pending).

Happy:

```sql
INSERT INTO email_automation.intake_queue (
  tenant_id, mailbox, mailbox_resource_id, folder, uid, status, hostinger_pointers
) VALUES (
  'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 770001, 'pending',
  jsonb_build_object(
    'synthetic_message', jsonb_build_object(
      'from_raw', 'Customer <customer@example.com>',
      'to_raw', 'info@vent-guys.com',
      'subject', 'SYNTH corrective happy',
      'date_header', 'Thu, 24 Sep 2026 12:00:00 +0000',
      'bodyText', 'Hello from a synthetic fixture.',
      'message_id', '<synth-pass1-corrective-happy@vent-guys.test>',
      'authentication_results', 'spf=pass dkim=pass dmarc=pass'
    )
  )
);
```

Expect `awaiting_pass2` / queue `done`, and the execution path does **not** enter `Fetch metadata`. `fetch_mode` is `synthetic`. `fetch_base_url` is the current setting (the mock base, if section B was applied).

Duplicate: insert uid `770002` with the same `synthetic_message.message_id`. Expect queue `duplicate` and no second `email_events` row for that Message-ID.

Hold:

```sql
INSERT INTO email_automation.intake_queue (
  tenant_id, mailbox, mailbox_resource_id, folder, uid, status, hostinger_pointers
) VALUES (
  'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 770003, 'pending',
  jsonb_build_object(
    'synthetic_message', jsonb_build_object(
      'from_raw', 'Customer <customer@example.com>',
      'reply_to_raw', 'person@other.co.uk',
      'to_raw', 'info@vent-guys.com',
      'subject', 'SYNTH corrective hold',
      'date_header', 'Thu, 24 Sep 2026 12:00:00 +0000',
      'bodyText', 'Hello from a synthetic fixture.',
      'message_id', '<synth-pass1-corrective-hold@vent-guys.test>',
      'authentication_results', 'spf=pass dkim=pass dmarc=pass'
    )
  )
);
```

Expect queue `held` and `hold_reason` `reply_to_domain_mismatch`.

## D. Close-out evidence

Capture all of the following. Label it **staging**, not production, and not "real retrieval verified".

- Fast ACK statuses 400, 200, 403 and the row counts
- Worker execution ids for each mock uid and each synthetic case
- The `fetch_base_url` value stored on each processed row
- The stuck uid query showing `pending` before and after
- Screenshots or execution JSON showing the three HTTP nodes were not used on synthetic runs
- Workflow inactive flags
- A statement that the Hostinger mailbox webhook list was not changed
- `auto_send_enabled`, `internal_sms_enabled` still false
- No new `public.contacts` or `public.leads` rows from this smoke

When finished, set `hostinger_mail_api_base_url` back to `"disabled"` and `hostinger_mail_api_allowed_hosts` back to `[]` unless Command Center says to keep the mock URL for a named retest. Leave `hostinger_live_fetch_enabled` false.

Do not flip the base URL to `https://api.mail.hostinger.com` in this run. That flip is a later CC/Founder step. `GET .../messages/{uid}/text` marks the message `\Seen` on the live API. See the report.
