# Speed Mode Resolver JSON Contract

## 1. Purpose

This document defines the build-facing JSON contract for the `Speed Mode v1` resolver.

It exists so engineering can implement the system without reinterpreting prose.

This contract turns the operating docs into:

- exact input fields
- exact enum values
- exact output fields
- exact reason-code arrays
- downgrade behavior
- overlay behavior
- proof object shape
- strategy object shape
- handoff object shape

UI should consume this contract.
Resolver logic should produce this contract.
Copy generation should read this contract.

## 2. Contract Scope

This contract covers:

- request payload shape
- validation behavior
- resolver response shape
- status resolution metadata
- pricing strategy metadata
- proof metadata
- handoff metadata
- debug / analytics reason codes

This contract does **not** define:

- final quote artifact generation
- full copy text templates
- UI layout
- long-form proposal content

Terminology rule:

- resolver `access` means physical/service execution access only
- resolver `access` does **not** mean assessment `access_score`
- assessment `access_score` is the commercial/sales-path score for opportunity movement

## 3. Contract Version

Use:

```text
speed_mode_resolver.v1
```

Return this exact value in every successful resolver response.

## 4. Request Contract

### 4.1 Required Request Fields

```json
{
  "property_type": "",
  "scope_band": "",
  "access": "",
  "confidence": "",
  "visible_condition": ""
}
```

### 4.2 Optional Request Fields

```json
{
  "proof_available": null,
  "proof_strength": null,
  "decision_maker_present": null,
  "managed_scope_credible": null,
  "entry_option_safe": null,
  "internal_review_flag": null
}
```

### 4.3 Full Request Shape

```json
{
  "property_type": "garden-style",
  "scope_band": "26-50",
  "access": "mixed",
  "confidence": "medium",
  "visible_condition": "moderate",
  "proof_available": "yes",
  "proof_strength": "moderate",
  "decision_maker_present": "no",
  "managed_scope_credible": "yes",
  "entry_option_safe": "yes",
  "internal_review_flag": "no"
}
```

## 5. Request Enum Values

### 5.1 `property_type`

Allowed values:

- `garden-style`
- `mid-rise`
- `high-rise`
- `single-site commercial`
- `other_internal`

Implementation note:

- `other_internal` is valid for the resolver.
- Rep-facing UI should not expose `other_internal` as a casual default choice.
- If the UI allows it, that selection should be gated behind a secondary flow and logged.

### 5.2 `scope_band`

Allowed values:

- `1-10`
- `11-25`
- `26-50`
- `51-100`
- `100+`

### 5.3 `access`

Allowed values:

- `easy`
- `mixed`
- `difficult`
- `unknown`

### 5.4 `confidence`

Allowed values:

- `low`
- `medium`
- `high`

### 5.5 `visible_condition`

Allowed values:

- `low`
- `moderate`
- `heavy`
- `hazardous`
- `unknown`

### 5.6 Optional Boolean-like Enums

The following fields accept:

- `yes`
- `no`
- `null`

Fields:

- `proof_available`
- `decision_maker_present`
- `managed_scope_credible`
- `entry_option_safe`
- `internal_review_flag`

### 5.7 `proof_strength`

Allowed values:

- `weak`
- `moderate`
- `strong`
- `null`

## 6. Optional Input Defaults

When optional fields are omitted, normalize them as follows:

```json
{
  "proof_available": null,
  "proof_strength": null,
  "decision_maker_present": null,
  "managed_scope_credible": "no",
  "entry_option_safe": null,
  "internal_review_flag": "no"
}
```

Conservative behavior rules:

- missing optional fields may tighten the result
- missing optional fields must never soften the result
- if a permissive strategy depends on an optional field, treat missing as not granted

## 7. Validation Contract

### 7.1 Validation Rules

- all required fields must be present
- all required fields must use valid enum values
- all optional fields, if present, must use valid enum values
- unknown keys may be ignored, but should be logged in debug mode

### 7.2 Invalid Request Response

Return:

```json
{
  "contract_version": "speed_mode_resolver.v1",
  "valid": false,
  "errors": [
    {
      "field": "property_type",
      "code": "invalid_enum",
      "message": "property_type must be one of: garden-style, mid-rise, high-rise, single-site commercial, other_internal"
    }
  ]
}
```

### 7.3 Valid Request Response

Return:

- `valid: true`
- full resolver payload

## 8. Success Response Contract

### 8.1 Top-Level Shape

