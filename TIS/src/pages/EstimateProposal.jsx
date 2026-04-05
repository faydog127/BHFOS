import { useEffect, useMemo, useRef, useState } from "react";
import { getAssessment, getProperty, getPhotoAccessUrl, listPhotosByAssessment } from "../db/api";
import { getPhotoBlob } from "../db/idb";
import { Field, Input, TextArea } from "../components/Field";
import { Segmented, TileGroup } from "../components/Segmented";
import { navigate } from "../router";
import { computeHazardBand, computeHazardPrimaryAngle, computeHazardTotal } from "../utils/hazardScore";
import { formatDateTime } from "../utils/format";
import { getObjectionCards } from "../utils/objectionLibrary";
import {
  buildEstimatePricingModel,
  buildStrategyPricingPlan,
  getRepresentativeTerminationsForScopeBand
} from "../utils/estimatePricing";
import { buildPricingV1GuideBundle } from "../utils/pricingV1Guide";
import {
  SPEED_MODE_PRICE_POSTURE_LABELS,
  SPEED_MODE_STATUS_TONES,
  SPEED_MODE_UI_OPTIONS,
  buildSpeedModeProofSlots,
  inferSpeedModeInput,
  resolveSpeedMode
} from "../utils/speedModeResolver";
import { composeSpeedModeCopy } from "../utils/speedModeCopy";

const ANGLE_CONTENT = {
  safety: {
    label: "Safety",
    why: "Blocked or painted terminations restrict airflow and elevate fire risk.",
    opening:
      "I noticed multiple blocked or painted terminations, which restrict airflow and increase fire risk.",
    questions: [
      "Are you seeing dryer performance or lint complaints during turns?",
      "Is vent cleaning on a regular schedule or only when issues show up?",
      "Who signs off on a property-wide service if it makes sense?"
    ],
    avoid: [
      "Do not offer partial scope when hazards are visible.",
      "Do not promise a fixed price without confirming terminations."
    ],
    recommend: "Full-property service. No partial option."
  },
  repeat_service: {
    label: "Repeat Service Calls",
    why: "Widespread lint buildup suggests recurring maintenance calls and repeat cost.",
    opening:
      "We saw repeated lint buildup across terminations, which usually means ongoing service calls.",
    questions: [
      "How often do vent-related work orders come in?",
      "Is vent cleaning part of PM or handled case-by-case?",
      "Who approves vendors for recurring maintenance?"
    ],
    avoid: [
      "Don’t lead with safety language unless hazards are visible.",
      "Don’t quote full-property if confidence is low."
    ],
    recommend: "Building or property-level recurring service plan."
  },
  process_gap: {
    label: "Process Gap",
    why: "Mixed maintenance signals point to inconsistent processes or missed cycles.",
    opening:
      "The maintenance pattern looks inconsistent, which usually means the process needs a reset.",
    questions: [
      "How is vent maintenance tracked today?",
      "Is this handled in-house or outsourced?",
      "Would a baseline inspection help set a schedule?"
    ],
    avoid: ["Don’t overstate hazard without evidence.", "Don’t quote before confirming access."],
    recommend: "Inspection-led service with a PM schedule."
  },
  watch: {
    label: "Watch",
    why: "Evidence is limited or confidence is low.",
    opening: "We should confirm scope and access before pricing.",
    questions: [
      "Is it possible to walk a couple of units to confirm conditions?",
      "Who should be involved in a walkthrough?"
    ],
    avoid: ["Don’t quote without a walkthrough."],
    recommend: "Walkthrough required before pricing."
  }
};

const FIELD_SECTION_DEFAULTS = {
  photos: true,
  coaching: false,
  fieldScript: true,
  estimateInputs: true,
  pricingGuide: false,
  assumptions: false,
  recommendation: false,
  riskFlags: false,
  objections: true,
  vendorGuidance: false,
  deliveryPrep: false,
  deliveryTemplates: false,
  quoteActions: true,
  proposalNotes: false
};

const BUILDER_SECTION_DEFAULTS = {
  photos: true,
  coaching: true,
  fieldScript: true,
  estimateInputs: true,
  pricingGuide: true,
  assumptions: true,
  recommendation: true,
  riskFlags: true,
  objections: true,
  vendorGuidance: true,
  deliveryPrep: true,
  deliveryTemplates: true,
  quoteActions: true,
  proposalNotes: true
};

const PHOTO_TAG_PRIORITY = {
  safety_hazard: 7,
  blocked_termination: 6,
  lint_buildup: 5,
  improper_termination: 4,
  damaged_or_missing_cover: 4,
  access_issue: 3,
  maintenance_signal: 2,
  service_gap_evidence: 2,
  unclear_needs_followup: 1,
  clean_or_well_maintained: 0
};

