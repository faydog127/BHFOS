insert into public.doc_templates
(id,name,version,category,audience,channels,subject,body_html,body_text,sms_fallback,required_fields,attachments,active)
values
('CONFIRM-AIR-CHECK','Free Air Check Confirmation','1.0','booking','{homeowner}','{email,sms}',
 'Your Free Air Check is confirmed for {{appt_date}} at {{appt_time}}',
 '<p>Hi {{first_name}}, your appointment is confirmed at {{address}} on {{appt_date}} {{appt_time}}. Prep: {{prep_tips_url}}</p><p>— {{rep_name}}</p>',
 'Hi {{first_name}}, confirmed for {{appt_date}} {{appt_time}} at {{address}}. Prep: {{prep_tips_url}} — {{rep_name}}',
 'Hi {{first_name}}, confirmed for {{appt_date}} {{appt_time}}. Prep: {{prep_tips_url}} — {{rep_name}}',
 '{first_name,address,appt_date,appt_time,prep_tips_url,rep_name}', '{}', true)
on conflict (id) do update set 
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    category = EXCLUDED.category,
    audience = EXCLUDED.audience,
    channels = EXCLUDED.channels,
    subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    body_text = EXCLUDED.body_text,
    sms_fallback = EXCLUDED.sms_fallback,
    required_fields = EXCLUDED.required_fields,
    attachments = EXCLUDED.attachments,
    active = EXCLUDED.active;

insert into public.doc_templates
(id,name,version,category,audience,channels,subject,body_html,body_text,sms_fallback,required_fields,attachments,active)
values
('REQUEST-REVIEW','Review Request','1.0','review','{homeowner}','{email,sms}',
 'How was your experience with The Vent Guys?',
 '<p>Hi {{first_name}}, could you share a quick review? <a href="{{review_link}}">Review link</a></p>',
 'Hi {{first_name}}, review us here: {{review_link}}',
 'Hi {{first_name}}, review us here: {{review_link}}',
 '{first_name,review_link}', '{}', true)
on conflict (id) do update set 
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    category = EXCLUDED.category,
    audience = EXCLUDED.audience,
    channels = EXCLUDED.channels,
    subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    body_text = EXCLUDED.body_text,
    sms_fallback = EXCLUDED.sms_fallback,
    required_fields = EXCLUDED.required_fields,
    attachments = EXCLUDED.attachments,
    active = EXCLUDED.active;