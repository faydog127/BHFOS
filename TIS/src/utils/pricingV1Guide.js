import { formatMoney, formatMoneyRange } from "./estimatePricing.js";
import { clonePricingV1 } from "./pricingV1.js";
import { resolvePricingV1 } from "./pricingV1Resolver.js";

const SERVICE_LABELS = {
  dryer_vent_cleaning: "Dryer Vent Cleaning",
  air_duct_cleaning: "Air Duct Cleaning"
};

const GROUPED_SCOPE_LABELS = {
  single_unit: "single-unit scope",
  small_scattered_batch: "small scattered batch",
  grouped_same_building: "grouped same-building batch",
  stacked_same_building: "stacked same-building batch",
  multi_building_repeatable: "repeatable multi-building batch",
  full_property_distribution_unclear: "full-property distribution not yet confirmed"
};

const OCCUPANCY_LABELS = {
  vacant: "vacant access",
  mixed: "mixed occupied/vacant access",
  occupied: "occupied access"
};

const ACCESS_LABELS = {
  interior_only: "interior-only access",
  roof_required: "roof-required access",
  attic_required: "attic-required access",
  crawlspace_required: "crawlspace-required access",
  mixed: "mixed access conditions",
  unknown: "access not yet confirmed"
};

const CONDITION_LABELS = {
  normal: "normal service condition",
  moderate: "moderate visible buildup",
  heavy: "heavy visible buildup",
  hazardous: "hazardous or corrective condition",
  unknown: "condition not yet confirmed"
};

const TRAVEL_LABELS = {
  standard_local: "standard local mobilization",
  remote_or_multi_trip: "remote or multi-trip mobilization",
  special_mobilization: "special mobilization"
};

const GUIDE_HTML_VERSION = "pricing_v1_budgetary_guide.v1";

export const PRICING_V1_INTERNAL_CONFIG = {
  shared: {
    validity_window_days: 14
  },
  dryer_vent_cleaning: {
    display_name: "Dryer Vent Cleaning",
    basis_unit_label: "unit",
    base_low: 30,
    base_high: 40,
    small_scope_threshold: 30,
    minimum_job_low: 750,
    minimum_job_high: 1000,
    travel_charges: {
      standard_local: { low: 0, high: 0 },
      remote_or_multi_trip: { low: 250, high: 450 },
      special_mobilization: { low: 500, high: 850 }
    },
    excluded_conditions: [
      "Duct repair, reconnection, or replacement beyond standard cleaning.",
      "Termination replacement or corrective roof work.",
      "Booster fan replacement, electrical correction, or new hardware installation.",
      "After-hours or resident-by-resident workflows beyond the stated assumptions."
    ]
  },
  air_duct_cleaning: {
    display_name: "Air Duct Cleaning",
    basis_unit_label: "system scope",
    base_low: 350,
    base_high: 525,
    small_scope_threshold: 4,
    minimum_job_low: 1800,
    minimum_job_high: 2800,
    travel_charges: {
      standard_local: { low: 0, high: 0 },
      remote_or_multi_trip: { low: 350, high: 650 },
      special_mobilization: { low: 700, high: 1200 }
    },
    excluded_conditions: [
      "Mold remediation, biohazard work, or water restoration.",
      "Equipment repair, replacement, or major corrective duct modifications.",
      "Common-area and in-unit mixed system work beyond the stated planning basis.",
      "After-hours or resident-by-resident workflows beyond the stated assumptions."
    ]
  }
};

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizePositiveNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pricing-guide";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPct(value) {
  return `${Math.round(value * 100)}%`;
}

function formatPctRange(low, high) {
  return low === high ? formatPct(low) : `${formatPct(low)}-${formatPct(high)}`;
}

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function pushReason(bucket, low, high, label) {
  bucket.low += low;
  bucket.high += high;
  addUnique(bucket.reasons, label);
}

function capBucket(bucket, maxValue) {
  return {
    low: Math.min(bucket.low, maxValue),
    high: Math.min(bucket.high, maxValue),
    reasons: bucket.reasons
  };
}

function formatAddress(property) {
  return [property?.street_address, property?.city, property?.state, property?.zip]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(", ");
}

function inferGroupedScope(unitsRequestedNow, buildingsInScope) {
  if (!unitsRequestedNow || unitsRequestedNow <= 1) return "single_unit";
  if (buildingsInScope && buildingsInScope > 1) {
    return unitsRequestedNow / buildingsInScope >= 6
      ? "multi_building_repeatable"
      : "small_scattered_batch";
  }
  return "grouped_same_building";
}

function inferConditionLevel({ pricing, estimateInputs, speedInputs }) {
  if (pricing.condition_level) return pricing.condition_level;
  const estimateCondition = normalizeText(estimateInputs?.condition);
  if (estimateCondition === "hazard") return "hazardous";
  if (estimateCondition === "heavy") return "heavy";
  if (estimateCondition === "normal") return "normal";
  const speedCondition = normalizeText(speedInputs?.visible_condition);
  if (speedCondition) return speedCondition;
  return "";
}

