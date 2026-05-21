# TVG System (Drive Layout v1)

Purpose: prevent “context loss across threads/tools” by keeping **one** lightweight system memory file and enforcing simple naming for pilot artifacts.

This is intentionally minimal for the current phase (pilot runs, not scale).

## Drive folder structure (v1)

Create this structure in Google Drive:

```text
/TVG-System
  /Command-Center
    state.md
  /Pilot-Reports
```

Notes:
- Do **not** add `/Jobs` or `/Templates` yet.
- `state.md` is the “memory anchor” for what’s done, what’s in flight, and the next step.

## state.md (required format)

The first line must always be present and updated:

```markdown
Last Updated: YYYY-MM-DD
```

Then keep only these sections:
- Completed
- In Progress
- Next Step

Template lives in:
- `docs/document-library/locked/TVG_System_state_template_v1.md`

## Pilot report naming (required)

Use this naming standard immediately for PDFs:

```text
YYYY-MM-DD__ADDRESS__TYPE.pdf
```

Example:

```text
2026-04-14__730-scott-ave-sw__before-report.pdf
```

Helper script:
- `scripts/pilot-report-filename.ps1`

Usage:

```powershell
pwsh -File scripts/pilot-report-filename.ps1 `
  -Date "2026-04-14" `
  -Address "730 Scott Ave SW, Palm Bay, FL" `
  -Type "before-report"
```

## Enforcement (n8n)

Use n8n to keep `state.md` alive instead of relying on memory.

Workflow:
- `tools/n8n/workflows/tvg-state-update.json`

This workflow:
- fails closed on missing/invalid `X-State-Secret`
- validates required fields
- creates `/TVG-System/Command-Center` and `state.md` if missing
- updates `state.md` content on each accepted request
