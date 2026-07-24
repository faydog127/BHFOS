# V1 Security and Financial Posture

| Field | Value |
| --- | --- |
| Project | `wwyxohjnyqnegzbxtuxs` |
| Prod UI | `c469f7c8174642f40ca60756c124dec63a80bb10` |
| Migration tip (build-info) | `20260723201000` |

Evidence labels: **P** production this session · **R** repository · **D** documentary · **U** unresolved this session

## Payment / portal controls

| # | Question | Answer | Evidence |
| --- | --- | --- | --- |
| 1 | Invoice auto-send enabled? | **Disabled by policy/default** | D: S6 closeout; R: `invoice_auto_send_enabled` default false; **U**: live `global_config` not re-queried |
| 2 | Auto-charge enabled? | **Disabled; setter refuses ON** | D+R: `ml_p1_s6_assert_auto_charge_off`; **U**: live flag not re-queried |
| 3 | Saved cards enabled? | **Disabled / not implemented** | R: no saved-card feature; D: PD-S6-03 |
| 4 | Customer payment portal? | **Disabled** (Checkout pay-link ≠ Stripe Customer Portal) | D: PD-S6-06; R: no portal product |
| 5 | Stripe Terminal / embedded card entry? | **No** | R: no Terminal; techs cannot enter cards |
| 6 | Raw card data in BHFOS? | **No by design** (hosted Checkout) | R+D |
| 7 | Issued invoices immutable? | **Yes (unpaid)** | D: PD-S5-04/06; R: issue RPC |
| 8 | Corrections after issue? | **Void + reissue** (unpaid); paid → refund path | D: PD-S5-06 / PD-S6-05 |
| 9 | Refund authority | Office/admin with audit when flag ON | D+R |
| 10 | Write-off authority | **Admin-only ratified; implementation deferred** | D: PD-S5-05; residual R-S5-08 |
| 11 | Synthetic excluded from live totals? | **On main yes; on prod UI no** | R: `excludeSynthetic` undeployed; P: prod tip lacks helper |
| 12a | Synth → customer communications? | **Risk remains if unflagged rows used in send paths** | U / inference |
| 12b | Synth → live Stripe? | **Should be blocked by process; not cryptographically enforced for all paths** | U |
| 12c | Synth → QuickBooks? | **Unresolved** (R-UXP-03) | U |
| 12d | Synth → live analytics/KPIs? | **Yes risk on prod UI** | P+R drift |
| 13 | Staging invoices synced externally? | **Unresolved Founder/ops** | U |

## SECURITY DEFINER / grants

| # | Question | Answer | Evidence |
| --- | --- | --- | --- |
| 14 | DEFINER functions granted to authenticated/anon/PUBLIC | **Many S8 helpers granted to `authenticated` (+ service_role); public approve to anon** | R: migrations `20260723200000`, `20260721170000`; **U**: live ACL |
| 15 | Independent JWT/role/tenant checks? | **Intended yes after hotfix** | D: S8 remediation PASS; R: `auth.role()='service_role'` replace `current_user` |
| 16 | Private helper accidentally exposed? | **`ml_p1_s8_assert_inspection_actor` still granted to authenticated in source** | R: noted in audit; confirm if intentional |
| 17 | Alternate writers remain? | **Yes in source**: quote draft direct inserts; `quote-update-status`; **`invoice-save`**; declined public path direct update | R |
| 18 | Financial writers idempotent + audited? | **Canonical S5/S6 RPCs claim yes**; alternate Edge paths weaker | R+D; U for all paths |
| 19 | Auth hotfixes in source and production? | Source tip = `20260723201000`; build-info migrationVersion matches; checksum matches closeout | R+P+D |
| 20 | Provisional RLS/GRANT/trigger posture? | **Some accepted residuals** (dual writers, tenant residue); not claimed fully frozen | D+R |

## High-risk open items for V2 inheritance

1. **Deploy lag**: money hygiene and brand fixes exist on `main` but not Hostinger.  
2. **`invoice-save` Edge**: treat as active risk until production routing proves retired/denied.  
3. **Write-off gap**: policy exists; product incomplete.  
4. **QuickBooks contamination**: unverified.  
5. **Live grant matrix**: not re-audited from database catalogs this session.
