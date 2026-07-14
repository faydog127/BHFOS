# Inspection Content-Contract Production Release

Status: **READY FOR OPERATOR PACKAGING — NOT DEPLOYED**
Decision locked: ship **content/workflow validation as-is**; visual polish deferred.

## 1. Release identity

| Field | Value |
| --- | --- |
| Working branch | `inspection-mobile-ux-phase5` |
| Latest committed tip (before this package) | `91f3c16` — mobile capture / report finalization |
| Release theme | Customer report content contract + finalize safety + mobile/tech workflow |
| Frontend target | `https://app.bhfos.com` (Hostinger static) |
| Supabase project | `TVG Website-CRM` (`wwyxohjnyqnegzbxtuxs`) |
| Controlled delivery recipient (if any send test) | `ol_mann@yahoo.com` only |
| Visual polish | **Out of scope** (logo refinement / Fortune-500 design pass later) |

### Product contract being shipped

1. Photos = supporting evidence
2. AI = draft paperwork
3. Technician = decision-maker
4. `inspections.summary` = one customer Findings narrative
5. One inspection-level Service Recommendation (`finding_id` is null)
6. Estimates own pricing
7. Customer PDF renders Findings → Supporting Evidence → Service Recommendation → Important Notes

## 2. Pre-release gate (must complete before any production action)

Working tree currently contains **uncommitted** release-critical files. Do **not** deploy from a dirty tree.

### Required commit set (include)

**Migrations (additive, ordered):**

1. `supabase/migrations/20260713180000_phase_a_internal_ai_findings.sql`
2. `supabase/migrations/20260713190000_phase_b_findings_narrative.sql`
3. `supabase/migrations/20260713200000_phase_b_manual_condition_status.sql`
4. `supabase/migrations/20260713210000_p0a_voided_photo_pending_ai.sql`
5. `supabase/migrations/20260713211000_p0b_preflight_recommendation_bridge.sql`
6. `supabase/migrations/20260713212000_fix_mark_reviewed_transition_guc.sql`

**Also required if not already on production (already on this branch tip):**

- `supabase/migrations/20260712233000_phase5_mobile_inspection_workflow.sql`
- Prior inspection chain from previous controlled release docs (verify with dry-run; do not assume)

**Edge Function:**

- `supabase/functions/inspection-report-pdf/index.ts` (Phase E customer PDF + branding embed fallback)

**Frontend / client:**

- `src/components/tech/InspectionFindingsNarrativeCard.jsx`
- `src/components/tech/InspectionPreflightBlockers.jsx`
- `src/components/tech/ManualConditionReviewControls.jsx`
- `src/components/tech/InspectionAiReviewPanel.jsx`
- `src/lib/inspectionFindingsNarrative.js`
- `src/lib/inspectionPreflightBlockers.js`
- `src/pages/crm/inspections/InspectionEditor.jsx`
- `src/pages/tech/TechInspectionReview.jsx`
- `src/pages/tech/TechInspectionSession.jsx`

**Focused tests (ship with release for CI/regression; not deployed):**

- `tests/smoke/phase-e-customer-report-pdf.spec.js`
- `tests/smoke/p0a-voided-photo-pending-ai.spec.js`
- `tests/smoke/p0b-preflight-recommendation-bridge.spec.js`
- `tests/smoke/inspection-findings-narrative.spec.js`
- `tests/smoke/inspection-findings-narrative-hardening.spec.js`
- `tests/smoke/inspection-phase-a-ai-internal-findings.spec.js`
- `tests/smoke/manual-condition-review.spec.js`
- `tests/smoke/inspection-preflight-blockers.spec.js`
- `tests/smoke/fresh-airduct-report-uat.spec.js` (local synthetic only)
- related mobile/report smoke updates already on branch

### Do not include

- Logo polish / Fortune-500 redesign
- Phase C recommendation-picker UI (bridge uses existing `finding_id null` rec)
- Unrelated AGENTS/docs churn unless intentionally reviewed
- Root monorepo `.cursor*` noise unless explicitly approved
- Any production secret values in git

### Packaging steps (git)

1. Review `git status` / `git diff` on `inspection-mobile-ux-phase5`.
2. Commit the required set with a clear message (example):
   `feat(inspections): ship content-contract PDF and finalize gates`
3. Push branch and open PR into the approved production integration branch.
4. Record the **release commit SHA** in this document’s Release Log before deploy.
5. Tag optional: `inspection-content-contract-YYYYMMDD`.

## 3. Runtime configuration (names only)

Confirm present in production (do not print values):

