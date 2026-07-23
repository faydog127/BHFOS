# ML-P1 Slice 5 — Planning Design (Completed Job → Invoice)

| Field | Value |
| --- | --- |
| Base SHA | `e9cc3317fcb9c84f44643700927699f40c7f1a93` |
| Branch | `plan/ml-p1-s5-invoice-generation` |
| Disposition | **SLICE5_PLANNING_REQUIRES_CODING_AUTH** — PD-S5-01…07 **RATIFIED** |
| Depends on | S4 completion readiness + approved COs; invoice-on-complete remains off |
| Revalidated | 2026-07-23 live invoice baseline unchanged (25; draft/sent/paid) |

---

## 1. Canonical writer design

### `ml_p1_s5_invoice_create(p_job_id, p_client_mutation_id, p_actor_role_hint unused)`

**SECURITY DEFINER** RPC; role from `ml_p1_s2_current_actor_role()` (Auth UUID → `app_user_roles`).

**Inputs (server-resolved, not client amounts):**
- `p_job_id`
- `p_client_mutation_id` (idempotency)
- Tax defaults from **approved quote snapshot** (PD-S5-04 B); office draft tax correct via `ml_p1_s5_invoice_draft_update` (PD-S5-04 C)

**Algorithm:**
1. Lock job `FOR UPDATE`.
2. Assert capability `invoice.create` (office/manager/admin).
3. Eligibility gate (§2) — else raise typed deny codes.
4. Load approved quote pinned on job (`quote_id` + `source_quote_version` if present).
5. Load change orders with `status='approved'` only.
6. Build line snapshot:
   - original quote lines (stored historical unit prices)
   - plus approved CO lines (stored deltas)
   - exclude rejected/cancelled/pending COs
7. Compute financials per §6; write `invoices` + `invoice_items` in one transaction.
8. Emit audit event; record mutation idempotency row.
9. Return invoice id + status=`draft` + `invoice_created=true` + lineage payload.
10. **Never** set status to `sent`/`paid`; **never** call Stripe; **never** send customer email inside create.

### Companion RPCs (planned)
| RPC | Purpose |
| --- | --- |
| `ml_p1_s5_invoice_draft_update` | Pre-issue corrections (lines/tax/notes) while `draft` |
| `ml_p1_s5_invoice_issue` | `draft`→`sent`; sets `sent_at`, release flags; may create `public_token` |
| `ml_p1_s5_invoice_void` | Void with reason; authority per PD-S5-05 |
| `ml_p1_s5_invoice_get` / readiness | Blocked reasons for UI |

Idempotency: same `(job_id, client_mutation_id)` returns prior result. Unique job invoice index enforces single non-null job invoice.

---

## 2. Eligibility contract

| Code | Condition |
| --- | --- |
| `ML_P1_S5_JOB_NOT_FOUND` | Missing job |
| `ML_P1_S5_JOB_NOT_COMPLETED` | `jobs.status <> completed` |
| `ML_P1_S5_COMPLETION_NOT_READY` | `ml_p1_s4_completion_readiness.ready <> true` (recompute) |
| `ML_P1_S5_PENDING_CHANGE_ORDER` | Any CO in `proposed`/`pending_approval` |
| `ML_P1_S5_QUOTE_REQUIRED` | Missing approved source quote |
| `ML_P1_S5_INVOICE_EXISTS` | Invoice already linked to job (unique hit / found row) |
| `ML_P1_S5_ROLE_DENY` | Role cannot `invoice.create` |
| `ML_P1_S5_STALE_JOB` | Optional row_version mismatch |
| `ML_P1_S5_CANCELLED_JOB` | Job cancelled |
| `ML_P1_S5_MUTATION_ID_REQUIRED` | Missing idempotency key |

---

## 3. Lineage (persist on invoice + items + events)

