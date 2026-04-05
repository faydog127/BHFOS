# Pricing v1 Schema + Modifier Matrix

## 1. Purpose

This document defines the implementation-facing `Pricing v1` contract for TIS.

Its job is to lock:

- what pricing inputs must be captured
- what inputs are optional enrichers
- what modifiers change price
- what conditions block instant pricing
- what output posture is allowed

This document is for:

- TIS data design
- pricing resolver logic
- HTML/PDF budgetary guide generation
- field QA

This document is not the final price book.
Dollar values, margin targets, tax rules, and discount authority stay in internal config.

## 2. Core Doctrine

Pricing v1 follows these rules:

1. Scout signals and pricing signals are separate.
2. Physical/service access and sales-path access are separate.
3. Large properties do not get cheaper by default.
4. Efficiency credit is earned by execution efficiency, not property size.
5. Budgetary pricing can be sent only when the system has enough structure to defend it.
6. When scope, access, or corrective work is too uncertain, TIS must refuse instant pricing and require formal quote follow-up.

Terminology:

- `service access` = physical execution difficulty
- `sales access path` = ease of reaching the office, maintenance, or decision-maker
- `access_score` in current TIS = sales access path only
- pricing resolver `access` = service access only

## 3. Pricing Resolution Outputs

Pricing v1 must resolve two top-level outputs before any number is shown.

### 3.1 `pricing_intent`

Allowed values:

- `ballpark`
- `budgetary_pricing_guide`
- `formal_quote_required`

Meaning:

- `ballpark` = verbal or same-conversation planning number only; not a forwardable pricing guide
- `budgetary_pricing_guide` = forwardable HTML/PDF planning document with assumptions and controlled pricing language
- `formal_quote_required` = no instant pricing guide; route to quote workflow

### 3.2 `pricing_confidence`

Allowed values:

- `low`
- `medium`
- `high`

Meaning:

- `low` = material unknowns or corrective risk make field pricing unsafe
- `medium` = pricing can move forward, but assumptions must stay visible
- `high` = scope is controlled enough for a strong budgetary guide or quote handoff

## 4. Common Contract

Persistence note:

- In TIS, base property context continues to live on the existing property and assessment records.
- Pricing-specific fields and future pricing outputs are persisted on `assessment.pricing_v1`.
- Do not duplicate property/contact truth inside `pricing_v1` when the canonical value already exists on the base record.

### 4.1 Context Fields

These identify the job and outbound document but do not directly change price.

Required:

- `property_name`
- `property_address`
- `property_type`
- `onsite_contact_name`
- `onsite_contact_role`

Recommended:

- `management_group`
- `build_era_band`
- `total_property_units`
- `number_of_buildings`

### 4.2 Shared Pricing Inputs

These are the common pricing fields across services.

```json
{
  "service_type": "",
  "units_requested_now": 0,
  "total_possible_units": 0,
  "grouped_scope": "",
  "occupancy_state": "",
  "service_access_type": "",
  "condition_level": "",
  "coordination_burden": "",
  "travel_context": "",
  "technical_issue_flags": [],
  "operational_issue_flags": [],
  "notes": "",
  "photo_count": 0
}
```

### 4.3 Shared Enums

#### `service_type`

- `dryer_vent_cleaning`
- `air_duct_cleaning`

#### `grouped_scope`

- `single_unit`
- `small_scattered_batch`
- `grouped_same_building`
- `stacked_same_building`
- `multi_building_repeatable`
- `full_property_distribution_unclear`

#### `occupancy_state`

- `vacant`
- `mixed`
- `occupied`

#### `service_access_type`

- `interior_only`
- `roof_required`
- `attic_required`
- `crawlspace_required`
- `mixed`
- `unknown`

#### `condition_level`

- `normal`
- `moderate`
- `heavy`
- `hazardous`
- `unknown`

#### `coordination_burden`

- `light`
- `moderate`
- `heavy`

#### `travel_context`

- `standard_local`
- `remote_or_multi_trip`
- `special_mobilization`

### 4.4 Structured Flag Sets

Use structured flags instead of loose "special issues" whenever possible.

#### `technical_issue_flags`

