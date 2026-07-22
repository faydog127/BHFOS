# Remediation Review — ML-P1 Slice 4 R-S4-06 (emit actor_id uuid)

Frozen head: "b6118c83aecf6c3c22985bf28b2d4045afa80e9a"  
Migration: `20260722140000_ml_p1_s4_emit_actor_id_uuid.sql`  
SHA-256 (LF): `6F13129B4F934E48C165CB1390828AD9FF4A61E44FB29F15442732897531F776`

## Consensus

# **REMEDIATION_REVIEW_PASS**

| Lane | Verdict | Notes |
| --- | --- | --- |
| Product | PASS | No product-scope change; restores office assign/tech audit path |
| Data | PASS | `events.actor_id` typed correctly; nullable system convention preserved |
| Security | PASS | No free-form text→uuid cast; auth.uid() only; fail-closed on audit error |
| Financial Control | PASS | Invoice gating untouched; no money writers added |
| Architecture | PASS | Single helper fix; all S4 job audits already route through emit |
| Adversarial | PASS | Regression tests cover emit, time events, S3 NULL actors, no OTHERS swallow |

## Required post-merge gates (authorized)

1. Apply migration to production  
2. I2 verify function body uses uuid actor  
3. Re-run authenticated synthetic E2E  
4. Cleanup + aggregate proof  
