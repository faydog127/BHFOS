# Estimate And Proposal Outbound Review

This document pulls the customer-facing and rep-facing copy from the current `EstimateProposal` tool into one place for fast review.

Important current-state note:

- The tool does **not** actually send email or text.
- The real outbound content today is the copy shown on screen and copied to clipboard.
- The live tool now presents this as a `Field Pack` and `Proposal Builder`.
- Reps now get one-tap copy actions for `Opening`, `Price`, `Objection`, `Text`, `Email`, and `Phase Option` when available.
- The old placeholder outbound action buttons were removed from the live estimate page and replaced with manual follow-through copy actions.

## Tokens Used In The Copy

- `[Property Name]` = property name from the assessment
- `[Recipient Name]` = delivery recipient name or assessment contact
- `[Rep Name]` = rep profile name
- `[Estimate Range]` = generated budget range
- `[Regional Name]` = manual placeholder inside the regional forwarding note
- `[Manager Name]` = fallback placeholder if no manager name exists

## Angle Library

These drive the coaching panel, field script, recommendation section, and some objection replies.

### Safety

- Label: `Safety`
- Why: `Blocked or painted terminations restrict airflow and elevate fire risk.`
- Opening: `I noticed multiple blocked or painted terminations, which restrict airflow and increase fire risk.`
- Questions:
  - `Are you seeing dryer performance or lint complaints during turns?`
  - `Is vent cleaning on a regular schedule or only when issues show up?`
  - `Who signs off on a property-wide service if it makes sense?`
- Avoid:
  - `Do not offer partial scope when hazards are visible.`
  - `Do not promise a fixed price without confirming terminations.`
- Recommended approach: `Full-property service. No partial option.`

### Repeat Service Calls

- Label: `Repeat Service Calls`
- Why: `Widespread lint buildup suggests recurring maintenance calls and repeat cost.`
- Opening: `We saw repeated lint buildup across terminations, which usually means ongoing service calls.`
- Questions:
  - `How often do vent-related work orders come in?`
  - `Is vent cleaning part of PM or handled case-by-case?`
  - `Who approves vendors for recurring maintenance?`
- Avoid:
  - `Don't lead with safety language unless hazards are visible.`
  - `Don't quote full-property if confidence is low.`
- Recommended approach: `Building or property-level recurring service plan.`

### Process Gap

- Label: `Process Gap`
- Why: `Mixed maintenance signals point to inconsistent processes or missed cycles.`
- Opening: `The maintenance pattern looks inconsistent, which usually means the process needs a reset.`
- Questions:
  - `How is vent maintenance tracked today?`
  - `Is this handled in-house or outsourced?`
  - `Would a baseline inspection help set a schedule?`
- Avoid:
  - `Don't overstate hazard without evidence.`
  - `Don't quote before confirming access.`
- Recommended approach: `Inspection-led service with a PM schedule.`

### Watch

- Label: `Watch`
- Why: `Evidence is limited or confidence is low.`
- Opening: `We should confirm scope and access before pricing.`
- Questions:
  - `Is it possible to walk a couple of units to confirm conditions?`
  - `Who should be involved in a walkthrough?`
- Avoid:
  - `Don't quote without a walkthrough.`
- Recommended approach: `Walkthrough required before pricing.`

## Quote Readiness Logic

- `Walkthrough required` if assessment confidence is `low`
- `Walkthrough required` if vent-count confidence is `low`
- `Quote now` if quote mode is `Full Proposal`
- `Quote now` if hazard total is `8+` and confidence is not low
- Otherwise `Quote with caution`

## Field Status Logic

- `Walkthrough only` if quote readiness is `Walkthrough required`
- `Ready to quote` if quote mode is `Full Proposal` or quote readiness is `Quote now`
- `Budgetary range` otherwise

## Generated Field Script

### Observation Text

- If condition is `normal`: `visible lint buildup on several terminations`
- If condition is `heavy`: `heavy lint buildup across multiple terminations`
- If condition is `hazard`: `blocked or painted terminations`

### Impact Text

- Safety or hazard condition: `restricted airflow and elevated fire risk`
- Repeat service: `repeat maintenance calls and dryer performance issues`
- Process gap: `inconsistent maintenance cycles and avoidable work orders`
- Watch: `unclear scope until access is confirmed`

### Ask Text

- Safety or hazard condition: `a quick walkthrough so we can confirm full-property scope`
- Repeat service: `a baseline count so we can align a recurring service plan`
- Process gap: `a baseline inspection to reset the maintenance schedule`
- Watch: `a walkthrough to confirm conditions and access`

