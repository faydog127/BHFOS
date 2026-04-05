# Speed Mode Status -> Action Rule Table

## 1. Purpose

This document defines the deterministic resolver for `Speed Mode v1`.

Its job is to answer, from a fixed input set:

- what status the rep is in
- what action the rep should take
- what risk must be surfaced
- what price posture is allowed
- what pricing strategies are eligible
- what close asks are allowed
- what proof handling is required

This document is implementation-facing. UI should render this logic, not invent it.

## 2. Canonical Input Object

Use this shape internally:

```json
{
  "property_type": "garden-style | mid-rise | high-rise | single-site commercial | other",
  "scope_band": "1-10 | 11-25 | 26-50 | 51-100 | 100+",
  "access": "easy | mixed | difficult | unknown",
  "confidence": "low | medium | high",
  "visible_condition": "low | moderate | heavy | hazardous | unknown",
  "proof_available": "yes | no",
  "proof_strength": "weak | moderate | strong",
  "decision_maker_present": "yes | no"
}
```

Notes:

- `scope_band` is the internal name for the required `rough count` input.
- resolver `access` means physical/service execution access, not assessment `access_score`
- assessment `access_score` is the commercial/sales-path score for opportunity movement
- Optional system inputs can enrich copy, proof selection, and follow-up tone.
- Optional system inputs can never reduce a more restrictive status.

## 3. Resolver Doctrine

The resolver uses four rules:

1. Most restrictive valid status wins.
2. Rules are evaluated top-to-bottom.
3. First match wins.
4. Post-processing overlays can add required language and warning flags, but they do not lower status severity.

## 4. Status Precedence

Evaluate statuses in this order:

1. `Escalate Internally Before Pricing`
2. `Do Not Price - Secure Access First`
3. `Range Only - Qualify Before Advancing`
4. `Present Range + Book Walkthrough`
5. `Deliver Estimate + Ask For Approval`

Reason:

- `Escalate Internally Before Pricing` is the highest-severity commercial control status.
- `Do Not Price - Secure Access First` is the highest-severity uncertainty control status.
- `Range Only - Qualify Before Advancing` is the safe fallback for partial selling motion.
- `Present Range + Book Walkthrough` is a forward-motion range posture.
- `Deliver Estimate + Ask For Approval` is the least restrictive posture and should only be reached when no harder status applies.

## 5. Derived Flags

Derive these flags before evaluating rules:

```text
scope_small = scope_band in {1-10, 11-25}
scope_medium = scope_band in {26-50}
scope_large = scope_band in {51-100, 100+}
scope_massive = scope_band == 100+

access_clear = access == easy
access_partial = access == mixed
access_hard = access == difficult
access_unknown = access == unknown

confidence_low = confidence == low
confidence_medium = confidence == medium
confidence_high = confidence == high

condition_low = visible_condition == low
condition_moderate = visible_condition == moderate
condition_heavy = visible_condition == heavy
condition_hazardous = visible_condition == hazardous
condition_unknown = visible_condition == unknown

property_complex = property_type in {high-rise, single-site commercial, other}
property_standard = property_type in {garden-style, mid-rise}

proof_required_base =
  visible_condition in {heavy, hazardous}
  or access == difficult
```

## 6. Status Payload Definitions

Each resolved status returns a payload with this shape:

```json
{
  "status_key": "",
  "status_label": "",
  "action_command": "",
  "risk_warning": "",
  "price_posture": "",
  "default_strategy": "",
  "allowed_strategies": [],
  "blocked_strategies": [],
  "primary_close_ask_key": "",
  "backup_close_ask_key": "",
  "controlled_mode_eligible": false,
  "internal_review_required": false,
  "proof_required": false
}
```

### 6.1 Status Definition Table

