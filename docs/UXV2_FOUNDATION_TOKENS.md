# UXV2 Foundation Tokens — A1 Design System Contract

| Field | Value |
| --- | --- |
| Track | UXV2_APP_POLISH |
| Status | Planning default (PD-UXV2-02 / PD-UXV2-03 **A**) |
| Authority | Founder seed 2026-07-23; Design peer may refine within charcoal + TVG blue |
| Implementation targets | `command-center/src/index.css`, `command-center/tailwind.config.js` |
| Gold samples | Dispatch (`Schedule.jsx`), Quotes (`ProposalList.jsx` + document views) |

## Product identity

| Token / constant | Value | Notes |
| --- | --- | --- |
| Product name | `TVG CRM` | Shell, mobile header, document titles where CRM-branded |
| Forbidden shell label | `BHF CRM` | Remove from user-visible CRM chrome |
| Code constant (A2) | `CRM_PRODUCT_NAME` in `src/config/productBrand.js` | Single source |

## Colour roles (HSL channels for shadcn compatibility)

Use space-separated HSL **without** `hsl()` wrapper (shadcn pattern).

### Light

| CSS variable | HSL | Role |
| --- | --- | --- |
| `--brand-primary` | `222.2 47.4% 11.2%` | Charcoal ink / strong text surfaces |
| `--brand-primary-foreground` | `210 40% 98%` | On-primary |
| `--brand-accent` | `221.2 83.2% 53.3%` | **Primary interactive / CTA / nav active** |
| `--brand-accent-foreground` | `210 40% 98%` | On-accent |
| `--primary` | `var(--brand-accent)` | Map shadcn primary → brand accent |
| `--primary-foreground` | `var(--brand-accent-foreground)` | |
| `--ring` | `var(--brand-accent)` | Focus rings |
| `--nav-active` | `var(--brand-accent)` | Sidebar / bottom-bar active |
| `--nav-active-foreground` | `var(--brand-accent-foreground)` | |
| `--cta` | `var(--brand-accent)` | Explicit CTA alias |
| `--cta-foreground` | `var(--brand-accent-foreground)` | |
| `--surface-page` | `var(--background)` | Page canvas |
| `--surface-panel` | `var(--card)` | Panels |

### Dark (optional; do not force dark-mode redesign)

| CSS variable | HSL |
| --- | --- |
| `--brand-accent` | `217.2 91.2% 59.8%` |
| `--brand-primary` | `210 40% 98%` |

### Explicitly avoid

- Purple-on-white / indigo glow themes  
- Warm cream + terracotta “AI default” look  
- Neon glow multi-shadow stacks as brand language  

## Typography

| CSS variable | Value |
| --- | --- |
| `--font-body` | `"Inter", ui-sans-serif, system-ui, sans-serif` |

| Rule | Detail |
| --- | --- |
| Body | `font-family: var(--font-body)` on `body` |
| Tailwind | `theme.extend.fontFamily.sans = ['var(--font-body)']` (or equivalent) |
| Loading | Keep existing Inter `@font-face` / `font-display: swap` |
| Display | Prefer semibold tracking-tight for page titles (Quotes/Dispatch pattern) — no new display font without Founder PD |

## Badge / status palette (align to brand)

Semantic colours stay functional; chrome accents use brand accent.

| Semantic | Guidance |
| --- | --- |
| Success / paid / fresh | Emerald family (existing) |
| Warning / at-risk | Amber |
| Critical / overdue | Red |
| Info / after-hours | Brand-accent blue (not purple) |
| Neutral / draft | Slate |

A2 must invent **no new business statuses** — only restyle existing badges.

## Layout chrome contract

| Element | Contract |
| --- | --- |
| Page header | `CrmPageHeader` with title + optional description + breadcrumbs + actions |
| Breadcrumbs | Hub → current (and record context when applicable) |
| Gold sample density | Quotes list toolbar + Dispatch severity metrics — copy patterns, don’t clone Dispatch backlog rules onto WO board |
| Hub first viewport | Today hero + primary CTAs; KPI strip **collapsed** behind toggle (V2 stricter than UX-POLISH scroll strip) |

## Integrity filter contract (A2 helper)

Live default queries / money totals must exclude rows matching:

1. `is_test_data === true`, **or**
2. Known synthetic identity markers (email `@example.com` / `@example.invalid`, synth name patterns, etc.), **or**
3. `is_legacy === true` **only if** the column already exists in fetched rows — **do not** add migration under default A

Training Mode keeps existing polarity (show test-only where already applied).

## Percy / snapshot surfaces (A2)

Minimum baseline set (desktop + 390 width where noted):

1. Quotes list (gold)  
2. Dispatch board (gold)  
3. Hub (Today hero + KPI collapsed)  
4. Work Orders list  
5. Invoices list  

Unit/source guards accompany Percy (brand string, token presence, header coverage, helper polarity).

## Tailwind mapping checklist

- [ ] `--brand-*` defined in `:root` / `.dark`  
- [ ] `--primary` → brand accent  
- [ ] `--font-body` applied  
- [ ] `nav-active` / `cta` aliases  
- [ ] Optional: small palette plugin **only** if it maps these variables (no new colour religion)

## Change control

Token value changes after planning merge are **Design peer + Founder** if they alter primary accent or font family; minor contrast tweaks within charcoal/blue may ride Design peer APPROVE.
