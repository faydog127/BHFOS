import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteAssessment,
  getAssessment,
  getProperty,
  insertPhotos,
  listPhotosByAssessment,
  polishNote,
  processPhotoUploadQueue,
  retryFailedPhotoUploads,
  saveAssessment,
  updateProperty
} from "../db/api";
import { Field, Input, TextArea } from "../components/Field";
import { Segmented, TileGroup, ToggleButtons } from "../components/Segmented";
import PhotoUploader from "../components/PhotoUploader";
import { useToast } from "../components/Toast";
import { navigate } from "../router";
import { buildPhotoFilename, formatDateTime } from "../utils/format";
import { clearDraft, loadDraft, loadDraftMeta, saveDraft, saveDraftMeta } from "../utils/draft";
import { computeAccessDifficulty } from "../utils/accessDifficulty";
import { computeMomentumSuggestion, computeTotalScore } from "../utils/scoring";
import { computeHazardBand, computeHazardPrimaryAngle, computeHazardTotal } from "../utils/hazardScore";
import { composeHookText, normalizeAssessmentHooks } from "../utils/assessment";
import {
  derivePropertyClass,
  getPropertyClassWarnings,
  PROPERTY_CLASS_OPTIONS
} from "../utils/propertyClass";

export default function AssessmentForm({ assessmentId }) {
  const [assessment, setAssessment] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [property, setProperty] = useState(null);
  const [status, setStatus] = useState({ dirty: false, savedAt: null });
  const [localBackupAt, setLocalBackupAt] = useState(null);
  const [propertyClassInputs, setPropertyClassInputs] = useState({
    exterior_condition: "",
    maintenance_signals: "",
    overall_feel: ""
  });
  const [propertyClassErrors, setPropertyClassErrors] = useState({});
  const [ready, setReady] = useState(false);
  const [polishState, setPolishState] = useState({});
  const [polishUndo, setPolishUndo] = useState({});
  const assessmentAutosaveRef = useRef("");
  const photoAutosaveRef = useRef("");
  const propertyAutosaveRef = useRef("");
  const { showToast } = useToast();

  const draftKey = `assessment:${assessmentId}`;

  useEffect(() => {
    let active = true;

    const load = async () => {
      const draft = loadDraft(draftKey);
      const meta = loadDraftMeta(draftKey);
      if (draft && active) {
        setAssessment(normalizeAssessmentHooks(draft.assessment));
        setPhotos(draft.photos || []);
        if (draft.propertyClassInputs) {
          setPropertyClassInputs(draft.propertyClassInputs);
        }
        setStatus(meta || { dirty: true, savedAt: null });
        setReady(true);
        return;
      }

      const existing = await getAssessment(assessmentId);
      if (existing && active) {
        const photoRows = await listPhotosByAssessment(assessmentId);
        setAssessment(normalizeAssessmentHooks(existing));
        setPhotos(photoRows.map((photo) => ({ ...photo, persisted: true, dirty: false })));
        setStatus({ dirty: false, savedAt: existing.updated_at || existing.created_at });
        setReady(true);
        return;
      }

      setReady(true);
    };

    load();

    return () => {
      active = false;
    };
  }, [assessmentId, draftKey]);

  useEffect(() => {
    if (!ready || !assessment) return;
    saveDraft(draftKey, { assessment, photos, propertyClassInputs });
    saveDraftMeta(draftKey, status);
  }, [assessment, photos, propertyClassInputs, status, ready, draftKey]);

  useEffect(() => {
    if (!assessment?.property_id) return;
    let active = true;
    getProperty(assessment.property_id).then((row) => {
      if (active) setProperty(row);
    });
    return () => {
      active = false;
    };
  }, [assessment?.property_id]);

  useEffect(() => {
    if (!property) return;
    setPropertyClassInputs((current) => ({
      exterior_condition: current.exterior_condition || property.exterior_condition || "",
      maintenance_signals: current.maintenance_signals || property.maintenance_signals || "",
      overall_feel: current.overall_feel || property.overall_feel || ""
    }));
  }, [property]);

  const markDirty = () => {
    setStatus((current) => ({ ...current, dirty: true }));
  };

  const updateAssessment = (patch) => {
    setAssessment((current) => {
      const next = { ...current, ...patch };
      if ("hook_observation" in patch || "hook_impact" in patch || "hook_ask" in patch) {
        next.hook = composeHookText(next);
      }
      return next;
    });
    markDirty();
  };

  const assessmentAutosaveSignature = useMemo(() => {
    if (!assessment) return "";
    const {
      created_at: _createdAt,
      updated_at: _updatedAt,
      total_score: _totalScore,
      hazard_total: _hazardTotal,
      hazard_primary_angle: _hazardPrimaryAngle,
      access_difficulty: _accessDifficulty,
      ...rest
    } = assessment;
    return JSON.stringify(rest);
  }, [assessment]);

  const photoAutosaveSignature = useMemo(
    () =>
      JSON.stringify(
        [...photos]
          .map((photo) => ({
            id: photo.id,
            timestamp: photo.timestamp || "",
            tag: photo.tag || "",
            note: photo.note || "",
            original_filename: photo.original_filename || "",
            stored_filename: photo.stored_filename || "",
            storage_uri: photo.storage_uri || ""
          }))
          .sort((left, right) => left.id.localeCompare(right.id))
      ),
    [photos]
  );

  const propertyAutosaveSignature = useMemo(
    () => JSON.stringify(propertyClassInputs),
    [propertyClassInputs]
  );

  const accessDifficulty = useMemo(
    () =>
      computeAccessDifficulty({
        building_height: assessment?.building_height,
        termination_type: assessment?.termination_type,
        access_constraints: assessment?.access_constraints
      }),
    [assessment?.building_height, assessment?.termination_type, assessment?.access_constraints]
  );

  useEffect(() => {
    if (!ready || !assessment || status.dirty) return;
    assessmentAutosaveRef.current = assessmentAutosaveSignature;
  }, [ready, assessment, status.dirty, assessmentAutosaveSignature]);

  const setPolishing = (field, value) => {
    setPolishState((current) => ({ ...current, [field]: value }));
  };

  const setUndoSnapshot = (field, value) => {
    setPolishUndo((current) => ({ ...current, [field]: value }));
  };

  const clearUndoSnapshot = (field) => {
    setPolishUndo((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handlePolish = async (field, value, contextLabel) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      showToast({ type: "warning", title: "Nothing to polish", message: "Add a note first." });
      return;
    }
    setPolishing(field, true);
    try {
      const result = await polishNote({
        text: trimmed,
        context: contextLabel,
        field
      });
      const polished =
        result?.polished || result?.text || result?.output || result?.message || "";
      if (!polished) {
        showToast({ type: "warning", title: "No polish returned", message: "Try again." });
        return;
      }
      setUndoSnapshot(field, trimmed);
      updateAssessment({ [field]: polished });
      showToast({ type: "success", title: "Note polished", message: "Updated with a professional rewrite." });
    } catch (error) {
      let message = error?.message || "Could not polish note.";
      const body = error?.context?.body;
      if (body && typeof body === "string") {
        try {
          const parsed = JSON.parse(body);
          if (parsed?.error) message = parsed.error;
        } catch {
          // ignore parse failures
        }
      }
      showToast({ type: "error", title: "Polish failed", message });
    } finally {
      setPolishing(field, false);
    }
  };

  const handleUndoPolish = (field) => {
    const previous = polishUndo[field];
    if (!previous) return;
    updateAssessment({ [field]: previous });
    clearUndoSnapshot(field);
    showToast({ type: "info", title: "Undo applied", message: "Restored the previous note." });
  };

  const renderPolishAction = (field, value, contextLabel) => {
    const undoAvailable = Boolean(polishUndo[field]);
    return (
      <>
        <button
          type="button"
          className="field-action"
          onClick={() => handlePolish(field, value, contextLabel)}
          disabled={Boolean(polishState[field])}
        >
          {polishState[field] ? "Polishing..." : "Polish"}
        </button>
        {undoAvailable ? (
          <button
            type="button"
            className="field-action"
            onClick={() => handleUndoPolish(field)}
            disabled={Boolean(polishState[field])}
          >
            Undo
          </button>
        ) : null}
      </>
    );
  };

  const toggleDisqualifier = (value) => {
    const current = disqualifierReasons;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    updateAssessment({ disqualifier_reasons: next, disqualified: next.length > 0 });
  };

  const updatePropertyClassInputs = (patch) => {
    setPropertyClassInputs((current) => ({ ...current, ...patch }));
    setPropertyClassErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((field) => {
        if (patch[field]) delete next[field];
      });
      return next;
    });
    markDirty();
  };

  const updatePhotos = (updater) => {
    setPhotos((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (next !== current) {
        setStatus((statusCurrent) => ({ ...statusCurrent, dirty: true }));
      }
      return next;
    });
  };

  const refreshPhotosFromDb = async (targetId = assessmentId) => {
    const rows = await listPhotosByAssessment(targetId);
    setPhotos((current) => {
      const persisted = rows.map((photo) => ({ ...photo, persisted: true, dirty: false }));
      const persistedIds = new Set(persisted.map((photo) => photo.id));
      const persistedNames = new Set(
        persisted.map((photo) => (photo.stored_filename || "").trim()).filter(Boolean)
      );
      const persistedKeys = new Set(
        persisted.map((photo) => `${photo.timestamp || ""}::${photo.original_filename || ""}`)
      );
      const drafts = current.filter((photo) => {
        if (photo.persisted) return false;
        if (persistedIds.has(photo.id)) return false;
        const name = (photo.stored_filename || "").trim();
        if (name && persistedNames.has(name)) return false;
        const key = `${photo.timestamp || ""}::${photo.original_filename || ""}`;
        return !persistedKeys.has(key);
      });
      return [...drafts, ...persisted];
    });
  };

  useEffect(() => {
    if (!ready || !assessment || !assessmentAutosaveSignature) return;
    if (assessmentAutosaveSignature === assessmentAutosaveRef.current) return;
    const timeout = setTimeout(async () => {
      try {
        const composedHook = composeHookText(assessment);
        const saved = await saveAssessment({
          ...assessment,
          hook: composedHook,
          access_difficulty: accessDifficulty || assessment.access_difficulty || ""
        });
        assessmentAutosaveRef.current = assessmentAutosaveSignature;
        setAssessment((current) =>
          current
            ? {
                ...current,
                hook: composedHook,
                created_at: current.created_at || saved.created_at,
                updated_at: saved.updated_at,
                total_score: saved.total_score,
                hazard_total: saved.hazard_total,
                hazard_primary_angle: saved.hazard_primary_angle,
                access_difficulty: saved.access_difficulty || accessDifficulty || ""
              }
            : current
        );
        setLocalBackupAt(saved.updated_at);
      } catch (error) {
        console.warn("Assessment autosave failed", error);
      }
    }, 900);
    return () => clearTimeout(timeout);
  }, [ready, assessment, assessmentAutosaveSignature, accessDifficulty]);

  const photosNeedPersistence = useMemo(
    () => photos.some((photo) => !photo.persisted || photo.dirty),
    [photos]
  );

  useEffect(() => {
    if (!ready || photosNeedPersistence) return;
    photoAutosaveRef.current = photoAutosaveSignature;
  }, [ready, photosNeedPersistence, photoAutosaveSignature]);

  useEffect(() => {
    if (!ready || !assessment?.id || !photosNeedPersistence || !photoAutosaveSignature) return;
    if (photoAutosaveSignature === photoAutosaveRef.current) return;
    const timeout = setTimeout(async () => {
      try {
        const pending = photos
          .filter((photo) => photo.storage_uri && (!photo.persisted || photo.dirty))
          .map((photo) => ({
            ...photo,
            assessment_id: assessment.id
          }));
        const result = await insertPhotos(pending);
        photoAutosaveRef.current = photoAutosaveSignature;
        await refreshPhotosFromDb(assessment.id);
        if (result.failed?.length) {
          showToast({
            type: "error",
            title: "Photo save failed",
            message: `Failed: ${result.failed.map((photo) => photo.stored_filename).join(", ")}`
          });
        }
      } catch (error) {
        console.warn("Photo autosave failed", error);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [ready, assessment?.id, photos, photosNeedPersistence, photoAutosaveSignature, showToast]);

  useEffect(() => {
    if (!ready || !property?.id || !propertyAutosaveSignature) return;
    if (propertyAutosaveSignature === propertyAutosaveRef.current) return;
    const fields = ["exterior_condition", "maintenance_signals", "overall_feel"];
    const changed = fields.some((field) => (property[field] || "") !== (propertyClassInputs[field] || ""));
    if (!changed) {
      propertyAutosaveRef.current = propertyAutosaveSignature;
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const computedClass = derivePropertyClass(propertyClassInputs);
        await updateProperty(property.id, {
          ...property,
          ...propertyClassInputs,
          property_class: computedClass,
          class_guess: computedClass
        });
        propertyAutosaveRef.current = propertyAutosaveSignature;
        setProperty((current) =>
          current
            ? {
                ...current,
                ...propertyClassInputs,
                property_class: computedClass,
                class_guess: computedClass
              }
            : current
        );
      } catch (error) {
        console.warn("Property autosave failed", error);
      }
    }, 900);
    return () => clearTimeout(timeout);
  }, [ready, property, propertyClassInputs, propertyAutosaveSignature]);

  const isQuick = assessment?.scout_mode !== "full";

  const dueOptions = useMemo(() => {
    const formatDate = (date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    const today = new Date();
    const addDays = (days) => {
      const next = new Date(today);
      next.setDate(next.getDate() + days);
      return formatDate(next);
    };
    return [
      { value: "today", label: "Today", date: addDays(0) },
      { value: "2d", label: "2 Days", date: addDays(2) },
      { value: "1w", label: "1 Week", date: addDays(7) },
      { value: "2w", label: "2 Weeks", date: addDays(14) },
      { value: "none", label: "None", date: "" }
    ];
  }, []);

  const dueValueMap = useMemo(() => {
    return dueOptions.reduce((acc, option) => {
      if (option.date) acc[option.date] = option.value;
      return acc;
    }, {});
  }, [dueOptions]);

  const selectedDueValue = useMemo(() => {
    if (!assessment?.next_action_due) return "none";
    return dueValueMap[assessment.next_action_due] || "custom";
  }, [assessment?.next_action_due, dueValueMap]);

  const signalGuide = useMemo(
    () => ({
      positive: [
        "Visible lint buildup at terminations",
        "Blocked or restricted termination",
        "Damaged or missing vent cover",
        "Improper termination or unsafe routing",
        "Evidence of neglected maintenance or reactive fixes"
      ],
      negative: [
        "Clean, recently maintained terminations",
        "Visible upgraded covers or recent repairs",
        "Clear evidence of proactive maintenance"
      ],
      neutral: [
        "Termination not visible",
        "Access blocked or unsafe to reach",
        "Unclear condition, needs follow-up"
      ]
    }),
    []
  );

  const opportunityGuide = useMemo(
    () => ({
      high: [
        "Multiple negative signals (lint + damage + blockage)",
        "Visible safety hazard or code risk",
        "Clear service gap evidence"
      ],
      medium: [
        "Some lint or minor damage",
        "Mixed maintenance signals",
        "Access is possible but not easy"
      ],
      low: [
        "Clean, well-maintained terminations",
        "No visible risk or service gap",
        "Access blocked and no clear evidence"
      ]
    }),
    []
  );

  const disqualifierOptions = useMemo(
    () => [
      { value: "no_access_path", label: "No access path" },
      { value: "no_usable_note", label: "No usable note" },
      { value: "no_clear_hook", label: "No clear hook" },
      { value: "entry_impossible", label: "Entry impossible" },
      { value: "no_management", label: "No management or repeat potential" }
    ],
    []
  );

  const disqualifierReasons = Array.isArray(assessment?.disqualifier_reasons)
    ? assessment.disqualifier_reasons
    : [];

  const totalScore = useMemo(() => computeTotalScore(assessment), [assessment]);
  const hazardTotal = useMemo(() => computeHazardTotal(assessment), [assessment]);
  const hazardBand = useMemo(() => computeHazardBand(hazardTotal), [hazardTotal]);
  const hazardPrimaryAngle = useMemo(() => {
    if (!assessment) return "watch";
    return computeHazardPrimaryAngle({ ...assessment, hazard_total: hazardTotal });
  }, [assessment, hazardTotal]);
  const hazardAngleLabel = useMemo(() => {
    const labels = {
      safety: "Safety",
      repeat_service: "Repeat Service Calls",
      process_gap: "Process Gap",
      watch: "Watch"
    };
    return labels[hazardPrimaryAngle] || "Watch";
  }, [hazardPrimaryAngle]);
  const momentumSuggestion = useMemo(
    () => computeMomentumSuggestion(assessment),
    [assessment?.follow_up_priority, assessment?.next_action_due]
  );

  const hookSeed = useMemo(() => {
    const signalParts = [];
    if (assessment?.on_site_office_visible === true) signalParts.push("visible lint buildup");
    if (assessment?.leasing_activity_visible === true) signalParts.push("a blocked or restricted termination");
    if (assessment?.maintenance_presence_visible === true) {
      signalParts.push("a damaged or missing cover");
    }

    const observation =
      signalParts.length > 0
        ? `At ${property?.property_name || "the property"}, I saw ${signalParts.join(" and ")}.`
        : accessDifficulty === "High Risk"
          ? `Access was limited and the vent path still needs closer confirmation.`
          : `The visible dryer vent evidence is limited, but the site still suggests a maintenance review.`;

    const impact =
      hazardTotal >= 7
        ? "That points to restricted airflow, repeat service risk, and a stronger safety concern."
        : totalScore >= 5
          ? "That usually means preventable maintenance calls and a service gap worth addressing."
          : "That is enough to justify a closer look before it turns into a larger maintenance issue.";

    const ask =
      assessment?.decision_maker_known
        ? "Would you be open to a quick walkthrough so we can confirm scope and talk through next steps?"
        : "Who would be the right person to review a walkthrough or next-step recommendation?";

    return { observation, impact, ask };
  }, [
    assessment?.decision_maker_known,
    assessment?.leasing_activity_visible,
    assessment?.maintenance_presence_visible,
    assessment?.on_site_office_visible,
    accessDifficulty,
    hazardTotal,
    property?.property_name,
    totalScore
  ]);

  const handleAutoFillHook = async () => {
    if (!assessment) return;
    setPolishing("hook_builder", true);
    try {
      const [observationResult, impactResult, askResult] = await Promise.all([
        polishNote({
          text: hookSeed.observation,
          context:
            "Observation hook for a field scouting report. Keep it direct, concrete, and to 1-2 short sentences.",
          field: "hook_observation"
        }),
        polishNote({
          text: hookSeed.impact,
          context:
            "Impact hook for a field scouting report. Explain why the observation matters in 1-2 short sentences.",
          field: "hook_impact"
        }),
        polishNote({
          text: hookSeed.ask,
          context:
            "Ask hook for a field scouting report. Give a simple next-step ask in 1-2 short sentences.",
          field: "hook_ask"
        })
      ]);

      const patch = {
        hook_observation:
          observationResult?.polished || observationResult?.text || hookSeed.observation,
        hook_impact: impactResult?.polished || impactResult?.text || hookSeed.impact,
        hook_ask: askResult?.polished || askResult?.text || hookSeed.ask
      };
      setUndoSnapshot("hook_builder", {
        hook_observation: assessment.hook_observation || "",
        hook_impact: assessment.hook_impact || "",
        hook_ask: assessment.hook_ask || ""
      });
      updateAssessment(patch);
      showToast({
        type: "success",
        title: "Hook generated",
        message: "Observation, impact, and ask were filled in."
      });
    } catch (error) {
      setUndoSnapshot("hook_builder", {
        hook_observation: assessment.hook_observation || "",
        hook_impact: assessment.hook_impact || "",
        hook_ask: assessment.hook_ask || ""
      });
      updateAssessment({
        hook_observation: hookSeed.observation,
        hook_impact: hookSeed.impact,
        hook_ask: hookSeed.ask
      });
      showToast({
        type: "warning",
        title: "AI unavailable",
        message: "Used the built-in hook draft. You can edit or polish each box."
      });
    } finally {
      setPolishing("hook_builder", false);
    }
  };

  const handleUndoHookBuilder = () => {
    const previous = polishUndo.hook_builder;
    if (!previous) return;
    updateAssessment(previous);
    clearUndoSnapshot("hook_builder");
    showToast({ type: "info", title: "Hook restored", message: "Restored the previous hook text." });
  };

  const requiresAccessPhoto = useMemo(() => {
    if (!assessment) return false;
    const constrained = ["moderate", "major"].includes(assessment.access_constraints);
    return assessment.termination_type === "mixed" || accessDifficulty === "High Risk" || constrained;
  }, [assessment, accessDifficulty]);

  const hasPendingUploads = useMemo(
    () =>
      photos.some((photo) => {
        if (!photo.persisted) return false;
        const uri = photo.storage_uri || "";
        if (!uri || uri.startsWith("idb://")) return true;
        return ["queued", "uploading", "failed"].includes(photo.upload_status);
      }),
    [photos]
  );

  useEffect(() => {
    if (!assessmentId || !hasPendingUploads) return undefined;
    const interval = setInterval(async () => {
      await processPhotoUploadQueue({ assessmentId });
      await refreshPhotosFromDb(assessmentId);
    }, 8000);
    return () => clearInterval(interval);
  }, [assessmentId, hasPendingUploads]);

  const handleRetryFailedUploads = async () => {
    if (!assessmentId) return;
    const result = await retryFailedPhotoUploads(assessmentId);
    await refreshPhotosFromDb(assessmentId);
    if (result?.skipped && result.reason === "none") {
      showToast({ type: "info", title: "No failed uploads", message: "All photos are uploaded." });
      return;
    }
    if (result?.skipped && result.reason === "offline") {
      showToast({
        type: "warning",
        title: "Offline",
        message: "Reconnect to upload photos."
      });
      return;
    }
    if (result?.failed) {
      showToast({
        type: "error",
        title: "Uploads failed",
        message: `${result.failed} photos still failed to upload.`
      });
      return;
    }
    showToast({ type: "success", title: "Uploads complete", message: "Photos uploaded." });
  };

  const handleSave = async () => {
    try {
      if (!assessment) return false;
      const classErrors = {};
      if (!propertyClassInputs.exterior_condition) classErrors.exterior_condition = true;
      if (!propertyClassInputs.maintenance_signals) classErrors.maintenance_signals = true;
      if (!propertyClassInputs.overall_feel) classErrors.overall_feel = true;
      if (Object.keys(classErrors).length) {
        setPropertyClassErrors(classErrors);
        showToast({
          type: "error",
          title: "Property classification required",
          message: "Complete exterior condition, maintenance signals, and operational feel."
        });
        return false;
      }

      const computedClass = derivePropertyClass(propertyClassInputs);
      if (property) {
        await updateProperty(property.id, {
          ...property,
          ...propertyClassInputs,
          property_class: computedClass,
          class_guess: computedClass
        });
        setProperty((current) =>
          current
            ? {
                ...current,
                ...propertyClassInputs,
                property_class: computedClass,
                class_guess: computedClass
              }
            : current
        );
      }

      if (!isQuick) {
        if (!assessment.building_height || !assessment.termination_type || !assessment.access_constraints) {
          showToast({
            type: "error",
            title: "Access details required",
            message: "Complete building height, termination type, and access constraints."
          });
          return false;
        }
        if (requiresAccessPhoto && photos.length === 0) {
          showToast({
            type: "error",
            title: "Photo required",
            message: "Add a photo for mixed/complex access before saving."
          });
          return false;
        }
      }

      const normalizedScores = {
        problem_score: Number.isFinite(Number(assessment.problem_score))
          ? Number(assessment.problem_score)
          : 0,
        access_score: Number.isFinite(Number(assessment.access_score)) ? Number(assessment.access_score) : 0,
        leverage_score: Number.isFinite(Number(assessment.leverage_score))
          ? Number(assessment.leverage_score)
          : 0,
        momentum_score: Number.isFinite(Number(assessment.momentum_score))
          ? Number(assessment.momentum_score)
          : 0
      };
      const normalizedHazard = {
        hazard_severity: Number.isFinite(Number(assessment.hazard_severity))
          ? Number(assessment.hazard_severity)
          : 0,
        hazard_prevalence: Number.isFinite(Number(assessment.hazard_prevalence))
          ? Number(assessment.hazard_prevalence)
          : 0,
        hazard_maintenance_gap: Number.isFinite(Number(assessment.hazard_maintenance_gap))
          ? Number(assessment.hazard_maintenance_gap)
          : 0,
        hazard_engagement_path: Number.isFinite(Number(assessment.hazard_engagement_path))
          ? Number(assessment.hazard_engagement_path)
          : 0
      };
      const computedTotal =
        normalizedScores.problem_score +
        normalizedScores.access_score +
        normalizedScores.leverage_score +
        normalizedScores.momentum_score;
      const computedHazardTotal =
        normalizedHazard.hazard_severity +
        normalizedHazard.hazard_prevalence +
        normalizedHazard.hazard_maintenance_gap +
        normalizedHazard.hazard_engagement_path;
      const computedHazardAngle = computeHazardPrimaryAngle({
        ...normalizedHazard,
        hazard_total: computedHazardTotal
      });
      const disqualified = disqualifierReasons.length > 0 || Boolean(assessment.disqualified);
      const composedHook = composeHookText(assessment);
      const payload = {
        ...assessment,
        hook: composedHook,
        ...normalizedScores,
        ...normalizedHazard,
        access_difficulty: accessDifficulty || "",
        total_score: computedTotal,
        hazard_total: computedHazardTotal,
        hazard_primary_angle: computedHazardAngle,
        disqualified,
        disqualifier_reasons: disqualifierReasons
      };
      const saved = await saveAssessment(payload);
      const propertyName = property?.property_name || "property";
      const changedPhotos = photos.filter((photo) => photo.storage_uri && (!photo.persisted || photo.dirty));
      const normalizedPhotos = changedPhotos.map((photo) => ({
        ...photo,
        assessment_id: saved.id,
        stored_filename:
          photo.stored_filename || buildPhotoFilename(propertyName, photo.tag, photo.timestamp, photo.id)
      }));

      const insertResult = normalizedPhotos.length
        ? await insertPhotos(normalizedPhotos)
        : { failed: [], queued: 0 };
      const failedPhotos = insertResult.failed || [];

      if (normalizedPhotos.length) {
        void processPhotoUploadQueue({ assessmentId: saved.id });
        await refreshPhotosFromDb(saved.id);
      }

      setAssessment((current) => ({
        ...current,
        hook: composedHook,
        ...normalizedScores,
        ...normalizedHazard,
        access_difficulty: payload.access_difficulty,
        total_score: payload.total_score,
        hazard_total: payload.hazard_total,
        hazard_primary_angle: payload.hazard_primary_angle,
        disqualified: payload.disqualified,
        disqualifier_reasons: payload.disqualifier_reasons,
        updated_at: saved.updated_at
      }));

      if (failedPhotos.length) {
        setStatus({ dirty: true, savedAt: saved.updated_at });
        showToast({ type: "success", title: "Assessment saved", message: "Core data captured." });
        showToast({
          type: "error",
          title: "Photo save failed",
          message: `Failed: ${failedPhotos.map((photo) => photo.stored_filename).join(", ")}`
        });
      } else {
        setStatus({ dirty: false, savedAt: saved.updated_at });
        showToast({ type: "success", title: "Assessment saved", message: "Data captured." });
      }

      if (insertResult.queued) {
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        showToast({
          type: "info",
          title: "Photo uploads",
          message: offline ? "Queued for upload when online." : "Uploading in background."
        });
      }
      return true;
    } catch (error) {
      console.error("Assessment save failed", error);
      showToast({ type: "error", title: "Save failed", message: "Check connection or storage." });
      return false;
    }
  };

  const handleEstimate = async () => {
    if (!assessment?.id) return;
    if (status.dirty) {
      const ok = await handleSave();
      if (!ok) return;
    }
    navigate(`/assessments/${assessment.id}/estimate`);
  };

  const handleDeleteReport = async () => {
    if (!assessment?.id) return;
    const reportLabel = assessment.scout_mode === "full" ? "full audit" : "quick scout";
    const confirmed = window.confirm(
      `Delete this ${reportLabel}? This will remove the report and its attached photos.`
    );
    if (!confirmed) return;
    try {
      await deleteAssessment(assessment.id);
      clearDraft(draftKey);
      showToast({ type: "success", title: "Report deleted", message: `${reportLabel} removed.` });
      navigate(`/properties/${assessment.property_id}`);
    } catch (error) {
      console.error("Delete assessment failed", error);
      showToast({
        type: "error",
        title: "Delete failed",
        message: error?.message || "Could not delete this report."
      });
    }
  };

  if (!ready) {
    return <div className="page">Loading assessment...</div>;
  }

  if (!assessment) {
    return (
      <div className="page">
        <div className="empty-state">Assessment not found.</div>
        <button className="primary" type="button" onClick={() => navigate("/")}>Return Home</button>
      </div>
    );
  }

  const savedLabel = status.savedAt ? `Saved ${formatDateTime(status.savedAt)}` : "Draft";
  const dirtyLabel = localBackupAt
    ? `Unsaved Draft | Local backup ${formatDateTime(localBackupAt)}`
    : "Unsaved Draft";
  const modeClass = isQuick ? "mode-quick" : "mode-full";

  return (
    <div className={`page assessment-page ${modeClass}`}>
      <div className="page-header">
        <div>
          <div className="page-title">{assessment.scout_mode === "full" ? "Full Audit" : "Quick Scout"}</div>
          <div className="page-subtitle">{property?.property_name || "Property"}</div>
        </div>
        <div className="button-row">
          <button
            className="ghost button-small"
            type="button"
            onClick={handleDeleteReport}
          >
            Delete Report
          </button>
          <button
            className="ghost button-small"
            type="button"
            onClick={() => navigate(`/properties/${assessment.property_id}`)}
          >
            Back
          </button>
        </div>
      </div>

      <div className={`status-pill ${status.dirty ? "dirty" : "saved"}`}>
        {status.dirty ? dirtyLabel : savedLabel}
      </div>

      <div className="form">
        <div className="section">
          <div className="section-header">Visible Signals</div>
          <ToggleButtons
            label="Lint Buildup Visible"
            value={assessment.on_site_office_visible}
            onChange={(value) => updateAssessment({ on_site_office_visible: value })}
          />
          <ToggleButtons
            label="Blocked / Restricted Termination"
            value={assessment.leasing_activity_visible}
            onChange={(value) => updateAssessment({ leasing_activity_visible: value })}
          />
          <ToggleButtons
            label="Damaged or Missing Cover"
            value={assessment.maintenance_presence_visible}
            onChange={(value) => updateAssessment({ maintenance_presence_visible: value })}
          />
          {!isQuick ? (
            <TileGroup
              label="Maintenance Quality Signal"
              value={assessment.management_quality_signal}
              onChange={(value) => updateAssessment({ management_quality_signal: value })}
              options={[
                { value: "poor", label: "Reactive / Poor" },
                { value: "average", label: "Mixed / Average" },
                { value: "strong", label: "Proactive / Strong" }
              ]}
            />
          ) : null}
        </div>

        <div className="section">
          <div className="section-header">Property Classification</div>
          <TileGroup
            label={
              <span>
                Exterior Condition <span className="field-required">Required</span>
              </span>
            }
            value={propertyClassInputs.exterior_condition}
            onChange={(value) => updatePropertyClassInputs({ exterior_condition: value })}
            options={PROPERTY_CLASS_OPTIONS.exterior_condition}
          />
          <div className="helper-text">
            Look at paint, staining, siding/stucco, trim, visible wear, cleanliness, and exterior upkeep.
          </div>
          {propertyClassErrors.exterior_condition ? (
            <div className="field-error">Exterior condition is required.</div>
          ) : null}
          <TileGroup
            label={
              <span>
                Maintenance Signals <span className="field-required">Required</span>
              </span>
            }
            value={propertyClassInputs.maintenance_signals}
            onChange={(value) => updatePropertyClassInputs({ maintenance_signals: value })}
            options={PROPERTY_CLASS_OPTIONS.maintenance_signals}
          />
          <div className="helper-text">
            Look for signs of proactive upkeep vs reactive or deferred maintenance.
          </div>
          {propertyClassErrors.maintenance_signals ? (
            <div className="field-error">Maintenance signals are required.</div>
          ) : null}
          <TileGroup
            label={
              <span>
                Operational Feel <span className="field-required">Required</span>
              </span>
            }
            value={propertyClassInputs.overall_feel}
            onChange={(value) => updatePropertyClassInputs({ overall_feel: value })}
            options={PROPERTY_CLASS_OPTIONS.overall_feel}
          />
          <div className="helper-text">
            Based on what you can observe, how well-run does the property feel overall?
          </div>
          {propertyClassErrors.overall_feel ? (
            <div className="field-error">Operational feel is required.</div>
          ) : null}
          {getPropertyClassWarnings(propertyClassInputs).map((warning) => (
            <div key={warning} className="warning-banner">
              {warning}
            </div>
          ))}
          <Field label="Property Class (auto)">
            <div className="computed-pill">
              {derivePropertyClass(propertyClassInputs)
                ? `Computed Property Class: ${derivePropertyClass(propertyClassInputs)}`
                : "Complete the three inputs to classify."}
            </div>
            <div className="helper-text">
              Class is computed from the three structured inputs (not user-selected).
            </div>
          </Field>
        </div>

        <div className="section">
          <div className="section-header">Scout Signal Guide</div>
          <div className="signal-guide">
            <div className="signal-group positive">
              <div className="signal-title">Positive Opportunity Signals</div>
              <ul className="signal-list">
                {signalGuide.positive.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="signal-group negative">
              <div className="signal-title">Negative / Weak Signals</div>
              <ul className="signal-list">
                {signalGuide.negative.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="signal-group neutral">
              <div className="signal-title">Neutral / Unknown</div>
              <ul className="signal-list">
                {signalGuide.neutral.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {!isQuick ? (
          <div className="section">
            <div className="section-header">Property Type</div>
            <TileGroup
              label="Exterior Vent Condition"
              value={assessment.exterior_condition}
              onChange={(value) => updateAssessment({ exterior_condition: value })}
              options={[
                { value: "poor", label: "Poor" },
                { value: "average", label: "Average" },
                { value: "strong", label: "Strong" }
              ]}
            />
            <TileGroup
              label="Service Gap Likelihood"
              value={assessment.service_fit}
              onChange={(value) => updateAssessment({ service_fit: value })}
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" }
              ]}
            />
          </div>
        ) : null}

        {!isQuick ? (
          <div className="section">
            <div className="section-header">Service Access</div>
            <div className="helper-text">
              Physical execution access only. Use this section for how hard the work is to perform.
              Sales/decision-maker access is scored separately below.
            </div>
          <Segmented
            label="Scout Type"
            value={assessment.scout_type}
            onChange={(value) => updateAssessment({ scout_type: value })}
            options={[
              { value: "drive_by", label: "Drive-By" },
              { value: "walk_in", label: "Walk-In" },
              { value: "meeting", label: "Meeting" }
            ]}
          />
          <TileGroup
            label={
              <span>
                Building Height <span className="field-required">Required</span>
              </span>
            }
            value={assessment.building_height}
            onChange={(value) => updateAssessment({ building_height: value })}
            options={[
              { value: "1-2", label: "1-2 Floors", helper: "Low rise access." },
              { value: "3", label: "3 Floors", helper: "Mid-rise complexity." },
              { value: "4+", label: "4+ Floors", helper: "High access complexity." }
            ]}
          />
          <TileGroup
            label={
              <span>
                Termination Type <span className="field-required">Required</span>
              </span>
            }
            value={assessment.termination_type}
            onChange={(value) => updateAssessment({ termination_type: value })}
            options={[
              { value: "sidewall", label: "Sidewall", helper: "Exits through exterior walls." },
              { value: "roof", label: "Roof", helper: "Vent terminates on roof." },
              { value: "mixed", label: "Mixed", helper: "Both sidewall + roof terminations." }
            ]}
          />
          <TileGroup
            label={
              <span>
                Access Constraints <span className="field-required">Required</span>
              </span>
            }
            value={assessment.access_constraints}
            onChange={(value) => updateAssessment({ access_constraints: value })}
            options={[
              { value: "none", label: "None", helper: "Clear, safe access." },
              { value: "minor", label: "Minor", helper: "Light obstructions or tight spacing." },
              { value: "moderate", label: "Moderate", helper: "Noticeable hazards or difficult access." },
              { value: "major", label: "Major", helper: "Unsafe, risky, or blocked access." }
            ]}
          />
          <Field label="Access Difficulty (Computed)">
            <div className="computed-pill">
              {accessDifficulty || "Complete the three inputs to classify."}
            </div>
            <div className="helper-text">
              Think about how hard this would be to service safely, not just what you see.
            </div>
            {requiresAccessPhoto && !photos.length ? (
              <div className="field-error">
                Photo evidence required for mixed systems, constrained access, or high risk.
              </div>
            ) : null}
          </Field>
          <TileGroup
            label="Decision Path / Contact Route"
            value={assessment.entry_path}
            onChange={(value) => updateAssessment({ entry_path: value })}
            options={[
              { value: "leasing_office", label: "Leasing Office" },
              { value: "property_manager", label: "Property Manager" },
              { value: "maintenance", label: "Maintenance" },
              { value: "regional_management", label: "Regional Mgmt" },
              { value: "unknown", label: "Unknown" }
            ]}
          />
        </div>
      ) : null}

      {!isQuick ? (
        <div className="section">
          <div className="section-header">Decision Maker Contact</div>
          <div className="checklist">
            <label className="check-item">
              <input
                type="checkbox"
                checked={Boolean(assessment.decision_maker_known)}
                onChange={(event) =>
                  updateAssessment({ decision_maker_known: event.target.checked })
                }
              />
              <span>Decision maker identified</span>
            </label>
            <label className="check-item">
              <input
                type="checkbox"
                checked={Boolean(assessment.decision_maker_contacted)}
                onChange={(event) =>
                  updateAssessment({ decision_maker_contacted: event.target.checked })
                }
              />
              <span>Talked to decision maker</span>
            </label>
          </div>
          {(assessment.decision_maker_known || assessment.decision_maker_contacted) ? (
            <>
              <Field label="Contact Name">
                <Input
                  value={assessment.contact_name || ""}
                  onChange={(value) => updateAssessment({ contact_name: value })}
                  placeholder="Name"
                />
              </Field>
              <Field label="Role / Title">
                <Input
                  value={assessment.contact_role || ""}
                  onChange={(value) => updateAssessment({ contact_role: value })}
                  placeholder="Property Manager, Regional, Maintenance, etc."
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={assessment.contact_phone || ""}
                  onChange={(value) => updateAssessment({ contact_phone: value })}
                  placeholder="Phone"
                />
              </Field>
              <Field label="Email">
                <Input
                  value={assessment.contact_email || ""}
                  onChange={(value) => updateAssessment({ contact_email: value })}
                  placeholder="Email"
                />
              </Field>
              <Field label="Contact Notes">
                <TextArea
                  rows={2}
                  value={assessment.contact_notes || ""}
                  onChange={(value) => updateAssessment({ contact_notes: value })}
                  placeholder="Anything important about the contact or conversation"
                />
              </Field>
            </>
          ) : (
            <div className="helper-text">Contact fields appear once a decision maker is known or contacted.</div>
          )}
        </div>
      ) : null}

        <div className="section">
          <div className="section-header">Opportunity Signals</div>
          <TileGroup
            label={isQuick ? "Opportunity Strength (Visible Evidence)" : "Partner Potential"}
            value={assessment.partner_potential}
            onChange={(value) => updateAssessment({ partner_potential: value })}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" }
            ]}
          />
          <TileGroup
            label="Follow-Up Priority"
            value={assessment.follow_up_priority}
            onChange={(value) => updateAssessment({ follow_up_priority: value })}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" }
            ]}
          />
          {!isQuick ? (
            <Field
              label="Opportunity Notes"
              actions={renderPolishAction(
                "opportunity_notes",
                assessment.opportunity_notes,
                "Opportunity notes"
              )}
            >
              <TextArea
                rows={2}
                value={assessment.opportunity_notes || ""}
                onChange={(value) => {
                  updateAssessment({ opportunity_notes: value });
                  clearUndoSnapshot("opportunity_notes");
                }}
                placeholder="Current handling, vendor use, or service gaps"
              />
            </Field>
          ) : (
            <Field
              label="Evidence Notes (what you saw)"
              actions={renderPolishAction(
                "opportunity_notes",
                assessment.opportunity_notes,
                "Evidence notes"
              )}
            >
              <TextArea
                rows={2}
                value={assessment.opportunity_notes || ""}
                onChange={(value) => {
                  updateAssessment({ opportunity_notes: value });
                  clearUndoSnapshot("opportunity_notes");
                }}
                placeholder="What did you see that signals need?"
              />
            </Field>
          )}
        </div>

        <div className="section">
          <div className="section-header">Scoring</div>
          <div className="score-summary">
            <div>
              <div className="score-label">Total Score</div>
              <div className="score-value">{totalScore} / 9</div>
            </div>
            <div className="score-breakdown">Problem + Sales Access + Leverage + Momentum</div>
          </div>
          <TileGroup
            label="Problem Strength (0–3)"
            value={assessment.problem_score}
            onChange={(value) => updateAssessment({ problem_score: value })}
            options={[
              { value: 0, label: "0", helper: "Unknown / none" },
              { value: 1, label: "1", helper: "Weak signal" },
              { value: 2, label: "2", helper: "Probable issue" },
              { value: 3, label: "3", helper: "Clear visible issue" }
            ]}
          />
          <TileGroup
            label="Sales Access Path (0–2)"
            value={assessment.access_score}
            onChange={(value) => updateAssessment({ access_score: value })}
            options={[
              { value: 0, label: "0", helper: "Blocked or no contact path" },
              { value: 1, label: "1", helper: "Partial path, still unclear" },
              { value: 2, label: "2", helper: "Clear office or contact path" }
            ]}
          />
          <div className="helper-text">
            This score is commercial access, not service access. Score 0 if access is blocked or
            nobody is reachable, 1 if you have partial access but still no clean path, and 2 if you
            can identify the office or decision-maker path. Physical/service access is captured
            above by Building Height, Termination Type, Access Constraints, and Access Difficulty.
          </div>
          <TileGroup
            label="Leverage (0–2)"
            value={assessment.leverage_score}
            onChange={(value) => updateAssessment({ leverage_score: value })}
            options={[
              { value: 0, label: "0", helper: "One-off / limited upside" },
              { value: 1, label: "1", helper: "Moderate repeat potential" },
              { value: 2, label: "2", helper: "Portfolio / managed MF" }
            ]}
          />
          <TileGroup
            label="Momentum (0–2)"
            value={assessment.momentum_score}
            onChange={(value) => updateAssessment({ momentum_score: value })}
            options={[
              { value: 0, label: "0", helper: "No near-term action" },
              { value: 1, label: "1", helper: "Follow-up needed" },
              { value: 2, label: "2", helper: "High + due within 48h" }
            ]}
          />
          <div className="helper-text">
            Suggested momentum from follow-up priority/due: {momentumSuggestion}
          </div>
          <Segmented
            label="Confidence"
            value={assessment.confidence_level}
            onChange={(value) => updateAssessment({ confidence_level: value })}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" }
            ]}
          />
          <div className="helper-text">
            High = photo + observation + notes. Medium = observation + notes. Low = partial or inferred.
          </div>
          <div className="field">
            <div className="field-label">
              <div className="field-label-text">Hook Builder (Observation → Impact → Ask)</div>
              <div className="field-actions">
                <button
                  type="button"
                  className="field-action"
                  onClick={handleAutoFillHook}
                  disabled={Boolean(polishState.hook_builder)}
                >
                  {polishState.hook_builder ? "Generating..." : "Auto Fill"}
                </button>
                {polishUndo.hook_builder ? (
                  <button
                    type="button"
                    className="field-action"
                    onClick={handleUndoHookBuilder}
                    disabled={Boolean(polishState.hook_builder)}
                  >
                    Undo
                  </button>
                ) : null}
              </div>
            </div>
            <div className="helper-text">
              Build the hook in three parts. Auto Fill uses AI to draft 1-2 short sentences for
              each box based on the report.
            </div>
          </div>
          <Field
            label="Observation"
            actions={renderPolishAction(
              "hook_observation",
              assessment.hook_observation,
              "Observation hook for the report"
            )}
          >
            <TextArea
              rows={2}
              value={assessment.hook_observation || ""}
              onChange={(value) => updateAssessment({ hook_observation: value })}
              placeholder="What did you actually see?"
            />
          </Field>
          <Field
            label="Impact"
            actions={renderPolishAction(
              "hook_impact",
              assessment.hook_impact,
              "Impact hook for the report"
            )}
          >
            <TextArea
              rows={2}
              value={assessment.hook_impact || ""}
              onChange={(value) => updateAssessment({ hook_impact: value })}
              placeholder="Why does that matter?"
            />
          </Field>
          <Field
            label="Ask"
            actions={renderPolishAction("hook_ask", assessment.hook_ask, "Ask hook for the report")}
          >
            <TextArea
              rows={2}
              value={assessment.hook_ask || ""}
              onChange={(value) => updateAssessment({ hook_ask: value })}
              placeholder="What next step are you asking for?"
            />
          </Field>
          <Field label="Composed Hook (Saved)">
            <div className="computed-pill">{composeHookText(assessment) || "No hook yet"}</div>
          </Field>
          <div className="field">
            <div className="field-label">Disqualifier Checklist</div>
            <div className="checklist">
              {disqualifierOptions.map((option) => (
                <label key={option.value} className="check-item">
                  <input
                    type="checkbox"
                    checked={disqualifierReasons.includes(option.value)}
                    onChange={() => toggleDisqualifier(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <div className="helper-text">Any checked item marks the property as disqualified.</div>
          </div>
          <Field label="Disqualified (Computed)">
            <div className="computed-pill">{disqualifierReasons.length ? "Yes" : "No"}</div>
          </Field>
        </div>

        <div className="section">
          <div className="section-header">Dryer Vent Hazard Score</div>
          <div className="score-summary">
            <div>
              <div className="score-label">Hazard Score</div>
              <div className="score-value">{hazardTotal} / 10</div>
            </div>
            <div>
              <div className="score-label">Band</div>
              <div className="score-value">{hazardBand}</div>
            </div>
          </div>
          <TileGroup
            label="Severity (0–4)"
            value={assessment.hazard_severity}
            onChange={(value) => updateAssessment({ hazard_severity: value })}
            options={[
              { value: 0, label: "0", helper: "No evidence" },
              { value: 1, label: "1", helper: "Minor lint" },
              { value: 2, label: "2", helper: "Moderate lint" },
              { value: 3, label: "3", helper: "Heavy lint or defects" },
              { value: 4, label: "4", helper: "Blocked / safety hazard" }
            ]}
          />
          <TileGroup
            label="Prevalence (0–2)"
            value={assessment.hazard_prevalence}
            onChange={(value) => updateAssessment({ hazard_prevalence: value })}
            options={[
              { value: 0, label: "0", helper: "Single / unknown" },
              { value: 1, label: "1", helper: "A few / isolated" },
              { value: 2, label: "2", helper: "Many / widespread" }
            ]}
          />
          <TileGroup
            label="Maintenance Gap (0–2)"
            value={assessment.hazard_maintenance_gap}
            onChange={(value) => updateAssessment({ hazard_maintenance_gap: value })}
            options={[
              { value: 0, label: "0", helper: "Maintained" },
              { value: 1, label: "1", helper: "Inconsistent" },
              { value: 2, label: "2", helper: "Clear gap / failure" }
            ]}
          />
          <TileGroup
            label="Immediate Engagement Path (0–2)"
            value={assessment.hazard_engagement_path}
            onChange={(value) => updateAssessment({ hazard_engagement_path: value })}
            options={[
              { value: 0, label: "0", helper: "Unclear / blocked" },
              { value: 1, label: "1", helper: "Partial" },
              { value: 2, label: "2", helper: "Office / contact" }
            ]}
          />
          <Field label="Primary Angle (Computed)">
            <div className="computed-pill">{hazardAngleLabel}</div>
          </Field>
          <div className="helper-text">
            9–10: Immediate Priority · 7–8: Strong Target · 5–6: Secondary · 0–4: Watch
          </div>
        </div>

        {!isQuick ? (
          <div className="section">
            <div className="section-header">Risk / Blockers</div>
            <Field
              label="Risk / Barrier Notes"
              actions={renderPolishAction(
                "risk_or_barrier_notes",
                assessment.risk_or_barrier_notes,
                "Risk and barrier notes"
              )}
            >
              <TextArea
                rows={2}
                value={assessment.risk_or_barrier_notes || ""}
                onChange={(value) => {
                  updateAssessment({ risk_or_barrier_notes: value });
                  clearUndoSnapshot("risk_or_barrier_notes");
                }}
                placeholder="Pain points, objections, access risks"
              />
            </Field>
          </div>
        ) : null}

        <div className="section">
          <div className="section-header">Decision</div>
          {isQuick ? (
            <div className="opportunity-guide">
              <div className="signal-title">Opportunity Framework</div>
              <div className="signal-group positive">
                <div className="signal-subtitle">High Opportunity</div>
                <ul className="signal-list">
                  {opportunityGuide.high.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="signal-group neutral">
                <div className="signal-subtitle">Medium Opportunity</div>
                <ul className="signal-list">
                  {opportunityGuide.medium.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="signal-group negative">
                <div className="signal-subtitle">Low Opportunity</div>
                <ul className="signal-list">
                  {opportunityGuide.low.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <Field label="Next Action Owner">
            <Input
              value={assessment.next_action_owner || ""}
              onChange={(value) => updateAssessment({ next_action_owner: value })}
              placeholder="Owner name"
            />
          </Field>
          <TileGroup
            label="Next Action Type"
            value={assessment.next_action_type}
            onChange={(value) => updateAssessment({ next_action_type: value })}
            options={[
              { value: "visit", label: "Visit" },
              { value: "call", label: "Call" },
              { value: "email", label: "Email" },
              { value: "research", label: "Research" },
              { value: "none", label: "None" }
            ]}
          />
          {!isQuick ? (
            <>
              <Segmented
                label="Next Action Due"
                value={selectedDueValue}
                onChange={(value) => {
                  if (value === "custom") return;
                  const match = dueOptions.find((option) => option.value === value);
                  updateAssessment({ next_action_due: match ? match.date : "" });
                }}
                options={[
                  ...dueOptions.map((option) => ({ value: option.value, label: option.label })),
                  ...(selectedDueValue === "custom"
                    ? [{ value: "custom", label: "Custom" }]
                    : [])
                ]}
              />
              {selectedDueValue === "custom" ? (
                <div className="empty-state">Current due date: {assessment.next_action_due}</div>
              ) : null}
            </>
          ) : null}
          {!isQuick ? (
            <Field
              label="Next Action Notes"
              actions={renderPolishAction(
                "next_action_notes",
                assessment.next_action_notes,
                "Next action notes"
              )}
            >
              <TextArea
                rows={2}
                value={assessment.next_action_notes || ""}
                onChange={(value) => {
                  updateAssessment({ next_action_notes: value });
                  clearUndoSnapshot("next_action_notes");
                }}
                placeholder="Decision maker, current process, or next step"
              />
            </Field>
          ) : null}
          <Field
            label="General Notes"
            actions={renderPolishAction(
              "general_notes",
              assessment.general_notes,
              "General notes"
            )}
          >
            <TextArea
              rows={2}
              value={assessment.general_notes || ""}
              onChange={(value) => {
                updateAssessment({ general_notes: value });
                clearUndoSnapshot("general_notes");
              }}
              placeholder={isQuick ? "Optional note" : "Openness, relationship, next step"}
            />
          </Field>
        </div>

        <div className="section">
          <div className="section-header">Gut Check</div>
          <Segmented
            label="Gut Feel Score"
            value={assessment.gut_feel_score}
            onChange={(value) => updateAssessment({ gut_feel_score: value })}
            options={[1, 2, 3, 4, 5].map((score) => ({ value: score, label: String(score) }))}
          />
        </div>

      </div>

      <PhotoUploader
        propertyName={property?.property_name || "property"}
        photos={photos}
        setPhotos={updatePhotos}
        onRetryFailed={handleRetryFailedUploads}
      />

      <div className="sticky-actions">
        <div className="action-grid">
          <button className="primary" type="button" onClick={handleSave}>
            Save Assessment
          </button>
          {!isQuick ? (
            <button className="secondary" type="button" onClick={handleEstimate}>
              Estimate & Proposal
            </button>
          ) : null}
          {status.savedAt ? (
            <button className="secondary" type="button" onClick={() => navigate("/properties")}>
              Back to List
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
