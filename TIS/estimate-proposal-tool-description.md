# Estimate & Proposal Tool Description

## Purpose

The `Estimate & Proposal` tool exists to help a field rep turn a completed scout or full audit into a clear next-step conversation.

It is supposed to bridge the gap between:

- what was observed on site
- what that observation means for the property
- how to frame pricing without overcommitting
- how to move the opportunity toward a walkthrough, quote, or approval

In practical terms, the tool is supposed to help a rep go from:

`"I saw something important"`  
to  
`"Here is the right way to explain it, price it, support it, and follow up on it."`

## What The Tool Is For

The tool is supposed to do five jobs well:

1. Convert field observations into a sales-ready message.
2. Turn incomplete site information into a safe pricing posture.
3. Help the rep talk through the opportunity on site.
4. Help the rep prepare clean copy for follow-up by text or email.
5. Keep the rep from making the wrong offer when confidence or scope is weak.

## What The Tool Should Produce

The tool is supposed to produce a usable package for the rep, even before full outbound automation exists.

That package should include:

- a clear status for the opportunity
- a recommended angle for the conversation
- a price posture
- a short field script
- evidence photos that support the claim
- objection handling
- copy for follow-up
- a phased option when a full-scope approval may be hard

## Core Operating Idea

The tool is not supposed to be “just a calculator.”

It is supposed to be a field decision aid.

That means it should help the rep answer these questions:

- What am I actually seeing?
- Why does it matter to this property?
- How strong is the opportunity?
- Is it safe to give a price now, or do I need a walkthrough first?
- What should I say out loud?
- What should I send after I leave?

## Primary Modes

The tool is supposed to work in two modes.

### 1. Field Pack

This is the rep-facing mode for use on-site or immediately after a scout.

It is supposed to:

- show the rep the right talk track quickly
- reduce thinking under pressure
- keep the rep from overselling weak information
- let the rep copy the most important lines in one tap

The `Field Pack` should be the fast-action version of the tool.

It is supposed to show:

- status
- opening line
- observation / impact / ask structure
- price framing
- next step
- best evidence photos
- fastest objection reply
- text/email copy
- phased option if useful

### 2. Proposal Builder

This is the structured follow-up mode.

It is supposed to:

- let the rep refine assumptions
- prepare cleaner delivery copy
- support internal follow-up and approval routing
- help turn a field lead into a real written proposal

This mode is not supposed to replace a formal quote system forever, but it should prepare the material that a formal quote system will use.

## Inputs The Tool Should Use

The tool is supposed to use the information already captured in the assessment.

That includes:

- property identity and basic context
- scout mode
- confidence level
- visible signal data
- access details
- score values
- hazard score values
- contact / decision-maker data
- notes
- photos and photo tags

It is also supposed to use estimate-specific assumptions entered by the rep, such as:

- estimated termination count
- building count
- building height
- condition severity
- access difficulty
- vent-count confidence
- quote mode
- bird-guard or difficult termination adder
- travel / mobilization adder

## Access Terminology

TIS needs two different access concepts and they cannot be blended together:

- `Service access` = physical execution difficulty. This is the pricing and resolver input. It comes from things like building height, termination type, access constraints, computed access difficulty, and estimate access difficulty.
- `Sales access path` = how easy it is to reach the office, maintenance team, or decision-maker and move the opportunity forward. This is the scouting/commercial score stored as `access_score`.

Rule:

- `access_score` must never be treated as a physical labor or service-access pricing factor.
- service access must never be inferred from office visibility or decision-maker availability alone.

## Secondary Inputs

Not every property fact should move price directly.

- For dryer vent pricing, `bedroom mix` and `property age` are secondary context only.
- They should affect price only if they materially change run length, layout consistency, access, or likely system complexity.
- If TIS later adds `air duct cleaning`, those two fields become more useful because they can help estimate square-footage patterns, branch count, supply/return count, layout variation, retrofit likelihood, and contamination expectations.

## Status Logic

The tool is supposed to give the rep a simple top-level answer about how aggressive or cautious to be.

The current status model is the right direction:

- `Walkthrough only`
- `Budgetary range`
- `Ready to quote`

Those statuses are supposed to control tone and behavior.

### Walkthrough Only

This status is supposed to mean:

- scope is not confirmed enough
- confidence is too low
- pricing should stay planning-only
- the rep should move the conversation toward access and confirmation