- `roof_access_required`
- `tile_or_metal_roof`
- `long_run_suspected`
- `blockage_suspected`
- `crushed_or_disconnected_suspected`
- `termination_damage_suspected`
- `mixed_access_types`
- `prior_failed_vendor`
- `bird_guard_or_screen_issue`
- `booster_fan_or_special_hardware`
- `water_intrusion_signs`
- `mold_like_or_bio_contamination`
- `repair_scope_likely`
- `restoration_scope_likely`

#### `operational_issue_flags`

- `escort_required`
- `key_control_required`
- `resident_scheduling_required`
- `occupied_only_workflow`
- `after_hours_only`
- `limited_access_window`
- `parking_or_staging_difficulty`
- `gate_or_checkin_friction`
- `portal_or_po_workflow`
- `net_terms_friction`
- `photo_package_required`
- `unit_log_required`
- `resident_notice_required`
- `maintenance_pre_stage_available`

## 5. Internal Config Fields

These should exist in pricing config, not as rep-entered fields.

- `base_rate_card_id`
- `base_unit_price_or_basis`
- `minimum_job_charge`
- `access_modifier_values`
- `condition_modifier_values`
- `coordination_modifier_values`
- `travel_modifier_values`
- `efficiency_credit_values`
- `tax_rule`
- `validity_window_days`
- `discount_authority_limit`
- `target_margin_band`

## 6. Dryer Vent Cleaning Profile

### 6.1 Required Inputs

Required for `dryer_vent_cleaning`:

- `service_type`
- `units_requested_now`
- `grouped_scope`
- `occupancy_state`
- `service_access_type`
- `condition_level`
- `travel_context`

At least one scope basis field must also be present:

- `termination_type`
- `building_height_band`
- `vent_run_length_band`

Recommended required-in-practice fields for stronger pricing:

- `termination_type`
- `building_height_band`
- `maintenance_assisted_access`

### 6.2 Optional Enrichers

- `total_possible_units`
- `number_of_buildings_in_scope`
- `termination_type`
- `building_height_band`
- `vent_run_length_band`
- `maintenance_assisted_access`
- `layout_consistency`
- `roof_type`
- `duct_type_known`
- `build_era_band`
- `property_age_band`
- `bedroom_mix`

Doctrine:

- `property_age_band` and `bedroom_mix` are secondary for dryer vent pricing.
- They only matter when they imply longer runs, inconsistent layouts, older routing, or harder access.

### 6.3 Recommended Dryer Vent Enums

#### `termination_type`

- `sidewall`
- `roof`
- `mixed`
- `unknown`

#### `building_height_band`

- `1_2_floors`
- `3_floors`
- `4_plus_floors`

#### `vent_run_length_band`

- `short`
- `medium`
- `long`
- `unknown`

#### `maintenance_assisted_access`

- `yes`
- `no`
- `unknown`

#### `layout_consistency`

- `standardized`
- `mixed`
- `unknown`

### 6.4 Dryer Vent Modifier Matrix

#### Access Modifier

| Driver | Condition | Modifier Direction | Notes |
| --- | --- | --- | --- |
| `service_access_type` | `interior_only` | none/low | Standard unit-side execution |
| `service_access_type` | `roof_required` | high | Roof-served work changes labor and risk |
| `service_access_type` | `mixed` | medium/high | Uneven field execution |
| `termination_type` | `roof` or `mixed` | increase | Termination access matters directly |
| `building_height_band` | `3_floors` | increase | Mid-rise access drag |
| `building_height_band` | `4_plus_floors` | strong increase | Higher setup and safety burden |
| `vent_run_length_band` | `long` | increase | More time per line |
| `technical_issue_flags` | `tile_or_metal_roof` | increase | Roof correction/handling burden |
| `technical_issue_flags` | `mixed_access_types` | increase | Do not treat as uniform scope |

#### Condition Modifier

