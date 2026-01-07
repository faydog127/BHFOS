# Supabase Database Schema

## Tables & Columns

### `leads`
- **id** (uuid, PK)
- **created_at** (timestamp with time zone)
- **name** (text)
- **email** (text)
- **phone** (text)
- **message** (text)
- **status** (text)
- **source** (text)
- **pqi** (integer)
- **is_partner** (boolean)
- **persona** (text)
- **segment** (text)
- **referrer_id** (uuid, FK to leads)
- **pipeline_stage** (text)
- **consent_marketing** (boolean)
- **needs_ai_action** (boolean)
- **first_name** (text)
- **last_name** (text)
- **company** (text)
- **source_kind** (text)
- **source_detail** (text)
- **utm_source** (text)
- **utm_medium** (text)
- **utm_campaign** (text)
- **service** (text)
- **partner_referral_code** (text)
- **marketing_source_detail** (text)
- **last_touch_at** (timestamp with time zone)
- **marketing_channel** (text)
- **referral_code** (text)
- **referral_code_id** (uuid)
- **priority_flag** (boolean)
- **priority_sla_hours** (integer)
- **intake_channel** (text)
- **notes** (text)

### `partner_prospects`
- **id** (uuid, PK)
- **business_name** (text)
- **contact_name** (text)
- **phone** (text)
- **email** (text)
- **website** (text)
- **source** (text)
- **persona** (text)
- **city** (text)
- **county** (text)
- **service_type** (text)
- **score** (integer)
- **notes** (text)
- **status** (text)
- **last_contact_at** (timestamp with time zone)
- **created_at** (timestamp with time zone)

### `partners`
- **id** (uuid, PK)
- **org_name** (text)
- **contact_name** (text)
- **email** (text)
- **phone** (text)
- **phone_normalized** (text)
- **vertical** (text)
- **service_area** (text)
- **doors_units** (integer)
- **monthly_volume_estimate** (text)
- **urgency** (text)
- **notes** (text)
- **score_revenue** (integer)
- **score_pain** (integer)
- **score_velocity** (integer)
- **score_ops** (integer)
- **score_growth** (integer)
- **total_score** (integer)
- **tier** (text)
- **status** (text)
- **history** (jsonb)
- **welcome_email_sent** (boolean)
- **welcome_email_sent_at** (timestamp with time zone)
- **welcome_sms_sent** (boolean)
- **welcome_sms_sent_at** (timestamp with time zone)
- **discount_code** (text)
- **discount_code_generated_at** (timestamp with time zone)
- **onboarding_calendar_sent** (boolean)
- **onboarding_calendar_sent_at** (timestamp with time zone)
- **partner_portal_access_sent** (boolean)
- **partner_portal_access_sent_at** (timestamp with time zone)
- **one_pager_sent** (boolean)
- **one_pager_sent_at** (timestamp with time zone)
- **utm_source** (text)
- **utm_campaign** (text)
- **utm_medium** (text)
- **session_id** (text)
- **created_at** (timestamp with time zone)
- **updated_at** (timestamp with time zone)

### `partner_registrations`
- **id** (uuid, PK)
- **created_at** (timestamp with time zone)
- **partner_type** (text)
- **organization_name** (text)
- **contact_name** (text)
- **title** (text)
- **email** (text)
- **mobile_phone** (text)
- **sms_consent** (boolean)
- **office_phone** (text)
- **address** (text)
- **counties_served** (text)
- **preferred_contact** (text)
- **referral_source** (text)
- **brokerage_name** (text)
- **license_number** (text)
- **years_in_business** (text)
- **transactions_per_year** (text)
- **primary_focus** (text)
- **price_range** (text)
- **program_use** (jsonb)
- **lead_gen_preference** (text)
- **portfolio_type** (text)
- **doors_managed** (text)
- **monthly_turnovers** (text)
- **work_order_system** (text)
- **approval_threshold** (text)
- **response_time** (text)
- **billing_preference** (text)
- **community_name** (text)
- **community_type** (text)
- **num_units** (text)
- **num_buildings** (text)
- **year_built** (text)
- **management_company_info** (text)
- **board_frequency** (text)
- **interest_reasons** (jsonb)
- **current_vendor_info** (text)
- **trade_type** (text)
- **jobs_per_month** (text)
- **current_subcontractor** (text)
- **partnership_model** (text)
- **branding_preference** (text)
- **agency_name** (text)
- **department** (text)
- **facility_types** (text)
- **num_facilities** (text)
- **procurement_contact** (text)
- **contracting_requirements** (text)
- **sdvosb_status** (text)
- **biggest_headache** (text)
- **welcome_email_status** (text)
- **welcome_email_sent_at** (timestamp with time zone)
- **followup_email_status** (text)
- **followup_email_scheduled_for** (timestamp with time zone)
- **status** (text)