function titleCase(value) {
  return String(value || "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPhotoTag(tag) {
  return tag ? titleCase(tag) : "Photo";
}

function compareEvidencePhotos(left, right) {
  const rightPriority = PHOTO_TAG_PRIORITY[right?.tag] ?? 0;
  const leftPriority = PHOTO_TAG_PRIORITY[left?.tag] ?? 0;
  if (rightPriority !== leftPriority) return rightPriority - leftPriority;
  const rightTime = new Date(right?.timestamp || 0).getTime() || 0;
  const leftTime = new Date(left?.timestamp || 0).getTime() || 0;
  return rightTime - leftTime;
}

function getSpeedStatusBadgeClass(statusKey) {
  const tone = SPEED_MODE_STATUS_TONES[statusKey] || "range-only";
  return `estimate-status-badge ${tone}`;
}

const SPEED_HANDOFF_NOTE_START = "[Speed Mode Handoff]";
const SPEED_HANDOFF_NOTE_END = "[/Speed Mode Handoff]";

function mergeSpeedHandoffNotes(existingNotes, handoffText) {
  const existing = String(existingNotes || "").trim();
  const block = `${SPEED_HANDOFF_NOTE_START}\n${handoffText}\n${SPEED_HANDOFF_NOTE_END}`;
  const pattern = new RegExp(
    `${SPEED_HANDOFF_NOTE_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${SPEED_HANDOFF_NOTE_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "m"
  );

  if (!existing) return block;
  if (pattern.test(existing)) return existing.replace(pattern, block).trim();
  return `${block}\n\n${existing}`.trim();
}

function QuickPhoto({ photo }) {
  const [url, setUrl] = useState("");
  const [signedTried, setSignedTried] = useState(false);

  useEffect(() => {
    let active = true;
    let currentUrl = "";

    const load = async () => {
      const blob = await getPhotoBlob(photo.id);
      if (!blob) {
        const accessUrl = await getPhotoAccessUrl(photo);
        if (active) setUrl(accessUrl || "");
        return;
      }
      currentUrl = URL.createObjectURL(blob);
      if (active) setUrl(currentUrl);
    };

    load();
    setSignedTried(false);

    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [photo.id, photo.storage_uri, photo.stored_filename, photo.assessment_id]);

  const handleOpen = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleError = async () => {
    if (signedTried) return;
    setSignedTried(true);
    const signedUrl = await getPhotoAccessUrl(photo, { forceSigned: true });
    if (signedUrl && signedUrl !== url) {
      setUrl(signedUrl);
    }
  };

  if (!url) {
    return <div className="photo-thumb placeholder">No preview</div>;
  }

  return (
    <button type="button" className="photo-thumb" onClick={handleOpen}>
      <img className="photo-thumb-img" src={url} alt={photo.tag || "Photo"} onError={handleError} />
      <span className="photo-thumb-label">Open</span>
    </button>
  );
}

export default function EstimateProposal({ assessmentId }) {
  const [assessment, setAssessment] = useState(null);
  const [property, setProperty] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [inputs, setInputs] = useState({
    terminations: "",
    buildings: "",
    height: "",
    condition: "normal",
    access: "easy",
    ventConfidence: "medium",
    quoteMode: "budgetary",
    birdGuards: false,
    travel: false,
    notes: ""
  });
  const [speedInputs, setSpeedInputs] = useState(null);
  const [viewMode, setViewMode] = useState("field");
  const [sectionOpen, setSectionOpen] = useState(() => ({ ...FIELD_SECTION_DEFAULTS }));
  const [evidencePhotoIds, setEvidencePhotoIds] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [copyNotice, setCopyNotice] = useState("");
  const saveTimer = useRef(null);
  const loadedDraft = useRef(false);
  const [repName, setRepName] = useState("");
  const [lastBuilderHandoffKey, setLastBuilderHandoffKey] = useState("");
  const [lastBuilderHandoffAt, setLastBuilderHandoffAt] = useState(null);
  const [speedDrafts, setSpeedDrafts] = useState({
    talkTrack: null,
    followUpText: null,
    primaryCloseAsk: null
  });
  const [speedDraftSourceKey, setSpeedDraftSourceKey] = useState("");
  const [delivery, setDelivery] = useState({
    method: "email",
    includePacket: true,
    includeCoi: false,
    includeW9: false,
    regionalForward: false,
    recipientName: "",
    recipientEmail: "",
    recipientPhone: ""
  });

  const storageKey = useMemo(() => `estimateDraft:${assessmentId}`, [assessmentId]);
  const defaultsKey = useMemo(() => "estimateDefaults", []);
  const repKey = useMemo(() => "repProfile", []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const existing = await getAssessment(assessmentId);
      if (!existing || !active) return;
      const prop = await getProperty(existing.property_id);
      if (!active) return;
      const photoRows = await listPhotosByAssessment(assessmentId);
      if (!active) return;
      setAssessment(existing);
      setProperty(prop);
      setPhotos(photoRows || []);
      setDelivery((current) => ({
        ...current,
        recipientName: existing.contact_name || current.recipientName || "",
        recipientEmail: existing.contact_email || current.recipientEmail || "",
        recipientPhone: existing.contact_phone || current.recipientPhone || ""
      }));
      setInputs((current) => ({
        ...current,
        height: current.height || existing.building_height || ""
      }));
    };
    load();
    return () => {
      active = false;
    };
  }, [assessmentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageKey) return;
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      loadedDraft.current = true;
      if (parsed?.inputs) {
        setInputs((current) => ({ ...current, ...parsed.inputs }));
      }
      if (parsed?.speedInputs) {
        setSpeedInputs((current) => ({ ...(current || {}), ...parsed.speedInputs }));
      }
      if (parsed?.lastBuilderHandoffKey) {
        setLastBuilderHandoffKey(parsed.lastBuilderHandoffKey);
      }
      if (parsed?.lastBuilderHandoffAt) {
        setLastBuilderHandoffAt(parsed.lastBuilderHandoffAt);
      }
      if (parsed?.speedDrafts) {
        setSpeedDrafts((current) => ({ ...current, ...parsed.speedDrafts }));
      }
      if (parsed?.speedDraftSourceKey) {
        setSpeedDraftSourceKey(parsed.speedDraftSourceKey);
      }
      if (parsed?.delivery) {
        setDelivery((current) => ({ ...current, ...parsed.delivery }));
      }
      const parsedViewMode =
        parsed?.viewMode === "field" || parsed?.viewMode === "builder"
          ? parsed.viewMode
          : typeof parsed?.fieldMode === "boolean"
            ? parsed.fieldMode
              ? "field"
              : "builder"
            : null;
      if (parsedViewMode) {
        setViewMode(parsedViewMode);
      }
      if (parsed?.sectionOpen) {
        setSectionOpen(parsed.sectionOpen);
      } else if (parsedViewMode) {
        setSectionOpen(parsedViewMode === "field" ? { ...FIELD_SECTION_DEFAULTS } : { ...BUILDER_SECTION_DEFAULTS });
      }
      if (Array.isArray(parsed?.evidencePhotoIds)) {
        setEvidencePhotoIds(parsed.evidencePhotoIds.filter(Boolean).slice(0, 2));
      }
      if (parsed?.savedAt) {
        setLastSavedAt(parsed.savedAt);
      }
    } catch (error) {
      console.error("Failed to load estimate draft", error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(repKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.name) {
        setRepName(parsed.name);
      }
    } catch (error) {
      console.error("Failed to load rep profile", error);
    }
  }, [repKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!assessment || !property) return;
    if (loadedDraft.current) return;
    const defaultsRaw = window.localStorage.getItem(defaultsKey);
    let defaults = null;
    if (defaultsRaw) {
      try {
        defaults = JSON.parse(defaultsRaw);
      } catch {
        defaults = null;
      }
    }
    setInputs((current) => {
      const next = { ...current };
      if (!next.terminations && property?.units_est) {
        next.terminations = String(property.units_est);
      } else if (!next.terminations && defaults?.terminations) {
        next.terminations = defaults.terminations;
      }
      if (!next.buildings && defaults?.buildings) {
        next.buildings = defaults.buildings;
      }
      if (!next.height && defaults?.height) {
        next.height = defaults.height;
      }
      if (!next.condition && defaults?.condition) {
        next.condition = defaults.condition;
      }
      if (!next.access && defaults?.access) {
        next.access = defaults.access;
      }
      if (!next.ventConfidence && defaults?.ventConfidence) {
        next.ventConfidence = defaults.ventConfidence;
      }
      if (!next.quoteMode && defaults?.quoteMode) {
        next.quoteMode = defaults.quoteMode;
      }
      if (!next.birdGuards && defaults?.birdGuards) {
        next.birdGuards = defaults.birdGuards;
      }
      if (!next.travel && defaults?.travel) {
        next.travel = defaults.travel;
      }
      return next;
    });
  }, [assessment, property, defaultsKey]);

  const seededSpeedInputs = useMemo(() => {
    if (!assessment || !property) return null;
    return inferSpeedModeInput({ assessment, property, estimateInputs: inputs, photos });
  }, [assessment, property, inputs, photos]);

  useEffect(() => {
    if (!seededSpeedInputs) return;
    setSpeedInputs((current) => {
      const hasRequired =
        current?.property_type &&
        current?.scope_band &&
        current?.access &&
        current?.confidence &&
        current?.visible_condition;
      if (hasRequired) return current;
      return { ...seededSpeedInputs, ...(current || {}) };
    });
  }, [seededSpeedInputs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageKey) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      const payload = {
        inputs,
        speedInputs,
        lastBuilderHandoffKey,
        lastBuilderHandoffAt,
        speedDrafts,
        speedDraftSourceKey,
        delivery,
        viewMode,
        fieldMode: viewMode === "field",
        sectionOpen,
        evidencePhotoIds,
        savedAt: new Date().toISOString()
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      setLastSavedAt(payload.savedAt);
      const defaultsPayload = {
        terminations: inputs.terminations || "",
        buildings: inputs.buildings || "",
        height: inputs.height || "",
        condition: inputs.condition || "normal",
        access: inputs.access || "easy",
        ventConfidence: inputs.ventConfidence || "medium",
        quoteMode: inputs.quoteMode || "budgetary",
        birdGuards: inputs.birdGuards || false,
        travel: inputs.travel || false
      };
      window.localStorage.setItem(defaultsKey, JSON.stringify(defaultsPayload));
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    inputs,
    speedInputs,
    lastBuilderHandoffKey,
    lastBuilderHandoffAt,
    speedDrafts,
    speedDraftSourceKey,
    delivery,
    viewMode,
    sectionOpen,
    evidencePhotoIds,
    storageKey,
    defaultsKey
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = { name: repName || "" };
    window.localStorage.setItem(repKey, JSON.stringify(payload));
  }, [repName, repKey]);

  const hazardTotal = useMemo(() => computeHazardTotal(assessment), [assessment]);
  const hazardBand = useMemo(() => computeHazardBand(hazardTotal), [hazardTotal]);
  const hazardAngle = useMemo(() => {
    if (!assessment) return "watch";
    return computeHazardPrimaryAngle({ ...assessment, hazard_total: hazardTotal });
  }, [assessment, hazardTotal]);

  const sortedPhotos = useMemo(() => [...photos].sort(compareEvidencePhotos), [photos]);
  const recommendedEvidenceIds = useMemo(
    () => sortedPhotos.slice(0, 2).map((photo) => photo.id),
    [sortedPhotos]
  );

  useEffect(() => {
    setEvidencePhotoIds((current) => {
      const valid = current.filter((id) => sortedPhotos.some((photo) => photo.id === id)).slice(0, 2);
      const next = valid.length ? valid : recommendedEvidenceIds;
      return next.join("|") === current.join("|") ? current : next;
    });
  }, [sortedPhotos, recommendedEvidenceIds]);

  const speedResult = useMemo(() => {
    if (!speedInputs) return null;
    return resolveSpeedMode(speedInputs);
  }, [speedInputs]);

  const speedCopy = useMemo(() => {
    if (!speedResult?.valid) return null;
    return composeSpeedModeCopy(speedResult, {
      pricePostureLabel: SPEED_MODE_PRICE_POSTURE_LABELS[speedResult.action.price_posture]
    });
  }, [speedResult]);
  const speedGeneratedKey = useMemo(() => {
    if (!speedResult?.valid || !speedCopy) return "";
    return JSON.stringify({
      status: speedResult.resolution.status_key,
      strategy: speedResult.pricing.strategy_key,
      talkTrack: speedCopy.talkTrack,
      followUpText: speedCopy.followUpText,
      primaryCloseAsk: speedCopy.primaryCloseAsk
    });
  }, [speedResult, speedCopy]);
  const hasCustomSpeedDrafts =
    speedDrafts.talkTrack != null || speedDrafts.followUpText != null || speedDrafts.primaryCloseAsk != null;

  useEffect(() => {
    if (!speedGeneratedKey || !speedCopy) return;
    if (!hasCustomSpeedDrafts && speedDraftSourceKey !== speedGeneratedKey) {
      setSpeedDraftSourceKey(speedGeneratedKey);
    }
  }, [speedGeneratedKey, speedCopy, speedDraftSourceKey, hasCustomSpeedDrafts]);

  const editableSpeedCopy = useMemo(() => {
    if (!speedCopy) {
      return {
        talkTrack: "",
        followUpText: "",
        primaryCloseAsk: ""
      };
    }
    return {
      talkTrack: speedDrafts.talkTrack ?? speedCopy.talkTrack,
      followUpText: speedDrafts.followUpText ?? speedCopy.followUpText,
      primaryCloseAsk: speedDrafts.primaryCloseAsk ?? speedCopy.primaryCloseAsk
    };
  }, [speedCopy, speedDrafts]);
  const speedCopyDirty = useMemo(
    () => ({
      talkTrack: speedDrafts.talkTrack != null && speedDrafts.talkTrack !== speedCopy?.talkTrack,
      followUpText: speedDrafts.followUpText != null && speedDrafts.followUpText !== speedCopy?.followUpText,
      primaryCloseAsk:
        speedDrafts.primaryCloseAsk != null && speedDrafts.primaryCloseAsk !== speedCopy?.primaryCloseAsk
    }),
    [speedDrafts, speedCopy]
  );
  const speedCopyEdited = speedCopyDirty.talkTrack || speedCopyDirty.followUpText || speedCopyDirty.primaryCloseAsk;
  const speedCopyNeedsRefresh = Boolean(
    hasCustomSpeedDrafts && speedDraftSourceKey && speedGeneratedKey && speedDraftSourceKey !== speedGeneratedKey
  );

  const speedProofSlots = useMemo(() => {
    if (!speedResult?.valid) return [];
    return buildSpeedModeProofSlots({
      photos: sortedPhotos,
      selectedPhotoIds: evidencePhotoIds,
      proof: speedResult.proof
    });
  }, [sortedPhotos, evidencePhotoIds, speedResult]);
  const speedHandoffKey = useMemo(() => {
    if (!speedResult?.valid) return "";
    return JSON.stringify({
      speedInputs,
      status: speedResult.resolution.status_key,
      strategy: speedResult.pricing.strategy_key,
      proof: speedProofSlots.map((slot) => slot.photo.id)
    });
  }, [speedInputs, speedResult, speedProofSlots]);
  const builderSyncNeeded = Boolean(speedHandoffKey && speedHandoffKey !== lastBuilderHandoffKey);

  const angleContent = ANGLE_CONTENT[hazardAngle] || ANGLE_CONTENT.watch;
  const confidence = assessment?.confidence_level || "low";
  const quoteReadiness = useMemo(() => {
    if (confidence === "low" || inputs.ventConfidence === "low") return "Walkthrough required";
    if (inputs.quoteMode === "proposal") return "Quote now";
    if (hazardTotal >= 8) return "Quote now";
    return "Quote with caution";
  }, [confidence, hazardTotal, inputs.quoteMode, inputs.ventConfidence]);

  const terminations = Number(inputs.terminations) || 0;
  const buildings = Number(inputs.buildings) || 0;
  const pricingModel = useMemo(
    () =>
      buildEstimatePricingModel({
        terminations: inputs.terminations,
        buildings: inputs.buildings,
        scopeBand: speedInputs?.scope_band,
        height: inputs.height,
        condition: inputs.condition,
        access: inputs.access,
        birdGuards: inputs.birdGuards,
        travel: inputs.travel
      }),
    [inputs, speedInputs]
  );
  const isBuilderMode = viewMode === "builder";
  const isFieldMode = viewMode === "field";

  const lowConfidence = quoteReadiness === "Walkthrough required";
  const fieldStatus = useMemo(() => {
    if (lowConfidence) {
      return {
        key: "walkthrough",
        label: "Walkthrough only",
        summary: "Stay in discovery mode. Do not treat the number as a real quote yet.",
        nextMove: "Lock a walkthrough, confirm count and access, then tighten the number."
      };
    }
    if (inputs.quoteMode === "proposal" || quoteReadiness === "Quote now") {
      return {
        key: "ready",
        label: "Ready to quote",
        summary: "A range is safe to present and follow with written copy.",
        nextMove: "Confirm scope, keep assumptions visible, and send the range."
      };
    }
    return {
      key: "budgetary",
      label: "Budgetary range",
      summary: "Present a range, not a final commitment.",
      nextMove: "Share the range, then confirm scope before final pricing."
    };
  }, [inputs.quoteMode, lowConfidence, quoteReadiness]);
  const strategyPricingPlan = useMemo(
    () =>
      buildStrategyPricingPlan({
        pricingModel,
        resolverOutput: speedResult,
        hazardAngle
      }),
    [pricingModel, speedResult, hazardAngle]
  );
  const estimateRange = pricingModel.estimateRange;
  const speedPlanningRange = strategyPricingPlan.rangeLabel || "Unavailable";
  const assumptionLine = pricingModel.assumptionsLine;
  const crewLow = pricingModel.crewLow;
  const crewHigh = pricingModel.crewHigh;
  const perVentLow = pricingModel.perVentLow;
  const perVentHigh = pricingModel.perVentHigh;

  const observationText =
    inputs.condition === "hazard"
      ? "blocked or painted terminations"
      : inputs.condition === "heavy"
        ? "heavy lint buildup across multiple terminations"
        : "visible lint buildup on several terminations";

  const impactText =
    hazardAngle === "safety" || inputs.condition === "hazard"
      ? "restricted airflow and elevated fire risk"
      : hazardAngle === "repeat_service"
        ? "repeat maintenance calls and dryer performance issues"
        : hazardAngle === "process_gap"
          ? "inconsistent maintenance cycles and avoidable work orders"
          : "unclear scope until access is confirmed";

  const askText =
    hazardAngle === "safety" || inputs.condition === "hazard"
      ? "a quick walkthrough so we can confirm full-property scope"
      : hazardAngle === "repeat_service"
        ? "a baseline count so we can align a recurring service plan"
        : hazardAngle === "process_gap"
          ? "a baseline inspection to reset the maintenance schedule"
          : "a walkthrough to confirm conditions and access";

  const openingLine = `Observation: ${observationText}.`;
  const impactLine = `Impact: ${impactText}.`;
  const askLine = `Ask: Would you be open to ${askText}?`;

  const priceLine =
    pricingModel.effectiveTerminations > 0
      ? lowConfidence
        ? `For planning only, similar scope can land around ${estimateRange}. ${pricingModel.basisLine} I would want a walkthrough before treating that as a quote.`
        : fieldStatus.key === "ready"
          ? `Based on roughly ${pricingModel.effectiveTerminations} terminations across ${pricingModel.effectiveBuildings || "Y"} buildings, this should fall in the ${estimateRange} range. ${pricingModel.basisLine}`
          : `Based on roughly ${pricingModel.effectiveTerminations} terminations across ${pricingModel.effectiveBuildings || "Y"} buildings, this likely falls in the ${estimateRange} budgetary range. ${pricingModel.basisLine}`
      : lowConfidence
        ? "I need a walkthrough to confirm terminations and access before I treat pricing as a quote."
        : "Once we confirm the termination count and access, I can provide a tight price range.";

  const phasedPlan = useMemo(() => {
    if (!strategyPricingPlan?.phasePlan) return null;
    if (pricingModel.effectiveTerminations < 24 && pricingModel.effectiveBuildings < 2 && inputs.condition === "normal") {
      return null;
    }
    const focus =
      hazardAngle === "safety" || inputs.condition === "hazard"
        ? "the highest-risk blocked or restricted terminations first"
        : hazardAngle === "repeat_service"
          ? "the heaviest-call buildings first"
          : "the most visible buildings first while the balance is confirmed";
    return {
      headline: "If approval is tight, offer a phased option instead of discounting the full scope.",
      script:
        pricingModel.phaseTwoTerminations > 0
          ? `If it helps with approval, we can phase it: Phase 1 would cover about ${pricingModel.phaseOneTerminations} terminations across ${pricingModel.phaseOneBuildings} ${
              pricingModel.phaseOneBuildings === 1 ? "building" : "buildings"
            }, focused on ${focus}, at roughly ${pricingModel.phaseOneRange.label}. Phase 2 would finish the remaining ${pricingModel.phaseTwoTerminations} terminations${
              pricingModel.phaseTwoBuildings
                ? ` across ${pricingModel.phaseTwoBuildings} ${pricingModel.phaseTwoBuildings === 1 ? "building" : "buildings"}`
                : ""
            } at roughly ${pricingModel.phaseTwoRange.label}.`
          : strategyPricingPlan.phasePlan.script
    };
  }, [strategyPricingPlan, pricingModel, inputs.condition, hazardAngle]);

  const nextStepLine =
    fieldStatus.key === "walkthrough"
      ? "Next step: schedule a walkthrough before quoting."
      : fieldStatus.key === "ready"
        ? "Next step: confirm scope and send the range with a full-scope recommendation."
        : phasedPlan
          ? "Next step: share the budgetary range and offer a phased option if approval is tight."
          : "Next step: share the budgetary range and confirm count before final pricing.";

  const needsContact =
    !assessment?.decision_maker_known ||
    !(assessment?.contact_name || "").trim() ||
    (!(assessment?.contact_email || "").trim() && !(assessment?.contact_phone || "").trim());

  const recipientName = delivery.recipientName || assessment?.contact_name || "there";
  const propertyName = property?.property_name || "the property";
  const repNameDisplay = repName || "[Rep Name]";

  const brandHeader = "[TVG BRAND HEADER: logo | certifications | badges]";
  const brandFooter = "[TVG BRAND FOOTER: theventguys.com | contact info]";

  const subjectPrefix =
    fieldStatus.key === "walkthrough"
      ? "Dryer Vent Walkthrough Follow-Up"
      : fieldStatus.key === "ready"
        ? "Dryer Vent Service Estimate"
        : "Dryer Vent Service Budgetary Range";
  const subjectLine = `${subjectPrefix} – ${propertyName}`;
  const emailIntro =
    fieldStatus.key === "walkthrough"
      ? `Based on what was visible on site, this is a walkthrough follow-up for ${propertyName}. I do not want to treat pricing as final until we confirm scope and access.`
      : fieldStatus.key === "ready"
        ? `Attached is the current estimate and vendor information package for ${propertyName} based on conditions observed on site.`
        : `Attached is a budgetary range and vendor information package for ${propertyName} based on conditions observed on site. Final pricing can tighten once scope and access are confirmed.`;
  const emailBody = `${brandHeader}\n\nHello ${recipientName},\n\n${emailIntro}\n\nKey observation: ${observationText}, which points to ${impactText}.\n\nCurrent range: ${
    speedPlanningRange === "Unavailable" ? "Pending scope confirmation." : speedPlanningRange
  }\nRecommended next step: ${
    fieldStatus.key === "walkthrough" ? "schedule a walkthrough to confirm count and access." : angleContent.recommend
  }\nRange basis: ${strategyPricingPlan.basisLine}\nAnchor: ${
    strategyPricingPlan.anchorDisplay
  }\n${phasedPlan ? `Phased option: ${phasedPlan.script}\n` : ""}\nThe next step is ${
    fieldStatus.key === "walkthrough" ? "locking a walkthrough." : "confirming scope and routing this for review."
  }\n\nBest,\n${repNameDisplay}\nThe Vent Guys\n${brandFooter}`;

  const textBody =
    fieldStatus.key === "walkthrough"
      ? `Hi ${recipientName}, this is ${repNameDisplay} with The Vent Guys. I have a walkthrough follow-up for ${propertyName}. I would want to confirm count and access before I treat pricing as a quote.`
      : `Hi ${recipientName}, this is ${repNameDisplay} with The Vent Guys. I just sent over the ${
          fieldStatus.key === "ready" ? "estimate" : "budgetary range"
        } and vendor packet for ${propertyName}. If you’d like, I can also send a version that is easier to forward to regional.`;

  const regionalBody = `${brandHeader}\n\nHi [Regional Name],\n\nAttached is a ${
    fieldStatus.key === "walkthrough" ? "walkthrough follow-up" : "vendor quote and packet"
  } for dryer vent service at ${propertyName}. The current recommendation is ${
    fieldStatus.key === "walkthrough" ? "to confirm scope and access before quoting." : `${angleContent.recommend.toLowerCase()}.`
  }\nCurrent range posture: ${speedPlanningRange}\nRange basis: ${
    strategyPricingPlan.basisLine
  }\n\nThe next step is routing this to the right approval path.\n\nThanks,\n${
    recipientName || "[Manager Name]"
  } / ${repNameDisplay}\n${brandFooter}`;

  const contactRole = (assessment?.contact_role || "").toLowerCase();
  const regionalDetected =
    contactRole.includes("regional") ||
    contactRole.includes("director") ||
    contactRole.includes("property manager") ||
    contactRole.includes("manager") ||
    contactRole.includes("pm");
  const approvalDetected =
    assessment?.decision_maker_known && assessment?.decision_maker_contacted === false;
  const objectionCards = useMemo(() => {
    return getObjectionCards({
      angle: hazardAngle,
      quoteReadiness,
      recommendedApproach: angleContent.recommend,
      regionalDetected: regionalDetected || approvalDetected,
      context: { price_range: estimateRange, recommended_approach: angleContent.recommend }
    });
  }, [
    hazardAngle,
    quoteReadiness,
    angleContent.recommend,
    regionalDetected,
    approvalDetected,
    estimateRange
  ]);
  const primaryObjection = objectionCards[0] || null;
  const featuredPhotos = useMemo(() => {
    if (speedProofSlots.length) {
      return speedProofSlots.map((slot) => slot.photo).filter(Boolean).slice(0, 2);
    }
    const selected = evidencePhotoIds
      .map((id) => photos.find((photo) => photo.id === id))
      .filter(Boolean)
      .slice(0, 2);
    if (selected.length >= 2) return selected;
    const selectedIds = new Set(selected.map((photo) => photo.id));
    const fallback = sortedPhotos.filter((photo) => !selectedIds.has(photo.id)).slice(0, 2 - selected.length);
    return [...selected, ...fallback];
  }, [speedProofSlots, evidencePhotoIds, photos, sortedPhotos]);
  const builderHandoffSummary = useMemo(() => {
    if (!speedResult?.valid || !speedCopy) return "";
    const proofLabels = speedProofSlots
      .map((slot) => speedCopy.proofCaptionMap[slot.priority_key] || formatPhotoTag(slot.photo?.tag))
      .filter(Boolean)
      .join(", ");

    return [
      `Status: ${speedResult.resolution.status_label}`,
      `Action: ${speedCopy.actionCommand}`,
      `Risk: ${speedCopy.riskWarning}`,
      `Price posture: ${SPEED_MODE_PRICE_POSTURE_LABELS[speedResult.action.price_posture]}`,
      `Strategy: ${speedResult.pricing.strategy_label}`,
      `Planning range: ${speedPlanningRange}`,
      `Range basis: ${strategyPricingPlan.basisLine}`,
      `Anchor: ${strategyPricingPlan.anchorDisplay}`,
      `Entry option: ${strategyPricingPlan.entryOptionDisplay}`,
      `Close path: ${speedResult.pricing.close_path}`,
      `Primary close: ${editableSpeedCopy.primaryCloseAsk}`,
      proofLabels ? `Proof: ${proofLabels}` : "Proof: No proof selected"
    ].join("\n");
  }, [speedResult, speedCopy, speedProofSlots, speedPlanningRange, strategyPricingPlan, editableSpeedCopy]);

  const pricingGuideBundle = useMemo(
    () =>
      buildPricingV1GuideBundle({
        assessment,
        property,
        estimateInputs: inputs,
        speedInputs,
        photos
      }),
    [assessment, property, inputs, speedInputs, photos]
  );
  const pricingGuideDocument = pricingGuideBundle.document;
  const pricingGuideGateSummary = useMemo(() => {
    if (pricingGuideDocument) return "";
    const missing = pricingGuideBundle.completeness?.missing_required_inputs?.length
      ? `Missing required inputs: ${pricingGuideBundle.completeness.missing_required_inputs.join(", ")}.`
      : "";
    const blockers = pricingGuideBundle.blockers?.quote_block_reasons?.length
      ? pricingGuideBundle.blockers.quote_block_reasons.map((reason) => reason.message).join(" ")
      : "";

    if (pricingGuideBundle.resolution.pricing_intent === "ballpark") {
      return `Ballpark only. The system will not render a forwardable guide yet. ${missing}`.trim();
    }

    return `Formal quote required. ${blockers} ${missing}`.trim();
  }, [pricingGuideBundle, pricingGuideDocument]);

  const handleCopy = async (text, notice = "Copied") => {
    if (!navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(notice);
      setTimeout(() => setCopyNotice(""), 2000);
    } catch (error) {
      console.error("Copy failed", error);
    }
  };

  const handleCopyPack = () => {
    const pack =
      speedResult?.valid && speedCopy
        ? [
            `Status: ${speedResult.resolution.status_label}`,
            `Action: ${speedCopy.actionCommand}`,
            `Risk: ${speedCopy.riskWarning}`,
            `Price posture: ${SPEED_MODE_PRICE_POSTURE_LABELS[speedResult.action.price_posture]}`,
            `Strategy: ${speedResult.pricing.strategy_label}`,
            `Planning range: ${speedPlanningRange}`,
            `Talk track: ${editableSpeedCopy.talkTrack}`,
            `Anchor: ${strategyPricingPlan.anchorDisplay}`,
            `Entry option: ${strategyPricingPlan.entryOptionDisplay}`,
            `Close path: ${speedResult.pricing.close_path}`,
            `Primary close: ${editableSpeedCopy.primaryCloseAsk}`,
            `Follow-up: ${editableSpeedCopy.followUpText}`
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `Status: ${fieldStatus.label}`,
            `Opening: ${angleContent.opening}`,
            `Hook: ${openingLine} ${impactLine} ${askLine}`,
            `Price: ${priceLine}`,
            primaryObjection?.respond_with ? `Objection reply: ${primaryObjection.respond_with}` : null,
            phasedPlan?.script ? `Phased option: ${phasedPlan.script}` : null,
            `Next step: ${fieldStatus.nextMove}`
          ]
            .filter(Boolean)
            .join("\n");
    handleCopy(pack, "Copy pack ready");
  };

  const handleDownloadGuideHtml = () => {
    if (!pricingGuideBundle.html || typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([pricingGuideBundle.html], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = pricingGuideBundle.file_name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    setCopyNotice("Guide HTML downloaded");
    setTimeout(() => setCopyNotice(""), 2000);
  };

  const applyViewModeDefaults = (mode) => {
    setSectionOpen(mode === "field" ? { ...FIELD_SECTION_DEFAULTS } : { ...BUILDER_SECTION_DEFAULTS });
  };

  const updateSpeedInput = (field, value) => {
    setSpeedInputs((current) => {
      const next = { ...(current || seededSpeedInputs || {}), [field]: value };
      const propertyComplex =
        next.property_type === "high-rise" || next.property_type === "single-site commercial";
      if (field === "visible_condition" || field === "access" || field === "property_type" || field === "scope_band") {
        next.entry_option_safe =
          next.visible_condition === "hazardous" || next.access === "difficult" ? "no" : "yes";
        next.internal_review_flag =
          propertyComplex && (next.visible_condition === "hazardous" || next.access === "difficult")
            ? "yes"
            : "no";
        if (next.scope_band === "51-100" || next.scope_band === "100+") {
          next.managed_scope_credible = "yes";
        } else if (!current?.managed_scope_credible) {
          next.managed_scope_credible = seededSpeedInputs?.managed_scope_credible || "no";
        }
      }
      return next;
    });
  };

  const updateSpeedDraft = (field, value) => {
    setSpeedDrafts((current) => ({ ...current, [field]: value }));
    if (speedGeneratedKey && !speedDraftSourceKey) {
      setSpeedDraftSourceKey(speedGeneratedKey);
    }
  };

  const resetSpeedDraftsToGenerated = () => {
    setSpeedDrafts({
      talkTrack: null,
      followUpText: null,
      primaryCloseAsk: null
    });
    setSpeedDraftSourceKey(speedGeneratedKey || "");
  };

  const syncBuilderFromSpeedMode = () => {
    if (!speedResult?.valid || !speedCopy || !speedInputs) return;

    const nextCondition =
      speedInputs.visible_condition === "hazardous"
        ? "hazard"
        : speedInputs.visible_condition === "heavy"
          ? "heavy"
          : "normal";
    const nextAccess =
      speedInputs.access === "difficult"
        ? "difficult"
        : speedInputs.access === "mixed"
          ? "moderate"
          : speedInputs.access === "easy"
            ? "easy"
            : inputs.access || "moderate";
    const nextQuoteMode =
      speedResult.resolution.status_key === "deliver_estimate_ask_approval"
        ? "proposal"
        : speedResult.resolution.status_key === "do_not_price_secure_access" ||
            speedResult.resolution.status_key === "escalate_internal"
          ? "walkthrough"
          : "budgetary";
    const representativeCount = String(getRepresentativeTerminationsForScopeBand(speedInputs.scope_band) || "");

    setInputs((current) => ({
      ...current,
      terminations: current.terminations || representativeCount,
      buildings: current.buildings || String(pricingModel.representativeBuildings || ""),
      condition: nextCondition,
      access: nextAccess,
      ventConfidence: speedInputs.confidence,
      quoteMode: nextQuoteMode,
      notes: mergeSpeedHandoffNotes(current.notes, builderHandoffSummary)
    }));
    setLastBuilderHandoffKey(speedHandoffKey);
    setLastBuilderHandoffAt(new Date().toISOString());
  };

  const openProposalBuilder = () => {
    if (builderSyncNeeded) {
      syncBuilderFromSpeedMode();
    }
    setViewMode("builder");
    applyViewModeDefaults("builder");
  };

  const toggleEvidencePhoto = (photoId) => {
    setEvidencePhotoIds((current) => {
      if (current.includes(photoId)) {
        return current.filter((id) => id !== photoId);
      }
      if (current.length >= 2) {
        return [...current.slice(1), photoId];
      }
      return [...current, photoId];
    });
  };

  const toggleSection = (key) => {
    setSectionOpen((current) => ({ ...current, [key]: !current[key] }));
  };

  const renderSectionHeader = (title, key, extraActions = null) => (
    <div className="section-header-row">
      <div className="section-header">{title}</div>
      <div className="section-header-actions">
        {extraActions}
        <button
          className="ghost button-small section-toggle"
          type="button"
          onClick={() => toggleSection(key)}
        >
          {sectionOpen[key] ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );

  const riskFlags = useMemo(() => {
    const flags = [];
    if (pricingModel.effectiveTerminations >= 200) flags.push("Large property — verify termination count.");
    if (pricingModel.effectiveBuildings >= 10) flags.push("Multi-building coordination required.");
    if (inputs.condition === "heavy") flags.push("Heavy buildup slows production.");
    if (inputs.condition === "hazard") flags.push("Safety hazard requires full scope.");
    if (inputs.access === "difficult") flags.push("Difficult access increases time.");
    if (inputs.ventConfidence === "low") {
      flags.push("Low vent-count confidence — walkthrough before quoting.");
    }
    if (confidence === "low") flags.push("Low assessment confidence — walkthrough required.");
    if (inputs.travel) flags.push("Travel/mobilization added.");
    if (pricingModel.usedRepresentativeScope) {
      flags.push(`Pricing is modeled from the ${speedInputs?.scope_band || "current"} scope band until count is confirmed.`);
    }
    return flags;
  }, [
    pricingModel,
    inputs.condition,
    inputs.access,
    inputs.ventConfidence,
    inputs.travel,
    confidence,
    speedInputs
  ]);

  const doNotOffer = useMemo(() => {
    if (hazardAngle === "safety" || inputs.condition === "hazard") {
      return ["Partial scope / spot cleaning", "Unit-by-unit only pricing"];
    }
    if (hazardAngle === "repeat_service") {
      return ["Downplaying recurring maintenance costs"];
    }
    if (hazardAngle === "process_gap") {
      return ["Fixed price without a walkthrough"];
    }
    return ["Final pricing without confirming scope"];
  }, [hazardAngle, inputs.condition]);

  if (!assessment) {
    return (
      <div className="page">
        <div className="empty-state">Estimate not available. Assessment not found.</div>
        <button className="primary" type="button" onClick={() => navigate("/properties")}>
          Back to Properties
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Estimate & Proposal</div>
          <div className="page-subtitle">{property?.property_name || "Property"}</div>
          {lastSavedAt ? (
            <div className="page-subtitle">Auto-saved {formatDateTime(lastSavedAt)}</div>
          ) : null}
          {copyNotice ? <div className="page-subtitle">{copyNotice}</div> : null}
        </div>
        <div className="button-row">
          <button
            className="ghost button-small"
            type="button"
            onClick={() => navigate(`/assessments/${assessmentId}`)}
          >
            Back to Assessment
          </button>
        </div>
      </div>

      <div className="detail-card estimate-pack-card">
        <div className="estimate-pack-head">
          <div>
            <div className={getSpeedStatusBadgeClass(speedResult?.resolution?.status_key)}>
              {speedCopy?.statusLabel || "Speed Mode"}
            </div>
            <div className="card-title">Field Close System</div>
            <div className="helper-text">
              Speed Mode is the default field workflow. Proposal Builder remains available below for deeper prep.
            </div>
          </div>
          <div className="mode-toggle" role="group" aria-label="Estimate workspace mode">
            <button
              type="button"
              className={`mode-toggle-button ${viewMode === "field" ? "is-active" : ""}`}
              onClick={() => {
                setViewMode("field");
                applyViewModeDefaults("field");
              }}
            >
              Speed Mode
            </button>
            <button
              type="button"
              className={`mode-toggle-button ${viewMode === "builder" ? "is-active" : ""}`}
              onClick={openProposalBuilder}
            >
              Proposal Builder
            </button>
          </div>
        </div>
        {speedResult?.valid && speedCopy ? (
          <>
            <div className="speed-status-strip">
              <div className="snapshot-card">
                <div className="snapshot-value">{speedCopy.statusLabel}</div>
                <div className="snapshot-label">Status</div>
              </div>
              <div className="snapshot-card">
                <div className="snapshot-value">{SPEED_MODE_PRICE_POSTURE_LABELS[speedResult.action.price_posture]}</div>
                <div className="snapshot-label">Price Posture</div>
              </div>
              <div className="snapshot-card">
                <div className="snapshot-value">{speedPlanningRange}</div>
                <div className="snapshot-label">Planning Range</div>
              </div>
              <div className="snapshot-card">
                <div className="snapshot-value">
                  {speedResult.handoff.handoff_target === "internal_review"
                    ? "Internal Review"
                    : speedResult.handoff.controlled_mode_eligible
                      ? "Builder Ready"
                      : "Stay in Field"}
                </div>
                <div className="snapshot-label">Next Surface</div>
              </div>
            </div>

            <div className="speed-mode-shell">
              <div className="speed-input-rail">
                <div className="signal-title">Speed Mode</div>
                <div className="helper-text">Five fixed inputs. Controlled output in under 90 seconds.</div>
                <TileGroup
                  label="Property Type"
                  value={speedInputs?.property_type || ""}
                  onChange={(value) => updateSpeedInput("property_type", value)}
                  options={SPEED_MODE_UI_OPTIONS.property_type}
                />
                <Segmented
                  label="Rough Count"
                  value={speedInputs?.scope_band || ""}
                  onChange={(value) => updateSpeedInput("scope_band", value)}
                  options={SPEED_MODE_UI_OPTIONS.scope_band}
                />
                <Segmented
                  label="Access"
                  value={speedInputs?.access || ""}
                  onChange={(value) => updateSpeedInput("access", value)}
                  options={SPEED_MODE_UI_OPTIONS.access}
                />
                <Segmented
                  label="Confidence"
                  value={speedInputs?.confidence || ""}
                  onChange={(value) => updateSpeedInput("confidence", value)}
                  options={SPEED_MODE_UI_OPTIONS.confidence}
                />
                <TileGroup
                  label="Visible Condition"
                  value={speedInputs?.visible_condition || ""}
                  onChange={(value) => updateSpeedInput("visible_condition", value)}
                  options={SPEED_MODE_UI_OPTIONS.visible_condition}
                />
                <div className="speed-signal-row">
                  <div className="speed-signal-chip">
                    Proof: {speedResult.input.proof_available === "yes" ? "Available" : "Missing"}
                  </div>
                  <div className="speed-signal-chip">
                    Decision Maker: {needsContact ? "Needs Contact" : "Contact Ready"}
                  </div>
                  <div className={`speed-signal-chip ${speedCopyNeedsRefresh ? "risk" : speedCopyEdited ? "is-info" : ""}`}>
                    {speedCopyNeedsRefresh ? "Copy Needs Refresh" : speedCopyEdited ? "Copy Edited" : "Copy Synced"}
                  </div>
                  <div className={`speed-signal-chip ${builderSyncNeeded ? "risk" : lastBuilderHandoffAt ? "is-success" : ""}`}>
                    {builderSyncNeeded ? "Builder Needs Refresh" : lastBuilderHandoffAt ? "Builder Synced" : "Builder Not Synced"}
                  </div>
                  {speedResult.input.internal_review_flag === "yes" ? (
                    <div className="speed-signal-chip risk">Review Flag</div>
                  ) : null}
                </div>
                {speedCopyNeedsRefresh ? (
                  <div className="estimate-warning">
                    Generated copy changed after your last edit. Reset to Generated to pull the newest system copy.
                  </div>
                ) : null}
                {builderSyncNeeded ? (
                  <div className="estimate-warning">
                    Proposal Builder is behind the current Speed Mode inputs. Open or refresh Builder to carry the latest posture forward.
                  </div>
                ) : null}
              </div>

              <div className="speed-output-rail">
                <div className="speed-output-card">
                  <div className="speed-output-label">Action Command</div>
                  <div className="speed-output-copy">{speedCopy.actionCommand}</div>
                </div>
                <div className="speed-output-card">
                  <div className="speed-output-label">Risk Warning</div>
                  <div className="speed-output-copy">{speedCopy.riskWarning}</div>
                </div>
                {speedResult.overlays.applied_warning_messages.length ? (
                  <div className="warning-chip-row">
                    {speedResult.overlays.applied_warning_messages.map((message) => (
                      <div key={message} className="warning-chip">
                        {message}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="speed-output-card">
                  <div className="speed-output-label">Talk Track</div>
                  <TextArea
                    rows={4}
                    value={editableSpeedCopy.talkTrack}
                    onChange={(value) => updateSpeedDraft("talkTrack", value)}
                    placeholder="Generated talk track"
                  />
                  {speedCopyDirty.talkTrack ? (
                    <div className="helper-text">Edited from generated copy.</div>
                  ) : null}
                </div>
                <div className="speed-output-grid">
                  <div className="speed-output-card">
                    <div className="speed-output-label">Price Framing</div>
                    <div className="speed-metric">{SPEED_MODE_PRICE_POSTURE_LABELS[speedResult.action.price_posture]}</div>
                    <div className="helper-text">Strategy: {speedResult.pricing.strategy_label}</div>
                    <div className="helper-text">Planning range: {speedPlanningRange}</div>
                    <div className="helper-text">Range basis: {strategyPricingPlan.basisLine}</div>
                    <div className="helper-text">Anchor: {strategyPricingPlan.anchorDisplay}</div>
                    <div className="helper-text">Entry option: {strategyPricingPlan.entryOptionDisplay}</div>
                    <div className="helper-text">Close path: {speedResult.pricing.close_path}</div>
                    <div className="helper-text">Crew time: {strategyPricingPlan.crewRangeLabel}</div>
                  </div>
                  <div className="speed-output-card">
                    <div className="speed-output-label">Close Asks</div>
                    <TextArea
                      rows={3}
                      value={editableSpeedCopy.primaryCloseAsk}
                      onChange={(value) => updateSpeedDraft("primaryCloseAsk", value)}
                      placeholder="Generated primary close ask"
                    />
                    {speedCopyDirty.primaryCloseAsk ? (
                      <div className="helper-text">Edited from generated close ask.</div>
                    ) : null}
                    <div className="helper-text">{speedCopy.backupCloseAsk}</div>
                  </div>
                </div>
                {strategyPricingPlan.phasePlan ? (
                  <div className="speed-output-card">
                    <div className="speed-output-label">Phase Option</div>
                    <div className="speed-output-copy">{strategyPricingPlan.phasePlan.script}</div>
                  </div>
                ) : null}
                <div className="speed-output-card">
                  <div className="speed-output-label">Follow-Up Text</div>
                  <TextArea
                    rows={4}
                    value={editableSpeedCopy.followUpText}
                    onChange={(value) => updateSpeedDraft("followUpText", value)}
                    placeholder="Generated follow-up text"
                  />
                  {speedCopyDirty.followUpText ? (
                    <div className="helper-text">Edited from generated follow-up.</div>
                  ) : null}
                </div>
                {primaryObjection ? (
                  <div className="speed-output-card">
                    <div className="speed-output-label">Fast Objection Reply</div>
                    <div className="speed-output-copy">{primaryObjection.respond_with}</div>
                  </div>
                ) : null}
                <div className="speed-output-card">
                  <div className="speed-output-label">Proof</div>
                  {speedProofSlots.length ? (
                    <>
                      <div className="photo-strip">
                        {speedProofSlots.map((slot) => (
                          <div key={slot.photo.id} className="speed-proof-card">
                            <QuickPhoto photo={slot.photo} />
                            <div className="speed-proof-caption">
                              {speedCopy.proofCaptionMap[slot.priority_key] || "Field note"}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="helper-text">
                        Use these 1-2 proof items to anchor the next move. You can override them below.
                      </div>
                    </>
                  ) : (
                    <div className="helper-text">{speedResult.proof.empty_state_message}</div>
                  )}
                </div>
                <div className="button-row">
                  <button
                    className="primary button-small"
                    type="button"
                    onClick={() => handleCopy(editableSpeedCopy.talkTrack, "Talk track copied")}
                  >
                    Copy Talk Track
                  </button>
                  <button
                    className="ghost button-small"
                    type="button"
                    onClick={() => handleCopy(editableSpeedCopy.primaryCloseAsk, "Primary close copied")}
                  >
                    Copy Primary Close
                  </button>
                  <button
                    className="ghost button-small"
                    type="button"
                    onClick={() => handleCopy(editableSpeedCopy.followUpText, "Follow-up copied")}
                  >
                    Copy Follow-Up
                  </button>
                  <button
                    className="ghost button-small"
                    type="button"
                    onClick={resetSpeedDraftsToGenerated}
                  >
                    Reset to Generated
                  </button>
                  {primaryObjection ? (
                    <button
                      className="ghost button-small"
                      type="button"
                      onClick={() => handleCopy(primaryObjection.respond_with, "Objection reply copied")}
                    >
                      Copy Objection
                    </button>
                  ) : null}
                  <button className="ghost button-small" type="button" onClick={handleCopyPack}>
                    Copy Full Pack
                  </button>
                </div>
                {speedResult.handoff.handoff_target !== "none" ? (
                  <div className="signal-group neutral">
                    <div className="signal-subtitle">
                      {speedResult.handoff.handoff_target === "internal_review"
                        ? "Internal Review Required"
                        : "Controlled Mode Available"}
                    </div>
                    <div className="helper-text">
                      {speedResult.handoff.handoff_target === "internal_review"
                        ? "Do not force field pricing. Capture proof, confirm stakeholders, and route this for review."
                        : "Use Proposal Builder below when you need written pricing, deeper assumptions, or forwarding prep."}
                    </div>
                    {speedResult.handoff.handoff_target === "controlled_mode" ? (
                      <div className="button-row">
                        <button
                          className="ghost button-small"
                          type="button"
                          onClick={openProposalBuilder}
                        >
                          Open Proposal Builder
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">Speed Mode is loading.</div>
        )}
      </div>

      {isBuilderMode ? (
        <div className="detail-card builder-handoff-card">
          <div className="card-title">Speed Mode Handoff</div>
          <div className="helper-text">
            Proposal Builder inherits the field judgment below so the rep is not rebuilding posture from scratch.
          </div>
          <div className="speed-signal-row">
            <div className={`speed-signal-chip ${builderSyncNeeded ? "risk" : lastBuilderHandoffAt ? "is-success" : ""}`}>
              {builderSyncNeeded ? "Needs Refresh" : lastBuilderHandoffAt ? "Synced from Speed Mode" : "Not Synced Yet"}
            </div>
            {lastBuilderHandoffAt ? (
              <div className="speed-signal-chip">Synced {formatDateTime(lastBuilderHandoffAt)}</div>
            ) : null}
          </div>
          <div className="snapshot-grid">
            <div className="snapshot-card">
              <div className="snapshot-value">{speedCopy?.statusLabel || fieldStatus.label}</div>
              <div className="snapshot-label">Carry-Forward Status</div>
            </div>
            <div className="snapshot-card">
              <div className="snapshot-value">{speedResult?.pricing?.strategy_label || "None"}</div>
              <div className="snapshot-label">Pricing Strategy</div>
            </div>
            <div className="snapshot-card">
              <div className="snapshot-value">{speedPlanningRange}</div>
              <div className="snapshot-label">Planning Range</div>
            </div>
            <div className="snapshot-card">
              <div className="snapshot-value">
                {lastBuilderHandoffAt ? formatDateTime(lastBuilderHandoffAt) : "Not synced yet"}
              </div>
              <div className="snapshot-label">Last Builder Sync</div>
            </div>
          </div>
          {builderSyncNeeded ? (
            <div className="estimate-warning">
              Speed Mode changed after the last builder sync. Refresh from Speed Mode before finalizing builder outputs.
            </div>
          ) : null}
          <div className="signal-group neutral">
            <div className="signal-subtitle">Handoff Summary</div>
            <pre className="template-text pre-wrap builder-handoff-summary">{builderHandoffSummary}</pre>
          </div>
          <div className="button-row">
            <button className="ghost button-small" type="button" onClick={syncBuilderFromSpeedMode}>
              Refresh from Speed Mode
            </button>
            <button
              className="ghost button-small"
              type="button"
              onClick={() => handleCopy(builderHandoffSummary, "Handoff summary copied")}
            >
              Copy Handoff Summary
            </button>
          </div>
        </div>
      ) : null}

      {isBuilderMode ? (
        <div className="detail-card">
          <div className="card-title">Situation Summary</div>
          <div className="card-body">
            <div>Angle: {angleContent.label}</div>
            <div>Hazard: {hazardTotal} / 10 ({hazardBand})</div>
            <div>Confidence: {confidence}</div>
            <div>Field status: {fieldStatus.label}</div>
            <div>Why this matters: {angleContent.why}</div>
            <div>Last scouted: {formatDateTime(assessment.updated_at || assessment.created_at)}</div>
          </div>
        </div>
      ) : null}

      <div className="section">
        {renderSectionHeader(isFieldMode ? "Proof Override" : "Evidence Quick View", "photos")}
        {sectionOpen.photos ? (
          <div className="section-body">
            {photos.length ? (
              <>
                <div className="detail-card">
                  <div className="card-title">Field Pack Proof</div>
                  <div className="helper-text">
                    Choose up to 2 photos that best support the conversation. Highest-risk tags are preselected.
                  </div>
                  {featuredPhotos.length ? (
                    <div className="photo-strip">
                      {featuredPhotos.map((photo) => (
                        <QuickPhoto key={photo.id} photo={photo} />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">No proof photos selected yet.</div>
                  )}
                  <div className="chip-row evidence-chip-row">
                    {sortedPhotos.slice(0, 8).map((photo, index) => {
                      const selected = evidencePhotoIds.includes(photo.id);
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          className={`ghost button-small evidence-chip ${selected ? "is-selected" : ""}`}
                          onClick={() => toggleEvidencePhoto(photo.id)}
                        >
                          {selected ? "Proof" : "Use as Proof"}: {formatPhotoTag(photo.tag || `photo_${index + 1}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="detail-card">
                  <div className="card-title">Recent Photos</div>
                  <div className="photo-strip">
                    {sortedPhotos.slice(0, 6).map((photo) => (
                      <QuickPhoto key={photo.id} photo={photo} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="detail-card">No photos attached to this assessment yet.</div>
            )}
          </div>
        ) : null}
      </div>

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Coaching Panel", "coaching")}
        {sectionOpen.coaching ? (
          <div className="section-body">
            <div className="signal-group positive">
              <div className="signal-subtitle">How to Frame It</div>
              <div className="helper-text">{angleContent.opening}</div>
            </div>
            <div className="signal-group neutral">
              <div className="signal-subtitle">What to Ask</div>
              <ul className="signal-list">
                {angleContent.questions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="signal-group negative">
              <div className="signal-subtitle">What Not to Do</div>
              <ul className="signal-list">
                {angleContent.avoid.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader(
          "Field Script",
          "fieldScript",
          <button className="ghost button-small" type="button" onClick={handleCopyPack}>
            Copy Pack
          </button>
        )}
        {sectionOpen.fieldScript ? (
          <div className="section-body">
            <div className="signal-group positive">
              <div className="signal-subtitle">Opening Line</div>
              <div className="helper-text">{angleContent.opening}</div>
            </div>
            <div className="signal-group neutral">
              <div className="signal-subtitle">Hook (Observation → Impact → Ask)</div>
              <div className="helper-text">{openingLine}</div>
              <div className="helper-text">{impactLine}</div>
              <div className="helper-text">{askLine}</div>
            </div>
            <div className="signal-group positive">
              <div className="signal-subtitle">Price Framing</div>
              <div className="helper-text">“{priceLine}”</div>
            </div>
            <div className="signal-group neutral">
              <div className="signal-subtitle">Next Step</div>
              <div className="helper-text">{nextStepLine}</div>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Estimate Inputs", "estimateInputs")}
        {sectionOpen.estimateInputs ? (
          <div className="section-body">
            <div className="estimate-card">
              <div className="estimate-grid">
                <Field label="Estimated Terminations">
                  <Input
                    type="number"
                    value={inputs.terminations}
                    onChange={(value) => setInputs((current) => ({ ...current, terminations: value }))}
                    placeholder="e.g. 100"
                  />
                </Field>
                <Field label="Estimated Buildings">
                  <Input
                    type="number"
                    value={inputs.buildings}
                    onChange={(value) => setInputs((current) => ({ ...current, buildings: value }))}
                    placeholder="e.g. 3"
                  />
                </Field>
                <TileGroup
                  label="Building Height"
                  value={inputs.height}
                  onChange={(value) => setInputs((current) => ({ ...current, height: value }))}
                  options={[
                    { value: "1-2", label: "1–2 Floors", helper: "1.0x" },
                    { value: "3", label: "3 Floors", helper: "1.25x" },
                    { value: "4+", label: "4+ Floors", helper: "1.4x" }
                  ]}
                />
                <TileGroup
                  label="Condition"
                  value={inputs.condition}
                  onChange={(value) => setInputs((current) => ({ ...current, condition: value }))}
                  options={[
                    { value: "normal", label: "Normal", helper: "Base range" },
                    { value: "heavy", label: "Heavy buildup", helper: "+$10–$20/vent" },
                    { value: "hazard", label: "Blocked / hazard", helper: "+$20–$40/vent" }
                  ]}
                />
                <TileGroup
                  label="Access Difficulty"
                  value={inputs.access}
                  onChange={(value) => setInputs((current) => ({ ...current, access: value }))}
                  options={[
                    { value: "easy", label: "Easy", helper: "1.0x" },
                    { value: "moderate", label: "Moderate", helper: "1.1x" },
                    { value: "difficult", label: "Difficult", helper: "1.25x" }
                  ]}
                />
                <Segmented
                  label="Vent Count Confidence"
                  value={inputs.ventConfidence}
                  onChange={(value) => setInputs((current) => ({ ...current, ventConfidence: value }))}
                  options={[
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "low", label: "Low" }
                  ]}
                />
                <Segmented
                  label="Quote Mode"
                  value={inputs.quoteMode}
                  onChange={(value) => setInputs((current) => ({ ...current, quoteMode: value }))}
                  options={[
                    { value: "budgetary", label: "Budgetary Range" },
                    { value: "walkthrough", label: "Walkthrough Confirmed" },
                    { value: "proposal", label: "Full Proposal" }
                  ]}
                />
                <div className="field">
                  <div className="field-label">Adders</div>
                  <div className="checklist">
                    <label className="check-item">
                      <input
                        type="checkbox"
                        checked={inputs.birdGuards}
                        onChange={(event) =>
                          setInputs((current) => ({ ...current, birdGuards: event.target.checked }))
                        }
                      />
                      <span>Bird guard / difficult termination (+$10–$25 per vent)</span>
                    </label>
                    <label className="check-item">
                      <input
                        type="checkbox"
                        checked={inputs.travel}
                        onChange={(event) =>
                          setInputs((current) => ({ ...current, travel: event.target.checked }))
                        }
                      />
                      <span>Travel / mobilization needed (+$250)</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="estimate-output">
                <div className="estimate-row">
                  <div>
                    <div className="score-label">Per Vent Range</div>
                    <div className="estimate-value">
                      ${perVentLow}–${perVentHigh}
                    </div>
                  </div>
                  <div>
                    <div className="score-label">Estimated Range</div>
                    <div className="estimate-value">{estimateRange}</div>
                  </div>
                  <div>
                    <div className="score-label">Crew Time</div>
                    <div className="estimate-value">
                      {crewLow && crewHigh ? `${crewLow}–${crewHigh} hrs` : "—"}
                    </div>
                  </div>
                </div>
                <div className="estimate-script">
                  <div className="signal-title">How to Present the Price</div>
                  <div>“{priceLine}”</div>
                </div>
                <div className="helper-text">{strategyPricingPlan.basisLine}</div>
                <div className="helper-text">Anchor: {strategyPricingPlan.anchorDisplay}</div>
                <div className="helper-text">Entry option: {strategyPricingPlan.entryOptionDisplay}</div>
                <div className="estimate-warning">Recommended approach: {angleContent.recommend}</div>
                {pricingModel.minJobApplied ? (
                  <div className="estimate-warning">
                    Minimum job applies ($750) and mobilization may apply (+$250) for small scopes.
                  </div>
                ) : null}
                {pricingModel.normalizedCondition === "hazard" ? (
                  <div className="estimate-warning">
                    Blocked/safety condition detected. Do not offer partial scope.
                  </div>
                ) : null}
                {strategyPricingPlan.phasePlan ? (
                  <div className="estimate-script">
                    <div className="signal-title">Phase Option</div>
                    <div>{strategyPricingPlan.phasePlan.script}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader(
          "Budgetary Pricing Guide",
          "pricingGuide",
          pricingGuideDocument ? (
            <button className="ghost button-small" type="button" onClick={handleDownloadGuideHtml}>
              Download HTML
            </button>
          ) : null
        )}
        {sectionOpen.pricingGuide ? (
          <div className="section-body">
            <div className="snapshot-grid">
              <div className="snapshot-card">
                <div className="snapshot-value">{pricingGuideBundle.resolution.pricing_intent}</div>
                <div className="snapshot-label">Intent</div>
              </div>
              <div className="snapshot-card">
                <div className="snapshot-value">{pricingGuideBundle.resolution.pricing_confidence}</div>
                <div className="snapshot-label">Confidence</div>
              </div>
              <div className="snapshot-card">
                <div className="snapshot-value">
                  {pricingGuideDocument?.price_range_display || "No guide range"}
                </div>
                <div className="snapshot-label">Guide Range</div>
              </div>
              <div className="snapshot-card">
                <div className="snapshot-value">
                  {pricingGuideDocument ? `${pricingGuideDocument.validity_window_days} days` : "Blocked"}
                </div>
                <div className="snapshot-label">Validity</div>
              </div>
            </div>

            {pricingGuideDocument ? (
              <>
                {pricingGuideBundle.inferred_fields.length ? (
                  <div className="estimate-warning">
                    This guide is using conservative planning assumptions derived from current estimate data. Confirm
                    those assumptions before treating the guide as approval-ready.
                  </div>
                ) : null}
                <div className="signal-group neutral">
                  <div className="signal-subtitle">Guide Summary</div>
                  <div className="helper-text">{pricingGuideDocument.scope_summary}</div>
                  <div className="helper-text">{pricingGuideDocument.price_basis_summary}</div>
                </div>
                <div className="signal-group positive">
                  <div className="signal-subtitle">Assumptions</div>
                  <ul className="signal-list">
                    {pricingGuideDocument.assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="signal-group neutral">
                  <div className="signal-subtitle">Modifier Summary</div>
                  <ul className="signal-list">
                    <li>Access: {pricingGuideDocument.modifiers_applied.access}</li>
                    <li>Condition: {pricingGuideDocument.modifiers_applied.condition}</li>
                    <li>Coordination: {pricingGuideDocument.modifiers_applied.coordination}</li>
                    <li>Travel: {pricingGuideDocument.modifiers_applied.travel}</li>
                    <li>Efficiency credit: {pricingGuideDocument.modifiers_applied.efficiency_credit}</li>
                  </ul>
                </div>
                {pricingGuideBundle.inferred_fields.length ? (
                  <div className="signal-group neutral">
                    <div className="signal-subtitle">Derived Planning Inputs</div>
                    <ul className="signal-list">
                      {pricingGuideBundle.inferred_fields.map((entry) => (
                        <li key={`${entry.field}:${String(entry.value)}`}>{entry.reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="button-row">
                  <button
                    className="primary button-small"
                    type="button"
                    onClick={() => handleCopy(pricingGuideBundle.text, "Guide summary copied")}
                  >
                    Copy Guide Summary
                  </button>
                  <button
                    className="ghost button-small"
                    type="button"
                    onClick={() => handleCopy(pricingGuideBundle.html, "Guide HTML copied")}
                  >
                    Copy Guide HTML
                  </button>
                  <button className="ghost button-small" type="button" onClick={handleDownloadGuideHtml}>
                    Download HTML
                  </button>
                </div>
                <div className="template-card">
                  <div className="template-title">HTML Preview</div>
                  <iframe
                    title="Budgetary pricing guide preview"
                    className="budgetary-guide-frame"
                    srcDoc={pricingGuideBundle.html}
                  />
                </div>
              </>
            ) : (
              <div
                className={`signal-group ${
                  pricingGuideBundle.resolution.pricing_intent === "ballpark" ? "neutral" : "negative"
                }`}
              >
                <div className="signal-subtitle">
                  {pricingGuideBundle.resolution.pricing_intent === "ballpark"
                    ? "Ballpark Only"
                    : "Formal Quote Required"}
                </div>
                <div className="helper-text">{pricingGuideGateSummary}</div>
                {pricingGuideBundle.completeness?.missing_required_inputs?.length ? (
                  <ul className="signal-list">
                    {pricingGuideBundle.completeness.missing_required_inputs.map((item) => (
                      <li key={item}>Missing: {item}</li>
                    ))}
                  </ul>
                ) : null}
                {pricingGuideBundle.blockers?.quote_block_reasons?.length ? (
                  <ul className="signal-list">
                    {pricingGuideBundle.blockers.quote_block_reasons.map((reason) => (
                      <li key={reason.code}>{reason.message}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="button-row">
                  <button
                    className="ghost button-small"
                    type="button"
                    onClick={() => handleCopy(pricingGuideBundle.text, "Pricing gate summary copied")}
                  >
                    Copy Gate Summary
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Assumptions", "assumptions")}
        {sectionOpen.assumptions ? (
          <div className="section-body">
            <div className="detail-card">{assumptionLine}</div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Recommendation Engine", "recommendation")}
        {sectionOpen.recommendation ? (
          <div className="section-body">
            <div className="signal-group positive">
              <div className="signal-subtitle">Recommended Approach</div>
              <div className="helper-text">{angleContent.recommend}</div>
            </div>
            <div className="signal-group negative">
              <div className="signal-subtitle">Do Not Offer</div>
              <ul className="signal-list">
                {doNotOffer.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="signal-group neutral">
              <div className="signal-subtitle">Why</div>
              <div className="helper-text">{angleContent.why}</div>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Risk Flags", "riskFlags")}
        {sectionOpen.riskFlags ? (
          <div className="section-body">
            <div className="signal-group negative">
              {riskFlags.length ? (
                <ul className="signal-list">
                  {riskFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              ) : (
                <div className="helper-text">No major flags detected.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Objection Handling", "objections")}
        {sectionOpen.objections ? (
          <div className="section-body">
            <div className="objection-grid">
              {objectionCards.map((card) => (
                <div className="objection-card" key={card.type}>
                  <div className="objection-chip">{card.objection_type}</div>
                  <div className="objection-label">If they say</div>
                  <div className="objection-text">{card.if_they_say}</div>
                  <div className="objection-label">What they usually mean</div>
                  <div className="objection-text">{card.what_they_mean}</div>
                  <div className="objection-label">Respond with</div>
                  <div className="objection-text">{card.respond_with}</div>
                  <button
                    className="ghost button-small"
                    type="button"
                    onClick={() => handleCopy(card.respond_with, "Response copied")}
                  >
                    Copy Response
                  </button>
                  <div className="objection-label">Your goal</div>
                  <div className="objection-text">{card.your_goal}</div>
                  <div className="objection-label">Best next move</div>
                  <div className="objection-text">{card.best_next_move}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Vendor Package Guidance", "vendorGuidance")}
        {sectionOpen.vendorGuidance ? (
          <div className="section-body">
            <div className="signal-group positive">
              <div className="signal-subtitle">Use the full vendor packet when</div>
              <ul className="signal-list">
                <li>They ask for something in writing</li>
                <li>Regional approval or procurement is required</li>
                <li>They want insurance, W-9, or vendor setup details</li>
              </ul>
            </div>
            <div className="signal-group negative">
              <div className="signal-subtitle">Do not overload them when</div>
              <ul className="signal-list">
                <li>They are still trying to understand the issue</li>
                <li>You have not confirmed scope or access</li>
                <li>No interest has been shown yet</li>
              </ul>
            </div>
            <div className="signal-group neutral">
              <div className="signal-subtitle">Branding reminder</div>
              <div className="helper-text">
                All customer-facing materials should use the approved TVG branding, logos, certs, and badges.
              </div>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Delivery Prep", "deliveryPrep")}
        {sectionOpen.deliveryPrep ? (
          <div className="section-body">
            <div className="delivery-grid">
              <Field label="Rep Name (auto-insert)">
                <Input
                  value={repName}
                  onChange={(value) => setRepName(value)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Recipient Name">
                <Input
                  value={delivery.recipientName}
                  onChange={(value) =>
                    setDelivery((current) => ({ ...current, recipientName: value }))
                  }
                  placeholder={assessment?.contact_name || "Manager name"}
                />
              </Field>
              <Field label="Recipient Email">
                <Input
                  value={delivery.recipientEmail}
                  onChange={(value) =>
                    setDelivery((current) => ({ ...current, recipientEmail: value }))
                  }
                  placeholder={assessment?.contact_email || "email@company.com"}
                />
              </Field>
              <Field label="Recipient Phone">
                <Input
                  value={delivery.recipientPhone}
                  onChange={(value) =>
                    setDelivery((current) => ({ ...current, recipientPhone: value }))
                  }
                  placeholder={assessment?.contact_phone || "(555) 555-5555"}
                />
              </Field>
              <Segmented
                label="Delivery Method"
                value={delivery.method}
                onChange={(value) => setDelivery((current) => ({ ...current, method: value }))}
                options={[
                  { value: "email", label: "Email" },
                  { value: "text", label: "Text" },
                  { value: "both", label: "Both" }
                ]}
              />
              <div className="field">
                <div className="field-label">Attachments</div>
                <div className="checklist">
                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={delivery.includePacket}
                      onChange={(event) =>
                        setDelivery((current) => ({
                          ...current,
                          includePacket: event.target.checked
                        }))
                      }
                    />
                    <span>Vendor packet (branded)</span>
                  </label>
                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={delivery.includeCoi}
                      onChange={(event) =>
                        setDelivery((current) => ({
                          ...current,
                          includeCoi: event.target.checked
                        }))
                      }
                    />
                    <span>Certificate of insurance</span>
                  </label>
                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={delivery.includeW9}
                      onChange={(event) =>
                        setDelivery((current) => ({
                          ...current,
                          includeW9: event.target.checked
                        }))
                      }
                    />
                    <span>W-9</span>
                  </label>
                </div>
              </div>
              <Segmented
                label="Regional Forward Version"
                value={delivery.regionalForward ? "yes" : "no"}
                onChange={(value) =>
                  setDelivery((current) => ({ ...current, regionalForward: value === "yes" }))
                }
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" }
                ]}
              />
            </div>
            <div className="helper-text">
              Use Delivery Prep to keep the quote forwardable and compliant with branding requirements.
            </div>
            <button
              className="ghost button-small"
              type="button"
              onClick={() => navigate(`/assessments/${assessmentId}`)}
            >
              Edit Decision Maker Details
            </button>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Quote Delivery Templates", "deliveryTemplates")}
        {sectionOpen.deliveryTemplates ? (
          <div className="section-body">
            <div className="button-row">
              <button
                className="ghost button-small"
                type="button"
                onClick={() =>
                  handleCopy(
                    [
                      `EMAIL SUBJECT: ${subjectLine}`,
                      "",
                      "EMAIL BODY:",
                      emailBody,
                      "",
                      "TEXT MESSAGE:",
                      textBody,
                      "",
                      "REGIONAL FORWARDING NOTE:",
                      regionalBody
                    ].join("\n"),
                    "All delivery copied"
                  )
                }
              >
                Copy All Delivery
              </button>
            </div>
            <div className="template-card">
              <div className="template-title">Email</div>
              <div className="template-label">Subject</div>
              <div className="template-text">{subjectLine}</div>
              <div className="template-label">Body</div>
              <pre className="template-text pre-wrap">{emailBody}</pre>
              <button
                className="ghost button-small"
                type="button"
                onClick={() => handleCopy(`${subjectLine}\n\n${emailBody}`, "Email copied")}
              >
                Copy Email
              </button>
            </div>
            <div className="template-card">
              <div className="template-title">Text Message</div>
              <pre className="template-text pre-wrap">{textBody}</pre>
              <button
                className="ghost button-small"
                type="button"
                onClick={() => handleCopy(textBody, "Text copied")}
              >
                Copy Text
              </button>
            </div>
            <div className="template-card">
              <div className="template-title">Regional Forwarding Note</div>
              <pre className="template-text pre-wrap">{regionalBody}</pre>
              <button
                className="ghost button-small"
                type="button"
                onClick={() => handleCopy(regionalBody, "Forwarding note copied")}
              >
                Copy Forwarding Note
              </button>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Manual Follow-Through", "quoteActions")}
        {sectionOpen.quoteActions ? (
          <div className="section-body">
            <div className="detail-card">
              <div className="helper-text">
                This tool prepares copy only. Email, text, packet sending, and quote generation are
                still manual follow-through steps.
              </div>
              {needsContact ? (
                <div className="estimate-warning">
                  Decision maker details are missing. Capture contact info before sending.
                </div>
              ) : null}
              <div className="signal-group neutral">
                <div className="signal-subtitle">Recommended next move</div>
                <div className="helper-text">{nextStepLine}</div>
              </div>
              {phasedPlan ? (
                <div className="signal-group positive">
                  <div className="signal-subtitle">Phased option</div>
                  <div className="helper-text">{phasedPlan.script}</div>
                </div>
              ) : null}
              <div className="button-row">
                <button
                  className="primary"
                  type="button"
                  onClick={() => handleCopy(`${subjectLine}\n\n${emailBody}`, "Email copied")}
                >
                  Copy Email
                </button>
                <button className="ghost" type="button" onClick={() => handleCopy(textBody, "Text copied")}>
                  Copy Text
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => handleCopy(regionalBody, "Forwarding note copied")}
                >
                  Copy Forwarding Note
                </button>
                {phasedPlan ? (
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => handleCopy(phasedPlan.script, "Phased option copied")}
                  >
                    Copy Phase Option
                  </button>
                ) : null}
              </div>
              <div className="button-row">
                <button
                  className="ghost button-small"
                  type="button"
                  onClick={() => navigate(`/assessments/${assessmentId}`)}
                >
                  {needsContact ? "Capture Decision Maker" : "Edit Contact Details"}
                </button>
                <button
                  className="ghost button-small"
                  type="button"
                  onClick={() => handleCopyPack()}
                >
                  Copy Full Field Pack
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isBuilderMode ? (
      <div className="section">
        {renderSectionHeader("Proposal Notes", "proposalNotes")}
        {sectionOpen.proposalNotes ? (
          <div className="section-body">
            <Field label="Additional Notes">
              <TextArea
                rows={3}
                value={inputs.notes}
                onChange={(value) => setInputs((current) => ({ ...current, notes: value }))}
                placeholder="Add any proposal notes or negotiation points"
              />
            </Field>
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