| Status Key | Status Label | Action Command | Risk Warning | Price Posture | Default Strategy | Allowed Strategies | Blocked Strategies | Primary Close Ask Key | Backup Close Ask Key | Controlled Mode Eligible | Internal Review Required | Proof Required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `escalate_internal` | Escalate Internally Before Pricing | Route internally before pricing. Confirm the review path and stakeholders now. | Hazard, access, or complexity makes field pricing unsafe. | Internal review required before pricing | Urgency / Safety Angle | `urgency_safety`, `no_pricing_strategy` | `anchor_high_phased`, `bundle_portfolio`, `test_close_small_section` | `escalate_primary` | `escalate_backup` | false | true | true |
| `do_not_price_secure_access` | Do Not Price - Secure Access First | Do not give pricing. Secure access and verify scope first. | Scope is too uncertain for any reliable number. | No pricing yet | No Pricing Strategy Active | `no_pricing_strategy` | `anchor_high_phased`, `bundle_portfolio`, `urgency_safety`, `test_close_small_section` | `secure_access_primary` | `secure_access_backup` | false | false | false |
| `range_only_qualify` | Range Only - Qualify Before Advancing | Use soft range language only and qualify the next step. | Use range language only. Do not imply confirmed count or scope. | Soft range only | Test Close / Small First Section | `anchor_high_phased`, `bundle_portfolio`, `test_close_small_section`, `no_pricing_strategy` | `urgency_safety` unless hazardous override is active | `range_only_primary` | `range_only_backup` | false | false | false |
| `present_range_book_walkthrough` | Present Range + Book Walkthrough | Use a budgetary range to move toward a walkthrough. | Do not imply final scope is fully confirmed. | Budgetary range | Anchor High + Phased Option | `anchor_high_phased`, `bundle_portfolio`, `urgency_safety`, `test_close_small_section` | `no_pricing_strategy` | `book_walkthrough_primary` | `book_walkthrough_backup` | true | false | false |
| `deliver_estimate_ask_approval` | Deliver Estimate + Ask For Approval | Deliver estimate posture and ask for the approval path. | Hazard, access, or scope modifiers can still affect final margin if new facts appear. | Estimate ready | Anchor High + Phased Option | `anchor_high_phased`, `bundle_portfolio`, `urgency_safety` | `test_close_small_section` when condition is hazardous | `approval_primary` | `approval_backup` | true | false | false |

Implementation notes:

- `urgency_safety` is allowed under `deliver_estimate_ask_approval` only when the condition is well-supported and not internally escalated.
- `no_pricing_strategy` can be used under `range_only_qualify` when the system wants soft qualification language without money structure, but it should be avoided when a valid pricing strategy exists.

## 7. Ordered Status Resolver

Evaluate these rules in order. First match wins.

### 7.1 Priority Band A: Escalate Internally Before Pricing

| Rule ID | Condition | Status |
| --- | --- | --- |
| `E1` | `condition_hazardous` and `access_hard` | `escalate_internal` |
| `E2` | `condition_hazardous` and `scope_large` | `escalate_internal` |
| `E3` | `condition_hazardous` and `property_complex` | `escalate_internal` |
| `E4` | `access_hard` and `scope_massive` and not `confidence_high` | `escalate_internal` |
| `E5` | `property_type == high-rise` and `access_hard` and `visible_condition in {heavy, hazardous}` | `escalate_internal` |
| `E6` | `property_type == single-site commercial` and `access_hard` and `visible_condition in {heavy, hazardous}` | `escalate_internal` |

Interpretation:

- This band is about commercial and delivery complexity, not just uncertainty.
- When these rules fire, the rep should stop trying to solve pricing in the field.

### 7.2 Priority Band B: Do Not Price - Secure Access First

| Rule ID | Condition | Status |
| --- | --- | --- |
| `D1` | `confidence_low` and `access_unknown` | `do_not_price_secure_access` |
| `D2` | `confidence_low` and `scope_massive` | `do_not_price_secure_access` |
| `D3` | `confidence_low` and `access_hard` | `do_not_price_secure_access` |
| `D4` | `confidence_low` and `condition_unknown` | `do_not_price_secure_access` |

Interpretation:

- This band is about not knowing enough to price safely.
- This is stricter than `range_only_qualify`, but less operationally severe than internal escalation.

### 7.3 Priority Band C: Range Only - Qualify Before Advancing

| Rule ID | Condition | Status |
| --- | --- | --- |
| `R1` | `confidence_low` and `access in {easy, mixed}` and `visible_condition in {low, moderate, heavy}` and not `scope_massive` | `range_only_qualify` |
| `R2` | `confidence_medium` and `access_unknown` | `range_only_qualify` |
| `R3` | `confidence_medium` and `condition_unknown` and `access in {easy, mixed}` | `range_only_qualify` |
| `R4` | `confidence_medium` and `scope_large` and `access in {easy, mixed}` and `visible_condition != hazardous` | `range_only_qualify` |
| `R5` | `confidence_high` and `condition_unknown` | `range_only_qualify` |

Interpretation:

- This band allows forward motion, but only with soft range language.
- It is the default uncertainty posture when full blocking is not justified.

### 7.4 Priority Band D: Present Range + Book Walkthrough

