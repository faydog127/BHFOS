# Schedule, Call Console, and Customer Memory Follow-Up

Date: 2026-03-18
Scope: Capture future-work decisions discovered during the Schedule & Dispatch redesign and local UAT pass.

## Current Rule
- Continue working on `src/pages/crm/Schedule.jsx` until core dispatch persistence is proven.
- Do not start Hub expansion work while Schedule is still failing core execution UAT.
- Treat these notes as follow-up operating-model decisions, not part of the current deploy gate.

## Current Deploy Gate
Schedule remains blocked from deploy until all of the following are green:
- assign technician persists
- service date/time persists
- service/scope persists
- blocked time/duration persists
- overlap protection blocks double booking cleanly
- hard refresh preserves truth across card, console, metrics, and DB

## Page Contract

### Hub
- Command summary page.
- Shows counts, alerts, money, and routing links.
- Does not become a second dispatch board.

### Call Console
- Intake and conversion surface.
- Owns the live call workflow, intake script, note capture, and conversion into lead/work-order state.
- Should be the home for appointment intake.

### Schedule
- Execution and dispatch surface.
- Only ready-to-dispatch work orders belong here.
- Should not own discovery, qualification, or call-script intake.

## Future Work Note 1: Move Appointment Intake Out of Schedule

### Decision
- `Appointment Intake Queue` does not belong on the Schedule page long-term.
- It belongs in Call Console because it represents intake, qualification, and conversion work, not dispatch execution.

### Why
- Schedule is now explicitly the execution layer.
- Intake work mixes creation-of-work with execution-of-work and muddies the operator mental model.
- Leaving appointment intake on Schedule encourages dispatchers to do intake work in the wrong place.

### Future Direction
- Remove the bottom-of-page intake queue from `src/pages/crm/Schedule.jsx`.
- Replace it, if needed, with a small routing alert such as:
  - `3 appointment requests waiting -> Open Call Console`
- Move the full queue into Call Console and treat it as part of the intake workflow.

### Call Console Ownership
The future intake panel in Call Console should capture the standard call battery:
- who is the customer
- callback number
- email
- service address
- requested service / problem description
- urgency
- access / gate / property constraints
- preferred schedule window
- notes and follow-up outcome

### Conversion Actions
From Call Console, the operator should be able to:
- save as lead
- create work order
- schedule now
- log follow-up / no-service outcome

## Future Work Note 2: Require Better Upstream Intake Before Schedule

### Decision
- Schedule should only operate on ready-to-execute work.
- Missing core intake fields should be blocked earlier in Call Console / conversion flow, not discovered late in dispatch.

### Minimum Required Before Work Enters Schedule
- service / scope
- customer contact
- service address
- enough notes for the job to be understood

### Dispatch-Specific Fields Still Managed in Schedule
- technician assignment
- scheduled date/time
- blocked time / duration
- dispatch status transitions

## Future Work Note 3: Build a Real Customer Memory Layer

### Decision
- The CRM should evolve from job-centric only toward customer-centric memory once Schedule is stable.
- This is a follow-up system upgrade, not part of the current Schedule release gate.

### Problem
- Leads and jobs currently carry most of the operational state.
- That is enough for dispatch, but not enough for long-term customer memory.
- The system needs persistent customer history across calls, jobs, and recommendations.

### Target Model

#### Customer
- One persistent record per person / account / property relationship.
- Stores identity, preferred contact info, primary address, tags, and long-term notes.

#### Interactions
- Logs calls, follow-ups, notes, service concerns, and outcomes over time.
- Allows Call Console to show prior issues and prior recommendations during live calls.

#### Jobs / Work Orders
- Remain the execution layer for each service event.
- Link back to the customer record.

### Minimum Follow-Up Scope
- add or confirm a persistent `customer` layer
- link leads and jobs to `customer_id`
- create a simple interaction / call log
- show prior customer history in Call Console during intake

## Future Work Note 4: Keep Schedule Focused on Dispatch Truth

While Schedule work continues, keep these boundaries:
- do not re-expand Schedule into a general intake tool
- do not let payment or CRM history data crowd the left-hand action queue
- do not add Hub work until dispatch persistence and UAT are green
- do not count localhost fallback-only success as a real pass

## Suggested Follow-Up Order After Schedule Stabilizes
1. Move Appointment Intake Queue into Call Console.
2. Add the structured intake battery and conversion actions to Call Console.
3. Add deep-link counts from Hub into Schedule and Call Console.
4. Design and wire the customer + interaction history layer.

## Reference
- Current Schedule redesign and dispatch work: `src/pages/crm/Schedule.jsx`
- Current shared rules layer: `src/lib/dispatchRules.js`
- Historical Schedule board note: `docs/reconciliation/09_keep_list_and_e2e_gate.md`
