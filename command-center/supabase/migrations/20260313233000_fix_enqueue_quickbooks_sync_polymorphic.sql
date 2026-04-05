create or replace function public.enqueue_quickbooks_sync()
returns trigger
language plpgsql
security definer
as $$
declare
  entity_type text;
  v_lead_id uuid;
begin
  if tg_table_name = 'invoices' then
    entity_type := 'invoice';
    v_lead_id := nullif(to_jsonb(new)->>'lead_id', '')::uuid;
  elsif tg_table_name = 'leads' then
    entity_type := 'customer';
    v_lead_id := new.id;
  else
    return new;
  end if;

  if (
    entity_type = 'invoice'
    and new.status in ('sent', 'paid', 'partial')
  ) or (
    entity_type = 'customer'
    and new.status = 'Customer'
  ) then
    insert into public.marketing_actions (
      lead_id,
      action_type,
      status,
      playbook_key,
      target_details
    ) values (
      v_lead_id,
      'quickbooks_sync',
      'pending',
      'system_sync',
      jsonb_build_object(
        'entity', entity_type,
        'entity_id', new.id,
        'reason', 'auto_trigger'
      )
    );
  end if;

  return new;
end;
$$;
