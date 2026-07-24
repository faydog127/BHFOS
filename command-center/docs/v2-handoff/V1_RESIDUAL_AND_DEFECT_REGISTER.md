# V1 Residual and Defect Register (Consolidated)

Consolidated from slice residual registers, UX residuals, UAT log, and this-session drift. **Not closed merely by omission in later docs.**

| Residual ID | Title | Capability | Severity | Status | Source | Prod impact | Fixed in source? | Applied? | Deployed UI? | Prod validated? | Relevant to V2? | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DRIFT-UI-01 | Hostinger UI behind main (UX-POLISH + UXV2) | Shell/UX | High | **Open** | build-info vs `origin/main` | Prod missing TVG brand, Hub rewrite, Invoices bottom nav, synth hygiene UI | Yes (main) | N/A | **No** | N/A | **Yes** | Deploy Matrix S or accept lag |
| R-S5-08 | Admin write-off RPC/UI absent | Invoices | Medium | Deferred | S5 residual | Cannot write-off via canonical UI/RPC | No | No | No | No | **Yes** | V2 or authorized S5 residual |
| R-S4-03 | Customer-token change-order approval UI absent | Change orders | Medium | Open | S4 residual | Approval may be office-only / incomplete | Partial | Partial | Unknown | Incomplete | **Yes** | V2 field UX |
| R-COH-08 | Dual quote writers (Edge + RPC) | Quotes | Medium | Accepted residual | S1–S3 residual | Alternate paths remain | Mitigated | Yes | Yes | Partial | **Yes** | Harden in V2 |
| R-COH-12 | Superseded quotes in main list | Quotes | Low | Open | UI defects | List noise | No | No | No | No | Yes | UX polish |
| R-COH-09 | ProposalBuilder secondary writer reachable | Quotes | Low | Accepted | UI defects | Legacy path | No | No | Yes | Partial | Yes | Remove/gate |
| ALT-INV-01 | `invoice-save` Edge still in source as alternate writer | Invoices | High | **Open (source)** | functions/invoice-save | Risk if routed | No deny-all | Unknown deploy | Unknown | **Unresolved** | **Yes** | Verify deny/retire |
| R-S4-07 | tenant_id stamp residue | Architecture | Low | Accepted | S4 residual | Single-company residue | N/A | Yes | Yes | Yes | Yes | Document only |
| R-S5-04 | Grandfathered invoices incomplete lineage | Invoices | Low | Open | S5 residual | Reporting lineage gaps | No | N/A | N/A | Partial | Yes | Analytics care |
| R-S5-07 | Auto-draft soft-fail depends on event insert | Invoices | Medium | Open | S5 residual | Missed draft possible | Partial | Yes | Yes | Partial | Yes | Monitor |
| R-S6-UX-01 | Billing & Payments UX rough | Settings | Low | Open | S6 residual | Founder friction | No | N/A | Yes | Partial | Yes | UXV2/Settings |
| R-S8-BUNDLE-01 | Photo Bundles product missing | Media | Info | Deferred | S8 residual | No customer bundles | N/A | N/A | N/A | N/A | Yes (deferred) | Do not treat as V1 defect |
| R-S8-ANALYTICS-01 | Full analytics RPC suite missing | Analytics | Low | Open | S8 residual | Thin dashboard | Partial | Partial | Yes | Partial | Yes | V2 analytics |
| R-UX-01/06 | EnterpriseLayout double chrome | Shell | Medium | Open | UX-REFACTOR residual | Split chrome on some routes | Partial | Partial | Partial | Partial | Yes | Chrome sweep |
| R-UXP-01 | PWA installability | Install | Info | Deferred | UX-POLISH residual | No install prompt product | N/A | N/A | N/A | N/A | Deferred | UX-PWA |
| R-UXP-03 | QuickBooks staging invoice sync audit | QB / money | Medium | Open | UX-POLISH residual | Possible external contamination | N/A | N/A | N/A | **Unresolved** | **Yes** | Founder/ops audit |
| R-UXP-04 | Synth data DB backfill | Hygiene | Medium | Open | UX-POLISH residual | Unflagged synth may remain | Client helper on main only | DB no | UI no | Partial | **Yes** | Pattern filter + optional backfill |
| SEC-DEFINER-01 | Historical `current_user` bypass | Security | High | **Remediated** | S8 hotfix `20260723201000` | Was privilege skip | Yes | Applied (doc+mig tip) | N/A | PASS (doc) | Carry lesson | Keep tests |
| GRANT-01 | Widened EXECUTE / PUBLIC grants class | Security | High | Mitigated in S8 migrations | S8 remediation | Over-exposure risk if regressed | Yes | Applied (doc) | N/A | PASS (doc) | **Yes** | Continuous audit |
| SYNTH-KPI-01 | Prod UI lacks shared excludeSynthetic on money lists | Hygiene | High | **Open on prod** | UX-POLISH/UXV2 undeployed | Synth can pollute prod KPIs/lists | Yes on main | N/A | **No** | Observed gap | **Yes** | Deploy polish/v2 UI |
| LEAD-DRAWER-01 | Leads drawer race / stage warnings | Leads | Medium | Fixed on main | UX-POLISH | Prod tip may still have race | Yes | N/A | **No** | Unverified on prod tip | Yes | Deploy |
| PROC-LEDGER-LOCK | PowerShell ledger harness flake | CI | Low | Open | S4 residual | CI noise | Partial | N/A | N/A | N/A | Process | Keep watch |
| HALT-S7 | Slice 7 not started | Scheduling product | Info | Deferred | Ledgers | N/A | N/A | N/A | N/A | N/A | Deferred | Not a V1 defect |
| HALT-AUTOCHARGE | Auto-charge disabled | Payments | Info | Policy | S6 | Correct posture | Yes | Yes | Yes | Doc PASS | Carry | Do not enable casually |

## Bug-class reconciliation

| Bug class | Finding |
| --- | --- |
| Widened EXECUTE grants | Addressed in S8 remediation migrations (documentary + tip match); live ACL not re-queried |
| SECURITY DEFINER auth gaps / `current_user` | Hotfixed in `20260723201000` (checksum match) |
| Alternate writer denials | Estimates INSERT deny; work-order-update payment deny; **invoice-save still present in source** |
| Text/UUID mismatches | R-S4-06 remediated |
| Stale schema / missing columns | Ongoing risk — treat UNKNOWN without live schema diff |
| Trigger bleed | S3 neutralized accepted/paid quote triggers (doc) |
| Invoice-on-complete boundary | Auto-**draft** on complete (S5); auto-send OFF |
| Stale route names | Work Orders vs jobs entity residual accepted |
| Frontend secrets | No `sk_live` in source search |
| Hostinger/repo drift | **Confirmed this session** (DRIFT-UI-01) |
| Prod ahead of source | **Not observed** for UI; DB tip matches repo tip name |
| tenant_id assumptions | Residue accepted |
| Pricebook mutation risk | Requires ongoing discipline; no new finding this session |
| Synthetic contamination | Client hygiene undeployed; QB audit open |
| Unknown lead stages / drawer | Fixed on main; prod tip unverified |
| Misleading UI labels | Dual vocab residual R-COH-06 |
| Incomplete mobile acceptance | S8 mobile PASS; full offline app incomplete |
| Offline queue eviction | R-S8-02 mitigated; full offline deferred |
| QuickBooks contamination | R-UXP-03 open |
| Visual/UX acceptance incomplete | UXV2 on main undeployed; Percy scaffold token-gated |
