import { all, get, getDb, persistDb, run } from "./sqlite";
import { normalizeKey } from "../utils/slug";
import { fromDbBool, toDbBool } from "../utils/format";
import { resolveZoneForZip } from "../utils/zones";
import { derivePropertyClass } from "../utils/propertyClass";
import { getSupabaseClient, supabaseEnabled } from "./supabaseClient";
import { getPhotoBlob, removePhotoBlob } from "./idb";
import { computeHazardPrimaryAngle, computeHazardTotal } from "../utils/hazardScore";
import { normalizePricingV1, serializePricingV1 } from "../utils/pricingV1";

const supabase = getSupabaseClient();
const SUPABASE_TABLES = {
  properties: "tis_properties",
  assessments: "tis_assessments",
  photos: "tis_photos"
};
const SUPABASE_PHOTO_BUCKET = import.meta.env.VITE_SUPABASE_PHOTO_BUCKET || "tis-photos";
const PHOTO_STATUS = {
  queued: "queued",
  uploading: "uploading",
  uploaded: "uploaded",
  failed: "failed"
};
const SYNC_ACTION = {
  upsert: "upsert"
};
let photoUploadPromise = null;
let syncQueuePromise = null;

const normalizeBool = (value) => {
  if (value === null || value === undefined) return null;
  return Boolean(value);
};

const isSupabaseReady = () => Boolean(supabaseEnabled && supabase);

const isLocalPhotoUri = (value) => typeof value === "string" && value.startsWith("idb://");

const normalizePhotoUri = (value) => {
  if (!value) return "";
  if (isLocalPhotoUri(value)) return "";
  return value;
};

const normalizeNullableTimestamp = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const serializeDisqualifierReasons = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "string") return value;
  return "";
};

const normalizeText = (value) => {
  if (!value) return "";
  return String(value).toLowerCase();
};

const textIncludesAny = (text, terms) => terms.some((term) => text.includes(term));

const parseDisqualifierReasons = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    // ignore parse failures
  }
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildPhotoStoragePath = (photo) => {
  const filename = photo.stored_filename || photo.original_filename || `${photo.id}.jpg`;
  const assessmentId = photo.assessment_id || "unassigned";
  return `${assessmentId}/${filename}`;
};

export async function getPhotoAccessUrl(photo, options = {}) {
  if (!photo) return "";
  const storageUri = photo.storage_uri || "";
  const hasRemote = storageUri && !isLocalPhotoUri(storageUri);
  if (hasRemote && !options.forceSigned) return storageUri;
  if (!isSupabaseReady()) return hasRemote ? storageUri : "";
  const path = buildPhotoStoragePath(photo);
  if (!path) return hasRemote ? storageUri : "";
  const ttlSeconds = Number.isFinite(options.ttlSeconds) ? options.ttlSeconds : 3600;
  const { data, error } = await supabase
    .storage
    .from(SUPABASE_PHOTO_BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error) {
    console.warn("Supabase signed URL failed", error);
    return hasRemote ? storageUri : "";
  }
  return data?.signedUrl || (hasRemote ? storageUri : "");
}

async function upsertSupabase(table, rows) {
  if (!isSupabaseReady()) return { skipped: true, reason: "supabase" };
  const payload = Array.isArray(rows) ? rows : [rows];
  if (!payload.length) return { skipped: true, reason: "empty" };
  const { error } = await supabase
    .from(SUPABASE_TABLES[table] || table)
    .upsert(payload, { onConflict: "id" });
  if (error) {
    console.warn(`Supabase upsert failed (${table})`, error);
    return { error };
  }
  return { error: null };
}

async function deleteSupabase(table, id) {
  if (!isSupabaseReady()) return { skipped: true, reason: "supabase" };
  const { error } = await supabase
    .from(SUPABASE_TABLES[table] || table)
    .delete()
    .eq("id", id);
  if (error) {
    console.warn(`Supabase delete failed (${table})`, error);
    return { error };
  }
  return { error: null };
}

function queueUpsertSync(db, table, id, timestamp = new Date().toISOString()) {
  run(
    db,
    `
    INSERT OR REPLACE INTO sync_queue (
      table_name, record_id, action, last_error, attempts, queued_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `,
    [table, id, SYNC_ACTION.upsert, "", 0, timestamp, timestamp]
  );
}

function clearQueuedSync(db, table, id, action = SYNC_ACTION.upsert) {
  run(db, "DELETE FROM sync_queue WHERE table_name = ? AND record_id = ? AND action = ?;", [
    table,
    id,
    action
  ]);
}

function markQueuedSyncFailure(db, entry, error) {
  const now = new Date().toISOString();
  run(
    db,
    `
    UPDATE sync_queue
    SET last_error = ?, attempts = COALESCE(attempts, 0) + 1, updated_at = ?
    WHERE table_name = ? AND record_id = ? AND action = ?;
    `,
    [
      error?.message || String(error || "Sync failed."),
      now,
      entry.table_name,
      entry.record_id,
      entry.action
    ]
  );
}

function getQueuedSyncPayload(db, table, id) {
  if (table === "properties") {
    const row = get(db, "SELECT * FROM properties WHERE id = ?;", [id]);
    return row ? mapPropertyToSupabase(row) : null;
  }
  if (table === "assessments") {
    const row = get(db, "SELECT * FROM assessments WHERE id = ?;", [id]);
    return row ? mapAssessmentToSupabase(row) : null;
  }
  if (table === "photos") {
    const row = get(db, "SELECT * FROM photos WHERE id = ?;", [id]);
    return row ? mapPhotoToSupabase(row) : null;
  }
  return null;
}

export async function processSyncQueue() {
  if (!isSupabaseReady()) {
    return { skipped: true, reason: "supabase" };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { skipped: true, reason: "offline" };
  }
  if (syncQueuePromise) {
    return syncQueuePromise;
  }

  syncQueuePromise = (async () => {
    const db = await getDb();
    const entries = all(
      db,
      `
      SELECT table_name, record_id, action, attempts, queued_at, updated_at
      FROM sync_queue
      ORDER BY
        CASE table_name
          WHEN 'properties' THEN 0
          WHEN 'assessments' THEN 1
          WHEN 'photos' THEN 2
          ELSE 3
        END ASC,
        queued_at ASC,
        updated_at ASC;
      `
    );

    let synced = 0;
    let failed = 0;
    let updated = false;

    for (const entry of entries) {
      if (entry.action !== SYNC_ACTION.upsert) {
        clearQueuedSync(db, entry.table_name, entry.record_id, entry.action);
        updated = true;
        continue;
      }

      const payload = getQueuedSyncPayload(db, entry.table_name, entry.record_id);
      if (!payload) {
        clearQueuedSync(db, entry.table_name, entry.record_id, entry.action);
        updated = true;
        continue;
      }

      const result = await upsertSupabase(entry.table_name, payload);
      if (result?.error) {
        markQueuedSyncFailure(db, entry, result.error);
        updated = true;
        failed += 1;
        continue;
      }

      clearQueuedSync(db, entry.table_name, entry.record_id, entry.action);
      updated = true;
      synced += 1;
    }

    if (updated) {
      await persistDb(db);
    }

    const remaining = get(db, "SELECT COUNT(*) AS count FROM sync_queue;")?.count || 0;
    return { synced, failed, queued: Number(remaining) || 0 };
  })();

  try {
    return await syncQueuePromise;
  } finally {
    syncQueuePromise = null;
  }
}

