var helpers = require("./helpers.js");

helpers.addTest("SIG-001 Permit signal increases PQI", async function () {
  var fx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
  var intake = await helpers.postEdge("lead-intake", fx);
  var leadId = intake.json.lead_id;

  var before = await helpers.restSelect("leads?id=eq." + leadId + "&select=pqi");
  var pqiBefore = before.json[0].pqi || 0;

  var nowIso = new Date().toISOString();
  var randomRef = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  var ins = await helpers.restInsert("signals", [{
    lead_id: leadId,
    signal_type: "permit_pulled",
    source_system: "city_permits",
    external_ref: randomRef,
    occurred_at: nowIso,
    captured_at: nowIso,
    severity: 16,
    confidence: 95,
    details: {}
  }]);
  helpers.assert( ins.status >= 200 && ins.status < 300, "Failed to insert signal via REST" );

  // Wait a moment for trigger to fire and propagate
  await new Promise(resolve => setTimeout(resolve, 500));

  var after = await helpers.restSelect("leads?id=eq." + leadId + "&select=pqi");
  var pqiAfter = after.json[0].pqi || 0;

  helpers.assert( pqiAfter > pqiBefore, "PQI should increase after strong permit signal" );
});