```json
{
  "contract_version": "speed_mode_resolver.v1",
  "valid": true,
  "input": {},
  "resolution": {},
  "action": {},
  "pricing": {},
  "proof": {},
  "close": {},
  "overlays": {},
  "handoff": {},
  "permissions": {}
}
```

## 9. `input` Object

The resolver should echo normalized input.

```json
{
  "property_type": "garden-style",
  "scope_band": "26-50",
  "access": "mixed",
  "confidence": "medium",
  "visible_condition": "moderate",
  "proof_available": "yes",
  "proof_strength": "moderate",
  "decision_maker_present": "no",
  "managed_scope_credible": "yes",
  "entry_option_safe": "yes",
  "internal_review_flag": "no"
}
```

## 10. `resolution` Object

### 10.1 Shape

```json
{
  "status_key": "",
  "status_label": "",
  "matched_rule_id": "",
  "resolution_source": "",
  "fallback_logged": false,
  "downgraded_from_status_key": null,
  "downgrade_reason_ids": []
}
```

### 10.2 `status_key` Enum

Allowed values:

- `do_not_price_secure_access`
- `range_only_qualify`
- `present_range_book_walkthrough`
- `deliver_estimate_ask_approval`
- `escalate_internal`

### 10.3 `resolution_source` Enum

Allowed values:

- `rule`
- `fallback`

### 10.4 `downgrade_reason_ids`

Allowed values:

- hard block IDs only

Examples:

- `HB3`
- `HB4`

Implementation notes:

- `matched_rule_id` must always be populated for valid responses
- fallback paths must use explicit fallback rule IDs (`F1`, `F2`)
- if `resolution_source = fallback`, then `fallback_logged = true`

## 11. `action` Object

### 11.1 Shape

```json
{
  "action_command": "",
  "risk_warning": "",
  "price_posture": "",
  "copy_policy": {
    "allow_pricing": false,
    "allow_final_price_language": false,
    "must_use_range_language": false,
    "must_reference_access_verification": false,
    "must_reference_internal_review": false,
    "allow_partial_scope_language": false,
    "allow_phased_language": false
  }
}
```

### 11.2 `price_posture` Enum

Allowed values:

- `no_pricing_yet`
- `soft_range_only`
- `budgetary_range`
- `estimate_ready`
- `internal_review_required_before_pricing`

### 11.3 Copy Policy Rules

Required behavior:

- `allow_pricing = false` for:
  - `do_not_price_secure_access`
  - `escalate_internal` when no numbers allowed
- `allow_final_price_language = true` only for:
  - `deliver_estimate_ask_approval`
- `must_use_range_language = true` for:
  - `range_only_qualify`
  - `present_range_book_walkthrough`
- `must_reference_access_verification = true` when:
  - `access = unknown`
- `must_reference_internal_review = true` when:
  - `status_key = escalate_internal`
- `allow_partial_scope_language = false` when:
  - hazardous/full-scope logic blocks it
- `allow_phased_language = true` only when:
  - strategy permits it
  - no suppression rule blocks it

## 12. `pricing` Object

### 12.1 Shape

```json
{
  "strategy_key": "",
  "strategy_label": "",
  "matched_strategy_rule_id": "",
  "price_display_mode": "",
  "anchor_structure": "",
  "entry_option_structure": "",
  "close_path": "",
  "entry_option_allowed": false,
  "entry_option_suppressed": false,
  "entry_option_suppression_reason_ids": []
}
```

### 12.2 `strategy_key` Enum

Allowed values:

- `no_pricing_strategy`
- `urgency_safety`
- `bundle_portfolio`
- `anchor_high_phased`
- `test_close_small_section`

### 12.3 `price_display_mode` Enum

Allowed values:

- `no_price`
- `soft_range`
- `budgetary_range`
- `estimate_ready`

### 12.4 Entry Option Suppression

When `entry_option_suppressed = true`:

- `entry_option_allowed` must be `false`
- `entry_option_structure` may still describe why it is blocked, but UI must not present it as selectable

Allowed suppression reason IDs:

- `EOS1` = hazardous/full-scope correction required
- `EOS2` = partial framing would mislead customer
- `EOS3` = entry option destroys margin or commercial integrity
- `EOS4` = internal review required before any scoped offer

Implementation rule:

- if a smaller first section would falsely imply the core issue is largely solved, suppress the entry option

## 13. `proof` Object

### 13.1 Shape