### `marketing_actions`
- **id** (uuid, PK)
- **lead_id** (uuid, FK to leads)
- **action_type** (text)
- **status** (text)
- **subject_line** (text)
- **body** (text)
- **created_at** (timestamp with time zone)
- **playbook_key** (text)
- **content_preview** (text)
- **target_details** (jsonb)
- **approval_notes** (text)
- **last_error** (text)
- **sent_at** (timestamp with time zone)
- **scheduled_at** (timestamp with time zone)
- **reviewed_at** (timestamp with time zone)
- **editor_prompt** (text)
- **ai_model** (text)
- **ai_latency_ms** (integer)
- **ai_tokens_usage** (integer)
- **ai_original_body** (text)
- **ai_original_subject** (text)
- **ai_generation_attempts** (integer)

### `calls`
- **id** (uuid, PK)
- **prospect_id** (uuid, FK to partner_prospects)
- **conversation_flow** (jsonb)
- **outcome** (text)
- **notes** (text)
- **goals_met** (jsonb)
- **call_duration** (integer)
- **created_at** (timestamp with time zone)
- **updated_at** (timestamp with time zone)

### `call_logs`
- **id** (uuid, PK)
- **lead_id** (uuid)
- **user_id** (uuid)
- **outcome** (text)
- **notes** (text)
- **checklist** (jsonb)
- **created_at** (timestamp with time zone)

### `chat_logs`
- **id** (uuid, PK)
- **session_id** (text)
- **user_message** (text)
- **bot_response** (text)
- **created_at** (timestamp with time zone)

### `klaire_chat_logs`
- **id** (uuid, PK)
- **session_id** (text)
- **lead_id** (uuid, FK to klaire_leads)
- **user_message** (text)
- **bot_response** (text)
- **created_at** (timestamp with time zone)

### `klaire_leads`
- **id** (uuid, PK)
- **contact_id** (uuid, FK to klaire_contacts)
- **intent** (text)
- **status** (text)
- **full_transcript** (jsonb)
- **created_at** (timestamp with time zone)
- **updated_at** (timestamp with time zone)

### `klaire_contacts`
- **id** (uuid, PK)
- **phone_number** (text)
- **phone_normalized** (text)
- **name** (text)
- **created_at** (timestamp with time zone)
- **updated_at** (timestamp with time zone)

### `chatbot_leads`
- **id** (uuid, PK)
- **phone_number** (text)
- **name** (text)
- **intent** (text)
- **full_transcript** (text)
- **status** (text)
- **created_at** (timestamp with time zone)

### `submissions`
- **id** (uuid, PK)
- **name** (text)
- **email** (text)
- **phone** (text)
- **service** (text)
- **message** (text)
- **status** (text)
- **created_at** (timestamp with time zone)

### `services`
- **id** (uuid, PK)
- **name** (text)
- **description** (text)
- **target_audience** (text[])
- **talking_points** (text[])
- **typical_price_range** (text)

### `brand_profile`
- **id** (uuid, PK)
- **key** (text)
- **value** (text)
- **context** (text)

### `objections`
- **id** (uuid, PK)
- **keyword** (text)
- **response** (text)
- **category** (text)
- **created_at** (timestamp with time zone)
- **updated_at** (timestamp with time zone)

### `escalations`
- **id** (uuid, PK)
- **lead_id** (uuid, FK to leads)
- **reason** (text)
- **notes** (text)
- **status** (text)
- **created_at** (timestamp with time zone)
- **resolved_at** (timestamp with time zone)
- **priority** (text)

