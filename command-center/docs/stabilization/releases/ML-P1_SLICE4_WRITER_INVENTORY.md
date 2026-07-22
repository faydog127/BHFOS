# ML-P1 Slice 4 — Writer Inventory (closure dispositions)

Control amendment §6: inventory alone is not closure. Each writer has exactly one disposition.

| Writer | Surface | Prior authority | Disposition | Closure evidence |
| --- | --- | --- | --- | --- |
| `ml_p1_s4_job_transition` | RPC | New canonical | **Canonical** | Migration `…221210…` / `…221300…` |
| `ml_p1_s4_assign_and_schedule` | RPC | New canonical | **Canonical** | Migration `…221210…` |
| `ml_p1_s4_upsert_evidence` | RPC | New canonical | **Canonical** | Migration `…221210…` |
| `ml_p1_s4_record_make_safe` | RPC | New canonical | **Canonical** | Amendment migration |
| `ml_p1_s4_change_order_*` | RPC | New canonical | **Canonical** | Migrations |
| `ml_p1_s4_correct_time_event` | RPC | New canonical | **Canonical** | Amendment migration |
| `ml_p1_s3_ensure_job_for_accepted_quote` | RPC | S3 create | **Retained approved exception** (create/lineage only; sets S4 writer context on update) | `…221220…` |
| `sync_job_schedule_from_appointment` | Trigger | Schedule mirror | **Retained approved exception** (schedule promote only; sets writer context) | Schema migration |
| `work-order-update` status/schedule/tech | Edge | Legacy | **Denied + source-guarded** (409 `ML_P1_S4_USE_CANONICAL_WRITER`) | Edge + unit test |
| `work-order-update` invoice-on-complete | Edge | Legacy bleed | **Denied + source-guarded** (`ML_P1_S4_INVOICE_ON_COMPLETE_ENABLED=false`) | Edge + unit test |
| `jobService.updateWorkOrder` | Client | Facade | **Converted** to call S4 RPCs for execution fields | `jobService.js` |
| `jobService.updateWorkOrderLocally` | Client | Direct `jobs.update` | **Denied + source-guarded** (throws `ML_P1_S4_ALT_WRITER_DENY`) | `jobService.js` |
| `jobService.completeJob` | Client | Edge complete+invoice | **Converted** to S4 completeFinalize (no invoice) | `jobService.js` |
| `Jobs.jsx` / `Schedule.jsx` / `TechDashboard` / orphan `JobCompletionWizard` | UI | Via jobService | **Converted** (through jobService→S4); orphan wizard not routed | Route inventory |
| `TechJobExecutionPanel` / `OfficeJobExecutionPanel` | UI | New | **Converted** (direct S4 service) | Components |
| `kanban-move` job→completed | Edge | Direct admin update | **Denied + source-guarded** (409 canonical writer) | `kanban-move/index.ts` |
| `kanban-move` job→invoice_open / getOrCreateInvoice | Edge | Invoice create | **Denied + source-guarded** (`ML_P1_S4_INVOICE_PATH_DENY`) | `kanban-move/index.ts` |
| Direct authenticated `jobs` status/tech/schedule/money UPDATE | DB | RLS UPDATE | **Denied + protected** by `trg_ml_p1_s4_guard_job_execution_write` | Schema migration |
| Change-order writers (pre-S4) | — | None | N/A (did not exist) | Architecture findings |

No frontend or legacy path remains an independent authoritative execution writer.
