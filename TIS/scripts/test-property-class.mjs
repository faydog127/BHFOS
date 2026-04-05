import assert from "node:assert/strict";
import { derivePropertyClass, getPropertyClassWarnings } from "../src/utils/propertyClass.js";

const cases = [
  { label: "A: excellent + well_kept + high", input: { exterior_condition: "excellent", maintenance_signals: "well_kept", overall_feel: "high" }, expected: "A" },
  { label: "A: good + well_kept + high", input: { exterior_condition: "good", maintenance_signals: "well_kept", overall_feel: "high" }, expected: "A" },
  { label: "C: fair + deferred + low", input: { exterior_condition: "fair", maintenance_signals: "deferred_maintenance", overall_feel: "low" }, expected: "C" },
  { label: "C: poor + heavy_wear + low", input: { exterior_condition: "poor", maintenance_signals: "heavy_wear", overall_feel: "low" }, expected: "C" },
  { label: "B: good + minor_issues + moderate", input: { exterior_condition: "good", maintenance_signals: "minor_issues", overall_feel: "moderate" }, expected: "B" },
  { label: "B: fair + well_kept + high", input: { exterior_condition: "fair", maintenance_signals: "well_kept", overall_feel: "high" }, expected: "B" },
  { label: "B: excellent + heavy_wear + low", input: { exterior_condition: "excellent", maintenance_signals: "heavy_wear", overall_feel: "low" }, expected: "B" }
];

cases.forEach(({ label, input, expected }) => {
  const actual = derivePropertyClass(input);
  assert.equal(actual, expected, `${label} => expected ${expected}, got ${actual}`);
});

const warningCases = [
  {
    label: "exterior high + maintenance low",
    input: { exterior_condition: "excellent", maintenance_signals: "heavy_wear", overall_feel: "moderate" },
    includes: "exterior looks strong"
  },
  {
    label: "exterior low + maintenance high",
    input: { exterior_condition: "poor", maintenance_signals: "well_kept", overall_feel: "moderate" },
    includes: "exterior looks worn"
  },
  {
    label: "overall high vs weak signals",
    input: { exterior_condition: "fair", maintenance_signals: "deferred_maintenance", overall_feel: "high" },
    includes: "overall feel is high"
  },
  {
    label: "overall low vs strong signals",
    input: { exterior_condition: "excellent", maintenance_signals: "well_kept", overall_feel: "low" },
    includes: "overall feel is low"
  }
];

warningCases.forEach(({ label, input, includes }) => {
  const warnings = getPropertyClassWarnings(input);
  assert.ok(warnings.length > 0, `${label} => expected warnings`);
  assert.ok(
    warnings.some((warning) => warning.includes(includes)),
    `${label} => expected warning to include "${includes}"`
  );
});

console.log("property_class tests passed");
