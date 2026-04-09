-- SQL-first addendum: partial refunds without sacrificing strict 1:1 "reversal" semantics.
-- Approach:
-- - Keep "reversal_of_*" for correcting a mistaken allocation/application (1:1, unique).
-- - Introduce "refund_of_*" for invoice-impacting refund adjustments (many-to-1 allowed).

-- Payment allocations: add refund linkage + tighten sign rules.
alter table payment_allocations
  add column if not exists refund_of_payment_allocation_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_pa_refund_of'
      and conrelid = 'payment_allocations'::regclass
  ) then
    execute $ddl$
      alter table payment_allocations
        add constraint fk_pa_refund_of
        foreign key (refund_of_payment_allocation_id)
        references payment_allocations(payment_allocation_id)
    $ddl$;
  end if;
end $$;

-- Enforce: negative rows must be either a reversal OR a refund adjustment (not both).
alter table payment_allocations
  drop constraint if exists ck_pa_sign_discipline;

alter table payment_allocations
  add constraint ck_pa_sign_discipline check (
    (applied_cents > 0 and reversal_of_payment_allocation_id is null and refund_of_payment_allocation_id is null)
    or
    (applied_cents < 0 and (
      (reversal_of_payment_allocation_id is not null and refund_of_payment_allocation_id is null)
      or
      (reversal_of_payment_allocation_id is null and refund_of_payment_allocation_id is not null)
    ))
  );

-- Preserve strict 1:1 reversals (but allow multiple refund adjustments).
drop index if exists uq_pa_one_reversal_per_row;
create unique index if not exists uq_pa_one_reversal_per_row
  on payment_allocations (reversal_of_payment_allocation_id)
  where reversal_of_payment_allocation_id is not null;
