# Inspection Production Release

## Release Identity

- Source commit: `e7916f7caf5fe8132d728bae9844320ab9f4a2cd`
- Release branch: `inspection-production-release`
- Supabase project: `TVG Website-CRM` (`wwyxohjnyqnegzbxtuxs`)
- Supabase region/status: `us-east-1`, `ACTIVE_HEALTHY`
- Frontend target: `https://app.bhfos.com` on Hostinger static hosting
- Controlled test recipient: `ol_mann@yahoo.com`

## Production Frontend Baseline

Hostinger does not expose a recoverable Git commit for the current static deployment. Treat the baseline as `STATIC DEPLOYMENT - COMMIT NOT RECOVERABLE` and use this inventory:

| Asset | Size | Last modified (UTC) | SHA-256 |
| --- | ---: | --- | --- |
| `/index.html` | 4,172 bytes | 2026-06-10 19:38:36 | `283bd1449e23901402cfefbf887cb9f5fa828c6a961431a3ecbc8913402c6fa2` |
| `/assets/index-ad20b598.css` | 187,955 bytes | 2026-06-10 19:38:36 | `ad20b5984c03b6d22013f1af32bcbf3195dfe726a9f2415bd8a1bb927bb13deb` |
| `/assets/index-f5c7ba5b.js` | 832,595 bytes | 2026-06-10 19:38:36 | `31010cdd3a34aea5d3f55f7af29642e2f2ecca6897f8b4423f02a86791405fb0` |

Before upload, create a complete timestamped backup of the current `app.bhfos.com/public_html` directory using Hostinger File Manager or a full archive/download. Verify the backup contains `index.html`, all asset directories, and the two fingerprinted assets above. Record the backup filename and restore test evidence in the release log. Do not upload unless this backup is complete and retrievable.

## Supabase Baseline

The authenticated CLI project listing, linked project reference, API host, and repository production reference all identify `wwyxohjnyqnegzbxtuxs`. The project is active and healthy in `us-east-1`.

Production migration history is ordered and has no production-only version. `supabase db push --linked --dry-run` reports exactly these pending migrations:

1. `20260710143000_inspection_ai_review.sql`
2. `20260711120000_inspection_quote_delivery.sql`
3. `20260711121000_inspection_quote_context.sql`
4. `20260711130000_inspection_smart_quote_prefill.sql`
5. `20260711140000_phase4_field_workflow_hardening.sql`

The applied inspection baseline includes `20260710120000_inspection_production_hardening.sql`. The dry-run found no missing-local migration, out-of-order version, partial version, or migration-history conflict.

## Runtime Configuration

Required configured secret names were verified without reading values:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `PDFSHIFT_API_KEY`
- `RESEND_API_KEY`
- `PUBLIC_APP_URL`
- `PUBLIC_QUOTE_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Both `inspection-photos` and `inspection-reports` exist and are private. Tenant-scoped RLS policies exist for inspection records and both storage paths. The six required default price-book codes are active: `DUCT-BLOW`, `COIL-CLEAN`, `DV-STD`, `EXT-HOOD-NO`, `EXT-GUARD-STD`, and `DUCT-SYS1`.

## Function Delta

| Function | Production state | Release action | JWT gateway setting |
| --- | --- | --- | --- |
| `inspection-ai-analyze` | Missing | Deploy | `verify_jwt = false`; function verifies the user internally |
| `inspection-report-pdf` | Active, version 1 | Update | `verify_jwt = false`; function enforces its current authorization path |
| `inspection-report-send` | Missing | Deploy | `verify_jwt = false`; function verifies the user internally |
| `send-estimate` | Active, version 143 | Update | `verify_jwt = false`; function requires verified claims internally |
| `send-invoice` | Active, version 81 | Update | `verify_jwt = false`; function requires verified claims internally |
| `send-receipt` | Active, version 24 | Update | `verify_jwt = false`; function requires verified claims internally |

## Deployment Order

1. Confirm written deployment approval and an operator with Hostinger and Supabase access.
2. Create and verify the complete timestamped Hostinger `public_html` backup described above.
3. Record the current frontend fingerprints, production migration list, and function versions in the release log.
4. Apply the five pending migrations in the exact order listed above. Stop after any error.
5. Verify migration history and confirm there are no remaining unexpected migrations.
6. Deploy `inspection-report-pdf`, then `inspection-ai-analyze`, then `inspection-report-send`.
7. Deploy `send-estimate`, `send-invoice`, and `send-receipt` from this release commit.
8. Verify function status/version metadata and secret-name presence without invoking customer workflows.
9. Build the frontend from this release commit, record the generated asset hashes, and upload the complete static bundle to `app.bhfos.com/public_html`.
10. Run the synthetic production acceptance plan below.

## Stop Conditions

Stop immediately if the Supabase project is not `wwyxohjnyqnegzbxtuxs`, project status is not healthy, migration history differs from this runbook, a migration fails, a required secret name is missing, either storage bucket becomes public, required RLS policies are absent, price-book codes are inactive, the Hostinger backup is incomplete, or any test would target a recipient other than `ol_mann@yahoo.com`.

Do not continue after an unexpected schema change, cross-tenant result, unauthorized success, duplicate delivery, real-customer data exposure, or provider rejection.

## Rollback

- Frontend: replace all current `public_html` contents with the verified pre-release backup, then confirm the baseline `index.html`, CSS, and JavaScript fingerprints.
- Functions: redeploy the archived pre-release function bundles or the previously accepted source commits and verify their metadata versions.
- Database: do not improvise destructive rollback SQL. Stop writes to the inspection workflow, preserve audit evidence, and use a separately reviewed forward repair unless an approved migration-specific rollback has been prepared and tested.
- Secrets: no secret changes are planned. If an operator changes one outside this runbook, restore it through the approved secret-management process without recording its value.

## Synthetic Production Acceptance

Use clearly labeled synthetic inspection, customer, property, quote, and delivery records only. Use only `ol_mann@yahoo.com` for real delivery.

1. Verify authenticated tenant isolation, private photo upload, real AI advisory analysis, technician accept/edit/reject, report review, and immutable original evidence.
2. Verify an unreviewed report cannot send and a reviewed report can send independently.
3. Create one linked draft quote from approved findings and active price-book items; verify repeat creation does not duplicate it and AI does not set authoritative pricing.
4. Send `TEST - Report Only` once.
5. Send `TEST - Report + Quote` once and verify the report and quote remain distinct documents or links.
6. Perform one intentional resend with a recorded reason; verify it creates a separate audited event while accidental duplicate protection remains active.
7. Confirm provider acceptance, delivery/audit rows, and generated attachments or links.
8. Manually confirm in `ol_mann@yahoo.com`: receipt, TEST subject/body, report opens, quote opens, and report/quote are distinct.
9. Remove all synthetic production records through the approved cleanup path and retain only required audit evidence.