| Field | Source |
| --- | --- |
| `job_id` | Job |
| `quote_id` | Job.source quote |
| `source_quote_version` | **Add column** if missing — pin version at create |
| `approved_change_order_ids` | **Add jsonb/uuid[]** of approved CO ids + versions |
| Customer / address | From lead/property/job snapshot fields |
| Line `source_kind` | `quote` \| `change_order` |
| Line `source_id` | quote_item id or CO item id |
| `unit_price` / qty | **Stored historical** — never live price_book re-fetch |
| Actor / timestamps | `auth.uid()`, `created_at` |
| Audit | `events` row `InvoiceCreated` with payload hash of totals |

---

## 4. Lifecycle state machine (proposed vs live)

**Live observed:** `draft` → `sent` → `paid` (and stay).

**Ratified S5 product states (PD-S5-02 C):**

```
draft → sent (display “Issued”) → paid
                ↘ void
sent → void (if unpaid; PD-S5-06 A)
paid → (refunded via S5b only — out of scope)
```

| State | S5 meaning | Who |
| --- | --- | --- |
| `draft` | Editable office review | office/manager/admin |
| `sent` | Issued to customer (UI label **“Issued”**); amounts immutable (PD-S5-06 A) | office issue |
| `partial` / `partially_paid` | Settlement projection (S5b writers) | read in S5 |
| `paid` | Settled | read in S5 |
| `void` | Cancelled invoice | void authority (PD-S5-05 A) |
| `written_off` | Financial close — admin write-off (PD-S5-05); may land in S5b if deferred | admin |

S5 **writes:** `draft`, `sent`, `void` only. Payment statuses are **read** from settlement fields.

---

## 5. Authorization matrix (S5)

| Capability | tech | office/CSR | manager | admin | viewer | partner | customer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create draft invoice | N | Y | Y | Y | N | N | N |
| Edit draft | N | Y | Y | Y | N | N | N |
| Issue/send | N | Y | Y | Y | N | N | N |
| Void | N | Y* | Y | Y | N | N | N |
| Write-off | N | N | N | Y* | N | N | N |
| Edit issued totals | N | N | N | N | N | N | N |
| View office invoice | N | Y | Y | Y | Y | limited | N |
| View public invoice | — | — | — | — | — | — | token |
| Record payment | — | — | — | — | — | — | **S5b** |

\* Per PD-S5-05 A. Technicians **never** edit invoice totals, void, or write off.

---

## 6. Financial calculation contract (no invented pricing)

| Rule | Spec |
| --- | --- |
| Price source | Stored quote lines + approved CO lines only |
| Pricebook | **Forbidden** as recalculation source at invoice create |
| Subtotal | Σ (qty × unit_price) for included lines |
| Discounts | Include quote/CO discount lines as stored; header `discount_amount` if present on draft per office edit |
| Negative lines | Allowed when `line_type=discount` or stored negative (e.g. bundle discount) |
| Zero-dollar lines | Allowed; still appear if on approved scope |
| Tax | PD-S5-04 B+C: default from quote snapshot; office may correct on draft; freeze on issue; `tax_amount = round(taxable_subtotal × tax_rate, 2)` half-up to cents |
| Credits | No new credit-memo product in S5; void+reissue for corrections |
| Total | `subtotal - discount_amount + tax_amount` → `total_amount` |
| Immutability | On `sent`, financial columns + items **DENY** update except void transition |
| Write-off | Out of S5 default (PD) |
| Rounding | Per-line round to 2 decimals; then tax on taxable sum |

---

## 7. Creation behavior (PD-S5-01 C RATIFIED)

**Hybrid (C)**  
- Auto-`draft` when job → `completed` **and** S4 readiness pass **and** no pending CO **and** no existing blocking invoice.  
- Office always issues (explicit).  
- Office can manually create if auto missed.  
- **`invoice_type='final'` only** (PD-S5-03 A).  
- **Never** auto-`sent` / auto-email on complete.

---

## 8. Issue / customer communication boundary

