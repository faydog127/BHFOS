# Regression Ledger (Integrity Issues + Retests)

Objective: keep a running history of integrity issues, fixes, and validation status.

Usage:
- Append a new row when an issue is found.
- Update status + validation `run_id` when retested.
- If an issue reappears, mark `Reopened=YES` and add a new row (do not overwrite history).

---

## Ledger (append-only)

| Issue ID | Date Found | Source | Summary | Severity | Fix Packet | Validation run_id | Current Status | Reopened? | Notes |
|---|---:|---|---|---:|---|---|---|---|---|
|  |  | ULSIA / RVH / manual / prod-incident |  | P0/P1/P2/P3 | `docs/handoff/<...>.md` | `rvh_...` | New / Needs Triage / Blocked / Accepted / In Progress / Ready for Validation / Validated-Local / Validated-Staging / Released / Closed | YES/NO |  |
| ISSUE-OPS-P1-2026-04-16-001 | 2026-04-16 | RVH | Quote→Job trigger referenced `jobs.estimate_id` (non-canonical + missing col) causing quote approval to fail and block dispatch | P1 | `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-001_jobs_estimate_id.md` | `rvh_p1-b_20260416_003449_492938` | Validated-Local | NO | Fixed by overriding active quote→job trigger function to remove `estimate_id` from `public.jobs` insert path (keeps `quote_id` canonical). |

---

## Field notes

- **Issue ID**: stable identifier used in fix packets and tickets.
- **Source**: where it was discovered (ULSIA, RVH, manual, prod incident).
- **Fix Packet**: link to the remediation packet (template: `docs/handoff/FIX_PACKET_TEMPLATE.md`).
- **Validation run_id**: required for closing P0/P1 work when RVH is applicable.
- **Current Status**: must match the issue intake spec statuses (`docs/operations/ISSUE_INTAKE_SPEC.md`).