### Hook Lines

- Opening line: angle-specific opening from the angle library
- Observation line template: `Observation: [Observation Text].`
- Impact line template: `Impact: [Impact Text].`
- Ask line template: `Ask: Would you be open to [Ask Text]?`

### Price Framing

- If terminations are entered:
  - In `Walkthrough only` mode:
    - `For planning only, similar scope can land around [Estimate Range], but I would want a walkthrough before treating that as a quote.`
  - In `Ready to quote` mode:
    - `Based on roughly [Terminations] terminations across [Buildings or Y] buildings with [Access] access, this should fall in the [Estimate Range] range.`
  - In `Budgetary range` mode:
    - `Based on roughly [Terminations] terminations across [Buildings or Y] buildings with [Access] access, this likely falls in the [Estimate Range] budgetary range.`
- If terminations are not entered:
  - In `Walkthrough only` mode:
    - `I need a walkthrough to confirm terminations and access before I treat pricing as a quote.`
  - Otherwise:
    - `Once we confirm the termination count and access, I can provide a tight price range.`

### Next Step Line

- If field status is `Walkthrough only`:
  - `Next step: schedule a walkthrough before quoting.`
- If field status is `Ready to quote`:
  - `Next step: confirm scope and send the range with a full-scope recommendation.`
- Otherwise:
  - `Next step: share the budgetary range and confirm count before final pricing.`
  - If a phased option is generated:
    - `Next step: share the budgetary range and offer a phased option if approval is tight.`

### Copy Pack Content

When the rep presses `Copy Pack`, the tool copies:

- `Status: [Field Status]`
- `Opening: [Angle Opening]`
- `Hook: [Observation Line] [Impact Line] [Ask Line]`
- `Price: [Price Line]`
- `Objection reply: [First objection card response if present]`
- `Phased option: [Phase copy if present]`
- `Next step: [Field Direction]`

## Evidence Quick View

- The tool now auto-selects up to 2 proof photos for the field pack using the highest-risk tags first.
- The rep can change the proof-photo selection from the `Evidence Quick View` section.
- The selected proof photos are displayed at the top of the live estimate page inside the `Field Pack`.

## Manual Follow-Through

- The tool still does **not** send email or text directly.
- The live page now includes manual follow-through actions:
  - `Copy Email`
  - `Copy Text`
  - `Copy Forwarding Note`
  - `Copy Phase Option` when available
  - `Capture Decision Maker` / `Edit Contact Details`

## Estimate Inputs That Change The Copy

- Building height:
  - `1-2 Floors`
  - `3 Floors`
  - `4+ Floors`
- Condition:
  - `Normal`
  - `Heavy buildup`
  - `Blocked / hazard`
- Service access:
  - `Easy`
  - `Moderate`
  - `Difficult`
- Vent count confidence:
  - `High`
  - `Medium`
  - `Low`
- Quote mode:
  - `Budgetary Range`
  - `Walkthrough Confirmed`
  - `Full Proposal`
- Adders:
  - `Bird guard / difficult termination (+$10-$25 per vent)`
  - `Travel / mobilization needed (+$250)`

Terminology note:

- `Service access` changes pricing and estimate language.
- `Sales access path` does not. That is the scouting/commercial `access_score` used to judge how easy the opportunity is to advance.

## Estimate Output Warnings

- Price presentation header:
  - `How to Present the Price`
- Recommended approach banner:
  - `Recommended approach: [Angle Recommend]`
- Small-scope warning:
  - `Minimum job applies ($750) and mobilization may apply (+$250) for small scopes.`
- Hazard warning:
  - `Blocked/safety condition detected. Do not offer partial scope.`

## Assumptions Line

- Template:
  - `Based on roughly [Terminations or X] terminations across [Buildings or Y] buildings with [Access] access and [Height or standard] height.`

## Do Not Offer Rules

- Safety or hazard condition:
  - `Partial scope / spot cleaning`
  - `Unit-by-unit only pricing`
- Repeat service:
  - `Downplaying recurring maintenance costs`
- Process gap:
  - `Fixed price without a walkthrough`
- Watch:
  - `Final pricing without confirming scope`

## Risk Flags

These are shown as warnings when triggered:

- `Large property - verify termination count.`
- `Multi-building coordination required.`
- `Heavy buildup slows production.`
- `Safety hazard requires full scope.`
- `Difficult access increases time.`
- `Low vent-count confidence - quote with caution.`
- `Low assessment confidence - walkthrough required.`
- `Travel/mobilization added.`

