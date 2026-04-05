import { normalizePricingV1 } from "./pricingV1.js";

export const PRICING_V1_RESOLVER_CONTRACT_VERSION = "pricing_v1_resolver.v1";

const ASSESSMENT_BUILDING_HEIGHTS = ["1-2", "3", "4+"];
const ASSESSMENT_TERMINATION_TYPES = ["sidewall", "roof", "mixed"];
const ASSESSMENT_ACCESS_CONSTRAINTS = ["none", "minor", "moderate", "major"];

const BUILDING_HEIGHT_BAND_MAP = {
  "1-2": "1_2_floors",
  "3": "3_floors",
  "4+": "4_plus_floors"
};

const DRYER_VENT_BLOCKING_FLAGS = [
  "crushed_or_disconnected_suspected",
  "termination_damage_suspected",
  "repair_scope_likely",
  "restoration_scope_likely"
];

const DRYER_VENT_CAUTION_FLAGS = [
  "roof_access_required",
  "tile_or_metal_roof",
  "long_run_suspected",
  "blockage_suspected",
  "mixed_access_types",
  "prior_failed_vendor",
  "bird_guard_or_screen_issue",
  "booster_fan_or_special_hardware"
];

const AIR_DUCT_BLOCKING_FLAGS = [
  "repair_scope_likely",
  "restoration_scope_likely",
  "mold_like_or_bio_contamination",
  "water_intrusion_signs"
];

const AIR_DUCT_CAUTION_FLAGS = [
  "prior_failed_vendor",
  "booster_fan_or_special_hardware",
  "mixed_access_types"
];

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizePositiveNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeAssessmentEnum(value, allowed) {
  const next = normalizeText(value);
  return allowed.includes(next) ? next : "";
}

function hasKnownEnum(value) {
  return Boolean(value) && value !== "unknown";
}

function hasText(value) {
  return Boolean(normalizeText(value));
}

function addUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function addReason(list, code, message) {
  if (!list.some((entry) => entry.code === code)) {
    list.push({ code, message });
  }
}

function hasAnyFlag(flags, candidates) {
  return candidates.some((candidate) => flags.includes(candidate));
}

function collectFlags(flags, candidates) {
  return candidates.filter((candidate) => flags.includes(candidate));
}

function normalizeAssessmentContext(assessment) {
  const buildingHeight = normalizeAssessmentEnum(assessment?.building_height, ASSESSMENT_BUILDING_HEIGHTS);
  return {
    building_height: buildingHeight,
    building_height_band: BUILDING_HEIGHT_BAND_MAP[buildingHeight] || "",
    termination_type: normalizeAssessmentEnum(assessment?.termination_type, ASSESSMENT_TERMINATION_TYPES),
    access_constraints: normalizeAssessmentEnum(
      assessment?.access_constraints,
      ASSESSMENT_ACCESS_CONSTRAINTS
    ),
    access_difficulty: normalizeText(assessment?.access_difficulty)
  };
}

function normalizeResolverInput(rawContext = {}) {
  const assessment =
    rawContext?.assessment && typeof rawContext.assessment === "object" ? rawContext.assessment : {};
  const property =
    rawContext?.property && typeof rawContext.property === "object" ? rawContext.property : {};
  const pricing = normalizePricingV1(rawContext?.pricing ?? assessment?.pricing_v1);
  const assessmentContext = normalizeAssessmentContext(assessment);

  return {
    ...pricing,
    assessment_context: assessmentContext,
    property_context: {
      property_type: normalizeText(property?.property_type),
      total_property_units: normalizePositiveNumber(property?.units_est),
      number_of_buildings: normalizePositiveNumber(property?.number_of_buildings)
    }
  };
}

function isDryerVentScopeBasisPresent(input) {
  return (
    hasKnownEnum(input?.assessment_context?.termination_type) ||
    hasKnownEnum(input?.assessment_context?.building_height_band) ||
    hasKnownEnum(input?.dryer_vent?.vent_run_length_band)
  );
}

function isDryerVentScopeBasisStrong(input) {
  return (
    hasKnownEnum(input?.assessment_context?.termination_type) &&
    hasKnownEnum(input?.assessment_context?.building_height_band)
  );
}

function isAirDuctScopeBasisPresent(input) {
  return (
    hasText(input?.bedroom_mix) ||
    hasKnownEnum(input?.air_duct?.sqft_band) ||
    hasKnownEnum(input?.air_duct?.system_count_basis) ||
    hasKnownEnum(input?.air_duct?.supply_return_complexity)
  );
}

