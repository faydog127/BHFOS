-- Known channel revenue cannot exceed Total Revenue.
-- When all three channels are present they must equal Total Revenue exactly.
-- A missing channel stays null. This check does not store a zero for a blank channel.
-- If Total Revenue is null, partial channel facts may remain.
-- If all three channels are present, Total Revenue is required.
-- No stored facts are rewritten. The previous reconcile rule is replaced in place.
-- No real TVG data may be entered in any Vercel Preview or staging environment.
-- The finance migration is not applied to any remote project by PR #164.
-- Preview must use a non-production Supabase project, or none.
-- Applying the migration anywhere requires explicit Command Center authorization.

begin;

alter table public.finance_monthly_actuals
  drop constraint finance_actuals_channel_reconcile;

alter table public.finance_monthly_actuals
  add constraint finance_actuals_channel_reconcile check (
    (
      total_revenue is null
      or (
        coalesce(direct_residential_revenue, 0)
        + coalesce(commercial_direct_revenue, 0)
        + coalesce(portal_revenue, 0)
      ) <= total_revenue
    )
    and (
      direct_residential_revenue is null
      or commercial_direct_revenue is null
      or portal_revenue is null
      or (
        total_revenue is not null
        and total_revenue = direct_residential_revenue
          + commercial_direct_revenue
          + portal_revenue
      )
    )
  );

comment on constraint finance_actuals_channel_reconcile on public.finance_monthly_actuals is
  'Known channel revenue cannot exceed Total Revenue. All three channels must equal Total Revenue. A null channel is not stored as zero.';

commit;
