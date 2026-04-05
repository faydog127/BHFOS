# Speed Mode Pricing Strategy Template Pack

## 1. Purpose

This document defines how `Speed Mode v1` structures the money conversation after status has already been resolved.

It does not decide status.
It does not generate final quotes.
It does not replace margin review.

Its job is to answer:

- how the number should be framed
- what kind of anchor should be shown
- whether an entry option should exist
- what close path should follow the money
- what language should be used so the rep advances the deal without overcommitting

## 2. Core Doctrine

Speed Mode pricing is not supposed to produce “the price.”

It is supposed to produce:

- a safe price posture
- a strategic money frame
- a close path matched to the current status

The money layer exists to move the opportunity forward, not to pretend uncertainty is solved.

## 3. Required Inputs

This pack assumes the resolver has already produced:

- `status`
- `price_posture`
- `risk_warning`
- `scope_band`
- `property_type`
- `access`
- `confidence`
- `visible_condition`

Optional enrichers:

- `proof_available`
- `proof_strength`
- `decision_maker_present`

## 4. Output Contract

Every pricing strategy must produce these fields:

```json
{
  "strategy_key": "",
  "strategy_label": "",
  "anchor_structure": "",
  "entry_option_structure": "",
  "close_path": "",
  "price_display_mode": "",
  "required_phrases": [],
  "warning_phrases": [],
  "talk_track_fragments": {
    "observation": "",
    "implication": "",
    "next_move": ""
  },
  "follow_up_modifier": "",
  "proof_priority": []
}
```

## 5. Pricing Display Modes

These define how money is allowed to appear.

### 5.1 `no_price`

Use when pricing is blocked.

Display:

- no anchor
- no entry option
- no estimate number
- close path only

### 5.2 `soft_range`

Use when a number can be mentioned, but only loosely.

Display:

- soft range language
- assumptions-forward wording
- no estimate-ready tone

### 5.3 `budgetary_range`

Use when a stronger range can be used to drive action.

Display:

- budgetary range
- anchor + entry option if strategy allows
- assumptions still visible

### 5.4 `estimate_ready`

Use only when the resolver allows estimate posture.

Display:

- estimate-ready range
- approval-path language
- controlled confidence

## 6. Strategy Selection Order

After status is resolved, select pricing strategy in this order:

1. `No Pricing Strategy Active`
2. `Urgency / Safety Angle`
3. `Bundle / Portfolio Angle`
4. `Anchor High + Phased Option`
5. `Test Close / Small First Section`

Why this order:

- `No Pricing Strategy Active` handles blocked cases first.
- `Urgency / Safety Angle` must override softer commercial framing when the facts support it.
- `Bundle / Portfolio Angle` comes before generic anchor logic when broader scope value is real.
- `Anchor High + Phased Option` is the default commercial strategy.
- `Test Close / Small First Section` is last because it should only be used when valid and safe.

## 7. Strategy Resolver Rules

Use first-match logic inside the strategy engine.

### 7.1 Strategy S1: No Pricing Strategy Active

Assign when any of the following is true:

- `status = Do Not Price - Secure Access First`
- `status = Escalate Internally Before Pricing` and internal review blocks commercial output
- `price_posture = No pricing yet`
- `price_posture = Internal review required before pricing`

Result:

- `strategy_key = no_pricing_strategy`

### 7.2 Strategy S2: Urgency / Safety Angle

Assign when all are true:

- `visible_condition = hazardous`
- strategy is not blocked by resolver
- status is one of:
  - `Escalate Internally Before Pricing`
  - `Present Range + Book Walkthrough`
  - `Deliver Estimate + Ask For Approval`

Result:

- `strategy_key = urgency_safety`

### 7.3 Strategy S3: Bundle / Portfolio Angle

Assign when all are true:

- strategy not already assigned
- `scope_band in {51-100, 100+}`
  or `property_type in {garden-style, mid-rise}`
- status is one of:
  - `Range Only - Qualify Before Advancing`
  - `Present Range + Book Walkthrough`
  - `Deliver Estimate + Ask For Approval`

Result:

- `strategy_key = bundle_portfolio`

