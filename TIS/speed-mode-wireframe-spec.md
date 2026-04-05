# Speed Mode Wireframe Spec

## 1. Purpose

This document defines the screen structure for `Speed Mode v1`.

It exists to make sure the UI:

- renders the resolver contract correctly
- preserves status-first hierarchy
- keeps Speed Mode fast and field-usable
- does not collapse back into a long form

This is not a visual design system document.
It is a structural wireframe document.

## 2. Product Role

Speed Mode is the default `Field Pack` experience inside the field close system.

It is supposed to feel like:

- a decision cockpit
- a controlled selling surface
- a fast field tool

It is **not** supposed to feel like:

- a back-office estimator
- a spreadsheet
- a deep admin form
- a CRM detail page

## 3. Non-Negotiable UI Doctrine

Speed Mode must obey this order:

1. show judgment before detail
2. show action before explanation
3. show money as posture, not as a naked number
4. show proof near action, not hidden in a gallery

## 4. Primary Layout Model

Speed Mode uses:

- `desktop`: two-column layout
- `mobile`: stacked single-column layout

The columns are:

- left = controlled inputs
- right = rep package outputs

## 5. Above-The-Fold Rule

On desktop, the following must be visible above the fold in summary form:

- status
- action command
- risk warning
- talk track
- primary close ask

Money and proof may begin above the fold, but status/action/risk cannot be pushed below them.

## 6. Screen Zones

Use these screen zones in this order.

### Zone 1: Header

Purpose:

- identify the tool
- show mode
- allow exit/back

Contains:

- page title: `Speed Mode`
- secondary label: `Field Pack`
- property name if available
- back action
- mode switch only if Controlled Mode is available

Rules:

- do not place status in the header
- do not place proof in the header

### Zone 2: Status Strip

Purpose:

- answer the situation in under 3 seconds

Contains:

- status badge
- action command
- risk warning
- optional handoff badge:
  - `Controlled Mode Available`
  - `Internal Review Required`

Rules:

- this is the first dominant block on the page
- this should visually outrank all inputs
- this should remain visible high on the screen on all breakpoints

### Zone 3: Core Workspace

Desktop:

- left input rail
- right output rail

Mobile:

- status strip first
- input stack second
- output stack third

### Zone 4: Footer Actions

Purpose:

- allow copying and handoff without cluttering the main output

Contains:

- copy all / share actions if implemented
- move to Controlled Mode button
- internal review handoff button when applicable

Rules:

- no destructive admin actions here
- footer actions should not outrank status/action

## 7. Desktop Wireframe

### 7.1 Top Structure

```text
-------------------------------------------------------------
 Header
-------------------------------------------------------------
 Status Strip
-------------------------------------------------------------
 Left Column                  | Right Column
 Inputs                       | Rep Output Package
-------------------------------------------------------------
 Footer Actions
-------------------------------------------------------------
```

### 7.2 Left Column Width

Recommended:

- 34% to 40%

### 7.3 Right Column Width

Recommended:

- 60% to 66%

Reason:

- outputs are the product
- inputs are the control surface

## 8. Mobile Wireframe

### 8.1 Stack Order

```text
Header
Status Strip
Inputs
Talk Track
Price Posture
Close Asks
Follow-up Text
Proof
Handoff / Footer Actions
```

### 8.2 Mobile Priority Rule

On mobile, never put proof above:

- status
- action command
- talk track

## 9. Left Column: Input Panel

This panel is the controlled input surface.

### 9.1 Input Panel Goals

- fast completion
- fixed vocab only
- no free-text required
- minimal visual noise

### 9.2 Input Panel Order

1. Property Type
2. Scope Band
3. Access
4. Confidence
5. Visible Condition

Optional system signals, if shown:

6. Proof Available
7. Decision-Maker Present

### 9.3 Input Component Type

Use:

- segmented controls
- choice chips
- tiles

Do not use:

- dropdowns unless space forces it
- free-text inputs
- long helper paragraphs under each option

### 9.4 Input Panel Block Structure

Each input block should contain:

- label
- compact option control
- one-line helper only if necessary

### 9.5 Generate Behavior

Recommended behavior:

- output updates live once all 5 required inputs are set

Alternative acceptable behavior:

- explicit `Generate Field Pack` button

Not acceptable:

- long multi-step wizard
- hidden submit action below the fold

## 10. Right Column: Output Panel

This is the main product surface.

The output panel must render in this order.

### 10.1 Block 1: Status Card

Contains:

- status label
- action command
- risk warning

Optional:

- one-line reason summary

Rules:

- status label is the visual anchor
- action command should sit directly under it
- risk warning should be clearly visible but secondary to action

### 10.2 Block 2: Talk Track Card

Contains:

- observation line
- implication line
- next move line
- `Copy Talk Track`
- optional `Edit` action

Rules:

- this must appear before pricing
- this is the most immediately useful output after status

### 10.3 Block 3: Price Posture Card

Contains:

- price posture label
- strategy label
- anchor structure
- entry option structure if allowed
- close path

Optional:

- copy-safe money framing summary

Rules:

- do not show a naked total without posture
- if pricing is blocked, this card must still render and explicitly say that pricing is not active

### 10.4 Block 4: Close Ask Card

Contains:

- primary close ask
- backup close ask
- `Copy Primary Ask`
- `Copy Backup Ask`