- `PDFSHIFT_API_KEY` — required for polished HTML PDF path
- `OPENAI_API_KEY` / `OPENAI_MODEL` — AI analyze (existing)
- `RESEND_API_KEY` — only if send tests are authorized
- `PUBLIC_APP_URL` / quote public URLs — existing delivery stack
- Storage buckets private: `inspection-photos`, `inspection-reports`
- Brand assets in `vent-guys-images` (correct logo preferred; public fallback exists for missing local assets)

## 4. Deployment order (authorized operator only)

Stop after any failure. No improvisation.

1. **Written approval** from founder/operator.
2. Confirm linked project is `wwyxohjnyqnegzbxtuxs` and healthy.
3. Hostinger `public_html` full timestamped backup; verify restore path.
4. Record current frontend fingerprints + function versions + migration list.
5. `supabase db push --linked --dry-run` — review exact pending list; must include this release’s migrations (and any still-pending prior inspection migrations).
6. Apply migrations in timestamp order. Stop on error.
7. Deploy Edge Function **`inspection-report-pdf`** from the release commit.
8. Build frontend from the release commit; upload complete static bundle to `app.bhfos.com/public_html`.
9. Run synthetic acceptance below.
10. Only if authorized: one controlled delivery to `ol_mann@yahoo.com`.

### Hard dependencies

| Dependency | Why |
| --- | --- |
| `20260713212000_fix_mark_reviewed_transition_guc.sql` | Without it, Finalize-after-Submit fails with “Inspection is locked…” |
| `20260713211000_p0b_...` | Preflight requires accepted narrative + one inspection-level rec |
| Phase E `inspection-report-pdf` | Old PDF layout will ignore the new content contract |
| Frontend narrative + preflight UI | Techs cannot complete the new gate without it |

## 5. Stop conditions

Stop immediately if:

- Wrong Supabase project / unhealthy project
- Dry-run pending list unexpected or conflicts with production-only versions
- Any migration fails
- `PDFSHIFT_API_KEY` missing (PDF will silently fall back to basic `local_pdf`)
- Storage buckets become public
- Cross-tenant data appears in tests
- Any test targets a real customer other than the controlled recipient
- Finalize works without the GUC migration (indicates wrong function/DB pairing)

## 6. Rollback

| Layer | Action |
| --- | --- |
| Frontend | Restore Hostinger backup; verify fingerprints |
| Function | Redeploy previous accepted `inspection-report-pdf` bundle/commit |
| Database | **No destructive rollback.** Stop inspection finalization writes; preserve audit; use separately reviewed forward repair |

Historical already-delivered PDFs are not regenerated by this release.

## 7. Synthetic production acceptance (required)

Use clearly labeled synthetic records only.

1. Create draft inspection with photos; void one dark/unusable photo; confirm pending AI on voided photo does not block.
2. Accept AI conditions as **internal** (not auto customer findings).
3. Generate/accept Findings narrative (`inspections.summary`).
4. Add **one** customer-visible Service Recommendation with `finding_id` null.
5. Preflight returns `[]`.
6. Submit → Finalize succeeds (proves GUC fix).
7. Generate PDF via `inspection-report-pdf`:
   - `meta.renderer_used === "pdfshift"` preferred
   - Findings narrative once
   - Supporting Evidence (no voided photo)
   - Exactly one Service Recommendation
   - No “Technician-Approved Findings”
   - No per-finding “Recommended:”
   - No prices
   - Separate-estimate disclaimer present
8. Mobile tech review: Report tab usable; Download PDF works.
9. Cleanup synthetic rows per approved path; keep audit evidence only.

### Explicit non-goals for this acceptance

- Perfect logo / Fortune-500 visual polish
- Phase C recommendation UX redesign
- Estimate pricing changes

## 8. Local validation already completed (evidence)

| Check | Result |
| --- | --- |
| Fresh Air Duct E2E finalize + PDF | Passed (synthetic) |
| Phase E PDF contract smoke | Passed |
| PDFShift path with local secret | Passed (`renderer_used: pdfshift`) |
| Voided-photo pending AI (P0a) | Passed |
| Preflight recommendation bridge (P0b) | Passed |
| Branding polish | Deferred; logo fallback acceptable for content ship |

## 9. Release log (fill at execute time)

| Step | Operator | UTC time | Evidence / SHA / notes |
| --- | --- | --- | --- |
| Release commit recorded | | | |
| Hostinger backup verified | | | |
| DB dry-run reviewed | | | |
| Migrations applied | | | |
| `inspection-report-pdf` deployed | | | |
| Frontend uploaded | | | |
| Synthetic acceptance pass | | | |
| Controlled send (optional) | | | |
| Cleanup complete | | | |

## 10. Founder decision summary

- **Ship now:** content contract + finalize gates + PDF structure.
- **Defer:** visual design polish.
- **Do not deploy** until the uncommitted set is committed, PR’d, dry-run reviewed, and this checklist is filled.