function mapPropertyToSupabase(data) {
  const zoneInfo = resolveZoneForZip(data.zip);
  const derivedClass = derivePropertyClass(data);
  const classValue = derivedClass || data.property_class || data.class_guess || "";
  return {
    id: data.id,
    property_name: data.property_name,
    management_group: data.management_group || "",
    zone: zoneInfo.zone,
    coverage_type: zoneInfo.coverage_type,
    in_ao: zoneInfo.in_ao,
    street_address: data.street_address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    class_guess: classValue,
    exterior_condition: data.exterior_condition || "",
    maintenance_signals: data.maintenance_signals || "",
    overall_feel: data.overall_feel || "",
    property_class: classValue,
    units_est: data.units_est ?? null,
    source_url: data.source_url || "",
    seed_notes: data.seed_notes || "",
    lead_status: data.lead_status || "",
    lead_contacted_at: normalizeNullableTimestamp(data.lead_contacted_at),
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

function mapAssessmentToSupabase(data) {
  return {
    id: data.id,
    property_id: data.property_id,
    scout_mode: data.scout_mode,
    scout_type: data.scout_type || "",
    gut_feel_score: data.gut_feel_score ?? null,
    on_site_office_visible: normalizeBool(data.on_site_office_visible),
    leasing_activity_visible: normalizeBool(data.leasing_activity_visible),
    maintenance_presence_visible: normalizeBool(data.maintenance_presence_visible),
    management_quality_signal: data.management_quality_signal || "",
    exterior_condition: data.exterior_condition || "",
    access_ease: data.access_difficulty || data.access_ease || "",
    building_height: data.building_height || "",
    termination_type: data.termination_type || "",
    access_constraints: data.access_constraints || "",
    access_difficulty: data.access_difficulty || "",
    service_fit: data.service_fit || "",
    entry_path: data.entry_path || "",
    partner_potential: data.partner_potential || "",
    follow_up_priority: data.follow_up_priority || "",
    problem_score: data.problem_score ?? null,
    access_score: data.access_score ?? null,
    leverage_score: data.leverage_score ?? null,
    momentum_score: data.momentum_score ?? null,
    total_score: data.total_score ?? null,
    hazard_severity: data.hazard_severity ?? null,
    hazard_prevalence: data.hazard_prevalence ?? null,
    hazard_maintenance_gap: data.hazard_maintenance_gap ?? null,
    hazard_engagement_path: data.hazard_engagement_path ?? null,
    hazard_total: data.hazard_total ?? null,
    hazard_primary_angle: data.hazard_primary_angle || "",
    confidence_level: data.confidence_level || "",
    hook: data.hook || "",
    decision_maker_known: normalizeBool(data.decision_maker_known),
    decision_maker_contacted: normalizeBool(data.decision_maker_contacted),
    contact_name: data.contact_name || "",
    contact_role: data.contact_role || "",
    contact_phone: data.contact_phone || "",
    contact_email: data.contact_email || "",
    contact_notes: data.contact_notes || "",
    disqualified: normalizeBool(data.disqualified),
    disqualifier_reasons: serializeDisqualifierReasons(data.disqualifier_reasons),
    next_action_owner: data.next_action_owner || "",
    next_action_type: data.next_action_type || "",
    next_action_due: data.next_action_due || "",
    next_action_notes: data.next_action_notes || "",
    opportunity_notes: data.opportunity_notes || "",
    risk_or_barrier_notes: data.risk_or_barrier_notes || "",
    general_notes: data.general_notes || "",
    pricing_v1: normalizePricingV1(data.pricing_v1),
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

function mapPhotoToSupabase(photo) {
  return {
    id: photo.id,
    assessment_id: photo.assessment_id,
    timestamp: photo.timestamp,
    tag: photo.tag,
    note: photo.note || "",
    original_filename: photo.original_filename || "",
    stored_filename: photo.stored_filename || "",
    storage_uri: normalizePhotoUri(photo.storage_uri || ""),
    created_at: photo.created_at
  };
}

function mapAssessment(row) {
  if (!row) return null;
  const normalizedScores = {
    problem_score: Number.isFinite(Number(row.problem_score)) ? Number(row.problem_score) : 0,
    access_score: Number.isFinite(Number(row.access_score)) ? Number(row.access_score) : 0,
    leverage_score: Number.isFinite(Number(row.leverage_score)) ? Number(row.leverage_score) : 0,
    momentum_score: Number.isFinite(Number(row.momentum_score)) ? Number(row.momentum_score) : 0,
    total_score: Number.isFinite(Number(row.total_score))
      ? Number(row.total_score)
      : 0
  };
  const normalizedHazard = {
    hazard_severity: Number.isFinite(Number(row.hazard_severity)) ? Number(row.hazard_severity) : 0,
    hazard_prevalence: Number.isFinite(Number(row.hazard_prevalence))
      ? Number(row.hazard_prevalence)
      : 0,
    hazard_maintenance_gap: Number.isFinite(Number(row.hazard_maintenance_gap))
      ? Number(row.hazard_maintenance_gap)
      : 0,
    hazard_engagement_path: Number.isFinite(Number(row.hazard_engagement_path))
      ? Number(row.hazard_engagement_path)
      : 0,
    hazard_total: Number.isFinite(Number(row.hazard_total)) ? Number(row.hazard_total) : 0
  };
  return {
    ...row,
    ...normalizedScores,
    ...normalizedHazard,
    hazard_primary_angle:
      row.hazard_primary_angle || computeHazardPrimaryAngle({ ...row, ...normalizedHazard }),
    on_site_office_visible: fromDbBool(row.on_site_office_visible),
    leasing_activity_visible: fromDbBool(row.leasing_activity_visible),
    maintenance_presence_visible: fromDbBool(row.maintenance_presence_visible),
    decision_maker_known: fromDbBool(row.decision_maker_known),
    decision_maker_contacted: fromDbBool(row.decision_maker_contacted),
    disqualified: fromDbBool(row.disqualified),
    disqualifier_reasons: parseDisqualifierReasons(row.disqualifier_reasons),
    pricing_v1: normalizePricingV1(row.pricing_v1)
  };
}

export async function listProperties() {
  const db = await getDb();
  return all(
    db,
    `
    SELECT p.*, (
      SELECT MAX(created_at) FROM assessments a WHERE a.property_id = p.id
    ) AS last_scouted,
    (
      SELECT total_score FROM assessments a
      WHERE a.property_id = p.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS last_score,
    (
      SELECT confidence_level FROM assessments a
      WHERE a.property_id = p.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS last_confidence,
    (
      SELECT disqualified FROM assessments a
      WHERE a.property_id = p.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS last_disqualified
    FROM properties p
    ORDER BY p.property_name COLLATE NOCASE ASC, p.updated_at DESC;
    `
  );
}

export async function listAssessments() {
  const db = await getDb();
  return all(db, "SELECT * FROM assessments ORDER BY created_at DESC;").map(mapAssessment);
}

export async function listPhotos() {
  const db = await getDb();
  return all(db, "SELECT * FROM photos ORDER BY timestamp DESC;");
}

function deriveHazardFromEvidence(assessment, property, photos) {
  const textBlob = [
    property?.seed_notes,
    property?.maintenance_signals,
    property?.exterior_condition,
    property?.overall_feel,
    assessment?.opportunity_notes,
    assessment?.risk_or_barrier_notes,
    assessment?.general_notes,
    assessment?.service_fit,
    assessment?.next_action_notes
  ]
    .filter(Boolean)
    .map((value) => String(value))
    .join(" ");

  const text = normalizeText(textBlob);
  const photoNotes = (photos || [])
    .map((photo) => normalizeText(photo.note || ""))
    .filter(Boolean)
    .join(" ");
  const combinedText = [text, photoNotes].filter(Boolean).join(" ");

  const tagCounts = {};
  (photos || []).forEach((photo) => {
    if (!photo?.tag) return;
    tagCounts[photo.tag] = (tagCounts[photo.tag] || 0) + 1;
  });

  const lintCount = tagCounts.lint_buildup || 0;
  const blockedCount = tagCounts.blocked_termination || 0;
  const hazardCount = tagCounts.safety_hazard || 0;
  const improperCount = tagCounts.improper_termination || 0;
  const damageCount = tagCounts.damaged_or_missing_cover || 0;

  const severeTerms = [
    "blocked",
    "fire risk",
    "hazard",
    "painted over",
    "painted into",
    "restricted",
    "airflow",
    "air flow",
    "cemented",
    "bird guard",
    "rodent guard",
    "significant risk"
  ];
  const lintTerms = [
    "lint",
    "dirty vent",
    "dirty vents",
    "not been cleaned",
    "needs cleaning",
    "dryer vent",
    "dryer vents",
    "exhaust vent",
    "exhaust vents"
  ];
  const minorTerms = ["minor", "light lint"];

  let severity = 0;
  if (blockedCount > 0 || hazardCount > 0 || textIncludesAny(combinedText, severeTerms)) {
    severity = 4;
  } else if (
    lintCount >= 3 ||
    (textIncludesAny(combinedText, ["many", "most", "nearly all", "narly all"]) &&
      textIncludesAny(combinedText, ["lint", "dirty", "not been cleaned", "needs cleaning"]))
  ) {
    severity = 3;
  } else if (
    lintCount >= 1 ||
    improperCount > 0 ||
    damageCount > 0 ||
    textIncludesAny(combinedText, lintTerms)
  ) {
    severity = 2;
  } else if (textIncludesAny(combinedText, minorTerms)) {
    severity = 1;
  }

  let prevalence = 0;
  if (
    lintCount >= 4 ||
    blockedCount >= 2 ||
    textIncludesAny(combinedText, ["many", "most", "nearly all", "narly all", "numerous", "multiple"])
  ) {
    prevalence = 2;
  } else if (
    lintCount >= 1 ||
    blockedCount >= 1 ||
    textIncludesAny(combinedText, ["some", "a few", "several", "a number of"])
  ) {
    prevalence = 1;
  }

  let maintenanceGap = 0;
  if (
    textIncludesAny(combinedText, [
      "no plan",
      "not been cleaned",
      "doesn't appear",
      "doesnt appear",
      "every 2 years",
      "painted over",
      "painted into",
      "not maintained",
      "maintenance has not been maintained",
      "no schedule",
      "no maintenance",
      "vendor every"
    ])
  ) {
    maintenanceGap = 2;
  } else if (
    textIncludesAny(combinedText, [
      "some maintenance",
      "mixed",
      "partial",
      "modified",
      "inconsistent",
      "clean terminations as well as",
      "recently painted"
    ])
  ) {
    maintenanceGap = 1;
  }

  let engagementPath = 0;
  const accessScore = Number.isFinite(Number(assessment?.access_score))
    ? Number(assessment?.access_score)
    : 0;
  if (accessScore > 0) {
    engagementPath = Math.min(2, accessScore);
  } else if (
    textIncludesAny(combinedText, ["access is not an issue", "office", "leasing"])
  ) {
    engagementPath = 2;
  } else if (
    assessment?.entry_path ||
    assessment?.access_ease ||
    assessment?.on_site_office_visible ||
    assessment?.leasing_activity_visible
  ) {
    engagementPath = 1;
  }

  const hazardTotal =
    severity + prevalence + maintenanceGap + engagementPath;
  const hazardPrimaryAngle = computeHazardPrimaryAngle({
    hazard_severity: severity,
    hazard_prevalence: prevalence,
    hazard_maintenance_gap: maintenanceGap,
    hazard_engagement_path: engagementPath,
    hazard_total: hazardTotal
  });

  return {
    hazard_severity: severity,
    hazard_prevalence: prevalence,
    hazard_maintenance_gap: maintenanceGap,
    hazard_engagement_path: engagementPath,
    hazard_total: hazardTotal,
    hazard_primary_angle: hazardPrimaryAngle
  };
}

export async function backfillHazardScores() {
  const db = await getDb();
  const assessments = all(db, "SELECT * FROM assessments ORDER BY created_at DESC;");
  if (!assessments.length) return { updated: 0, total: 0 };
  const properties = all(db, "SELECT * FROM properties;");
  const photos = all(db, "SELECT assessment_id, tag, note FROM photos;");
  const propertyMap = new Map(properties.map((row) => [row.id, row]));
  const photosByAssessment = new Map();
  photos.forEach((photo) => {
    if (!photo?.assessment_id) return;
    if (!photosByAssessment.has(photo.assessment_id)) {
      photosByAssessment.set(photo.assessment_id, []);
    }
    photosByAssessment.get(photo.assessment_id).push(photo);
  });

  const updatedRows = [];
  let updated = 0;
  assessments.forEach((row) => {
    const hasHazardData = [
      row.hazard_severity,
      row.hazard_prevalence,
      row.hazard_maintenance_gap,
      row.hazard_engagement_path,
      row.hazard_total
    ].some((value) => value !== null && value !== undefined && value !== "");
    if (hasHazardData) return;
    const property = propertyMap.get(row.property_id);
    const evidencePhotos = photosByAssessment.get(row.id) || [];
    const derived = deriveHazardFromEvidence(row, property, evidencePhotos);
    run(
      db,
      `
      UPDATE assessments
      SET hazard_severity = ?,
          hazard_prevalence = ?,
          hazard_maintenance_gap = ?,
          hazard_engagement_path = ?,
          hazard_total = ?,
          hazard_primary_angle = ?
      WHERE id = ?;
      `,
      [
        derived.hazard_severity,
        derived.hazard_prevalence,
        derived.hazard_maintenance_gap,
        derived.hazard_engagement_path,
        derived.hazard_total,
        derived.hazard_primary_angle,
        row.id
      ]
    );
    updated += 1;
    updatedRows.push({ ...row, ...derived });
  });

  if (updated) {
    await persistDb(db);
    if (updatedRows.length && isSupabaseReady()) {
      const payload = updatedRows.map((row) => mapAssessmentToSupabase(row));
      const { error } = await supabase
        .from(SUPABASE_TABLES.assessments)
        .upsert(payload, { onConflict: "id" });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("Supabase hazard backfill failed", error);
        throw error;
      }
    }
  }

  return { updated, total: assessments.length };
}

export async function listPropertyPhotoStats() {
  const db = await getDb();
  return all(
    db,
    `
    SELECT
      a.property_id AS property_id,
      COUNT(p.id) AS total,
      SUM(
        CASE
          WHEN (p.storage_uri IS NOT NULL AND p.storage_uri <> '' AND p.storage_uri NOT LIKE 'idb://%')
            OR p.upload_status = '${PHOTO_STATUS.uploaded}'
          THEN 1 ELSE 0
        END
      ) AS uploaded,
      SUM(CASE WHEN p.upload_status = '${PHOTO_STATUS.failed}' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN p.upload_status = '${PHOTO_STATUS.uploading}' THEN 1 ELSE 0 END) AS uploading,
      SUM(
        CASE
          WHEN p.upload_status = '${PHOTO_STATUS.queued}' OR p.upload_status IS NULL OR p.upload_status = ''
          THEN 1 ELSE 0
        END
      ) AS queued
    FROM photos p
    JOIN assessments a ON a.id = p.assessment_id
    GROUP BY a.property_id;
    `
  );
}

export async function getProperty(id) {
  const db = await getDb();
  return get(db, "SELECT * FROM properties WHERE id = ?;", [id]);
}

export async function createProperty(data) {
  const db = await getDb();
  const now = new Date().toISOString();
  const zoneInfo = resolveZoneForZip(data.zip);
  const derivedClass = derivePropertyClass(data);
  const classValue = derivedClass || data.property_class || data.class_guess || "";
  run(
    db,
    `
    INSERT INTO properties (
      id, property_name, management_group, zone, coverage_type, in_ao, street_address, city, state, zip,
      class_guess, exterior_condition, maintenance_signals, overall_feel, property_class,
      units_est, source_url, seed_notes, lead_status, lead_contacted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      data.id,
      data.property_name,
      data.management_group || "",
      zoneInfo.zone,
      zoneInfo.coverage_type,
      toDbBool(zoneInfo.in_ao),
      data.street_address || "",
      data.city || "",
      data.state || "",
      data.zip || "",
      classValue,
      data.exterior_condition || "",
      data.maintenance_signals || "",
      data.overall_feel || "",
      classValue,
      data.units_est ?? null,
      data.source_url || "",
      data.seed_notes || "",
      data.lead_status || "",
      data.lead_contacted_at || "",
      now,
      now
    ]
  );
  queueUpsertSync(db, "properties", data.id, now);
  await persistDb(db);
  void processSyncQueue();
}

export async function updateProperty(id, data) {
  const db = await getDb();
  const now = new Date().toISOString();
  const zoneInfo = resolveZoneForZip(data.zip);
  const derivedClass = derivePropertyClass(data);
  const classValue = derivedClass || data.property_class || data.class_guess || "";
  run(
    db,
    `
    UPDATE properties
    SET property_name = ?,
        management_group = ?,
        zone = ?,
        coverage_type = ?,
        in_ao = ?,
        street_address = ?,
        city = ?,
        state = ?,
        zip = ?,
        class_guess = ?,
        exterior_condition = ?,
        maintenance_signals = ?,
        overall_feel = ?,
        property_class = ?,
        units_est = ?,
        source_url = ?,
        seed_notes = ?,
        lead_status = ?,
        lead_contacted_at = ?,
        updated_at = ?
    WHERE id = ?;
    `,
    [
      data.property_name,
      data.management_group || "",
      zoneInfo.zone,
      zoneInfo.coverage_type,
      toDbBool(zoneInfo.in_ao),
      data.street_address || "",
      data.city || "",
      data.state || "",
      data.zip || "",
      classValue,
      data.exterior_condition || "",
      data.maintenance_signals || "",
      data.overall_feel || "",
      classValue,
      data.units_est ?? null,
      data.source_url || "",
      data.seed_notes || "",
      data.lead_status || "",
      data.lead_contacted_at || "",
      now,
      id
    ]
  );
  queueUpsertSync(db, "properties", id, now);
  await persistDb(db);
  void processSyncQueue();
}

export async function backfillPropertyZones() {
  const db = await getDb();
  const rows = all(db, "SELECT id, zip, zone, coverage_type, in_ao FROM properties;");
  let updated = 0;
  rows.forEach((row) => {
    const zoneInfo = resolveZoneForZip(row.zip);
    const nextZone = zoneInfo.zone;
    const nextCoverage = zoneInfo.coverage_type;
    const nextInAo = toDbBool(zoneInfo.in_ao);
    if (
      (row.zone || "") !== nextZone ||
      (row.coverage_type || "") !== nextCoverage ||
      (row.in_ao ?? null) !== nextInAo
    ) {
      run(
        db,
        "UPDATE properties SET zone = ?, coverage_type = ?, in_ao = ? WHERE id = ?;",
        [nextZone, nextCoverage, nextInAo, row.id]
      );
      updated += 1;
    }
  });
  if (updated) {
    await persistDb(db);
  }
  return updated;
}

export async function findDuplicateProperties(name, streetAddress, city, state, zip, excludeId) {
  const db = await getDb();
  const rows = all(db, "SELECT id, property_name, street_address, city, state, zip FROM properties;");
  const nameKey = normalizeKey(name);
  const streetKey = normalizeKey(streetAddress);
  const cityKey = normalizeKey(city);
  const stateKey = normalizeKey(state);
  const zipKey = normalizeKey(zip);
  return rows.filter((row) => {
    if (excludeId && row.id === excludeId) return false;
    if (normalizeKey(row.property_name) !== nameKey) return false;
    if (streetKey && normalizeKey(row.street_address) !== streetKey) return false;
    if (cityKey && normalizeKey(row.city) !== cityKey) return false;
    if (stateKey && normalizeKey(row.state) !== stateKey) return false;
    if (zipKey && normalizeKey(row.zip) !== zipKey) return false;
    return true;
  });
}

export async function listAssessmentsByProperty(propertyId) {
  const db = await getDb();
  return all(
    db,
    "SELECT * FROM assessments WHERE property_id = ? ORDER BY created_at DESC;",
    [propertyId]
  ).map(mapAssessment);
}

export async function getAssessment(id) {
  const db = await getDb();
  return mapAssessment(get(db, "SELECT * FROM assessments WHERE id = ?;", [id]));
}

export async function saveAssessment(data) {
  const db = await getDb();
  const existing = get(db, "SELECT id, created_at FROM assessments WHERE id = ?;", [data.id]);
  const now = new Date().toISOString();
  const createdAt = existing?.created_at || data.created_at || now;
  const scoutMode = data.scout_mode === "full" ? "full" : "quick";
  const normalizedScores = {
    problem_score: Number.isFinite(Number(data.problem_score)) ? Number(data.problem_score) : 0,
    access_score: Number.isFinite(Number(data.access_score)) ? Number(data.access_score) : 0,
    leverage_score: Number.isFinite(Number(data.leverage_score)) ? Number(data.leverage_score) : 0,
    momentum_score: Number.isFinite(Number(data.momentum_score)) ? Number(data.momentum_score) : 0
  };
  const normalizedHazard = {
    hazard_severity: Number.isFinite(Number(data.hazard_severity)) ? Number(data.hazard_severity) : 0,
    hazard_prevalence: Number.isFinite(Number(data.hazard_prevalence))
      ? Number(data.hazard_prevalence)
      : 0,
    hazard_maintenance_gap: Number.isFinite(Number(data.hazard_maintenance_gap))
      ? Number(data.hazard_maintenance_gap)
      : 0,
    hazard_engagement_path: Number.isFinite(Number(data.hazard_engagement_path))
      ? Number(data.hazard_engagement_path)
      : 0
  };
  const totalScore =
    normalizedScores.problem_score +
    normalizedScores.access_score +
    normalizedScores.leverage_score +
    normalizedScores.momentum_score;
  const hazardTotal =
    normalizedHazard.hazard_severity +
    normalizedHazard.hazard_prevalence +
    normalizedHazard.hazard_maintenance_gap +
    normalizedHazard.hazard_engagement_path;
  const hazardPrimaryAngle =
    data.hazard_primary_angle ||
    computeHazardPrimaryAngle({ ...normalizedHazard, hazard_total: hazardTotal });
  if (existing) {
    run(
      db,
      `
      UPDATE assessments
      SET property_id = ?,
          scout_mode = ?,
          scout_type = ?,
          gut_feel_score = ?,
          on_site_office_visible = ?,
          leasing_activity_visible = ?,
          maintenance_presence_visible = ?,
          management_quality_signal = ?,
          exterior_condition = ?,
          access_ease = ?,
          building_height = ?,
          termination_type = ?,
          access_constraints = ?,
          access_difficulty = ?,
          service_fit = ?,
          entry_path = ?,
          partner_potential = ?,
          follow_up_priority = ?,
          problem_score = ?,
          access_score = ?,
          leverage_score = ?,
          momentum_score = ?,
          total_score = ?,
          hazard_severity = ?,
          hazard_prevalence = ?,
          hazard_maintenance_gap = ?,
          hazard_engagement_path = ?,
          hazard_total = ?,
          hazard_primary_angle = ?,
          confidence_level = ?,
          hook = ?,
          decision_maker_known = ?,
          decision_maker_contacted = ?,
          contact_name = ?,
          contact_role = ?,
          contact_phone = ?,
          contact_email = ?,
          contact_notes = ?,
          disqualified = ?,
          disqualifier_reasons = ?,
          next_action_owner = ?,
          next_action_type = ?,
          next_action_due = ?,
          next_action_notes = ?,
          opportunity_notes = ?,
          risk_or_barrier_notes = ?,
          general_notes = ?,
          pricing_v1 = ?,
          updated_at = ?
      WHERE id = ?;
      `,
      [
        data.property_id,
        scoutMode,
        data.scout_type,
        data.gut_feel_score ?? null,
        toDbBool(data.on_site_office_visible),
        toDbBool(data.leasing_activity_visible),
        toDbBool(data.maintenance_presence_visible),
        data.management_quality_signal || "",
        data.exterior_condition || "",
        data.access_difficulty || data.access_ease || "",
        data.building_height || "",
        data.termination_type || "",
        data.access_constraints || "",
        data.access_difficulty || "",
        data.service_fit || "",
        data.entry_path || "",
        data.partner_potential || "",
        data.follow_up_priority || "",
        normalizedScores.problem_score,
        normalizedScores.access_score,
        normalizedScores.leverage_score,
        normalizedScores.momentum_score,
        totalScore,
        normalizedHazard.hazard_severity,
        normalizedHazard.hazard_prevalence,
        normalizedHazard.hazard_maintenance_gap,
        normalizedHazard.hazard_engagement_path,
        hazardTotal,
        hazardPrimaryAngle,
        data.confidence_level || "",
        data.hook || "",
        toDbBool(data.decision_maker_known),
        toDbBool(data.decision_maker_contacted),
        data.contact_name || "",
        data.contact_role || "",
        data.contact_phone || "",
        data.contact_email || "",
        data.contact_notes || "",
        toDbBool(data.disqualified),
        serializeDisqualifierReasons(data.disqualifier_reasons),
        data.next_action_owner || "",
        data.next_action_type || "",
        data.next_action_due || "",
        data.next_action_notes || "",
        data.opportunity_notes || "",
        data.risk_or_barrier_notes || "",
        data.general_notes || "",
        serializePricingV1(data.pricing_v1),
        now,
        data.id
      ]
    );
  } else {
    const assessmentColumns = [
      "id",
      "property_id",
      "scout_mode",
      "scout_type",
      "gut_feel_score",
      "on_site_office_visible",
      "leasing_activity_visible",
      "maintenance_presence_visible",
      "management_quality_signal",
      "exterior_condition",
      "access_ease",
      "building_height",
      "termination_type",
      "access_constraints",
      "access_difficulty",
      "service_fit",
      "entry_path",
      "partner_potential",
      "follow_up_priority",
      "problem_score",
      "access_score",
      "leverage_score",
      "momentum_score",
      "total_score",
      "hazard_severity",
      "hazard_prevalence",
      "hazard_maintenance_gap",
      "hazard_engagement_path",
      "hazard_total",
      "hazard_primary_angle",
      "confidence_level",
      "hook",
      "decision_maker_known",
      "decision_maker_contacted",
      "contact_name",
      "contact_role",
      "contact_phone",
      "contact_email",
      "contact_notes",
      "disqualified",
      "disqualifier_reasons",
      "next_action_owner",
      "next_action_type",
      "next_action_due",
      "next_action_notes",
      "opportunity_notes",
      "risk_or_barrier_notes",
      "general_notes",
      "pricing_v1",
      "created_at",
      "updated_at"
    ];
    const assessmentValues = [
      data.id,
      data.property_id,
      scoutMode,
      data.scout_type,
      data.gut_feel_score ?? null,
      toDbBool(data.on_site_office_visible),
      toDbBool(data.leasing_activity_visible),
      toDbBool(data.maintenance_presence_visible),
      data.management_quality_signal || "",
      data.exterior_condition || "",
      data.access_difficulty || data.access_ease || "",
      data.building_height || "",
      data.termination_type || "",
      data.access_constraints || "",
      data.access_difficulty || "",
      data.service_fit || "",
      data.entry_path || "",
      data.partner_potential || "",
      data.follow_up_priority || "",
      normalizedScores.problem_score,
      normalizedScores.access_score,
      normalizedScores.leverage_score,
      normalizedScores.momentum_score,
      totalScore,
      normalizedHazard.hazard_severity,
      normalizedHazard.hazard_prevalence,
      normalizedHazard.hazard_maintenance_gap,
      normalizedHazard.hazard_engagement_path,
      hazardTotal,
      hazardPrimaryAngle,
      data.confidence_level || "",
      data.hook || "",
      toDbBool(data.decision_maker_known),
      toDbBool(data.decision_maker_contacted),
      data.contact_name || "",
      data.contact_role || "",
      data.contact_phone || "",
      data.contact_email || "",
      data.contact_notes || "",
      toDbBool(data.disqualified),
      serializeDisqualifierReasons(data.disqualifier_reasons),
      data.next_action_owner || "",
      data.next_action_type || "",
      data.next_action_due || "",
      data.next_action_notes || "",
      data.opportunity_notes || "",
      data.risk_or_barrier_notes || "",
      data.general_notes || "",
      serializePricingV1(data.pricing_v1),
      createdAt,
      now
    ];
    run(
      db,
      `
      INSERT INTO assessments (
        ${assessmentColumns.join(", ")}
      ) VALUES (${assessmentValues.map(() => "?").join(", ")});
      `,
      assessmentValues
    );
  }

  run(db, "UPDATE properties SET updated_at = ? WHERE id = ?;", [now, data.property_id]);
  queueUpsertSync(db, "assessments", data.id, now);
  await persistDb(db);
  const saved = {
    ...data,
    ...normalizedScores,
    ...normalizedHazard,
    total_score: totalScore,
    hazard_total: hazardTotal,
    hazard_primary_angle: hazardPrimaryAngle,
    pricing_v1: normalizePricingV1(data.pricing_v1),
    created_at: createdAt,
    updated_at: now
  };
  void processSyncQueue();
  return saved;
}

export async function listPhotosByAssessment(assessmentId) {
  const db = await getDb();
  return all(
    db,
    "SELECT * FROM photos WHERE assessment_id = ? ORDER BY timestamp ASC;",
    [assessmentId]
  );
}

export async function insertPhotos(photos) {
  if (!photos.length) return { failed: [], queued: 0 };
  const db = await getDb();
  const now = new Date().toISOString();
  const failed = new Map();
  const persisted = [];
  photos.forEach((photo) => {
    try {
      const storageUri = photo.storage_uri || "";
      const hasRemote = storageUri && !isLocalPhotoUri(storageUri);
      const uploadStatus = photo.upload_status || (hasRemote ? PHOTO_STATUS.uploaded : PHOTO_STATUS.queued);
      const uploadError = photo.upload_error || "";
      const uploadAttempts = Number.isFinite(photo.upload_attempts) ? photo.upload_attempts : 0;
      const uploadedAt = photo.uploaded_at || (hasRemote ? now : "");
      run(
        db,
        `
        INSERT OR REPLACE INTO photos (
          id, assessment_id, timestamp, tag, note,
          original_filename, stored_filename, storage_uri,
          upload_status, upload_error, upload_attempts, uploaded_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          photo.id,
          photo.assessment_id,
          photo.timestamp,
          photo.tag,
          photo.note || "",
          photo.original_filename || "",
          photo.stored_filename || "",
          storageUri,
          uploadStatus,
          uploadError,
          uploadAttempts,
          uploadedAt,
          now
        ]
      );
      persisted.push({
        ...photo,
        storage_uri: storageUri,
        upload_status: uploadStatus,
        upload_error: uploadError,
        upload_attempts: uploadAttempts,
        uploaded_at: uploadedAt,
        created_at: photo.created_at || now
      });
      queueUpsertSync(db, "photos", photo.id, now);
    } catch (error) {
      failed.set(photo.id, photo);
    }
  });
  await persistDb(db);
  if (persisted.length) {
    void processSyncQueue();
  }

  if (persisted.length) {
    const assessmentId = persisted[0]?.assessment_id;
    void processPhotoUploadQueue({ assessmentId });
  }

  return { failed: Array.from(failed.values()), queued: persisted.length };
}

