# Network OS / Command Center n8n courier — Implementation Status

**Packet:** `NOS-N8N-COMMAND-PACKET-CLAIM-CONTRACT-01`  
**Work item:** `NOS-WI-N8N-COMMAND-PACKET-CLAIM-01`  
**Release:** `NOS-REL-N8N-COMMAND-PACKET-CLAIM-01`  
**Requirement:** `NOS-N8N-REQ-COMMAND-PACKET-CLAIM-01`  
**Branch:** `cursor/n8n-command-packet-claim-01`  
**Stacked on:** `cursor/n8n-command-courier-42f0` @ `e198f01829a61ab2c65da0fcaa54431386bd657b` (PR 156 head)  
**Evidence tier:** **SOURCE-PRESENT** plus disposable-local PostgreSQL proof when the proof script is run. Not deployed. Not staging-verified. Not merged. Not production. This chat does **not** claim `VERIFICATION_PASS`.

Destination identity (comments/docs only): unpublished n8n ingress workflow `VaeN89dWkLYoyWyh`.  
No live webhook URL is hardcoded. Production authority: **NONE**.

## Verdict

Purpose-specific durable atomic claim for `command.packet.submitted` courier packets keyed by `packet_id`. At-most-once outbound n8n send eligibility. Not exactly-once delivery.

PR 154 GitHub assurance objects (`public.network_os_assurance_delivery_claims`, `network_os_claim_assurance_delivery`) are **not** copied, widened, or called.

## Objects

| Object | Purpose |
|---|---|
| `public.network_os_command_packet_claims` | `packet_id` PK; `packet_digest` SHA-256 hex; `event_type` exactly `command.packet.submitted`; `source` exactly `bhfos-command-center`; `claimed_at` database-generated |
| `public.network_os_claim_command_packet(p_packet_id, p_packet_digest, p_event_type, p_source)` | Returns exactly `claimed` \| `duplicate` \| `conflict` via `INSERT … ON CONFLICT (packet_id) DO NOTHING` |

Courier order: authenticate → validate packet → construct envelope → server-side SHA-256 digest → atomic claim → only `claimed` may proceed toward outbound.

## Explicit non-actions

- No merge of this PR, PR 156, or PR 154
- No hosted/preview/production schema apply
- No Edge deploy, n8n publish/activation, credential attach/rotate
- No real command packet sent to n8n
- No Fast Lane, Review Board, or client-bundle claim path

## Exact next action

Independent verification of disposable-local evidence in `docs/network-os/N8N_COMMAND_PACKET_CLAIM_EVIDENCE.md`. Do not merge.

## Authorization boundary

Isolated source + disposable-local verification only. No secret issuance, hosted apply, Edge deploy, Hostinger deploy, n8n activation, or merge.
