var helpers = require("./helpers.js");

helpers.addTest("INT-001 Lead Intake – creates lead + inbound signal", async function () {
  var fx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
  var resp = await helpers.postEdge("lead-intake", fx);
  helpers.assert( resp.status === 200, "Expected 200 OK" );
  helpers.assert( resp.json && resp.json.ok === true, "Expected ok:true" );
  var leadId = resp.json.lead_id;
  helpers.assert( !!leadId, "lead_id missing" );

  var leads = await helpers.restSelect("leads?id=eq." + leadId + "&select=id,persona,pqi");
  helpers.assert( leads.json && leads.json.length === 1, "Lead not found" );
  helpers.assert( leads.json[0].persona === "homeowner", "Persona mismatch" );

  var sigs = await helpers.restSelect("signals?lead_id=eq." + leadId + "&signal_type=eq.inbound&select=id");
  helpers.assert( sigs.json && sigs.json.length >= 1, "Inbound signal not logged" );
});

helpers.addTest("INT-002 Lead Intake – validation error without contact", async function () {
  var fx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
  fx.lead.email = "";
  fx.lead.phone = "";
  var resp = await helpers.postEdge("lead-intake", fx);
  helpers.assert( resp.status === 400, "Expected 400 for missing contact" );
  helpers.assert( resp.json && resp.json.ok === false, "Expected ok:false" );
});

helpers.addTest("INT-003 Lead Intake – seeds PQI > 0 when intent present", async function () {
  var fx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
  // Change the message to a high-value signal from the blueprint
  fx.lead.message = "Need IAQ assessment for 48 units due to mold odor and humidity."; 
  var resp = await helpers.postEdge("lead-intake", fx);
  var leadId = resp.json.lead_id;

  var lead = await helpers.restSelect("leads?id=eq." + leadId + "&select=pqi");
  // Assert PQI is above the threshold for "New Intel"
  helpers.assert( lead.json[0].pqi >= 10, "Expected PQI to be seeded significantly (>= 10)" ); 
});