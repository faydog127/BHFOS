var helpers = require("./helpers.js");

helpers.addTest("AUD-001 Suggest only returns audience-matching templates", async function () {
  // Create PM lead
  var fx = {
    lead: { persona: "property_manager", first_name: "Tia", email: "tia@pmco.com", phone: "+14075550123", city: "Cocoa", zip: "32922", message: "Need IAQ walk-through" },
    meta: { page: "/pm/interest" }
  };
  var intake = await helpers.postEdge("lead-intake", fx);
  var leadId = intake.json.lead_id;

  // Ask for suggestions (e.g. "qualified")
  var resp = await helpers.postEdge("smartdocs-suggest", { lead_id: leadId, final_outcome: "qualified" });
  helpers.assert(resp.status === 200, "Expected 200");
  var list = resp.json && resp.json.suggestions ? resp.json.suggestions : [];

  // Ensure none are homeowner-only templates
  for (var i = 0; i < list.length; i++) {
    var t = await helpers.restSelect("doc_templates?id=eq." + list[i].template_id + "&select=audience");
    var aud = t.json && t.json[0] ? t.json[0].audience : [];
    var isHomeownerOnly = Array.isArray(aud) && aud.length === 1 && aud[0] === "homeowner";
    helpers.assert(isHomeownerOnly === false, "Found homeowner-only template in PM suggestions");
  }
});

helpers.addTest("AUD-002 smartdocs-send blocks audience mismatch", async function () {
  // Create PM lead
  var fx = {
    lead: { persona: "property_manager", first_name: "Tia", email: "tia@pmco.com", phone: "+14075550123", city: "Cocoa", zip: "32922" },
    meta: { page: "/pm/interest" }
  };
  var intake = await helpers.postEdge("lead-intake", fx);
  var leadId = intake.json.lead_id;

  // Try to send a homeowner-only template on purpose
  var payload = {
    lead_id: leadId,
    template_id: "CONFIRM-AIR-CHECK", // assume homeowner-only in your seed
    channels: ["email"],
    merge_data: { first_name: "Tia", address: "100 Main", appt_date: "2025-11-15", appt_time: "10:00 AM", prep_tips_url: "https://tvg.co/prep", rep_name: "Erron" }
  };
  var resp = await helpers.postEdge("smartdocs-send", payload);
  helpers.assert(resp.status === 400, "Expected 400 for audience mismatch");
  helpers.assert(String(resp.json.error).indexOf("audience mismatch") >= 0, "Expected audience mismatch error");
});