| Rule ID | Condition | Status |
| --- | --- | --- |
| `P1` | `confidence_medium` and `access in {easy, mixed}` and `visible_condition in {low, moderate, heavy}` and not `scope_large` | `present_range_book_walkthrough` |
| `P2` | `confidence_high` and `access_mixed` and `visible_condition in {low, moderate, heavy}` and not `scope_massive` | `present_range_book_walkthrough` |
| `P3` | `confidence_high` and `access_clear` and `condition_heavy` and `scope_medium` and `property_standard` | `present_range_book_walkthrough` |
| `P4` | `confidence_high` and `access_clear` and `visible_condition in {low, moderate}` and `scope_large` and `property_standard` | `present_range_book_walkthrough` |
| `P5` | `confidence_high` and `access_clear` and `condition_hazardous` and `scope_small` and `property_standard` | `present_range_book_walkthrough` |

Interpretation:

- This band is the main forward-motion selling posture.
- It is allowed to use money, but the close should still move toward validation or scope confirmation.
- Hazardous but simple cases remain in this band, not `deliver_estimate_ask_approval`, for v1 safety.

### 7.5 Priority Band E: Deliver Estimate + Ask For Approval

| Rule ID | Condition | Status |
| --- | --- | --- |
| `Q1` | `confidence_high` and `access_clear` and `visible_condition in {low, moderate}` and `scope_band in {1-10, 11-25, 26-50}` and `property_standard` | `deliver_estimate_ask_approval` |
| `Q2` | `confidence_high` and `access_clear` and `condition_heavy` and `scope_small` and `property_standard` | `deliver_estimate_ask_approval` |
| `Q3` | `confidence_high` and `access_mixed` and `visible_condition in {low, moderate}` and `scope_small` and `property_type == garden-style` | `deliver_estimate_ask_approval` |

Interpretation:

- This band should be hard to reach.
- It is reserved for high-confidence, controlled-scope situations.
- Hazardous cases do not promote to this status in v1.

### 7.6 Fallback Rule

If no rule above matches:

- if `confidence in {medium, high}` and `access != unknown` and `visible_condition != unknown`
  - return `present_range_book_walkthrough`
- otherwise
  - return `range_only_qualify`

This guarantees full coverage without creating a silent null state.

## 8. Post-Processing Guardrails

Status resolution happens first. Then apply overlays.

### 8.1 Hard Blocks

These can further restrict strategy and output fields after status is assigned.

| Rule ID | Condition | Required Effect |
| --- | --- | --- |
| `HB1` | `confidence_low` and `access_unknown` | force `price_posture = No pricing yet`; force `default_strategy = no_pricing_strategy` |
| `HB2` | `condition_hazardous` | block `test_close_small_section` |
| `HB3` | `scope_massive` and not `confidence_high` | block `deliver_estimate_ask_approval` strategy set; if current status is `deliver_estimate_ask_approval`, downgrade to `present_range_book_walkthrough` |
| `HB4` | `access_hard` and not `confidence_high` | block `deliver_estimate_ask_approval`; if current status is `deliver_estimate_ask_approval`, downgrade to `present_range_book_walkthrough` |

Implementation note:

- `HB3` and `HB4` should almost never fire if the main table is implemented correctly. They are defensive checks.

### 8.2 Forced Language

Add these phrases to the talk track and/or follow-up text when conditions match.

| Rule ID | Condition | Required Phrase |
| --- | --- | --- |
| `FL1` | `access_unknown` | `subject to access verification` |
| `FL2` | `confidence_low` | `based on limited field visibility` |
| `FL3` | `scope_large` and not `confidence_high` | `range only until scope is confirmed` |
| `FL4` | `condition_hazardous` | `this may require full-scope review before pricing` |

### 8.3 Warning Flags

These do not change status. They render visible caution.

| Rule ID | Condition | Warning |
| --- | --- | --- |
| `WF1` | `property_type == high-rise` | `building complexity may understate labor and access requirements` |
| `WF2` | `access_partial` | `range should account for uneven access conditions` |
| `WF3` | `condition_heavy` | `visible condition may indicate deeper scope than surface observation suggests` |

## 9. Strategy Eligibility by Status

Use this matrix after status resolution.

| Status Key | Strategy Default | Strategy Notes |
| --- | --- | --- |
| `escalate_internal` | `urgency_safety` if condition is hazardous, otherwise `no_pricing_strategy` | No numbers should be shown unless internal policy explicitly adds review outputs later. |
| `do_not_price_secure_access` | `no_pricing_strategy` | No money structure. Close path is verification only. |
| `range_only_qualify` | `test_close_small_section` for `scope_small`; `bundle_portfolio` for `scope_medium` or `scope_large`; `no_pricing_strategy` if access or condition is still too weak | Keep the structure soft. No estimate-ready phrasing. |
| `present_range_book_walkthrough` | `anchor_high_phased` by default; `bundle_portfolio` when property scale suggests expansion; `urgency_safety` for simple hazardous cases | This is the main selling status. |
| `deliver_estimate_ask_approval` | `anchor_high_phased` by default; `bundle_portfolio` when broader relationship value is plausible; `urgency_safety` only when evidence is strong and no escalation rule fired | Avoid unnecessary hedging. |

