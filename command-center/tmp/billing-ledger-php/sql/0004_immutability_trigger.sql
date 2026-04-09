-- Optional but recommended: DB-enforced immutability for issued invoices.
-- Freezes snapshots + money totals + issue/due dates after issued_at is set.

create or replace function prevent_issued_invoice_mutation()
returns trigger as $$
begin
  if old.issued_at is not null then
    if
      new.issue_date is distinct from old.issue_date or
      new.due_date is distinct from old.due_date or
      new.issuer_snapshot_json is distinct from old.issuer_snapshot_json or
      new.payer_snapshot_json is distinct from old.payer_snapshot_json or
      new.line_subtotal_cents is distinct from old.line_subtotal_cents or
      new.line_discount_total_cents is distinct from old.line_discount_total_cents or
      new.document_discount_total_cents is distinct from old.document_discount_total_cents or
      new.fee_total_cents is distinct from old.fee_total_cents or
      new.tax_total_cents is distinct from old.tax_total_cents or
      new.grand_total_cents is distinct from old.grand_total_cents
    then
      raise exception 'Issued invoice monetary/snapshot/date fields are immutable';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_issued_invoice_mutation on invoices;
create trigger trg_prevent_issued_invoice_mutation
before update on invoices
for each row
execute function prevent_issued_invoice_mutation();

