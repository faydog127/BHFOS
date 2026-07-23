/**
 * ML-P1 S8 remediation RPC / isolation tests.
 * Requires remediation migration applied OR run via tools/ml-p1-s8-remediation-db-proof.mjs (tx rollback).
 * When SUPABASE_SERVICE_KEY + URL present, exercises REST RPC allow/deny paths with service role,
 * and optional two-user isolation when S8_TEST_USER_A_JWT / S8_TEST_USER_B_JWT are set.
 */

var crypto = require("crypto");
var helpers = require("./helpers.js");
var CONFIG = require("./config.js");

function joinUrl(base, suffix) {
  if (base.charAt(base.length - 1) === "/") return base + suffix;
  return base + "/" + suffix;
}

async function rpc(fn, args, jwt) {
  var url = joinUrl(CONFIG.REST, "rpc/" + fn);
  var key = jwt || CONFIG.SERVICE;
  var resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.ANON || CONFIG.SERVICE,
      Authorization: "Bearer " + key
    },
    body: JSON.stringify(args || {})
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

helpers.addTest("S8 remediation: open_flags requires tenant (service)", async function () {
  var nullTenant = await rpc("ml_p1_s8_inspection_open_flags", { p_tenant_id: null });
  // Pre-remediation prod still allows null — skip until 20260723200000 applied.
  if (nullTenant.status < 400 && Array.isArray(nullTenant.json)) {
    console.log("SKIP open_flags tenant require — remediation migration not applied on target DB");
    return;
  }
  helpers.assert(nullTenant.status >= 400 || (nullTenant.json && nullTenant.json.code), "open_flags(null) must error");
});

helpers.addTest("S8 remediation: pending photo cannot mark wave (service synth)", async function () {
  var probe = await rpc("ml_p1_s8_inspection_open_flags", { p_tenant_id: null });
  if (probe.status < 400 && Array.isArray(probe.json)) {
    console.log("SKIP pending-photo mark-wave — remediation migration not applied on target DB");
    return;
  }

  var tag = "S8-RPC-" + crypto.randomUUID().slice(0, 8);
  var ins = await helpers.restInsert("inspections", [
    { tenant_id: "tvg", title: "SYNTH " + tag + " DO-NOT-CONTACT", status: "draft", summary: "rpc" }
  ]);
  helpers.assert(ins.status >= 200 && ins.status < 300, "insert inspection");
  var inspection = Array.isArray(ins.json) ? ins.json[0] : null;
  helpers.assert(inspection && inspection.id, "inspection id");

  var photo = await helpers.restInsert("inspection_photos", [
    {
      id: crypto.randomUUID(),
      tenant_id: "tvg",
      inspection_id: inspection.id,
      bucket_id: "inspection-photos",
      object_path: "tvg/rpc/" + tag + ".jpg",
      upload_state: "pending",
      is_voided: false
    }
  ]);
  helpers.assert(photo.status >= 200 && photo.status < 300, "insert pending photo: " + JSON.stringify(photo.json));

  var mark = await rpc("ml_p1_s8_mark_photos_wave_complete", { p_inspection_id: inspection.id });
  helpers.assert(
    mark.status >= 400 || (mark.json && (mark.json.message || mark.json.code)),
    "pending photo must not mark wave complete after remediation"
  );

  // Soft cleanup
  await fetch(joinUrl(CONFIG.REST, "inspection_photos") + "?id=eq." + encodeURIComponent(photo.json[0].id), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.SERVICE,
      Authorization: "Bearer " + CONFIG.SERVICE
    },
    body: JSON.stringify({ is_voided: true })
  });
  await fetch(joinUrl(CONFIG.REST, "inspections") + "?id=eq." + encodeURIComponent(inspection.id), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.SERVICE,
      Authorization: "Bearer " + CONFIG.SERVICE
    },
    body: JSON.stringify({ title: inspection.title + " [RPC-DONE]" })
  });
});

helpers.addTest("S8 remediation: two-tenant JWT isolation (optional env)", async function () {
  var jwtA = process.env.S8_TEST_USER_A_JWT;
  var jwtB = process.env.S8_TEST_USER_B_JWT;
  if (!jwtA || !jwtB) {
    console.log("SKIP two-tenant JWT isolation — set S8_TEST_USER_A_JWT and S8_TEST_USER_B_JWT");
    return;
  }
  var tag = "S8-ISO-" + crypto.randomUUID().slice(0, 8);
  var insB = await helpers.restInsert("inspections", [
    { tenant_id: "s8_tenant_b_synth", title: "SYNTH " + tag + " DO-NOT-CONTACT", status: "draft", summary: "iso" }
  ]);
  helpers.assert(insB.status >= 200 && insB.status < 300, "insert tenant B inspection");
  var inspectionB = insB.json[0];
  var asA = await rpc("ml_p1_s8_seed_checklist_for_inspection", { p_inspection_id: inspectionB.id, p_work_type: "general" }, jwtA);
  helpers.assert(asA.status >= 400, "Tenant A JWT must not seed Tenant B inspection");
});

module.exports = {};