### 7.4 Strategy S4: Anchor High + Phased Option

Assign when all are true:

- strategy not already assigned
- status is one of:
  - `Present Range + Book Walkthrough`
  - `Deliver Estimate + Ask For Approval`
- phased execution is not blocked by hazard/full-scope rules

Result:

- `strategy_key = anchor_high_phased`

### 7.5 Strategy S5: Test Close / Small First Section

Assign when all are true:

- strategy not already assigned
- `scope_band in {1-10, 11-25}`
- status is one of:
  - `Range Only - Qualify Before Advancing`
  - `Present Range + Book Walkthrough`
- `visible_condition != hazardous`
- partial section is not operationally misleading

Result:

- `strategy_key = test_close_small_section`

### 7.6 Fallback

If no strategy above matches:

- for `Present Range + Book Walkthrough` or `Deliver Estimate + Ask For Approval`
  - return `anchor_high_phased`
- otherwise
  - return `no_pricing_strategy`

## 8. Strategy Definitions

---

## 8A. No Pricing Strategy Active

### Intent

Do not structure money yet.
Use the commercial conversation only to secure what is missing.

### Allowed statuses

- `Do Not Price - Secure Access First`
- `Escalate Internally Before Pricing`
- rare fallback under `Range Only - Qualify Before Advancing`

### Prohibited use

- when the resolver allows an active selling posture with money

### Anchor structure

- `not shown`

### Entry option structure

- `not shown`

### Close path

- secure access
- verify scope
- confirm stakeholders
- route for review

### Price display mode

- `no_price`

### Required phrases

- `not enough verified scope to price reliably`
- `subject to access verification` when access is not clear

### Warning phrases

- `do not anchor pricing here`

### Talk track fragments

- Observation:
  - `What I’m seeing is not enough to give you a responsible number yet.`
- Implication:
  - `If I price this now, it would be guesswork and that helps neither side.`
- Next move:
  - `The right move is to verify scope or route it for review before we talk dollars.`

### Follow-up modifier

- follow-up should ask for access, review, or stakeholder path
- no number should be referenced

### Proof priority

- access limitation
- hazard photo
- complexity trigger

---

## 8B. Urgency / Safety Angle

### Intent

Use visible risk to justify action and protect against under-framing the job.

### Allowed statuses

- `Escalate Internally Before Pricing`
- `Present Range + Book Walkthrough`
- `Deliver Estimate + Ask For Approval`

### Do not use when

- condition evidence is weak
- hazard language would exceed what was actually seen

### Anchor structure

- full-scope corrective path

### Entry option structure

- fastest valid containment or first corrective phase

### Close path

- act now to reduce ongoing risk
- confirm review path
- prevent delay from becoming the default

### Price display mode

- `no_price` under internal escalation
- `budgetary_range` under `Present Range + Book Walkthrough`
- `estimate_ready` only if the resolver allows estimate posture

### Required phrases

- `this may require full-scope review before pricing`
- `delaying this can leave the underlying issue in place`

### Warning phrases

- `do not soften into casual partial-scope language`

### Talk track fragments

- Observation:
  - `What I’m seeing points to a real condition issue, not just cosmetic buildup.`
- Implication:
  - `That can create recurring risk, service disruption, or safety exposure if it sits.`
- Next move:
  - `The right move is to address the full condition properly or review it internally before pricing.`

### Follow-up modifier

- follow-up should stress risk reduction and next-step urgency without becoming fear-based

### Proof priority

- hazard photo
- blocked termination
- access limitation that affects safe correction

---

## 8C. Bundle / Portfolio Angle

### Intent

Frame the current site as part of a broader managed-scope opportunity.

### Allowed statuses

- `Range Only - Qualify Before Advancing`
- `Present Range + Book Walkthrough`
- `Deliver Estimate + Ask For Approval`

### Do not use when

- opportunity is clearly one-off
- rep has no credible path to broader scope

### Anchor structure

- current site full scope with broader relationship framing

### Entry option structure

- current building, first section, or first site

### Close path

- prove on one
- expand to additional buildings or future cycles

### Price display mode

