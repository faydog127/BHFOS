# Golden Runtime Scenarios (v1)

These are the **three** scenarios RVH must prove end-to-end (LOCAL first).

Each scenario defines:
- fixed inputs (fixtures)
- expected outputs
- required evidence

## RVH-P0-A — Revenue chain

Chain:
`Invoice → Pay initiation → Webhook → Invoice marked paid`

LOCAL automation:
- Script: `scripts/runtime/rvh-p0-a-revenue-chain.ps1`

Evidence (minimum):
- run id
- invoice id (uuid)
- provider payment id (redacted)
- `public.transactions` count == 1
- invoice status == `paid` and `balance_due == 0`

## RVH-P1-B — Quote → Job → Dispatch

Chain:
`Quote → Accept → Job created → required fields set → dispatch visibility`

Evidence (minimum):
- quote id + public_token
- job id created for quote id
- job has `service_address` populated (or explicit blocker)

## RVH-P1-C — Scheduling chain

Chain:
`Calendar load → Create appointment → Reload shows appointment`

Evidence (minimum):
- scheduler load returns 200
- appointment id created
- appointment visible in calendar query