export async function deletePhoto(id) {
  const db = await getDb();
  const existing = get(db, "SELECT * FROM photos WHERE id = ?;", [id]);
  run(db, "DELETE FROM photos WHERE id = ?;", [id]);
  await persistDb(db);
  void deleteSupabase("photos", id);
  if (isSupabaseReady() && existing) {
    const path = buildPhotoStoragePath(existing);
    const { error } = await supabase.storage.from(SUPABASE_PHOTO_BUCKET).remove([path]);
    if (error) {
      console.warn("Supabase photo delete failed", error);
    }
  }
}

export async function deleteAssessment(id) {
  const db = await getDb();
  const assessment = get(db, "SELECT * FROM assessments WHERE id = ?;", [id]);
  if (!assessment) {
    return { deleted: false, reason: "not_found" };
  }

  const photoRows = all(db, "SELECT * FROM photos WHERE assessment_id = ?;", [id]);
  photoRows.forEach((photo) => {
    run(db, "DELETE FROM photos WHERE id = ?;", [photo.id]);
    clearQueuedSync(db, "photos", photo.id);
  });
  run(db, "DELETE FROM assessments WHERE id = ?;", [id]);
  clearQueuedSync(db, "assessments", id);
  await persistDb(db);

  await Promise.all(
    photoRows.map((photo) =>
      removePhotoBlob(photo.id).catch((error) => {
        console.warn("Local photo blob delete failed", error);
      })
    )
  );

  photoRows.forEach((photo) => {
    void deleteSupabase("photos", photo.id);
  });
  void deleteSupabase("assessments", id);

  if (isSupabaseReady() && photoRows.length) {
    const paths = Array.from(new Set(photoRows.map((photo) => buildPhotoStoragePath(photo)).filter(Boolean)));
    if (paths.length) {
      const { error } = await supabase.storage.from(SUPABASE_PHOTO_BUCKET).remove(paths);
      if (error) {
        console.warn("Supabase assessment photo delete failed", error);
      }
    }
  }

  return {
    deleted: true,
    property_id: assessment.property_id,
    photo_count: photoRows.length
  };
}

