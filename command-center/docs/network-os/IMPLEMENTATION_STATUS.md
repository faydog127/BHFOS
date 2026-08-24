# Network OS — Implementation Status

**Branch:** `network-os/convention-demo-fast-lane`
**Status edit parent:** `28fe3897ee32f93a7eea3250fb67a4bd915b733b`
**Base:** `326e7a2941b9333f341716fff199d6ef6c913b53` (`network-os/foundation`)
**Draft PR:** https://github.com/faydog127/BHFOS/pull/141
**Mission:** QR-to-onboarding hop on Fast Convention Lane
**Product / R1 / Slice 1 activation:** **None**
**PR 140:** frozen / not touched

## Convention QR intake (2026-08-24) — WRITE PATH BLOCKED

Command Center chose the QR-to-onboarding hop. The public destination, form contract, queue shell, and deterministic QR artifact are present. **Persistence is fail-closed.** Existing objects cannot isolate a public write from customer/partner operational records.

| Field | Value |
|---|---|
| QR target | `/network-os/convention/join` |
| Form | name, company, email, phone, trades/services, service area, consent, honeypot |
| Persistence | Never inserts/updates/selects `leads`, `contacts`, `partner_prospects`, `submissions`, or `events` |
| Queue | `/network-os/convention/intake` — authenticated shell; grant unproven so rows stay empty |
| Confirmation | `/network-os/convention/join/thanks` — no internal identifiers, no echoed PII |
| Evidence tier | **locally verified** fail-closed tests. Not hosted-written, not deployed as command-center, not merged |

## Object / field mapping (not persisted)

| Form field | Intended map | Why unused |
|---|---|---|
| name | `leads.first_name` / `partner_prospects` name | Customer or unscoped partner write |
| company | `leads.company` | Customer-bearing `leads` |
| email / phone | `leads.email` / `leads.phone` | PII into customer tenant |
| trades | no proven allowlisted column | Would require guessed JSON/text |
| service_area | no proven column | Not in Stage C lead/contact manifest as a safe write |
| consent | `leads.consent_marketing` (boolean exists) | Still a customer-lead write |
| source | `convention_qr` | Mapped in memory only |
| status | `provider_interest_received` | Mapped in memory only |

## Exact missing schema / policy requirements

1. **isolated_intake_object** — dedicated convention-intake relation or proven non-customer tenant. Not `leads`, `contacts`, `partner_prospects`, `submissions`, or `events`.
2. **hosted_rls_public_read_deny** — hosted proof that anon/PUBLIC cannot SELECT intake or customer rows.
3. **hosted_rls_public_table_write_deny** — hosted proof that anon cannot INSERT/UPDATE/DELETE those tables.
4. **server_write_owner** — server function with field allowlist, no PII logs, no browser service_role, no write into customer `leads`/`contacts` or unscoped `partner_prospects`. Existing `leads/index.ts` logs full payloads and writes customer leads. `lead-intake` is not present in this functions tree.
5. **duplicate_key** — proven unique key that does not require anonymous customer-table reads.
6. **bhis_queue_grant** — proven BHIS intake-queue grant. `app_user_roles` tenant/RLS is unproven; unscoped fallback is prohibited.

## Isolation evidence

- Valid synthetic submit never calls `supabase.from`.
- Anon queue read denied.
- Authenticated session without a proven BHIS grant denied; no table query.
- Customer scopes cannot authorize this write even if demo-write env flags are set.
- Client intake sources contain no `service_role` and do not log email/phone payloads.

## Residual risks

- Automatic Vercel preview is Website/bhfos-site, not command-center.
- Hosted RLS remains unproven.
- Process-local duplicate/rate-limit maps are not durable (acceptable because nothing is stored).
- Public form still accepts input in the browser; it must not be connected to a live writer without the missing proofs.

## Deployment requirements (not authorized here)

- Isolated intake object + hosted RLS proof
- Server function deploy without PII logging
- Command-center preview/host (not the marketing Vercel project)
- No R1/S1 activation implied

## Exact-head Guard assignment

After this commit is published, assign Architecture/Contract Guard to draft PR #141 at the published HEAD. Review the fail-closed QR hop and the six missing requirements. Do not merge. Do not treat a marketing Vercel URL as the convention app. PR 140 stays frozen.

## Exact next action

Guard review of draft PR #141. Founder is not required for this correction. No merge, hosted write, deploy, or R1/S1 activation.
