import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { idbGet, idbSet } from "./idb";

const DB_KEY = "sqlite-db";

let dbPromise = null;

function initSchema(db) {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      property_name TEXT NOT NULL,
      management_group TEXT,
      zone TEXT,
      coverage_type TEXT,
      in_ao INTEGER,
      street_address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      class_guess TEXT,
      exterior_condition TEXT,
      maintenance_signals TEXT,
      overall_feel TEXT,
      property_class TEXT,
      units_est INTEGER,
      source_url TEXT,
      seed_notes TEXT,
      lead_status TEXT,
      lead_contacted_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      scout_mode TEXT,
      scout_type TEXT,
      gut_feel_score INTEGER,
      on_site_office_visible INTEGER,
      leasing_activity_visible INTEGER,
      maintenance_presence_visible INTEGER,
      management_quality_signal TEXT,
      exterior_condition TEXT,
      access_ease TEXT,
      building_height TEXT,
      termination_type TEXT,
      access_constraints TEXT,
      access_difficulty TEXT,
      service_fit TEXT,
      entry_path TEXT,
      partner_potential TEXT,
      follow_up_priority TEXT,
      problem_score INTEGER,
      -- commercial/sales-path score; not physical service access
      access_score INTEGER,
      leverage_score INTEGER,
      momentum_score INTEGER,
      total_score INTEGER,
      hazard_severity INTEGER,
      hazard_prevalence INTEGER,
      hazard_maintenance_gap INTEGER,
      hazard_engagement_path INTEGER,
      hazard_total INTEGER,
      hazard_primary_angle TEXT,
      confidence_level TEXT,
      hook TEXT,
      decision_maker_known INTEGER,
      decision_maker_contacted INTEGER,
      contact_name TEXT,
      contact_role TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      contact_notes TEXT,
      disqualified INTEGER,
      disqualifier_reasons TEXT,
      next_action_owner TEXT,
      next_action_type TEXT,
      next_action_due TEXT,
      next_action_notes TEXT,
      opportunity_notes TEXT,
      risk_or_barrier_notes TEXT,
      general_notes TEXT,
      pricing_v1 TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(property_id) REFERENCES properties(id)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      timestamp TEXT,
      tag TEXT,
      note TEXT,
      original_filename TEXT,
      stored_filename TEXT,
      storage_uri TEXT,
      upload_status TEXT,
      upload_error TEXT,
      upload_attempts INTEGER,
      uploaded_at TEXT,
      created_at TEXT,
      FOREIGN KEY(assessment_id) REFERENCES assessments(id)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      last_error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      queued_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(table_name, record_id, action)
    );
  `);
}

function ensureColumn(db, table, column, type) {
  const result = db.exec(`PRAGMA table_info(${table});`);
  if (!result.length) return;
  const names = result[0].values.map((row) => row[1]);
  if (!names.includes(column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
  }
}

function ensureColumns(db, table, columns) {
  columns.forEach(([column, type]) => ensureColumn(db, table, column, type));
}

async function loadDatabase() {
  const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl
  });
  const stored = await idbGet(DB_KEY);
  let db;
  if (stored) {
    const bytes = stored instanceof Uint8Array ? stored : new Uint8Array(stored);
    db = new SQL.Database(bytes);
  } else {
    db = new SQL.Database();
  }
  initSchema(db);
  ensureColumns(db, "properties", [
    ["management_group", "TEXT"],
    ["zone", "TEXT"],
    ["coverage_type", "TEXT"],
    ["in_ao", "INTEGER"],
    ["street_address", "TEXT"],
    ["city", "TEXT"],
    ["state", "TEXT"],
    ["zip", "TEXT"],
    ["class_guess", "TEXT"],
    ["exterior_condition", "TEXT"],
    ["maintenance_signals", "TEXT"],
    ["overall_feel", "TEXT"],
    ["property_class", "TEXT"],
    ["units_est", "INTEGER"],
    ["source_url", "TEXT"],
    ["seed_notes", "TEXT"],
    ["lead_status", "TEXT"],
    ["lead_contacted_at", "TEXT"],
    ["created_at", "TEXT"],
    ["updated_at", "TEXT"]
  ]);
  ensureColumns(db, "assessments", [
    ["scout_mode", "TEXT"],
    ["scout_type", "TEXT"],
    ["gut_feel_score", "INTEGER"],
    ["on_site_office_visible", "INTEGER"],
    ["leasing_activity_visible", "INTEGER"],
    ["maintenance_presence_visible", "INTEGER"],
    ["management_quality_signal", "TEXT"],
    ["exterior_condition", "TEXT"],
    ["access_ease", "TEXT"],
    ["building_height", "TEXT"],
    ["termination_type", "TEXT"],
    ["access_constraints", "TEXT"],
    ["access_difficulty", "TEXT"],
    ["service_fit", "TEXT"],
    ["entry_path", "TEXT"],
    ["partner_potential", "TEXT"],
    ["follow_up_priority", "TEXT"],
    ["problem_score", "INTEGER"],
    ["access_score", "INTEGER"],
    ["leverage_score", "INTEGER"],
    ["momentum_score", "INTEGER"],
    ["total_score", "INTEGER"],
    ["hazard_severity", "INTEGER"],
    ["hazard_prevalence", "INTEGER"],
    ["hazard_maintenance_gap", "INTEGER"],
    ["hazard_engagement_path", "INTEGER"],
    ["hazard_total", "INTEGER"],
    ["hazard_primary_angle", "TEXT"],
    ["confidence_level", "TEXT"],
    ["hook", "TEXT"],
    ["decision_maker_known", "INTEGER"],
    ["decision_maker_contacted", "INTEGER"],
    ["contact_name", "TEXT"],
    ["contact_role", "TEXT"],
    ["contact_phone", "TEXT"],
    ["contact_email", "TEXT"],
    ["contact_notes", "TEXT"],
    ["disqualified", "INTEGER"],
    ["disqualifier_reasons", "TEXT"],
    ["next_action_owner", "TEXT"],
    ["next_action_type", "TEXT"],
    ["next_action_due", "TEXT"],
    ["next_action_notes", "TEXT"],
    ["opportunity_notes", "TEXT"],
    ["risk_or_barrier_notes", "TEXT"],
    ["general_notes", "TEXT"],
    ["pricing_v1", "TEXT"],
    ["created_at", "TEXT"],
    ["updated_at", "TEXT"]
  ]);
  ensureColumns(db, "photos", [
    ["timestamp", "TEXT"],
    ["tag", "TEXT"],
    ["note", "TEXT"],
    ["original_filename", "TEXT"],
    ["stored_filename", "TEXT"],
    ["storage_uri", "TEXT"],
    ["upload_status", "TEXT"],
    ["upload_error", "TEXT"],
    ["upload_attempts", "INTEGER"],
    ["uploaded_at", "TEXT"],
    ["created_at", "TEXT"]
  ]);
  await persistDb(db);
  return db;
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = loadDatabase();
  }
  return dbPromise;
}

export async function persistDb(db) {
  const data = db.export();
  await idbSet(DB_KEY, data);
}

export function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function get(db, sql, params = []) {
  const rows = all(db, sql, params);
  return rows[0] || null;
}

export function run(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}