function inferServiceAccessType({ pricing, assessment }) {
  if (pricing.service_access_type) return pricing.service_access_type;
  if (assessment?.termination_type === "roof") return "roof_required";
  if (assessment?.termination_type === "mixed") return "mixed";
  if (assessment?.termination_type === "sidewall") return "interior_only";
  return "";
}

function maybeFill(target, field, value, inferredFields, reason) {
  const nextValue = Array.isArray(value) ? value.filter(Boolean) : value;
  const shouldWrite = Array.isArray(nextValue)
    ? nextValue.length > 0
    : nextValue !== null && nextValue !== undefined && nextValue !== "";
  if (!shouldWrite) return;

  const current = target[field];
  const currentEmpty = Array.isArray(current) ? current.length === 0 : current == null || current === "";
  if (!currentEmpty) return;

  target[field] = nextValue;
  inferredFields.push({ field, value: nextValue, reason });
}

function maybeFillNested(target, group, field, value, inferredFields, reason) {
  if (!target[group] || typeof target[group] !== "object") return;
  const nextValue = Array.isArray(value) ? value.filter(Boolean) : value;
  const shouldWrite = Array.isArray(nextValue)
    ? nextValue.length > 0
    : nextValue !== null && nextValue !== undefined && nextValue !== "";
  if (!shouldWrite) return;

  const current = target[group][field];
  const currentEmpty = Array.isArray(current) ? current.length === 0 : current == null || current === "";
  if (!currentEmpty) return;

  target[group][field] = nextValue;
  inferredFields.push({ field: `${group}.${field}`, value: nextValue, reason });
}

function describeInferredField(field) {
  const labels = {
    service_type: "Service type was assumed from the current estimate workflow.",
    units_requested_now: "Current requested-unit count was modeled from the estimate inputs.",
    total_possible_units: "Total possible units were modeled from the property record.",
    number_of_buildings_in_scope: "Buildings in scope were modeled from the current estimate inputs.",
    grouped_scope: "Batch grouping was modeled from the current count and building assumptions.",
    occupancy_state: "Occupancy was modeled conservatively until field confirmation is captured.",
    service_access_type: "Service access was modeled from observed termination and access conditions.",
    condition_level: "Condition level was modeled from the current field/Speed Mode posture.",
    coordination_burden: "Coordination burden was modeled conservatively for planning use.",
    travel_context: "Travel context was modeled from the current mobilization toggle.",
    photo_count: "Photo count was modeled from attached field photos.",
    technical_issue_flags: "Technical issue flags were modeled from current estimate assumptions.",
    "dryer_vent.vent_run_length_band":
      "Vent run length was modeled from building height and termination assumptions.",
    "dryer_vent.maintenance_assisted_access":
      "Maintenance-assisted access was modeled from observed maintenance presence.",
    "dryer_vent.layout_consistency": "Layout consistency was modeled from the current batch/building assumptions."
  };
  return labels[field] || `${field} was modeled for planning purposes.`;
}

