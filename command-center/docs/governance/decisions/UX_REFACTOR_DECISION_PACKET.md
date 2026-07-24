# UX-REFACTOR — Product Decision Packet (PD-UX-01…06)

| Field | Value |
| --- | --- |
| Base | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Authority | Founder create directive 2026-07-23 + Delegated-Authority auto-continue |
| Status | **Recommended defaults = A** unless Founder overrides |

Founder create already fixed: parallel schedule, no DB migrations, scope = shell/nav/tokens/top-5 consolidation. Remaining PDs choose implementation defaults so peer review + A2 can auto-continue.

---

### PD-UX-01 — Desktop nav order

**Q:** Adopt Next-Phase target order for primary left-nav items?  
**A (recommended):** Yes — Dashboard/Hub → Jobs → Quotes → Inspections → Reporting → Settings; demote secondary items below a divider.  
**B:** Keep current `BHFSidebar` order; only restyle.  
**C:** Custom order (Founder list required).

**Default under auto-continue:** **A**

---

### PD-UX-02 — Mobile bottom bar

**Q:** Align mobile bottom bar to top-5 primaries?  
**A (recommended):** Hub · Jobs · Quotes · Inspections · More (Settings + overflow).  
**B:** Keep current Hub · Leads · Quotes · Calendar · Invoices.  
**C:** Hide bottom bar; hamburger only.

**Default under auto-continue:** **A**

---

### PD-UX-03 — Design token direction

**Q:** Token strategy for this slice?  
**A (recommended):** Extend existing shadcn HSL CSS variables in `index.css` with semantic aliases (`--surface-page`, `--nav-active`, `--cta`) mapped to current brand; no new font stack in A2 unless needed for hierarchy.  
**B:** Introduce a second theme file + CSS module system.  
**C:** Hard-code per-page colors (reject).

**Default under auto-continue:** **A**  
**Note:** Avoid purple-on-white default AI look; stay on current BHF charcoal/blue system unless brand files dictate otherwise.

---

### PD-UX-04 — Page chrome pattern

**Q:** Shared page header API?  
**A (recommended):** New `CrmPageHeader` (title, breadcrumbs, actions) used on all top 5; floating +Create in shell when context allows.  
**B:** Copy-paste headers per page.  
**C:** Full design-system package extract (too large).

**Default under auto-continue:** **A**

---

### PD-UX-05 — Component consolidation depth

**Q:** How aggressive is consolidation?  
**A (recommended):** Extract shared `CrmListToolbar` + table density tokens; leave domain columns/actions in page files.  
**B:** Rewrite Jobs/Quotes tables into one generic DataTable framework.  
**C:** Visual CSS-only pass with no shared components.

**Default under auto-continue:** **A**

---

### PD-UX-06 — Dark mode

**Q:** Ship dark-mode toggle this slice?  
**A (recommended):** Keep existing `.dark` tokens; do **not** add a user toggle in A2 (avoid preference persistence scope).  
**B:** Add Settings toggle + localStorage preference.  
**C:** Force dark as default (escalate).

**Default under auto-continue:** **A**

---

## Ratification record

| PD | Choice | Source |
| --- | --- | --- |
| Scope / parallel / no migrations | Fixed | Founder create 2026-07-23 |
| PD-UX-01…06 | **A** | Auto-continue defaults pending peer-review challenge |

Peer reviewers may force a PD to Founder escalation if they disagree with a default.
