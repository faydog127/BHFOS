# Phase 5 Mobile Inspection Human UAT

Run only after the Phase 5 migration, frontend, and unchanged inspection AI/PDF functions are approved for a controlled environment. Use synthetic customer data and do not send email.

## Desktop

1. Create a synthetic inspection and select its inspection type.
2. Choose a batch Before/After assignment and upload mixed HEIC/JPEG evidence.
3. Confirm orientation, immutable evidence paths, quality status, and captions.
4. Expand AI details and verify confidence, uncertainty, usability, model/version, and narrative remain available.
5. Accept one photo package, edit one, reject one, and mark one not relevant.
6. Confirm each action decides finding and narrative together and creates one package audit event.
7. Confirm accepted/edited findings are customer-visible by default; test the internal-only override.
8. Confirm finding title, photo caption, and recommendation remain distinct.
9. Select a recommendation and test Custom recommendation.
10. Regenerate, edit, and accept the inspection summary.
11. Run Review & Finalize with one intentional coherence issue and follow its direct action.
12. Resolve the issue, finalize once, download the generated PDF, and inspect every page.
13. Confirm only customer-visible findings/recommendations appear and Send Report to Customer is enabled.
14. Do not send the report.

## iPhone / Mobile

1. Start a timer when the final photo becomes Ready; separately record provider wait and hands-on interaction time.
2. Confirm the default capture mode is Before.
3. Use Take Before Photo for a real HEIC image and confirm it is tagged Before automatically.
4. Capture another Before photo and confirm the mode persists.
5. Use Take After Photo and confirm it is tagged After automatically.
6. Capture a deliberately blurry/dark photo and confirm Retake recommended appears before upload completion.
7. Choose Retake once, then repeat and choose Keep anyway; confirm evidence and warning persist.
8. Confirm no horizontal scrolling and that primary controls are comfortable touch targets.
9. Review one concise card per photo; use View details to inspect technical metadata.
10. Make exactly one Accept/Edit/Reject/Not relevant decision per photo.
11. Confirm recommendation quick choices and Custom recommendation work without pricing.
12. Accept or edit the generated summary once; do not write one from scratch on the happy path.
13. Tap Review & Finalize once, resolve any accurate preflight issue, and confirm the PDF is generated.
14. Download/open the PDF and confirm Send Report to Customer is enabled without sending.

## Measurement

Record for a normal five-photo inspection:

- Provider wait: upload, AI, and PDF seconds.
- Technician interaction time after the final Ready state.
- Taps/actions after final Ready.
- Manual text edits.

Target happy path after final Ready: five photo decisions, one summary approval, one finalization action, no required caption/summary typing, and approximately 2-3 minutes excluding provider wait. Do not mark this target passed until measured on a real iPhone.

## Pass Conditions

- Tenant isolation, evidence immutability, and the existing coherence RPC remain enforced.
- Retry creates a new suggestion version without duplicate findings.
- Rejected/not-relevant packages never enter customer content or recommendation/price-book inputs.
- The PDF contains approved customer content only and remains separate from Estimates.
- Existing inspection-to-Estimate handoff is unchanged.
- No external email is sent and no production cleanup is performed.
