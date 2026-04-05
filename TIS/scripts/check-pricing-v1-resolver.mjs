import { resolvePricingV1 } from "../src/utils/pricingV1Resolver.js";

const cases = [
  {
    name: "Complete grouped dryer vent scope resolves high-confidence budgetary guide",
    input: {
      assessment: {
        building_height: "3",
        termination_type: "sidewall",
        access_constraints: "minor"
      },
      pricing: {
        service_type: "dryer_vent_cleaning",
        units_requested_now: 12,
        total_possible_units: 48,
        number_of_buildings_in_scope: 1,
        grouped_scope: "grouped_same_building",
        occupancy_state: "vacant",
        service_access_type: "interior_only",
        condition_level: "normal",
        coordination_burden: "light",
        travel_context: "standard_local",
        photo_count: 4,
        operational_issue_flags: ["maintenance_pre_stage_available"],
        dryer_vent: {
          vent_run_length_band: "medium",
          maintenance_assisted_access: "yes",
          layout_consistency: "standardized",
          duct_type_known: "rigid"
        }
      }
    },
    expectConfidence: "high",
    expectIntent: "budgetary_pricing_guide",
    expectBlockCodes: []
  },
  {
    name: "Scattered roof-served dryer vent scope stays budgetary but drops to medium confidence",
    input: {
      assessment: {
        building_height: "3",
        termination_type: "roof",
        access_constraints: "minor"
      },
      pricing: {
        service_type: "dryer_vent_cleaning",
        units_requested_now: 8,
        total_possible_units: 24,
        number_of_buildings_in_scope: 3,
        grouped_scope: "small_scattered_batch",
        occupancy_state: "occupied",
        service_access_type: "roof_required",
        condition_level: "moderate",
        coordination_burden: "heavy",
        travel_context: "standard_local",
        technical_issue_flags: ["roof_access_required", "long_run_suspected"],
        operational_issue_flags: ["resident_scheduling_required"],
        photo_count: 2,
        dryer_vent: {
          vent_run_length_band: "long",
          maintenance_assisted_access: "no",
          layout_consistency: "mixed",
          roof_type: "shingle",
          duct_type_known: "mixed"
        }
      }
    },
    expectConfidence: "medium",
    expectIntent: "budgetary_pricing_guide",
    expectBlockCodes: []
  },
  {
    name: "Standard air duct scope resolves high-confidence budgetary guide",
    input: {
      pricing: {
        service_type: "air_duct_cleaning",
        units_requested_now: 6,
        grouped_scope: "grouped_same_building",
        occupancy_state: "mixed",
        service_access_type: "interior_only",
        condition_level: "moderate",
        coordination_burden: "moderate",
        travel_context: "standard_local",
        bedroom_mix: "Mostly 2/2 layouts",
        photo_count: 3,
        air_duct: {
          layout_consistency: "standardized",
          sqft_band: "medium",
          system_count_basis: "single_system_per_unit",
          air_handler_location: "closet",
          supply_return_complexity: "moderate",
          duct_material: "metal",
          contamination_type: "dust_only",
          accessible_returns_count: 2,
          restoration_addons_likely: "no"
        }
      }
    },
    expectConfidence: "high",
    expectIntent: "budgetary_pricing_guide",
    expectBlockCodes: []
  },
  {
    name: "Corrective air duct scope hard-blocks instant pricing",
    input: {
      pricing: {
        service_type: "air_duct_cleaning",
        units_requested_now: 24,
        grouped_scope: "multi_building_repeatable",
        occupancy_state: "occupied",
        service_access_type: "attic_required",
        condition_level: "heavy",
        coordination_burden: "heavy",
        travel_context: "special_mobilization",
        technical_issue_flags: ["repair_scope_likely"],
        photo_count: 5,
        air_duct: {
          layout_consistency: "mixed",
          sqft_band: "large",
          system_count_basis: "unknown",
          air_handler_location: "mixed",
          supply_return_complexity: "unknown",
          duct_material: "mixed",
          contamination_type: "mold_like_or_bio",
          restoration_addons_likely: "yes"
        }
      }
    },
    expectConfidence: "low",
    expectIntent: "formal_quote_required",
    expectBlockCodes: [
      "AD_SYSTEM_COUNT_BASIS_UNKNOWN",
      "AD_COMPLEXITY_UNKNOWN",
      "AD_MOLD_LIKE_SCOPE",
      "AD_REPAIR_SCOPE_LIKELY",
      "AD_BROAD_SCOPE_CONFIGURATION_UNKNOWN"
    ]
  },
  {
    name: "Legacy partial record fails conservative without fake blockers",
    input: {
      assessment: {
        building_height: "1-2",
        termination_type: "sidewall",
        access_constraints: "none"
      },
      pricing: {}
    },
    expectConfidence: "low",
    expectIntent: "formal_quote_required",
    expectBlockCodes: [],
    expectMissingInputs: ["service_type"]
  },
  {
    name: "Low-confidence but scoped dryer vent record stays ballpark-only",
    input: {
      assessment: {
        building_height: "1-2",
        termination_type: "sidewall",
        access_constraints: "none"
      },
      pricing: {
        service_type: "dryer_vent_cleaning",
        units_requested_now: 4,
        occupancy_state: "occupied",
        service_access_type: "interior_only",
        condition_level: "normal",
        coordination_burden: "moderate",
        travel_context: "standard_local",
        dryer_vent: {
          vent_run_length_band: "short",
          maintenance_assisted_access: "unknown",
          layout_consistency: "standardized",
          duct_type_known: "semi_rigid"
        }
      }
    },
    expectConfidence: "low",
    expectIntent: "ballpark",
    expectBlockCodes: [],
    expectMissingInputs: ["grouped_scope"]
  }
];

let failed = 0;

for (const testCase of cases) {
  const result = resolvePricingV1(testCase.input);
  const actualCodes = result.blockers.quote_block_reasons.map((reason) => reason.code).sort();
  const expectedCodes = [...testCase.expectBlockCodes].sort();

  if (!result.valid) {
    failed += 1;
    console.error(`[FAIL] ${testCase.name}: resolver returned invalid output`);
    continue;
  }

  if (result.resolution.pricing_confidence !== testCase.expectConfidence) {
    failed += 1;
    console.error(
      `[FAIL] ${testCase.name}: expected confidence ${testCase.expectConfidence}, got ${result.resolution.pricing_confidence}`
    );
    continue;
  }

  if (result.resolution.pricing_intent !== testCase.expectIntent) {
    failed += 1;
    console.error(
      `[FAIL] ${testCase.name}: expected intent ${testCase.expectIntent}, got ${result.resolution.pricing_intent}`
    );
    continue;
  }

  if (JSON.stringify(actualCodes) !== JSON.stringify(expectedCodes)) {
    failed += 1;
    console.error(
      `[FAIL] ${testCase.name}: expected block codes ${expectedCodes.join(", ") || "(none)"}, got ${
        actualCodes.join(", ") || "(none)"
      }`
    );
    continue;
  }

  if (testCase.expectMissingInputs) {
    const missing = result.completeness.missing_required_inputs || [];
    const missingExpected = testCase.expectMissingInputs.every((field) => missing.includes(field));
    if (!missingExpected) {
      failed += 1;
      console.error(
        `[FAIL] ${testCase.name}: missing inputs ${testCase.expectMissingInputs.join(", ")} not found in ${missing.join(", ")}`
      );
      continue;
    }
  }

  console.log(
    `[PASS] ${testCase.name}: ${result.resolution.pricing_confidence} / ${result.resolution.pricing_intent}`
  );
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("\nPricing v1 resolver checks passed.");
}
