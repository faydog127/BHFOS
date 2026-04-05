import { createId } from "./uuid";
import { clonePricingV1, createEmptyPricingV1 } from "./pricingV1";

export const ASSESSMENT_FIELDS = [
  "scout_mode",
  "scout_type",
  "gut_feel_score",
  "on_site_office_visible",
  "leasing_activity_visible",
  "maintenance_presence_visible",
  "management_quality_signal",
  "exterior_condition",
  "access_ease",
  "building_height",
  "termination_type",
  "access_constraints",
  "access_difficulty",
  "service_fit",
  "entry_path",
  "partner_potential",
  "follow_up_priority",
  "problem_score",
  "access_score",
  "leverage_score",
  "momentum_score",
  "total_score",
  "hazard_severity",
  "hazard_prevalence",
  "hazard_maintenance_gap",
  "hazard_engagement_path",
  "hazard_total",
  "hazard_primary_angle",
  "confidence_level",
  "hook",
  "hook_observation",
  "hook_impact",
  "hook_ask",
  "disqualified",
  "disqualifier_reasons",
  "next_action_owner",
  "next_action_type",
  "next_action_due",
  "next_action_notes",
  "opportunity_notes",
  "risk_or_barrier_notes",
  "general_notes",
  "pricing_v1"
];

const HOOK_PREFIXES = {
  hook_observation: /^Observation:\s*/i,
  hook_impact: /^Impact:\s*/i,
  hook_ask: /^Ask:\s*/i
};

export function parseHookFields(hook) {
  const text = String(hook || "").trim();
  const empty = {
    hook_observation: "",
    hook_impact: "",
    hook_ask: ""
  };
  if (!text) return empty;

  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = { ...empty };
  let matched = false;

  lines.forEach((line) => {
    if (HOOK_PREFIXES.hook_observation.test(line)) {
      parsed.hook_observation = line.replace(HOOK_PREFIXES.hook_observation, "").trim();
      matched = true;
      return;
    }
    if (HOOK_PREFIXES.hook_impact.test(line)) {
      parsed.hook_impact = line.replace(HOOK_PREFIXES.hook_impact, "").trim();
      matched = true;
      return;
    }
    if (HOOK_PREFIXES.hook_ask.test(line)) {
      parsed.hook_ask = line.replace(HOOK_PREFIXES.hook_ask, "").trim();
      matched = true;
    }
  });

  if (matched) return parsed;

  const arrowParts = text
    .split(/\s*(?:->|=>|>|→)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);
  if (arrowParts.length >= 3) {
    return {
      hook_observation: arrowParts[0] || "",
      hook_impact: arrowParts[1] || "",
      hook_ask: arrowParts.slice(2).join(" ") || ""
    };
  }

  return {
    hook_observation: text,
    hook_impact: "",
    hook_ask: ""
  };
}

export function composeHookText(assessment) {
  const parts = [
    ["Observation", assessment?.hook_observation],
    ["Impact", assessment?.hook_impact],
    ["Ask", assessment?.hook_ask]
  ]
    .map(([label, value]) => [label, String(value || "").trim()])
    .filter(([, value]) => value);

  return parts.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export function normalizeAssessmentHooks(assessment) {
  if (!assessment) return assessment;
  const parsed = parseHookFields(assessment.hook);
  return {
    ...assessment,
    hook_observation: assessment.hook_observation || parsed.hook_observation,
    hook_impact: assessment.hook_impact || parsed.hook_impact,
    hook_ask: assessment.hook_ask || parsed.hook_ask
  };
}

export function createEmptyAssessment(propertyId, mode) {
  const normalizedMode = mode === "full" ? "full" : "quick";
  return {
    id: createId(),
    property_id: propertyId,
    scout_mode: normalizedMode,
    scout_type: "",
    gut_feel_score: null,
    on_site_office_visible: null,
    leasing_activity_visible: null,
    maintenance_presence_visible: null,
    management_quality_signal: "",
    exterior_condition: "",
    access_ease: "",
    building_height: "",
    termination_type: "",
    access_constraints: "",
    access_difficulty: "",
    service_fit: "",
    entry_path: "",
    partner_potential: "",
    follow_up_priority: "",
    problem_score: 0,
    access_score: 0,
    leverage_score: 0,
    momentum_score: 0,
    total_score: 0,
    hazard_severity: 0,
    hazard_prevalence: 0,
    hazard_maintenance_gap: 0,
    hazard_engagement_path: 0,
    hazard_total: 0,
    hazard_primary_angle: "watch",
    confidence_level: "low",
    hook: "",
    hook_observation: "",
    hook_impact: "",
    hook_ask: "",
    disqualified: false,
    disqualifier_reasons: [],
    next_action_owner: "",
    next_action_type: "",
    next_action_due: "",
    next_action_notes: "",
    opportunity_notes: "",
    risk_or_barrier_notes: "",
    general_notes: "",
    pricing_v1: createEmptyPricingV1(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function cloneAssessment(base, propertyId, modeOverride) {
  const cloned = createEmptyAssessment(propertyId, modeOverride || base.scout_mode || "quick");
  ASSESSMENT_FIELDS.forEach((field) => {
    if (field in base) {
      cloned[field] = field === "pricing_v1" ? clonePricingV1(base[field]) : base[field];
    }
  });
  const normalized = normalizeAssessmentHooks(cloned);
  normalized.hook = composeHookText(normalized);
  return normalized;
}
