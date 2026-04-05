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
      lead_id, 
      playbook_key, 
      type, 
      channel, 
      status, 
      target_details,
      scheduled_at
    ) values (
      new.id, 
      'free_air_check_welcome', 
      'email', 
      'api', 
      'generating',
      jsonb_build_object('name', new.first_name, 'email', new.email),
      now()
    );

    -- Action 2: Scheduled Follow-up Email in 3 days
    insert into marketing_actions (
      lead_id, 
      playbook_key, 
      type, 
      channel, 
      status, 
      target_details,
      scheduled_at
    ) values (
      new.id, 
      'free_air_check_followup',
      'email',
      'scheduled',
      'scheduled', -- This one does not get generated immediately
      jsonb_build_object('name', new.first_name, 'email', new.email),
      now() + interval '3 days'
    );
  end if;

  -- Playbook 2: Partner Referral SMS Alert
  -- This runs ONLY on INSERT of a lead that has a partner code.
  if (TG_OP = 'INSERT') and (new.partner_referral_code is not null) then
      -- This action is to alert the PARTNER, not the lead.
      -- The `lead_id` will be the ID of the partner's record in the leads table.
      -- This logic is complex and will be handled by a different trigger/process.
      -- For now, we are just mocking a simple action.
      insert into marketing_actions (
        lead_id,
        playbook_key,
        type,
        channel,
        status,
        target_details,
        scheduled_at
      ) values (
        new.id, -- Storing the new lead's ID for context
        'partner_referral_alert',
        'sms',
        'api',
        'generating',
        jsonb_build_object('name', new.first_name, 'code', new.partner_referral_code),
        now()
      );
  end if;

  return new;
end;
$function$