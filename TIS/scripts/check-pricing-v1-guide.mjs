import { buildPricingV1GuideBundle } from "../src/utils/pricingV1Guide.js";

const cases = [
  {
    name: "Dryer vent guide builds from current planning inputs",
    input: {
      property: {
        property_name: "Maple Grove Apartments",
        street_address: "123 Main St",
        city: "Tampa",
        state: "FL",
        zip: "33602",
        units_est: 48
      },
      assessment: {
        building_height: "3",
        termination_type: "sidewall",
        access_constraints: "minor",
        maintenance_presence_visible: true,
        pricing_v1: {}
      },
      estimateInputs: {
        terminations: "12",
        buildings: "1",
        condition: "normal",
        travel: false,
        birdGuards: false
      },
      speedInputs: {
        visible_condition: "moderate"
      },
      photos: [{ id: "1" }, { id: "2" }]
    },
    expectIntent: "budgetary_pricing_guide",
    expectDocument: true
  },
  {
    name: "Blocked air duct scope does not emit HTML guide",
    input: {
      property: {
        property_name: "Ridge Pointe",
        street_address: "55 Oak Ave",
        city: "Orlando",
        state: "FL",
        zip: "32801",
        units_est: 120
      },
      assessment: {
        pricing_v1: {
          service_type: "air_duct_cleaning",
          units_requested_now: 24,
          grouped_scope: "multi_building_repeatable",
          occupancy_state: "occupied",
          service_access_type: "attic_required",
          condition_level: "heavy",
          coordination_burden: "heavy",
          travel_context: "special_mobilization",
          technical_issue_flags: ["repair_scope_likely"],
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
      }
    },
    expectIntent: "formal_quote_required",
    expectDocument: false
  }
];

let failed = 0;

for (const testCase of cases) {
  const result = buildPricingV1GuideBundle(testCase.input);

  if (result.resolution.pricing_intent !== testCase.expectIntent) {
    failed += 1;
    console.error(
      `[FAIL] ${testCase.name}: expected intent ${testCase.expectIntent}, got ${result.resolution.pricing_intent}`
    );
    continue;
  }

  if (Boolean(result.document) !== testCase.expectDocument) {
    failed += 1;
    console.error(
      `[FAIL] ${testCase.name}: expected document ${testCase.expectDocument}, got ${Boolean(result.document)}`
    );
    continue;
  }

  if (testCase.expectDocument) {
    if (
      result.document.document_type !== "budgetary_pricing_guide" ||
      !result.document.price_range_display ||
      !result.document.modifiers_applied?.access ||
      !result.html.includes("Budgetary Pricing Guide")
    ) {
      failed += 1;
      console.error(`[FAIL] ${testCase.name}: guide output missing required contract fields`);
      continue;
    }
  } else if (result.html) {
    failed += 1;
    console.error(`[FAIL] ${testCase.name}: blocked case should not emit HTML`);
    continue;
  }

  console.log(
    `[PASS] ${testCase.name}: ${result.resolution.pricing_intent}${result.document ? ` / ${result.document.price_range_display}` : ""}`
  );
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("\nPricing v1 guide checks passed.");
}
