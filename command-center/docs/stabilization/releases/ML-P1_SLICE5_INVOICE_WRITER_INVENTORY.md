# ML-P1 Slice 5 — Invoice Writer Inventory (revalidated)

| Field | Value |
| --- | --- |
| Planning base | `e9cc3317fcb9c84f44643700927699f40c7f1a93` |
| Revalidated | 2026-07-23 against current main source |
| Rule | Inventory alone is not closure — each row has exactly one disposition |

| # | Writer | Surface | Disposition | Closure evidence required |
| --- | --- | --- | --- | --- |
| 1 | **`ml_p1_s5_invoice_create`** (new) | RPC | **Canonical** | Migration + tests + I2 (coding auth later) |
| 2 | **`ml_p1_s5_invoice_draft_update` / `issue` / `void`** (new) | RPC | **Canonical** | Migration + tests |
| 3 | Job-complete auto-draft hook (new, PD-S5-01 C) | SQL/Edge | **Canonical companion** | Creates **draft only**; never send |
| 4 | Edge `invoice-save` | Edge/UI | **Convert to call canonical** | Bridge or deny free-form create; draft edit only via S5 rules |
| 5 | `InvoiceBuilder.jsx` | Frontend | **Convert** | Calls S5 RPC / bridged edge; `final` only |
| 6 | `work-order-update` create/ensure invoice | Edge | **Denied + source-guarded** | Keep `ML_P1_S4_INVOICE_ON_COMPLETE_ENABLED=false`; extend deny to payment-ensure create |
| 7 | `work-order-update` `syncInvoiceForPayment` create branch | Edge | **Denied + source-guarded** | Settlement stays S5b |
| 8 | `kanban-move` `getOrCreateInvoiceForJob` | Edge | **Denied + source-guarded** | `ML_P1_S4_INVOICE_PATH_DENY` confirmed on main |
| 9 | Quote-accept draft invoice trigger branch | SQL | **Denied + source-guarded** | Keep `auto_create_draft_invoice_on_acceptance=false` |
| 10 | `MyMoney.jsx` / legacy direct inserts | Frontend | **Denied + source-guarded** | Client deny + RPC-only path |
| 11 | `send-invoice` | Edge | **Convert** | Delivery after issue; no amount mutation |
| 12 | Offline/Stripe settlement writers | SQL/Edge | **Approved exception (S5b)** | Out of S5 coding |
| 13 | `public-pay` / public-invoice | Edge | **Approved exception** | Read / provider pointers only |
| 14 | `process_public_payment` mock | SQL/service | **Denied + source-guarded** | Legacy mock |
| 15 | Job/quote payment→invoice sync triggers | SQL | **Denied + source-guarded** | Invoice settlement ≠ quote/job payment patch |
| 16 | `money-loop-delete` invoice cleanup | Edge | **Approved exception** | Admin/ops only |
| 17 | Discount helpers | SQL | **Convert or deny** | Draft-only via canonical rules |
| 18 | Test/smoke admin inserts | Tests | **Approved exception** | Synthetic/test-only |
| 19 | Stale UI “prepares draft invoice” copy | UI | **Remove / rewrite** | Align to hybrid draft + office issue |

## Residual create risks (close in coding — not this PR)

1. Payment-field patch on `work-order-update` still able to ensure/create invoice.  
2. Direct authenticated inserts into `invoices` if RLS allows.  
3. Re-enabling `auto_create_draft_invoice_on_acceptance`.  
4. Accidental auto-`sent` if issue wired into complete path.
