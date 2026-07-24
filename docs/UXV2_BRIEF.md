# UXV2_APP_POLISH — A0 Brief + A1 Architecture (Planning)

| Field | Value |
| --- | --- |
| Track | **UXV2_APP_POLISH** — look-and-feel, layout, interaction polish only |
| Production baseline (Hostinger) | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Branch | `ux/v2-polish` |
| Worktree | `F:\Dev\BHFOS-uxv2` |
| Hosting | Hostinger static (`app.bhfos.com`) + Supabase Edge |
| Style ground-truth | **Dispatch** + **Quotes** (desktop + mobile) |
| Code root (A2) | `command-center/src/` (+ authorized test/tooling under `command-center/`) |
| DB migrations | **Forbidden** by default (schema metadata only if Founder re-authorizes) |
| Peer lanes | **Product · Design · Accessibility** (minimum ×3) |
| Founder create | 2026-07-23 — PROJECT SEED `UXV2_APP_POLISH` |

## One-sentence goal

Ship a dedicated V2 polish track that makes the CRM feel like one product—unified brand language, consistent chrome, trustworthy list/money surfaces, a rewritten Hub first viewport, and mobile parity—without new domain features, financial logic, or Stripe scope.

## Relationship to prior UX work

| Slice | On prod (`a12b0f4`) | On `main` (at planning) | V2 posture |
| --- | --- | --- | --- |
| UX-REFACTOR | Partially / via later deploys | Merged + Hostinger history | Keep nav IA; do not reorder primary nav unless Major Decision |
| UX-POLISH | **Not** on this prod tip | Merged (TVG CRM, tokens, exclude helper, chrome finish) | **Absorb / extend** — do not regress; V2 goes further (Hub rewrite, mobile parity, Percy) |

**PD-UXV2-00 (integration base) — Default A:** A2 coding rebases onto current `origin/main` so UX-POLISH is not undone. Seed `MAIN_SHA` remains the **production / Percy rollback baseline**, not the exclusive code parent after planning merge.

## In scope (binding)

1. **Unified brand language** — one product name (**TVG CRM**, Founder-locked unless overridden), one primary colour, one font stack (**Inter** proposed), tokenised in CSS variables + Tailwind (`docs/UXV2_FOUNDATION_TOKENS.md`).
2. **Chrome consistency** — every top-level CRM route uses `CrmPageHeader` + breadcrumb; remove split-era headers.
3. **Data-integrity filtering** — shared helper excludes `is_test_data` **OR** synthetic markers (and `is_legacy` **only if column already exists or Founder authorizes metadata migration**) from **all** money totals and default list queries.
4. **Hub first-viewport rewrite** — single hero **Today** composition; KPI cards collapsed behind a toggle (stricter than UX-POLISH diet).
5. **Mobile parity** — bottom bar covers >90% daily tasks; avoid double-navigation (More drawer) for money-critical pages.
6. **Visual polish** — badge palette aligned to brand; duplicate icons resolved; Inspections search demoted to toolbar; Dispatch/Quotes as gold samples.

## Out of scope (halt)

| Item | Notes |
| --- | --- |
| New domain features / data models | Unless Founder re-authorizes |
| Quote / job / invoice **business-rule** changes | Visual/copy only |
| Auto-charge / Stripe product changes | Halt |
| Photo Bundles · S7 · TIS | Halt |
| PWA / service worker | Not in this seed |
| Blind `is_legacy` migration | Escalate as Major Decision |

## Process

| Phase | Gate |
| --- | --- |
| **A0/A1** | This brief + foundation tokens → peer Product / Design / Accessibility → CI → merge |
| **A2** | Implementation + **unit snapshots** + **Percy visual-diff baseline** (Dispatch & Quotes first) |
| **Synthetic validation** | Smoke on `sk_test` only — **no production mutations**. Prefer existing **Playwright** smoke lanes; Cypress only if Founder insists (tooling Major Decision) |
| **A3** | Deploy auto-continues only if CI + peer APPROVE ×3; Founder interrupt on new Major Decision |

## A2 step plan (post planning merge)

| # | Step | Intent |
| --- | --- | --- |
| 1 | Foundation tokens | Wire `UXV2_FOUNDATION_TOKENS.md` into `index.css` + Tailwind; brand string `TVG CRM` |
| 2 | Chrome sweep | `CrmPageHeader` on all top-level CRM routes; kill split headers |
| 3 | Integrity filter | Extend shared exclude helper; money + default lists; Training Mode polarity preserved |
| 4 | Hub rewrite | Today hero; KPIs behind toggle |
| 5 | Mobile parity | Money-critical destinations in bottom bar / one tap; reduce More-drawer dependency |
| 6 | Visual polish | Badges, icons, Inspections toolbar; match Dispatch/Quotes samples |
| 7 | Visual CI | Percy baselines (Dispatch, Quotes, Hub, mobile 390); unit source guards |

## Success criteria

1. No user-visible dual product name in CRM shell; tokens match foundation doc.  
2. Top-level routes share header/breadcrumb chrome.  
3. Default money totals / list queries exclude test + synthetic markers.  
4. Hub first viewport = Today hero; KPIs not equal-weight first paint.  
5. Mobile bottom bar reaches money-critical daily tasks without More for those paths.  
6. Percy baselines land for gold samples; unit guards green; no migrations unless authorized.  
7. Hostinger A3 only with Access Matrix **S** / Founder.

## Major Decisions (Founder-only)

| ID | Question | Planning default (auto-continue) |
| --- | --- | --- |
| PD-UXV2-01 | Product name | **A:** TVG CRM (locked) |
| PD-UXV2-02 | Primary colour | **A:** TVG accent blue from foundation tokens (charcoal + blue; not purple) |
| PD-UXV2-03 | Font stack | **A:** Inter via `--font-body` |
| PD-UXV2-04 | Hub IA | **A:** Today hero + KPI toggle (not seven equal cards) |
| PD-UXV2-05 | Mobile money paths | **A:** Promote Quotes / Work Orders / Invoices reachability; keep Hub · WO · Quotes · Inspections · More skeleton unless Design peer requires swap |
| PD-UXV2-06 | `is_legacy` | **A:** Pattern + `is_test_data` only; no migration unless Founder authorizes |
| PD-UXV2-07 | Visual tooling | **A:** Percy + existing Playwright smoke (`sk_test`); defer Cypress farm unless Founder requires Cypress specifically |
| PD-UXV2-00 | Code parent for A2 | **A:** Rebase onto current `main` (preserve UX-POLISH); prod SHA = Percy/rollback baseline |

## Escalation (stop auto-continue)

- Schema migrations / RLS / Edge auth changes  
- Payment, auto-send, auto-charge defaults  
- Renaming product away from TVG CRM  
- Primary nav reorder beyond PD-UXV2-05  
- Expanding into domain features or PWA  

## Related artifacts

- Foundation tokens: [`docs/UXV2_FOUNDATION_TOKENS.md`](./UXV2_FOUNDATION_TOKENS.md)  
- Baton: `command-center/docs/governance/RELEASE_BATON.uxv2-app-polish.yaml`  
- Predecessor: UX-POLISH / UX-REFACTOR (main); prod tip `a12b0f4`
