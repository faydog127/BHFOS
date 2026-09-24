# CC DIRECTIVE SUMMARY — Pass 1 Staging Consolidated (2026-09-24)

Provenance: this file is the summary that was attached to the staging-slice mission. The full Founder paste named `CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md` was not in the workspace when the pack was written. Do not treat this summary as a reconstruction of that paste.

Implementation pack: `tvg-email-automation/pass1/`. Decision register: `tvg-email-automation/pass1/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`.

**Decision:** PASS 1 STAGING BUILD — PROCEED  
**Design loop:** CLOSED except material implementation discoveries  
**Pre-webhook:** CLOSED | **Production:** CLOSED  
**Staging:** `glkrykpksbsqmmilmjhs` | **Prod read-only:** `wwyxohjnyqnegzbxtuxs`

## LOCKED now (implement in staging return packet)

1. Health heartbeat (`last_successful_health_at`; stale/fail/dep/lag alerts; quiet inbox ≠ fault; one outage + one recovery)
2. Durable notification outbox (intent → dispatcher → SMS; `notification_log` is outbox; uniq `(email_event_id, notification_kind)`)
3. `live_notification_started_at` watermark (pre: ingest OK, no per-msg SMS; ≤1 backlog summary)
4. Capture `In-Reply-To` + `References` only (no thread business logic)
5. Attachment metadata only; no bytes; cap excerpts; no permanent full MIME; retention deferred
6. Timing targets: webhook→dispatcher ≤2m; reconcile ≤15m; 24/7; no app quiet hours
7. SMS one-way (no inbound commands / customer SMS)
8. Wording: “review” not “needs response”; deterministic content only
9. n8n `[STAGING]`/`[PROD]` prefixes; staging-only creds; SMS alert creds separate
10. Git is implementation SoR

## Production-gate (do not block staging)

11. CRM lead creation DEFERRED (Pass 1 SELECT-only; no lead create)
12. CRM lead-gap since 2024-07-24 investigation REQUIRED before production reliance
13. Min production security hardening PRODUCTION GATE
14. Decision Register REQUIRED NOW

## Already done (as stated to the implementer)

- Staging base SQL applied 2026-09-24. The apply report was not in this repository. The base file was not re-applied by the incremental slice.
- SMS amendment locked + Challenge PASS — folded into PR #160
- Challenge PASS on pass1-v5; CC staging auth

## NOT AUTHORIZED

Hostinger live webhook; active schedules vs live mailbox; prod mutation; customer email/SMS; AI; drafts; email_responses/send_queue; auto CRM lead create; prod creds in staging; real SMS credential without Founder approval