export async function processPhotoUploadQueue(options = {}) {
  if (!isSupabaseReady()) {
    return { skipped: true, reason: "supabase" };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { skipped: true, reason: "offline" };
  }
  if (photoUploadPromise) {
    return photoUploadPromise;
  }

  const { assessmentId } = options;

  photoUploadPromise = (async () => {
    await processSyncQueue();
    const db = await getDb();
    const rows = assessmentId
      ? all(db, "SELECT * FROM photos WHERE assessment_id = ?;", [assessmentId])
      : all(db, "SELECT * FROM photos;");

    let uploaded = 0;
    let failed = 0;
    let queued = 0;
    let updated = false;

    for (const photo of rows) {
      const currentUri = photo.storage_uri || "";
      const hasRemote = currentUri && !isLocalPhotoUri(currentUri);

      if (hasRemote) {
        if (photo.upload_status !== PHOTO_STATUS.uploaded) {
          run(
            db,
            "UPDATE photos SET upload_status = ?, upload_error = '', uploaded_at = ? WHERE id = ?;",
            [PHOTO_STATUS.uploaded, photo.uploaded_at || photo.created_at || new Date().toISOString(), photo.id]
          );
          updated = true;
        }
        continue;
      }

      if (photo.upload_status === PHOTO_STATUS.uploading) {
        queued += 1;
        continue;
      }

      run(
        db,
        "UPDATE photos SET upload_status = ?, upload_error = '', upload_attempts = COALESCE(upload_attempts, 0) + 1 WHERE id = ?;",
        [PHOTO_STATUS.uploading, photo.id]
      );
      updated = true;

      const blob = await getPhotoBlob(photo.id);
      if (!blob) {
        run(
          db,
          "UPDATE photos SET upload_status = ?, upload_error = ? WHERE id = ?;",
          [PHOTO_STATUS.failed, "Missing local photo file.", photo.id]
        );
        updated = true;
        failed += 1;
        continue;
      }

      const path = buildPhotoStoragePath(photo);
      const { error } = await supabase.storage
        .from(SUPABASE_PHOTO_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });

      if (error && error.statusCode !== 409) {
        run(
          db,
          "UPDATE photos SET upload_status = ?, upload_error = ? WHERE id = ?;",
          [PHOTO_STATUS.failed, error.message || "Upload failed.", photo.id]
        );
        updated = true;
        failed += 1;
        continue;
      }

      const { data: publicData } = supabase.storage.from(SUPABASE_PHOTO_BUCKET).getPublicUrl(path);
      const publicUrl = publicData?.publicUrl || "";
      if (!publicUrl) {
        run(
          db,
          "UPDATE photos SET upload_status = ?, upload_error = ? WHERE id = ?;",
          [PHOTO_STATUS.failed, "Upload succeeded but URL missing.", photo.id]
        );
        updated = true;
        failed += 1;
        continue;
      }

      run(
        db,
        "UPDATE photos SET storage_uri = ?, upload_status = ?, upload_error = '', uploaded_at = ? WHERE id = ?;",
        [publicUrl, PHOTO_STATUS.uploaded, new Date().toISOString(), photo.id]
      );
      queueUpsertSync(db, "photos", photo.id);
      updated = true;
      uploaded += 1;
    }

    if (updated) {
      await persistDb(db);
      void processSyncQueue();
    }

    return { uploaded, failed, queued };
  })();

  try {
    return await photoUploadPromise;
  } finally {
    photoUploadPromise = null;
  }
}

