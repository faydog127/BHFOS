import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    process.env[key] = value;
  }
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const bucket = process.env.VITE_SUPABASE_PHOTO_BUCKET || "tis-photos";

if (!url || !key) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const tableChecks = [
  {
    table: "tis_properties",
    columns: [
      "id",
      "property_name",
      "management_group",
      "zone",
      "coverage_type",
      "in_ao",
      "street_address",
      "city",
      "state",
      "zip",
      "class_guess",
      "exterior_condition",
      "maintenance_signals",
      "overall_feel",
      "property_class",
      "units_est",
      "source_url",
      "seed_notes",
      "lead_status",
      "lead_contacted_at",
      "created_at",
      "updated_at"
    ]
  },
  {
    table: "tis_assessments",
    columns: [
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
    ]
  },
  {
    table: "tis_photos",
    columns: [
      "id",
      "assessment_id",
      "timestamp",
      "tag",
      "note",
      "original_filename",
      "stored_filename",
      "storage_uri",
      "created_at"
    ]
  }
];

let failed = false;

for (const check of tableChecks) {
  const { data, error, count } = await supabase
    .from(check.table)
    .select(check.columns.join(","), { count: "exact" })
    .limit(1);

  if (error) {
    failed = true;
    console.error(`${check.table}: ERROR ${error.message}`);
    continue;
  }

  console.log(`${check.table}: OK count=${count ?? "unknown"} sampleRows=${Array.isArray(data) ? data.length : 0}`);
}

const { data: bucketData, error: bucketError } = await supabase.storage
  .from(bucket)
  .list("", { limit: 1 });

if (bucketError) {
  failed = true;
  console.error(`${bucket}: ERROR ${bucketError.message}`);
} else {
  console.log(`${bucket}: OK sampleEntries=${Array.isArray(bucketData) ? bucketData.length : 0}`);
}

if (failed) {
  process.exit(1);
}
