# Migrations Log

Record every migration here (and store up/down scripts in this folder if applicable).

Template (copy/paste per migration):

```
## <id>-<slug> (YYYY-MM-DD)
- Owner: <name>
- Up steps:
  - ...
- Down steps:
  - ...
- Risk/notes:
  - ...
- Snapshot/backup:
  - Taken? (yes/no) Reference:
  - Restore steps if needed:
```

Guidelines:
- Prefer reversible migrations; include down steps.
- For risky changes, take a snapshot/backup and note it here.
- Run DB migrations separately from app deploys when possible.
