# Media Intelligence Library — Phase 0 Plan & Risk Assessment

**Branch:** `feat/media-intelligence-library`  
**Worktree:** `F:\Dev\BHFOS-media-intel` (isolated from dirty `F:\Dev\BHFOS`)  
**Baseline SHA:** `9369d206bfbcaf32267e9e88518b222146e11de8`  
**Host app:** `command-center/` (Vite/React) — MIL product routes `/media/*` and `/creator/*`  
**Architecture:** Single-company for The Vent Guys (`SINGLE_COMPANY_CORRECTION.md`)  
**Deploy boundary:** no merge to `main`, no production CRM deploy, no `vent-guys.com` changes without separate authorization.

## Discovery summary

| Area | Finding | Decision |
|---|---|---|
| Application | CRM Command Center hosts private ops tools | Build MIL beside CRM shell, not marketing site |
| Company model | BHFOS is single-company; V1 CRM still has legacy tenant routing | MIL: no `tenant_id`, no tenant routes; authorize by role/capability/resource |
| Auth / roles | `app_user_roles` with admin/manager/office/technician; weak UI-only AdminRoute | Add `media_reviewer` + `reel_creator` + `phone_uploader`; enforce via RLS + SECURITY DEFINER helpers by `user_id` |
| Private media today | `inspection-photos`, `inspection-reports` | **Leave untouched** — new private buckets |
| Public website media | `website-public-media` / `website_media` (marketing site) | **Publication end only** — promote privacy-cleared derivatives via explicit admin action |
| AI | OpenAI via edge functions / `OPENAI_API_KEY` | Provider-adapter edge function; no-key fallback queues analysis |
| Uploads | Inspection pipeline + `tus-js-client` already in package.json | Resumable TUS to Supabase Storage + checksum manifests |
| Design system | CRM Inter/shadcn slate/blue | Follow CRM design system (internal tool); Vent Guys brand assets reserved for public site |

## Reuse / extend / replace / leave

- **Reuse:** Supabase auth, `app_user_roles` (role by user), FeatureGuard pattern, TUS client, OpenAI edge secret contract, website promotion target tables/bucket.
- **Extend:** Role vocabulary; CRM primary nav link to `/media`; Media Library sub-IA; audit logging patterns.
- **Replace:** Nothing existing. Do not repurpose inspection or public website buckets for private intake.
- **Leave untouched:** Inspection storage/tables, existing approved website media, social integrations (none), CRM job/inspection private storage.

## Architecture (authorized scope)

```
Phone dump → mil_upload_batches + mil_manifest_entries
           → private bucket media-intel-originals (immutable)
           → exact checksum de-dupe (near-dupe suggestions later)
           → derivatives in media-intel-derivatives
           → AI suggestions (mil_ai_analyses) — never auto-verified
           → human review (independent processing / review / privacy / use dims)
           → collections / B&A proposals (unverified until human confirm)
           → creator-visible only when marketing/reel approved or assigned
           → reel projects + versions → owner approve/deny/revision
           → optional explicit promote → privacy-stripped derivative → website_media
```

**Governing rule:** AI suggests; humans verify. No social scheduling/publishing.

## Implementation slices

1. Schema + private buckets + RLS + role helpers + audit  
2. Media shell (11 nav destinations) + dashboard counts  
3. Resumable upload + transfer manifest + recovery  
4. Derivatives/previews + original immutability  
5. AI adapter + review queue + provenance  
6. Collections + before/after confirmation  
7. Creator workspace + reel versioning/review  
8. Website promote (explicit) + backup/export docs + tests  

## Risks

| Risk | Mitigation |
|---|---|
| Dirty main BHFOS tree | Work only in this worktree |
| Weak client AdminRoute | Server RLS + role helpers; ignore client ownership claims |
| Creator over-access | Separate SELECT policies; no raw intake paths for creators |
| Accidental public exposure | Private buckets; short-lived signed URLs; website never reads originals |
| AI key missing | Upload/review/manual tag still work; honest “AI not configured” state |
| Cost blowups | Checksum de-dupe before AI; batch/selective analysis; thumbnails for grids |
| `app.bhfos.com` = production CRM | Prefer local/staging apply; no prod deploy without authorization |
| HEIC | Store original immutable; convert to preview derivative only |
| website_media in marketing repo | Promote via service-role edge fn against shared Supabase project |

## Owner decisions (non-blocking defaults)

1. **Creator invite:** Supabase user + `app_user_roles.role = 'reel_creator'` (revocable).  
2. **Staging:** Local/dev Supabase or authorized staging project only until deploy is authorized.  
3. **Internal UI brand:** CRM design system (not inventing a new public brand).

## Explicit non-goals (confirmed)

Automated content creation, social connections/scheduling/publishing, facial recognition, phone deletion, destructive de-dupe, deep CRM job replacement, production deploy without separate auth.