| Driver | Condition | Modifier Direction | Notes |
| --- | --- | --- | --- |
| `condition_level` | `moderate` | increase | Slower than standard cleaning |
| `condition_level` | `heavy` | strong increase | Real production drag |
| `condition_level` | `hazardous` | escalate or strong increase | Often becomes quote-blocked |
| `technical_issue_flags` | `blockage_suspected` | increase | Do not price as standard only |
| `technical_issue_flags` | `bird_guard_or_screen_issue` | increase | Termination labor changes |
| `technical_issue_flags` | `prior_failed_vendor` | increase | Suggests non-routine scope |
| `technical_issue_flags` | `termination_damage_suspected` | escalate | Corrective scope risk |
| `technical_issue_flags` | `crushed_or_disconnected_suspected` | escalate | Standard cleaning assumption breaks |

#### Coordination Modifier

| Driver | Condition | Modifier Direction | Notes |
| --- | --- | --- | --- |
| `occupancy_state` | `occupied` | increase | Scheduling drag |
| `occupancy_state` | `mixed` | increase | Irregular access path |
| `coordination_burden` | `moderate` | increase | Admin work is real labor |
| `coordination_burden` | `heavy` | strong increase | Often underpriced if ignored |
| `operational_issue_flags` | `resident_scheduling_required` | increase | Unit access friction |
| `operational_issue_flags` | `portal_or_po_workflow` | increase | Admin burden |
| `operational_issue_flags` | `photo_package_required` | increase | Deliverable overhead |
| `operational_issue_flags` | `unit_log_required` | increase | Unit-by-unit reporting labor |

#### Travel / Mobilization Modifier

| Driver | Condition | Modifier Direction | Notes |
| --- | --- | --- | --- |
| `travel_context` | `standard_local` | base | Normal local assumption |
| `travel_context` | `remote_or_multi_trip` | increase | Route and trip burden |
| `travel_context` | `special_mobilization` | strong increase | Special setup or mobilization |
| `grouped_scope` | `single_unit` | minimum job logic likely | Protect against low-scope erosion |

#### Efficiency Credit

Efficiency credit is subtractive and must never be named or treated as a generic volume discount.

| Driver | Condition | Credit Direction | Notes |
| --- | --- | --- | --- |
| `grouped_scope` | `stacked_same_building` | strong credit | High repeatability |
| `grouped_scope` | `grouped_same_building` | medium credit | Good batching |
| `grouped_scope` | `multi_building_repeatable` | limited/medium credit | Only if staging is real |
| `layout_consistency` | `standardized` | credit | Repeated execution path |
| `maintenance_assisted_access` | `yes` | credit | Faster throughput |
| `operational_issue_flags` | `maintenance_pre_stage_available` | credit | Real execution help |
| `grouped_scope` | `small_scattered_batch` | no credit | Size alone does not help |
| `occupancy_state` | `occupied` | reduce or remove credit | Volume can disappear operationally |

### 6.5 Dryer Vent Quote-Block Triggers

Any of these should force `pricing_intent = formal_quote_required`:

- `service_access_type = unknown`
- `condition_level = hazardous` with unclear correction path
- `technical_issue_flags` includes `crushed_or_disconnected_suspected`
- `technical_issue_flags` includes `termination_damage_suspected`
- `technical_issue_flags` includes `repair_scope_likely`
- `technical_issue_flags` includes `restoration_scope_likely`
- roof access is required but safety/approval is not verified
- unit distribution is mixed or unclear and count basis is weak
- requested scope mixes standard cleaning with likely corrective work

## 7. Air Duct Cleaning Profile

### 7.1 Required Inputs

Required for `air_duct_cleaning`:

- `service_type`
- `units_requested_now` or `system_count_basis`
- `grouped_scope`
- `occupancy_state`
- `service_access_type`
- `condition_level`
- `travel_context`
- `layout_consistency`

At least one scope complexity basis must also be present:

- `bedroom_mix`
- `sqft_band`
- `system_count_basis`
- `supply_return_complexity`

### 7.2 Optional Enrichers

- `total_possible_units`
- `bedroom_mix`
- `sqft_band`
- `property_age_band`
- `build_era_band`
- `system_count_basis`
- `air_handler_location`
- `supply_return_complexity`
- `duct_material`
- `contamination_type`
- `restoration_addons_likely`
- `layout_consistency`

Doctrine:

