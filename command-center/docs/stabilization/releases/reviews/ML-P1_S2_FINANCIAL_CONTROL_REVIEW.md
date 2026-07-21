# ML-P1 Slice 2 — Financial Control Review

| Field | Value |
| --- | --- |
| Slice | ML-P1-S2 |
| Reviewer | _(Financial Control — fill)_ |
| Verdict | **PENDING** |

## Money-state controls

- Issued/approved content immutable in-place; revise = new version.
- Approval records amount + method + actor on quote row + audit event.
- Approve does **not** create job or invoice while gate is off (S2 stop before S3/S5).
- No Stripe / payment initiation in this slice.

## Residual financial risk

Until A3 applies the job-create gate in production, any approve path that writes `accepted`/`approved` in live DB may still auto-create jobs via current trigger — **do not enable customer approve against production until A3**.