```json
{
  "proof_required": false,
  "proof_recommended": false,
  "max_slots": 2,
  "auto_select": true,
  "override_allowed": true,
  "priority_order": [],
  "empty_state_message": ""
}
```

### 13.2 `priority_order` Enum Values

Allowed proof priorities:

- `hazard_photo`
- `blocked_termination_photo`
- `access_limitation_photo`
- `repeated_condition_photo`
- `count_or_scale_photo`
- `rep_observation_tag`

### 13.3 Proof Rules

- `max_slots` must always be `2` in Speed Mode
- `override_allowed` must be `true`
- proof selection override must not alter status or strategy
- if proof is required and unavailable, `empty_state_message` must be:
  - `No proof attached - rely on range/verification language only`

## 14. `close` Object

### 14.1 Shape

```json
{
  "primary_close_ask_key": "",
  "backup_close_ask_key": ""
}
```

### 14.2 Enum Values

Allowed `primary_close_ask_key` values:

- `secure_access_primary`
- `range_only_primary`
- `book_walkthrough_primary`
- `approval_primary`
- `escalate_primary`

Allowed `backup_close_ask_key` values:

- `secure_access_backup`
- `range_only_backup`
- `book_walkthrough_backup`
- `approval_backup`
- `escalate_backup`

Implementation rule:

- close ask keys are status-mapped only
- no generic close-library selection is allowed in Speed Mode

## 15. `overlays` Object

### 15.1 Shape

```json
{
  "applied_hard_blocks": [],
  "applied_forced_language_ids": [],
  "applied_forced_phrases": [],
  "applied_warning_flag_ids": [],
  "applied_warning_messages": []
}
```

### 15.2 Hard Block IDs

Allowed values:

- `HB1`
- `HB2`
- `HB3`
- `HB4`

### 15.3 Forced Language IDs

Allowed values:

- `FL1`
- `FL2`
- `FL3`
- `FL4`

### 15.4 Warning Flag IDs

Allowed values:

- `WF1`
- `WF2`
- `WF3`

Implementation rule:

- overlays may tighten language or suppress structures
- overlays may never soften status severity

## 16. `handoff` Object

### 16.1 Shape

```json
{
  "controlled_mode_eligible": false,
  "internal_review_required": false,
  "handoff_target": "",
  "handoff_reason_ids": []
}
```

### 16.2 `handoff_target` Enum

Allowed values:

- `none`
- `controlled_mode`
- `internal_review`

### 16.3 `handoff_reason_ids`

Allowed values:

- `HM1` = deliver-estimate status reached
- `HM2` = written pricing requested
- `HM3` = proof package expansion needed
- `HM4` = assumptions review justified
- `HM5` = forwarding or approval package needed
- `HI1` = hazardous complexity requires internal review
- `HI2` = authority exceeded
- `HI3` = internal review flag present

## 17. `permissions` Object

### 17.1 Shape

```json
{
  "rep_can_override_status": false,
  "rep_can_override_strategy": false,
  "rep_can_override_proof_selection": true,
  "rep_can_edit_copy": true
}
```

### 17.2 Locked Behavior

These are hard rules for Speed Mode:

- reps may edit copy
- reps may override proof selection
- reps may **not** manually upgrade status
- reps may **not** manually downgrade status
- reps may **not** manually swap pricing strategy

## 18. Rule ID Sets

### 18.1 Status Rule IDs

Allowed status rule IDs:

- escalation: `E1`-`E6`
- do not price: `D1`-`D4`
- range only: `R1`-`R5`
- present range: `P1`-`P5`
- deliver estimate: `Q1`-`Q3`
- fallback: `F1`, `F2`

### 18.2 Strategy Rule IDs

Allowed strategy rule IDs:

- `S1` = no pricing strategy
- `S2` = urgency/safety
- `S3` = bundle/portfolio
- `S4` = anchor high + phased
- `S5` = test close / small first section
- `SF1` = fallback to anchor high + phased
- `SF2` = fallback to no pricing strategy

## 19. Downgrade Behavior

Downgrades can happen only through hard blocks.

Supported downgrade behavior:

- initial status resolves from rule table
- hard blocks apply
- if a hard block invalidates the resolved status, downgrade to the next most restrictive valid status
- set:
  - `downgraded_from_status_key`
  - `downgrade_reason_ids`

Examples:

- initial `deliver_estimate_ask_approval`
- `HB4` fires
- final status becomes `present_range_book_walkthrough`

