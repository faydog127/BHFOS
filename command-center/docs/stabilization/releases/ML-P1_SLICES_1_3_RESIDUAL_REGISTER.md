# ML-P1 Slices 1–3 — Consolidated Residual Register

Audit baseline: main `a0391757e2c4278407204aef5a03974f9a204fba` · live `https://app.bhfos.com`.

Status key: `OPEN` · `REMEDIATED` · `ACCEPTED_RESIDUAL` · `CLOSED` · `PRODUCT_DECISION`

| Issue ID | Description | Surface | Severity | Prod impact | Source SHA | First detection | Owner | Remediation | Status | Closure evidence | Escaped to prod |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-COH-01 | Quote vs Estimate UI/route inversion (nav Quotes, path Estimates) | Nav, list, titles, routes | High | Confusing IA; wrong mental model | pre-`a039175` UI | Founder coherence request + live audit | Orchestrator | Canonical `/crm/quotes`; estimates redirect | REMEDIATED | Coherence PR + Hostinger redeploy | Yes |
| R-COH-02 | List Accept navigated to `/tvg/estimates/p1-lifecycle` (no `/crm`) | ProposalList | High | Broken office approve entry | pre-fix | Coherence audit | Orchestrator | `/crm/quotes/p1-lifecycle/:id` | REMEDIATED | Coherence PR | Yes |
| R-COH-03 | Lifecycle back-nav to `/tvg/quotes` (outside CRM) | Lifecycle page | Medium | Refresh/back dead-end | pre-fix | Coherence audit | Orchestrator | `/crm/quotes` | REMEDIATED | Coherence PR | Yes |
| R-COH-04 | List Open/Edit opened ProposalBuilder not lifecycle | ProposalList | Medium | Bypassed canonical lifecycle | pre-fix | Coherence audit | Orchestrator | Primary Open → lifecycle | REMEDIATED | Coherence PR | Yes |
| R-COH-05 | Sidebar build stamp hard-coded / stale fallback | BHFSidebar | Low | Wrong version identity | pre-fix | Coherence audit | Orchestrator | Read `/build-info.json` | REMEDIATED | Coherence PR | Yes |
| R-COH-06 | Dual office statuses `sent`/`viewed`/`issued` + `accepted`/`approved` | List badges, filters, lifecycle | Medium | Operator confusion | S2 state machine | Coherence audit | Product | Document map; filter label Approved; reject includes issued | ACCEPTED_RESIDUAL | Terminology map §1 | Yes |
| R-COH-07 | Job entity labeled Work Orders in nav | Sidebar, Jobs page | Low | Dual naming | Historic | Coherence audit | Product | Keep Work Orders label; DB stays `jobs` | ACCEPTED_RESIDUAL | Terminology map | Yes |
| R-COH-08 | Dual mutation paths (Edge list/send/status vs lifecycle RPCs) | Quotes list vs lifecycle | Medium | Parallel writers; reject on list ≠ lifecycle RPC | S1–S3 | Coherence audit / KI-01 theme | Architecture | Defer consolidation; no schema change this pass | ACCEPTED_RESIDUAL | Audit §3 | Yes |
| R-COH-09 | ProposalBuilder remains at `quotes/:id` as secondary writer | ProposalBuilder | Medium | Legacy edit path still reachable by URL | S1 | Coherence audit | Product | Primary list uses lifecycle; builder not removed | ACCEPTED_RESIDUAL | Route map | Yes |
| R-COH-10 | Hostinger live SHA behind main tip after DB-only remediations | `build-info.json` | Medium | Footer ≠ main tip | `5cd7360` live vs `a039175` main | Coherence audit | Ops | Redeploy Hostinger after coherence merge | REMEDIATED (on deploy) | Post-deploy build-info | Yes |
| R-COH-11 | Three synthetic `is_test_data` leads in production | leads | Low | Noise in lead lists | 2026-07-14 synth | Coherence synth scan | Ops | Deleted after provenance + zero dependents | REMEDIATED | Delete log 2026-07-22T00:57:34Z | Yes |
| R-COH-12 | Superseded quotes / revision grouping weak on list | Quotes list | Medium | Version clutter risk | S2 revise | Coherence audit | Product | Prefer history; list filter residual | OPEN | — | Possible |
| R-COH-13 | List lacks linked-job / expiration columns | Quotes list | Low | Job confirmation only on lifecycle | S3 | Coherence audit | Product | Lifecycle shows linked job | ACCEPTED_RESIDUAL | Lifecycle UI | Yes |
| R-COH-14 | Incomplete Finance/Growth nav surfaces vs Slice map | Sidebar | Medium | May look operational before Slice 4–6 | Historic | Coherence audit | Product | Do not expand Slice 4; document | PRODUCT_DECISION | Founder if hide now | Yes |
| R-S1-01 | estimates INSERT DENY | DB RLS | — | — | Closed prior | R-S1-01 closeout | Data | — | CLOSED | RS101 closeout | Mitigated |
| R-S3-01 | service_role / quote_id update residual | jobs RLS | Medium | Defense-in-depth | S3 packet | S3 evidence | Security | Accepted at S3 | ACCEPTED_RESIDUAL | S3 packet | Yes |
| R-S3-02 | No full line-item copy to job | jobs | Low | Totals + version pin only | S3 | S3 evidence | Product | Accepted | ACCEPTED_RESIDUAL | S3 | Yes |
| R-S3-04 | Office break-glass skips closeFollowUpTasks | Approve path | Low | Follow-up tasks may linger | S3 | S3 evidence | Product | Deferred (S6) | ACCEPTED_RESIDUAL | S3 | Yes |
| KI-01 | Dual estimates vs quotes systems | Platform | High (mitigated) | New writes quotes-only | Planning register | KI register | Architecture | UI freeze + DENY + quotes path | ACCEPTED_RESIDUAL | Money-state contract | Historic |

## Synthetic data disposition

| Record | Provenance | Action |
| --- | --- | --- |
| leads `6796b7d1…`, `865ad090…`, `34c68f8b…` | `is_test_data=true`, name SYNTHETIC TEST-DO-NOT-CONTACT, `@example.invalid`, 0 quotes/jobs/appointments | **DELETED** 2026-07-22T00:57:34Z |
| S3val / S3FIX / S3PROBE quotes/jobs | Scan found none remaining | No action |

Production customer records: **not altered**.