export function derivePricingV1GuideInput({
  assessment,
  property,
  pricing,
  estimateInputs,
  speedInputs,
  photos = []
} = {}) {
  const effectivePricing = clonePricingV1(pricing ?? assessment?.pricing_v1);
  const inferredFields = [];
  const unitsRequested = normalizePositiveNumber(
    effectivePricing.units_requested_now ?? estimateInputs?.terminations ?? property?.units_est
  );
  const buildingsInScope = normalizePositiveNumber(
    effectivePricing.number_of_buildings_in_scope ?? estimateInputs?.buildings ?? 1
  );
  const serviceType = effectivePricing.service_type || "dryer_vent_cleaning";
  const occupancyState =
    effectivePricing.occupancy_state || (unitsRequested && unitsRequested > 1 ? "mixed" : "vacant");
  const serviceAccessType = inferServiceAccessType({ pricing: effectivePricing, assessment });
  const conditionLevel = inferConditionLevel({ pricing: effectivePricing, estimateInputs, speedInputs });
  const coordinationBurden =
    effectivePricing.coordination_burden ||
    (occupancyState === "occupied" || occupancyState === "mixed" ? "moderate" : "light");
  const travelContext =
    effectivePricing.travel_context ||
    (estimateInputs?.travel ? "remote_or_multi_trip" : "standard_local");

  maybeFill(
    effectivePricing,
    "service_type",
    serviceType,
    inferredFields,
    describeInferredField("service_type")
  );
  maybeFill(
    effectivePricing,
    "units_requested_now",
    unitsRequested,
    inferredFields,
    describeInferredField("units_requested_now")
  );
  maybeFill(
    effectivePricing,
    "total_possible_units",
    normalizePositiveNumber(property?.units_est),
    inferredFields,
    describeInferredField("total_possible_units")
  );
  maybeFill(
    effectivePricing,
    "number_of_buildings_in_scope",
    buildingsInScope,
    inferredFields,
    describeInferredField("number_of_buildings_in_scope")
  );
  maybeFill(
    effectivePricing,
    "grouped_scope",
    inferGroupedScope(unitsRequested, buildingsInScope),
    inferredFields,
    describeInferredField("grouped_scope")
  );
  maybeFill(
    effectivePricing,
    "occupancy_state",
    occupancyState,
    inferredFields,
    describeInferredField("occupancy_state")
  );
  maybeFill(
    effectivePricing,
    "service_access_type",
    serviceAccessType,
    inferredFields,
    describeInferredField("service_access_type")
  );
  maybeFill(
    effectivePricing,
    "condition_level",
    conditionLevel,
    inferredFields,
    describeInferredField("condition_level")
  );
  maybeFill(
    effectivePricing,
    "coordination_burden",
    coordinationBurden,
    inferredFields,
    describeInferredField("coordination_burden")
  );
  maybeFill(
    effectivePricing,
    "travel_context",
    travelContext,
    inferredFields,
    describeInferredField("travel_context")
  );
  maybeFill(
    effectivePricing,
    "photo_count",
    photos.length || null,
    inferredFields,
    describeInferredField("photo_count")
  );

  const inferredTechnicalFlags = [
    estimateInputs?.birdGuards ? "bird_guard_or_screen_issue" : "",
    assessment?.termination_type === "roof" ? "roof_access_required" : "",
    assessment?.termination_type === "mixed" ? "mixed_access_types" : ""
  ].filter(Boolean);
  if (inferredTechnicalFlags.length) {
    maybeFill(
      effectivePricing,
      "technical_issue_flags",
      inferredTechnicalFlags,
      inferredFields,
      describeInferredField("technical_issue_flags")
    );
  }

  if (serviceType === "dryer_vent_cleaning") {
    const inferredRunLength =
      assessment?.termination_type === "roof" || assessment?.building_height === "4+"
        ? "long"
        : assessment?.building_height === "3"
          ? "medium"
          : assessment?.termination_type === "sidewall"
            ? "short"
            : "";
    const inferredMaintenanceAccess =
      assessment?.maintenance_presence_visible === true
        ? "yes"
        : assessment?.maintenance_presence_visible === false
          ? "no"
          : "";
    const inferredLayoutConsistency =
      buildingsInScope && buildingsInScope > 1
        ? "mixed"
        : unitsRequested && unitsRequested >= 6
          ? "standardized"
          : "";

    maybeFillNested(
      effectivePricing,
      "dryer_vent",
      "vent_run_length_band",
      inferredRunLength,
      inferredFields,
      describeInferredField("dryer_vent.vent_run_length_band")
    );
    maybeFillNested(
      effectivePricing,
      "dryer_vent",
      "maintenance_assisted_access",
      inferredMaintenanceAccess,
      inferredFields,
      describeInferredField("dryer_vent.maintenance_assisted_access")
    );
    maybeFillNested(
      effectivePricing,
      "dryer_vent",
      "layout_consistency",
      inferredLayoutConsistency,
      inferredFields,
      describeInferredField("dryer_vent.layout_consistency")
    );
  }

  return {
    pricing: effectivePricing,
    inferred_fields: inferredFields
  };
}

function describePercentageModifier(kind, bucket, zeroMessage) {
  if (!bucket.reasons.length || (bucket.low <= 0 && bucket.high <= 0)) {
    return zeroMessage;
  }
  const signed =
    kind === "credit"
      ? `-${formatPctRange(bucket.low, bucket.high)}`
      : `+${formatPctRange(bucket.low, bucket.high)}`;
  const prefix = kind === "credit" ? "Efficiency credit" : "Increase";
  return `${prefix}: ${bucket.reasons.join(", ")} (${signed}).`;
}

function describeFlatModifier(bucket, zeroMessage) {
  if (!bucket.reasons.length || (bucket.low <= 0 && bucket.high <= 0)) {
    return zeroMessage;
  }
  return `Flat add: ${bucket.reasons.join(", ")} (${formatMoneyRange(bucket.low, bucket.high)}).`;
}

