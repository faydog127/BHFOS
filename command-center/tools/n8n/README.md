# n8n (local)

This repo does not ship an n8n instance by default. Use the included `docker-compose.n8n.yml` to run one locally.

## Start

1) Create your local env file:

- Copy `.env.n8n.example` → `.env.n8n`
- Set `N8N_BASIC_AUTH_PASSWORD`
- Set `N8N_ENCRYPTION_KEY` (keep it stable forever for this instance)
- Set `REVIEW_GATE_SECRET`, `REVIEW_WORKFLOW_VERSION`, `REVIEW_GATE_DRIVE_ROOT_FOLDER_ID` (required for the review gate workflow)

2) Start n8n:

```powershell
docker compose --env-file .env.n8n -f docker-compose.n8n.yml up -d
```

3) Open the editor:

- `http://localhost:5679`

## Enable ChatGPT/OpenAI

1) In the n8n UI go to **Credentials** → **New** → **OpenAI API**
2) Paste your OpenAI API key (or set it to `{{$env.OPENAI_API_KEY}}` if you set `OPENAI_API_KEY` in `.env.n8n`)

## Import the example workflow

Import `tools/n8n/workflows/chatgpt-webhook.json` via the n8n UI (**Workflows** → **Import from File**).

Then test it:

```powershell
curl.exe -s -X POST http://localhost:5679/webhook-test/chat ^
  -u admin:YOUR_PASSWORD ^
  -H "Content-Type: application/json" ^
  -d "{ \"prompt\": \"Say hello in one sentence.\" }"
```

If you activate the workflow, the URL becomes:

- `http://localhost:5679/webhook/chat`

Note: if `N8N_BASIC_AUTH_ACTIVE=true`, webhook requests require basic auth or will appear as a 404.

## No-credential option (recommended for quick local tests)

Import `tools/n8n/workflows/chatgpt-webhook.http-openai.json`.

Webhook path:

- `http://localhost:5679/webhook/chat-http/`

This workflow uses `OPENAI_API_KEY` from `.env.n8n` and does not require creating an n8n OpenAI credential.

## Review gate workflow (OpenAI → Drive)

Import `tools/n8n/workflows/review-gate-webhook.json` and configure:

- **OpenAI API** credential (for `OpenAI Review`)
- **Google Drive OAuth2** credential (for `Drive Create File`)

Webhook path:

- Test: `http://localhost:5679/webhook-test/review-gate` (only works right after clicking **Execute workflow**)
- Active: `http://localhost:5679/webhook/review-gate`

Payload contract (required fields):

- `artifact_id`, `artifact_title`, `artifact_type`, `artifact_version`, `review_type`, `submitted_by`, `content`

Optional:

- `high_stakes` (`\"true\"` or `\"false\"`, defaults to `\"false\"`; `\"true\"` forces High-Stakes Review)
- `constraints.model` (OpenAI model id; defaults to `gpt-4o-mini`)

Security:

- Requests must include header `X-Review-Secret: <value of REVIEW_GATE_SECRET>`

Contract source of truth:

- `docs/review-board/Review-Board-Operating-System.txt`

Drive routing:

- Root folder: `$env.REVIEW_GATE_DRIVE_ROOT_FOLDER_ID`
- Subfolder name is `review.revised_decision` (auto-created if missing):
  - `Kill`, `Park`, `Prototype`, `Harden`, `Pilot`, `Produce`, `Scale`

Acceptance checks (expected behavior):

1) Empty `content` → `status:\"error\"`, `stage_failed:\"validation\"`, no Drive file
2) Missing field → `status:\"error\"`, `stage_failed:\"validation\"`, `details` contains missing field names
3) Valid payload → `status:\"success\"` with `file_id`, Drive file created
4) Forced OpenAI failure (`constraints.force_openai_fail: true`) → `status:\"error\"`, `stage_failed:\"openai\"`, no Drive file
5) Forced Drive failure (`constraints.force_drive_fail: true`) → `status:\"error\"`, `stage_failed:\"drive\"`, no success response
6) OpenAI returns non-JSON / wrong JSON → `status:\"error\"`, `stage_failed:\"openai\"`, no Drive file

Test harness (validation/auth focused):

```powershell
pwsh -File scripts/review-gate-tests.ps1 `
  -Url "http://localhost:5679/webhook-test/review-gate" `
  -Case missing_secret
```

With secret (and optional basic auth):

