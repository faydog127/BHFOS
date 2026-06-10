begin;

-- Phase 1.5: Allow upload fulfillment updates after submit/completion without allowing content edits.
-- Rules:
-- - INSERT/DELETE on inspection_photos requires parent inspection status = draft.
-- - UPDATE requires:
--     - parent status = draft, OR
--     - parent status in (submitted, completed) AND the update is strictly an upload-fulfillment patch.

create or replace function public.inspection_photos_update_guard()
returns trigger
language plpgsql
as $$
declare
  parent_status text;
  allowed boolean := false;
begin
  if auth.role() = 'service_role' then
    return coalesce(new, old);
  end if;

  select lower(coalesce(i.status, 'draft'))
    into parent_status
  from public.inspections i
  where i.id = coalesce(new.inspection_id, old.inspection_id)
    and i.tenant_id = coalesce(new.tenant_id, old.tenant_id);

  if not found then
    raise exception using errcode='P0001', message='Parent inspection not found';
  end if;

  if tg_op in ('INSERT', 'DELETE') then
    if parent_status <> 'draft' then
      raise exception using errcode='P0001', message='Inspection is locked. Reopen to edit.';
    end if;
    return coalesce(new, old);
  end if;

  -- UPDATE
  if parent_status = 'draft' then
    return new;
  end if;

  -- Upload-fulfillment update is allowed after submit/completed if and only if:
  -- - identifiers and customer-visible fields do not change
  -- - only upload-related fields change (upload_state/storage_uploaded_at/storage_error/byte_size/content_type/updated_at)
  if coalesce(new.tenant_id,'') <> coalesce(old.tenant_id,'') then allowed := false; else allowed := true; end if;
  if allowed and coalesce(new.inspection_id::text,'') <> coalesce(old.inspection_id::text,'') then allowed := false; end if;
  if allowed and coalesce(new.finding_id::text,'') <> coalesce(old.finding_id::text,'') then allowed := false; end if;
  if allowed and coalesce(new.recommendation_id::text,'') <> coalesce(old.recommendation_id::text,'') then allowed := false; end if;
  if allowed and coalesce(new.caption,'') <> coalesce(old.caption,'') then allowed := false; end if;
  if allowed and coalesce(new.category,'') <> coalesce(old.category,'') then allowed := false; end if;
  if allowed and coalesce(new.is_before::text,'') <> coalesce(old.is_before::text,'') then allowed := false; end if;
  if allowed and coalesce(new.object_path,'') <> coalesce(old.object_path,'') then allowed := false; end if;
  if allowed and coalesce(new.bucket_id,'') <> coalesce(old.bucket_id,'') then allowed := false; end if;
  if allowed and coalesce(new.file_name,'') <> coalesce(old.file_name,'') then allowed := false; end if;
  if allowed and coalesce(new.taken_at::text,'') <> coalesce(old.taken_at::text,'') then allowed := false; end if;

  -- Evidence integrity fields are not editable post-submit without reopen.
  if allowed and coalesce(new.is_voided,false) <> coalesce(old.is_voided,false) then allowed := false; end if;
  if allowed and coalesce(new.void_reason,'') <> coalesce(old.void_reason,'') then allowed := false; end if;
  if allowed and coalesce(new.voided_by::text,'') <> coalesce(old.voided_by::text,'') then allowed := false; end if;
  if allowed and coalesce(new.voided_at::text,'') <> coalesce(old.voided_at::text,'') then allowed := false; end if;

  -- Allow changing only these fields:
  -- upload_state, storage_uploaded_at, storage_error, byte_size, content_type, updated_at
  -- (uploaded_at remains the record timestamp; do not mutate it here.)
  if not allowed then
    raise exception using errcode='P0001', message='Inspection is locked. Reopen to edit.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inspection_photos_require_draft on public.inspection_photos;
create trigger trg_inspection_photos_require_draft
before insert or update or delete
on public.inspection_photos
for each row
execute function public.inspection_photos_update_guard();

commit;

