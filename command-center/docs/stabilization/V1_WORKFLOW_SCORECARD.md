# V1 Workflow Stability Scorecard

**Tip:** `209823b`  
**Scoring:** 0 = unusable / unknown-broken · 5 = production-proven daily  
**Statuses:** STABLE · NEEDS WORK · BLOCKED · DEFER TO V2

Scores are evidence-based. Where production proof is thin, scores stay conservative.

---

## Score summary

| Workflow | Rel | Mobile | Integrity | Recovery | Tests | Prod conf | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lead intake | 3 | 2 | 3 | 3 | 2 | 3 | NEEDS WORK |
| Customer/property creation | 2 | 3 | 1 | 2 | 3 | 2 | NEEDS WORK |
| Inspection | 4 | 4 | 3 | 3 | 4 | 4 | NEEDS WORK |
| Estimate | 3 | 1 | 2 | 2 | 2 | 3 | NEEDS WORK |
| Job creation | 3 | 2 | 3 | 2 | 2 | 3 | NEEDS WORK |
| Scheduling | 3 | 1 | 2 | 2 | 2 | 2 | NEEDS WORK |
| Invoice | 3 | 1 | 3 | 3 | 2 | 3 | NEEDS WORK |
| Payment | 3 | 2 | 3 | 3 | 2 | 3 | NEEDS WORK |
| Follow-up | 2 | 1 | 2 | 2 | 1 | 2 | NEEDS WORK |

**No workflow is BLOCKED** after hotfix #37/#38 restored inspection load.  
**No workflow is fully STABLE** for freeze closure without further releases.

---

## Lead intake

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 3 | CRM Leads + intake edges exist; column fallbacks hide schema drift |
| Mobile usability | 2 | Office CRM not phone-first; call console helps |
| Data integrity | 3 | `leads` is clear SoT; contact linking optional/inconsistent |
| Recovery | 3 | Can re-edit lead; duplicates possible |
| Test coverage | 2 | Older UAT; not CI-gated |
| Production confidence | 3 | Daily use assumed; not re-proven in this package |

**Status: IN PROGRESS (R2)** — shared intake contract (name/phone/address); loud create failures.

---

## Customer / property creation

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 2 | Property link broken; field flow avoids properties insert |
| Mobile usability | 3 | Field customer step improved; still form-heavy |
| Data integrity | 1 | UUID vs bigint; denormalized addresses |
| Recovery | 2 | Freeform address fallback works; structured property does not |
| Test coverage | 3 | Address schema tests after hotfix |
| Production confidence | 2 | Hotfix verified load + address fallback; model still inconsistent |

**Status: NEEDS WORK** — integrity release R1 + intake R2.

---

## Inspection

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 4 | Load restored; field steps present |
| Mobile usability | 4 | Tech PWA five-step flow; Take Photo / Library |
| Data integrity | 3 | Findings/recs solid; property pointer weak |
| Recovery | 3 | Draft status, blockers, Keep/Edit/Remove |
| Test coverage | 4 | Strongest smoke suite in repo |
| Production confidence | 4 | Prod smoke PASS 2026-07-15; founder device acceptance UNKNOWN |

**Status: NEEDS WORK** — punch-list from real field use (R6/R7), not redesign.

---

## Estimate

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 3 | Quotes path works when used; legacy estimates confuse |
| Mobile usability | 1 | Proposal builder is desktop-oriented |
| Data integrity | 2 | Dual tables |
| Recovery | 2 | Status edits possible; orphan estimates risk |
| Test coverage | 2 | Limited focused quote→job tests in CI |
| Production confidence | 3 | Historical UAT pass; not recently smoke-gated |

**Status: NEEDS WORK** — R4.

---

## Job creation

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 3 | Trigger on quote accept is canonical |
| Mobile usability | 2 | Tech can open jobs; create is office-side |
| Data integrity | 3 | `quote_id` uniqueness helps; duplicate events noted historically |
| Recovery | 2 | Manual job create exists; reconciliation manual |
| Test coverage | 2 | Work-order UAT exists, not CI |
| Production confidence | 3 | Core revenue UAT historically passed |

**Status: NEEDS WORK** — R4.

---

## Scheduling

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 3 | Appointments + dispatch exist |
| Mobile usability | 1 | No tech schedule route; queue is today-only |
| Data integrity | 2 | Dual appointment/job schedule fields |
| Recovery | 2 | Reschedule in CRM |
| Test coverage | 2 | Local schedule/dispatch UAT |
| Production confidence | 2 | Phone scheduling friction called out by founder objectives |

**Status: NEEDS WORK** — weakest mobile surface → R3.

---

## Invoice

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 3 | Builder + edges; auto-draft optional |
| Mobile usability | 1 | Desktop finance UI |
| Data integrity | 3 | Invoice authority migration exists |
| Recovery | 3 | Status ladder + void paths |
| Test coverage | 2 | Public payment UAT historically |
| Production confidence | 3 | Live payments proven historically; property embeds risk address |

**Status: NEEDS WORK** — R5 (+ R1 embed fix).

---

## Payment

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 3 | Stripe + public pay + offline |
| Mobile usability | 2 | Customer pay link is mobile-capable; office tooling not |
| Data integrity | 3 | Ledger + immutability triggers |
| Recovery | 3 | Manual/offline ledger paths exist |
| Test coverage | 2 | UAT-006 resolved historically |
| Production confidence | 3 | Watch webhook secret drift notes |

**Status: NEEDS WORK** — R5.

---

## Follow-up

| Dimension | Score | Evidence |
| --- | --- | --- |
| Reliability | 2 | `crm_tasks` + job follow-up flags; uneven creation |
| Mobile usability | 1 | No tech follow-up workflow |
| Data integrity | 2 | Polymorphic source links |
| Recovery | 2 | Manual task create |
| Test coverage | 1 | Minimal |
| Production confidence | 2 | Flow Console may empty-state |

**Status: NEEDS WORK** — light R6; full CRM follow-up platform → V2.

---

## Weakest workflow

**Scheduling (mobile usability 1, production confidence 2)** — office can schedule; phone cannot operate the schedule surface. Closely followed by **Customer/property creation** on data integrity (score 1).
