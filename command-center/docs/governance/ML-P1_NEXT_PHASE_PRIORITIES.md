# ML-P1 â€” Next-Phase Priorities (postâ€“Slice 6)

| Field | Value |
| --- | --- |
| Authority | Founder Erron Â· 2026-07-23 |
| Applies after | Slice 6 Stripe settlement A2/A3 close |
| Orchestrator | Auto-continue under Delegated-Authority Policy |
| Escalate only | Scope changes Â· new payment rails Â· breaking PD/Security invariants |

## Slice numbering (binding)

| ID | Scope |
| --- | --- |
| **S6** | Stripe settlement — **CLOSED** (PRODUCTION VALIDATION PASS) |
| **S7** | Reserved â€” autonomous follow-up / warranty dispatch (do not start until S6 closed + Founder/priority queue allows) |
| **S8** | Mobile Inspections + Bundles + Analytics + UX — **A0/A1 planning** |
| Parallel / thin | Photo bundles Â· Analytics iteration Â· Global UX/IA Â· Settings typed UI Â· Nightly regression |

---

## 1. Mobile Inspections (Slice 8 baseline)

- Own route stack: `/inspections/*` under CRM.
- Offline-capable draft â†’ sync queue.
- Step-builder UX: checklist, photo, notes, sign-off.
- Service objects: `inspections`, `inspection_items`, `inspection_photos`.
- Edge: `inspection-sync` (batched upserts).
- RLS mirrors `jobs` + technician assignment.

**Stop before:** TIS product merge, multi-tenant redesign, silent job completion without S4 readiness.

---

## 2. Photo Bundles

- Drag-to-reorder album (mobile + office).
- Automatic bundle links in job / invoice emails.
- Object storage prefix: `tenant_id/jobs/{job_id}/photos/{bundle}/{uuid}.jpg`.

---

## 3. Analytics Dashboard Iteration

- Surface: `/analytics` â†’ tabbed cards (**Ops**, **Sales**, **Tech**).
- Metrics API: `supabase.rpc('ml_analytics_<metric>')` â€” **read-only only**.
- Date-range + tenant selector; cache in Edge Config.
- Export CSV / PNG.

**Stop before:** write RPCs, customer-facing analytics portal, billing from metrics.

---

## 4. Global UX / IA tightening (high-impact, low-code)

- Left nav order: **Dashboard â†’ CRM â†’ Jobs â†’ Quotes â†’ Inspections â†’ Analytics â†’ Settings**.
- Consistent breadcrumbs & page titles (Job # â†’ tabs; Quote # â†’ tabs).
- Floating **+ Create** (context-sensitive).
- Mobile bottom-bar (5 icons) Â· dark-mode toggle Â· faster autocomplete lists.

---

## 5. Settings surface (owner-tunable, no redeploy)

Typed UI + form save on existing settings storage. Defaults remain safe (auto-issue / auto-charge **OFF** until Major Decision #3).

| Setting | Purpose | UI | Storage key |
| --- | --- | --- | --- |
| Invoice â†’ Auto-draft on job complete | Enable later | Settings â†’ Billing | `settings.billing_auto_draft` |
| Invoice â†’ Auto-issue paid invoices | Related PD-S6 / issue policy | Settings â†’ Billing | `settings.billing_auto_issue_paid` |
| Whole-home bundle discount (%) | Future pricing | Settings â†’ Pricing | `settings.bundle_discount_pct` |
| Signature required on job complete | PD-S4-03 | Settings â†’ Jobs | `settings.signature_required_on_complete` |

**Alias note:** Slice 6 A2 already ships runtime `payment_invoicing.*` flags (Checkout, offline, refunds, recon, auto-send, auto-charge). Next-phase Billing settings above are **additive typed keys**; map or migrate carefully â€” do not silently enable auto-send/charge.

---

## 6. Agent-driven regression suite (after S6)

- Replay ~50 real anonymized jobs (CSV fixtures) through synthetic Office â†’ Tech â†’ Customer flows (Playwright + Ash-trace).
- Randomized fuzz: quote revision, CO propose/approve, make-safe.
- Stripe **sandbox** charge / refund / dispute simulation (never live customer money).
- Daily GitHub Action `nightly-regression` on `main`.

---

## Merge & deploy rules (inherits delegated authority)

1. Three-round peer review (remediate to APPROVE/PASS).  
2. **Auto-merge** on CI green (Category C / exact-head discipline retained in git history).  
3. A3: migrations â†’ synthetic prod validation (**no real-customer mutations**) â†’ Hostinger when UI changed.  
4. PASS â†’ auto-continue next priority; FAIL on money/auth/integrity â†’ escalate (policy #6).

**Founder interrupts only for:** scope changes, new payment rails, or breaking PD/Security invariants.

## Explicit non-starts without Major Decision

- Invoice auto-send / auto-charge **ON** for real customers  
- Saved-card vault / customer portal / Terminal  
- Destructive schema / historical financial rewrite  
- New payment providers  

