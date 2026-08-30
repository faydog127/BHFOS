# Network OS / Command Center n8n courier — Implementation Status

**Packet:** `NOS-COURIER-ATOMIC-CLAIM-RECONCILIATION-01` (reconciles `NOS-COMMAND-CENTER-N8N-COURIER-01`)  
**Branch:** `cursor/n8n-command-courier-42f0`  
**Baseline (origin/main at branch cut):** `17f9228951d74824d9b6fb0eb704832befed2afc`  
**Courier implementation SHA (inspected):** `ce74cc9c6b99ace7a62f110ce9585ed848d5ecf3`  
**Reconciliation SHA:** `d022a198973a61a6568c0fa402c0e683084e18e4`  
**PR 154 inspected SHA:** `0ec7867f03ca412a83b764b98a18fc695ad57986`  
**Draft PR:** https://github.com/faydog127/BHFOS/pull/156  
**Evidence tier:** **SOURCE-ONLY** inspection of PR 154 + **locally verified** courier unit tests. Not deployed. Not staging-verified. Not merged. Not production.

Destination identity (comments/docs only): unpublished n8n ingress workflow `VaeN89dWkLYoyWyh`.  
No live webhook URL is hardcoded.

## Verdict

`ATOMIC_CLAIM_INTERFACE_MISMATCH`

PR 154 at the pinned SHA **does exist** and contains a durable atomic claim RPC. That RPC is **not suitable** for Command Center courier `packet_id` dedupe. The courier stays fail-closed and does not call it, copy its migration, invent another table, or substitute process memory.

This is not a working production courier.

## PR 154 compatibility

| Field | Exact source at `0ec7867` |
|---|---|
| RPC | `public.network_os_claim_assurance_delivery(p_delivery_id text, p_event_name text, p_repository_id bigint, p_installation_id bigint, p_pr_number bigint, p_head_sha text) RETURNS boolean` |
| Store | `public.network_os_assurance_delivery_claims` (`delivery_id` PK, `INSERT … ON CONFLICT (delivery_id) DO NOTHING`, winner iff `ROW_COUNT = 1`) |
| Caller | `network-os-assurance-ingress` `claimDelivery` → that RPC |
| Purpose (migration comment) | Isolated delivery claims for preview/test **GitHub assurance ingress** |
| Hard CHECKs | `event_name = 'pull_request'`; `repository_id > 0`; `installation_id > 0`; `pr_number > 0`; `head_sha ~ '^[0-9a-f]{40}$'` |
| PR 154 state | Draft, **unmerged**. Current PR head `5d3f590` is **later** than the pin; the **SQL claim contract is unchanged** between pin and that head. |
| On `main` / this branch | Migration and RPC **absent** |

Why it cannot be consumed for courier `packet_id`:

1. Courier event is `command.packet.submitted`. The RPC cannot insert unless `event_name` is literally `pull_request`.
2. Courier permitted context is `{ owner, name, full_name }`. The RPC also requires GitHub `installation_id`, `pr_number`, and a 40-character head SHA.
3. Mapping `packet_id` → `p_delivery_id` while fabricating PR fields would be a substitute implementation and would mix GitHub webhook deliveries with command packets (collision risk).
4. Copying the migration or adding another table is forbidden by this packet.
5. Process memory is forbidden.

PR 156 is **not** stacked on PR 154. There is no compatible interface to depend on.

## What is locally proven

| Check | Result |
|---|---|
| Unauthorized / forbidden caller | No claim call; no outbound fetch; secrets not read |
| Envelope shape | Unchanged; constructed then stop |
| Secrets in client tree / logs | Unchanged redaction + `src/` absence |
| n8n / network failure (injected claim double only) | Controlled `ingress_failed`, `delivered=false` |
| First claim → one outbound | **Not runnable** — mismatch |
| Repeated `packet_id` → no second outbound | **Not runnable** — mismatch |
| 25 concurrent same `packet_id` → one outbound | **Not runnable** — mismatch |
| Deploy / hosted apply / n8n publish | **Not done** |

Command: `npm run test:command-packet-courier` from `command-center/`.

## Explicit non-actions

- No new PR; PR 156 remains draft
- No merge, deploy, force-push, credential change
- No production or hosted schema change
- PR 154 migration was **not** copied
- No n8n publish/activation; PR Coordinator not activated

## Exact next action

A later Founder packet must authorize a **packet_id-scoped** durable claim (or an explicit widening of the PR 154 RPC that drops the `pull_request`-only CHECKs and GitHub-required columns). Until then, keep PR 156 fail-closed.

## Authorization boundary

Source + local unit tests only. No secret issuance, Edge deploy, Hostinger deploy, n8n activation, or merge.
