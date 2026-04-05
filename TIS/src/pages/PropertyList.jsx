import { useEffect, useState } from "react";
import {
  backfillPropertyZones,
  findDuplicateProperties,
  listProperties,
  listPropertyPhotoStats,
  updateProperty
} from "../db/api";
import { formatDate } from "../utils/format";
import { navigate } from "../router";
import { useToast } from "../components/Toast";
import { Field, Input, TextArea } from "../components/Field";
import { TileGroup } from "../components/Segmented";
import { resolveZoneForZip } from "../utils/zones";
import { derivePropertyClass, getPropertyClassWarnings, PROPERTY_CLASS_OPTIONS } from "../utils/propertyClass";
import { isZoneActive } from "../utils/activeZones";
import ActiveZonesBar from "../components/ActiveZonesBar";

const COVERAGE_STORAGE_KEY = "tis:propertyCoverage";
const SEARCH_STORAGE_KEY = "tis:propertySearch";

export default function PropertyList({ activeZones = [], setActiveZones }) {
  const [properties, setProperties] = useState([]);
  const [photoStats, setPhotoStats] = useState({});
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingId, setSavingId] = useState(null);
  const loadCoverage = () => {
    try {
      const raw = localStorage.getItem(COVERAGE_STORAGE_KEY);
      if (!raw) return "all";
      return JSON.parse(raw) || "all";
    } catch {
      return "all";
    }
  };
  const initialCoverage = typeof window === "undefined" ? "all" : loadCoverage();
  const [coverageFilter, setCoverageFilter] = useState(initialCoverage);
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem(SEARCH_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const { showToast } = useToast();

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (property) => {
    if (!normalizedSearch) return true;
    const haystack = [
      property.property_name,
      property.management_group,
      property.street_address,
      property.city,
      property.state,
      property.zip
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  };

  const visibleProperties = properties
    .filter((property) => isZoneActive(property.zone, activeZones))
    .filter((property) => {
      if (coverageFilter === "all") return true;
      if (coverageFilter === "out") return !property.in_ao;
      return property.coverage_type === coverageFilter;
    })
    .filter(matchesSearch);

  const refreshProperties = () => {
    Promise.all([listProperties(), listPropertyPhotoStats()]).then(([rows, stats]) => {
      setProperties(rows);
      const map = {};
      stats.forEach((row) => {
        map[row.property_id] = {
          total: Number(row.total) || 0,
          uploaded: Number(row.uploaded) || 0,
          failed: Number(row.failed) || 0,
          uploading: Number(row.uploading) || 0,
          queued: Number(row.queued) || 0
        };
      });
      setPhotoStats(map);
    });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      await backfillPropertyZones();
      const [rows, stats] = await Promise.all([listProperties(), listPropertyPhotoStats()]);
      if (active) {
        setProperties(rows);
        const map = {};
        stats.forEach((row) => {
          map[row.property_id] = {
            total: Number(row.total) || 0,
            uploaded: Number(row.uploaded) || 0,
            failed: Number(row.failed) || 0,
            uploading: Number(row.uploading) || 0,
            queued: Number(row.queued) || 0
          };
        });
        setPhotoStats(map);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COVERAGE_STORAGE_KEY, JSON.stringify(coverageFilter));
    } catch {
      // ignore storage failures
    }
  }, [coverageFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(SEARCH_STORAGE_KEY, searchTerm);
    } catch {
      // ignore storage failures
    }
  }, [searchTerm]);

  const startEdit = (property) => {
    setEditId(property.id);
    setEditForm({
      property_name: property.property_name || "",
      management_group: property.management_group || "",
      street_address: property.street_address || "",
      city: property.city || "",
      state: property.state || "",
      zip: property.zip || "",
      exterior_condition: property.exterior_condition || "",
      maintenance_signals: property.maintenance_signals || "",
      overall_feel: property.overall_feel || "",
      property_class: property.property_class || property.class_guess || "",
      units_est:
        property.units_est === null || property.units_est === undefined ? "" : String(property.units_est),
      source_url: property.source_url || "",
      seed_notes: property.seed_notes || ""
    });
    setEditErrors({});
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
    setSavingId(null);
  };

  const updateEdit = (patch) => {
    setEditForm((current) => ({ ...current, ...patch }));
    if ("property_name" in patch && patch.property_name.trim()) {
      setEditErrors((current) => {
        if (!current.property_name) return current;
        const next = { ...current };
        delete next.property_name;
        return next;
      });
    }
    ["exterior_condition", "maintenance_signals", "overall_feel"].forEach((field) => {
      if (field in patch && patch[field]) {
        setEditErrors((current) => {
          if (!current[field]) return current;
          const next = { ...current };
          delete next[field];
          return next;
        });
      }
    });
  };

  const handleUpdate = async () => {
    if (!editForm || !editId) return;
    const nextErrors = {};
    if (!editForm.property_name.trim()) {
      nextErrors.property_name = "Property name is required.";
    }
    if (!editForm.exterior_condition) {
      nextErrors.exterior_condition = "Exterior condition is required.";
    }
    if (!editForm.maintenance_signals) {
      nextErrors.maintenance_signals = "Maintenance signals are required.";
    }
    if (!editForm.overall_feel) {
      nextErrors.overall_feel = "Overall feel is required.";
    }
    setEditErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast({ type: "error", title: "Validation error", message: "Complete all required fields." });
      return;
    }

    setSavingId(editId);
    try {
      const duplicates = await findDuplicateProperties(
        editForm.property_name,
        editForm.street_address,
        editForm.city,
        editForm.state,
        editForm.zip,
        editId
      );
      if (duplicates.length) {
        const existing = duplicates[0];
        const addressParts = [
          existing.street_address,
          existing.city,
          existing.state,
          existing.zip
        ].filter(Boolean);
        const addressLabel = addressParts.length ? addressParts.join(", ") : "(no address)";
        const confirmed = window.confirm(
          `Possible duplicate found: ${existing.property_name} at ${addressLabel}. Save anyway?`
        );
        if (!confirmed) {
          setSavingId(null);
          return;
        }
      }

      const parsedUnits = editForm.units_est === "" ? null : Number(editForm.units_est);
      const computedClass = derivePropertyClass(editForm);
      await updateProperty(editId, {
        ...editForm,
        property_class: computedClass,
        class_guess: computedClass,
        units_est: Number.isFinite(parsedUnits) ? parsedUnits : null
      });
      showToast({ type: "success", title: "Property updated", message: "Changes saved." });
      refreshProperties();
      cancelEdit();
    } catch (error) {
      const message = error?.message || "Update failed.";
      showToast({ type: "error", title: "Update failed", message });
      setSavingId(null);
    }
  };


  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Properties</div>
          <div className="page-subtitle">Mobile-first scouting list</div>
        </div>
        <div className="action-grid">
          <button className="ghost" type="button" onClick={() => navigate("/data")}>
            Data
          </button>
          <button className="primary" type="button" onClick={() => navigate("/properties/new")}>
            New Property
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">Active Zones</div>
        <ActiveZonesBar activeZones={activeZones} onChange={setActiveZones} />
      </div>

      <div className="section">
        <div className="section-header">Search</div>
        <div className="form">
          <Field label="Search Properties">
            <Input
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by name, address, city, company, or zip"
            />
          </Field>
        </div>
      </div>

      <div className="section">
        <div className="section-header">Filters</div>
        <div className="form">
          <Field label="Coverage">
            <select
              className="input"
              value={coverageFilter}
              onChange={(event) => setCoverageFilter(event.target.value)}
            >
              <option value="all">All Coverage</option>
              <option value="active">Active</option>
              <option value="prospect">Prospect Only</option>
              <option value="out">Outside AO</option>
            </select>
          </Field>
        </div>
      </div>

      {visibleProperties.length ? (
        <div className="card-list">
          {visibleProperties.map((property) => {
            const isEditing = editId === property.id;
            const coverageLabel = property.in_ao
              ? property.coverage_type === "active"
                ? "Active"
                : "Prospect"
              : "Outside AO";
            const classLabel = property.property_class || property.class_guess || "Unclassified";
            const stats = photoStats[property.id] || {
              total: 0,
              uploaded: 0,
              failed: 0,
              uploading: 0,
              queued: 0
            };
            let syncLabel = "Local";
            let syncClass = "sync-local";
            if (stats.failed > 0) {
              syncLabel = "Failed";
              syncClass = "sync-failed";
            } else if (stats.uploading > 0) {
              syncLabel = "Uploading";
              syncClass = "sync-uploading";
            } else if (stats.queued > 0) {
              syncLabel = "Queued";
              syncClass = "sync-queued";
            } else if (stats.total > 0 && stats.uploaded >= stats.total) {
              syncLabel = "Synced";
              syncClass = "sync-synced";
            }
            return (
              <div key={property.id} className="card">
                <div className="card-title">{property.property_name}</div>
                <div className="card-body">
                  <div>{property.street_address}</div>
                  <div>
                    {property.city}{property.city ? ", " : ""}{property.state} {property.zip}
                  </div>
                </div>
                <div className="card-footer">
                  <span className="pill">Last Scouted: {property.last_scouted ? formatDate(property.last_scouted) : "Never"}</span>
                  <span className="pill">Score: {Number.isFinite(Number(property.last_score)) ? `${Number(property.last_score)} / 9` : "?"}</span>
                  <span className="pill">Confidence: {property.last_confidence || "?"}</span>
                  {property.last_disqualified ? <span className="pill disqualified">Disqualified</span> : null}
                  <span className="pill">Units: {property.units_est || "?"}</span>
                  <span className="pill">Class: {classLabel}</span>
                  <span className="pill">Zone: {property.zone || "Outside AO"}</span>
                  <span className="pill">Coverage: {coverageLabel}</span>
                  <span className="pill">Photos: {stats.total}</span>
                  <span className={`pill ${syncClass}`}>Sync: {syncLabel}</span>
                </div>
                <div className="action-grid">
                  <button className="secondary" type="button" onClick={() => navigate(`/properties/${property.id}`)}>
                    View
                  </button>
                  <button className="ghost" type="button" onClick={() => startEdit(property)}>
                    Edit
                  </button>
                </div>

                {isEditing ? (
                  <div className="form">
                    <Field label={
                      <span>
                        Property Name <span className="field-required">Required</span>
                      </span>
                    }>
                      <Input value={editForm.property_name} onChange={(value) => updateEdit({ property_name: value })} />
                      {editErrors.property_name ? <div className="field-error">{editErrors.property_name}</div> : null}
                    </Field>
                    <Field label="Management Group">
                      <Input value={editForm.management_group} onChange={(value) => updateEdit({ management_group: value })} />
                    </Field>
                    <Field label="Street Address">
                      <Input value={editForm.street_address} onChange={(value) => updateEdit({ street_address: value })} />
                    </Field>
                    <Field label="City">
                      <Input value={editForm.city} onChange={(value) => updateEdit({ city: value })} />
                    </Field>
                    <Field label="State">
                      <Input value={editForm.state} onChange={(value) => updateEdit({ state: value })} />
                    </Field>
                    <Field label="Zip">
                      <Input value={editForm.zip} onChange={(value) => updateEdit({ zip: value })} />
                    </Field>
                    <Field label="Zone (auto)">
                      <Input
                        value={(() => {
                          const info = resolveZoneForZip(editForm.zip);
                          if (!info.in_ao) return "Outside AO";
                          return `${info.zone.toUpperCase()} (${info.coverage_type})`;
                        })()}
                        onChange={() => {}}
                        disabled
                      />
                    </Field>
                    <TileGroup
                      label={
                        <span>
                          Exterior Condition <span className="field-required">Required</span>
                        </span>
                      }
                      value={editForm.exterior_condition}
                      onChange={(value) => updateEdit({ exterior_condition: value })}
                      options={PROPERTY_CLASS_OPTIONS.exterior_condition}
                    />
                    <div className="helper-text">
                      Look at paint, staining, siding/stucco, trim, visible wear, cleanliness, and exterior upkeep.
                    </div>
                    {editErrors.exterior_condition ? <div className="field-error">{editErrors.exterior_condition}</div> : null}
                    <TileGroup
                      label={
                        <span>
                          Maintenance Signals <span className="field-required">Required</span>
                        </span>
                      }
                      value={editForm.maintenance_signals}
                      onChange={(value) => updateEdit({ maintenance_signals: value })}
                      options={PROPERTY_CLASS_OPTIONS.maintenance_signals}
                    />
                    <div className="helper-text">
                      Look for signs of proactive upkeep vs reactive or deferred maintenance.
                    </div>
                    {editErrors.maintenance_signals ? <div className="field-error">{editErrors.maintenance_signals}</div> : null}
                    <TileGroup
                      label={
                        <span>
                          Operational Feel <span className="field-required">Required</span>
                        </span>
                      }
                      value={editForm.overall_feel}
                      onChange={(value) => updateEdit({ overall_feel: value })}
                      options={PROPERTY_CLASS_OPTIONS.overall_feel}
                    />
                    <div className="helper-text">
                      Based on what you can observe, how well-run does the property feel overall?
                    </div>
                    {editErrors.overall_feel ? <div className="field-error">{editErrors.overall_feel}</div> : null}
                    {getPropertyClassWarnings(editForm).map((warning) => (
                      <div key={warning} className="warning-banner">
                        {warning}
                      </div>
                    ))}
                    <Field label="Property Class (auto)">
                      <div className="computed-pill">
                        {derivePropertyClass(editForm) ? `Computed Property Class: ${derivePropertyClass(editForm)}` : "Complete the three inputs to classify."}
                      </div>
                      <div className="helper-text">
                        Class is computed from the three structured inputs (not user-selected).
                      </div>
                    </Field>
                    <Field label="Estimated Units">
                      <Input
                        type="number"
                        value={editForm.units_est}
                        onChange={(value) => updateEdit({ units_est: value })}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Source URL">
                      <Input value={editForm.source_url} onChange={(value) => updateEdit({ source_url: value })} />
                    </Field>
                    <Field label="Seed Notes">
                      <TextArea value={editForm.seed_notes} onChange={(value) => updateEdit({ seed_notes: value })} />
                    </Field>
                    <div className="action-grid">
                      <button className="primary" type="button" onClick={handleUpdate} disabled={savingId === editId}>
                        {savingId === editId ? "Saving..." : "Save Changes"}
                      </button>
                      <button className="ghost" type="button" onClick={cancelEdit} disabled={savingId === editId}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">No properties yet. Create your first scouting target.</div>
      )}
    </div>
  );
}