function isBroadScope(input) {
  return (
    (input?.units_requested_now || 0) > 1 ||
    ["grouped_same_building", "stacked_same_building", "multi_building_repeatable", "full_property_distribution_unclear"].includes(
      input?.grouped_scope
    )
  );
}

function isRoofScope(input) {
  return (
    input?.service_access_type === "roof_required" ||
    input?.assessment_context?.termination_type === "roof" ||
    input?.assessment_context?.termination_type === "mixed" ||
    input?.technical_issue_flags?.includes("roof_access_required")
  );
}

function analyzeDryerVent(input) {
  const missingRequiredInputs = [];
  const nonBlockingUnknowns = [];
  const cautionFlags = [];
  const quoteBlockReasons = [];
  const hasUnitsRequested = input.units_requested_now != null;
  const technicalFlags = input.technical_issue_flags || [];
  const operationalFlags = input.operational_issue_flags || [];
  const hasScopeBasis = isDryerVentScopeBasisPresent(input);
  const hasStrongScopeBasis = isDryerVentScopeBasisStrong(input);

  if (!hasUnitsRequested) addUnique(missingRequiredInputs, "units_requested_now");
  if (!input.grouped_scope) addUnique(missingRequiredInputs, "grouped_scope");
  if (!input.occupancy_state) addUnique(missingRequiredInputs, "occupancy_state");
  if (!input.service_access_type) addUnique(missingRequiredInputs, "service_access_type");
  if (!input.condition_level) addUnique(missingRequiredInputs, "condition_level");
  if (!input.travel_context) addUnique(missingRequiredInputs, "travel_context");
  if (!hasScopeBasis) addUnique(missingRequiredInputs, "dryer_vent.scope_basis");

  if (!hasKnownEnum(input.assessment_context.termination_type)) {
    addUnique(nonBlockingUnknowns, "assessment.termination_type");
  }
  if (!hasKnownEnum(input.assessment_context.building_height_band)) {
    addUnique(nonBlockingUnknowns, "assessment.building_height");
  }
  if (!hasKnownEnum(input.dryer_vent.maintenance_assisted_access)) {
    addUnique(nonBlockingUnknowns, "dryer_vent.maintenance_assisted_access");
  }
  if (!hasKnownEnum(input.dryer_vent.layout_consistency)) {
    addUnique(nonBlockingUnknowns, "dryer_vent.layout_consistency");
  }
  if (isRoofScope(input) && !hasKnownEnum(input.dryer_vent.roof_type)) {
    addUnique(nonBlockingUnknowns, "dryer_vent.roof_type");
  }
  if (!hasKnownEnum(input.dryer_vent.duct_type_known)) {
    addUnique(nonBlockingUnknowns, "dryer_vent.duct_type_known");
  }

  if (input.service_access_type === "unknown") {
    addReason(
      quoteBlockReasons,
      "DV_ACCESS_UNKNOWN",
      "Dryer vent service access is unknown, so instant pricing is unsafe."
    );
  }
  if (input.condition_level === "hazardous") {
    addReason(
      quoteBlockReasons,
      "DV_HAZARDOUS_CONDITION",
      "Hazardous dryer vent conditions require quote review instead of instant guide pricing."
    );
  }
  if (technicalFlags.includes("crushed_or_disconnected_suspected")) {
    addReason(
      quoteBlockReasons,
      "DV_DUCT_DAMAGE_SUSPECTED",
      "Suspected crushed or disconnected ductwork breaks the standard cleaning assumption."
    );
  }
  if (technicalFlags.includes("termination_damage_suspected")) {
    addReason(
      quoteBlockReasons,
      "DV_TERMINATION_DAMAGE",
      "Suspected termination damage introduces corrective scope."
    );
  }
  if (technicalFlags.includes("repair_scope_likely")) {
    addReason(
      quoteBlockReasons,
      "DV_REPAIR_SCOPE_LIKELY",
      "Likely repair work means this should move to formal quote handling."
    );
  }
  if (technicalFlags.includes("restoration_scope_likely")) {
    addReason(
      quoteBlockReasons,
      "DV_RESTORATION_SCOPE_LIKELY",
      "Likely restoration work is outside a field-ready pricing guide."
    );
  }
  if (isRoofScope(input) && input.assessment_context.access_constraints === "major") {
    addReason(
      quoteBlockReasons,
      "DV_ROOF_ACCESS_UNSAFE",
      "Roof-served scope shows major access constraints and needs formal review."
    );
  }
  if (input.grouped_scope === "full_property_distribution_unclear" && !hasStrongScopeBasis) {
    addReason(
      quoteBlockReasons,
      "DV_SCOPE_DISTRIBUTION_UNCLEAR",
      "Unit distribution is unclear and the dryer vent count basis is too weak for a guide."
    );
  }

  if (input.service_access_type === "roof_required" || input.service_access_type === "mixed") {
    addUnique(cautionFlags, "complex_service_access");
  }
  if (input.condition_level === "heavy") {
    addUnique(cautionFlags, "heavy_condition");
  }
  if (input.grouped_scope === "small_scattered_batch") {
    addUnique(cautionFlags, "scattered_batch");
  }
  if (input.occupancy_state === "occupied") {
    addUnique(cautionFlags, "occupied_scheduling_drag");
  }
  if (input.coordination_burden === "heavy") {
    addUnique(cautionFlags, "heavy_coordination");
  }
  if (input.dryer_vent.layout_consistency === "mixed") {
    addUnique(cautionFlags, "mixed_layouts");
  }
  if (input.assessment_context.access_constraints === "moderate") {
    addUnique(cautionFlags, "moderate_access_constraints");
  }
  collectFlags(technicalFlags, DRYER_VENT_CAUTION_FLAGS).forEach((flag) => addUnique(cautionFlags, flag));
  if (hasAnyFlag(operationalFlags, ["resident_scheduling_required", "after_hours_only", "limited_access_window"])) {
    addUnique(cautionFlags, "access_window_friction");
  }

  return {
    missingRequiredInputs,
    nonBlockingUnknowns,
    cautionFlags,
    quoteBlockReasons,
    recommendedFieldsComplete:
      hasKnownEnum(input.assessment_context.termination_type) &&
      hasKnownEnum(input.assessment_context.building_height_band) &&
      hasKnownEnum(input.dryer_vent.maintenance_assisted_access),
    hasScopeBasis
  };
}