## 20. Fallback Logging Contract

If fallback status logic is used:

- set `resolution_source = fallback`
- set `fallback_logged = true`
- set `matched_rule_id = F1` or `F2`
- emit telemetry event:

```json
{
  "event_key": "speed_mode_fallback_hit",
  "matched_rule_id": "F1",
  "input": {
    "property_type": "mid-rise",
    "scope_band": "26-50",
    "access": "mixed",
    "confidence": "medium",
    "visible_condition": "moderate"
  }
}
```

Implementation rule:

- fallback should be treated as a safety net, not normal logic
- fallback hits should be reviewable

## 21. Bundle / Portfolio Constraint

`bundle_portfolio` may be selected only when broader repeatable scope is credible.

The resolver should treat this as true only when at least one is true:

- `managed_scope_credible = yes`
- `scope_band in {51-100, 100+}`
- property context credibly implies repeatable multi-building or managed-scope logic

If not credible:

- block `bundle_portfolio`
- fall through to the next valid strategy

## 22. Example Success Payload

```json
{
  "contract_version": "speed_mode_resolver.v1",
  "valid": true,
  "input": {
    "property_type": "garden-style",
    "scope_band": "26-50",
    "access": "mixed",
    "confidence": "medium",
    "visible_condition": "moderate",
    "proof_available": "yes",
    "proof_strength": "moderate",
    "decision_maker_present": "no",
    "managed_scope_credible": "yes",
    "entry_option_safe": "yes",
    "internal_review_flag": "no"
  },
  "resolution": {
    "status_key": "present_range_book_walkthrough",
    "status_label": "Present Range + Book Walkthrough",
    "matched_rule_id": "P1",
    "resolution_source": "rule",
    "fallback_logged": false,
    "downgraded_from_status_key": null,
    "downgrade_reason_ids": []
  },
  "action": {
    "action_command": "Use a budgetary range to move toward a walkthrough.",
    "risk_warning": "Do not imply final scope is fully confirmed.",
    "price_posture": "budgetary_range",
    "copy_policy": {
      "allow_pricing": true,
      "allow_final_price_language": false,
      "must_use_range_language": true,
      "must_reference_access_verification": false,
      "must_reference_internal_review": false,
      "allow_partial_scope_language": true,
      "allow_phased_language": true
    }
  },
  "pricing": {
    "strategy_key": "anchor_high_phased",
    "strategy_label": "Anchor High + Phased Option",
    "matched_strategy_rule_id": "S4",
    "price_display_mode": "budgetary_range",
    "anchor_structure": "full scope first",
    "entry_option_structure": "first phase or first building",
    "close_path": "book walkthrough to confirm scope and keep the process moving",
    "entry_option_allowed": true,
    "entry_option_suppressed": false,
    "entry_option_suppression_reason_ids": []
  },
  "proof": {
    "proof_required": false,
    "proof_recommended": true,
    "max_slots": 2,
    "auto_select": true,
    "override_allowed": true,
    "priority_order": [
      "repeated_condition_photo",
      "count_or_scale_photo"
    ],
    "empty_state_message": ""
  },
  "close": {
    "primary_close_ask_key": "book_walkthrough_primary",
    "backup_close_ask_key": "book_walkthrough_backup"
  },
  "overlays": {
    "applied_hard_blocks": [],
    "applied_forced_language_ids": [],
    "applied_forced_phrases": [],
    "applied_warning_flag_ids": [
      "WF2"
    ],
    "applied_warning_messages": [
      "range should account for uneven access conditions"
    ]
  },
  "handoff": {
    "controlled_mode_eligible": true,
    "internal_review_required": false,
    "handoff_target": "controlled_mode",
    "handoff_reason_ids": [
      "HM4"
    ]
  },
  "permissions": {
    "rep_can_override_status": false,
    "rep_can_override_strategy": false,
    "rep_can_override_proof_selection": true,
    "rep_can_edit_copy": true
  }
}
```

## 23. Locked Build Decisions

These are locked by this contract:

- resolver is rule-based, not AI-based
- status resolves before strategy
- strategy resolves before copy
- overlays can tighten but not soften
- rep status override is not allowed
- rep strategy override is not allowed
- proof override is allowed
- fallback hits must be logged

## 24. What Comes Next

The next build-facing artifact should be one of:

1. `Speed Mode Copy Layer Spec`
2. `Speed Mode Wireframe Spec`

Recommended order:

- copy layer spec first
- wireframe second
