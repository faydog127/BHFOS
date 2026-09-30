# Staging corrective report — TVG Email Pass 1

**Evidence tier for this defect fix: locally verified.** The 2026-09-25 staging smoke already ran and found two defects (Worker execution 3444, `url_build_failed`, mock received 0 requests; three mock webhook ids). This fix was not re-executed on staging. Real Hostinger retrieval is **not** verified. No Supabase write in this session. Nothing was merged. The mock workflow in git is still inactive.

## Defect fix after the corrective smoke

Staging execution 3444 held uid 910001 as `pointer_unresolved` / `last_error` `url_build_failed` because `buildMessageUrl` and the GET guard called `new URL()` inside the worker Code node. The mock's three webhook nodes also used three webhook ids, so metadata, `/text`, and `/source` were not suffixes of one base. n8n test listeners accept one call.

`pass1-hostinger-fetch.mjs` now parses and composes `https` URLs without `URL`, `URLSearchParams`, `TextEncoder`, or `Buffer`. The same three URLs and the same guard rejections are covered with those globals removed, including inside `node:vm`. A build failure records `url_build_failed:<ErrorClass>:<message>` on `last_error` and `automation_errors`, with the message stripped of URL and bearer text. Pointer fields are numeric uid, mailbox id, and folder patterns, encoded per segment. Traversal, a full URL in a field, an extra query, and a non-https base do not produce a fetch URL. A URL stuffed into the queue row is ignored.

The mock keeps three Hostinger path shapes because n8n matches one segment count per webhook node. All three nodes use webhook id `b1000000-0000-4000-8000-000000000001`. `Dispatch mock` selects metadata, text, or source from the path suffix. One `/webhook-test/` listen still cannot serve the worker's three sequential GETs. **Activating the mock is required** for that proof. This repo does not activate it. That needs a separate Command Center yes. The runbook has the base URL and the temporary allowlist host `bhfos.app.n8n.cloud`.

Local command: `node --test tvg-email-automation/pass1/test/*.test.mjs` — 59 pass, 0 fail. Not staging. Not merged.

Branch: `cursor/tvg-email-pass1-corrective-fetch-fff2`  
Implementation commit: `5b1b3c04fcd6a39fe37c65d1b77a90154659f954`  
Defect-fix commit: `b4f8351b5ffc3f705c53af9d2d695c8330192536`  
Baseline: `cursor/tvg-email-pass1-v5-3e46` at `a81b067c1c621a53d2a6a3522fe4da3b5e036478`  
Authorization: Command Center 2026-09-25 14:14 ET. Challenge verdict `CHALLENGE_CONCERNS` (proceed; the six concerns are acceptance criteria).

## Files changed

- `tvg-email-automation/pass1/lib/pass1-hostinger-fetch.mjs` — GET guard, planner, normalizer, closed HOLD SQL, mock renderer
- `tvg-email-automation/pass1/lib/pass1-intake-logic.mjs` — `planFastAck`, `identity_uncertain`, fetch base URL recorded on the queue update
- `tvg-email-automation/pass1/n8n/build-workflows.mjs` — Fast ACK Header Auth reconciliation and 4xx branch; worker fetch graph; mock workflow
- `tvg-email-automation/pass1/n8n/tvg-email-intake-fast-ack.json`
- `tvg-email-automation/pass1/n8n/tvg-email-intake-worker.json`
- `tvg-email-automation/pass1/n8n/tvg-email-hostinger-mock.json`
- `tvg-email-automation/pass1/n8n/tvg-email-intake-reconcile.json` — regenerated with the shared library embed
- `tvg-email-automation/pass1/n8n/tvg-email-daily-filtered-digest.json` — regenerated
- `tvg-email-automation/pass1/n8n/tvg-email-notification-dispatcher.json` — regenerated
- `tvg-email-automation/pass1/n8n/tvg-email-health-heartbeat.json` — regenerated
- `tvg-email-automation/pass1/apply/20260925_tvg_email_pass1_corrective_fetch.sql`
- `tvg-email-automation/pass1/test/pass1-corrective-fetch.test.mjs`
- `tvg-email-automation/pass1/test/pass1-intake-logic.test.mjs`
- `tvg-email-automation/pass1/test/workflows-and-apply-pack.test.mjs`
- `tvg-email-automation/pass1/STAGING_CORRECTIVE_SMOKE_RUNBOOK.md`
- `tvg-email-automation/pass1/design/05-hostinger-endpoints.md` — flag side-effect note
- `tvg-email-automation/pass1/n8n/README.md`
- `tvg-email-automation/pass1/apply/STAGING_APPLY_CHECKLIST.md`
- `tvg-email-automation/pass1/IMPLEMENTATION_STATUS.md`
- `tvg-email-automation/pass1/INDEX.md`
- `tvg-email-automation/pass1/directives/CHALLENGE_VERDICT_CORRECTIVE_2026-09-25.md`
- `tvg-email-automation/pass1/directives/CORRECTIVE_SLICE_PACKET_2026-09-25.md`

