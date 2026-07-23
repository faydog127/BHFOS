-- ML-P1 S5 — auto-draft on job completed (PD-S5-01 C). Never auto-issue.

CREATE OR REPLACE FUNCTION public.ml_p1_s5_job_completed_auto_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mut text;
  v_result jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF lower(coalesce(NEW.status, '')) <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF lower(coalesce(OLD.status, '')) = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Skip if non-void invoice already exists
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE job_id = NEW.id AND lower(coalesce(status, '')) IS DISTINCT FROM 'void'
  ) THEN
    RETURN NEW;
  END IF;

  v_mut := 's5-auto:' || NEW.id::text || ':' || coalesce(NEW.completed_at, now())::text;
  BEGIN
    v_result := public.ml_p1_s5_invoice_create(NEW.id, v_mut, true);
  EXCEPTION
    WHEN OTHERS THEN
      -- Soft-fail auto-draft: job completion must not roll back (office can create manually)
      INSERT INTO public.events (
        tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
      ) VALUES (
        coalesce(NEW.tenant_id, 'default'),
        'job',
        NEW.id,
        'InvoiceAutoDraftFailed',
        'system',
        NULL,
        jsonb_build_object(
          'slice', 'ml-p1-s5',
          'sqlstate', SQLSTATE,
          'message', SQLERRM
        )
      );
      RETURN NEW;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ml_p1_s5_job_completed_auto_draft ON public.jobs;
CREATE TRIGGER trg_ml_p1_s5_job_completed_auto_draft
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.ml_p1_s5_job_completed_auto_draft();