export async function retryFailedPhotoUploads(assessmentId) {
  const db = await getDb();
  const rows = assessmentId
    ? all(
        db,
        "SELECT id FROM photos WHERE assessment_id = ? AND upload_status = ?;",
        [assessmentId, PHOTO_STATUS.failed]
      )
    : all(db, "SELECT id FROM photos WHERE upload_status = ?;", [PHOTO_STATUS.failed]);
  if (!rows.length) return { skipped: true, reason: "none" };
  rows.forEach((row) => {
    run(db, "UPDATE photos SET upload_status = ?, upload_error = '' WHERE id = ?;", [
      PHOTO_STATUS.queued,
      row.id
    ]);
  });
  await persistDb(db);
  return processPhotoUploadQueue({ assessmentId });
}

export async function exportSnapshot() {
  const db = await getDb();
  return {
    properties: all(db, "SELECT * FROM properties;"),
    assessments: all(db, "SELECT * FROM assessments;"),
    photos: all(db, "SELECT * FROM photos;")
  };
}

export async function importSnapshot(snapshot, options = {}) {
  const db = await getDb();
  const now = new Date().toISOString();
  const skipSupabase = options.skipSupabase === true;
  const properties = Array.isArray(snapshot?.properties) ? snapshot.properties : [];
  const assessments = Array.isArray(snapshot?.assessments) ? snapshot.assessments : [];
  const photos = Array.isArray(snapshot?.photos) ? snapshot.photos : [];
  const queuedSyncRows = all(
    db,
    "SELECT table_name, record_id FROM sync_queue WHERE action = ?;",
    [SYNC_ACTION.upsert]
  );
  const queuedSyncKeys = new Set(
    queuedSyncRows.map((row) => `${row.table_name}:${row.record_id}`)
  );
  const existingPhotoRows = all(
    db,
    "SELECT id, upload_status, upload_error, upload_attempts, uploaded_at FROM photos;"
  );
  const existingPhotoMap = new Map();
  existingPhotoRows.forEach((row) => existingPhotoMap.set(row.id, row));

  properties.forEach((row) => {
    if (queuedSyncKeys.has(`properties:${row.id}`)) return;
    const zoneInfo = resolveZoneForZip(row.zip);
    const derivedClass = derivePropertyClass(row);
    const classValue = derivedClass || row.property_class || row.class_guess || "";
    run(
      db,
      `
      INSERT OR REPLACE INTO properties (
        id, property_name, management_group, zone, coverage_type, in_ao, street_address, city, state, zip,
      class_guess, exterior_condition, maintenance_signals, overall_feel, property_class,
      units_est, source_url, seed_notes, lead_status, lead_contacted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.property_name,
      row.management_group || "",
        zoneInfo.zone,
        zoneInfo.coverage_type,
        toDbBool(zoneInfo.in_ao),
        row.street_address || "",
        row.city || "",
        row.state || "",
        row.zip || "",
        classValue,
        row.exterior_condition || "",
        row.maintenance_signals || "",
        row.overall_feel || "",
        classValue,
      row.units_est ?? null,
      row.source_url || "",
      row.seed_notes || "",
      row.lead_status || "",
      row.lead_contacted_at || "",
      row.created_at || now,
      row.updated_at || now
    ]
  );
  });

  assessments.forEach((row) => {
    if (queuedSyncKeys.has(`assessments:${row.id}`)) return;
    const scoutMode = row.scout_mode === "full" ? "full" : "quick";
    const assessmentValues = [
      row.id,
      row.property_id,
      scoutMode,
      row.scout_type || "",
      row.gut_feel_score ?? null,
      toDbBool(row.on_site_office_visible),
      toDbBool(row.leasing_activity_visible),
      toDbBool(row.maintenance_presence_visible),
      row.management_quality_signal || "",
      row.exterior_condition || "",
      row.access_difficulty || row.access_ease || "",
      row.building_height || "",
      row.termination_type || "",
      row.access_constraints || "",
      row.access_difficulty || "",
      row.service_fit || "",
      row.entry_path || "",
      row.partner_potential || "",
      row.follow_up_priority || "",
      row.problem_score ?? null,
      row.access_score ?? null,
      row.leverage_score ?? null,
      row.momentum_score ?? null,
      row.total_score ?? null,
      row.hazard_severity ?? null,
      row.hazard_prevalence ?? null,
      row.hazard_maintenance_gap ?? null,
      row.hazard_engagement_path ?? null,
      row.hazard_total ?? null,
      row.hazard_primary_angle || "",
      row.confidence_level || "",
      row.hook || "",
      toDbBool(row.decision_maker_known),
      toDbBool(row.decision_maker_contacted),
      row.contact_name || "",
      row.contact_role || "",
      row.contact_phone || "",
      row.contact_email || "",
      row.contact_notes || "",
      toDbBool(row.disqualified),
      serializeDisqualifierReasons(row.disqualifier_reasons),
      row.next_action_owner || "",
      row.next_action_type || "",
      row.next_action_due || "",
      row.next_action_notes || "",
      row.opportunity_notes || "",
      row.risk_or_barrier_notes || "",
      row.general_notes || "",
      serializePricingV1(row.pricing_v1),
      row.created_at || now,
      row.updated_at || now
    ];
    run(
      db,
      `
      INSERT OR REPLACE INTO assessments (
        id, property_id, scout_mode, scout_type, gut_feel_score,
        on_site_office_visible, leasing_activity_visible, maintenance_presence_visible,
        management_quality_signal, exterior_condition, access_ease,
        building_height, termination_type, access_constraints, access_difficulty,
        service_fit,
        entry_path, partner_potential, follow_up_priority,
        problem_score, access_score, leverage_score, momentum_score, total_score,
        hazard_severity, hazard_prevalence, hazard_maintenance_gap, hazard_engagement_path,
        hazard_total, hazard_primary_angle,
        confidence_level, hook, decision_maker_known, decision_maker_contacted, contact_name,
        contact_role, contact_phone, contact_email, contact_notes,
        disqualified, disqualifier_reasons, next_action_owner,
        next_action_type, next_action_due, next_action_notes,
        opportunity_notes, risk_or_barrier_notes, general_notes, pricing_v1,
        created_at, updated_at
      ) VALUES (${assessmentValues.map(() => "?").join(", ")});
      `,
      assessmentValues
    );
  });

  photos.forEach((row) => {
    if (queuedSyncKeys.has(`photos:${row.id}`)) return;
    const storageUri = row.storage_uri || "";
    const hasRemote = storageUri && !isLocalPhotoUri(storageUri);
    const existing = existingPhotoMap.get(row.id);
    const uploadStatus =
      row.upload_status ||
      existing?.upload_status ||
      (hasRemote ? PHOTO_STATUS.uploaded : "");
    const uploadError = row.upload_error || existing?.upload_error || "";
    const uploadAttempts = Number.isFinite(row.upload_attempts)
      ? row.upload_attempts
      : Number.isFinite(existing?.upload_attempts)
        ? existing.upload_attempts
        : 0;
    const uploadedAt =
      row.uploaded_at ||
      existing?.uploaded_at ||
      (hasRemote ? row.created_at || now : "");
    run(
      db,
      `
      INSERT OR REPLACE INTO photos (
        id, assessment_id, timestamp, tag, note,
        original_filename, stored_filename, storage_uri,
        upload_status, upload_error, upload_attempts, uploaded_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        row.id,
        row.assessment_id,
        row.timestamp || now,
        row.tag || "",
        row.note || "",
        row.original_filename || "",
        row.stored_filename || "",
        storageUri,
        uploadStatus,
        uploadError,
        uploadAttempts,
        uploadedAt,
        row.created_at || now
      ]
    );
  });

  await persistDb(db);
  if (!skipSupabase) {
    if (properties.length) {
      void upsertSupabase(
        "properties",
        properties.map((row) => mapPropertyToSupabase(row))
      );
    }
    if (assessments.length) {
      void upsertSupabase(
        "assessments",
        assessments.map((row) => mapAssessmentToSupabase(row))
      );
    }
    if (photos.length) {
      void upsertSupabase(
        "photos",
        photos.map((row) => mapPhotoToSupabase(row))
      );
    }
  }
  return {
    properties: properties.length,
    assessments: assessments.length,
    photos: photos.length
  };
}

