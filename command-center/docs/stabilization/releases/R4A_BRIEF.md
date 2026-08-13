# Release Brief — R4A Office Inspection Customer Selector Usability

> Orchestrator output. One operational problem. Owner approves this brief before
> any implementation starts.
>
> - Prepared from `origin/main` @ `f25ca094d70f4156402227241c1c2c7ab74e6908`
>   (governance merge SHA, PR #47).
> - Worktree: `F:\Dev\BHFOS-r4a-inspection-selector` on branch
>   `stabilize/r4a-office-inspection-customer-selector` (branched from verified `origin/main`).
> - Status: **DRAFT — awaiting owner approval. No implementation started.**

## 1. Objective (one problem)
On `/tvg/crm/inspections/new`, the **Customer (Lead)** dropdown opens but the owner
cannot reliably scroll a long customer list or reach/select customers below the
visible area. Make that dropdown fully scrollable and every option reachable and
selectable. Nothing else.

## 2. Why now / owner priority
Owner-observed: an office/admin user starting a new inspection cannot pick a
customer who sits lower in the list, so inspections can't be created for those
customers from this screen. This blocks the first step of the inspection workflow.
Priority is owner-reported, not inferred.

## 3. In scope
- **Exact behavior to change:** the Customer (Lead) selection dropdown on the new-inspection
  screen must present a bounded, scrollable list where the last option is reachable
  and selectable, and selecting it updates the inspection draft.
- **Surfaces affected (role + route + viewport):** Office/admin, `/tvg/crm/inspections/new`,
  desktop and mobile viewports: 1920x1080, 1366x768, 430x932, 390x844.
- **Isolated vs shared — investigation verdict: SHARED.** The defect is **not** isolated to the
  Customer (Lead) selector. It originates in the shared shadcn primitive
  `src/components/ui/select.jsx`. Evidence:
  - The Customer (Lead) instance (`InspectionEditor.jsx` lines ~1080–1092) is a plain
    `<Select>/<SelectContent>/<SelectItem>` consumer with **no dropdown-height, overflow, or
    scroll logic of its own** — nothing local could cause or fix the clipping.
  - In `src/components/ui/select.jsx`, `SelectContent` uses `overflow-hidden` with **no bounded
    max-height and no scroll buttons** (`SelectScrollUpButton` / `SelectScrollDownButton` are not
    implemented), and the popper `Viewport` is pinned to `h-[var(--radix-select-trigger-height)]`.
    That combination clips long lists and blocks wheel/scrollbar/keyboard traversal.
  - The same primitive is imported by **~60 files** app-wide, so any list-based `<Select>` long
    enough to overflow shares this defect — it merely surfaces first on this screen because the
    lead list is long. The fix therefore belongs in the shared primitive (see Path A), constrained
    to the minimum change required (see §4).
- **Required visible outcome (owner's words):** bounded dropdown height; mouse-wheel
  scrolling works; visible scrollbar where appropriate; keyboard Arrow Down, Page Down,
  Home, End work; the final option can be reached and selected; selection updates the
  inspection form; no clipping; no page-scroll conflict; works in installed Edge, Chrome,
  and Firefox; works at 1920x1080, 1366x768, 430x932, and 390x844.

### Implementation approach (Orchestrator recommendation — Implementation agent confirms or stops)
Because the defect lives in the shared primitive, there are two viable paths. The
Implementation agent must choose one, state which, and **stop and return to the
Orchestrator/owner if the chosen path cannot satisfy the acceptance criteria without
expanding scope:**

- **Path A (recommended — shared primitive fix, upstream-correct):** restore canonical
  shadcn/Radix scrolling in `src/components/ui/select.jsx` — add a bounded max-height on
  `SelectContent` (e.g. an available-height/viewport-based cap) and implement
  `SelectScrollUpButton` / `SelectScrollDownButton`, and/or allow the viewport to scroll.
  Smallest change that fixes every dropdown correctly. **Blast radius: app-wide (see §6b).**
- **Path B (scoped to the one instance):** pass a height/overflow `className` only to the
  Customer (Lead) `SelectContent` in `InspectionEditor.jsx`. Lower blast radius, but may
  not fully work because the offending viewport height is set inside the shared primitive
  and is not overridable from the consumer. If Path B cannot meet all acceptance checks,
  **stop** — do not silently escalate to Path A without owner sign-off on the wider blast radius.

## 4. Out of scope (explicit)
Owner-specified exclusions, carried verbatim:
- Do **not** add an "Add Customer" affordance.
- Do **not** redesign inspections.
- Do **not** modify lead data.
- Do **not** change the property model.
- Do **not** change authentication.
- Do **not** change scheduling.
- Do **not** begin money-loop work.
- Do **not** redesign the shared component library beyond what is required.

Orchestrator additions:
- Do **not** restyle, re-order, or change the *content/labels* of any dropdown; this is a
  scroll/height/reachability reliability fix only.
- Do **not** upgrade or replace `@radix-ui/react-select` or other dependencies.
- Do **not** "fix" unrelated dropdown behavior noticed along the way — report separately.
- No V2 work, no unrelated cleanup.

## 5. Owning module + files
- **Business owner (from `V1_MODULE_OWNERSHIP.md`):** Inspections (CRM editor). Surface
  owner per `V1_CURSOR_ORCHESTRATOR.md` = **Office UX specialist (Agent 3)**, `src/pages/crm/**`
  and related components.
- **Files the Implementation agent may edit (one implementer, serialized):**
  - `src/components/ui/select.jsx` — **shared helper; primary change site for Path A.**
  - `src/pages/crm/inspections/InspectionEditor.jsx` — only if Path B (scoped className) is chosen.
  - Test file(s) under `tests/smoke/**` (new focused test — see §9).
- **Shared helpers touched (must serialize / extra review):** `src/components/ui/select.jsx`
  is imported by **~60 files** across CRM, tech PWA, settings, admin, marketing, partners,
  and booking. While this brief is active, **no other agent may edit `select.jsx`**, and the
  change requires Architecture/Contract Guard review before merge.

## 6. Expected visible behavior + acceptance evidence (owner-verifiable, USABLE tier)
Precondition: a tenant/account whose Customer (Lead) list is long enough to overflow the
viewport (enough leads that the last option sits below the fold on the smallest listed viewport).

- [ ] In **Office/admin** on **`/tvg/crm/inspections/new`** in **installed Edge**, opening the
      Customer (Lead) dropdown shows a **bounded-height** panel (does not run off-screen) —
      evidence: screenshot.
- [ ] **Mouse-wheel** scrolling moves through the list to the bottom — evidence: screenshot of last item visible.
- [ ] A **visible scrollbar** is present where appropriate for the list length — evidence: screenshot.
- [ ] **Keyboard** Arrow Down, Page Down, Home, and End all move selection/focus through the
      list as expected — evidence: screenshot or short recording.
- [ ] The **final (last) option** can be reached and **selected**, and the inspection form's
      Customer (Lead) value updates to it (and Create Inspection becomes enabled) — evidence: screenshot.
- [ ] **No clipping** of options and **no page-scroll conflict** (opening/scrolling the dropdown
      does not scroll the page behind it) — evidence: screenshot.
- [ ] All of the above confirmed in **installed Edge, Chrome, and Firefox**.
- [ ] All of the above confirmed at **1920x1080, 1366x768, 430x932, and 390x844**.
- [ ] **No regression** to the adjacent dropdowns on the same screen (Inspection Type, Work Order,
      Technician) — each still opens, scrolls if needed, and selects.
- [ ] **No regression (Path A only)** to a representative sample of other dropdowns app-wide
      (see §6b) — each still opens and selects.

## 6a. Owner checkpoint
The release cannot advance until the **owner personally** opens `/tvg/crm/inspections/new`
in **installed Edge at 1366x768**, scrolls the Customer (Lead) list to the bottom, selects the
**last** customer, and confirms the form updated. Owner-confirmed screenshot is required; a
developer or agent screenshot alone does not satisfy this checkpoint.

## 6b. Risks
- **What could break (blast radius):** Path A edits a primitive imported by **~60 files**. A
  height/scroll regression could affect dropdowns across CRM (quotes, invoices, jobs, leads,
  scheduling UI), tech PWA inspection/review, settings, admin, and public booking/partner forms.
- **Cross-surface / shared-helper risk:** high for Path A (shared primitive), low for Path B
  (single instance) — but Path B carries a higher risk of *not fully fixing* the problem.
- **Trigger-domain exposure:** none. This is presentation/interaction only; it does not read or
  write business state.
- **Mobile-specific risk:** touch scrolling and on-screen keyboard behavior at 430x932 / 390x844
  must be checked, not assumed from desktop.

## 7. Trigger-domain check
Touches tenant_isolation / money_state / acceptance_commit / state_machine / completion_gate?
**No.** The change is limited to dropdown presentation and scrolling; no business-state read or
write is modified. Review gate still runs in CI as a standard check, but no trigger-domain tag applies.

## 8. Migration?
**No.** No schema or data change is required or permitted by this brief.

## 9. Test plan
- **Focused test to add:** a smoke/behavioral test under `tests/smoke/**` covering the new-inspection
  Customer (Lead) selector: open the dropdown, assert the list container is height-bounded, assert the
  last option is reachable and selectable, and assert the draft `lead_id` / form state updates on selection.
- **Feasibility note:** Radix Select renders in a portal and its scroll behavior is layout/viewport-dependent,
  which is hard to assert reliably in jsdom. If the automated test cannot meaningfully verify *scrollability*
  (as opposed to selection), document that limitation in the PR and rely on the manual USABLE matrix in §6
  for scroll/wheel/scrollbar/keyboard coverage. Automated coverage must at minimum verify that the last
  option is selectable and updates form state.
- Run `lint`, `build`, and `review:gate` locally; do not run the full suite during implementation.

## 10. Rollback / stop conditions
- **Rollback:** revert the PR (single-commit / squash). No data change, so revert is clean and complete.
- **Stop and return to Orchestrator/owner if:**
  - Path B is attempted and cannot meet all §6 acceptance checks without editing the shared primitive
    (escalating to Path A changes the blast radius and needs owner sign-off).
  - Path A regresses any other dropdown found during the §6b spot-check.
  - The root cause turns out to differ from the shared-primitive diagnosis in this brief.
  - Any migration, trigger domain, or excluded area (§4) appears necessary.
  - Scope would grow beyond the Customer (Lead) scroll/reachability fix.

## 11. Definition of done
- [ ] Implementation PR opened (scope-limited to §5 files, focused test included)
- [ ] Architecture/Contract Guard review passed (shared-primitive change scrutinized)
- [ ] CI green (`lint`, `build`, `review:gate`, `ledger_lock`)
- [ ] Independent UAT (different chat): owner-confirmed USABLE evidence captured across the full §6 matrix
- [ ] Owner accepted the material workflow (§6a checkpoint)
- [ ] Release merged + deployed by Release role (human-approved)
- [ ] Production re-verified by Independent UAT
- [ ] Backlog/baseline/scorecard updated

---

### Orchestrator stop
Release brief complete. No implementation, merge, deploy, or production certification performed.
Awaiting owner approval of this brief before any Implementation chat begins.
