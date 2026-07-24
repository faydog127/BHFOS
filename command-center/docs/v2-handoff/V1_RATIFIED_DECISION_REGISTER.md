# V1 Ratified Decision Register

Only decisions with packet / production-enforced evidence. Proposals not listed as ratified.

| Decision ID | Plain language | Source | Implementation | Production confirmation | Reversible? | Carry to V2? | Re-ratify for V2? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH-TVG-DEDICATED | Dedicated single-company TVG deployment (not multi-tenant SaaS) | Operating model + ML-P1 packets | Hostinger + Supabase project `wwyxohjnyqnegzbxtuxs` | Live app + project refs | Hard | **Yes** | Confirm boundary only |
| ARCH-TENANT-RESIDUE | `tenant_id` stamping remains as residue in single-company deploy | R-S4-07 | Columns/filters still present | Documentary | Soft | Yes (as residual) | No unless multi-tenant revived |
| PD-S3-ONE-JOB | Exactly one canonical job per accepted quote (idempotent) | Slice 3 / PR84 packet | `ml_p1_s3_ensure_job_for_accepted_quote` | S3 validation PASS (doc) | Hard | **Yes** | No |
| PD-S2-LIFECYCLE | Quote lifecycle via server authz RPC; public approve token path | S2 packets | `ml_p1_s2_quote_lifecycle`, `ml_p1_s2_quote_approve_public` | Doc + Edge present | Medium | **Yes** | No |
| PD-S4-01 | Make-safe only; no billable expansion without approved change order | S4 decision packet | S4 RPCs / controls | S4 PASS (doc) | Medium | **Yes** | No |
| PD-S4-06 | Billable changes need customer approval; office break-glass audited | S4 decision packet | Change-order gates | Partial (UI residual R-S4-03) | Medium | **Yes** | UI path may need V2 |
| PD-S4-COMPLETE | Job completion gated by readiness / evidence rules | S4/S5 | Completion RPCs + S5 auto-draft | Doc | Medium | **Yes** | No |
| PD-S5-01 | One canonical final invoice per completed job; draft then explicit issue; never auto-issue/auto-send | S5 decision packet | `ml_p1_s5_invoice_*` | S5/S6 PASS (doc) | Hard | **Yes** | No |
| PD-S5-04 | Issued invoice financials freeze (snapshot) | S5 packet | Issue RPC immutability | Doc | Hard | **Yes** | No |
| PD-S5-05 | Void: office/manager/admin + reason + audit; write-off: admin-only | S5 packet | Void RPC; write-off **deferred** | Void yes; write-off no | Medium | **Yes** | Write-off needs V2 build |
| PD-S5-06 | Unpaid issued invoices immutable; correct via void+reissue | S5 packet | Issue/void RPCs | Doc | Hard | **Yes** | No |
| PD-S5-07 | Grandfather existing invoices; no historic rewrite | S5 packet | Policy | Doc | Soft | **Yes** | No |
| PD-S5-VOCAB | Invoice status vocabulary as S5 enums | S5 schema migration | DB constraints | Doc | Medium | **Yes** | No |
| PD-S6-02 | Hosted Checkout + offline record only; no scheduled capture / auto-charge | S6 packet | Flags + assert deny | S6 PASS (doc); **not re-queried this session** | Hard | **Yes** | Enabling = Major Decision |
| PD-S6-03 | No saved cards / vault / stored PaymentMethod IDs | S6 packet | Absent features | Source search clean | Hard | **Yes** | Major Decision to add |
| PD-S6-06 | Customer pay link + office offline; techs cannot enter cards; no Terminal | S6 packet | public-pay; no Terminal code | Doc + source | Hard | **Yes** | Major Decision to add |
| PD-S6-05 | Paid path uses refund; unpaid void per S5; recon for disputes | S6 packet | refund + recon queue | S6 PASS (doc) | Medium | **Yes** | No |
| PD-S6-07 | Reconciliation canonical; no new QuickBooks ownership in S6 | S6 packet | recon queue | Doc | Soft | Yes | QB expansion = Major |
| PD-S6-PARTIAL | Partial payment / status handling via settlement writers | S6 closeout | payment writers | Doc | Medium | **Yes** | No |
| PD-S8-INSPECT | Mobile inspection checklist + evidence gates | S8 packets | S8 RPCs + hotfix | S8 remediation PASS | Medium | **Yes** | Photo Bundles separate |
| PD-S8-CACHE | Offline cache baseline ~250MB budget | R-S8-02 | Client cache | Mitigated (doc) | Soft | Yes | Revisit for full offline |
| PHOTO-RETAIN | Photo retention / voided photo rules from inspection hardening | Phase migrations | Storage + guards | Doc | Medium | Yes | Bundles deferred |
| ANALYTICS-BOUND | Analytics thin; not full finance OS | R-S8-ANALYTICS-01 | Reporting pages | Partial | Soft | Yes | Expand = V2 scope |
| HALT-S7 | Slice 7 deferred — do not start | State ledgers | N/A | Policy | Soft | Carry as deferred | Founder to open |
| HALT-AUTOCHARGE | Auto-charge OFF; setter refuses ON | S6 migration + auth interrupt | `ml_p1_s6_assert_auto_charge_off` | Doc | Hard | **Yes** | Major Decision |
| HALT-AUTOSEND | Invoice auto-send OFF by default | S6 flags | `invoice_auto_send_enabled=false` | Doc | Hard | **Yes** | Major Decision |
| HALT-PWA | Full PWA not authorized in polish slices | UX-POLISH / UXV2 | N/A | Policy | Soft | Deferred | Founder to open |
| BRAND-TVG | Product name **TVG CRM** (Founder-locked for polish) | UX-POLISH / UXV2 | `productBrand.js` on main | **Not on prod UI** (still BHF CRM) | Soft | **Yes** | Deploy still Matrix S |

## Explicitly NOT ratified as V1 complete

| Topic | Status |
| --- | --- |
| Photo Bundles product | Deferred |
| Admin write-off RPC/UI | Deferred (R-S5-08) |
| Customer change-order token UI | Open residual (R-S4-03) |
| Multi-tenant SaaS | Out of architecture |
| Native iOS/Android | Deferred |
| AI/voice agent operations | Deferred |
