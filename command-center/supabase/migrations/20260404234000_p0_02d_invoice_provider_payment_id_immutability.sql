-- P0-02.D — Provider payment pointer immutability
-- Once `invoices.provider_payment_id` is set (non-null), it must not be reassigned.

create or replace function public.trg_block_invoice_provider_payment_id_reassign()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.provider_payment_id is not null
     and new.provider_payment_id is distinct from old.provider_payment_id then
    raise exception 'PROVIDER_PAYMENT_ID_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_invoice_provider_payment_id_reassign on public.invoices;
create trigger trg_block_invoice_provider_payment_id_reassign
before update on public.invoices
for each row
execute function public.trg_block_invoice_provider_payment_id_reassign();