## Delivery Templates

These are the exact outbound templates currently generated in the tool.

### Email Subject

`Dryer Vent Service Estimate - [Property Name]`

### Email Body

```text
[TVG BRAND HEADER: logo | certifications | badges]

Hello [Recipient Name],

Attached is the estimate and vendor information package for [Property Name] based on conditions observed on site. I kept the scope and assumptions clear so it can be reviewed internally or forwarded if needed.

Please let me know if you'd like a revised scope, a phased option, or a follow-up walkthrough.

Best,
[Rep Name]
The Vent Guys
[TVG BRAND FOOTER: theventguys.com | contact info]
```

### Text Message

```text
Hi [Recipient Name], this is [Rep Name] with The Vent Guys. I just sent over the estimate and vendor packet for [Property Name]. If you'd like, I can send a version that's easier to forward to regional.
```

### Regional Forwarding Note

```text
[TVG BRAND HEADER: logo | certifications | badges]

Hi [Regional Name],

Attached is a vendor quote and packet for dryer vent service at [Property Name]. The estimate is based on visible conditions observed and can be revised after scope confirmation if needed.

Please let me know if you'd like a clean summary version for approval routing.

Thanks,
[Manager Name or Recipient Name] / [Rep Name]
[TVG BRAND FOOTER: theventguys.com | contact info]
```

## Objection Library

Only three cards show at once, but this is the full library currently available.

### 1. Partial Scope

- Category: `Scope`
- If they say: `Can we just do a few buildings or units?`
- What they mean: `They want to reduce immediate spend without rejecting you outright.`
- Respond with:
  - Safety: `We can stage it, but with blocked or restricted terminations showing up like this, it usually needs to be handled more broadly to actually solve the issue.`
  - Repeat service: `We can break it up, but when buildup is this consistent, it usually keeps turning into repeat calls elsewhere.`
  - Process gap: `We can start smaller, but the pattern suggests the underlying issue may still stay in place unless it's addressed more systematically.`
  - Watch: `We can stage it, but I'd want to confirm scope so the smaller section doesn't misrepresent the issue.`
- Your goal:
  - Safety: `Protect full-scope positioning.`
  - Repeat service: `Shift from isolated work to broader maintenance logic.`
  - Process gap: `Keep them from defaulting to patchwork.`
  - Watch: `Avoid under-scoping before confirmation.`
- Best next move:
  - Safety: `Offer phased scheduling, not reduced scope.`
  - Repeat service: `Position a property-wide plan with staged timing.`
  - Process gap: `Offer a baseline walkthrough to confirm scope.`
  - Watch: `Confirm scope before quoting.`

### 2. Price High

- Category: `Budget`
- If they say: `That seems high.`
- What they mean: `They need justification, not necessarily a lower number.`
- Respond with:
  - Safety: `A lot of that comes from the number of terminations and the fact that this is beyond routine buildup in multiple areas.`
  - Repeat service: `The range reflects the total number of terminations and that the issue looks spread across the property, not isolated.`
  - Process gap: `Most of the cost is in getting ahead of repeated patchwork and handling the scope correctly the first time.`
  - Watch: `Once we confirm count and access, I can tighten the range and keep it accurate.`
  - Low confidence override: `Totally fair. Once we confirm count and access, I can tighten the range and keep it accurate.`
- Your goal:
  - Safety: `Tie price to scope and condition.`
  - Repeat service: `Re-anchor price to size and repeat pattern.`
  - Process gap: `Frame price as corrective value.`
  - Watch: `Defer firm pricing until scope is confirmed.`
- Best next move:
  - Safety: `Repoint to assumptions and scope drivers.`
  - Repeat service: `Confirm termination count and access.`
  - Process gap: `Offer a phased plan after walkthrough.`
  - Watch: `Schedule a walkthrough.`

### 3. Already Have Vendor

- Category: `Process`
- If they say: `We already have a vendor.`
- What they mean: `They don't want extra work unless the current setup is clearly weak.`
- Respond with:
  - Safety: `Got it. Are they handling this on a schedule, or more once issues show up?`
  - Repeat service: `Understood. Is that helping reduce repeat dryer or vent-related calls, or is it still coming back?`
  - Process gap: `Got it. Is their work part of a property-wide plan, or more case-by-case when something comes up?`
  - Watch: `Understood. Is their work scheduled, or handled when issues arise?`
