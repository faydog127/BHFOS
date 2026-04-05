-- One-off production data repair:
-- Invoice #61 was created with a legacy 3% processing fee "tax" instead of 7% sales tax.
-- This updates only the specific TVG invoice id and is safe to re-run.

do $$
begin
  update public.invoices
  set
    tax_rate = 0.07,
    tax_amount = 62.86,
    total_amount = 960.86,
    updated_at = now()
  where id = 'a09587a6-16ff-4682-8beb-49b2725e1ef7'
    and tenant_id = 'tvg'
    and (
      tax_rate is distinct from 0.07
      or tax_amount is distinct from 62.86
      or total_amount is distinct from 960.86
    );
end $$;

