# TIS Status

Last updated: `2026-03-29`

## Current Phase

`Live v1 field validation`

Meaning:
- core field workflow is built and deployed
- `Speed Mode v1` is live inside `Estimate & Proposal`
- current work is about real field use, friction detection, and targeted tightening
- we are no longer in product-definition mode for this slice

## Live State

- Live URL: `https://app.bhfos.com/tis/`
- Current live bundle:
  - JS: `index-DufAC7YK.js`
  - CSS: `index-3xZ5E12x.css`
- Last live deploy: `2026-03-27 00:38 ET`
- Last live backup: `~/deploy-backups/tis-20260327-003808`

## What Is Live Now

### Field reliability
- local-first assessment saving
- queued sync behavior for offline field use
- reconnect sync path validated
- local protection against silent loss during weak signal

### Data integrity
- Supabase schema aligned for current TIS tables
- property create/update path working
- assessment/photo sync path working
- report deletion available for cleanup of scout/full-audit test data
- Pricing v1 payload now persists on assessments as `pricing_v1`

### Estimate & Proposal
- `Speed Mode v1` is the default field decision layer
- deterministic status resolver is active
- pricing strategy resolves after status
- `Proposal Builder` is the deeper handoff path
- shared pricing model powers both field and builder views
- `Pricing v1` modifier logic now produces a field-send `budgetary_pricing_guide`
- Proposal Builder can preview, copy, and download guide HTML when intent allows it
- generated rep copy is editable with `Reset to Generated`
- stale/synced state is visible for copy and builder handoff

## Most Recent Validation State

### Passed
- `npm run build`
- `node scripts/check-pricing-v1-guide.mjs`
- `node scripts/check-pricing-v1-resolver.mjs`
- `node scripts/check-speed-mode-resolver.mjs`
- `node scripts/smoke-assessment-workflow.mjs`
- `node scripts/smoke-estimate-proposal.mjs`
- controlled offline sync UAT

### Operational confidence
- good enough for live field use
- still needs real-world rep feedback on estimate posture, copy usefulness, and handoff behavior

## Current Focus

Watch for real field feedback on:
- status quality
- talk track usefulness
- pricing posture safety
- proof usefulness
- `Speed Mode -> Proposal Builder` handoff clarity
- terminology clarity between service access and sales access
- whether secondary pricing inputs should be promoted when new services like air-duct cleaning are added

Definition work completed for next build area:

- `Pricing v1` schema + modifier matrix is now documented in:
  - `pricing-v1-schema-modifier-matrix.md`
- conservative `Pricing v1` resolver now exists in:
  - `src/utils/pricingV1Resolver.js`
  - `scripts/check-pricing-v1-resolver.mjs`
- `Pricing v1` modifier engine + HTML guide generation now exist in:
  - `src/utils/pricingV1Guide.js`
  - `scripts/check-pricing-v1-guide.mjs`

Next likely implementation work inside this area:

- render the same artifact to PDF
- add explicit rep-editable `pricing_v1` form inputs instead of relying on derived planning assumptions

## Deferred / Not Done Yet

- full quote artifact generation
- full outbound send/log workflow
- delivery tracking / response tracking
- deeper housekeeping pass on long-term admin/report controls
- outcome-learning layer for estimate strategy tuning

## Next Likely Work

If field use surfaces friction, tighten:
- copy quality
- status edge cases
- strategy selection edge cases
- proof selection behavior
- builder handoff clarity

If field use is stable, next major build area is:
- full estimate outbound flow
- quote generation
- send + track workflow

## Tracking Rule

When meaningful work happens, update both:
- `STATUS.md` for current phase/state
- `CHANGELOG.md` for dated change history

That includes:
- any live deploy
- any workflow change that affects reps
- any validation milestone
- any phase change