| Allowed in S5 | Not in S5 |
| --- | --- |
| Issue → `sent` | Autonomous unpaid dunning |
| `send-invoice` email/SMS re-delivery | Failed-payment automation |
| Public invoice view by token | Review-request automation |
| Payment status **read-only** display | Stripe checkout (S5b) |

---

## 9. Correction / void model (PD-S5-06 A RATIFIED)

| Case | Policy |
| --- | --- |
| Draft typo / wrong line / tax | Edit via draft update RPC |
| Missed approved CO before issue | Rebuild draft from lineage (replace items) while draft |
| After issue, unpaid | **Void** + reissue (new id; old void retained) — **no in-place edit** |
| After partial/full payment | **No S5 amount edit** — S5b/finance exception path |
| Duplicate create | Idempotent return / `INVOICE_EXISTS` |
| Wrong customer/address on draft | Edit snapshot fields on draft only |
| Pre-existing 25 invoices | Grandfather (PD-S5-07 A); no historical rewrite |

---

## 10. Office UI plan

- Completed job → Invoice panel: Create / Open draft  
- Show: linked job, quote version, approved COs, blocked reasons  
- Financial summary (subtotal/tax/discount/total)  
- Issue/Send, Void (with reason), Audit history  
- No duplicate-create button when invoice exists  
- Remove stale “completion prepares invoice” copy

## 11. Customer invoice UI plan

- Invoice number, issue date, due date (if used), status  
- Work summary, service address  
- Line items (quote + approved CO), subtotal, tax, credits/discounts, total  
- Payment status read-only  
- **No** internal notes, actor emails, break-glass proofs, office audit

---

## 12. Migration plan (ordered)

1. Additive lineage columns on `invoices` / `invoice_items` (`source_quote_version`, `approved_change_order_ids`, `source_kind`, `source_id`, calculation snapshot jsonb).  
2. Canonical RPCs + grants.  
3. Alternate-writer denials (work-order ensure, MyMoney, trigger flags asserted false).  
4. Idempotency / mutation table if needed.  
5. UI + edge bridges.  
6. Forward-fix plan: disable RPC / feature flag; do not delete historical invoices.  
7. Pre-apply: confirm unique indexes; count existing invoices; no multi-invoice jobs (currently 0).

**Do not** use deprecated `estimates` writers.  
**Do not** treat `tenant_id` as auth — preserve column defaults only.

---

## 13. Failure / recovery

| Failure | Behavior |
| --- | --- |
| Duplicate / concurrent create | Unique violation → return existing or `INVOICE_EXISTS`; transaction abort |
| Eligibility fail | No partial invoice row |
| Audit insert fail | Abort whole transaction |
| Issue/send email fail | Invoice may be `sent` with delivery_error event **or** keep draft until delivery ack — **prefer: mark sent only after token ready; delivery failure = retryable event, not false success** |
| Void fail | No status change |
| Customer token missing | Generate on issue; fail closed if cannot |
| Stale client | Version check deny |

---

## 14. Test sentinels (adversarial)

Unauthorized create · tech total edit · duplicate create · concurrent create · unapproved CO included · approved CO omitted · pricebook drift attempt · direct frontend insert · legacy alternate writer · invoice-on-complete bleed · missing job/quote lineage · partial persistence · issue without review (if required) · edit after issue · void without authority · customer sees internal fields · send false success · create from incomplete/cancelled job.

---

## 15. Review lanes

Product · Data · Security · Financial Control · Architecture · UX/Field · Independent Adversarial Test — freeze exact coding tip before reviews.

---

## 16. Coding-readiness

PD-S5-01…07 **ratified**. Coding authorized on `ml/p1-s5-invoice-collection` @ `8505a89`.  
A2 SOURCE delivered (see `ML-P1_SLICE5_A2_CODING_EVIDENCE.md`). Stop before prod apply / deploy / Stripe.