## 10. Close Ask Mapping

Map close asks directly by status.

| Status Key | Primary Close Ask Key | Backup Close Ask Key |
| --- | --- | --- |
| `do_not_price_secure_access` | `secure_access_primary` | `secure_access_backup` |
| `range_only_qualify` | `range_only_primary` | `range_only_backup` |
| `present_range_book_walkthrough` | `book_walkthrough_primary` | `book_walkthrough_backup` |
| `deliver_estimate_ask_approval` | `approval_primary` | `approval_backup` |
| `escalate_internal` | `escalate_primary` | `escalate_backup` |

Implementation rule:

- The close ask library should never be selected independently from status.

## 11. Proof Logic Integration

Apply proof rules after status resolution.

### 11.1 Proof Requirement

Set `proof_required = true` when any of the following is true:

- `visible_condition in {heavy, hazardous}`
- `access == difficult`
- resolved status is `escalate_internal`

### 11.2 Proof Recommendation

Set `proof_recommended = true` when any of the following is true:

- resolved status is `present_range_book_walkthrough`
- strategy is `urgency_safety`
- strategy is `bundle_portfolio`

### 11.3 Speed Mode Display Rules

- show max 2 proof slots
- auto-select strongest proof first
- allow rep override
- if `proof_required = true` and `proof_available = no`, show:
  - `No proof attached - rely on range/verification language only`

Proof availability does not reduce a restrictive status.

## 12. Controlled Mode Handoff Rules

After status is resolved:

### Enter Controlled Mode when:

- resolved status is `deliver_estimate_ask_approval`
- customer asked for written pricing
- proof package needs expansion
- scope complexity justifies assumptions review
- forwarding copy or internal approval prep is needed

### Escalate instead of Controlled Mode when:

- resolved status is `escalate_internal`
- hazard and complexity make field pricing unsafe
- commercial authority is exceeded

## 13. Implementation Pseudocode

```text
function resolveSpeedMode(input):
  flags = deriveFlags(input)

  for rule in ORDERED_STATUS_RULES:
    if rule.matches(input, flags):
      status = STATUS_DEFINITIONS[rule.status_key]
      break

  if no status:
    status = fallbackStatus(input, flags)

  status = applyHardBlocks(status, input, flags)
  forcedLanguage = collectForcedLanguage(input, flags, status)
  warningFlags = collectWarningFlags(input, flags, status)
  proofRules = resolveProofRules(input, flags, status)
  strategy = resolveStrategy(status, input, flags)
  closeAsks = mapCloseAsks(status)

  return {
    status_key: status.status_key,
    status_label: status.status_label,
    action_command: status.action_command,
    risk_warning: status.risk_warning,
    price_posture: status.price_posture,
    pricing_strategy: strategy,
    primary_close_ask_key: closeAsks.primary,
    backup_close_ask_key: closeAsks.backup,
    forced_language: forcedLanguage,
    warning_flags: warningFlags,
    proof_rules: proofRules
  }
```

## 14. Test Cases To Validate The Resolver

Minimum resolver tests:

1. `high-rise + 100+ + unknown access + low confidence + unknown condition`
   - expected: `do_not_price_secure_access`

2. `single-site commercial + 11-25 + difficult + medium confidence + hazardous`
   - expected: `escalate_internal`

3. `garden-style + 26-50 + mixed + medium confidence + moderate`
   - expected: `present_range_book_walkthrough`

4. `garden-style + 11-25 + easy + high confidence + moderate`
   - expected: `deliver_estimate_ask_approval`

5. `garden-style + 100+ + easy + medium confidence + moderate`
   - expected: `range_only_qualify`

6. `mid-rise + 11-25 + easy + high confidence + hazardous`
   - expected: `present_range_book_walkthrough`

7. `high-rise + 26-50 + difficult + medium confidence + heavy`
   - expected: `escalate_internal`

## 15. Lock Decisions

These decisions are intentionally locked for v1:

- hazardous cases do not promote to `deliver_estimate_ask_approval`
- optional system inputs do not lower a restrictive status
- status resolution is rule-based, not AI-based
- first match wins
- fallback is never blank

## 16. What Comes Next

The next document should be the `Pricing Strategy Template Pack`.

That doc should define:

- anchor structure
- entry option logic
- close path wording
- when each strategy is selected
- strategy-specific talk track fragments