function analyzeAirDuct(input) {
  const missingRequiredInputs = [];
  const nonBlockingUnknowns = [];
  const cautionFlags = [];
  const quoteBlockReasons = [];
  const technicalFlags = input.technical_issue_flags || [];
  const hasUnitsRequested = input.units_requested_now != null;
  const hasSystemCountBasis = hasKnownEnum(input.air_duct.system_count_basis);
  const hasScopeBasis = isAirDuctScopeBasisPresent(input);
  const broadScope = isBroadScope(input);
  const mixedLayout = input.air_duct.layout_consistency === "mixed";

  if (!hasUnitsRequested && !hasSystemCountBasis) {
    addUnique(missingRequiredInputs, "units_requested_now_or_air_duct.system_count_basis");
  }
  if (!input.grouped_scope) addUnique(missingRequiredInputs, "grouped_scope");
  if (!input.occupancy_state) addUnique(missingRequiredInputs, "occupancy_state");
  if (!input.service_access_type) addUnique(missingRequiredInputs, "service_access_type");
  if (!input.condition_level) addUnique(missingRequiredInputs, "condition_level");
  if (!input.travel_context) addUnique(missingRequiredInputs, "travel_context");
  if (!hasKnownEnum(input.air_duct.layout_consistency)) {
    addUnique(missingRequiredInputs, "air_duct.layout_consistency");
  }
  if (!hasScopeBasis) {
    addUnique(missingRequiredInputs, "air_duct.scope_complexity_basis");
  }

  if (!hasText(input.bedroom_mix)) {
    addUnique(nonBlockingUnknowns, "bedroom_mix");
  }
  if (!hasKnownEnum(input.air_duct.sqft_band)) {
    addUnique(nonBlockingUnknowns, "air_duct.sqft_band");
  }
  if (!hasKnownEnum(input.air_duct.air_handler_location)) {
    addUnique(nonBlockingUnknowns, "air_duct.air_handler_location");
  }
  if (!hasKnownEnum(input.air_duct.duct_material)) {
    addUnique(nonBlockingUnknowns, "air_duct.duct_material");
  }
  if (input.air_duct.accessible_returns_count == null) {
    addUnique(nonBlockingUnknowns, "air_duct.accessible_returns_count");
  }
  if (!input.coordination_burden) {
    addUnique(nonBlockingUnknowns, "coordination_burden");
  }

  if (input.service_access_type === "unknown") {
    addReason(
      quoteBlockReasons,
      "AD_ACCESS_UNKNOWN",
      "Air duct service access is unknown, so instant pricing is unsafe."
    );
  }
  if (input.air_duct.system_count_basis === "unknown") {
    addReason(
      quoteBlockReasons,
      "AD_SYSTEM_COUNT_BASIS_UNKNOWN",
      "System count basis is unknown for air duct work."
    );
  }
  if (input.air_duct.supply_return_complexity === "unknown" && (broadScope || mixedLayout)) {
    addReason(
      quoteBlockReasons,
      "AD_COMPLEXITY_UNKNOWN",
      "Supply/return complexity is unknown on a broad or mixed-layout air duct scope."
    );
  }
  if (input.air_duct.contamination_type === "mold_like_or_bio") {
    addReason(
      quoteBlockReasons,
      "AD_MOLD_LIKE_SCOPE",
      "Mold-like or biological contamination should not be treated as standard air duct cleaning."
    );
  }
  if (input.air_duct.contamination_type === "water_affected") {
    addReason(
      quoteBlockReasons,
      "AD_WATER_AFFECTED_SCOPE",
      "Water-affected ductwork needs formal quote review."
    );
  }
  if (technicalFlags.includes("repair_scope_likely")) {
    addReason(
      quoteBlockReasons,
      "AD_REPAIR_SCOPE_LIKELY",
      "Likely repair work makes instant air duct pricing unsafe."
    );
  }
  if (technicalFlags.includes("restoration_scope_likely")) {
    addReason(
      quoteBlockReasons,
      "AD_RESTORATION_SCOPE_LIKELY",
      "Likely restoration work is outside a budgetary air duct guide."
    );
  }
  if (
    broadScope &&
    (["mixed", "unknown"].includes(input.air_duct.air_handler_location) ||
      ["mixed", "unknown"].includes(input.air_duct.duct_material))
  ) {
    addReason(
      quoteBlockReasons,
      "AD_BROAD_SCOPE_CONFIGURATION_UNKNOWN",
      "Broad air duct scope still has mixed or unknown equipment/duct configuration."
    );
  }
  if (
    input.air_duct.system_count_basis === "mixed" &&
    (input.grouped_scope === "full_property_distribution_unclear" || !hasUnitsRequested)
  ) {
    addReason(
      quoteBlockReasons,
      "AD_MIXED_SCOPE_COUNT_UNCLEAR",
      "The air duct scope mixes system types without a reliable count basis."
    );
  }

  if (["attic_required", "crawlspace_required", "mixed"].includes(input.service_access_type)) {
    addUnique(cautionFlags, "complex_service_access");
  }
  if (input.condition_level === "heavy") {
    addUnique(cautionFlags, "heavy_condition");
  }
  if (input.air_duct.contamination_type === "heavy_debris") {
    addUnique(cautionFlags, "heavy_debris");
  }
  if (input.air_duct.layout_consistency === "mixed") {
    addUnique(cautionFlags, "mixed_layouts");
  }
  if (["attic", "crawlspace"].includes(input.air_duct.air_handler_location)) {
    addUnique(cautionFlags, "equipment_access_drag");
  }
  if (input.air_duct.supply_return_complexity === "complex") {
    addUnique(cautionFlags, "complex_supply_return");
  }
  if (input.occupancy_state === "occupied") {
    addUnique(cautionFlags, "occupied_scheduling_drag");
  }
  if (input.grouped_scope === "small_scattered_batch") {
    addUnique(cautionFlags, "scattered_batch");
  }
  if (input.coordination_burden === "heavy") {
    addUnique(cautionFlags, "heavy_coordination");
  }
  collectFlags(technicalFlags, AIR_DUCT_CAUTION_FLAGS).forEach((flag) => addUnique(cautionFlags, flag));

  return {
    missingRequiredInputs,
    nonBlockingUnknowns,
    cautionFlags,
    quoteBlockReasons,
    recommendedFieldsComplete:
      hasKnownEnum(input.air_duct.system_count_basis) &&
      hasKnownEnum(input.air_duct.supply_return_complexity) &&
      hasKnownEnum(input.air_duct.air_handler_location) &&
      hasKnownEnum(input.air_duct.duct_material),
    hasScopeBasis
  };
}

