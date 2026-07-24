# V1 Closeout — Round 2 (Security / Financial / Adversarial)

| Field | Value |
| --- | --- |
| Lens | Independent security & money adversarial |
| Date | 2026-07-24 |
| Verdict | **PASS with open risks** — posture documented; several items remain production-unverified this session |

## Checks

| Focus | Result |
| --- | --- |
| Auto-send / auto-charge | Documented OFF; live config not re-queried |
| Saved cards / portal / Terminal | Absent in source; policy OFF |
| Issued immutability / void path | Ratified + S5 RPCs; write-off incomplete |
| SECURITY DEFINER hotfix | In repo + migration tip match; live ACL not re-queried |
| Alternate writers | **`invoice-save` still in source** — adversarial must assume reachable until proven otherwise |
| Synthetic contamination | Client exclude on main only; prod KPIs vulnerable |
| QuickBooks | External sync audit unresolved |
| Historical preservation | Grandfathering ratified; no rewrite |

## Adversarial top risks for V2

1. Deploy UI hygiene without verifying Edge route denylist (`invoice-save`).  
2. Enable auto-send/auto-charge without Major Decision.  
3. Assume synth cannot reach Stripe/QB.  
4. Treat DEFINER grants as frozen without catalog audit.  
5. Expand QuickBooks before R-UXP-03.

## Residual security items that stay open

ALT-INV-01 · R-UXP-03 · SYNTH-KPI-01 · E-GAP-01/02/03/07 in evidence manifest.