function buildDryerVentModifierPlan(input, config) {
  const access = { low: 0, high: 0, reasons: [] };
  const condition = { low: 0, high: 0, reasons: [] };
  const coordination = { low: 0, high: 0, reasons: [] };
  const efficiency = { low: 0, high: 0, reasons: [] };
  const travelCharge = { low: 0, high: 0, reasons: [] };
  const technicalFlags = input.technical_issue_flags || [];
  const operationalFlags = input.operational_issue_flags || [];

  if (input.service_access_type === "roof_required") pushReason(access, 0.25, 0.45, "roof-required access");
  if (input.service_access_type === "mixed") pushReason(access, 0.18, 0.3, "mixed access conditions");
  if (input.assessment_context.building_height_band === "3_floors") {
    pushReason(access, 0.1, 0.15, "3-floor execution");
  }
  if (input.assessment_context.building_height_band === "4_plus_floors") {
    pushReason(access, 0.2, 0.3, "4+ floor execution");
  }
  if (["roof", "mixed"].includes(input.assessment_context.termination_type)) {
    pushReason(access, 0.08, 0.15, "roof or mixed terminations");
  }
  if (input.dryer_vent.vent_run_length_band === "medium") {
    pushReason(access, 0.05, 0.08, "medium vent runs");
  }
  if (input.dryer_vent.vent_run_length_band === "long") {
    pushReason(access, 0.1, 0.15, "long vent runs");
  }
  if (technicalFlags.includes("tile_or_metal_roof")) {
    pushReason(access, 0.08, 0.15, "tile/metal roof handling");
  }
  if (technicalFlags.includes("mixed_access_types")) {
    pushReason(access, 0.07, 0.12, "mixed access types");
  }

  if (input.condition_level === "moderate") {
    pushReason(condition, 0.1, 0.15, "moderate buildup");
  }
  if (input.condition_level === "heavy") {
    pushReason(condition, 0.22, 0.35, "heavy buildup");
  }
  if (technicalFlags.includes("blockage_suspected")) {
    pushReason(condition, 0.08, 0.12, "suspected blockage");
  }
  if (technicalFlags.includes("bird_guard_or_screen_issue")) {
    pushReason(condition, 0.07, 0.1, "bird guard / screen handling");
  }
  if (technicalFlags.includes("prior_failed_vendor")) {
    pushReason(condition, 0.06, 0.1, "prior failed vendor history");
  }

  if (input.occupancy_state === "mixed") {
    pushReason(coordination, 0.05, 0.08, "mixed occupancy");
  }
  if (input.occupancy_state === "occupied") {
    pushReason(coordination, 0.08, 0.12, "occupied scheduling");
  }
  if (input.coordination_burden === "moderate") {
    pushReason(coordination, 0.06, 0.1, "moderate admin burden");
  }
  if (input.coordination_burden === "heavy") {
    pushReason(coordination, 0.14, 0.2, "heavy admin burden");
  }
  if (operationalFlags.includes("resident_scheduling_required")) {
    pushReason(coordination, 0.05, 0.08, "resident scheduling");
  }
  if (operationalFlags.includes("portal_or_po_workflow")) {
    pushReason(coordination, 0.04, 0.06, "portal / PO workflow");
  }
  if (operationalFlags.includes("photo_package_required")) {
    pushReason(coordination, 0.03, 0.05, "photo package");
  }
  if (operationalFlags.includes("unit_log_required")) {
    pushReason(coordination, 0.04, 0.06, "unit-by-unit logs");
  }
  if (operationalFlags.includes("after_hours_only")) {
    pushReason(coordination, 0.08, 0.12, "after-hours workflow");
  }

  const travel = config.travel_charges[input.travel_context] || config.travel_charges.standard_local;
  if (travel.low > 0 || travel.high > 0) {
    travelCharge.low = travel.low;
    travelCharge.high = travel.high;
    travelCharge.reasons.push(TRAVEL_LABELS[input.travel_context] || "travel/mobilization");
  }

  if (input.grouped_scope === "stacked_same_building") {
    pushReason(efficiency, 0.12, 0.18, "stacked same-building batch");
  }
  if (input.grouped_scope === "grouped_same_building") {
    pushReason(efficiency, 0.08, 0.12, "grouped same-building batch");
  }
  if (input.grouped_scope === "multi_building_repeatable") {
    pushReason(efficiency, 0.04, 0.08, "repeatable multi-building batch");
  }
  if (input.dryer_vent.layout_consistency === "standardized") {
    pushReason(efficiency, 0.03, 0.05, "standardized layouts");
  }
  if (input.dryer_vent.maintenance_assisted_access === "yes") {
    pushReason(efficiency, 0.05, 0.08, "maintenance-assisted access");
  }
  if (operationalFlags.includes("maintenance_pre_stage_available")) {
    pushReason(efficiency, 0.03, 0.05, "maintenance pre-staging");
  }
  if (input.occupancy_state === "occupied") {
    efficiency.low *= 0.4;
    efficiency.high *= 0.4;
    addUnique(efficiency.reasons, "occupied scheduling reduced the batching credit");
  }
  if (input.grouped_scope === "small_scattered_batch") {
    efficiency.low = 0;
    efficiency.high = 0;
    efficiency.reasons = [];
  }

  return {
    access: capBucket(access, 0.7),
    condition: capBucket(condition, 0.45),
    coordination: capBucket(coordination, 0.35),
    travel: travelCharge,
    efficiency_credit: capBucket(efficiency, 0.25)
  };
}