The tool should push the rep to say:

- what was observed
- why it matters
- why a walkthrough is the right next step

It should prevent the rep from acting like a final quote already exists.

### Budgetary Range

This status is supposed to mean:

- there is enough signal to talk about money
- there is not enough certainty to present final pricing
- the rep can frame a range, but must preserve assumptions

The tool should help the rep communicate:

- approximate scope
- estimated range
- what would tighten the number
- what the next approval step is

### Ready To Quote

This status is supposed to mean:

- the opportunity is strong enough to present a firmer number
- the conditions support moving toward a written estimate
- the rep can proceed with a stronger recommendation

It should still keep assumptions visible, but it should let the rep move faster.

## Messaging Logic

The tool is supposed to help the rep build the message in a disciplined order:

1. Observation
2. Impact
3. Ask

That structure matters because it forces the rep to:

- start with what was actually seen
- explain why the issue matters operationally or financially
- end with a next step instead of random commentary

This is why the hook should not live in one messy free-text box.

The tool is supposed to make each part editable and AI-assisted:

- `Observation`: what was visible on site
- `Impact`: why that creates risk, repeat service, cost, or process failure
- `Ask`: the next step the rep wants

## Price Framing

The tool is supposed to help the rep talk about pricing safely.

It is not supposed to blindly produce a number and imply certainty.

It should:

- generate a range from the current assumptions
- show the per-vent logic
- surface modifiers like access, height, hazards, bird guards, and mobilization
- change the language depending on confidence

This means:

- weak confidence should force softer language
- stronger confidence should allow firmer range language
- severe conditions should support stronger urgency

## Evidence Handling

The tool is supposed to connect words to proof.

That means it should:

- pull in assessment photos
- prefer the highest-value evidence automatically
- let the rep manually choose the best 1-2 proof photos
- keep the photos aligned with the sales angle

The goal is for the rep to say:

`"Here is what we saw, here is why it matters, and here are the photos that prove it."`

## Objection Handling

The tool is supposed to reduce stall-outs in the conversation.

It should help the rep handle predictable objections such as:

- “Just send me something”
- “We need regional approval”
- “Can you break it up?”
- “Can you just do a few units?”
- “We already have someone”

The objection section is supposed to do more than give clever lines.

It should help the rep understand:

- what the objection usually means
- what not to say
- what the next move should be

## Phased Option Logic

The tool is supposed to help the rep preserve value without collapsing into discounting.

When full-scope approval is likely to be hard, it should offer a phased option that:

- keeps the full problem visible
- gives the customer a first-step path
- protects the rep from shrinking the opportunity unnecessarily

This is especially useful when:

- the property is large
- the hazard is real but approval is slow
- the scope is meaningful enough that a “Phase 1 / Phase 2” path is more realistic

## Delivery Copy

The tool is supposed to prepare outbound language in forms that a rep can actually use.

That includes:

- an email version
- a text version
- a forwarding note for regional or internal approval

At minimum, this copy should be:

- clear
- forwardable
- branded correctly
- aligned with the current confidence and scope posture

## What The Tool Should Not Do

The tool is not supposed to:

- pretend a weak estimate is a real quote
- encourage partial scope when hazards require full scope
- imply finality when the rep still needs a walkthrough
- act like outbound automation exists when it does not
- bury risk flags under too much UI

## Current Realistic Definition Of Success

Right now, the tool is successful if a rep can:

- leave a site with the right conversation framing
- preserve the opportunity in a clean field pack
- copy a safe range and a clean follow-up message
- support the message with evidence photos
- avoid saying the wrong thing when confidence is low

In other words, the tool should already make the rep better in the field even before full quote automation is built.

## Full Future-State Vision

Later, the complete version of the tool should go beyond copy support.

It should eventually:

1. Generate a true quote artifact.
2. Attach vendor package materials automatically.
3. Send the quote through the correct outbound channel.
4. Log delivery and response state.
5. Track quote status through approval, revision, and close.

That is the long-term workflow.

## Short Version

The `Estimate & Proposal` tool is supposed to take field evidence, scoring, photos, and assumptions and turn them into the right sales message, the right pricing posture, and the right next-step follow-up.

It is supposed to help the rep know:

- what to say
- how hard to push
- how to frame the number
- what proof to use
- what to send next

That is the real job of the tool.
