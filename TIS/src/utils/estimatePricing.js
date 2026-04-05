export const ESTIMATE_PRICING_DEFAULTS = {
  baseLow: 30,
  baseHigh: 40,
  heavyLow: 10,
  heavyHigh: 20,
  hazardLow: 20,
  hazardHigh: 40,
  birdLow: 10,
  birdHigh: 25,
  minJob: 750,
  mobilization: 250,
  smallJobThreshold: 30
};

export function formatMoney(value) {
  return value ? `$${Math.round(value).toLocaleString()}` : "$0";
}

export function formatMoneyRange(low, high) {
  return `${formatMoney(low)}–${formatMoney(high)}`;
}

export function getRepresentativeTerminationsForScopeBand(scopeBand) {
  switch (scopeBand) {
    case "1-10":
      return 8;
    case "11-25":
      return 18;
    case "26-50":
      return 38;
    case "51-100":
      return 75;
    case "100+":
      return 120;
    default:
      return 0;
  }
}

export function getRepresentativeBuildingsForScopeBand(scopeBand) {
  switch (scopeBand) {
    case "1-10":
      return 1;
    case "11-25":
      return 1;
    case "26-50":
      return 2;
    case "51-100":
      return 3;
    case "100+":
      return 5;
    default:
      return 1;
  }
}

function getHeightMultiplier(height) {
  return height === "3" ? 1.25 : height === "4+" ? 1.4 : 1;
}

function normalizeAccess(access) {
  if (access === "moderate" || access === "mixed") return "moderate";
  if (access === "difficult") return "difficult";
  return "easy";
}

function getAccessMultiplier(access) {
  const normalized = normalizeAccess(access);
  return normalized === "difficult" ? 1.25 : normalized === "moderate" ? 1.1 : 1;
}

function normalizeCondition(condition) {
  if (condition === "hazard" || condition === "hazardous") return "hazard";
  if (condition === "heavy") return "heavy";
  return "normal";
}

function buildPhaseRange(pricing, ratio) {
  const boundedRatio = Math.max(0.15, Math.min(ratio, 0.85));
  const low = Math.round(pricing.estimateLow * boundedRatio);
  const high = Math.round(pricing.estimateHigh * boundedRatio);
  return {
    low,
    high,
    label: formatMoneyRange(low, high)
  };
}