function buildAirDuctModifierPlan(input, config) {
  const access = { low: 0, high: 0, reasons: [] };
  const condition = { low: 0, high: 0, reasons: [] };
  const coordination = { low: 0, high: 0, reasons: [] };
  const efficiency = { low: 0, high: 0, reasons: [] };
  const travelCharge = { low: 0, high: 0, reasons: [] };
  const technicalFlags = input.technical_issue_flags || [];
  const operationalFlags = input.operational_issue_flags || [];

  if (input.service_access_type === "attic_required") pushReason(access, 0.12, 0.18, "attic access");
  if (input.service_access_type === "crawlspace_required") {
    pushReason(access, 0.12, 0.2, "crawlspace access");
  }
  if (input.service_access_type === "mixed") pushReason(access, 0.15, 0.25, "mixed access path");
  if (["attic", "crawlspace"].includes(input.air_duct.air_handler_location)) {
    pushReason(access, 0.08, 0.12, "equipment access");
  }
  if (input.air_duct.supply_return_complexity === "moderate") {
    pushReason(access, 0.08, 0.12, "moderate supply/return complexity");
  }
  if (input.air_duct.supply_return_complexity === "complex") {
    pushReason(access, 0.18, 0.28, "complex supply/return path");
  }
  if (["mixed", "unknown"].includes(input.air_duct.duct_material)) {
    pushReason(access, 0.05, 0.1, "mixed or unknown duct material");
  }

  if (input.condition_level === "moderate") {
    pushReason(condition, 0.08, 0.14, "moderate contamination");
  }
  if (input.condition_level === "heavy") {
    pushReason(condition, 0.2, 0.32, "heavy contamination");
  }
  if (input.air_duct.contamination_type === "heavy_debris") {
    pushReason(condition, 0.08, 0.12, "heavy debris");
  }
  if (technicalFlags.includes("prior_failed_vendor")) {
    pushReason(condition, 0.05, 0.08, "prior failed vendor history");
  }

  if (input.occupancy_state === "mixed") {
    pushReason(coordination, 0.06, 0.1, "mixed occupancy");
  }
  if (input.occupancy_state === "occupied") {
    pushReason(coordination, 0.1, 0.16, "occupied scheduling");
  }
  if (input.coordination_burden === "moderate") {
    pushReason(coordination, 0.06, 0.1, "moderate admin burden");
  }
  if (input.coordination_burden === "heavy") {
    pushReason(coordination, 0.14, 0.22, "heavy admin burden");
  }
  if (operationalFlags.includes("resident_notice_required")) {
    pushReason(coordination, 0.04, 0.06, "resident notice workflow");
  }
  if (operationalFlags.includes("photo_package_required")) {
    pushReason(coordination, 0.03, 0.05, "photo package");
  }
  if (operationalFlags.includes("portal_or_po_workflow")) {
    pushReason(coordination, 0.04, 0.06, "portal / PO workflow");
  }

  const travel = config.travel_charges[input.travel_context] || config.travel_charges.standard_local;
  if (travel.low > 0 || travel.high > 0) {
    travelCharge.low = travel.low;
    travelCharge.high = travel.high;
    travelCharge.reasons.push(TRAVEL_LABELS[input.travel_context] || "travel/mobilization");
  }

  if (input.air_duct.layout_consistency === "standardized") {
    pushReason(efficiency, 0.05, 0.08, "standardized layouts");
  }
  if (input.grouped_scope === "grouped_same_building") {
    pushReason(efficiency, 0.06, 0.1, "grouped same-building batch");
  }
  if (input.grouped_scope === "stacked_same_building") {
    pushReason(efficiency, 0.08, 0.12, "stacked same-building batch");
  }
  if (input.air_duct.system_count_basis === "single_system_per_unit") {
    pushReason(efficiency, 0.04, 0.06, "single system per unit");
  }
  if (input.occupancy_state === "occupied") {
    efficiency.low *= 0.5;
    efficiency.high *= 0.5;
    addUnique(efficiency.reasons, "occupied scheduling reduced the batching credit");
  }
  if (input.air_duct.layout_consistency === "mixed" || input.grouped_scope === "small_scattered_batch") {
    efficiency.low = 0;
    efficiency.high = 0;
    efficiency.reasons = [];
  }

  return {
    access: capBucket(access, 0.5),
    condition: capBucket(condition, 0.4),
    coordination: capBucket(coordination, 0.35),
    travel: travelCharge,
    efficiency_credit: capBucket(efficiency, 0.2)
  };
}

