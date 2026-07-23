# Decision Packet — ML-P1 Slice 6 (Stripe settlement & payment posting)

| Field | Value |
| --- | --- |
| Disposition | **SLICE6_A2_CODING** (PD-S6-01…07 as recommended; Category-C coding auth 2026-07-23) |
| Coding base SHA | `6b300e40747cfceaf743b264d9f58bf7eede079a` |
| Branch | `ml/p1-s6-stripe-settlement` |
| Coding | **Authorized** — A2 SOURCE; **no A3** secret rotate / webhook live-attach / auto-charge enable |

## Purpose

Safe Stripe settlement and payment posting on issued invoices, proving one canonical paid writer (G-09), without enabling automatic card charges.

## Live baseline (2026-07-23)

| Fact | Evidence |
| --- | --- |
| `payments_mode` | `stripe` |
| Invoices | 25 · paid status 9 · provider_payment_id 9 · amount_paid>0 10 |
| Spine | `public-pay` → Checkout → `payment-webhook` → `record_stripe_webhook_payment` |
| Offline | `record_offline_manual_payment` present |
| Refunds in webhook | Explicitly ignored today |

---

## Product decisions (DRAFT — recommended for Founder Category-C)

### PD-S6-01 — Stripe account linkage & secrets → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Single TVG Stripe account; secrets only in Edge/env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); no Stripe Connect; no client-publishable charge keys in Vite |
| B | Stripe Connect / multi-account |
| C | Move secrets into DB config UI |

**Recommend A.** Matches live spine and single-tenant.  
**Escalate if:** Connect, multi-region accounts, or client-side secret exposure.

### PD-S6-02 — Capture / settlement flow → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Manual collection only: customer opens pay link → Stripe Checkout → **immediate capture**; office may post offline payment; **no** scheduled capture; **no** auto-charge on issue/send |
| B | Auth-then-capture (manual capture queue) |
| C | Auto-charge saved cards on invoice issue / schedule |

**Recommend A.** Preserves current Checkout `mode: payment`.  
**Major Decision #3 if choosing C** (auto-charge ON).  
**Escalate if:** B introduces new customer-visible hold behavior without prior HCP parity.

### PD-S6-03 — Payment-method storage → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | **None** — hosted Checkout only; do not vault cards; do not persist PaymentMethod IDs for reuse |
| B | Stripe Customer + optional saved PM for office-initiated reuse |
| C | Customer portal vault + field Terminal |

**Recommend A** for this slice (PCI surface stays at Stripe-hosted).  
**Major Decision #2/#5 if B/C** (net-new flows / PCI scope).

### PD-S6-04 — Refund / dispute surfaces → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Office-initiated **full and partial refunds** via canonical refund RPC → Stripe API → ledger; `charge.dispute.*` / unmatched refund webhooks → **quarantine task** (no silent rewrite); no auto-refund |
| B | Full dispute/chargeback product automation |
| C | Defer all refunds again |

**Recommend A** (roadmap required refunds; disputes = human queue).  
**Escalate if:** automatic refunds to customers without office action.

### PD-S6-05 — Invoice state × payment → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | `draft` → `sent` (S5) → `partially_paid` (optional) → `paid`; **only** canonical paid/refund writers mutate settlement fields; unpaid void remains S5 rules; paid invoices are not voided in-place (refund path instead) |
| B | Allow free UI status toggles to `paid` |
| C | Collapse partial into `sent` forever |

**Recommend A.** Proves G-09 / KI-07.  
**Escalate if:** historical status rewrite of the 25 grandfathered invoices.

### PD-S6-06 — Field / customer payment UX → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Customer: existing `/pay/:token` → Checkout; Office: send pay link + Record Payment (offline); Technician: **view balance / copy pay link only** — no card entry on tech device |
| B | In-app Stripe Elements on CRM/tech |
| C | Stripe Terminal / tap-to-pay in field |

**Recommend A.**  
**Major Decision #2 if B/C.**

### PD-S6-07 — Reporting / reconciliation → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Prove single paid writer; office recon view of mismatches; retain/use `provider_payment_observations` + webhook quarantine tasks; daily/on-demand sweep; export-ready settlement fields — **no** new QB product ownership |
| B | Expand QuickBooks as system of record for settlement |
| C | External data warehouse pipeline |

**Recommend A.**

---

## Explicit non-scope (S6)

Autonomous follow-up / dunning journeys (**S7**) · Braintree · autopay · auto-charge · visual workflow builder · multi-tenancy · TIS · G2.3 · invoice create (S5) · pricebook · historical financial rewrite.

## Escalation digest (Founder sign-off required)

| Trigger | Policy # | Packet impact |
| --- | --- | --- |
| Auto-charge / scheduled charge ON | ③ | Reject PD-S6-02 C without Founder |
| Customer portal / saved cards / Terminal | ②⑤ | Reject PD-S6-03 B/C, PD-S6-06 B/C without Founder |
| PCI Elements on our origin | ⑤ | Architecture halt |
| Drop columns / rewrite paid history | ④ | Forbidden in S6 migrations |
| Prod money FAIL unfixable | ⑥ | Halt A3 |

## Coding gate

After this planning PR is CI-green and Founder grants **Category-C** on exact head: open coding branch `ml/p1-s6-stripe-settlement` from that SHA.  
**This planning PR must not be treated as coding auth. Do not merge to advance A2 without Category-C** (Founder instruction 2026-07-23).

## Supersedes

Informal “S5b next” ledger wording; aligns slice number with Delegated-Authority Policy (S6 = Stripe, S7 = follow-up).