function resolvePricingConfidence(input, analysis) {
  if (!input.service_type) return "low";
  if (analysis.missingRequiredInputs.length > 0) return "low";
  if (analysis.quoteBlockReasons.length > 0) return "low";
  if (input.condition_level === "unknown") return "low";
  if (input.grouped_scope === "full_property_distribution_unclear") return "low";
  if (
    hasAnyFlag(input.technical_issue_flags || [], [...DRYER_VENT_BLOCKING_FLAGS, ...AIR_DUCT_BLOCKING_FLAGS]) ||
    input.air_duct?.system_count_basis === "unknown"
  ) {
    return "low";
  }
  if (
    analysis.nonBlockingUnknowns.length === 0 &&
    analysis.cautionFlags.length === 0 &&
    analysis.recommendedFieldsComplete
  ) {
    return "high";
  }
  return "medium";
}

function canUseBallpark(input, analysis) {
  if (!input.service_type) return false;
  if (analysis.quoteBlockReasons.length > 0) return false;
  if (input.units_requested_now == null) return false;
  if (!input.travel_context || !input.condition_level || input.condition_level === "unknown") return false;
  if (!input.service_access_type || input.service_access_type === "unknown") return false;
  return analysis.hasScopeBasis;
}

function resolvePricingIntent(input, analysis, pricingConfidence) {
  if (analysis.quoteBlockReasons.length > 0) {
    return {
      pricing_intent: "formal_quote_required",
      intent_reason_key: "quote_block"
    };
  }
  if (pricingConfidence === "high" || pricingConfidence === "medium") {
    return {
      pricing_intent: "budgetary_pricing_guide",
      intent_reason_key: "budgetary_ready"
    };
  }
  if (pricingConfidence === "low" && canUseBallpark(input, analysis)) {
    return {
      pricing_intent: "ballpark",
      intent_reason_key: "ballpark_only"
    };
  }
  return {
    pricing_intent: "formal_quote_required",
    intent_reason_key: "missing_required_inputs"
  };
}