`command-center/build-out.txt` was not modified.

## Challenge criteria

1. **GET-only allowlist.** `assertHostingerGetRequest` accepts GET only when the path, relative to the configured base, is `/api/v1/mailboxes/{id}/folders/{folder}/messages/{uid}` or the same path plus `/text` or `/source`. POST, DELETE, other paths, other hosts, query strings, and non-HTTPS are refused. The worker HTTP nodes are method `GET`. A second code node, `Re-guard GET`, runs that check before any HTTP node. The credential `TVG Staging Hostinger Mail API` is an n8n Header Auth placeholder. No token is in git. Whether a Hostinger token can be scope-restricted is still unverified.
2. **Base URL default.** Missing or blank settings resolve to `disabled`. The SQL seed inserts `"disabled"` and `hostinger_live_fetch_enabled=false` with `ON CONFLICT DO NOTHING`. `api.mail.hostinger.com` is refused unless that host is on the allowlist **and** `hostinger_live_fetch_enabled` is true. Every outcome SQL that this worker writes stores `fetch_base_url` on `intake_queue.hostinger_pointers`.
3. **No guessing.** `mailbox_resource_id`, folder, uid, and mailbox come from the stored queue columns. If `hostinger_pointers` repeats those fields and they disagree, the route is HOLD `pointer_unresolved` and no URL is built. Webhook field names are still not a captured Hostinger payload. Metadata field names follow Hostinger Mail API SDK 1.1.0 (`messageId`, `from.address`, `to[].address`, `subject`, text `data.text` / `data.html`). Reply-To, Date, and Authentication-Results are read from the RFC822 source. A conflict between source and metadata for From, Message-ID, or subject is HOLD `identity_uncertain`. This is not a claim that a live mailbox was read.
4. **Uid 924150001.** Excluded from the claim SQL and left untouched (`pending`). The planner also refuses to build a URL for that non-synthetic uid, even if the live flag is on. It is not claimed against the mock.
5. **Flags.** SDK 1.1.0 says `GET .../text` marks the message `\Seen`. The metadata and source GET descriptions do not mention flags, moves, or read state; that silence is unknown, not a proof of no side effect. Move and flag APIs are separate and are not called. Do not open the live window until Command Center accepts the `\Seen` side effect.
6. **Identity, size, timeout.** Missing raw source or missing Authentication-Results becomes HOLD `identity_uncertain` (an `email_events` row when a stable identity can be formed; otherwise a queue-only HOLD and `automation_errors`). Missing Message-ID and Date, when source and Authentication-Results are present, uses the approved fallback hash and does not invent a Message-ID. Bodies over `hostinger_fetch_max_body_bytes` (default 262144) HOLD `hostinger_body_too_large` and are not stored. HTTP timeout default is 8000 ms and maps to queue `error` / `hostinger_timeout`. 404 is HOLD `message_moved_uncertain` with no search (search would be POST). 5xx is queue `error`.

## Header Auth and the malformed 4xx

The repo Fast ACK webhook now matches the live staging export: `authentication: headerAuth`, credential name `TVG Staging Hostinger Webhook Header Auth`, and no in-code `$env.HOSTINGER_WEBHOOK_SECRET` check.

The defect was real. After Header Auth, a missing pointer is the only `sql: null` case, and that case was wired to the Postgres `Auth sample` node (`SELECT 1 WHERE false`, `alwaysOutputData: true`). The false branch now goes **Prepare intake → Has durable SQL → Shape reject → Respond**. `Shape reject` returns the planned 400. No insert runs. `Auth sample disconnected` is disabled and has no incoming connection. `Insert pointer` still has `alwaysOutputData` so a duplicate pointer (zero returning rows) can still answer 200.

Missing or wrong Bearer remains the webhook Header Auth rejection (403) and does not enter this branch.

## What this session did not verify

- No call to `api.mail.hostinger.com`
- No staging n8n import or execution
- No apply of the corrective SQL
- The live webhook JSON field names for `mailboxResourceId` / folder / uid
- The exact n8n item shape for HTTP 404, 500, and timeout (`statusCode` / `error.message`)
- Whether `GET` metadata or `GET` source changes IMAP flags
- Whether the Hostinger token can be limited to GET
- That uid 924150001 is still the only stuck non-synthetic row

## Open questions

- **(a) Token scope.** The public Messages API documents Bearer auth. The SDK text reviewed here does not show a read-only scope. Unverified until the Founder inspects the token they create out of band.
- **(b) Base-URL flip.** Command Center / Founder owns the flip at the reopened window. This repo does not perform it. Both the allowlist entry `api.mail.hostinger.com` and `hostinger_live_fetch_enabled=true` are required, and the `\Seen` note above has to be accepted first.
- **Payload fields.** Webhook pointer names are still the Fast ACK assumptions (`mailboxResourceId` or `mailbox_resource_id`, `folder`, `uid`, `mailbox`). Message JSON names are the SDK 1.1.0 aliases above. A live body that uses different names fails closed instead of being guessed.
