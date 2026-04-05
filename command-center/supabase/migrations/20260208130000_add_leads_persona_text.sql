-- Bridge migration: ensure leads.persona exists before enum conversion migration.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS persona text;

ALTER TABLE public.leads
  ALTER COLUMN persona SET DEFAULT 'unclassified';

UPDATE public.leads
SET persona = 'unclassified'
WHERE persona IS NULL;
