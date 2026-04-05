# Speed Mode Implementation Task Breakdown

## 1. Purpose

This document translates the Speed Mode spec stack into an implementation sequence.

Its job is to answer:

- what needs to be built
- in what order
- what each workstream owns
- what is required before coding starts
- what can be deferred without distorting the product

This is the first document in the stack that is explicitly execution-oriented.

## 2. Build Goal

Build `Speed Mode v1` as the default `Field Pack` experience inside the Estimate & Proposal system.

The build should produce a working path that:

- collects the 5 required inputs
- runs the deterministic resolver
- renders the status/action/risk hierarchy
- renders talk track, price posture, strategy, close asks, follow-up, and proof
- preserves all guardrails
- hands off to Controlled Mode when eligible

## 3. Build Scope

### In Scope

- resolver engine
- strategy resolver
- overlay application
- Speed Mode UI shell
- input controls
- output cards
- copy actions
- proof selection/rendering
- handoff actions
- fallback logging
- QA coverage for rule resolution

### Out of Scope for v1

- final quote artifact generation
- full outbound sending
- deep analytics dashboard
- learning engine / adaptive optimization
- new CRM backend workflows

## 4. Build Readiness Decision

The current doc stack is sufficient to begin implementation.

What is already locked enough to build:

- product identity
- status logic
- strategy logic
- resolver payload contract
- copy behavior
- wireframe structure

What is still optional, not blocking:

- a dedicated component contract mapping doc
- a UI build sequence doc separate from this one

Conclusion:

- implementation can start after this breakdown
- no major product-definition gap remains

## 5. Workstreams

Use these workstreams for build.

### Workstream A: Resolver Engine

Owns:

- request normalization
- input validation
- status rule evaluation
- fallback logic
- downgrade behavior
- overlay arrays
- permissions object
- handoff object

### Workstream B: Pricing Strategy Engine

Owns:

- strategy resolution
- entry option suppression
- pricing display mode
- strategy-specific close path metadata

### Workstream C: Copy Composer

Owns:

- base status copy
- strategy modifiers
- forced phrase injection
- warning rendering inputs
- talk track assembly
- follow-up text assembly
- proof caption generation

### Workstream D: Speed Mode UI

Owns:

- page shell
- status strip
- left input rail
- right output rail
- mobile layout
- copy buttons
- handoff buttons

### Workstream E: Proof Layer

Owns:

- proof slot rendering
- auto-selection
- override behavior
- empty state behavior

### Workstream F: QA and Telemetry

Owns:

- resolver rule tests
- strategy tests
- UI smoke tests
- fallback logging
- contract validation tests

## 6. Implementation Order

Build in this order.

### Phase 1: Data and Contract Foundation

Tasks:

- create Speed Mode resolver module
- define request and response TypeScript or JS constants/interfaces
- implement input enum validation
- implement normalization of optional fields
- implement reason-code fields

Acceptance criteria:

- resolver accepts only valid enum inputs
- resolver returns the documented contract shape
- invalid requests return structured validation errors

### Phase 2: Status Resolution

Tasks:

- encode derived flags
- encode ordered status rule table
- encode fallback behavior
- encode downgrade behavior via hard blocks
- encode `rep_can_override_status = false`

Acceptance criteria:

- all documented test cases resolve correctly
- fallback rule fires only when no primary rule matches
- fallback emits telemetry flag

### Phase 3: Strategy Resolution

Tasks:

- encode strategy selection order
- encode strategy constraints by status
- encode bundle credibility rule
- encode entry option suppression reasons
- encode pricing object shape

Acceptance criteria:

- strategy never resolves before status
- strategy cannot soften status
- unsafe entry options are suppressed

### Phase 4: Overlay and Proof Logic

Tasks:

- encode forced language arrays
- encode warning flags
- encode proof required / recommended rules
- encode proof priority ordering
- encode no-proof empty state

Acceptance criteria:

- overlays tighten output only
- proof rules never reduce status severity
- proof output is capped at 2 slots

### Phase 5: Copy Composition Layer

Tasks:

- implement base status copy map
- implement strategy modifier map
- implement close ask library
- implement talk track composer
- implement follow-up composer
- implement proof caption mapping
- implement copy validation and fallback behavior

Acceptance criteria:

- talk track follows the 3-part structure
- follow-up text is action-oriented
- banned phrases do not appear
- forced phrases are preserved

### Phase 6: Speed Mode UI Shell

Tasks:

- add Speed Mode entry point inside Estimate & Proposal
- build header and status strip
- build left input rail
- build right output rail
- implement mobile stacking rules
- implement copy buttons

