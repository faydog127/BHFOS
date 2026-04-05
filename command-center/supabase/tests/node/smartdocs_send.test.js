var helpers = require("./helpers.js");

async function createLeadId() {
  var fx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
  var resp = await helpers.postEdge("lead-intake", fx);
  return resp.json.lead_id;
}

helpers.addTest("SDOC-001 SmartDocs send (email+sms) logs delivery", async function () {
  var leadId = await createLeadId();
  var mergeData = helpers.readJsonFixture("fixtures/merge_confirm.json");

  var payload = {
    lead_id: leadId,
    template_id: "CONFIRM-AIR-CHECK",
    channels: ["email", "sms"],
    merge_data: mergeData,
    suggestion_source: "TEST",
    final_outcome: "booked"
  };

  var resp = await helpers.postEdge("smartdocs-send", payload);
  helpers.assert( resp.status === 200, "Expected 200 OK" );
  helpers.assert( resp.json.ok === true, "Expected ok:true" );
  helpers.assert( !!resp.json.send_id, "send_id missing" );

  var log = await helpers.restSelect("send_log?send_id=eq." + resp.json.send_id + "&select=template_id,channels_used,delivered_status");
  helpers.assert( log.json[0].template_id === "CONFIRM-AIR-CHECK", "Wrong template logged" );
  helpers.assert( log.json[0].delivered_status && (typeof log.json[0].delivered_status.email !== "undefined"), "Email status missing" );
  helpers.assert( log.json[0].delivered_status && (typeof log.json[0].delivered_status.sms !== "undefined"), "SMS status missing" );
});

helpers.addTest("SDOC-002 SmartDocs required fields enforced", async function () {
  var leadId = await createLeadId();
  var badPayload = {
    lead_id: leadId,
    template_id: "CONFIRM-AIR-CHECK",
    channels: ["email"],
    merge_data: { first_name: "Maya" }
  };
  var resp = await helpers.postEdge("smartdocs-send", badPayload);
  helpers.assert( resp.status === 400, "Expected 400 for missing required fields" );
  helpers.assert( String(resp.json.error).indexOf("Missing required merge field") >= 0, "Expected 'Missing required merge field' error" );
});