# Release A Human UAT

Run this checklist only after the migration, three Edge Functions, and frontend artifact are approved and deployed to the controlled environment.

## Preconditions

- Use a normal authenticated technician account for tenant `tvg`.
- Use the four retained HEIC files that previously failed plus one JPEG.
- Use a clearly labeled synthetic inspection and an authorized internal test recipient.
- Do not use SQL, developer-created findings, or repair scripts during the workflow.
- Keep delivery in dry-run mode. Do not send email.

## Technician Workflow

1. Create an inspection through the normal CRM UI.
2. Upload all four retained HEIC files and one JPEG as one mixed batch.
3. Confirm each valid file progresses through converting, uploading, and ready states.
4. Confirm portrait and landscape orientation are correct.
5. Confirm no duplicate photo rows or storage objects appear after retrying one upload.
6. Run AI analysis from the Photos tab.
7. Confirm every ready photo shows description, customer caption, confidence, uncertainty, category, and evidence usability.
8. Accept one finding suggestion.
9. Edit one finding suggestion and its customer caption.
10. Reject one suggestion.
11. Mark one suggestion not relevant.
12. Retry one completed analysis and confirm a new analysis version appears without duplicating the accepted finding.
13. Select Review & Finalize and confirm unresolved uploads or AI decisions show exact blockers.
14. Finalize the coherent report revision.
15. Generate the authoritative PDF.
16. Download and visually inspect every PDF page for customer/property data, captions, findings, orientation, page breaks, and absence of internal controls.
17. Confirm Send Report to Customer becomes available only after review and PDF generation.
18. Run report-only delivery in dry-run mode and confirm the attachment metadata without creating a delivery row or sending email.

## Required Platforms

- Desktop Chromium-based browser.
- iPhone Safari or the installed field browser.
- Stable network and one interrupted/retried upload.

## Pass Criteria

- Every valid image reaches Ready exactly once.
- Every eligible photo has a technician-reviewed AI decision.
- AI creates no customer-visible finding or pricing without human action.
- Coherence and tenant-isolation gates remain enforced.
- PDF generation and download succeed through the normal UI.
- Dry-run delivery creates no provider or database side effects.