export function resolvePricingV1(rawContext = {}) {
  const input = normalizeResolverInput(rawContext);
  const missingRequiredInputs = [];
  const nonBlockingUnknowns = [];
  const cautionFlags = [];
  const quoteBlockReasons = [];

  if (!input.service_type) {
    addUnique(missingRequiredInputs, "service_type");
  }

  const serviceAnalysis =
    input.service_type === "dryer_vent_cleaning"
      ? analyzeDryerVent(input)
      : input.service_type === "air_duct_cleaning"
        ? analyzeAirDuct(input)
        : {
            missingRequiredInputs: [],
            nonBlockingUnknowns: [],
            cautionFlags: [],
            quoteBlockReasons: [],
            recommendedFieldsComplete: false,
            hasScopeBasis: false
          };

  serviceAnalysis.missingRequiredInputs.forEach((field) => addUnique(missingRequiredInputs, field));
  serviceAnalysis.nonBlockingUnknowns.forEach((field) => addUnique(nonBlockingUnknowns, field));
  serviceAnalysis.cautionFlags.forEach((flag) => addUnique(cautionFlags, flag));
  serviceAnalysis.quoteBlockReasons.forEach((reason) =>
    addReason(quoteBlockReasons, reason.code, reason.message)
  );

  const pricingConfidence = resolvePricingConfidence(input, {
    ...serviceAnalysis,
    missingRequiredInputs,
    nonBlockingUnknowns,
    cautionFlags,
    quoteBlockReasons
  });
  const intentPayload = resolvePricingIntent(
    input,
    {
      ...serviceAnalysis,
      missingRequiredInputs,
      nonBlockingUnknowns,
      cautionFlags,
      quoteBlockReasons
    },
    pricingConfidence
  );

  return {
    contract_version: PRICING_V1_RESOLVER_CONTRACT_VERSION,
    valid: true,
    input: {
      ...input,
      pricing_confidence: pricingConfidence,
      pricing_intent: intentPayload.pricing_intent
    },
    completeness: {
      required_inputs_complete: missingRequiredInputs.length === 0,
      missing_required_inputs: missingRequiredInputs,
      non_blocking_unknowns: nonBlockingUnknowns,
      caution_flags: cautionFlags
    },
    blockers: {
      quote_blocked: quoteBlockReasons.length > 0,
      quote_block_reasons: quoteBlockReasons
    },
    resolution: {
      pricing_confidence: pricingConfidence,
      pricing_intent: intentPayload.pricing_intent,
      intent_reason_key: intentPayload.intent_reason_key,
      can_generate_budgetary_guide: intentPayload.pricing_intent === "budgetary_pricing_guide"
    }
  };
}
