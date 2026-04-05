import { computeHazardTotal } from "./hazardScore.js";

export const SPEED_MODE_CONTRACT_VERSION = "speed_mode_resolver.v1";

export const SPEED_MODE_REQUIRED_FIELDS = [
  "property_type",
  "scope_band",
  "access",
  "confidence",
  "visible_condition"
];

export const SPEED_MODE_OPTION_DEFAULTS = {
  proof_available: null,
  proof_strength: null,
  decision_maker_present: null,
  managed_scope_credible: "no",
  entry_option_safe: null,
  internal_review_flag: "no"
};

export const SPEED_MODE_ENUMS = {
  property_type: [
    "garden-style",
    "mid-rise",
    "high-rise",
    "single-site commercial",
    "other_internal"
  ],
  scope_band: ["1-10", "11-25", "26-50", "51-100", "100+"],
  access: ["easy", "mixed", "difficult", "unknown"],
  confidence: ["low", "medium", "high"],
  visible_condition: ["low", "moderate", "heavy", "hazardous", "unknown"],
  proof_available: ["yes", "no", null],
  proof_strength: ["weak", "moderate", "strong", null],
  decision_maker_present: ["yes", "no", null],
  managed_scope_credible: ["yes", "no", null],
  entry_option_safe: ["yes", "no", null],
  internal_review_flag: ["yes", "no", null]
};

export const SPEED_MODE_UI_OPTIONS = {
  property_type: [
    { value: "garden-style", label: "Garden-Style", helper: "Standard multifamily layout" },
    { value: "mid-rise", label: "Mid-Rise", helper: "Moderate labor and access" },
    { value: "high-rise", label: "High-Rise", helper: "Complex labor and access" },
    {
      value: "single-site commercial",
      label: "Commercial",
      helper: "Single-site commercial scope"
    }
  ],
  scope_band: [
    { value: "1-10", label: "1-10" },
    { value: "11-25", label: "11-25" },
    { value: "26-50", label: "26-50" },
    { value: "51-100", label: "51-100" },
    { value: "100+", label: "100+" }
  ],
  access: [
    { value: "easy", label: "Easy" },
    { value: "mixed", label: "Mixed" },
    { value: "difficult", label: "Difficult" },
    { value: "unknown", label: "Unknown" }
  ],
  confidence: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" }
  ],
  visible_condition: [
    { value: "low", label: "Low", helper: "Light visible condition" },
    { value: "moderate", label: "Moderate", helper: "Meaningful maintenance scope" },
    { value: "heavy", label: "Heavy", helper: "Likely beyond a surface issue" },
    { value: "hazardous", label: "Hazardous", helper: "Risk or corrective condition" },
    { value: "unknown", label: "Unknown", helper: "Need stronger field visibility" }
  ]
};

export const SPEED_MODE_STATUS_LABELS = {
  do_not_price_secure_access: "Do Not Price - Secure Access First",
  range_only_qualify: "Range Only - Qualify Before Advancing",
  present_range_book_walkthrough: "Present Range + Book Walkthrough",
  deliver_estimate_ask_approval: "Deliver Estimate + Ask For Approval",
  escalate_internal: "Escalate Internally Before Pricing"
};

export const SPEED_MODE_PRICE_POSTURE_LABELS = {
  no_pricing_yet: "No pricing yet",
  soft_range_only: "Soft range only",
  budgetary_range: "Budgetary range",
  estimate_ready: "Estimate ready",
  internal_review_required_before_pricing: "Internal review required before pricing"
};

export const SPEED_MODE_STRATEGY_LABELS = {
  no_pricing_strategy: "No Pricing Strategy Active",
  urgency_safety: "Urgency / Safety Angle",
  bundle_portfolio: "Bundle / Portfolio Angle",
  anchor_high_phased: "Anchor High + Phased Option",
  test_close_small_section: "Test Close / Small First Section"
};

export const SPEED_MODE_STATUS_TONES = {
  do_not_price_secure_access: "blocked",
  range_only_qualify: "range-only",
  present_range_book_walkthrough: "budgetary",
  deliver_estimate_ask_approval: "ready",
  escalate_internal: "blocked"
};

