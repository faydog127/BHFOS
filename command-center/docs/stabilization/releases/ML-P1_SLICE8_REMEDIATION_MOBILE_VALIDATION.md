# ML-P1 S8 Remediation — Mobile Field Validation Notes

| Field | Value |
| --- | --- |
| Status | **Not yet executed on device** (blocked pending Founder migrate/deploy auth) |
| Target | Technician workflow on production UI after remediation Hostinger deploy |

## Script (execute after deploy)

1. Open draft inspection on mobile viewport / device.
2. Capture photo offline → confirm queued; force cache pressure → confirm queued/failed retained.
3. Reconnect → flush → confirm `upload_state=complete`.
4. Mark photo wave → checklist → answer all items.
5. Attempt finalize with unanswered item → refused.
6. Attempt finalize with `photo_required` item unlinked → refused.
7. Link completed photos to required items → finalize once.
8. Double-tap finalize / retry → idempotent success, no partial finalize.
9. Confirm CRM open flags scoped to own tenant only.

## Evidence required

Screenshots or HAR + toast/error codes for deny paths; inspection id (synth) for allow path.