Rules:

- primary ask always first
- backup ask visually subordinate

### 10.5 Block 5: Follow-Up Card

Contains:

- follow-up text
- `Copy Follow-Up`
- optional quick-edit action

Rules:

- text must be short
- text must end with a next step

### 10.6 Block 6: Proof Card

Contains:

- proof slot 1
- proof slot 2
- proof required/recommended label
- empty state if no proof

Rules:

- max 2 proof items
- rep can override selection
- proof cannot visually outrank talk track or price posture

### 10.7 Block 7: Warning Flags

Contains:

- warning chips or short caution lines

Rules:

- keep compact
- render after core output, not before status

### 10.8 Block 8: Handoff Card

Contains:

- `Move to Controlled Mode` when eligible
- `Route for Internal Review` when required
- short explanation of why

Rules:

- show only when relevant
- do not clutter the default flow when not needed

## 11. Status Strip Component Spec

### 11.1 Required Elements

- `status_badge`
- `action_command`
- `risk_warning`

### 11.2 Optional Elements

- `matched_rule_reason_summary`
- `handoff_badge`

### 11.3 Color Logic

Recommended:

- `Do Not Price - Secure Access First` = red / hard caution
- `Range Only - Qualify Before Advancing` = amber
- `Present Range + Book Walkthrough` = strong neutral / blue
- `Deliver Estimate + Ask For Approval` = green or confident neutral
- `Escalate Internally Before Pricing` = dark red or critical caution

Rules:

- color reinforces status
- color must not be the only signal

## 12. Copy Action Placement

Speed Mode must expose copy actions in-place.

Required buttons:

- `Copy Talk Track`
- `Copy Primary Ask`
- `Copy Follow-Up`

Recommended:

- `Copy All`

Rules:

- copy buttons belong inside their related cards
- do not push copy actions into a hidden menu

## 13. Rep Edit Model

Speed Mode is editable, but only in copy surfaces.

### 13.1 Editable

- talk track text
- follow-up text
- proof selection

### 13.2 Not Editable

- status
- action command source
- strategy
- guardrails

### 13.3 UI Rule

If editable copy is changed:

- show `Edited` state
- keep `Regenerate` available

## 14. Handoff UX

### 14.1 Controlled Mode Handoff

Show this when:

- `handoff_target = controlled_mode`

Button label:

- `Open Controlled Mode`

Supporting line:

- explain why deeper assumptions review is now justified

### 14.2 Internal Review Handoff

Show this when:

- `handoff_target = internal_review`

Button label:

- `Route for Internal Review`

Supporting line:

- explain that field pricing is not the right move

## 15. Empty and Edge States

### 15.1 Incomplete Inputs

If fewer than 5 required inputs are complete:

- show empty output state
- message:
  - `Set the five core inputs to generate the field pack.`

Do not show partial status.

### 15.2 No Proof Available

If proof is absent:

- show empty proof slots
- show resolver-supplied empty state message

### 15.3 Fallback Status

If `resolution_source = fallback`:

- do not expose raw fallback mechanics to the rep
- optionally show a subtle internal/debug badge in admin/dev builds only

## 16. Mobile Interaction Rules

### 16.1 Sticky Priority

Recommended sticky element:

- status badge + action command

Do not make the full output rail sticky.

### 16.2 Collapse Rules

On mobile, these may collapse:

- warning flag list
- proof section
- handoff explanation

These may not collapse by default:

- status
- action command
- talk track
- primary close ask

## 17. Build Constraints

Speed Mode v1 UI must obey:

- 5 required inputs max
- no free-text required for core generation
- status/action/risk first visible output
- talk track before pricing
- pricing before proof
- proof before handoff
- copy buttons visible without extra navigation

## 18. Recommended Component IDs

Use stable IDs for implementation and QA.

### Header

- `speed-header`
- `speed-mode-badge`

### Status

- `speed-status-strip`
- `speed-status-badge`
- `speed-action-command`
- `speed-risk-warning`

### Inputs

- `speed-input-panel`
- `speed-input-property-type`
- `speed-input-scope-band`
- `speed-input-access`
- `speed-input-confidence`
- `speed-input-visible-condition`

### Outputs

- `speed-output-panel`
- `speed-talk-track-card`
- `speed-price-posture-card`
- `speed-close-card`
- `speed-followup-card`
- `speed-proof-card`
- `speed-warning-card`
- `speed-handoff-card`

### Actions

- `speed-copy-talk-track`
- `speed-copy-primary-ask`
- `speed-copy-followup`
- `speed-copy-all`
- `speed-open-controlled-mode`
- `speed-route-internal-review`

## 19. QA Checklist

The wireframe implementation passes if:

- status is first visible output
- no required input uses free text
- output updates in under 1 interaction cycle after valid inputs
- talk track is above pricing
- close ask is above proof
- proof never displaces status/action
- rep cannot edit status
- rep can copy talk track, close ask, and follow-up without extra navigation

## 20. Locked Decisions

These are locked for v1:

- two-column desktop layout
- stacked mobile layout
- status strip first
- inputs left, outputs right
- talk track before money
- proof capped at two items
- Controlled Mode as handoff, not default screen

## 21. What Comes Next

This wireframe spec is enough to start build planning.

The next useful artifacts after this are:

1. implementation task breakdown
2. component contract mapping
3. UI build sequence
