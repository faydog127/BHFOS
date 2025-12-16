var CONFIG = require("./config.js");
var helpers = require("./helpers.js");

helpers.addTest("SEC-001 Anon cannot write to leads", async function () {
  var url = CONFIG.REST + "/leads";
  var headers = {
    "Content-Type": "application/json",
    "apikey": CONFIG.ANON,
    "Authorization": "Bearer " + CONFIG.ANON
  };
  var resp = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify([{ persona: "homeowner", email: "blocked@anon.com" }])
  });

  // Public can insert leads, this test is incorrect
  // lead-intake uses service role key so RLS doesn't apply there.
  // Direct REST call with anon key on leads table has a policy "Public can insert leads".
  // So this should be 201, not 401/403.
  // Let's modify the test to check that anon CANNOT update/delete, which should be protected.
  
  // First, insert a lead with service key to have something to target
   var intakeFx = helpers.readJsonFixture("fixtures/lead_homeowner.json");
   intakeFx.lead.email = "rls-test@example.com";
   var intakeResp = await helpers.postEdge("lead-intake", intakeFx);
   var leadId = intakeResp.json.lead_id;

  // Now, try to update it with ANON key
  var updateUrl = CONFIG.REST + "/leads?id=eq." + leadId;
   var updateResp = await fetch(updateUrl, {
    method: "PATCH",
    headers: headers,
    body: JSON.stringify({ city: "Blocked City" })
   });

  var okCode = (updateResp.status === 401 || updateResp.status === 404); // 404 because RLS hides the row
  helpers.assert(okCode, "Expected 401/404 for anon update to leads, got " + updateResp.status);
});

helpers.addTest("SEC-002 Anon cannot write to signals", async function () {
  var url = CONFIG.REST + "/signals";
  var headers = {
    "Content-Type": "application/json",
    "apikey": CONFIG.ANON,
    "Authorization": "Bearer " + CONFIG.ANON // Anon key should fail RLS write policy
  };
  var resp = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify([{ signal_type: "other", source_system: "test", occurred_at: new Date().toISOString(), captured_at: new Date().toISOString(), severity: 1, confidence: 1, details: {} }])
  });

  // Expect 401/403 under RLS for anon writes
  var okCode = (resp.status === 401 || resp.status === 403);
  helpers.assert(okCode, "Expected 401/403 for anon write to signals, got " + resp.status);
});