const STATUS_RULES = [
  { id: "E1", status_key: "escalate_internal", match: (flags) => flags.condition_hazardous && flags.access_hard },
  { id: "E2", status_key: "escalate_internal", match: (flags) => flags.condition_hazardous && flags.scope_large },
  { id: "E3", status_key: "escalate_internal", match: (flags) => flags.condition_hazardous && flags.property_complex },
  {
    id: "E4",
    status_key: "escalate_internal",
    match: (flags) => flags.access_hard && flags.scope_massive && !flags.confidence_high
  },
  {
    id: "E5",
    status_key: "escalate_internal",
    match: (flags, input) =>
      input.property_type === "high-rise" &&
      flags.access_hard &&
      (flags.condition_heavy || flags.condition_hazardous)
  },
  {
    id: "E6",
    status_key: "escalate_internal",
    match: (flags, input) =>
      input.property_type === "single-site commercial" &&
      flags.access_hard &&
      (flags.condition_heavy || flags.condition_hazardous)
  },
  { id: "D1", status_key: "do_not_price_secure_access", match: (flags) => flags.confidence_low && flags.access_unknown },
  { id: "D2", status_key: "do_not_price_secure_access", match: (flags) => flags.confidence_low && flags.scope_massive },
  { id: "D3", status_key: "do_not_price_secure_access", match: (flags) => flags.confidence_low && flags.access_hard },
  { id: "D4", status_key: "do_not_price_secure_access", match: (flags) => flags.confidence_low && flags.condition_unknown },
  {
    id: "R1",
    status_key: "range_only_qualify",
    match: (flags) =>
      flags.confidence_low &&
      (flags.access_clear || flags.access_partial) &&
      (flags.condition_low || flags.condition_moderate || flags.condition_heavy) &&
      !flags.scope_massive
  },
  { id: "R2", status_key: "range_only_qualify", match: (flags) => flags.confidence_medium && flags.access_unknown },
  {
    id: "R3",
    status_key: "range_only_qualify",
    match: (flags) => flags.confidence_medium && flags.condition_unknown && (flags.access_clear || flags.access_partial)
  },
  {
    id: "R4",
    status_key: "range_only_qualify",
    match: (flags) =>
      flags.confidence_medium &&
      flags.scope_large &&
      (flags.access_clear || flags.access_partial) &&
      !flags.condition_hazardous
  },
  { id: "R5", status_key: "range_only_qualify", match: (flags) => flags.confidence_high && flags.condition_unknown },
  {
    id: "P1",
    status_key: "present_range_book_walkthrough",
    match: (flags) =>
      flags.confidence_medium &&
      (flags.access_clear || flags.access_partial) &&
      (flags.condition_low || flags.condition_moderate || flags.condition_heavy) &&
      !flags.scope_large
  },
  {
    id: "P2",
    status_key: "present_range_book_walkthrough",
    match: (flags) =>
      flags.confidence_high &&
      flags.access_partial &&
      (flags.condition_low || flags.condition_moderate || flags.condition_heavy) &&
      !flags.scope_massive
  },
  {
    id: "P3",
    status_key: "present_range_book_walkthrough",
    match: (flags) =>
      flags.confidence_high && flags.access_clear && flags.condition_heavy && flags.scope_medium && flags.property_standard
  },
  {
    id: "P4",
    status_key: "present_range_book_walkthrough",
    match: (flags) =>
      flags.confidence_high &&
      flags.access_clear &&
      (flags.condition_low || flags.condition_moderate) &&
      flags.scope_large &&
      flags.property_standard
  },
  {
    id: "P5",
    status_key: "present_range_book_walkthrough",
    match: (flags) =>
      flags.confidence_high &&
      flags.access_clear &&
      flags.condition_hazardous &&
      flags.scope_small &&
      flags.property_standard
  },
  {
    id: "Q1",
    status_key: "deliver_estimate_ask_approval",
    match: (flags) =>
      flags.confidence_high &&
      flags.access_clear &&
      (flags.condition_low || flags.condition_moderate) &&
      (flags.scope_small || flags.scope_medium) &&
      flags.property_standard
  },
  {
    id: "Q2",
    status_key: "deliver_estimate_ask_approval",
    match: (flags) =>
      flags.confidence_high && flags.access_clear && flags.condition_heavy && flags.scope_small && flags.property_standard
  },
  {
    id: "Q3",
    status_key: "deliver_estimate_ask_approval",
    match: (flags, input) =>
      flags.confidence_high &&
      flags.access_partial &&
      (flags.condition_low || flags.condition_moderate) &&
      flags.scope_small &&
      input.property_type === "garden-style"
  }
];