Acceptance criteria:

- status/action/risk render first
- talk track renders before pricing
- close asks render before proof
- UI reflects resolver output without inventing new logic

### Phase 7: Proof UI and Handoff UX

Tasks:

- render proof slots
- implement proof selection override
- render Controlled Mode handoff card
- render Internal Review handoff card

Acceptance criteria:

- proof can be overridden by rep
- proof override does not change status
- handoff only appears when resolver says it should

### Phase 8: QA, Telemetry, and Polish

Tasks:

- contract-level unit tests
- resolver matrix tests
- strategy resolution tests
- UI smoke tests
- fallback telemetry logging
- error-state validation

Acceptance criteria:

- documented cases pass
- contract remains stable
- fallback hits are observable
- UI smoke passes on desktop and mobile

## 7. Suggested Build Sequence Inside the Existing App

Recommended implementation sequence in the codebase:

1. add a dedicated Speed Mode resolver module
2. add strategy and copy composition modules
3. add a new Speed Mode UI section or page inside Estimate & Proposal
4. wire current evidence/photo data into proof slots
5. connect Controlled Mode handoff
6. add tests

Reason:

- this minimizes churn in the existing full Estimate & Proposal flow
- it lets Speed Mode be introduced as a clear new surface instead of a fragile partial rewrite

## 8. Component Breakdown

Recommended component units:

### Resolver / Logic

- `speedModeResolver`
- `speedModeFlags`
- `speedModeStrategies`
- `speedModeCopyComposer`
- `speedModeProof`

### UI

- `SpeedModePanel`
- `SpeedModeStatusStrip`
- `SpeedModeInputs`
- `SpeedModeTalkTrackCard`
- `SpeedModePriceCard`
- `SpeedModeCloseCard`
- `SpeedModeFollowupCard`
- `SpeedModeProofCard`
- `SpeedModeHandoffCard`

### Utilities

- `speedModeValidation`
- `speedModeTelemetry`
- `speedModeTestFixtures`

## 9. Dependencies

### Hard Dependencies

- current Estimate & Proposal page context
- property context
- assessment context
- proof/photo access

### Soft Dependencies

- Controlled Mode routing
- copy-to-clipboard utilities
- optional telemetry sink

## 10. Risk Areas

These are the highest-risk implementation areas.

### Risk 1: UI starts inventing logic

Mitigation:

- UI reads resolver output only
- no UI-side status inference

### Risk 2: pricing logic weakens guardrails

Mitigation:

- resolver owns status
- strategy layer cannot change status

### Risk 3: proof becomes decorative

Mitigation:

- proof is tied to status/strategy metadata
- proof order comes from resolver output

### Risk 4: rep-editable copy drifts from required posture

Mitigation:

- keep required phrases enforced
- keep status and strategy non-editable

### Risk 5: existing Estimate & Proposal flow gets destabilized

Mitigation:

- build Speed Mode as a new bounded layer
- keep Controlled Mode deeper and separate

## 11. Definition of Done

Speed Mode v1 is done when:

- the resolver contract is implemented exactly
- the main documented status cases pass
- the UI renders status/action/risk first
- copy buttons work for talk track, close ask, and follow-up
- proof shows max 2 items
- reps cannot override status or strategy
- handoff behavior works correctly
- the screen is usable on desktop and mobile

## 12. Recommended Delivery Slices

Build this in 3 slices.

### Slice 1: Logic Complete, UI Minimal

Deliver:

- resolver
- strategy
- overlays
- contract tests
- bare output inspector UI

Goal:

- prove logic before styling

### Slice 2: Field Pack UI

Deliver:

- status strip
- input rail
- output cards
- copy actions
- proof slots

Goal:

- usable field workflow

### Slice 3: Integration and Polish

Deliver:

- Controlled Mode handoff
- telemetry
- mobile polish
- final QA

Goal:

- production-safe v1

## 13. How Much Is Left Before Building

Strict answer:

- very little spec work remains
- build can begin now

If measured as prep vs implementation:

- planning/specification is roughly `85-90% done`
- remaining pre-build clarification is roughly `10-15%`, and it is optional rather than blocking

What remains before code, if you want maximum cleanliness:

- optional component contract mapping
- optional engineering task assignment

Neither is required to begin implementation.

## 14. Recommended Immediate Next Step

Start Slice 1.

That means:

1. implement the resolver contract
2. implement strategy and overlay logic
3. expose a temporary debug/output panel
4. verify rule correctness before styling the UI

## 15. Locked Conclusion

We are past the point of needing more product-definition work to start.

The correct move now is implementation.
