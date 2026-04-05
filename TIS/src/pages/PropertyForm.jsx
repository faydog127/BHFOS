import { useEffect, useState } from "react";
import { createProperty, findDuplicateProperties, getProperty, updateProperty } from "../db/api";
import { Field, Input, TextArea } from "../components/Field";
import { TileGroup } from "../components/Segmented";
import { useToast } from "../components/Toast";
import { navigate } from "../router";
import { createId } from "../utils/uuid";
import { resolveZoneForZip } from "../utils/zones";
import { PROPERTY_CLASS_OPTIONS, derivePropertyClass, getPropertyClassWarnings } from "../utils/propertyClass";

const initialForm = {
  property_name: "",
  management_group: "",
  street_address: "",
  city: "",
  state: "",
  zip: "",
  exterior_condition: "",
  maintenance_signals: "",
  overall_feel: "",
  property_class: "",
  units_est: "",
  source_url: "",
  seed_notes: ""
};

export default function PropertyForm({ propertyId }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [debugLog, setDebugLog] = useState("");
  const [loading, setLoading] = useState(Boolean(propertyId));
  const { showToast } = useToast();
  const isEditing = Boolean(propertyId);

  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    getProperty(propertyId).then((row) => {
      if (!active) return;
      if (!row) {
        setDebugLog("Create Property Debug: property not found.");
        setLoading(false);
        return;
      }
      setForm({
        property_name: row.property_name || "",
        management_group: row.management_group || "",
        street_address: row.street_address || "",
        city: row.city || "",
        state: row.state || "",
        zip: row.zip || "",
        exterior_condition: row.exterior_condition || "",
        maintenance_signals: row.maintenance_signals || "",
        overall_feel: row.overall_feel || "",
        property_class: row.property_class || row.class_guess || "",
        units_est: row.units_est === null || row.units_est === undefined ? "" : String(row.units_est),
        source_url: row.source_url || "",
        seed_notes: row.seed_notes || ""
      });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [propertyId]);

  const update = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    if ("property_name" in patch && patch.property_name.trim()) {
      setErrors((current) => {
        if (!current.property_name) return current;
        const next = { ...current };
        delete next.property_name;
        return next;
      });
    }
    ["exterior_condition", "maintenance_signals", "overall_feel"].forEach((field) => {
      if (field in patch && patch[field]) {
        setErrors((current) => {
          if (!current[field]) return current;
          const next = { ...current };
          delete next[field];
          return next;
        });
      }
    });
  };

  const handleSave = async () => {
    const nextErrors = {};
    if (!form.property_name.trim()) {
      nextErrors.property_name = "Property name is required.";
    }
    if (!form.exterior_condition) {
      nextErrors.exterior_condition = "Exterior condition is required.";
    }
    if (!form.maintenance_signals) {
      nextErrors.maintenance_signals = "Maintenance signals are required.";
    }
    if (!form.overall_feel) {
      nextErrors.overall_feel = "Overall feel is required.";
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      const message = "Create Property Debug: validation failed (required fields missing).";
      setDebugLog(message);
      console.warn(message);
      showToast({ type: "error", title: "Validation error", message: "Complete all required fields." });
      return;
    }

    try {
      const duplicates = await findDuplicateProperties(
        form.property_name,
        form.street_address,
        form.city,
        form.state,
        form.zip,
        propertyId
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
          `Possible duplicate found: ${existing.property_name} at ${addressLabel}. Create anyway?`
        );
        if (!confirmed) {
          const message = "Create Property Debug: duplicate rejected by user.";
          setDebugLog(message);
          console.warn(message);
          return;
        }
      }

      const id = propertyId || createId();
      const parsedUnits = form.units_est === "" ? null : Number(form.units_est);
      const computedClass = derivePropertyClass(form);
      const payload = {
        id,
        ...form,
        property_class: computedClass,
        class_guess: computedClass,
        units_est: Number.isFinite(parsedUnits) ? parsedUnits : null
      };

      setDebugLog(`Create Property Debug: saving ${id}...`);
      console.log("Create Property Debug: saving", payload);
      if (isEditing) {
        await updateProperty(id, payload);
        setDebugLog(`Create Property Debug: updated ${id}.`);
        console.log("Create Property Debug: updated", id);
        showToast({ type: "success", title: "Property updated", message: "Changes saved." });
      } else {
        await createProperty(payload);
        setDebugLog(`Create Property Debug: saved ${id}.`);
        console.log("Create Property Debug: saved", id);
        showToast({ type: "success", title: "Property saved", message: "Ready to scout." });
        sessionStorage.setItem(
          "tis:propertySaved",
          JSON.stringify({ id, at: new Date().toISOString() })
        );
      }
      navigate(`/properties/${id}`);
    } catch (error) {
      const detail = error?.message || String(error);
      const message = `Create Property Debug: save failed - ${detail}`;
      setDebugLog(message);
      console.error(message, error);
      showToast({ type: "error", title: "Save failed", message: "Property could not be saved." });
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{isEditing ? "Edit Property" : "New Property"}</div>
          <div className="page-subtitle">
            {isEditing ? "Update property details." : "Capture the basics before scouting."}
          </div>
        </div>
        <button className="ghost" type="button" onClick={() => navigate("/properties")}>Back</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading property...</div>
      ) : (
        <div className="form">
        <Field label={
          <span>
            Property Name <span className="field-required">Required</span>
          </span>
        }>
          <Input value={form.property_name} onChange={(value) => update({ property_name: value })} />
          {errors.property_name ? <div className="field-error">{errors.property_name}</div> : null}
        </Field>
        <Field label="Management Group">
          <Input value={form.management_group} onChange={(value) => update({ management_group: value })} />
        </Field>
        <Field label="Street Address">
          <Input value={form.street_address} onChange={(value) => update({ street_address: value })} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(value) => update({ city: value })} />
        </Field>
        <Field label="State">
          <Input value={form.state} onChange={(value) => update({ state: value })} />
        </Field>
        <Field label="Zip">
          <Input value={form.zip} onChange={(value) => update({ zip: value })} />
        </Field>
        <Field label="Zone (auto)">
          <Input
            value={(() => {
              const info = resolveZoneForZip(form.zip);
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
          value={form.exterior_condition}
          onChange={(value) => update({ exterior_condition: value })}
          options={PROPERTY_CLASS_OPTIONS.exterior_condition}
        />
        <div className="helper-text">
          Look at paint, staining, siding/stucco, trim, visible wear, cleanliness, and exterior upkeep.
        </div>
        {errors.exterior_condition ? <div className="field-error">{errors.exterior_condition}</div> : null}
        <TileGroup
          label={
            <span>
              Maintenance Signals <span className="field-required">Required</span>
            </span>
          }
          value={form.maintenance_signals}
          onChange={(value) => update({ maintenance_signals: value })}
          options={PROPERTY_CLASS_OPTIONS.maintenance_signals}
        />
        <div className="helper-text">
          Look for signs of proactive upkeep vs reactive or deferred maintenance.
        </div>
        {errors.maintenance_signals ? <div className="field-error">{errors.maintenance_signals}</div> : null}
        <TileGroup
          label={
            <span>
              Operational Feel <span className="field-required">Required</span>
            </span>
          }
          value={form.overall_feel}
          onChange={(value) => update({ overall_feel: value })}
          options={PROPERTY_CLASS_OPTIONS.overall_feel}
        />
        <div className="helper-text">
          Based on what you can observe, how well-run does the property feel overall?
        </div>
        {errors.overall_feel ? <div className="field-error">{errors.overall_feel}</div> : null}
        {getPropertyClassWarnings(form).map((warning) => (
          <div key={warning} className="warning-banner">
            {warning}
          </div>
        ))}
        <Field label="Property Class (auto)">
          <div className="computed-pill">
            {derivePropertyClass(form) ? `Computed Property Class: ${derivePropertyClass(form)}` : "Complete the three inputs to classify."}
          </div>
          <div className="helper-text">
            Class is computed from the three structured inputs (not user-selected).
          </div>
        </Field>
        <Field label="Estimated Units">
          <Input
            type="number"
            value={form.units_est}
            onChange={(value) => update({ units_est: value })}
            placeholder="0"
          />
        </Field>
        <Field label="Source URL">
          <Input value={form.source_url} onChange={(value) => update({ source_url: value })} />
        </Field>
        <Field label="Seed Notes">
          <TextArea value={form.seed_notes} onChange={(value) => update({ seed_notes: value })} />
        </Field>
      </div>
      )}

      <div className="sticky-actions">
        <button className="primary" type="button" onClick={handleSave}>
          {isEditing ? "Save Changes" : "Save Property"}
        </button>
        <div className="debug-log" role="status">
          {debugLog || "Create Property Debug: idle"}
        </div>
      </div>
    </div>
  );
}
