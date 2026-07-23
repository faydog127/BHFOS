# AUTHORIZATION REQUIRED — S6 sk_test E2E FAIL (settlement blocked)

| Field | Value |
| --- | --- |
| Auth accepted | A=`02238f4edd506c…` · B=auto-send OFF · C=sk_test synth |
| Stripe mode used | **`sk_test_`** (local `F:\Dev\BHFOS\command-center\supabase\functions\.env`) — **not** rotated into Edge |
| Disposition | **FAIL** — cannot mark `SLICE6_PRODUCTION_VALIDATION_PASS` |
| Run tag | `S6-SYNTH-1784831812782` (synth cleaned; 0 leftover leads) |

## What passed

- Flags: checkout/offline/refunds/recon ON; auto-send/auto-charge OFF
- Synthetic lead + completed job + issued invoice (`is_test_data`)
- Stripe Checkout Session create (`cs_test_…`)
- Immediate capture via test PaymentIntent (`pi_…` succeeded)
- Dispute quarantine → `payment_recon_queue` row
- Hostinger remains HEALTHY @ `206e141…` (untouched this run)

## What failed (blocking)

| Step | Error |
| --- | --- |
| `record_stripe_webhook_payment` | **`ML_P1_S4_ALT_WRITER_DENY: job execution fields require ml_p1_s4_* writer`** |
| Invoice paid | remained `sent` / `amount_paid=0` |
| Office refund RPC | `ML_P1_S6_NOTHING_TO_REFUND` (cascade of settlement fail) |
| Recon after refund | none (cascade) |

### Root cause

`handle_invoice_payment_sync` (AFTER UPDATE on `invoices` when status → `paid`) runs:

```sql
UPDATE jobs SET payment_status = 'paid' WHERE id = NEW.job_id;
```

S4 trigger `trg_ml_p1_s4_guard_job_execution_write` blocks `payment_status` changes unless `app.ml_p1_s4_writer=1`.

Settlement path never calls `ml_p1_s4_set_writer_context()`.

**Impact:** Any live Stripe webhook that marks a **job-linked** invoice paid will fail the same way (9 existing paid+job invoices predate the S4 guard).

## Proposed hotfix (money-touching — needs Founder Category-C)

Migration (single function replace; no GRANT widen; no flag flips):

```sql
CREATE OR REPLACE FUNCTION public.handle_invoice_payment_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'paid' AND NEW.status = 'paid' AND NEW.job_id IS NOT NULL THEN
    PERFORM public.ml_p1_s4_set_writer_context();
    UPDATE public.jobs
       SET payment_status = 'paid', updated_at = now()
     WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;
```

Then re-run `node tools/ml-p1-s6-synth-sk-test-validation.mjs` (fail-closed on non-`sk_test_`).

## Decisions needed

Reply **FIX-S6-SETTLEMENT: APPROVE** to authorize applying the hotfix migration on `wwyxohjnyqnegzbxtuxs` + re-run sk_test E2E + closeout docs.

Or provide an alternate disposition. Until then: **no PASS mark**, no Edge secret rotate, no S8.