const STATUS_PAYLOADS = {
  escalate_internal: {
    status_label: SPEED_MODE_STATUS_LABELS.escalate_internal,
    action_command: "Route internally before pricing. Confirm the review path and stakeholders now.",
    risk_warning: "Hazard, access, or complexity makes field pricing unsafe.",
    price_posture: "internal_review_required_before_pricing",
    primary_close_ask_key: "escalate_primary",
    backup_close_ask_key: "escalate_backup"
  },
  do_not_price_secure_access: {
    status_label: SPEED_MODE_STATUS_LABELS.do_not_price_secure_access,
    action_command: "Do not give pricing. Secure access and verify scope first.",
    risk_warning: "Scope is too uncertain for any reliable number.",
    price_posture: "no_pricing_yet",
    primary_close_ask_key: "secure_access_primary",
    backup_close_ask_key: "secure_access_backup"
  },
  range_only_qualify: {
    status_label: SPEED_MODE_STATUS_LABELS.range_only_qualify,
    action_command: "Use soft range language only and qualify the next step.",
    risk_warning: "Use range language only. Do not imply confirmed count or scope.",
    price_posture: "soft_range_only",
    primary_close_ask_key: "range_only_primary",
    backup_close_ask_key: "range_only_backup"
  },
  present_range_book_walkthrough: {
    status_label: SPEED_MODE_STATUS_LABELS.present_range_book_walkthrough,
    action_command: "Use a budgetary range to move toward a walkthrough.",
    risk_warning: "Do not imply final scope is fully confirmed.",
    price_posture: "budgetary_range",
    primary_close_ask_key: "book_walkthrough_primary",
    backup_close_ask_key: "book_walkthrough_backup"
  },
  deliver_estimate_ask_approval: {
    status_label: SPEED_MODE_STATUS_LABELS.deliver_estimate_ask_approval,
    action_command: "Deliver estimate posture and ask for the approval path.",
    risk_warning: "Hazard, access, or scope modifiers can still affect final margin if new facts appear.",
    price_posture: "estimate_ready",
    primary_close_ask_key: "approval_primary",
    backup_close_ask_key: "approval_backup"
  }
};

const FORCED_LANGUAGE_RULES = [
  { id: "FL1", match: (flags) => flags.access_unknown, phrase: "subject to access verification" },
  { id: "FL2", match: (flags) => flags.confidence_low, phrase: "based on limited field visibility" },
  {
    id: "FL3",
    match: (flags) => flags.scope_large && !flags.confidence_high,
    phrase: "range only until scope is confirmed"
  },
  {
    id: "FL4",
    match: (flags) => flags.condition_hazardous,
    phrase: "this may require full-scope review before pricing"
  }
];

const WARNING_FLAG_RULES = [
  {
    id: "WF1",
    match: (flags, input) => input.property_type === "high-rise",
    message: "Building complexity may understate labor and access requirements."
  },
  {
    id: "WF2",
    match: (flags) => flags.access_partial,
    message: "Range should account for uneven access conditions."
  },
  {
    id: "WF3",
    match: (flags) => flags.condition_heavy,
    message: "Visible condition may indicate deeper scope than surface observation suggests."
  }
];

function normalizeValue(value) {
  return value == null ? null : String(value).trim();
}

function normalizeOptionalFlag(value, fallback) {
  if (value == null || value === "") return fallback;
  return value;
}

function getInvalidEnumError(field, allowed) {
  return {
    field,
    code: "invalid_enum",
    message: `${field} must be one of: ${allowed.filter((item) => item !== null).join(", ")}`
  };
}

function buildFlags(input) {
  return {
    scope_small: input.scope_band === "1-10" || input.scope_band === "11-25",
    scope_medium: input.scope_band === "26-50",
    scope_large: input.scope_band === "51-100" || input.scope_band === "100+",
    scope_massive: input.scope_band === "100+",
    access_clear: input.access === "easy",
    access_partial: input.access === "mixed",
    access_hard: input.access === "difficult",
    access_unknown: input.access === "unknown",
    confidence_low: input.confidence === "low",
    confidence_medium: input.confidence === "medium",
    confidence_high: input.confidence === "high",
    condition_low: input.visible_condition === "low",
    condition_moderate: input.visible_condition === "moderate",
    condition_heavy: input.visible_condition === "heavy",
    condition_hazardous: input.visible_condition === "hazardous",
    condition_unknown: input.visible_condition === "unknown",
    property_complex:
      input.property_type === "high-rise" ||
      input.property_type === "single-site commercial" ||
      input.property_type === "other_internal",
    property_standard: input.property_type === "garden-style" || input.property_type === "mid-rise"
  };
}

function resolveStatus(input, flags) {
  for (const rule of STATUS_RULES) {
    if (rule.match(flags, input)) {
      return {
        status_key: rule.status_key,
        matched_rule_id: rule.id,
        resolution_source: "rule",
        fallback_logged: false
      };
    }
  }

  if ((flags.confidence_medium || flags.confidence_high) && !flags.access_unknown && !flags.condition_unknown) {
    return {
      status_key: "present_range_book_walkthrough",
      matched_rule_id: "F1",
      resolution_source: "fallback",
      fallback_logged: true
    };
  }

  return {
    status_key: "range_only_qualify",
    matched_rule_id: "F2",
    resolution_source: "fallback",
    fallback_logged: true
  };
}