export function buildEstimatePricingModel({
  terminations,
  buildings,
  scopeBand,
  height,
  condition,
  access,
  birdGuards,
  travel
}) {
  const normalizedCondition = normalizeCondition(condition);
  const exactTerminations = Number(terminations) || 0;
  const exactBuildings = Number(buildings) || 0;
  const representativeTerminations = getRepresentativeTerminationsForScopeBand(scopeBand);
  const representativeBuildings = getRepresentativeBuildingsForScopeBand(scopeBand);
  const effectiveTerminations = exactTerminations || representativeTerminations;
  const effectiveBuildings = exactBuildings || representativeBuildings;
  const usedRepresentativeScope = !exactTerminations && Boolean(representativeTerminations);

  const heightMultiplier = getHeightMultiplier(height);
  const accessMultiplier = getAccessMultiplier(access);
  const addHeavy = normalizedCondition === "heavy";
  const addHazard = normalizedCondition === "hazard";
  const addBird = Boolean(birdGuards);

  const perVentLow =
    ESTIMATE_PRICING_DEFAULTS.baseLow +
    (addHeavy ? ESTIMATE_PRICING_DEFAULTS.heavyLow : 0) +
    (addHazard ? ESTIMATE_PRICING_DEFAULTS.hazardLow : 0) +
    (addBird ? ESTIMATE_PRICING_DEFAULTS.birdLow : 0);
  const perVentHigh =
    ESTIMATE_PRICING_DEFAULTS.baseHigh +
    (addHeavy ? ESTIMATE_PRICING_DEFAULTS.heavyHigh : 0) +
    (addHazard ? ESTIMATE_PRICING_DEFAULTS.hazardHigh : 0) +
    (addBird ? ESTIMATE_PRICING_DEFAULTS.birdHigh : 0);

  let estimateLow = effectiveTerminations * perVentLow * heightMultiplier * accessMultiplier;
  let estimateHigh = effectiveTerminations * perVentHigh * heightMultiplier * accessMultiplier;

  if (travel) {
    estimateLow += ESTIMATE_PRICING_DEFAULTS.mobilization;
    estimateHigh += ESTIMATE_PRICING_DEFAULTS.mobilization;
  }

  let minJobApplied = false;
  if (effectiveTerminations > 0 && effectiveTerminations < ESTIMATE_PRICING_DEFAULTS.smallJobThreshold) {
    estimateLow = Math.max(estimateLow, ESTIMATE_PRICING_DEFAULTS.minJob);
    estimateHigh = Math.max(
      estimateHigh,
      ESTIMATE_PRICING_DEFAULTS.minJob + ESTIMATE_PRICING_DEFAULTS.mobilization
    );
    minJobApplied = true;
  }

  const estimateRange =
    effectiveTerminations > 0 ? formatMoneyRange(estimateLow, estimateHigh) : "—";
  const crewLow = effectiveTerminations ? Math.ceil(effectiveTerminations / 12) : 0;
  const crewHigh = effectiveTerminations ? Math.ceil(effectiveTerminations / 8) : 0;
  const crewRangeLabel = crewLow && crewHigh ? `${crewLow}–${crewHigh} hrs` : "—";
  const basisLine = usedRepresentativeScope
    ? `Modeled from the ${scopeBand} scope band until an exact count is confirmed.`
    : `Modeled from roughly ${effectiveTerminations} confirmed terminations.`;
  const assumptionsLine = `Based on roughly ${effectiveTerminations || "X"} terminations across ${
    effectiveBuildings || "Y"
  } buildings with ${normalizeAccess(access)} access and ${height || "standard"} height.`;

  const defaultRatio = normalizedCondition === "hazard" ? 0.6 : 0.5;
  const phaseOneTerminations = effectiveTerminations ? Math.max(1, Math.ceil(effectiveTerminations * defaultRatio)) : 0;
  const phaseTwoTerminations = Math.max(effectiveTerminations - phaseOneTerminations, 0);
  const phaseOneBuildings = effectiveBuildings
    ? Math.max(1, Math.min(effectiveBuildings, Math.ceil(effectiveBuildings * defaultRatio)))
    : 1;
  const phaseTwoBuildings = Math.max(effectiveBuildings - phaseOneBuildings, 0);
  const phaseOneRange = buildPhaseRange({ estimateLow, estimateHigh }, defaultRatio);
  const phaseTwoRange = buildPhaseRange({ estimateLow, estimateHigh }, 1 - defaultRatio);

  return {
    exactTerminations,
    exactBuildings,
    representativeTerminations,
    representativeBuildings,
    effectiveTerminations,
    effectiveBuildings,
    usedRepresentativeScope,
    normalizedCondition,
    normalizedAccess: normalizeAccess(access),
    heightMultiplier,
    accessMultiplier,
    perVentLow,
    perVentHigh,
    estimateLow,
    estimateHigh,
    estimateRange,
    crewLow,
    crewHigh,
    crewRangeLabel,
    minJobApplied,
    mobilizationApplied: Boolean(travel),
    basisLine,
    assumptionsLine,
    phaseOneTerminations,
    phaseTwoTerminations,
    phaseOneBuildings,
    phaseTwoBuildings,
    phaseOneRange,
    phaseTwoRange
  };
}