### `doc_templates`
- **id** (text, PK)
- **name** (text)
- **version** (text)
- **category** (text)
- **audience** (text[])
- **channels** (text[])
- **subject** (text)
- **body_html** (text)
- **body_text** (text)
- **sms_fallback** (text)
- **required_fields** (text[])
- **attachments** (jsonb)
- **active** (boolean)
- **created_at** (timestamp with time zone)

### `doc_categories`
- **id** (integer, PK)
- **code** (text)
- **name** (text)

### `smart_trigger_rules`
- **id** (integer, PK)
- **rule_id** (text)
- **priority** (integer)
- **active** (boolean)
- **persona** (text[])
- **final_outcome** (text[])
- **pipeline_stage** (text[])
- **pqi_min** (integer)
- **days_since_last_touch_min** (integer)
- **has_recent_signal_type** (text[])
- **suggest_template_id** (text)
- **suggest_channels** (text[])
- **alt_template_id_1** (text)
- **alt_channels_1** (text[])
- **alt_template_id_2** (text)
- **alt_channels_2** (text[])
- **reason** (text)
- **created_at** (timestamp with time zone)

### `script_library`
- **id** (uuid, PK)
- **persona** (text)
- **code** (text)
- **title** (text)
- **body** (text)
- **active** (boolean)

### `playbook_templates`
- **id** (uuid, PK)
- **playbook_key** (text)
- **system_prompt** (text)
- **user_prompt_template** (text)

### `marketing_campaigns`
- **id** (uuid, PK)
- **name** (text)
- **slug** (text)
- **channel** (text)
- **status** (text)
- **start_date** (date)
- **end_date** (date)
- **monthly_budget** (numeric)
- **notes** (text)
- **created_at** (timestamp with time zone)

### `referral_codes`
- **id** (uuid, PK)
- **code** (text)
- **partner_lead_id** (uuid, FK to leads)
- **description** (text)
- **discount_type** (text)
- **discount_value** (numeric)
- **sla_hours** (integer)
- **active** (boolean)
- **valid_from** (timestamp with time zone)
- **valid_until** (timestamp with time zone)
- **max_uses** (integer)
- **uses_count** (integer)
- **created_at** (timestamp with time zone)

### `widget_settings`
- **id** (integer, PK)
- **key** (text)
- **value** (jsonb)
- **updated_at** (timestamp with time zone)

### `global_config`
- **key** (text, PK)
- **value** (jsonb)
- **updated_at** (timestamp with time zone)
- **updated_by** (uuid)

## RLS Policies

**calls**
- Authenticated users can select calls
- Authenticated users can insert calls
- Authenticated users can update calls

**widget_settings**
- Enable read for all
- Enable update for auth

**objections**
- Enable ALL for public

**chatbot_leads**
- Authenticated users can update chatbot_leads
- Public can insert chatbot_leads
- Authenticated users can view chatbot_leads

**chat_logs**
- Public can insert chat_logs
- Authenticated users can view chat_logs

**leads**
- Enable ALL for authenticated users

**doc_templates**
- Enable ALL for public

**global_config**
- global_config_public_read

**app_user_roles**
- Enable ALL for public

**script_library**
- script_library_public_read

**training_leads**
- Enable ALL for public

**submissions**
- Public can read submissions
- Public can delete submissions
- Public can update submissions
- Public can insert submissions

**klaire_contacts**
- Auth users can view contacts
- Service role full access contacts

**klaire_leads**
- Auth users can view leads
- Service role full access leads
- Auth users can update leads

**klaire_chat_logs**
- Anon insert logs
- Auth users can view chat_logs
- Service role full access chat_logs

**partner_registrations**
- Allow read own
- Allow public inserts

**partners**
- Service Role Full Access
- Auth Users Select
- Auth Users Update

**marketing_campaigns**
- Enable full access for authenticated users

**organizations**
- Enable ALL for public

**contacts**
- Enable ALL for public

**properties**
- Enable ALL for public

**evaluations**
- Enable ALL for public

**campaigns**
- Enable all access for authenticated users

**campaign_metrics**
- Enable all access for authenticated users metrics