function applyHardBlocks(input, flags, resolution) {
  const hardBlocks = [];
  let finalStatusKey = resolution.status_key;
  let downgradedFromStatusKey = null;
  const downgradeReasonIds = [];

  if (flags.confidence_low && flags.access_unknown) {
    hardBlocks.push("HB1");
  }
  if (flags.condition_hazardous) {
    hardBlocks.push("HB2");
  }
  if (flags.scope_massive && !flags.confidence_high) {
    hardBlocks.push("HB3");
    if (finalStatusKey === "deliver_estimate_ask_approval") {
      downgradedFromStatusKey = finalStatusKey;
      finalStatusKey = "present_range_book_walkthrough";
      downgradeReasonIds.push("HB3");
    }
  }
  if (flags.access_hard && !flags.confidence_high) {
    hardBlocks.push("HB4");
    if (finalStatusKey === "deliver_estimate_ask_approval") {
      downgradedFromStatusKey = finalStatusKey;
      finalStatusKey = "present_range_book_walkthrough";
      downgradeReasonIds.push("HB4");
    }
  }

  return {
    finalStatusKey,
    downgradedFromStatusKey,
    downgradeReasonIds,
    appliedHardBlocks: Array.from(new Set(hardBlocks))
  };
}

function buildActionPayload(statusKey, input, flags) {
  const payload = STATUS_PAYLOADS[statusKey];
  return {
    action_command: payload.action_command,
    risk_warning: payload.risk_warning,
    price_posture: payload.price_posture,
    copy_policy: {
      allow_pricing: statusKey !== "do_not_price_secure_access" && statusKey !== "escalate_internal",
      allow_final_price_language: statusKey === "deliver_estimate_ask_approval",
      must_use_range_language:
        statusKey === "range_only_qualify" || statusKey === "present_range_book_walkthrough",
      must_reference_access_verification: flags.access_unknown,
      must_reference_internal_review: statusKey === "escalate_internal",
      allow_partial_scope_language:
        input.visible_condition !== "hazardous" && statusKey !== "escalate_internal",
      allow_phased_language: false
    }
  };
}

function buildOverlays(flags, input) {
  const forced = FORCED_LANGUAGE_RULES.filter((rule) => rule.match(flags));
  const warnings = WARNING_FLAG_RULES.filter((rule) => rule.match(flags, input));
  return {
    applied_hard_blocks: [],
    applied_forced_language_ids: forced.map((rule) => rule.id),
    applied_forced_phrases: forced.map((rule) => rule.phrase),
    applied_warning_flag_ids: warnings.map((rule) => rule.id).slice(0, 3),
    applied_warning_messages: warnings.map((rule) => rule.message).slice(0, 3)
  };
}

function getAllowedStrategies(statusKey, input) {
  switch (statusKey) {
    case "escalate_internal":
      return input.visible_condition === "hazardous"
        ? ["urgency_safety", "no_pricing_strategy"]
        : ["no_pricing_strategy"];
    case "do_not_price_secure_access":
      return ["no_pricing_strategy"];
    case "range_only_qualify":
      return ["anchor_high_phased", "bundle_portfolio", "test_close_small_section", "no_pricing_strategy"];
    case "present_range_book_walkthrough":
      return ["anchor_high_phased", "bundle_portfolio", "urgency_safety", "test_close_small_section"];
    case "deliver_estimate_ask_approval":
      return ["anchor_high_phased", "bundle_portfolio", "urgency_safety"];
    default:
      return ["no_pricing_strategy"];
  }
}