- `soft_range` under `Range Only - Qualify Before Advancing`
- `budgetary_range` under `Present Range + Book Walkthrough`
- `estimate_ready` under `Deliver Estimate + Ask For Approval`

### Required phrases

- `this can be structured in a way that scales if the first section performs well`

### Warning phrases

- `do not promise portfolio pricing without real approval path`

### Talk track fragments

- Observation:
  - `What I’m seeing here looks like the kind of issue that usually is not isolated to one point.`
- Implication:
  - `That usually means there is value in solving it in a repeatable way instead of as a one-off reaction.`
- Next move:
  - `The best path is to define the current scope cleanly, then use that as the starting point for a broader plan if it makes sense.`

### Follow-up modifier

- follow-up should mention scalability, repeatability, or approval routing

### Proof priority

- photo showing repeat pattern
- count/scale proof
- second proof item showing another building or repeated condition

---

## 8D. Anchor High + Phased Option

### Intent

Lead with the full value of the work while preserving an operationally valid smaller first step.

### Allowed statuses

- `Present Range + Book Walkthrough`
- `Deliver Estimate + Ask For Approval`

### Do not use when

- full-scope hazard means partial framing is misleading
- phased option destroys margin
- operational phasing is not actually possible

### Anchor structure

- full scope first

### Entry option structure

- first phase, first building, or first valid section

### Close path

- start now on a valid first phase
- expand after validation, approval, or visible result

### Price display mode

- `budgetary_range` under `Present Range + Book Walkthrough`
- `estimate_ready` under `Deliver Estimate + Ask For Approval`

### Required phrases

- `we can frame the full scope first and phase it if that helps approval`

### Warning phrases

- `do not position the phase as the full fix if it is not`

### Talk track fragments

- Observation:
  - `What I’m seeing supports a broader scope than a spot fix.`
- Implication:
  - `That means the best pricing conversation starts with the full job, even if execution is phased.`
- Next move:
  - `I can frame the full scope and give you a practical first phase if that is the best way to move it forward.`

### Follow-up modifier

- follow-up should mention full scope first, then phase option as approval tool

### Proof priority

- strongest condition proof
- second proof showing scale or repeated issue

---

## 8E. Test Close / Small First Section

### Intent

Use a limited first section to reduce buyer resistance and prove value.

### Allowed statuses

- `Range Only - Qualify Before Advancing`
- `Present Range + Book Walkthrough`

### Do not use when

- condition is hazardous
- full-scope correction is the only honest answer
- small-section economics are poor
- a partial job would create the wrong customer impression

### Anchor structure

- full job shown first when money is allowed

### Entry option structure

- small first section or limited first scope

### Close path

- prove value
- expand after results

### Price display mode

- `soft_range` under `Range Only - Qualify Before Advancing`
- `budgetary_range` under `Present Range + Book Walkthrough`

### Required phrases

- `we can start with a smaller first section if that is the cleanest way to validate scope`

### Warning phrases

- `do not imply the first section solves the whole property`

### Talk track fragments

- Observation:
  - `There is enough here to justify moving, even if you want to start smaller.`
- Implication:
  - `A limited first section can reduce risk on your side while still giving us a real signal.`
- Next move:
  - `If that fits better, we can start with a smaller section and use that to decide how to expand.`

### Follow-up modifier

- follow-up should offer the smaller first step without sounding like a discount reflex

### Proof priority

- small-scope proof
- one representative proof item

## 9. Price Structure Rules

These rules govern how anchor and entry option are displayed.

### 9.1 Anchor Rules

- `no_pricing_strategy`
  - Anchor = `not shown`
- `urgency_safety`
  - Anchor = full corrective scope
- `bundle_portfolio`
  - Anchor = current scope framed as repeatable baseline
- `anchor_high_phased`
  - Anchor = full scope first
- `test_close_small_section`
  - Anchor = full job first, then limited first section

### 9.2 Entry Option Rules

- Entry option may only appear when:
  - strategy is not `no_pricing_strategy`
  - no hard block prevents partial framing
- Entry option must be suppressed when:
  - `visible_condition = hazardous` and full-scope review is required
  - partial framing would mislead

