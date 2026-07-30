# MIL Quality Cleanup — implementation plan (executed)

**Slice:** Quality Cleanup workflow (Keep / Archive / Trash / Restore / Permanent delete)  
**Out of slice:** near-duplicate identification, large-video Safari/cellular hardening  

## Hard rule

AI may only **recommend** disposition. Humans apply Keep / Archive / Trash. Permanent delete is owner/admin-only after 30 days in Trash. Analyze never writes `trashed_at` / `archived_at`.

## Delivered

| Area | Location |
|---|---|
| Schema + RPCs | `supabase/migrations/20260728120000_media_intel_quality_cleanup_lifecycle.sql` |
| AI disposition | `supabase/functions/media-intel-analyze` (`mil-v2-lifecycle`) |
| Client helpers | `src/lib/mediaIntel/lifecycleHelpers.js`, `api.js`, `roles.js`, `analysisDisplay.js` |
| Review actions | `MediaReviewQueue.jsx` — Keep · Archive · Move to Trash |
| Quality Cleanup | `MediaQualityCleanup.jsx` + nav/route |
| Archive / Trash | `MediaArchive.jsx` tabs + gated permanent delete |
| Exclusions | listAssets default, dashboard, creator/settings pickers, analyze skip, promote gate |

## Follow-ups

1. Duplicate identification / preferred-of-group  
2. Large-video upload hardening on cellular Safari  
