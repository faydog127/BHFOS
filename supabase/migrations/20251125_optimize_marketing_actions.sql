-- Optimization for Marketing Actions Table
-- Matches user request for 'marketing_content' but applies to existing 'marketing_actions' table

-- 1. Index for fast filtering of pending items
-- Used by: AutomationPlaybooks.jsx (Pending Approvals Queue)
-- Logic: Filter by status='needs_approval' and sort by created_at desc
CREATE INDEX IF NOT EXISTS idx_marketing_actions_status_created 
ON public.marketing_actions (status, created_at DESC);

-- 2. Index for fast joins with leads
-- Used by: Joining lead data (names, email) to action items
CREATE INDEX IF NOT EXISTS idx_marketing_actions_lead_id 
ON public.marketing_actions (lead_id);

-- 3. Enable Realtime
-- Allows the dashboard to update instantly when new actions are triggered
BEGIN;
  -- Attempt to add table to publication. 
  -- Note: This may throw an error if already added, which is safe to ignore in manual execution.
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_actions;
COMMIT;