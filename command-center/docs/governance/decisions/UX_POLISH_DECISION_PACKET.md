# UX-POLISH — Product Decision Packet (PD-UXP-01…06)

| Field | Value |
| --- | --- |
| Base | `7623948a7a312125842223e27dd6a39c3834b060` |
| Authority | Founder create 2026-07-23 (TVG CRM; no PWA; amended UX-POLISH) + Delegated-Authority |
| Status | **Defaults = A** unless Founder overrides |

---

### PD-UXP-01 — Product name

**Q:** Shell product name?  
**A (Founder-locked):** **TVG CRM** everywhere in CRM chrome (mobile header, sidebar, document titles where CRM-branded). Remove user-visible **BHF CRM**.  
**B:** Keep dual naming (reject).

**Default under auto-continue:** **A** (Founder locked)

---

### PD-UXP-02 — Brand tokens

**Q:** Token strategy?  
**A (recommended):** Extend `index.css` / Tailwind with `--brand-primary`, `--brand-accent`, `--font-body` (wire Inter already declared); map `--primary` / `--nav-active` / `--cta` to brand roles. Stay charcoal + TVG blue — not purple-on-white.  
**B:** Separate `theme.css` file only (same variables).  
**C:** Hard-code per page (reject).

**Default under auto-continue:** **A** (B acceptable if cleaner)

---

### PD-UXP-03 — Synthetic / test exclusion

**Q:** How to keep synth out of live money + lists?  
**A (recommended):** One helper used by Hub KPIs, Invoices list/totals, Jobs, Opportunities, and Leads (align with existing Training Mode: live = hide test; training = show only test). Detect `is_test_data` **or** known synth naming patterns. Do **not** blindly copy Dispatch’s 30-day unscheduled backlog hide onto the full Work Orders board.  
**B:** UI-only client filter without query changes (weaker).  
**C:** DB migration + flag backfill (out of slice — escalate).

**Default under auto-continue:** **A**  
**Note:** Unflagged synth rows may still need a Founder-authorized data cleanup residual; A2 must not invent schema.

---

### PD-UXP-04 — Shell chrome finish

**Q:** Which screens get `CrmPageHeader`?  
**A (recommended):** Leads, Call Console, Calendar, Dispatch, Invoices (plus keep Hub/Quotes/Inspections/Jobs). Preserve Dispatch severity content; remove competing one-off title bars where redundant.  
**B:** Header only on money screens.  
**C:** Defer (reject — core of polish).

**Default under auto-continue:** **A**

---

### PD-UXP-05 — Hub diet

**Q:** First viewport shape?  
**A (recommended):** Hero = greeting + equal New Lead / New Quote + next schedule/job cue; KPI strip secondary (scroll or compact row).  
**B:** Keep seven equal cards.  
**C:** Remove KPIs entirely (too aggressive).

**Default under auto-continue:** **A**

---

### PD-UXP-06 — In-slice bugfixes vs residual

**Q:** Leads drawer + pipeline stage?  
**A (recommended):** **In slice** — drawer must open; unknown stages mapped or displayed safely without spam-warn.  
**B:** Residual only.  
**C:** Full CRM rewrite (reject).

**Default under auto-continue:** **A**

---

## Explicitly deferred

| Item | Residual |
| --- | --- |
| PWA / service worker | `UX-PWA` (not authorized) |
| Visual-diff CI / Storybook / Cypress farm | `UX-TOOLING` |
| QuickBooks sync audit of staging invoices | Ops / Founder check (non-code) |
| Photo Bundles · S7 · Stripe auto-charge | Halt defaults |