export async function syncFromSupabase() {
  if (!isSupabaseReady()) {
    return { skipped: true };
  }
  const [propsResult, assessmentsResult, photosResult] = await Promise.all([
    supabase.from(SUPABASE_TABLES.properties).select("*"),
    supabase.from(SUPABASE_TABLES.assessments).select("*"),
    supabase.from(SUPABASE_TABLES.photos).select("*")
  ]);

  if (propsResult.error || assessmentsResult.error || photosResult.error) {
    console.warn("Supabase sync failed", {
      properties: propsResult.error,
      assessments: assessmentsResult.error,
      photos: photosResult.error
    });
    return {
      error: true,
      details: {
        properties: propsResult.error || null,
        assessments: assessmentsResult.error || null,
        photos: photosResult.error || null
      }
    };
  }

  const snapshot = {
    properties: propsResult.data || [],
    assessments: assessmentsResult.data || [],
    photos: photosResult.data || []
  };
  return importSnapshot(snapshot, { skipSupabase: true });
}

export async function polishNote({ text, context = "", field = "" } = {}) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return { polished: "" };
  }
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured.");
  }
  const { data, error } = await supabase.functions.invoke("polish-note", {
    body: {
      text: trimmed,
      context,
      field
    }
  });
  if (error) {
    console.warn("Polish note failed", error);
    throw error;
  }
  return data || { polished: "" };
}
