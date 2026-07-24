# V1 Production State Matrix

| Field | Value |
| --- | --- |
| Exact `origin/main` | `2557ba28490ae38970b3a32de95130746a5b9333` |
| Production UI (`build-info.json`) | `c469f7c8174642f40ca60756c124dec63a80bb10` |
| Match? | **NO** — main is **13 commits ahead** of production UI |
| Production `migrationVersion` | `20260723201000` |
| Latest repo migration | `20260723201000_ml_p1_s8_definer_auth_hotfix.sql` |
| Migration tip match (filename ↔ build-info) | **YES** (application of row not re-queried live) |
| Supabase project | `wwyxohjnyqnegzbxtuxs` (documentary + prior evidence JSON) |

## Classification legend

PRODUCTION CONFIRMED · REPOSITORY CONFIRMED — PRODUCTION UNVERIFIED · SOURCE MERGED — NOT APPLIED · DEPLOYED — ACCEPTANCE INCOMPLETE · DEFERRED · DISABLED BY POLICY · RESIDUAL / DEFECT OPEN · UNKNOWN — REQUIRES FOLLOW-UP

## Capability matrix

| ID | Capability | Classification | Evidence notes |
| --- | --- | --- | --- |
| A | Lead intake + duplicate detection | DEPLOYED — ACCEPTANCE INCOMPLETE | Intake on prod UI tip; R2 contracts in repo; full duplicate E2E not re-run this session |
| B | Customer / service-location records | PRODUCTION CONFIRMED | Identity/property work closed in R1 docs; live app serves CRM shell |
| C | Quote create / issue / revise / approve / reject / expire | PRODUCTION CONFIRMED | S2/S3 closeouts + public/office paths in source; dual writers residual R-COH-08 |
| D | Public quote approval | PRODUCTION CONFIRMED | `public-quote-approve` + `ml_p1_s2_quote_approve_public` |
| E | Approved quote → canonical job | PRODUCTION CONFIRMED | S3 writer; one job per accepted quote |
| F | Scheduling / Calendar | PRODUCTION CONFIRMED | R3 + Calendar page on prod shell |
| G | Dispatch | PRODUCTION CONFIRMED | Dispatch is gold-sample UX on prod tip |
| H | Job execution statuses | PRODUCTION CONFIRMED | S4 status RPCs; Edge `work-order-update` denies status bypass |
| I | Time / mileage tracking | REPOSITORY CONFIRMED — PRODUCTION UNVERIFIED | S4 schema/RPCs; field E2E not re-run |
| J | Make-safe controls | PRODUCTION CONFIRMED | PD-S4-01; R-S4-05 remediated |
| K | Change orders + customer approval | DEPLOYED — ACCEPTANCE INCOMPLETE | Server gates present; R-S4-03 customer-token UI open |
| L | Completion readiness / job completion | PRODUCTION CONFIRMED | S4/S5 gates + auto-draft on complete |
| M | Inspections (office) | PRODUCTION CONFIRMED | S8 remediation PASS |
| N | Mobile inspection workflow | PRODUCTION CONFIRMED | Mobile E2E PASS in S8 remediation closeout |
| O | Offline inspection behavior | REPOSITORY CONFIRMED — PRODUCTION UNVERIFIED | Cache/offline helpers in source; R-S8-02 mitigated |
| P | Required photo evidence | PRODUCTION CONFIRMED | S8 evidence gates + hotfix |
| Q | Photo Bundles | DEFERRED | Explicit halt; not started |
| R | Pricebook | PRODUCTION CONFIRMED | S4 pricebook migrations applied (documentary) |
| S | Invoice draft creation | PRODUCTION CONFIRMED | S5 create/draft RPCs; auto-draft on complete |
| T | Invoice issue / void / write-off / corrections | DEPLOYED — ACCEPTANCE INCOMPLETE | Issue/void production; **write-off RPC/UI deferred** (R-S5-08) |
| U | Stripe Checkout | PRODUCTION CONFIRMED | Flag default ON; public-pay path; S6 E2E PASS (sk_test) |
| V | Stripe webhook settlement | PRODUCTION CONFIRMED | payment-webhook / stripe-webhook; S6 settlement hotfixes |
| W | Refund / dispute behavior | PRODUCTION CONFIRMED | Refunds ON; disputes → recon queue |
| X | Reconciliation queue | PRODUCTION CONFIRMED | recon flag ON |
| Y | QuickBooks | DEFERRED / RESIDUAL | No expansion ownership; R-UXP-03 sync audit open |
| Z | Analytics dashboard | DEPLOYED — ACCEPTANCE INCOMPLETE | Thin analytics; R-S8-ANALYTICS-01 open |
| AA | Settings › Billing & Payments | PRODUCTION CONFIRMED | Flags UI; R-S6-UX-01 rough edges open |
| AB | Training / synthetic-data handling | SOURCE MERGED — NOT APPLIED | Training Mode on prod tip; **`excludeSynthetic` hygiene is on main only (UX-POLISH/UXV2), not on prod UI** |
| AC | PWA installability | DEFERRED | UX-PWA unauthorized |
| AD | Offline job / media support | DEPLOYED — ACCEPTANCE INCOMPLETE | Partial offline cache; not full offline field app |
| AE | Commercial Account Manager | DEFERRED | Not V1 scope |
| AF | AI / voice workflows | DEFERRED / RESIDUAL | Partial inspection AI exists; voice agent ops not V1 product |

## Drift summary

| Layer | Production | `origin/main` | Drift |
| --- | --- | --- | --- |
| Frontend Hostinger | `c469f7c8174642f40ca60756c124dec63a80bb10` | `2557ba28490ae38970b3a32de95130746a5b9333` | Main ahead (UX-POLISH + UXV2) |
| Product name in shell | **BHF CRM** @ prod tip | **TVG CRM** | Undeployed brand fix |
| Hub first viewport | KPI strip (UX-REFACTOR era) | Today hero + KPI toggle (UXV2) | Undeployed |
| Mobile bottom nav | Hub · WO · Quotes · Inspections · More | Hub · WO · Quotes · **Invoices** · More | Undeployed |
| DB migration tip | `20260723201000` (build-info) | same filename tip | Aligned at tip name |
| Migrations newer than tip | none in repo | none | None |
