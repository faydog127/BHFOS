var helpers = require("./helpers.js");

helpers.addTest("PIPE-001 List pipeline columns and leads", async function () {
  var edgeUrl = (process.env.SUPABASE_EDGE_URL || require('./config').EDGE);
  var resp = await fetch(edgeUrl + "/pipeline-list");
  var json = await resp.json();
  helpers.assertEquals(resp.status, 200, "Expected 200");
  helpers.assert(json.ok === true, "Expected ok:true");
  helpers.assert(Array.isArray(json.columns), "columns should be array");
});

helpers.addTest("PIPE-002 Move lead between stages", async function () {
  var fx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
  var intake = await helpers.postEdge("lead-intake", fx);
  var leadId = intake.json.lead_id;

  var edgeUrl = (process.env.SUPABASE_EDGE_URL || require('./config').EDGE);
  var move = await fetch(edgeUrl + "/pipeline-transition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: leadId, to_stage: "Qualified" })
  });
  var json = await move.json();
  helpers.assertEquals(move.status, 200, "Expected 200");
  helpers.assert(json.ok === true, "ok:true expected");
  helpers.assertEquals(json.new_stage, "Qualified", "Stage should be Qualified");
});