- Your goal:
  - Safety: `Expose whether the current system is reactive.`
  - Repeat service: `Make performance the issue, not loyalty.`
  - Process gap: `Surface process weakness without attacking.`
  - Watch: `Learn how service is handled today.`
- Best next move:
  - Safety: `Offer documentation they can compare.`
  - Repeat service: `Offer a baseline assessment.`
  - Process gap: `Offer a schedule recommendation.`
  - Watch: `Gather workflow details.`

### 4. Need To Think

- Category: `Timing`
- If they say: `I need to think about it.`
- What they mean: `They want a way to review internally without committing on-site.`
- Respond with:
  - Default: `Of course. Would it help if I sent over a simple quote and vendor packet so you have something concrete to review?`
- Your goal:
  - Default: `Advance to documented follow-up.`
- Best next move:
  - Default: `Send quote range + vendor packet.`

### 5. Send Me Something

- Category: `Process`
- If they say: `Send me something.`
- What they mean: `They need a leave-behind or something to forward.`
- Respond with:
  - Default: `Absolutely. I can send a quote range and our vendor package over right now so you have it while this is still fresh.`
- Your goal:
  - Default: `Move immediately to quote/package delivery.`
- Best next move:
  - Default: `Send quote + vendor packet.`

### 6. Not Urgent

- Category: `Timing`
- If they say: `It's not urgent.`
- What they mean: `They don't feel enough pressure to act yet.`
- Respond with:
  - Safety: `I understand. My concern is that once terminations are getting restricted like this, it usually doesn't stay isolated.`
  - Repeat service: `Totally fair. The reason I'm bringing it up is that this type of buildup usually keeps showing back up as repeated service calls.`
  - Process gap: `Understood. This may not be urgent today, but the current pattern usually keeps maintenance stuck in reaction mode.`
  - Watch: `Understood. A walkthrough now keeps options open when timing is better.`
- Your goal:
  - Safety: `Raise urgency without sounding dramatic.`
  - Repeat service: `Shift from urgency to cost of delay.`
  - Process gap: `Frame in operational terms.`
  - Watch: `Keep a path open without pressure.`
- Best next move:
  - Safety: `Offer walkthrough scheduling.`
  - Repeat service: `Offer a maintenance schedule option.`
  - Process gap: `Offer a baseline inspection.`
  - Watch: `Schedule a follow-up.`

### 7. Just Quote A Few

- Category: `Scope`
- If they say: `Just quote me a few units.`
- What they mean: `They want a low anchor without committing to full scope.`
- Respond with:
  - Safety: `I can give a limited quote, but I'd want to be clear that with the conditions we saw, that probably won't represent the real scope.`
  - Repeat service: `I can price a smaller section, but with buildup this widespread, it usually doesn't stay contained to that section.`
  - Process gap: `I can quote a subset, but it's hard to make that represent the full pattern without confirming the rest.`
  - Watch: `I can, but it would be a placeholder until we confirm the full scope.`
- Your goal:
  - Safety: `Protect against misleading low-scope quoting.`
  - Repeat service: `Keep broader pattern visible.`
  - Process gap: `Avoid anchoring to incomplete scope.`
  - Watch: `Set expectations for a follow-up scope check.`
- Best next move:
  - Safety: `Offer phased scope with clear assumptions.`
  - Repeat service: `Offer a building-level plan.`
  - Process gap: `Confirm the rest of the scope.`
  - Watch: `Walkthrough before final pricing.`

### 8. Regional Has To Approve

- Category: `Process`
- If they say: `Regional would have to approve this.`
- What they mean: `They need a clean, forwardable package to send up.`
- Respond with:
  - Default: `That makes sense. I can send a clean quote and vendor packet you can forward, and keep the scope clear for review.`
- Your goal:
  - Default: `Support internal forwarding and reduce friction.`
- Best next move:
  - Default: `Generate a forwardable packet.`

## What Actually Shows By Scenario

- Default card order:
  - `partial_scope`
  - `price_high`
  - `send_me_something`
- If quote readiness is `Walkthrough required`:
  - `need_to_think`
  - `send_me_something`
  - `partial_scope`
- If regional/approval is detected:
  - `already_have_vendor`
  - `regional_has_to_approve`
  - `send_me_something`

## Quick Review Notes

- The copy is strong on framing and objection control.
- The delivery templates are still generic and not very site-specific.
- The biggest current weakness is that the tool helps the rep talk and copy, but it does not yet complete the actual send workflow.
