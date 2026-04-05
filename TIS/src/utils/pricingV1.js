export const PRICING_V1_SCHEMA_VERSION = "pricing_v1";

const YES_NO_UNKNOWN = ["yes", "no", "unknown"];

export const PRICING_V1_ENUMS = {
  pricing_intent: ["ballpark", "budgetary_pricing_guide", "formal_quote_required"],
  pricing_confidence: ["low", "medium", "high"],
  service_type: ["dryer_vent_cleaning", "air_duct_cleaning"],
  grouped_scope: [
    "single_unit",
    "small_scattered_batch",
    "grouped_same_building",
    "stacked_same_building",
    "multi_building_repeatable",
    "full_property_distribution_unclear"
  ],
  occupancy_state: ["vacant", "mixed", "occupied"],
  service_access_type: [
    "interior_only",
    "roof_required",
    "attic_required",
    "crawlspace_required",
    "mixed",
    "unknown"
  ],
  condition_level: ["normal", "moderate", "heavy", "hazardous", "unknown"],
  coordination_burden: ["light", "moderate", "heavy"],
  travel_context: ["standard_local", "remote_or_multi_trip", "special_mobilization"],
  build_era_band: ["pre_1980", "1980_1999", "2000_2014", "2015_plus", "unknown"],
  maintenance_support_level: ["none", "limited", "standard", "strong", "unknown"],
  reporting_detail_requirements: ["none", "basic", "unit_level", "regional_package", "unknown"],
  vent_run_length_band: ["short", "medium", "long", "unknown"],
  maintenance_assisted_access: YES_NO_UNKNOWN,
  layout_consistency: ["standardized", "mixed", "unknown"],
  roof_type: ["shingle", "tile", "metal", "flat", "unknown"],
  duct_type_known: ["flex", "rigid", "semi_rigid", "mixed", "unknown"],
  sqft_band: ["small", "medium", "large", "unknown"],
  system_count_basis: ["single_system_per_unit", "multi_system_unit", "common_area_only", "mixed", "unknown"],
  air_handler_location: ["closet", "attic", "crawlspace", "mixed", "unknown"],
  supply_return_complexity: ["simple", "moderate", "complex", "unknown"],
  duct_material: ["flex", "metal", "ductboard", "mixed", "unknown"],
  contamination_type: ["dust_only", "heavy_debris", "water_affected", "mold_like_or_bio", "unknown"],
  restoration_addons_likely: YES_NO_UNKNOWN
};

export const PRICING_V1_FLAG_ENUMS = {
  technical_issue_flags: [
    "roof_access_required",
    "tile_or_metal_roof",
    "long_run_suspected",
    "blockage_suspected",
    "crushed_or_disconnected_suspected",
    "termination_damage_suspected",
    "mixed_access_types",
    "prior_failed_vendor",
    "bird_guard_or_screen_issue",
    "booster_fan_or_special_hardware",
    "water_intrusion_signs",
    "mold_like_or_bio_contamination",
    "repair_scope_likely",
    "restoration_scope_likely"
  ],
  operational_issue_flags: [
    "escort_required",
    "key_control_required",
    "resident_scheduling_required",
    "occupied_only_workflow",
    "after_hours_only",
    "limited_access_window",
    "parking_or_staging_difficulty",
    "gate_or_checkin_friction",
    "portal_or_po_workflow",
    "net_terms_friction",
    "photo_package_required",
    "unit_log_required",
    "resident_notice_required",
    "maintenance_pre_stage_available"
  ]
};

const normalizeEnum = (value, allowed) => {
  const next = String(value || "").trim();
  return allowed.includes(next) ? next : "";
};

const normalizeNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const toObject = (value) => {
  if (!value) return {};
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return value;
  return {};
};

const normalizeFlagList = (value, allowed) => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  return Array.from(new Set(raw.filter((item) => allowed.includes(item))));
};

export function createEmptyPricingV1() {
  return {
    schema_version: PRICING_V1_SCHEMA_VERSION,
    pricing_intent: "",
    pricing_confidence: "",
    service_type: "",
    units_requested_now: null,
    total_possible_units: null,
    number_of_buildings_in_scope: null,
    grouped_scope: "",
    occupancy_state: "",
    service_access_type: "",
    condition_level: "",
    coordination_burden: "",
    travel_context: "",
    build_era_band: "",
    bedroom_mix: "",
    maintenance_support_level: "",
    reporting_detail_requirements: "",
    technical_issue_flags: [],
    operational_issue_flags: [],
    notes: "",
    photo_count: null,
    dryer_vent: {
      vent_run_length_band: "",
      maintenance_assisted_access: "",
      layout_consistency: "",
      roof_type: "",
      duct_type_known: ""
    },
    air_duct: {
      layout_consistency: "",
      sqft_band: "",
      system_count_basis: "",
      air_handler_location: "",
      supply_return_complexity: "",
      duct_material: "",
      contamination_type: "",
      accessible_returns_count: null,
      restoration_addons_likely: ""
    }
  };
}

