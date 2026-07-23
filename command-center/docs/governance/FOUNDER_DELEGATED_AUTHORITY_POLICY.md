# Founder Delegated-Authority Policy — ML-P1

| Field | Value |
| --- | --- |
| Version | v2026-07-23 |
| Supersedes | v2026-07-22 |
| Authority | Founder Erron |
| Scope | ML-P1 S5 → S N + residuals + [Next-Phase Priorities](./ML-P1_NEXT_PHASE_PRIORITIES.md) |

## Purpose

Preserve Founder focus: Orchestrator finishes authorized slices end-to-end. Escalate **only** for Major Decisions.

## Continue-automatically when

- Peer-review lanes return APPROVE or PASS after remediation.
- Migration checksums match the frozen SHA in the apply packet.
- Synthetic production-validation PASS with **no real-customer mutations**.
- Work stays inside ratified PD packets, this policy, or Next-Phase Priorities.

## Escalate (prompt Founder) only when

1. Pricing or discount **changes > ±3 %** on any active service.
2. Introducing net-new customer-facing flows (e.g. portal, autopay).
3. Turning **invoice auto-send or auto-charge** *ON* for real customers.
4. Any schema migration that **drops columns / tables** or rewrites historical financial data.
5. External contract, regulatory, or data-residency implications.
6. A production validation **FAIL** that impacts money, auth, or data integrity and cannot be hot-fixed safely.
7. Aggregate estimated cost > 4 dev-days or third-party spend > $300.
8. **Scope change**, **new payment rails**, or **breaking PD/Security invariants**.

## Default for non-major questions

Choose the option that maintains consistency with HCP, reduces re-work, and aligns with existing governance — **without asking**.

## Auto-continue pipeline (all future slices)

1. Open PR → **3-round peer review** → remediate to APPROVE/PASS.  
2. **Auto-merge on CI green** (retain exact-head match in merge command).  
3. A3: apply migrations → synthetic prod validation → Hostinger when needed.  
4. PASS → continue next priority; FAIL (money/auth/integrity) → escalate #6.  
5. Update `ML-P1_STATE_LEDGER.md` + evidence manifests every step.

## Next-phase order (post–S6)

See `ML-P1_NEXT_PHASE_PRIORITIES.md`: Mobile Inspections (S8) → Photo Bundles → Analytics → Global UX/IA → Settings typed UI → Nightly regression. S7 follow-up remains reserved.

## Binding non-defaults

- Do **not** enable invoice auto-send or auto-charge for real customers without escalation #3.
- Do **not** drop columns/tables or rewrite historical financials without escalation #4.
- S5/S6: auto-draft may exist; issue and charge remain explicit / gated OFF by default.

## Precedence vs Access Matrix S

When this policy’s auto-continue pipeline conflicts with `PRODUCTION_ACCESS_MATRIX.md` category **S**, or with a newer explicit Founder directive, follow **`ML-P1_AUTHORITY_PRECEDENCE.md`**.

Standing override for Slice 8 remediation (2026-07-23): auto-merge / auto-migrate / auto-deploy **suspended**; Major Decisions #6 and #8 apply; Founder must authorize production actions after evidence.