- `bedroom_mix` and `property_age_band` are materially more useful for air duct cleaning than for dryer vent work.
- Use them when they change expected square footage, branch count, system complexity, retrofit likelihood, contamination expectations, or layout variation.

### 7.3 Recommended Air Duct Enums

#### `sqft_band`

- `small`
- `medium`
- `large`
- `unknown`

#### `system_count_basis`

- `single_system_per_unit`
- `multi_system_unit`
- `common_area_only`
- `mixed`
- `unknown`

#### `air_handler_location`

- `closet`
- `attic`
- `crawlspace`
- `mixed`
- `unknown`

#### `supply_return_complexity`

- `simple`
- `moderate`
- `complex`
- `unknown`

#### `duct_material`

- `flex`
- `metal`
- `ductboard`
- `mixed`
- `unknown`

#### `contamination_type`

- `dust_only`
- `heavy_debris`
- `water_affected`
- `mold_like_or_bio`
- `unknown`

### 7.4 Air Duct Modifier Matrix

#### Access Modifier

| Driver | Condition | Modifier Direction | Notes |
| --- | --- | --- | --- |
| `service_access_type` | `interior_only` | none/low | Easiest execution path |
| `service_access_type` | `attic_required` | increase | Common labor increase |
| `service_access_type` | `crawlspace_required` | increase | Access difficulty changes setup |
| `service_access_type` | `mixed` | medium/high | Uneven execution path |
| `air_handler_location` | `attic` or `crawlspace` | increase | Equipment access matters |
| `supply_return_complexity` | `complex` | increase | More branches/openings/handling |
| `duct_material` | `mixed` or `unknown` | increase | Scope caution |

#### Condition Modifier

| Driver | Condition | Modifier Direction | Notes |
| --- | --- | --- | --- |
| `condition_level` | `moderate` | increase | More than surface cleaning |
| `condition_level` | `heavy` | strong increase | Production slows materially |
| `condition_level` | `hazardous` | escalate or strong increase | Often outside instant guide scope |
| `contamination_type` | `heavy_debris` | increase | Heavier cleaning burden |
| `contamination_type` | `water_affected` | escalate | May move to restoration/corrective scope |
| `contamination_type` | `mold_like_or_bio` | escalate | Do not treat as standard cleaning |
| `technical_issue_flags` | `repair_scope_likely` | escalate | Cleaning assumption breaks |
| `technical_issue_flags` | `restoration_scope_likely` | escalate | Quote-only path |

#### Coordination Modifier

| Driver | Condition | Modifier Direction | Notes |
| --- | --- | --- | --- |
| `occupancy_state` | `occupied` | increase | Resident coordination burden |
| `coordination_burden` | `moderate` | increase | Reporting/scheduling labor |
| `coordination_burden` | `heavy` | strong increase | Strong admin burden |
| `operational_issue_flags` | `resident_notice_required` | increase | More planning effort |
| `operational_issue_flags` | `photo_package_required` | increase | Documentation time |
| `operational_issue_flags` | `portal_or_po_workflow` | increase | Slow-pay/admin cost |

#### Travel / Mobilization Modifier

| Driver | Condition | Modifier Direction | Notes |
| --- | --- | --- | --- |
| `travel_context` | `standard_local` | base | Normal local assumption |
| `travel_context` | `remote_or_multi_trip` | increase | Repeated crew movement |
| `travel_context` | `special_mobilization` | strong increase | Special setup or mobilization |

#### Efficiency Credit

| Driver | Condition | Credit Direction | Notes |
| --- | --- | --- | --- |
| `layout_consistency` | `standardized` | credit | Repeatable execution |
| `grouped_scope` | `grouped_same_building` | medium credit | Better staging |
| `grouped_scope` | `stacked_same_building` | medium credit | Repeatable access path |
| `system_count_basis` | `single_system_per_unit` | credit | More predictable |
| `occupancy_state` | `occupied` | reduce or remove credit | Scheduling drag can erase batching |
| `layout_consistency` | `mixed` | no credit | Do not assume efficiency |

### 7.5 Air Duct Quote-Block Triggers

Any of these should force `pricing_intent = formal_quote_required`:

- `service_access_type = unknown`
- `system_count_basis = unknown`
- `supply_return_complexity = unknown` on a multi-unit or mixed-layout scope
- `contamination_type = mold_like_or_bio`
- `contamination_type = water_affected`
- `technical_issue_flags` includes `repair_scope_likely`
- `technical_issue_flags` includes `restoration_scope_likely`
- air handler location or duct material is mixed/unknown and the requested scope is broad
- scope mixes common-area systems and unit systems without count clarity

## 8. Pricing Confidence Rules

### 8.1 High

Use `pricing_confidence = high` when:

- all required fields are present
- service access is known
- grouped scope is known
- condition is not `unknown`
- no quote-block trigger is present
- no major corrective scope flag is present

### 8.2 Medium

Use `pricing_confidence = medium` when:

- all required fields are present
- one or two non-blocking unknowns remain
- access may be mixed but not unsafe
- condition may be heavy but still inside standard service assumptions
- assumptions can be stated clearly

### 8.3 Low

Use `pricing_confidence = low` when any are true:

- a required field is missing
- `service_access_type = unknown`
- `condition_level = unknown`
- grouped scope is unclear
- corrective or restoration flags are present
- mixed scope makes the count basis unreliable

## 9. Pricing Intent Rules

### 9.1 `ballpark`

Use when:

- the rep needs a same-conversation planning number
- confidence is not high enough for a forwardable guide
- no quote-block trigger is present

Behavior:

- speak-only or note-only
- no forwardable HTML/PDF guide
- assumptions must be verbalized

### 9.2 `budgetary_pricing_guide`

Use when:

- confidence is `medium` or `high`
- required pricing inputs are present
- no quote-block trigger is present
- the system can explain scope assumptions cleanly

Behavior:

- HTML/PDF guide allowed
- range language allowed
- assumptions and exclusions required

### 9.3 `formal_quote_required`

Use when:

- any quote-block trigger is present
- confidence is `low`
- corrective or restoration scope is likely
- scope cannot be defended with a budgetary guide

Behavior:

- do not generate instant pricing guide
- route to formal quote workflow

## 10. Outbound Budgetary Pricing Guide Contract

Only `budgetary_pricing_guide` may render to the field-send HTML/PDF template.

```json
{
  "document_type": "budgetary_pricing_guide",
  "service_type": "",
  "pricing_confidence": "",
  "property_summary": "",
  "scope_summary": "",
  "assumptions": [],
  "modifiers_applied": {
    "access": "",
    "condition": "",
    "coordination": "",
    "travel": "",
    "efficiency_credit": ""
  },
  "price_basis_summary": "",
  "price_range_display": "",
  "excluded_conditions": [],
  "change_order_triggers": [],
  "validity_window_days": 0,
  "next_step": "",
  "disclaimer": ""
}
```

### 10.1 Required Assumptions Language

Every budgetary pricing guide must state:

- pricing is based on observed conditions and stated assumptions
- final pricing may change if access, count, configuration, contamination, or corrective scope differs
- this is planning/budgetary pricing and not a final approval-ready quote unless explicitly converted

### 10.2 Required Change Triggers

At minimum, surface:

- access differs from observed or stated assumptions
- unit distribution or count differs from stated batch assumptions
- corrective repair, restoration, or hidden damage is discovered
- reporting, scheduling, or after-hours requirements are broader than stated

## 11. Minimum MVP Implementation Rule

If TIS needs a lean first pass, build Pricing v1 with:

- common contract
- dryer vent profile
- air duct profile
- pricing confidence resolver
- pricing intent resolver
- budgetary pricing guide output contract

Do not build first:

- multiple outbound design variants
- analytics dashboards
- generic universal modifiers detached from service profiles
- quote-like PDF language for budgetary guides

## 12. Recommended Next Build Sequence

1. Pricing v1 fields are wired into TIS data design under `assessment.pricing_v1`.
2. Derived `pricing_confidence` and `pricing_intent` logic is implemented with a conservative resolver.
3. Shared/internal config is mapped into the modifier engine.
4. One `budgetary_pricing_guide` HTML artifact is generated from the output contract.
5. Render the same artifact to PDF.
6. Add formal quote handoff after the guide path is stable.
