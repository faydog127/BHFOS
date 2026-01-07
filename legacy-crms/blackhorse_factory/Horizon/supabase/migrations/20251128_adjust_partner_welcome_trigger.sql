-- This file is for historical record and is not executed directly by the system.
-- The migration logic has been applied via the <type="database"> block.

CREATE OR REPLACE FUNCTION public.trigger_marketing_playbooks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- Playbook 1: New lead for "Free Air Check"
  -- This runs ONLY on INSERT of a new lead with the correct service.
  if (TG_OP = 'INSERT') and (new.service = 'Free Air Check') then
    -- Action 1: Immediate Welcome Email
    insert into marketing_actions (
      lead_id, playbook_key, type, channel, status, target_details, scheduled_at
    ) values (
      new.id, 'free_air_check_welcome', 'email', 'api', 'generating',
      jsonb_build_object('name', new.first_name, 'email', new.email), now()
    );
    -- Action 2: Scheduled Follow-up Email in 3 days
    insert into marketing_actions (
      lead_id, playbook_key, type, channel, status, target_details, scheduled_at
    ) values (
      new.id, 'free_air_check_followup', 'email', 'scheduled', 'scheduled',
      jsonb_build_object('name', new.first_name, 'email', new.email), now() + interval '3 days'
    );
  end if;

  -- Playbook 2: Partner Referral SMS Alert
  if (TG_OP = 'INSERT') and (new.partner_referral_code is not null) then
      insert into marketing_actions (
        lead_id, playbook_key, type, channel, status, target_details, scheduled_at
      ) values (
        new.id, 'partner_referral_alert', 'sms', 'api', 'generating',
        jsonb_build_object('name', new.first_name, 'code', new.partner_referral_code), now()
      );
  end if;

  -- Playbook 3: Partner Welcome Email
  -- Only trigger if the lead is a partner AND the source was NOT a CRM approval
  -- CRM approvals are now handled directly in the frontend to bypass review.
  if (TG_OP = 'INSERT') and (new.is_partner = true) and (new.source_detail <> 'CRM Approval') then
    insert into marketing_actions (
      lead_id, playbook_key, type, channel, status, target_details, scheduled_at
    ) values (
      new.id, 'partner_welcome', 'email', 'api', 'generating', -- 'generating' requires review
      jsonb_build_object('name', new.first_name, 'email', new.email), now()
    );
  end if;

  return new;
end;
$function$