function buildPricingPlan(resolvedInput) {
  const config = PRICING_V1_INTERNAL_CONFIG[resolvedInput.service_type];
  const quantity =
    normalizePositiveNumber(resolvedInput.units_requested_now) ||
    normalizePositiveNumber(resolvedInput.total_possible_units) ||
    1;
  const modifiers =
    resolvedInput.service_type === "air_duct_cleaning"
      ? buildAirDuctModifierPlan(resolvedInput, config)
      : buildDryerVentModifierPlan(resolvedInput, config);

  const baseLow = quantity * config.base_low;
  const baseHigh = quantity * config.base_high;
  const lowMultiplier =
    1 +
    modifiers.access.low +
    modifiers.condition.low +
    modifiers.coordination.low -
    modifiers.efficiency_credit.low;
  const highMultiplier =
    1 +
    modifiers.access.high +
    modifiers.condition.high +
    modifiers.coordination.high -
    modifiers.efficiency_credit.high;

  let estimateLow = Math.round(baseLow * lowMultiplier + modifiers.travel.low);
  let estimateHigh = Math.round(baseHigh * highMultiplier + modifiers.travel.high);
  const minimumApplied =
    quantity < config.small_scope_threshold || resolvedInput.grouped_scope === "single_unit";

  if (minimumApplied) {
    estimateLow = Math.max(estimateLow, config.minimum_job_low);
    estimateHigh = Math.max(estimateHigh, config.minimum_job_high);
  }

  return {
    config,
    quantity,
    base_low_total: baseLow,
    base_high_total: baseHigh,
    estimate_low: estimateLow,
    estimate_high: estimateHigh,
    estimate_range_display: formatMoneyRange(estimateLow, estimateHigh),
    base_range_display: formatMoneyRange(baseLow, baseHigh),
    per_unit_range_display: `${formatMoney(config.base_low)}-${formatMoney(config.base_high)} per ${config.basis_unit_label}`,
    minimum_applied: minimumApplied,
    modifiers,
    modifiers_applied: {
      access: describePercentageModifier(
        "increase",
        modifiers.access,
        "Base assumption: standard access conditions only."
      ),
      condition: describePercentageModifier(
        "increase",
        modifiers.condition,
        "Base assumption: standard service condition only."
      ),
      coordination: describePercentageModifier(
        "increase",
        modifiers.coordination,
        "Base assumption: standard coordination burden only."
      ),
      travel: describeFlatModifier(
        modifiers.travel,
        "Base assumption: standard local mobilization."
      ),
      efficiency_credit: describePercentageModifier(
        "credit",
        modifiers.efficiency_credit,
        "No batching credit applied."
      )
    }
  };
}

function buildAssumptions({ resolvedInput, resolution, inferredFields }) {
  const assumptions = [
    "Pricing is based on observed conditions and stated assumptions.",
    `This planning range assumes ${GROUPED_SCOPE_LABELS[resolvedInput.grouped_scope] || "the current batch shape"}, ${
      ACCESS_LABELS[resolvedInput.service_access_type] || "the current access pattern"
    }, ${OCCUPANCY_LABELS[resolvedInput.occupancy_state] || "the current occupancy pattern"}, and ${
      CONDITION_LABELS[resolvedInput.condition_level] || "the current condition level"
    }.`,
    "Final pricing may change if access, count, configuration, contamination, or corrective scope differs.",
    "This is planning/budgetary pricing and not a final approval-ready quote unless explicitly converted."
  ];

  if (resolution.pricing_confidence === "medium") {
    assumptions.push(
      "Medium confidence means one or more non-blocking unknowns are still being carried in the planning model."
    );
  }

  inferredFields.slice(0, 4).forEach((entry) => assumptions.push(entry.reason));
  return assumptions;
}

function buildChangeTriggers(serviceType) {
  const base = [
    "Access differs from the observed or stated assumptions.",
    "Unit distribution or count differs from the stated batch assumptions.",
    "Corrective repair, restoration, or hidden damage is discovered.",
    "Reporting, scheduling, or after-hours requirements are broader than stated."
  ];

  if (serviceType === "dryer_vent_cleaning") {
    base.push("Roof access, long runs, or non-standard terminations are broader than assumed.");
  }
  if (serviceType === "air_duct_cleaning") {
    base.push(
      "System count, return count, contamination type, or equipment access differs from the stated basis."
    );
  }

  return base;
}

function buildGuideText(document) {
  return [
    `${document.service_label} | Budgetary Pricing Guide`,
    `Confidence: ${document.pricing_confidence}`,
    `Property: ${document.property_summary}`,
    `Scope: ${document.scope_summary}`,
    `Price Range: ${document.price_range_display}`,
    `Basis: ${document.price_basis_summary}`,
    "",
    "Assumptions:",
    ...document.assumptions.map((item) => `- ${item}`),
    "",
    "Modifiers Applied:",
    `- Access: ${document.modifiers_applied.access}`,
    `- Condition: ${document.modifiers_applied.condition}`,
    `- Coordination: ${document.modifiers_applied.coordination}`,
    `- Travel: ${document.modifiers_applied.travel}`,
    `- Efficiency Credit: ${document.modifiers_applied.efficiency_credit}`,
    "",
    "Excluded Conditions:",
    ...document.excluded_conditions.map((item) => `- ${item}`),
    "",
    "Change Triggers:",
    ...document.change_order_triggers.map((item) => `- ${item}`),
    "",
    `Next Step: ${document.next_step}`,
    `Disclaimer: ${document.disclaimer}`
  ].join("\n");
}

