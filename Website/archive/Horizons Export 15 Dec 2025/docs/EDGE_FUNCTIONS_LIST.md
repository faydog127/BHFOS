# Supabase Edge Functions List

## Active Functions
- acquire-signals
- admin-config-list
- admin-config-upsert
- admin-deactivate
- admin-invite
- admin-set-role
- admin-users-list
- agent-alpha
- alpha-chat
- alpha-chat-v2
- capture-lead
- console-save-call
- decay-pqi
- execute-sql
- find-and-score-leads
- generate-brief
- generate-campaign-content
- generate-marketing-copy
- generate-scripts
- klaire-chat
- lead-intake
- leads
- metrics-template-week
- notify-escalation
- partner-register
- pipeline-list
- pipeline-transition
- process-marketing-action
- score-lead
- scripts-by-persona
- send-partner-email
- send-partner-registration
- send-template
- smartdocs-send
- smartdocs-suggest
- submit-form
- update-checklist
- _shared (Shared Library)

## Function Signatures (Partial List from Source)

### `calls`
- **Endpoint:** `/calls`
- **Method:** POST
- **Payload:** `{ lead_id, from_number, to_number, direction, disposition, notes, duration_sec, recording_url }`

### `execute-sql`
- **Endpoint:** `/execute-sql`
- **Method:** POST
- **Payload:** `{ scriptKey }` (e.g., 'critical', 'high', 'medium')

### `klaire-chat`
- **Endpoint:** `/klaire-chat`
- **Method:** POST
- **Payload:** `{ messages, sessionId }`

### `leads`
- **Endpoint:** `/leads`
- **Method:** POST
- **Payload:** `{ first_name, phone, service_type, customer_type, source_kind, ... }`

### `submit-form`
- **Endpoint:** `/submit-form`
- **Method:** POST
- **Payload:** `{ name, email, phone, service, message }`