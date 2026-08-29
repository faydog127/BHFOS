# Network OS / Command Center n8n courier — Implementation Status

**Packet:** `NOS-COMMAND-CENTER-N8N-COURIER-01`  
**Branch:** `cursor/n8n-command-courier-42f0`  
**Baseline (origin/main at branch cut):** `17f9228951d74824d9b6fb0eb704832befed2afc`  
**Verified implementation HEAD:** `ce74cc9c6b99ace7a62f110ce9585ed848d5ecf3`  
**Branch tip at this status edit:** `384977cf9c72e299f546d7d9db44532d2f672b9e`  
**Draft PR:** https://github.com/faydog127/BHFOS/pull/156  
**Evidence tier:** **locally verified** (unit tests). Not deployed. Not staging-verified. Not merged. Not production.

Destination identity (comments/docs only): unpublished n8n ingress workflow `VaeN89dWkLYoyWyh`  
(packet text also spelled `VaeN89dwkLYoyWyh`; canonical comment identity is `VaeN89dWkLYoyWyh`).  
No live webhook URL is hardcoded.

## Verdict

`ATOMIC_CLAIM_REQUIRED`

An authorized Command Center request can be authenticated and an outbound envelope can be constructed, but this HEAD has **no approved atomic claim/idempotency interface** that can reserve `packet_id` before an n8n call. The courier **stops before any outbound request**. It does not invent a table, reuse a money/MIL/ops table, or substitute process memory.

This is not a working production courier.

## What is locally proven

| Check | Result |
|---|---|
| Unauthorized / forbidden caller | No outbound fetch; secrets are not read |
| Envelope shape | `event_type=command.packet.submitted`, `delivery_id=packet_id`, server `occurred_at`, `source=bhfos-command-center`, payload = packet text + permitted repo context |
| Secrets in client tree | `N8N_COMMAND_INGRESS_URL`, `N8N_COMMAND_INGRESS_TOKEN`, and `X-BHFOS-Ingress-Token` absent from `src/` |
| Logs / public response | Token, webhook URL, packet text, and Authorization material redacted |
| n8n / network failure (injected claim double only) | Controlled `ingress_failed`, `delivered=false` |
| Duplicate `packet_id` | **Not proven** — no approved claim interface on this HEAD |
| Deploy / hosted apply / n8n publish | **Not done** (out of authorization) |

Command: `npm run test:command-packet-courier` from `command-center/`.

## Atomic-claim investigation (this HEAD)

Searched on `origin/main` `17f9228951d74824d9b6fb0eb704832befed2afc` and this branch:

| Candidate | Why it did not qualify |
|---|---|
| `public.idempotency_keys` | Named in `ARCHITECTURE.md` only. No `CREATE TABLE`, no callers. |
| `claimOnce` / `tryClaim` / `acquire_claim` / `outbox_claim` helpers | No matches under `command-center/`. |
| Fast Lane / transactional outbox helper | No Fast Lane or outbox implementation on this HEAD. Money-state docs mention outbox as a design requirement only. Fast Lane closeout was not opened or edited. |
| `public.event_jobs` / `public.messages` | Ops visibility queues. Optional `idempotency_key`, no unique constraint, no claim RPC. |
| Stripe / quote / invoice / payment idempotency | Domain-specific money-path keys. Not approved for command-packet delivery. |
| `mil_upload_grants` `FOR UPDATE` completion claim | MIL upload finalize only. Reuse would invent a new store use. |
| Review Board claim/lease (`DEC-V2-014` / `REQ-V2-001`) | Design only; implementation unauthorized. This packet forbids touching Review Board. |
| Process-local `Map` / memory set | Explicitly disallowed. |

Related draft work on other branches (not this HEAD, not reused): PRs #152 / #153 record that n8n Cloud Data Tables also lacked a proven atomic delivery claim.

## Auth reuse

Existing Command Center server auth **was** found and reused:

- JWT verification: `supabase/functions/_shared/auth.ts` `getVerifiedClaims`
- Admin/owner role: `app_user_roles` plus `admin` / `super_admin` / `owner`, matching `money-loop-delete` / `send-estimate`
- Superuser claim flags: same shape as `github-issues-board`

Unauthorized callers are rejected before envelope claim and before any ingress secret read or fetch.

## Explicit non-actions

- No merge, deploy, force-push
- No n8n workflow publish or activation
- No webhook URL or token in the browser/client bundle
- No new database table or migration
- No process-memory production idempotency
- Fast Lane closeout, Slice 1, R1/S1, Review Board, and production n8n were not touched

## Exact next action

Founder-authorize an **approved atomic claim interface** (migration + RPC or equivalent durable single-winner reserve on `packet_id`). After that interface exists on the authorized HEAD, a later packet may wire `claimPacket` to it and allow the first outbound n8n call.

## Authorization boundary

This draft PR is source + local unit tests only. It does not authorize secret issuance, Edge deploy, Hostinger deploy, n8n activation, or merge.
