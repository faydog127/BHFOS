\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.inspections (id, tenant_id, status, title, revision)
values ('b1000000-0000-0000-0000-000000000001', 'phase4-acceptance', 'draft', 'PHASE 4 AI REVIEW TEST', 1);
insert into public.inspection_photos
  (id, tenant_id, inspection_id, bucket_id, object_path, file_name, content_type, upload_state)
values
  ('b2000000-0000-0000-0000-000000000001', 'phase4-acceptance', 'b1000000-0000-0000-0000-000000000001',
   'inspection-photos', 'phase4-acceptance/test.jpg', 'test.jpg', 'image/jpeg', 'complete');
insert into public.inspection_ai_suggestions
  (id, tenant_id, inspection_id, inspection_revision, photo_id, suggestion_version, suggestion_type, status,
   model, prompt_version, content)
values
  ('b3000000-0000-0000-0000-000000000001', 'phase4-acceptance', 'b1000000-0000-0000-0000-000000000001', 1,
   'b2000000-0000-0000-0000-000000000001', 1, 'finding', 'pending', 'test-model', 'test-prompt',
   '{"title":"Approved test finding","description":"Synthetic observation","category":"blower","recommended_action":"Clean blower"}');

select public.inspection_review_ai_suggestion(
  'phase4-acceptance', 'b3000000-0000-0000-0000-000000000001', 'accept', null
);

do $$
declare v_finding uuid;
begin
  select id into v_finding from public.inspection_findings
  where inspection_id = 'b1000000-0000-0000-0000-000000000001' and is_customer_visible = true;
  if v_finding is null then raise exception 'accepted AI finding is not customer visible'; end if;
  if not exists (select 1 from public.inspection_photos where id = 'b2000000-0000-0000-0000-000000000001' and finding_id = v_finding)
    then raise exception 'accepted AI finding did not retain source photo'; end if;
  if exists (select 1 from public.inspection_findings where inspection_id = 'b1000000-0000-0000-0000-000000000001' and title <> 'Approved test finding')
    then raise exception 'unexpected finding created'; end if;
end $$;

rollback;
\echo 'PHASE4_FIELD_WORKFLOW_ACCEPTANCE_PASS'
