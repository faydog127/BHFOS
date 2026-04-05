import { useEffect, useState } from "react";
import { deleteAssessment, getProperty, listAssessmentsByProperty } from "../db/api";
import { formatDateTime } from "../utils/format";
import { navigate } from "../router";
import { cloneAssessment, createEmptyAssessment } from "../utils/assessment";
import { clearDraft, saveDraft, saveDraftMeta } from "../utils/draft";
import { useToast } from "../components/Toast";
import { isZoneActive } from "../utils/activeZones";
import { recordRecentProperty } from "../utils/recent";
import { computeTotalScore } from "../utils/scoring";
import { computeHazardPrimaryAngle, computeHazardTotal } from "../utils/hazardScore";

export default function PropertyDetail({ propertyId, activeZones = [] }) {
  const [property, setProperty] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedNotice, setSavedNotice] = useState("");
  const { showToast } = useToast();

  const refreshAssessments = () => {
    listAssessmentsByProperty(propertyId).then((rows) => {
      setAssessments(rows);
    });
  };

  useEffect(() => {
    let active = true;
    getProperty(propertyId).then((row) => {
      if (active) {
        setProperty(row);
        setLoading(false);
        if (row?.id) recordRecentProperty(row.id);
      }
    });
    listAssessmentsByProperty(propertyId).then((rows) => {
      if (active) setAssessments(rows);
    });
    return () => {
      active = false;
    };
  }, [propertyId]);

  useEffect(() => {
    const raw = sessionStorage.getItem("tis:propertySaved");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data?.id === propertyId) {
        setSavedNotice(`Property saved ${formatDateTime(data.at)}`);
        sessionStorage.removeItem("tis:propertySaved");
      }
    } catch (error) {
      sessionStorage.removeItem("tis:propertySaved");
    }
  }, [propertyId]);

  const startAssessment = (mode) => {
    const draft = createEmptyAssessment(propertyId, mode);
    saveDraft(`assessment:${draft.id}`, { assessment: draft, photos: [] });
    saveDraftMeta(`assessment:${draft.id}`, { dirty: true, savedAt: null });
    navigate(`/assessments/${draft.id}`);
  };

  const cloneLast = () => {
    if (!assessments.length) return;
    const latest = assessments[0];
    const draft = cloneAssessment(latest, propertyId, latest.scout_mode || "quick");
    saveDraft(`assessment:${draft.id}`, { assessment: draft, photos: [] });
    saveDraftMeta(`assessment:${draft.id}`, { dirty: true, savedAt: null });
    showToast({ type: "info", title: "Draft cloned", message: "New assessment draft created." });
    navigate(`/assessments/${draft.id}`);
  };

  const handleDeleteAssessment = async (assessment) => {
    const reportLabel = assessment.scout_mode === "full" ? "full audit" : "quick scout";
    const confirmed = window.confirm(
      `Delete this ${reportLabel}? This will remove the report and its attached photos.`
    );
    if (!confirmed) return;
    try {
      await deleteAssessment(assessment.id);
      clearDraft(`assessment:${assessment.id}`);
      refreshAssessments();
      showToast({ type: "success", title: "Report deleted", message: `${reportLabel} removed.` });
    } catch (error) {
      console.error("Delete assessment failed", error);
      showToast({
        type: "error",
        title: "Delete failed",
        message: error?.message || "Could not delete this report."
      });
    }
  };

  if (loading) {
    return <div className="page">Loading property...</div>;
  }

  if (!property) {
    return (
      <div className="page">
        <div className="empty-state">Property not found.</div>
        <button className="primary" type="button" onClick={() => navigate("/")}>Return Home</button>
      </div>
    );
  }

  const lastScouted = assessments.length ? formatDateTime(assessments[0].created_at) : "Never";
  const classLabel = property.property_class || property.class_guess || "Unclassified";
  const canStartScout = isZoneActive(property.zone, activeZones);
  const activeZoneLabel = activeZones.length
    ? `Active Zones: ${activeZones.join(", ")}`
    : "All zones active";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{property.property_name}</div>
          <div className="page-subtitle">Last Scouted: {lastScouted}</div>
        </div>
        <button className="ghost" type="button" onClick={() => navigate("/properties")}>Back</button>
      </div>

      <div className="card detail-card">
        <div className="detail-line">{property.street_address}</div>
        <div className="detail-line">
          {property.city}{property.city ? ", " : ""}{property.state} {property.zip}
        </div>
        <div className="detail-line">Management: {property.management_group || "Unknown"}</div>
        <div className="detail-line">Zone: {property.zone || "Outside AO"}</div>
        <div className="detail-line">
          Coverage: {property.coverage_type ? property.coverage_type : "out of AO"}
        </div>
        <div className="detail-line">Class: {classLabel}</div>
        <div className="detail-line">Units: {property.units_est || "?"}</div>
      </div>

      {savedNotice ? <div className="success-banner">{savedNotice}</div> : null}
      <div className="info-banner">{activeZoneLabel}</div>
      {!canStartScout ? (
        <div className="warning-banner">
          This property is outside your active zones. Update Active Zones to start a new scout here.
        </div>
      ) : null}

      <div className="section">
        <div className="section-header">Start a Scout</div>
        <div className="action-grid">
          <button className="primary" type="button" onClick={() => startAssessment("quick")} disabled={!canStartScout}>
            Quick Scout
          </button>
          <button className="secondary" type="button" onClick={() => startAssessment("full")} disabled={!canStartScout}>
            Full Audit
          </button>
          <button className="ghost" type="button" onClick={() => navigate(`/properties/${propertyId}/edit`)}>
            Edit Property
          </button>
          <button
            className="ghost"
            type="button"
            onClick={cloneLast}
            disabled={!assessments.length}
          >
            Clone Last Assessment
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">Past Assessments</div>
        {assessments.length ? (
          <div className="card-list">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="card">
                {(() => {
                  const totalScore =
                    Number.isFinite(Number(assessment.total_score))
                      ? Number(assessment.total_score)
                      : computeTotalScore(assessment);
                  const hazardTotal = Number.isFinite(Number(assessment.hazard_total))
                    ? Number(assessment.hazard_total)
                    : computeHazardTotal(assessment);
                  const hazardAngle =
                    assessment.hazard_primary_angle ||
                    computeHazardPrimaryAngle({ ...assessment, hazard_total: hazardTotal });
                  const hazardAngleLabel = {
                    safety: "Safety",
                    repeat_service: "Repeat Service",
                    process_gap: "Process Gap",
                    watch: "Watch"
                  }[hazardAngle] || "Watch";
                  return (
                    <>
                      <div className="card-title">
                        {assessment.scout_mode === "full" ? "Full Audit" : "Quick Scout"}
                      </div>
                      <div className="card-body">
                        <div>{formatDateTime(assessment.created_at)}</div>
                        <div>Partner Potential: {assessment.partner_potential || "?"}</div>
                      </div>
                      <div className="card-footer">
                        <span className="pill">Score: {totalScore} / 9</span>
                        <span className="pill">Hazard: {hazardTotal} / 10</span>
                        <span className="pill">Angle: {hazardAngleLabel}</span>
                        <span className="pill">Confidence: {assessment.confidence_level || "?"}</span>
                        {assessment.disqualified ? <span className="pill disqualified">Disqualified</span> : null}
                        <span className="pill">Entry Path: {assessment.entry_path || "?"}</span>
                        <span className="pill">Priority: {assessment.follow_up_priority || "?"}</span>
                      </div>
                      <div className="action-grid">
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => navigate(`/assessments/${assessment.id}`)}
                        >
                          Open Report
                        </button>
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => handleDeleteAssessment(assessment)}
                        >
                          Delete Report
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No assessments yet.</div>
        )}
      </div>
    </div>
  );
}