function resolvePricing(input, flags, statusKey, actionPayload) {
  const allowedStrategies = getAllowedStrategies(statusKey, input);
  const strategyAllowed = (key) => allowedStrategies.includes(key);
  const managedScopeCredible =
    input.managed_scope_credible === "yes" ||
    flags.scope_large ||
    (flags.property_standard && (flags.scope_medium || flags.scope_large));

  let strategyKey = "no_pricing_strategy";
  let matchedStrategyRuleId = "SF2";

  if (statusKey === "do_not_price_secure_access" || actionPayload.price_posture === "no_pricing_yet") {
    strategyKey = "no_pricing_strategy";
    matchedStrategyRuleId = "S1";
  } else if (
    input.visible_condition === "hazardous" &&
    strategyAllowed("urgency_safety") &&
    ["escalate_internal", "present_range_book_walkthrough", "deliver_estimate_ask_approval"].includes(statusKey)
  ) {
    strategyKey = "urgency_safety";
    matchedStrategyRuleId = "S2";
  } else if (
    strategyAllowed("bundle_portfolio") &&
    managedScopeCredible &&
    ["range_only_qualify", "present_range_book_walkthrough", "deliver_estimate_ask_approval"].includes(statusKey)
  ) {
    strategyKey = "bundle_portfolio";
    matchedStrategyRuleId = "S3";
  } else if (
    strategyAllowed("anchor_high_phased") &&
    ["present_range_book_walkthrough", "deliver_estimate_ask_approval"].includes(statusKey)
  ) {
    strategyKey = "anchor_high_phased";
    matchedStrategyRuleId = "S4";
  } else if (
    strategyAllowed("test_close_small_section") &&
    flags.scope_small &&
    ["range_only_qualify", "present_range_book_walkthrough"].includes(statusKey) &&
    input.visible_condition !== "hazardous" &&
    input.entry_option_safe !== "no"
  ) {
    strategyKey = "test_close_small_section";
    matchedStrategyRuleId = "S5";
  } else if (
    ["present_range_book_walkthrough", "deliver_estimate_ask_approval"].includes(statusKey) &&
    strategyAllowed("anchor_high_phased")
  ) {
    strategyKey = "anchor_high_phased";
    matchedStrategyRuleId = "SF1";
  }

  const suppressionReasonIds = [];
  if (statusKey === "escalate_internal") suppressionReasonIds.push("EOS4");
  if (input.visible_condition === "hazardous") suppressionReasonIds.push("EOS1");
  if (input.entry_option_safe === "no") suppressionReasonIds.push("EOS2");
  if (input.access === "difficult" && strategyKey === "test_close_small_section") suppressionReasonIds.push("EOS2");

  const entryOptionSuppressed = suppressionReasonIds.length > 0;
  const entryOptionAllowed = !entryOptionSuppressed && strategyKey !== "no_pricing_strategy";
  const priceDisplayModeMap = {
    no_pricing_yet: "no_price",
    soft_range_only: "soft_range",
    budgetary_range: "budgetary_range",
    estimate_ready: "estimate_ready",
    internal_review_required_before_pricing: "no_price"
  };

  const pricingMap = {
    no_pricing_strategy: {
      anchor_structure: "Not shown until scope is verified.",
      entry_option_structure: entryOptionSuppressed
        ? "Entry option suppressed until verification or review is complete."
        : "Not shown.",
      close_path: "Secure access, verify scope, and confirm the review path before pricing."
    },
    urgency_safety: {
      anchor_structure: "Frame the full-scope corrective path first.",
      entry_option_structure: entryOptionSuppressed
        ? "Entry option suppressed because partial framing could understate the issue."
        : "Use only the fastest valid containment or first corrective phase.",
      close_path: "Use risk-backed language to move this toward prompt review or corrective action."
    },
    bundle_portfolio: {
      anchor_structure: "Frame the current site with repeatable, broader-scope value.",
      entry_option_structure: entryOptionSuppressed
        ? "Entry option suppressed until the scope can be represented honestly."
        : "Start with this site or first building, then expand if results hold.",
      close_path: "Prove the first section, then expand across the broader scope."
    },
    anchor_high_phased: {
      anchor_structure: "Lead with the full-scope range first.",
      entry_option_structure: entryOptionSuppressed
        ? "Phase language is suppressed until the full issue can be framed safely."
        : "Offer a valid first phase only if that helps approval move faster.",
      close_path: "Anchor the full scope, then phase execution without shrinking the issue."
    },
    test_close_small_section: {
      anchor_structure: "Show the full job as the reference point.",
      entry_option_structure: entryOptionSuppressed
        ? "Small-first framing is suppressed because it would mislead the customer."
        : "Use a smaller first section to reduce friction without calling it the full fix.",
      close_path: "Start small to validate the path, then expand once performance is proven."
    }
  };

  actionPayload.copy_policy.allow_phased_language =
    !entryOptionSuppressed &&
    (strategyKey === "anchor_high_phased" || strategyKey === "bundle_portfolio");

  return {
    strategy_key: strategyKey,
    strategy_label: SPEED_MODE_STRATEGY_LABELS[strategyKey],
    matched_strategy_rule_id: matchedStrategyRuleId,
    price_display_mode: priceDisplayModeMap[actionPayload.price_posture] || "no_price",
    anchor_structure: pricingMap[strategyKey].anchor_structure,
    entry_option_structure: pricingMap[strategyKey].entry_option_structure,
    close_path: pricingMap[strategyKey].close_path,
    entry_option_allowed: entryOptionAllowed,
    entry_option_suppressed: entryOptionSuppressed,
    entry_option_suppression_reason_ids: Array.from(new Set(suppressionReasonIds))
  };
}