export function renderBudgetaryPricingGuideHtml(document) {
  const assumptionsHtml = document.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const excludedHtml = document.excluded_conditions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const triggersHtml = document.change_order_triggers.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(document.service_label)} Budgetary Pricing Guide</title>
  <style>
    :root {
      --ink: #1f2720;
      --muted: #59635a;
      --line: #d7ddd2;
      --panel: #ffffff;
      --wash: #f4f1e8;
      --warning: #7a3f18;
      --warning-soft: #f6eadf;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, #efe8d9 0%, #f8f6f1 100%);
      color: var(--ink);
      font-family: "Segoe UI", "Trebuchet MS", sans-serif;
      padding: 32px;
    }
    .sheet {
      max-width: 920px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 60px rgba(31, 39, 32, 0.08);
    }
    .hero {
      padding: 28px 32px 22px;
      background:
        radial-gradient(circle at top right, rgba(31, 92, 74, 0.18), transparent 32%),
        linear-gradient(135deg, #173861 0%, #214f40 100%);
      color: #fff;
    }
    .hero-kicker {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .hero-title {
      font-size: 30px;
      line-height: 1.08;
      font-weight: 800;
      margin: 0 0 10px;
    }
    .hero-copy {
      font-size: 15px;
      line-height: 1.5;
      margin: 0;
      max-width: 720px;
      color: rgba(255, 255, 255, 0.88);
    }
    .content {
      padding: 28px 32px 32px;
      display: grid;
      gap: 18px;
      background:
        linear-gradient(180deg, rgba(244, 241, 232, 0.35) 0%, rgba(255, 255, 255, 0) 100%);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px 16px;
      background: #fff;
    }
    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 6px;
      font-weight: 700;
    }
    .metric-value {
      font-size: 20px;
      font-weight: 800;
      line-height: 1.15;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px 20px;
      background: #fff;
    }
    .card h2 {
      margin: 0 0 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
    }
    .summary {
      font-size: 15px;
      line-height: 1.55;
    }
    .modifier-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }
    .modifier {
      border-radius: 14px;
      padding: 12px 14px;
      background: var(--wash);
      border: 1px solid rgba(31, 39, 32, 0.08);
    }
    .modifier strong {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
    }
    ul {
      margin: 0;
      padding-left: 20px;
      line-height: 1.55;
    }
    .warning {
      border-radius: 18px;
      padding: 16px 18px;
      background: var(--warning-soft);
      border: 1px solid rgba(122, 63, 24, 0.16);
      color: var(--warning);
    }
    .footer-note {
      font-size: 13px;
      line-height: 1.55;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="sheet" data-guide-version="${escapeHtml(GUIDE_HTML_VERSION)}">
    <section class="hero">
      <div class="hero-kicker">Planning / Budgetary Only</div>
      <h1 class="hero-title">${escapeHtml(document.service_label)} Budgetary Pricing Guide</h1>
      <p class="hero-copy">${escapeHtml(document.scope_summary)}</p>
    </section>
    <section class="content">
      <div class="grid">
        <div class="metric">
          <div class="metric-label">Property</div>
          <div class="metric-value">${escapeHtml(document.property_summary)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Confidence</div>
          <div class="metric-value">${escapeHtml(document.pricing_confidence)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Price Range</div>
          <div class="metric-value">${escapeHtml(document.price_range_display)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Validity</div>
          <div class="metric-value">${escapeHtml(String(document.validity_window_days))} days</div>
        </div>
      </div>
      <section class="card">
        <h2>Price Basis</h2>
        <div class="summary">${escapeHtml(document.price_basis_summary)}</div>
      </section>
      <section class="card">
        <h2>Assumptions</h2>
        <ul>${assumptionsHtml}</ul>
      </section>
      <section class="card">
        <h2>Modifier Summary</h2>
        <div class="modifier-grid">
          <div class="modifier"><strong>Access</strong>${escapeHtml(document.modifiers_applied.access)}</div>
          <div class="modifier"><strong>Condition</strong>${escapeHtml(document.modifiers_applied.condition)}</div>
          <div class="modifier"><strong>Coordination</strong>${escapeHtml(document.modifiers_applied.coordination)}</div>
          <div class="modifier"><strong>Travel</strong>${escapeHtml(document.modifiers_applied.travel)}</div>
          <div class="modifier"><strong>Efficiency Credit</strong>${escapeHtml(document.modifiers_applied.efficiency_credit)}</div>
        </div>
      </section>
      <section class="card">
        <h2>Excluded Conditions</h2>
        <ul>${excludedHtml}</ul>
      </section>
      <section class="card">
        <h2>Change Triggers</h2>
        <ul>${triggersHtml}</ul>
      </section>
      <section class="warning">
        <strong>Next step:</strong> ${escapeHtml(document.next_step)}
      </section>
      <section class="card">
        <h2>Disclaimer</h2>
        <div class="footer-note">${escapeHtml(document.disclaimer)}</div>
      </section>
    </section>
  </main>
</body>
</html>`;
}

export function buildPricingV1GuideBundle(context = {}) {
  const { assessment, property } = context;
  const derived = derivePricingV1GuideInput(context);
  const resolved = resolvePricingV1({
    assessment,
    property,
    pricing: derived.pricing
  });

  if (resolved.resolution.pricing_intent !== "budgetary_pricing_guide") {
    const blockerSummary = resolved.blockers.quote_block_reasons
      .map((reason) => reason.message)
      .join(" ");
    const missingSummary = resolved.completeness.missing_required_inputs.length
      ? `Missing required inputs: ${resolved.completeness.missing_required_inputs.join(", ")}.`
      : "";
    const text =
      resolved.resolution.pricing_intent === "ballpark"
        ? `Ballpark only. Do not send a forwardable pricing guide yet. ${missingSummary}`.trim()
        : `Formal quote required. ${blockerSummary} ${missingSummary}`.trim();

    return {
      derived_input: derived.pricing,
      inferred_fields: derived.inferred_fields,
      resolution: resolved.resolution,
      completeness: resolved.completeness,
      blockers: resolved.blockers,
      document: null,
      html: "",
      text,
      file_name: `${slugify(property?.property_name)}-pricing-guide.html`
    };
  }

  const pricingPlan = buildPricingPlan(resolved.input);
  const serviceConfig = pricingPlan.config;
  const addressLabel = formatAddress(property);
  const propertyLabel = [normalizeText(property?.property_name), addressLabel].filter(Boolean).join(" | ");
  const scopeSummary = `${pricingPlan.quantity} ${serviceConfig.basis_unit_label}${
    pricingPlan.quantity === 1 ? "" : "s"
  } requested now with ${GROUPED_SCOPE_LABELS[resolved.input.grouped_scope] || "current batch assumptions"} and ${
    ACCESS_LABELS[resolved.input.service_access_type] || "current access assumptions"
  }.`;
  const assumptions = buildAssumptions({
    resolvedInput: resolved.input,
    resolution: resolved.resolution,
    inferredFields: derived.inferred_fields
  });
  const disclaimer =
    "Pricing is based on observed conditions and stated assumptions. Final pricing may change if access, count, configuration, contamination, or corrective scope differs from what was observed or stated. This is planning/budgetary pricing and not a final approval-ready quote unless explicitly converted.";

  const document = {
    document_type: "budgetary_pricing_guide",
    service_type: resolved.input.service_type,
    service_label: SERVICE_LABELS[resolved.input.service_type] || "Service",
    pricing_confidence: resolved.resolution.pricing_confidence,
    property_summary: propertyLabel || "Property summary not available",
    scope_summary: scopeSummary,
    assumptions,
    modifiers_applied: pricingPlan.modifiers_applied,
    price_basis_summary: `Modeled from ${pricingPlan.quantity} ${serviceConfig.basis_unit_label}${
      pricingPlan.quantity === 1 ? "" : "s"
    } at a base planning rate of ${pricingPlan.per_unit_range_display}. Base subtotal ${pricingPlan.base_range_display}, then adjusted for access, condition, coordination, travel, and batching. ${
      pricingPlan.minimum_applied ? "Minimum job logic is protecting this scope." : ""
    }`.trim(),
    price_range_display: pricingPlan.estimate_range_display,
    excluded_conditions: serviceConfig.excluded_conditions,
    change_order_triggers: buildChangeTriggers(resolved.input.service_type),
    validity_window_days:
      serviceConfig.validity_window_days || PRICING_V1_INTERNAL_CONFIG.shared.validity_window_days,
    next_step:
      resolved.resolution.pricing_confidence === "high"
        ? "Confirm final count and approval path, then convert this guide into a formal quote if the customer wants approval-ready pricing."
        : "Use this as a forwardable planning guide, then confirm the remaining unknowns before converting it into a formal quote.",
    disclaimer
  };
  const html = renderBudgetaryPricingGuideHtml(document);
  const text = buildGuideText(document);

  return {
    derived_input: derived.pricing,
    inferred_fields: derived.inferred_fields,
    resolution: resolved.resolution,
    completeness: resolved.completeness,
    blockers: resolved.blockers,
    pricing_plan: pricingPlan,
    document,
    html,
    text,
    file_name: `${slugify(property?.property_name)}-${slugify(document.service_label)}-budgetary-guide.html`
  };
}
