# ML-P1 Slices 1–3 — Production Coherence Audit

| Field | Value |
| --- | --- |
| Audit against main | `a0391757e2c4278407204aef5a03974f9a204fba` |
| Live host | `https://app.bhfos.com` |
| Live SHA at audit start | `5cd7360aceb5492985cea6f3ff56253e5165bbea` (Hostinger lag vs main tip) |
| Production Supabase | `wwyxohjnyqnegzbxtuxs` |
| Scope | Customer → Quote → Approval → Job (Slices 1–3) |
| Slice 4 | **Paused** — not started |

## Disposition

See closeout companion: final disposition recorded after remediation merge + Hostinger redeploy.

## 1. Canonical terminology map

| Business object / state | Canonical user term | DB / server term (do not rename for UI) | Notes |
| --- | --- | --- | --- |
| Sales document | **Quote / Quotes** | `quotes`, `quote_items` | Office IA target |
| Legacy sales table | (no active create UI) | `estimates` | INSERT DENY (R-S1-01); read-only residual OK |
| Customer-facing document | **Quote** | public token route `/quotes/:token` | Already Quote-labeled |
| Draft | **Draft** | `draft` | |
| Issued to customer | **Sent** (office list) / issued in lifecycle | `sent`, `viewed`, `issued` | Dual labels exist; see residual R-COH-06 |
| Customer acceptance | **Approved** (office) / **Accepted** (customer toast) | `approved` (also historic `accepted`) | Filter maps accepted→approved |
| Declined | **Rejected** | `rejected` | |
| Past validity | **Expired** | `expired` | |
| Replaced by revision | **Superseded** | `superseded` | Prefer history, not primary actionable list |
| Field work record | **Work Order** (nav) / Job (system) | `jobs` | Dual label accepted residual R-COH-07 |
| Proposal | Compatibility only | — | Redirect to Quotes |

## 2. Canonical route map

| Purpose | Canonical route | Compatibility |
| --- | --- | --- |
| Quote list | `/:tenant/crm/quotes` | `…/crm/estimates`, `…/crm/proposals` → redirect |
| New / draft quote | `/:tenant/crm/quotes/new` (+ `quotes/p1-draft`) | legacy estimates paths redirect |
| Quote lifecycle (primary for existing) | `/:tenant/crm/quotes/p1-lifecycle/:id` | |
| Legacy builder (secondary) | `/:tenant/crm/quotes/:id` | ProposalBuilder; not primary list Open |
| Customer approval | `/quotes/:token` | |
| Linked job / work orders | `/:tenant/crm/jobs` | |

## 3. Audit findings (pre-remediation)

### Terminology / IA
- Sidebar said Quotes but primary path/page still Estimates (`/crm/estimates`).
- Browser title and headings mixed Estimates vs Quotes.
- “Actionable Estimates” misnamed the quotes-backed list.

### Routes / workflow
- List Accept used `tenantPath('estimates/p1-lifecycle/…')` → **missing `/crm`**, broke navigation.
- Lifecycle back-nav used `tenantPath('quotes')` → `/tvg/quotes` (outside CRM tree).
- List Open/Edit targeted ProposalBuilder instead of lifecycle.
- Dual writers: list send/status via Edge (`quotes-list`, `quote-update-status`, `send-estimate`); lifecycle via RPCs (documented residual).

### Build identity
- Live `build-info.json` SHA `5cd7360…` behind main tip `a039175…` (DB remediations only after S3 frontend deploy).
- Sidebar previously fell back to hard-coded `VITE_BUILD_STAMP` `2026-02-23-1` — remediates to live `/build-info.json`.

### Synthetic data
- Three `is_test_data` leads (`SYNTHETIC TEST-DO-NOT-CONTACT`, `@example.invalid`), zero quotes/jobs/appointments.
- No leftover S3 validation quotes/jobs under synth markers.

### List quality
- Source: Edge `quotes-list` on `quotes` (canonical).
- Filters: All / Draft / Sent / Approved (accepted→approved).
- Superseded grouping / history UX incomplete (residual).
- Linked-job column not on list (visible on lifecycle).

### Navigation
- Finance Invoices / Growth Marketing / Partners / Reporting may be incomplete relative to Slice map — hide-or-label deferred as product residual (do not pretend Slice 4–6 complete).
- Jobs nav label **Work Orders** vs entity **Job** — accepted dual label.

## 4. Bounded remediations in this pass

1. Canonical `/crm/quotes/*` routes; estimates/proposals compat redirects only.
2. Nav, titles, list, hub, flow console, inspection delivery → Quotes terminology.
3. Primary list Open → lifecycle; Accept/back paths fixed under `/crm/quotes`.
4. Sidebar build label from `/build-info.json`.
5. Delete three confirmed synthetic leads (provenance logged).
6. Accessibility: select-all / select-row aria-labels say quotes.

## 5. Explicitly not changed (stop for product / later slice)

- DB state machine / schema
- Financial logic / Stripe / invoices
- Edge vs RPC dual mutation consolidation
- Renaming `jobs` table or forcing Job vs Work Order product rename
- Slice 4 field execution / TIS / G2.3 reopen
- `auto_create_job_on_quote_acceptance` remains false
