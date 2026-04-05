-- A-EXEC-2: Add last_human_signal_at to leads and unique constraint on jobs
-- Gotcha fixes: #1 (missing column) and #4 (job race condition)

-- Add last_human_signal_at column to leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'leads' 
    AND column_name = 'last_human_signal_at'
  ) THEN
    ALTER TABLE public.leads 
    ADD COLUMN last_human_signal_at timestamptz;
    
    COMMENT ON COLUMN public.leads.last_human_signal_at IS 
      'Timestamp of last human interaction (quote view, invoice view, payment attempt)';
  END IF;
END $$;

-- Add unique constraint on jobs.quote_id to prevent duplicate jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'jobs_quote_id_unique'
  ) THEN
    CREATE UNIQUE INDEX jobs_quote_id_unique 
    ON public.jobs (quote_id) 
    WHERE quote_id IS NOT NULL;
    
    COMMENT ON INDEX public.jobs_quote_id_unique IS 
      'Prevent duplicate jobs for same quote';
  END IF;
END $$;