function buildProofPayload(input, flags, statusKey, strategyKey) {
  const proofRequired =
    input.visible_condition === "heavy" ||
    input.visible_condition === "hazardous" ||
    input.access === "difficult" ||
    statusKey === "escalate_internal";
  const proofRecommended =
    statusKey === "present_range_book_walkthrough" ||
    strategyKey === "urgency_safety" ||
    strategyKey === "bundle_portfolio";
  const priorityOrder = [];
  const pushPriority = (value) => {
    if (!priorityOrder.includes(value)) priorityOrder.push(value);
  };

  if (input.visible_condition === "hazardous") {
    pushPriority("hazard_photo");
    pushPriority("blocked_termination_photo");
  } else if (input.visible_condition === "heavy") {
    pushPriority("blocked_termination_photo");
    pushPriority("repeated_condition_photo");
  } else if (input.visible_condition === "moderate") {
    pushPriority("repeated_condition_photo");
  }
  if (input.access === "difficult" || input.access === "unknown") {
    pushPriority("access_limitation_photo");
  }
  if (flags.scope_large || strategyKey === "bundle_portfolio") {
    pushPriority("count_or_scale_photo");
  }
  pushPriority("rep_observation_tag");

  return {
    proof_required: proofRequired,
    proof_recommended: proofRecommended,
    max_slots: 2,
    auto_select: true,
    override_allowed: true,
    priority_order: priorityOrder,
    empty_state_message: "No proof attached - rely on range/verification language only"
  };
}

function buildClosePayload(statusKey) {
  const payload = STATUS_PAYLOADS[statusKey];
  return {
    primary_close_ask_key: payload.primary_close_ask_key,
    backup_close_ask_key: payload.backup_close_ask_key
  };
}

function buildHandoffPayload(input, flags, statusKey, proofPayload) {
  if (statusKey === "escalate_internal" || input.internal_review_flag === "yes") {
    return {
      controlled_mode_eligible: false,
      internal_review_required: true,
      handoff_target: "internal_review",
      handoff_reason_ids: Array.from(
        new Set([
          statusKey === "escalate_internal" ? "HI1" : null,
          flags.property_complex ? "HI2" : null,
          input.internal_review_flag === "yes" ? "HI3" : null
        ].filter(Boolean))
      )
    };
  }

  if (statusKey === "deliver_estimate_ask_approval") {
    return {
      controlled_mode_eligible: true,
      internal_review_required: false,
      handoff_target: "controlled_mode",
      handoff_reason_ids: Array.from(
        new Set([
          "HM1",
          input.decision_maker_present === "no" ? "HM5" : null,
          proofPayload.proof_recommended ? "HM3" : null
        ].filter(Boolean))
      )
    };
  }

  if (statusKey === "present_range_book_walkthrough") {
    return {
      controlled_mode_eligible: true,
      internal_review_required: false,
      handoff_target: "controlled_mode",
      handoff_reason_ids: Array.from(new Set(["HM4", proofPayload.proof_recommended ? "HM3" : null].filter(Boolean)))
    };
  }

  return {
    controlled_mode_eligible: false,
    internal_review_required: false,
    handoff_target: "none",
    handoff_reason_ids: []
  };
}

export function validateSpeedModeRequest(rawInput) {
  const input = {
    property_type: normalizeValue(rawInput?.property_type),
    scope_band: normalizeValue(rawInput?.scope_band),
    access: normalizeValue(rawInput?.access),
    confidence: normalizeValue(rawInput?.confidence),
    visible_condition: normalizeValue(rawInput?.visible_condition),
    proof_available: normalizeOptionalFlag(rawInput?.proof_available, SPEED_MODE_OPTION_DEFAULTS.proof_available),
    proof_strength: normalizeOptionalFlag(rawInput?.proof_strength, SPEED_MODE_OPTION_DEFAULTS.proof_strength),
    decision_maker_present: normalizeOptionalFlag(
      rawInput?.decision_maker_present,
      SPEED_MODE_OPTION_DEFAULTS.decision_maker_present
    ),
    managed_scope_credible: normalizeOptionalFlag(
      rawInput?.managed_scope_credible,
      SPEED_MODE_OPTION_DEFAULTS.managed_scope_credible
    ),
    entry_option_safe: normalizeOptionalFlag(rawInput?.entry_option_safe, SPEED_MODE_OPTION_DEFAULTS.entry_option_safe),
    internal_review_flag: normalizeOptionalFlag(
      rawInput?.internal_review_flag,
      SPEED_MODE_OPTION_DEFAULTS.internal_review_flag
    )
  };

  const errors = [];
  for (const field of SPEED_MODE_REQUIRED_FIELDS) {
    if (!input[field]) {
      errors.push({ field, code: "required", message: `${field} is required` });
    } else if (!SPEED_MODE_ENUMS[field].includes(input[field])) {
      errors.push(getInvalidEnumError(field, SPEED_MODE_ENUMS[field]));
    }
  }
  for (const field of Object.keys(SPEED_MODE_OPTION_DEFAULTS)) {
    if (!SPEED_MODE_ENUMS[field].includes(input[field])) {
      errors.push(getInvalidEnumError(field, SPEED_MODE_ENUMS[field]));
    }
  }

  return { valid: errors.length === 0, input, errors };
}

