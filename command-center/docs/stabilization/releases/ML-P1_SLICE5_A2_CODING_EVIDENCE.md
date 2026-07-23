# ML-P1 Slice 5 — A2 Coding Evidence

> Coding authorized on branch `ml/p1-s5-invoice-collection` at base SHA
> `8505a89a0e920ff68e35d0f10b49e98693125674` (PD-S5-01…07 ratified planning tip).
>
> **Does not authorize** production migration apply, Hostinger deploy, Stripe/Braintree,
> S5b payments, Slice 6, TIS, or G2.3.

## Delivered (SOURCE)

| Item | Path / note |
| --- | --- |
| Schema | `supabase/migrations/20260723120000_ml_p1_s5_invoice_schema.sql` |
| RPCs | `supabase/migrations/20260723121000_ml_p1_s5_invoice_rpcs.sql` |
| Auto-draft | `supabase/migrations/20260723122000_ml_p1_s5_auto_draft_trigger.sql` |
| Edge deny | `work-order-update` → `ML_P1_S5_ALT_WRITER_DENY` |
| MyMoney deny | direct `invoices.insert` removed / denied |
| Authz | `src/lib/mlP1S5InvoiceAuthz.js` |
| Service | `src/services/mlP1S5InvoiceService.js` (RPC-only) |
| UI | `OfficeInvoicePanel` wired in Jobs record modal; Invoices badge **Issued** for `sent` |
| Tests | `tests/unit/ml-p1-s5-invoice.test.mjs` |

## PD mapping

| PD | Implementation |
| --- | --- |
| PD-S5-01 C | Trigger auto-draft on `jobs.status→completed` + office create RPC; never auto-issue |
| PD-S5-02 C | Persist `sent`; UI/RPC `display_status` / badge **Issued** |
| PD-S5-03 A | Create `invoice_type = 'final'` only |
| PD-S5-04 B+C | Tax from quote snapshot; draft tax update; issued immutability trigger; `pricebook_used=false` |
| PD-S5-05 A | Void office\|manager\|admin\|csr; write-off capability admin-only (RPC deferred → residual); tech deny |
| PD-S5-06 A | Issued financial UPDATE blocked; void+reissue path |
| PD-S5-07 A | `s5_created` flag; no historical rewrite |

## Explicit non-actions

- Did **not** apply any S5 migration to linked production
- Did **not** deploy Hostinger / Edge
- Did **not** enable Stripe / Braintree / payment capture
- Did **not** rewrite the 25 grandfathered live invoices
- Did **not** re-enable S4 invoice-on-complete (`false` retained)

## Residuals (coding)

| ID | Note |
| --- | --- |
| R-S5-08 | Admin write-off RPC/UI deferred (capability helper present; S5b-compatible) |
| R-S5-07 | Soft-fail auto-draft depends on `events` insert; office manual create remains |
| R-S5-04 | Grandfathered rows lack full lineage until best-effort backfill (no amount rewrite) |
