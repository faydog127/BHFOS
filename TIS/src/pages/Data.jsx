import { useEffect, useMemo, useState } from "react";
import {
  backfillHazardScores,
  backfillPropertyZones,
  listAssessments,
  listPhotos,
  listProperties,
  syncFromSupabase,
  updateProperty
} from "../db/api";
import { useToast } from "../components/Toast";
import { Segmented } from "../components/Segmented";
import { navigate } from "../router";
import { computeTotalScore } from "../utils/scoring";
import { computeHazardPrimaryAngle, computeHazardTotal } from "../utils/hazardScore";
import { formatDateTime } from "../utils/format";

export default function DataTools() {
  const [properties, setProperties] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [angleFilter, setAngleFilter] = useState("all");
  const { showToast } = useToast();

  const refreshProperties = () => {
    Promise.all([listProperties(), listAssessments(), listPhotos()]).then(([rows, assessmentRows, photoRows]) => {
      setProperties(rows);
      setAssessments(assessmentRows);
      setPhotos(photoRows);
    });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      await backfillPropertyZones();
      const [rows, assessmentRows, photoRows] = await Promise.all([
        listProperties(),
        listAssessments(),
        listPhotos()
      ]);
      if (active) {
        setProperties(rows);
        setAssessments(assessmentRows);
        setPhotos(photoRows);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const buildErrorMessage = (error) => {
    if (!error) return "Unknown error.";
    if (typeof error === "string") return error;
    const messageParts = [];
    if (error.status) messageParts.push(`HTTP ${error.status}`);
    if (error.code) messageParts.push(`Code ${error.code}`);
    if (error.message) messageParts.push(error.message);
    if (error.details) messageParts.push(error.details);
    if (!messageParts.length) return String(error);
    return messageParts.join(" · ");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await syncFromSupabase();
      if (result?.error) {
        const error =
          result.details?.properties ||
          result.details?.assessments ||
          result.details?.photos ||
          result.details;
        showToast({
          type: "error",
          title: "Supabase refresh failed",
          message: buildErrorMessage(error)
        });
      } else {
        try {
          await backfillHazardScores();
        } catch (backfillError) {
          showToast({
            type: "error",
            title: "Hazard backfill failed",
            message: buildErrorMessage(backfillError)
          });
        }
        showToast({
          type: "success",
          title: "Supabase refreshed",
          message: "Local data updated."
        });
        refreshProperties();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Supabase refresh exception", error);
      showToast({
        type: "error",
        title: "Supabase refresh failed",
        message: buildErrorMessage(error)
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleBackfillHazards = async () => {
    setRefreshing(true);
    try {
      const result = await backfillHazardScores();
      refreshProperties();
      showToast({
        type: "success",
        title: "Hazard scores backfilled",
        message: `${result.updated || 0} assessments updated.`
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Hazard backfill failed", error);
      showToast({
        type: "error",
        title: "Backfill failed",
        message: buildErrorMessage(error)
      });
    } finally {
      setRefreshing(false);
    }
  };

  const classificationCounts = properties.reduce(
    (acc, property) => {
      const label = (property.property_class || property.class_guess || "").toUpperCase();
      if (label === "A" || label === "B" || label === "C") {
        acc[label] += 1;
      } else {
        acc.unclassified += 1;
      }
      return acc;
    },
    { A: 0, B: 0, C: 0, unclassified: 0 }
  );

  const latestAssessments = useMemo(() => {
    const map = new Map();
    assessments.forEach((assessment) => {
      if (!assessment?.property_id) return;
      if (!map.has(assessment.property_id)) {
        map.set(assessment.property_id, assessment);
      }
    });
    return map;
  }, [assessments]);

  const photosByAssessment = useMemo(() => {
    const map = new Map();
    photos.forEach((photo) => {
      if (!photo?.assessment_id) return;
      if (!map.has(photo.assessment_id)) map.set(photo.assessment_id, []);
      map.get(photo.assessment_id).push(photo);
    });
    return map;
  }, [photos]);

  const summarizeHook = (value) => {
    if (!value) return "";
    const text = String(value).replace(/\s+/g, " ").trim();
    if (text.length <= 120) return text;
    return `${text.slice(0, 117)}...`;
  };

  const normalizeAngle = (value) => {
    if (!value) return "watch";
    return String(value).trim().toLowerCase().replace(/\s+/g, "_");
  };

  const evaluationPool = useMemo(() => {
    const confidenceRank = { high: 3, medium: 2, low: 1, "": 0 };
    const rows = properties.map((property) => {
      const latest = latestAssessments.get(property.id) || null;
      const photoList = latest ? photosByAssessment.get(latest.id) || [] : [];
      const evidenceCounts = photoList.reduce(
        (acc, photo) => {
          if (!photo?.tag) return acc;
          if (photo.tag === "lint_buildup") acc.lint += 1;
          if (photo.tag === "blocked_termination") acc.blocked += 1;
          if (photo.tag === "safety_hazard") acc.safety += 1;
          return acc;
        },
        { lint: 0, blocked: 0, safety: 0 }
      );
      const score =
        latest && Number.isFinite(Number(latest.total_score))
          ? Number(latest.total_score)
          : latest
            ? computeTotalScore(latest)
            : 0;
      const hazardScore =
        latest && Number.isFinite(Number(latest.hazard_total))
          ? Number(latest.hazard_total)
          : latest
            ? computeHazardTotal(latest)
            : 0;
      const hazardAngleRaw =
        latest?.hazard_primary_angle ||
        computeHazardPrimaryAngle({ ...(latest || {}), hazard_total: hazardScore });
      const hazardAngle = normalizeAngle(hazardAngleRaw);
      const confidence = latest?.confidence_level || "low";
      return {
        property,
        assessment: latest,
        score,
        hazardScore,
        hazardAngle,
        confidence,
        confidenceRank: confidenceRank[confidence] ?? 0,
        disqualified: Boolean(latest?.disqualified),
        hook: summarizeHook(latest?.hook || property.seed_notes || ""),
        lastScouted: latest?.created_at || property.last_scouted || "",
        evidenceCounts,
        nextAction: latest?.next_action_type || "",
        due: latest?.next_action_due || "",
        version: latest ? "V2" : "V1"
      };
    });
    return rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.confidenceRank !== a.confidenceRank) return b.confidenceRank - a.confidenceRank;
      return (a.property.property_name || "").localeCompare(b.property.property_name || "");
    });
  }, [properties, latestAssessments, photosByAssessment]);

  const activePool = useMemo(
    () => evaluationPool.filter((row) => row.property.lead_status !== "b2b_lead"),
    [evaluationPool]
  );

  const missingHazardCount = useMemo(
    () =>
      activePool.filter((row) => row.assessment && row.hazardScore === 0).length,
    [activePool]
  );

  const b2bLeads = useMemo(
    () =>
      evaluationPool.filter((row) => row.property.lead_status === "b2b_lead").sort((a, b) => {
        const aDate = a.property.lead_contacted_at || "";
        const bDate = b.property.lead_contacted_at || "";
        return bDate.localeCompare(aDate);
      }),
    [evaluationPool]
  );

  const hazardPool = useMemo(
    () =>
      activePool.filter(
        (row) => row.assessment && row.hazardScore > 0 && !row.disqualified
      ),
    [activePool]
  );

  const hazardTopFive = useMemo(() => {
    return hazardPool
      .slice()
      .sort((a, b) => {
        if (b.hazardScore !== a.hazardScore) return b.hazardScore - a.hazardScore;
        const bSeverity = Number(b.assessment?.hazard_severity) || 0;
        const aSeverity = Number(a.assessment?.hazard_severity) || 0;
        if (bSeverity !== aSeverity) return bSeverity - aSeverity;
        const bPrev = Number(b.assessment?.hazard_prevalence) || 0;
        const aPrev = Number(a.assessment?.hazard_prevalence) || 0;
        if (bPrev !== aPrev) return bPrev - aPrev;
        const bGap = Number(b.assessment?.hazard_maintenance_gap) || 0;
        const aGap = Number(a.assessment?.hazard_maintenance_gap) || 0;
        if (bGap !== aGap) return bGap - aGap;
        const bDate = b.assessment?.created_at || "";
        const aDate = a.assessment?.created_at || "";
        return bDate.localeCompare(aDate);
      })
      .slice(0, 5);
  }, [hazardPool]);

  const activeTargetPool = useMemo(() => {
    const angleRank = { safety: 4, repeat_service: 3, process_gap: 2, watch: 1 };
    const candidates = activePool.filter((row) => {
      if (!row.assessment) return false;
      if (row.hazardScore <= 0) return false;
      if (row.disqualified) return false;
      const engagement = Number(row.assessment?.hazard_engagement_path) || 0;
      return engagement > 0;
    });
    const higherConfidence = candidates.filter((row) => row.confidenceRank >= 2);
    const pool = higherConfidence.length >= 5 ? higherConfidence : candidates;
    const filtered =
      angleFilter === "safety_repeat"
        ? pool.filter((row) => ["safety", "repeat_service"].includes(row.hazardAngle))
        : pool;
    return filtered
      .slice()
      .sort((a, b) => {
        const aRank = angleRank[a.hazardAngle] || 0;
        const bRank = angleRank[b.hazardAngle] || 0;
        if (bRank !== aRank) return bRank - aRank;
        if (b.hazardScore !== a.hazardScore) return b.hazardScore - a.hazardScore;
        const bEngagement = Number(b.assessment?.hazard_engagement_path) || 0;
        const aEngagement = Number(a.assessment?.hazard_engagement_path) || 0;
        if (bEngagement !== aEngagement) return bEngagement - aEngagement;
        if (b.confidenceRank !== a.confidenceRank) return b.confidenceRank - a.confidenceRank;
        const bDate = b.assessment?.created_at || "";
        const aDate = a.assessment?.created_at || "";
        return bDate.localeCompare(aDate);
      })
      .slice(0, 5);
  }, [activePool, angleFilter]);

  const activeTargetPoolUnfiltered = useMemo(() => {
    const candidates = activePool.filter((row) => {
      if (!row.assessment) return false;
      if (row.hazardScore <= 0) return false;
      if (row.disqualified) return false;
      const engagement = Number(row.assessment?.hazard_engagement_path) || 0;
      return engagement > 0;
    });
    const higherConfidence = candidates.filter((row) => row.confidenceRank >= 2);
    return higherConfidence.length >= 5 ? higherConfidence : candidates;
  }, [activePool]);

  const markContacted = async (row) => {
    const now = new Date().toISOString();
    await updateProperty(row.property.id, {
      ...row.property,
      lead_status: "b2b_lead",
      lead_contacted_at: now
    });
    refreshProperties();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Data Tools</div>
          <div className="page-subtitle">Coverage analytics</div>
        </div>
        <div className="action-grid">
          <button className="ghost" type="button" onClick={() => navigate("/properties")}>
            Properties
          </button>
          <button
            className="secondary"
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh from Supabase"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={handleBackfillHazards}
            disabled={refreshing}
          >
            {refreshing ? "Working..." : "Backfill Hazard Scores"}
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">Classification Coverage</div>
        <div className="card detail-card">
          <div className="detail-line">Class A: {classificationCounts.A}</div>
          <div className="detail-line">Class B: {classificationCounts.B}</div>
          <div className="detail-line">Class C: {classificationCounts.C}</div>
          <div className="detail-line">Unclassified: {classificationCounts.unclassified}</div>
        </div>
      </div>

      {missingHazardCount > 0 ? (
        <div className="warning-banner">
          {missingHazardCount} records still have hazard score = 0. The lists below are incomplete
          until backfill or manual scoring is done.
        </div>
      ) : null}

      <div className="section">
        <div className="section-header">Top 5 Targets</div>
        <div className="helper-text">
          Actionable queue: hazard score &gt; 0, engagement path required, confidence preferred, V2 only.
        </div>
        <Segmented
          label="Angle Filter"
          value={angleFilter}
          onChange={(value) => setAngleFilter(value)}
          options={[
            { value: "all", label: "All Angles" },
            { value: "safety_repeat", label: "Safety + Repeat" }
          ]}
        />
        {angleFilter === "safety_repeat" ? (
          <div className="helper-text">
            Showing {activeTargetPool.length} of {activeTargetPoolUnfiltered.length} candidates.
          </div>
        ) : null}
        {activeTargetPool.length ? (
          <div className="card-list">
            {activeTargetPool.map((row) => {
              const angleLabel = {
                safety: "Safety",
                repeat_service: "Repeat Service",
                process_gap: "Process Gap",
                watch: "Watch"
              }[row.hazardAngle] || "Watch";
              return (
                <div key={row.property.id} className="card">
                <div className="card-title">{row.property.property_name}</div>
                <div className="card-body">
                  <div>{row.property.street_address}</div>
                  <div>
                    {row.property.city}
                    {row.property.city ? ", " : ""}
                    {row.property.state} {row.property.zip}
                  </div>
                  <div>
                    Last Scouted: {row.lastScouted ? formatDateTime(row.lastScouted) : "?"}
                  </div>
                  <div>
                    Evidence: lint {row.evidenceCounts.lint} · blocked {row.evidenceCounts.blocked}
                    · safety {row.evidenceCounts.safety}
                  </div>
                  {row.hook ? <div>Hook: {row.hook}</div> : null}
                </div>
                <div className="card-footer">
                  <span className="pill">Angle: {angleLabel}</span>
                    <span className="pill">Hazard: {row.hazardScore} / 10</span>
                    <span className="pill">Confidence: {row.confidence}</span>
                    <span className="pill">Next: {row.nextAction || "?"}</span>
                    <span className="pill">Due: {row.due || "?"}</span>
                  </div>
                  <div className="action-grid">
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => navigate(`/properties/${row.property.id}`)}
                    >
                      Open Property
                    </button>
                    <button
                      className="primary"
                      type="button"
                      onClick={() => markContacted(row)}
                    >
                      Mark Contacted → B2B Lead
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            No actionable targets yet. Backfill hazard scores to populate.
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-header">Top 5 Dryer Vent Hazards</div>
        <div className="helper-text">Ranked by Dryer Vent Hazard Score (0–10).</div>
        {hazardTopFive.length ? (
          <div className="card-list">
            {hazardTopFive.map((row) => {
              const angleLabel = {
                safety: "Safety",
                repeat_service: "Repeat Service",
                process_gap: "Process Gap",
                watch: "Watch"
              }[row.hazardAngle] || "Watch";
              return (
                <div key={row.property.id} className="card">
                  <div className="card-title">{row.property.property_name}</div>
                  <div className="card-body">
                    <div>{row.property.street_address}</div>
                    <div>
                      {row.property.city}
                      {row.property.city ? ", " : ""}
                      {row.property.state} {row.property.zip}
                    </div>
                    <div>
                      Last Scouted: {row.lastScouted ? formatDateTime(row.lastScouted) : "?"}
                    </div>
                    <div>
                      Evidence: lint {row.evidenceCounts.lint} · blocked {row.evidenceCounts.blocked}
                      · safety {row.evidenceCounts.safety}
                    </div>
                    {row.hook ? <div>Hook: {row.hook}</div> : null}
                  </div>
                  <div className="card-footer">
                    <span className="pill">Angle: {angleLabel}</span>
                    <span className="pill">Hazard: {row.hazardScore} / 10</span>
                    <span className="pill">Confidence: {row.confidence}</span>
                  </div>
                  <div className="action-grid">
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => navigate(`/properties/${row.property.id}`)}
                    >
                      Open Property
                    </button>
                    <button
                      className="primary"
                      type="button"
                      onClick={() => markContacted(row)}
                    >
                      Mark Contacted → B2B Lead
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">No hazard scores yet.</div>
        )}
      </div>

      <div className="section">
        <div className="section-header">B2B Leads</div>
        <div className="helper-text">Contacted properties moved here for continued follow-up.</div>
        {b2bLeads.length ? (
          <div className="card-list">
            {b2bLeads.map((row) => (
              <div key={row.property.id} className="card">
                <div className="card-title">{row.property.property_name}</div>
                <div className="card-body">
                  <div>{row.property.street_address}</div>
                  <div>
                    {row.property.city}{row.property.city ? ", " : ""}{row.property.state} {row.property.zip}
                  </div>
                  <div>Contacted: {row.property.lead_contacted_at || "?"}</div>
                </div>
                <div className="card-footer">
                  <span className="pill">Score: {row.score} / 9</span>
                  <span className="pill">Confidence: {row.confidence}</span>
                  <span className="pill">Version: {row.version}</span>
                  <span className="pill">Next: {row.nextAction || "?"}</span>
                  <span className="pill">Due: {row.due || "?"}</span>
                </div>
                <div className="action-grid">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => navigate(`/properties/${row.property.id}`)}
                  >
                    Open Property
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No B2B leads yet.</div>
        )}
      </div>
    </div>
  );
}
