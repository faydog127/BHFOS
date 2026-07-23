# Evidence Manifest — ML-P1 Slice 8 A2 (inspection workflow)

| Field | Value |
| --- | --- |
| Authorized scope | Inspection workflow A2 (PD-S8 ratified; photo-bundles deferred) |
| Coding base SHA | `28e8290a69773cda146cac083971700778db1db7` |
| Branch / worktree | `ml/p1-s8-inspection-workflow` / `F:\Dev\BHFOS-ml-p1-s8` |
| Migration | `20260723160000_ml_p1_s8_inspection_checklist.sql` |

## Delivered

- Checklist templates + responses with structured flags  
- Offline media queue 250 MB enforce/evict  
- Photos-first wave + `ml_p1_s8_assert_photos_before_report`  
- Photo `retain_until` (+24 months)  
- Tech checklist step; CRM open-flag badges; Analytics nav alias  

## Tests

`node --test tests/unit/ml-p1-s8-inspection.test.mjs`

## Explicit non-claims

No photo-bundle product · no Stripe · no S7 · no A3 until peer review + CI · no TIS merge.
