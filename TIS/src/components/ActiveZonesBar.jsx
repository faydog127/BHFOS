import { ZONE_LABELS, ZONE_ORDER } from "../utils/zones";
import { normalizeActiveZones } from "../utils/activeZones";

export default function ActiveZonesBar({ activeZones, onChange }) {
  const toggleZone = (zone) => {
    const next = activeZones.includes(zone)
      ? activeZones.filter((item) => item !== zone)
      : [...activeZones, zone];
    onChange(normalizeActiveZones(next));
  };

  return (
    <div className="active-zones-bar">
      <div className="active-zones-header">
        <div className="active-zones-title">Active Zones (Session)</div>
        <div className="active-zones-note">Select zones to focus this scouting run. None = all.</div>
      </div>
      <div className="active-zones-grid">
        {ZONE_ORDER.map((zone) => (
          <button
            key={zone}
            type="button"
            className={`zone-chip ${activeZones.includes(zone) ? "is-active" : ""}`}
            onClick={() => toggleZone(zone)}
            title={ZONE_LABELS[zone]}
          >
            {zone}
          </button>
        ))}
      </div>
      <div className="active-zones-actions">
        <button type="button" className="ghost" onClick={() => onChange([])}>
          Clear (All Zones)
        </button>
      </div>
    </div>
  );
}