### 9.3 Close Path Rules

Every strategy must end with a movement sentence.

Allowed close path types:

- secure access before pricing
- book walkthrough to confirm scope
- start phase 1 and expand
- start current site and expand to broader scope
- confirm internal review path
- send estimate and ask for approval path

Prohibited close path:

- `let me know`

## 10. Strategy by Status Matrix

| Status | Primary Strategy | Secondary Strategy | Last Resort |
| --- | --- | --- | --- |
| Do Not Price - Secure Access First | No Pricing Strategy Active | none | none |
| Range Only - Qualify Before Advancing | Test Close / Small First Section for small scope; Bundle / Portfolio for larger scope | Anchor High + Phased Option when partial is valid and range posture is stable | No Pricing Strategy Active |
| Present Range + Book Walkthrough | Anchor High + Phased Option | Bundle / Portfolio Angle or Urgency / Safety Angle | Test Close / Small First Section |
| Deliver Estimate + Ask For Approval | Anchor High + Phased Option | Bundle / Portfolio Angle or Urgency / Safety Angle | none |
| Escalate Internally Before Pricing | Urgency / Safety Angle when hazardous | No Pricing Strategy Active | none |

## 11. Required Language by Strategy

These phrases should be injected after status-level forced language.

| Strategy | Required Phrase |
| --- | --- |
| `no_pricing_strategy` | `we need verified scope before I put pricing on this` |
| `urgency_safety` | `this may require full-scope review before pricing` |
| `bundle_portfolio` | `there may be value in structuring this beyond a one-off fix` |
| `anchor_high_phased` | `we can frame the full scope first and phase it if needed` |
| `test_close_small_section` | `we can start with a smaller first section if that helps move it forward` |

## 12. Follow-Up Text Modifiers by Strategy

These are not full follow-up texts. They are modifier intents to be applied by the copy layer.

| Strategy | Modifier Intent |
| --- | --- |
| `no_pricing_strategy` | ask for access, review path, or stakeholder identification |
| `urgency_safety` | stress prompt review and risk reduction |
| `bundle_portfolio` | stress repeatability and approval scalability |
| `anchor_high_phased` | stress full scope first, flexible execution second |
| `test_close_small_section` | stress reduced-friction first step and validation path |

## 13. Examples

### Example A: Range Only + Test Close

Inputs:

- property_type: `garden-style`
- scope_band: `11-25`
- access: `mixed`
- confidence: `low`
- visible_condition: `moderate`

Resolved:

- status: `Range Only - Qualify Before Advancing`
- strategy: `Test Close / Small First Section`

Price structure:

- Anchor: full scope soft range
- Entry option: smaller first section
- Close path: qualify interest, then confirm a first-step scope

### Example B: Present Range + Bundle

Inputs:

- property_type: `mid-rise`
- scope_band: `51-100`
- access: `easy`
- confidence: `medium`
- visible_condition: `heavy`

Resolved:

- status: `Present Range + Book Walkthrough`
- strategy: `Bundle / Portfolio Angle`

Price structure:

- Anchor: budgetary range for current site
- Entry option: first building or first section
- Close path: prove on one section, then expand

### Example C: Escalate + Urgency

Inputs:

- property_type: `single-site commercial`
- scope_band: `11-25`
- access: `difficult`
- confidence: `medium`
- visible_condition: `hazardous`

Resolved:

- status: `Escalate Internally Before Pricing`
- strategy: `Urgency / Safety Angle`

Price structure:

- Anchor: not shown in field
- Entry option: not shown
- Close path: confirm review package recipient and internal handoff

## 14. Lock Decisions

These are locked for v1:

- strategy is selected after status, never before
- strategy cannot reduce status severity
- `Urgency / Safety Angle` is not permission to improvise unsafe field pricing
- entry option must be suppressed when partial framing would mislead
- every strategy must define a close path
- no strategy may end in passive language

## 15. What Comes Next

The next build-facing document should be the `Speed Mode Wireframe Spec`.

That document should define:

- top-of-screen hierarchy
- output panel order
- card layout
- button placement
- copy actions
- proof slot behavior
- desktop and mobile priority order
