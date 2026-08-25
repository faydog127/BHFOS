# Network OS / n8n standup — T0 Evidence Ledger

Canonical T0 evidence ledger for n8n standup. This is the only T0 ledger path.
Do not create parallel ledgers. Do not create 147/149/150-style split records.

T0 does not imply product health.
n8n may not write this ledger.
Fast Lane archive stays immutable.

## Ledger identity

| Field | Value |
|---|---|
| ledger_id | `NOS-T0-EVIDENCE-LEDGER-01` |
| ledger_version | `1` |
| ledger_path | `command-center/docs/network-os/T0_EVIDENCE_LEDGER.md` |
| frozen_sha | `PENDING_WRITEBACK` |
| freeze_status | `EVIDENCE_CAPTURED` |
| evidence_class | `SOURCE-ONLY` |
| created_at | `2026-08-25T21:45:00Z` |
| updated_at | `2026-08-25T21:45:00Z` |
| authority_owner | Founder |
| record_owner | Human/docs (n8n Coordinator thread; not n8n) |

`evidence_class` enum (this record is **SOURCE-ONLY**): `SOURCE-ONLY` \| `locally verified` \| `CI` \| `merged` \| `DEPLOYED` \| `REACHABLE` \| `USABLE`.

## Path decision (verified before write)

| Candidate | Result |
|---|---|
| `command-center/docs/governance/network-os/` | **Does not exist.** Inventing it would create a new subtree. Discarded. |
| `command-center/docs/governance/RELEASE_LEDGER.yaml` | Existing G2.3 / v2.2 release ledger. Different purpose. Not this ledger. |
| `command-center/docs/network-os/IMPLEMENTATION_STATUS.md` | Existing domain status file. PRs 147 / 149 / 150 rewrite it as split records. **Not** this ledger. |
| `command-center/docs/network-os/T0_EVIDENCE_LEDGER.md` | **Selected.** Single new file under the existing Network OS docs domain. |

Starting ref (exists): `1518e9f92c43e72bb0b294f2ecc5afec2446ea60` on `hotfix/v1-crm-layout-hooks` (PR 148 merge). That SHA is the parent of this ledger addition, not the freeze SHA.

## Hard constraints (this record)

- T0 does not imply product health.
- T0 docs/ledger never implies product health, USABLE, STABLE, or COMPLETE.
- n8n may not write this ledger.
- Fast Lane archive stays immutable.
- This hop is docs/markdown only. No app code, SQL, env files, workflows, n8n JSON, webhooks, or secrets.
- Not n8n activation. Not Slice 1. Not R1/S1. Not Fast Lane closeout. Not credential work.
- Do not touch Fast Lane closeout, Hostinger, Supabase, Slice 1, R1/S1, or PR 140.
- `command-center/build-out.txt` is untouched.

## Non-claims

| Claim | Status |
|---|---|
| Product health | **Not implied** |
| USABLE | **Not claimed** |
| STABLE | **Not claimed** |
| COMPLETE | **Not claimed** |
| READY_FOR_INIT_PACKET | **Not claimed** (SHA write-back has not landed on this revision) |
| n8n activated | **Not this hop** |
| FAST_LANE_COMPLETE | **Not declared** |

## Action record

| Field | Value |
|---|---|
| action_id | `NOS-LEDGER-ON-SHA-01` |
| action_name | Land canonical T0 evidence ledger on a frozen SHA |
| action_description | Docs-only hop: add this single ledger file on a new branch from starting ref `1518e9f92c43e72bb0b294f2ecc5afec2446ea60`, commit it, write the ledger-addition SHA back into `frozen_sha`, and open a PR. Human/docs action id (not invented by n8n). |
| state | `EVIDENCE_CAPTURED` |
| sha | `PENDING_WRITEBACK` |
| authority | Founder 2026-08-25 17:43 ET, n8n Coordinator thread: continue in proper order; this hop is the ledger gate only |
| owner | Human/docs |
| evidence_links | this file; parent SHA `1518e9f92c43e72bb0b294f2ecc5afec2446ea60`; `hotfix/v1-crm-layout-hooks` |
| blocker | none |
| next_transition | Write `frozen_sha` back to the ledger-addition commit and set `freeze_status` / action `state` to `FROZEN`. Do not mark `READY_FOR_INIT_PACKET` until that write-back exists. Do not activate n8n. |
| teardown_status | `NOT_REQUIRED` |

`state` enum: `DRAFT` \| `PROPOSED` \| `AUTHORIZED` \| `IN_PROGRESS` \| `EVIDENCE_CAPTURED` \| `VALIDATED` \| `FROZEN` \| `READY_FOR_INIT_PACKET` \| `BLOCKED` \| `FAILED` \| `SUPERSEDED` \| `ABANDONED`.

This hop lands at `EVIDENCE_CAPTURED` on the ledger-addition commit, then `FROZEN` after SHA write-back. It does not land at `READY_FOR_INIT_PACKET` on this revision.

## Authorization

| Field | Value |
|---|---|
| Authority | Founder |
| Recorded | 2026-08-25 17:43 ET |
| Thread | n8n Coordinator |
| Scope granted | Continue n8n standup in proper order. This hop is the T0 ledger gate only. |
| Scope not granted | n8n activation; Slice 1; R1/S1; Fast Lane closeout; product-code change; credential work; Hostinger; Supabase apply; merge of this PR |