export function resolveSpeedMode(rawInput) {
  const validation = validateSpeedModeRequest(rawInput);
  if (!validation.valid) {
    return {
      contract_version: SPEED_MODE_CONTRACT_VERSION,
      valid: false,
      errors: validation.errors
    };
  }

  const input = validation.input;
  const flags = buildFlags(input);
  const initialResolution = resolveStatus(input, flags);
  const hardBlockResult = applyHardBlocks(input, flags, initialResolution);
  const overlays = buildOverlays(flags, input);
  overlays.applied_hard_blocks = hardBlockResult.appliedHardBlocks;

  const statusKey = hardBlockResult.finalStatusKey;
  const actionPayload = buildActionPayload(statusKey, input, flags);
  if (hardBlockResult.appliedHardBlocks.includes("HB1")) {
    actionPayload.price_posture = "no_pricing_yet";
    actionPayload.copy_policy.allow_pricing = false;
    actionPayload.copy_policy.allow_final_price_language = false;
  }

  const pricingPayload = resolvePricing(input, flags, statusKey, actionPayload);
  const proofPayload = buildProofPayload(input, flags, statusKey, pricingPayload.strategy_key);
  const closePayload = buildClosePayload(statusKey);
  const handoffPayload = buildHandoffPayload(input, flags, statusKey, proofPayload);

  return {
    contract_version: SPEED_MODE_CONTRACT_VERSION,
    valid: true,
    input,
    resolution: {
      status_key: statusKey,
      status_label: SPEED_MODE_STATUS_LABELS[statusKey],
      matched_rule_id: initialResolution.matched_rule_id,
      resolution_source: initialResolution.resolution_source,
      fallback_logged: initialResolution.fallback_logged,
      downgraded_from_status_key: hardBlockResult.downgradedFromStatusKey,
      downgrade_reason_ids: hardBlockResult.downgradeReasonIds
    },
    action: actionPayload,
    pricing: pricingPayload,
    proof: proofPayload,
    close: closePayload,
    overlays,
    handoff: handoffPayload,
    permissions: {
      rep_can_override_status: false,
      rep_can_override_strategy: false,
      rep_can_override_proof_selection: true,
      rep_can_edit_copy: true
    }
  };
}

function toScopeBand(value) {
  const count = Number(value) || 0;
  if (count >= 101) return "100+";
  if (count >= 51) return "51-100";
  if (count >= 26) return "26-50";
  if (count >= 11) return "11-25";
  if (count >= 1) return "1-10";
  return "11-25";
}

function inferPropertyType({ assessment, property, estimateInputs }) {
  const height = estimateInputs?.height || assessment?.building_height || "";
  const propertyTypeGuess = `${property?.property_type || ""} ${property?.class_guess || ""} ${property?.property_class || ""}`.toLowerCase();
  if (propertyTypeGuess.includes("commercial")) return "single-site commercial";
  if (height === "4+") return "high-rise";
  if (height === "3") return "mid-rise";
  return "garden-style";
}

function inferVisibleCondition({ assessment, estimateInputs, photos }) {
  const condition = estimateInputs?.condition || "";
  if (condition === "hazard") return "hazardous";
  if (condition === "heavy") return "heavy";

  const hazardTotal = computeHazardTotal(assessment);
  const prominentTag = photos?.[0]?.tag || "";
  if (prominentTag === "safety_hazard" || hazardTotal >= 8) return "hazardous";
  if (prominentTag === "blocked_termination" || hazardTotal >= 5) return "heavy";
  if (prominentTag || hazardTotal >= 2) return "moderate";
  if (assessment) return "low";
  return "unknown";
}

