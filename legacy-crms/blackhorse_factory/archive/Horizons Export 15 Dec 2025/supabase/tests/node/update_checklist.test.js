var helpers = require("./helpers.js");

helpers.addTest("CHK-001 Checklist persists and updates PQI", async function () {
  var fx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
  var intake = await helpers.postEdge("lead-intake", fx);
  var leadId = intake.json.lead_id;

  var payload = {
    lead_id: leadId,
    why_now: "recent_issue",
    fit: "Yes",
    dm_reachable: true,
    momentum: "Referral",
    notes: "wants proposal",
  };

  // Supply any auth header your function expects; for now we pass a placeholder
  var resp = await helpers.postEdge("update-checklist", payload, { "Authorization": "Bearer service_role_key_placeholder" });
  helpers.assert( resp.status === 200, "Expected 200 OK" );
  helpers.assert( resp.json.ok === true, "Expected ok:true" );

  var lead = await helpers.restSelect("leads?id=eq." + leadId + "&select=pqi,last_touch_at");
  helpers.assert( lead.json[0].pqi > 0, "PQI not updated as expected" );
  
  var checklist = await helpers.restSelect("rep_checklists?lead_id=eq." + leadId);
  helpers.assert( checklist.json.length > 0, "Checklist was not created");
});