```powershell
pwsh -File scripts/review-gate-tests.ps1 `
  -Url "http://localhost:5679/webhook-test/review-gate" `
  -Case short_content `
  -ReviewSecret "YOUR_REVIEW_GATE_SECRET" `
  -BasicAuthUser admin `
  -BasicAuthPassword "YOUR_PASSWORD"
```

## Review Board Processor (Workflow #2)

Import `tools/n8n/workflows/review-board-processor.http-openai.json`.

Webhook path:

- Test: `http://localhost:5679/webhook-test/review-board-processor` (only works right after clicking **Execute workflow**)
- Active: `http://localhost:5679/webhook/review-board-processor`

This workflow:

- Fails closed on invalid input (`artifact_name`, `current_stage`, `artifact_text` required; stage allowlist; `artifact_text` <= 25000 chars)
- Calls OpenAI via HTTP using `OPENAI_API_KEY` from `.env.n8n`
- Forces JSON-only output and validates it before Drive write
- Saves a `.json` review file into `01 Under Review` (override folder id with `REVIEW_BOARD_UNDER_REVIEW_FOLDER_ID` if needed)

Test harness (one-shot in test mode):

```powershell
pwsh -File scripts/review-board-processor-tests.ps1 -Url "http://localhost:5679/webhook-test/review-board-processor" -Case missing_field
```

If `N8N_BASIC_AUTH_ACTIVE=true`, pass basic auth:

```powershell
pwsh -File scripts/review-board-processor-tests.ps1 `
  -Url "http://localhost:5679/webhook-test/review-board-processor" `
  -Case missing_field `
  -BasicAuthUser admin `
  -BasicAuthPassword "YOUR_PASSWORD"
```

## Patch a cloud workflow via API (optional)

If your n8n instance has API access enabled, `scripts/n8n-fix-review-board-processor.ps1` will patch an existing workflow in-place (validation code + gating + respond behavior).

## TIS → n8n pilot intake (Webhook only)

Import `tools/n8n/workflows/tis-pilot-intake.json`.

Webhook path:

- Test: `http://localhost:5679/webhook-test/tis-pilot-intake` (only works right after clicking **Execute workflow**)
- Active: `http://localhost:5679/webhook/tis-pilot-intake`

Security:

- Requests must include header `X-TIS-Secret: <value of TIS_PILOT_SECRET>`
- Set `TIS_PILOT_SECRET` in `.env.n8n`

Payload contract (source of truth):

- `docs/tis/TIS_N8N_PILOT_PAYLOAD_CONTRACT_v1.md`

Drive persistence (pilot):

- This workflow writes the validated intake into Google Drive as:
  - `/TVG-System/Command-Center/Accepted-Intake/<job-id>/intake.json`
- Pre-create these Drive folders once (the workflow expects them to exist):
  - `/TVG-System/Command-Center`
  - `/TVG-System/Command-Center/Accepted-Intake`
- Required env var in `.env.n8n`:
  - `TVG_SYSTEM_ROOT_FOLDER_ID` = Drive folder id for `/TVG-System`
- In the n8n UI, set the Google Drive nodes to use your **Google Drive OAuth2** credential (for example `Google Drive account`).

Test harness:

```powershell
pwsh -File scripts/tis-pilot-intake-tests.ps1 `
  -Url "http://localhost:5679/webhook-test/tis-pilot-intake" `
  -Case valid `
  -TisSecret "YOUR_TIS_PILOT_SECRET" `
  -BasicAuthUser admin `
  -BasicAuthPassword "YOUR_PASSWORD"
```

## TVG System state updater (Webhook → Drive)

Import `tools/n8n/workflows/tvg-state-update.json`.

Webhook path:

- Test: `http://localhost:5679/webhook-test/tvg-state-update` (only works right after clicking **Execute workflow**)
- Active: `http://localhost:5679/webhook/tvg-state-update`

Security:

- Requests must include header `X-State-Secret: <value of TVG_STATE_SECRET>`
- Set `TVG_STATE_SECRET` in `.env.n8n`

Drive config:

- Set `TVG_SYSTEM_ROOT_FOLDER_ID` to the Google Drive folder ID of `/TVG-System`

Payload contract (required fields):

- `completed` (string[])
- `in_progress` (string[])
- `next_step` (string[])
- Optional: `last_updated` (`YYYY-MM-DD`)

This workflow creates/updates:

- `/TVG-System/Command-Center/state.md`

Test harness:

```powershell
pwsh -File scripts/tvg-state-update-tests.ps1 `
  -Url "http://localhost:5679/webhook-test/tvg-state-update" `
  -Case all
```