export function buildStrategyPricingPlan({ pricingModel, resolverOutput, hazardAngle }) {
  const allowPricing = Boolean(resolverOutput?.action?.copy_policy?.allow_pricing);
  const strategyKey = resolverOutput?.pricing?.strategy_key || "no_pricing_strategy";
  const pricePosture = resolverOutput?.action?.price_posture || "no_pricing_yet";
  const rangeLabel = allowPricing ? pricingModel.estimateRange : "Pricing blocked until verification";

  const base = {
    rangeLabel,
    perVentRangeLabel: `$${pricingModel.perVentLow}–${pricingModel.perVentHigh}`,
    crewRangeLabel: pricingModel.crewRangeLabel,
    basisLine: pricingModel.basisLine,
    anchorDisplay: allowPricing ? pricingModel.estimateRange : "Not shown until scope is verified.",
    entryOptionDisplay: allowPricing ? "Not shown." : "Not shown until scope is verified.",
    phasePlan: null
  };

  if (!allowPricing) {
    return {
      ...base,
      anchorDisplay: "Not shown until scope is verified.",
      entryOptionDisplay: resolverOutput?.pricing?.entry_option_structure || "Not shown."
    };
  }

  const phaseHeadline =
    hazardAngle === "safety" || pricingModel.normalizedCondition === "hazard"
      ? "Lead with the full-scope corrective path, then offer the first valid corrective phase only if approval needs it."
      : "Lead with the full scope first, then use a smaller valid first phase only if approval needs it.";
  const phaseScript =
    pricingModel.phaseTwoTerminations > 0
      ? `Phase 1 covers about ${pricingModel.phaseOneTerminations} terminations across ${pricingModel.phaseOneBuildings} ${
          pricingModel.phaseOneBuildings === 1 ? "building" : "buildings"
        } at roughly ${pricingModel.phaseOneRange.label}. Phase 2 covers the remaining ${pricingModel.phaseTwoTerminations} terminations${
          pricingModel.phaseTwoBuildings
            ? ` across ${pricingModel.phaseTwoBuildings} ${
                pricingModel.phaseTwoBuildings === 1 ? "building" : "buildings"
              }`
            : ""
        } at roughly ${pricingModel.phaseTwoRange.label}.`
      : "Keep this as one full-scope move so the customer does not pay mobilization twice.";

  const phasePlan = {
    headline: phaseHeadline,
    script: phaseScript,
    firstRangeLabel: pricingModel.phaseOneRange.label,
    secondRangeLabel: pricingModel.phaseTwoRange.label
  };

  switch (strategyKey) {
    case "urgency_safety":
      return {
        ...base,
        anchorDisplay: `Full-scope corrective path: ${pricingModel.estimateRange}`,
        entryOptionDisplay: resolverOutput?.pricing?.entry_option_suppressed
          ? "Entry option suppressed because partial framing could understate the issue."
          : `Fastest valid first corrective phase: ${pricingModel.phaseOneRange.label}`,
        phasePlan: resolverOutput?.pricing?.entry_option_suppressed ? null : phasePlan
      };
    case "bundle_portfolio":
      return {
        ...base,
        anchorDisplay: `Current scope anchor: ${pricingModel.estimateRange}`,
        entryOptionDisplay: resolverOutput?.pricing?.entry_option_suppressed
          ? "Entry option suppressed until the scope can be represented honestly."
          : `First-building / first-site option: ${pricingModel.phaseOneRange.label}`,
        phasePlan: resolverOutput?.pricing?.entry_option_suppressed ? null : phasePlan
      };
    case "test_close_small_section":
      return {
        ...base,
        anchorDisplay: `Full-scope reference: ${pricingModel.estimateRange}`,
        entryOptionDisplay: resolverOutput?.pricing?.entry_option_suppressed
          ? "Small-first section suppressed because it would mislead the customer."
          : `Small first section: ${pricingModel.phaseOneRange.label}`,
        phasePlan: resolverOutput?.pricing?.entry_option_suppressed ? null : phasePlan
      };
    case "anchor_high_phased":
      return {
        ...base,
        anchorDisplay: `Full-scope anchor: ${pricingModel.estimateRange}`,
        entryOptionDisplay: resolverOutput?.pricing?.entry_option_suppressed
          ? "Phase language is suppressed until the full issue can be framed safely."
          : `Valid first phase: ${pricingModel.phaseOneRange.label}`,
        phasePlan: resolverOutput?.pricing?.entry_option_suppressed ? null : phasePlan
      };
    default:
      return {
        ...base,
        anchorDisplay:
          pricePosture === "estimate_ready"
            ? `Estimate-ready range: ${pricingModel.estimateRange}`
            : `Planning range: ${pricingModel.estimateRange}`,
        entryOptionDisplay: "Not shown."
      };
  }
}
