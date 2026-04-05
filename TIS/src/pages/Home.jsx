import { useEffect, useMemo, useState } from "react";
import ActiveZonesBar from "../components/ActiveZonesBar";
import { exportSnapshot } from "../db/api";
import { useToast } from "../components/Toast";
import { navigate } from "../router";
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function isToday(timestamp) {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return false;
  return time >= startOfToday();
}

export default function Home({ activeZones, setActiveZones }) {
  const [snapshot, setSnapshot] = useState({ properties: [], assessments: [], photos: [] });
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    exportSnapshot().then((data) => {
      if (active) setSnapshot(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const propertiesById = useMemo(() => {
    const map = new Map();
    snapshot.properties.forEach((property) => map.set(property.id, property));
    return map;
  }, [snapshot.properties]);

  const todayAssessments = useMemo(
    () => snapshot.assessments.filter((assessment) => isToday(assessment.created_at)),
    [snapshot.assessments]
  );

  const todayPhotos = useMemo(
    () => snapshot.photos.filter((photo) => isToday(photo.timestamp)),
    [snapshot.photos]
  );

  const propertiesScoutedToday = useMemo(() => {
    const ids = new Set(todayAssessments.map((assessment) => assessment.property_id));
    return ids.size;
  }, [todayAssessments]);

  const highSignalCount = useMemo(
    () =>
      todayAssessments.filter(
        (assessment) =>
          assessment.partner_potential === "high" || assessment.follow_up_priority === "high"
      ).length,
    [todayAssessments]
  );

  const zonesWorked = useMemo(() => {
    const zones = new Set();
    todayAssessments.forEach((assessment) => {
      const property = propertiesById.get(assessment.property_id);
      if (property?.zone) zones.add(property.zone);
    });
    return Array.from(zones);
  }, [todayAssessments, propertiesById]);

  const highOpportunities = useMemo(() => {
    const scored = snapshot.assessments.filter(
      (assessment) =>
        assessment.partner_potential === "high" || assessment.follow_up_priority === "high"
    );
    return scored
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map((assessment) => {
        const property = propertiesById.get(assessment.property_id);
        return {
          id: assessment.id,
          property_id: assessment.property_id,
          property_name: property?.property_name || "Unknown",
          zone: property?.zone || "Outside AO",
          summary: `Partner: ${assessment.partner_potential || "?"} · Priority: ${
            assessment.follow_up_priority || "?"
          }`
        };
      });
  }, [snapshot.assessments, propertiesById]);

  const handleStartScouting = () => {
    navigate("/properties");
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const data = await exportSnapshot();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tis-backup-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast({
        type: "success",
        title: "Backup exported",
        message: "Local TIS data downloaded to this device."
      });
    } catch (error) {
      console.error("Backup export failed", error);
      showToast({
        type: "error",
        title: "Backup export failed",
        message: error?.message || String(error)
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page home-page">
      <div className="page-header">
        <div>
          <div className="page-title">Command Center</div>
          <div className="page-subtitle">Daily field workflow</div>
        </div>
        <div className="action-grid">
          <button className="ghost" type="button" onClick={() => navigate("/properties")}>
            Properties
          </button>
          <button className="ghost" type="button" onClick={() => navigate("/data")}>
            Data
          </button>
          <button className="secondary" type="button" onClick={handleExportBackup} disabled={exporting}>
            {exporting ? "Exporting..." : "Export Backup"}
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">Active Zones</div>
        <ActiveZonesBar activeZones={activeZones} onChange={setActiveZones} />
      </div>

      <div className="section">
        <div className="section-header">Today Snapshot</div>
        <div className="snapshot-grid">
          <div className="snapshot-card">
            <div className="snapshot-value">{propertiesScoutedToday}</div>
            <div className="snapshot-label">Properties Scouted</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-value">{todayPhotos.length}</div>
            <div className="snapshot-label">Photos Captured</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-value">{highSignalCount}</div>
            <div className="snapshot-label">High Signal Count</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-value">{zonesWorked.length || 0}</div>
            <div className="snapshot-label">Zones Worked</div>
          </div>
        </div>
        {zonesWorked.length ? (
          <div className="chip-row">
            {zonesWorked.map((zone) => (
              <span key={zone} className="pill">
                {zone}
              </span>
            ))}
          </div>
        ) : (
          <div className="helper-text">No zones recorded yet today.</div>
        )}
      </div>

      <div className="section" id="home-opportunities">
        <div className="section-header">High Opportunity Targets</div>
        {highOpportunities.length ? (
          <div className="card-list">
            {highOpportunities.map((item) => (
              <button
                key={item.id}
                type="button"
                className="card"
                onClick={() => navigate(`/properties/${item.property_id}`)}
              >
                <div className="card-title">{item.property_name}</div>
                <div className="card-body">
                  <div>Zone: {item.zone}</div>
                  <div>{item.summary}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">No high opportunity targets yet.</div>
        )}
      </div>

      <div className="section">
        <div className="section-header">Start Scouting</div>
        <div className="action-grid">
          <button className="primary action-tile" type="button" onClick={handleStartScouting}>
            Start Scouting
          </button>
        </div>
      </div>
    </div>
  );
}
