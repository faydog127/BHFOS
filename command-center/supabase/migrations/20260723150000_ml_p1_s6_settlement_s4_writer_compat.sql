-- ML-P1 S6 hotfix: allow invoice→job payment_status sync under S4 writer guard.
-- Authority: Founder FIX-S6-SETTLEMENT: APPROVE (2026-07-23)
-- Exact A2 head: 02238f4edd506c0756e74d1dbd0f0640f999b5bb
-- Scope: handle_invoice_payment_sync only — no GRANT widen, no flag flips, no auto-charge.

CREATE OR REPLACE FUNCTION public.handle_invoice_payment_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'paid'
     AND NEW.status = 'paid'
     AND NEW.job_id IS NOT NULL THEN
    -- S4 trg_ml_p1_s4_guard_job_execution_write blocks payment_status unless writer context is set.
    PERFORM public.ml_p1_s4_set_writer_context();
    UPDATE public.jobs
       SET payment_status = 'paid',
           updated_at = now()
     WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_invoice_payment_sync() IS
  'ML-P1 S6: sync jobs.payment_status=paid when invoice becomes paid; sets ml_p1_s4 writer context for S4 guard compat.';
