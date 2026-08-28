# Network OS n8n Assurance — Edge Adapter Source Evidence

**Evidence date:** 2026-08-28 UTC  
**State:** **SOURCE-PRESENT · LOCALLY VERIFIED HANDLER · DATABASE UNAPPLIED · UNDEPLOYED**  
**Requirement / release / work item:** `NOS-N8N-ASSURANCE-REQ-001` / `NOS-N8N-ASSURANCE-PHASE-A-01` / `NOS-N8N-EDGE-INGRESS-SPIKE-01`

## Implemented source

| Path | Purpose |
|---|---|
| `supabase/functions/network-os-assurance-ingress/handler.mjs` | exact-byte HMAC, deterministic validation, atomic-claim contract, normalized forwarding |
| `supabase/functions/network-os-assurance-ingress/index.ts` | preview-test mode lock, server-only environment binding, Supabase RPC claim, authenticated n8n forward |
| `supabase/migrations/20260828170000_network_os_assurance_delivery_claims.sql` | primary-key delivery table and single-statement conflict claim |
| `supabase/rollbacks/20260828170000_network_os_assurance_delivery_claims.sql` | bounded source-only removal |
| `tests/unit/network-os-assurance-ingress.test.mjs` | synthetic deterministic handler and source-contract tests |

## Fail-closed activation lock

The function is not operational merely because its source exists. `configurationReady` is true only when:

- `NOS_ASSURANCE_MODE` is exactly `preview-test`;
- the GitHub webhook secret is present server-side;
- the exact repository ID and full name are present;
- the exact GitHub App installation ID is present;
- at least one action is allowlisted;
- the database URL and service credential are present;
- the authenticated n8n test-ingress URL and credential are present.

Absent any value, the handler returns `503 INGRESS_NOT_CONFIGURED` before claiming or forwarding a delivery.

## Request contract

1. POST and `application/json` only.
2. Maximum raw body size: 1 MiB.
3. HMAC-SHA256 verified over the original bytes using Web Crypto `subtle.verify`.
4. Header validation for event, delivery ID, and signature.
5. Exact pull-request event/action allowlist.
6. Exact numeric repository and installation IDs plus repository full name.
7. Positive PR number, lower-case 40-character head SHA, bounded base ref, boolean draft state.
8. Database claim before forwarding.
9. Duplicate response without forwarding.
10. Normalized schema 1.0 envelope only; arbitrary GitHub payload fields are discarded.
11. Authenticated n8n POST with 4-second abort signal.
12. Claim retained and marked `forward_failed` if forwarding fails; automatic retries are absent.
13. Logs contain only bounded status, code, and validated delivery ID.

## Atomic claim source

The delivery table uses `delivery_id text PRIMARY KEY`. The claim function performs one:

`INSERT ... ON CONFLICT (delivery_id) DO NOTHING`

It returns true only when `ROW_COUNT = 1`. Table access is revoked from PUBLIC, anon, authenticated, and service_role; service_role receives EXECUTE only on the two fixed SECURITY DEFINER functions. Both functions set `search_path = public, pg_temp`.

This is source evidence, not database evidence. The migration was not applied, so database concurrency and grants remain unproved.

## Local verification

Command:

`node --test tests/unit/network-os-assurance-ingress.test.mjs`

Environment: Node `v24.19.0`.

Result: **11 tests passed, 0 failed**.

Covered:

- inert configuration gate;
- exact-byte signature success;
- normalized-envelope allowlist;
- 25 concurrent identical handler requests → one accepted forward and 24 duplicate responses;
- missing, malformed, and incorrect signatures;
- irrelevant events and actions;
- repository, installation, and PR mismatches;
- invalid delivery headers, JSON, content type, and oversized body;
- unavailable claim store;
- failed n8n forward with retained claim;
- sanitized logs;
- static primary-key, conflict, privilege, SECURITY DEFINER, search-path, and rollback contracts.

GitHub CI tested implementation head `0088c9a0a80fdd96359d9b3fedc729c94089bff3` on Node 20.19.1. The dedicated `network_os_assurance_ingress` job passed, as did repository lint, build, Ledger Lock, identity contracts, Supabase OAuth helpers, Founder-run readiness, and control-plane lane checks.

The 25-request result proves the handler honors a single-winner claim dependency. It does **not** prove the PostgreSQL function until a later authorization permits a disposable/local migration apply and concurrent database test.

## Boundary confirmation

No secret was created or accessed. No migration or rollback was applied. No Edge Function was deployed. No GitHub App or webhook was changed. No n8n workflow was published. No AI model was called. No merge or production action occurred.

## Exact next gate

Independent source review at the exact implementation head. After review findings are resolved, the Founder may separately authorize a disposable/local migration apply and database concurrency proof. That later permission would still not authorize hosted apply, deployment, webhook activation, workflow publication, merge, or production.
