var helpers = require("./helpers.js");

async function createLeadId(payload) {
  var intake = await helpers.postEdge("lead-intake", payload);
  if (!intake.json || !intake.json.lead_id) {
    console.error("Failed to create lead for test:", intake);
    throw new Error("Lead creation failed in test setup");
  }
  return intake.json.lead_id;
}

helpers.addTest("STE-001 Homeowner booked → suggest CONFIRM-AIR-CHECK", async function () {
  var fx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
  var leadId = await createLeadId(fx);

  var resp = await helpers.postEdge("smartdocs-suggest", { lead_id: leadId, final_outcome: "booked" });
  helpers.assertEquals(resp.status, 200, "Expected 200");
  helpers.assert(resp.json && resp.json.ok === true, "ok:true expected");
  var sug = resp.json.suggestions || [];
  helpers.assert(sug.length >= 1, "Expected suggestions");
  helpers.assertEquals(sug[0].template_id, "CONFIRM-AIR-CHECK", "Expected CONFIRM-AIR-CHECK");
});

helpers.addTest("STE-002 PM qualified PQI≥60 → suggest DOC-PROPOSAL-B2B", async function () {
  // Create PM lead with higher PQI
  var fx = {
    lead: { persona: "property_manager", first_name: "Alex", email: "alex@pmco.com", phone: "+14075550000", city: "Port Orange", zip: "32127", message: "Need IAQ on 48 units" },
    meta: { page: "/pm/interest", utm_source: "outbound" }
  };
  var leadId = await createLeadId(fx);

  // Boost PQI directly for test simplicity
  await helpers.restInsert("rep_checklists", [{ lead_id: leadId, fit: "yes", dm_reachable: true, created_at: new Date().toISOString() }]);

  // Manually update lead to set stage and ensure PQI is high enough
  var restUrl = (process.env.SUPABASE_REST_URL || require('./config').REST);
  var serviceKey = (process.env.SUPABASE_SERVICE_KEY || require('./config').SERVICE);

  await fetch(restUrl + "/leads?id=eq." + leadId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "apikey": serviceKey, "Authorization": "Bearer " + serviceKey, "Prefer": "return=minimal" },
    body: JSON.stringify({ pqi: 70, pipeline_stage: "Qualified" })
  });

  var resp = await helpers.postEdge("smartdocs-suggest", { lead_id: leadId, final_outcome: "qualified" });
  helpers.assertEquals(resp.status, 200, "Expected 200 for suggest call");

  var sug = (resp.json && resp.json.suggestions) ? resp.json.suggestions : [];
  var hasProposal = false;
  for (var i = 0; i < sug.length; i++) { if (sug[i].template_id === "DOC-PROPOSAL-B2B") { hasProposal = true; break; } }
  helpers.assert(hasProposal, "Expected DOC-PROPOSAL-B2B suggestion");
});