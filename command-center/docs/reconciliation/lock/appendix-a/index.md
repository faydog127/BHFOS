# Appendix A - Lock Index

## Status

- Current State: `IN PROGRESS`
- Lock Date: `TBD`
- Lock Version: `v0.1.0-draft`
- Checklist Companion: [A_LOCK_CHECKLIST.md](/c:/BHFOS/command-center/docs/reconciliation/A_LOCK_CHECKLIST.md)

## Critical Path Manifest

All files below must exist and be non-empty for lock integrity.

## Verification Artifacts

- [EV-2026-03-18_money-loop-smoke.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-03-18_money-loop-smoke.md)
- [EV-2026-03-18_automation-run.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-03-18_automation-run.md)
- [EV-2026-03-18_manual-ux.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-03-18_manual-ux.md)
- [EV-2026-03-18_flow-trace_quote-job-invoice-payment.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-03-18_flow-trace_quote-job-invoice-payment.md)
- [EV-2026-04-04_P0-01_tenant-isolation-lock.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-01_tenant-isolation-lock.md)
- [EV-2026-04-04_P0-02B_offline-manual-payment-writer.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02B_offline-manual-payment-writer.md)
- [EV-2026-04-04_P0-02C_payment-webhook-rebuild.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02C_payment-webhook-rebuild.md)
- [EV-2026-04-04_P0-02D_public-pay-initiation-boundary.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02D_public-pay-initiation-boundary.md)
- [EV-2026-04-04_P0-02E_reconciliation-tools.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02E_reconciliation-tools.md)
- [EV-2026-04-05_phase-0-snapshot_local-proof.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-05_phase-0-snapshot_local-proof.md)
- [EV-2026-04-08_billing-ledger-race-soak.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-08_billing-ledger-race-soak.md)
- [EV-2026-04-08_layer2_orchestrator-v2_observed_judgment.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-08_layer2_orchestrator-v2_observed_judgment.md)

## Decision Records

- [DR-2026-03-18_job-state-doctrine.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/decisions/DR-2026-03-18_job-state-doctrine.md)
- [DR-2026-03-18_send-estimate-scope.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/decisions/DR-2026-03-18_send-estimate-scope.md)

## Snapshots

- [SN-2026-03-18_schema-snapshot.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/snapshots/SN-2026-03-18_schema-snapshot.md)
- [SN-2026-03-18_event-sample-log.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/snapshots/SN-2026-03-18_event-sample-log.md)
- [SN-2026-03-18_appendix-a-lock-summary.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/snapshots/SN-2026-03-18_appendix-a-lock-summary.md)

## Contracts

- [CT-2026-03-18_appendix-a-interface-contract.md](/c:/BHFOS/command-center/docs/reconciliation/lock/appendix-a/contracts/CT-2026-03-18_appendix-a-interface-contract.md)

## Notes

- Schedule trust chain is green locally and live.
- Automation timing is now materially evidenced:
  - shared backend business-hours helper exists
  - follow-up task `due_at` normalization is proven locally
  - invoice reminder ladder behavior is proven locally end to end
  - quote reminder behavior is proven locally end to end
  - appointment reminder backend + Schedule/UI flows are now locally proven end to end
  - global business-hours enforcement across invoice, quote, and appointment reminder lanes is now locally proven
  - formal lock evidence capture and non-local validation are still separate remaining steps
- Appendix A remains unlocked because formal evidence-pack completion, minimum event doctrine, truth-pass documentation, and governance decisions are still open.
- Automation/business-hours is no longer a missing implementation lane; it is now a lock-stage verification and documentation lane.
- `send-estimate` scope is still unresolved for A-LOCK and remains a blocking decision.