export function normalizePricingV1(value) {
  const source = toObject(value);
  const base = createEmptyPricingV1();
  const dryerVent = toObject(source.dryer_vent);
  const airDuct = toObject(source.air_duct);

  return {
    ...base,
    schema_version: PRICING_V1_SCHEMA_VERSION,
    pricing_intent: normalizeEnum(source.pricing_intent, PRICING_V1_ENUMS.pricing_intent),
    pricing_confidence: normalizeEnum(source.pricing_confidence, PRICING_V1_ENUMS.pricing_confidence),
    service_type: normalizeEnum(source.service_type, PRICING_V1_ENUMS.service_type),
    units_requested_now: normalizeNullableNumber(source.units_requested_now),
    total_possible_units: normalizeNullableNumber(source.total_possible_units),
    number_of_buildings_in_scope: normalizeNullableNumber(source.number_of_buildings_in_scope),
    grouped_scope: normalizeEnum(source.grouped_scope, PRICING_V1_ENUMS.grouped_scope),
    occupancy_state: normalizeEnum(source.occupancy_state, PRICING_V1_ENUMS.occupancy_state),
    service_access_type: normalizeEnum(source.service_access_type, PRICING_V1_ENUMS.service_access_type),
    condition_level: normalizeEnum(source.condition_level, PRICING_V1_ENUMS.condition_level),
    coordination_burden: normalizeEnum(source.coordination_burden, PRICING_V1_ENUMS.coordination_burden),
    travel_context: normalizeEnum(source.travel_context, PRICING_V1_ENUMS.travel_context),
    build_era_band: normalizeEnum(source.build_era_band, PRICING_V1_ENUMS.build_era_band),
    bedroom_mix: normalizeText(source.bedroom_mix),
    maintenance_support_level: normalizeEnum(
      source.maintenance_support_level,
      PRICING_V1_ENUMS.maintenance_support_level
    ),
    reporting_detail_requirements: normalizeEnum(
      source.reporting_detail_requirements,
      PRICING_V1_ENUMS.reporting_detail_requirements
    ),
    technical_issue_flags: normalizeFlagList(
      source.technical_issue_flags,
      PRICING_V1_FLAG_ENUMS.technical_issue_flags
    ),
    operational_issue_flags: normalizeFlagList(
      source.operational_issue_flags,
      PRICING_V1_FLAG_ENUMS.operational_issue_flags
    ),
    notes: normalizeText(source.notes),
    photo_count: normalizeNullableNumber(source.photo_count),
    dryer_vent: {
      ...base.dryer_vent,
      vent_run_length_band: normalizeEnum(
        dryerVent.vent_run_length_band,
        PRICING_V1_ENUMS.vent_run_length_band
      ),
      maintenance_assisted_access: normalizeEnum(
        dryerVent.maintenance_assisted_access,
        PRICING_V1_ENUMS.maintenance_assisted_access
      ),
      layout_consistency: normalizeEnum(
        dryerVent.layout_consistency,
        PRICING_V1_ENUMS.layout_consistency
      ),
      roof_type: normalizeEnum(dryerVent.roof_type, PRICING_V1_ENUMS.roof_type),
      duct_type_known: normalizeEnum(dryerVent.duct_type_known, PRICING_V1_ENUMS.duct_type_known)
    },
    air_duct: {
      ...base.air_duct,
      layout_consistency: normalizeEnum(
        airDuct.layout_consistency,
        PRICING_V1_ENUMS.layout_consistency
      ),
      sqft_band: normalizeEnum(airDuct.sqft_band, PRICING_V1_ENUMS.sqft_band),
      system_count_basis: normalizeEnum(
        airDuct.system_count_basis,
        PRICING_V1_ENUMS.system_count_basis
      ),
      air_handler_location: normalizeEnum(
        airDuct.air_handler_location,
        PRICING_V1_ENUMS.air_handler_location
      ),
      supply_return_complexity: normalizeEnum(
        airDuct.supply_return_complexity,
        PRICING_V1_ENUMS.supply_return_complexity
      ),
      duct_material: normalizeEnum(airDuct.duct_material, PRICING_V1_ENUMS.duct_material),
      contamination_type: normalizeEnum(
        airDuct.contamination_type,
        PRICING_V1_ENUMS.contamination_type
      ),
      accessible_returns_count: normalizeNullableNumber(airDuct.accessible_returns_count),
      restoration_addons_likely: normalizeEnum(
        airDuct.restoration_addons_likely,
        PRICING_V1_ENUMS.restoration_addons_likely
      )
    }
  };
}

export function clonePricingV1(value) {
  return normalizePricingV1(value);
}

export function serializePricingV1(value) {
  return JSON.stringify(normalizePricingV1(value));
}
