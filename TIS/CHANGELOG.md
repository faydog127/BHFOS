# Changelog

This file tracks meaningful TIS product, reliability, and deployment changes.

Update this file when:
- live behavior changes
- a build is deployed
- validation status changes
- a major workflow is added, removed, or materially reworked

## 2026-03-29

### Added
- `pricing-v1-schema-modifier-matrix.md`:
  - Pricing v1 contract
  - shared pricing schema
  - dryer vent cleaning profile
  - air duct cleaning profile
  - modifier matrix definitions
  - pricing confidence rules
  - pricing intent rules
  - budgetary pricing guide output contract
- `src/utils/pricingV1.js`:
  - Pricing v1 enum registry
  - default payload factory
  - payload normalization/serialization helpers
- `src/utils/pricingV1Resolver.js`:
  - conservative Pricing v1 confidence resolver
  - service-specific quote-block logic
  - intent resolution for `ballpark`, `budgetary_pricing_guide`, and `formal_quote_required`
- `scripts/check-pricing-v1-resolver.mjs`:
  - grouped dryer vent fixture
  - scattered roof-served dryer vent fixture
  - standard air duct fixture
  - quote-block air duct fixture
  - legacy partial record fixture
  - ballpark-only low-confidence fixture
- `src/utils/pricingV1Guide.js`:
  - derived Pricing v1 guide input builder
  - internal modifier engine config
  - budgetary pricing guide contract builder
  - HTML guide renderer
- `scripts/check-pricing-v1-guide.mjs`:
  - budgetary dryer vent guide fixture
  - blocked air duct guide fixture
- `supabase/migrations/20260329_add_pricing_v1_to_tis_assessments.sql`:
  - adds `pricing_v1` to `tis_assessments`

### Changed
- Clarified rep-facing terminology so physical execution access and commercial opportunity access are no longer blended:
  - `Service Access` now refers to physical/service difficulty
  - `Sales Access Path` now refers to the scouting/commercial score formerly shown as generic `Access Path`
- Clarified in specs that resolver/estimate `access` means service execution access, not assessment `access_score`.
- Added pricing-doctrine guidance that `bedroom mix` and `property age` are secondary for dryer vent pricing and should only affect price when they materially change labor, access, or configuration.
- Added future-service guidance that `bedroom mix` and `property age` become more useful if TIS later adds air-duct cleaning logic.
- Wired Pricing v1 into the TIS assessment data model as `assessment.pricing_v1` instead of exploding the schema into dozens of flat columns.
- Updated local SQLite schema, assessment persistence, snapshot import, and Supabase mapping to round-trip `pricing_v1`.
- Updated the assessment smoke workflow to verify `pricing_v1` persistence.
- Implemented a strict `Pricing v1` resolver that:
  - reads from the normalized `assessment.pricing_v1` payload
  - uses base assessment context for canonical building-height and termination data
  - resolves `pricing_confidence` conservatively on partial or legacy records
  - only allows `ballpark` when enough scoped inputs exist to speak directionally without forwarding a guide
  - keeps hard quote-block triggers separate from missing-input fallbacks
- Implemented the first `budgetary_pricing_guide` flow:
  - derives a conservative Pricing v1 planning context from current assessment and builder inputs when explicit pricing fields are still sparse
  - maps internal service config into access, condition, coordination, travel, and efficiency modifiers
  - renders a forwardable HTML guide only when `pricing_intent = budgetary_pricing_guide`
  - blocks guide output and surfaces gate reasons when intent stays `ballpark` or `formal_quote_required`
- Added a new Proposal Builder surface for the guide:
  - preview the HTML artifact
  - copy guide summary
  - copy raw HTML
  - download the guide as `.html`
- Updated the estimate proposal smoke fixture to validate the budgetary guide preview path.

### Validation
- `npm run build` passed
- `node scripts/check-pricing-v1-guide.mjs` passed
- `node scripts/check-pricing-v1-resolver.mjs` passed
- `node scripts/smoke-assessment-workflow.mjs` passed against a local Vite server on `http://127.0.0.1:5175/tis/`
- `node scripts/smoke-estimate-proposal.mjs` passed against a local Vite server on `http://127.0.0.1:5175/tis/`

## 2026-03-27

### Added
- Repository tracking layer:
  - `STATUS.md` for current phase, live state, and next work
  - `CHANGELOG.md` for dated change history

### Changed
- Polished the live `Estimate & Proposal` flow around `Speed Mode v1`.
- Made generated `Talk Track`, `Primary Close Ask`, and `Follow-Up Text` editable with `Reset to Generated`.
- Added clearer stale/synced indicators for:
  - generated copy vs current resolver output
  - `Speed Mode -> Proposal Builder` handoff state
- Removed the resolver debug surface from the rep-facing UI.

### Validation
- `npm run build` passed
- `node scripts/check-speed-mode-resolver.mjs` passed
- `node scripts/smoke-estimate-proposal.mjs` passed against a local Vite server

### Deployed
- Live site updated: `https://app.bhfos.com/tis/`
- Live assets:
  - `index-DufAC7YK.js`
  - `index-3xZ5E12x.css`
- Remote backup created:
  - `~/deploy-backups/tis-20260327-003808`

## 2026-03-26

### Added
- `Speed Mode v1` build artifacts and spec stack:
  - resolver
  - pricing strategy layer
  - copy layer
  - wireframe/build specs
- `Speed Mode -> Proposal Builder` handoff
- Shared pricing model used by both field and builder flows

### Changed
- Reworked `Estimate & Proposal` into a field-first system:
  - `Speed Mode` as the default field surface
  - `Proposal Builder` as the deeper handoff surface
- Removed duplicate field guidance from the main estimate experience.
- Unified pricing posture, anchor, entry option, and phased math across field and builder views.
- Clarified Quick Scout `Access` scoring as opportunity-movement access, not just physical reach.
- Split the hook into:
  - `Observation`
  - `Impact`
  - `Ask`
- Added report deletion for both scout and full audit records.

### Validation
- Controlled offline UAT passed:
  - property create/update
  - offline assessment save
  - reconnect sync
  - Supabase integrity checks
  - no duplicate property or assessment creation

### Deployed
- Multiple live TIS deployments completed during the March 26 workstream for estimate flow, report controls, and field reliability improvements.

## 2026-03-25

### Changed
- Verified and repaired live Supabase schema drift.
- Added missing `tis_properties` columns:
  - `lead_status`
  - `lead_contacted_at`
- Hardened offline/local-save behavior so field data can survive connectivity loss and sync later.

### Validation
- Live schema recheck passed for:
  - `tis_properties`
  - `tis_assessments`
  - `tis_photos`
  - `tis-photos` storage bucket