function inferProofStrength(photos = []) {
  if (!photos.length) return "weak";
  const tag = photos[0]?.tag || "";
  if (tag === "safety_hazard" || tag === "blocked_termination") return "strong";
  if (tag === "lint_buildup" || tag === "access_issue") return "moderate";
  return "weak";
}

export function inferSpeedModeInput({ assessment, property, estimateInputs, photos = [] }) {
  const countSeed = Number(estimateInputs?.terminations) || Number(property?.units_est) || 0;
  const propertyType = inferPropertyType({ assessment, property, estimateInputs });
  const scopeBand = toScopeBand(countSeed);
  // Speed Mode `access` is service execution access, not the scouting/commercial `access_score`.
  const accessRaw = estimateInputs?.access || assessment?.access_difficulty || "";
  const access =
    accessRaw === "easy"
      ? "easy"
      : accessRaw === "moderate" || accessRaw === "mixed"
        ? "mixed"
        : accessRaw === "difficult"
          ? "difficult"
          : "unknown";
  const visibleCondition = inferVisibleCondition({ assessment, estimateInputs, photos });
  const proofAvailable = photos.length ? "yes" : "no";
  const decisionMakerPresent =
    assessment?.decision_maker_known && (assessment?.decision_maker_contacted || assessment?.contact_name)
      ? "yes"
      : assessment?.decision_maker_known
        ? "no"
        : "no";

  return {
    property_type: propertyType,
    scope_band: scopeBand,
    access,
    confidence:
      estimateInputs?.ventConfidence === "high" || estimateInputs?.ventConfidence === "medium"
        ? estimateInputs.ventConfidence
        : assessment?.confidence_level === "high" || assessment?.confidence_level === "medium"
          ? assessment.confidence_level
          : "low",
    visible_condition: visibleCondition,
    proof_available: proofAvailable,
    proof_strength: proofAvailable === "yes" ? inferProofStrength(photos) : null,
    decision_maker_present: decisionMakerPresent,
    managed_scope_credible:
      Number(estimateInputs?.buildings) > 1 ||
      Number(property?.units_est) >= 51 ||
      scopeBand === "51-100" ||
      scopeBand === "100+" ||
      (property?.management_group || "").trim()
        ? "yes"
        : "no",
    entry_option_safe: visibleCondition === "hazardous" || access === "difficult" ? "no" : "yes",
    internal_review_flag:
      (propertyType === "high-rise" || propertyType === "single-site commercial") &&
      (visibleCondition === "hazardous" || access === "difficult")
        ? "yes"
        : "no"
  };
}

function classifyPhotoPriority(photo, priorityOrder) {
  const tag = String(photo?.tag || "");
  const tagPriority = {
    hazard_photo: ["safety_hazard", "improper_termination", "damaged_or_missing_cover"],
    blocked_termination_photo: ["blocked_termination", "lint_buildup"],
    access_limitation_photo: ["access_issue"],
    repeated_condition_photo: ["maintenance_signal", "service_gap_evidence", "lint_buildup"],
    count_or_scale_photo: ["count_or_scale", "overview", "property_overview"],
    rep_observation_tag: ["unclear_needs_followup", "clean_or_well_maintained"]
  };
  for (let index = 0; index < priorityOrder.length; index += 1) {
    const key = priorityOrder[index];
    if ((tagPriority[key] || []).includes(tag)) return { key, rank: index };
  }
  return { key: priorityOrder[0] || "rep_observation_tag", rank: priorityOrder.length + 1 };
}

export function buildSpeedModeProofSlots({ photos = [], selectedPhotoIds = [], proof }) {
  const selected = selectedPhotoIds
    .map((id) => photos.find((photo) => photo.id === id))
    .filter(Boolean)
    .slice(0, proof?.max_slots || 2)
    .map((photo) => ({
      photo,
      priority_key: classifyPhotoPriority(photo, proof?.priority_order || []).key
    }));

  if (selected.length >= (proof?.max_slots || 2)) return selected;

  const selectedIds = new Set(selected.map((slot) => slot.photo.id));
  const ranked = photos
    .filter((photo) => !selectedIds.has(photo.id))
    .map((photo) => {
      const match = classifyPhotoPriority(photo, proof?.priority_order || []);
      return {
        photo,
        priority_key: match.key,
        rank: match.rank,
        timestamp: new Date(photo?.timestamp || 0).getTime() || 0
      };
    })
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      return right.timestamp - left.timestamp;
    })
    .slice(0, Math.max((proof?.max_slots || 2) - selected.length, 0))
    .map(({ photo, priority_key }) => ({ photo, priority_key }));

  return [...selected, ...ranked].slice(0, proof?.max_slots || 2);
}
