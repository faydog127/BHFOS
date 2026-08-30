# N8N Command Packet Claim — Disposable-Local Evidence

**Packet:** `NOS-N8N-COMMAND-PACKET-CLAIM-CONTRACT-01`  
**Work item:** `NOS-WI-N8N-COMMAND-PACKET-CLAIM-01`  
**Release:** `NOS-REL-N8N-COMMAND-PACKET-CLAIM-01`  
**Requirement:** `NOS-N8N-REQ-COMMAND-PACKET-CLAIM-01`  
**State:** SOURCE-PRESENT · locally executed unit suites · disposable-local PostgreSQL apply/concurrency/rollback executed. **Not** `VERIFICATION_PASS`. **Not** hosted apply. **Not** Edge deploy. **Not** n8n publish. **Not** merged. **Not** production.

Builder executed the acceptance commands and recorded counts. This chat must not certify the release.

## Identity

| Field | Value |
|---|---|
| Branch | `cursor/n8n-command-packet-claim-01` |
| Base | `cursor/n8n-command-courier-42f0` @ `e198f01829a61ab2c65da0fcaa54431386bd657b` (PR 156 head) |
| Implementation SHA | `ab5b5e74fa39aafc00608b9db1d35daadae70128` |
| Draft PR | https://github.com/faydog127/BHFOS/pull/157 |
| Migration | `command-center/supabase/migrations/20260830050000_network_os_command_packet_claims.sql` |
| Migration blob at implementation SHA | `814e0c1c6dbf57b52f591f4c510a8f8432e51b67` |
| Rollback | `command-center/supabase/rollbacks/20260830050000_network_os_command_packet_claims.sql` |
| Rollback blob at implementation SHA | `d63ef3566f5245f4150fe1733365d485f5dfee2b` |
| Node | `v22.14.0` |
| Disposable PostgreSQL | `16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)` on `127.0.0.1:55433` |
| Divergence vs PR 156 branch at evidence authoring | `0	2` (`origin/cursor/n8n-command-courier-42f0...HEAD`) |

An evidence-only documentation commit may advance HEAD after this implementation SHA. Protected implementation blobs are the migration, rollback, courier module, edge binding, unit tests, and disposable proof script at `ab5b5e7`.

## Commands

```bash
git checkout -b cursor/n8n-command-packet-claim-01 e198f01829a61ab2c65da0fcaa54431386bd657b
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
cd command-center
npm run test:command-packet-courier
npm run test:command-packet-claim
node tools/command-packet-claim-disposable-proof.mjs
```

Synthetic packets only. No customer data. No secret values. Packet body text is not recorded here.

## Results

### Existing PR 156 unit suite

Command: `npm run test:command-packet-courier`  
Result: **17 pass, 0 fail**

### New claim-contract unit suite

Command: `npm run test:command-packet-claim`  
Result: **9 pass, 0 fail**

Covers AC-1 source isolation, digest stability, AC-2/AC-3 injected claim+outbound, AC-5 conflict (no outbound), AC-6 claim failure (no outbound, no memory fallback), AC-7 unauthorized (0 claim invoke, 0 secrets read, 0 outbound), AC-8 redaction, AC-9 client-tree absence of claim RPC/table/adapter/ingress secret names.

### Disposable PostgreSQL proof

Command: `node tools/command-packet-claim-disposable-proof.mjs`  
Cluster: isolated `initdb` under `/tmp/nos-command-packet-claim-*`, TCP only `127.0.0.1:55433`, deleted after rollback.

| Step | Result |
|---|---|
| apply | ok |
| AC-1 isolation | command-packet table `t`, RPC `t`; PR 154 assurance table `f`, RPC `f` |
| AC-2 / AC-3 sequential | first=`claimed`, second=`duplicate` |
| AC-4 25-way same packet_id+digest | **claimed=1, duplicate=24, conflict=0, other=0** |
| AC-5 different digest | `conflict` |
| privileges | service_role table SELECT `f`; anon EXECUTE `f`; authenticated EXECUTE `f`; service_role EXECUTE `t` |
| AC-10 rollback | table present `f`, RPC present `f` |
| teardown | cluster_deleted |

Raw proof JSON (no packet text, no secrets):

```json
{
  "host": "127.0.0.1",
  "port": "55433",
  "ok": true,
  "steps": [
    { "step": "apply", "result": "ok" },
    { "step": "ac1_isolation", "command_packet_table": "t", "command_packet_rpc": "t", "assurance_table": "f", "assurance_rpc": "f" },
    { "step": "ac2_ac3_sequential", "first": "claimed", "second": "duplicate" },
    { "step": "ac4_concurrency", "tallies": { "claimed": 1, "duplicate": 24, "conflict": 0, "other": 0 }, "winner_count": 1 },
    { "step": "ac5_conflict", "result": "conflict" },
    { "step": "privileges", "service_role_table_select": "f", "anon_execute": "f", "authenticated_execute": "f", "service_role_execute": "t" },
    { "step": "ac10_rollback", "table_present": "f", "rpc_present": "f" },
    { "step": "teardown", "result": "cluster_deleted" }
  ]
}
```

## Security / boundary scans (local)

| Scan | Result |
|---|---|
| PR 154 migration/rollback paths on this branch | absent |
| `rpc(` in `commandPacketCourier.mjs` | absent |
| `network_os_claim_assurance_delivery` in courier edge | absent |
| `network_os_claim_command_packet` / claim table / adapter / `N8N_COMMAND_INGRESS_*` in `command-center/src` | no matches |
| Migration columns | `packet_id`, `packet_digest`, `event_type`, `source`, `claimed_at` only |
| Hosted apply / Edge deploy / n8n publish / credential attach / real n8n / merge | not performed (AC-11) |

## Deviations

1. `claimed_at` default is `clock_timestamp()` (database-generated; not client-supplied).
2. Server-side digest is SHA-256 of `packet_id`, `event_type`, `source`, and packet body bytes. `occurred_at` is excluded so a retry of the same packet identity is `duplicate`, not `conflict`. Packet body is hashed in memory and is not stored or written to this evidence.
3. `defaultProductionClaimAdapter` remains the PR 154 mismatch stub so the existing PR 156 unit suite still passes without rewriting those tests. The edge function consumes `createCommandPacketClaimAdapter` → `network_os_claim_command_packet`.
4. AC-9 client scan targets claim-contract identifiers and ingress secret names. Pre-existing unrelated `service_role` strings in other `src/` modules were not treated as claim-path leakage.

## Blockers

None for isolated source + disposable-local execution. Hosted apply, Edge deploy, n8n activation, and merge remain unauthorized.

## Exact next action

Independent verification of this evidence. Do not merge this PR, PR 156, or PR 154.
