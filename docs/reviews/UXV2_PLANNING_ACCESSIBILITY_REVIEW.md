# UXV2_APP_POLISH Planning — Accessibility Peer Review

| Field | Value |
| --- | --- |
| Lane | ACCESSIBILITY |
| PR | https://github.com/faydog127/BHFOS/pull/121 |
| Exact HEAD (content) | `af9d4ee` |
| Production baseline | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Reviewed | 2026-07-23 |
| Verdict | **APPROVE** |

## Checks

| Focus | Result |
| --- | --- |
| Chrome consistency aids orientation | Pass — shared `CrmPageHeader` + breadcrumbs |
| Focus rings bound to brand accent | Pass — `--ring` → accent in tokens doc |
| Mobile parity reduces double-nav traps | Pass — money-critical paths called out |
| KPI collapse not content-only-via-hover | Pass — toggle is explicit control (A2 must keep keyboard operable) |
| No colour-only status system mandated | Pass — badges keep semantic families + text labels expected |
| Visual CI does not replace a11y | Pass — Percy is visual regression; A2 should keep labels/`aria-label` on icon actions |

## A2 accessibility expectations (binding reminders)

1. KPI toggle: button with accessible name; expanded state announced.  
2. Bottom bar: visible focus; current route indicated by more than colour.  
3. Do not remove text from status badges in favour of colour-only chips.

## Residual (non-blocking)

- Full axe CI farm remains optional; lane APPROVE does not require new a11y CI package in planning.
