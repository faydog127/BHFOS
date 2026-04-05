var helpers = require("./helpers.js");
var CONFIG = require("./config.js");

var TEST_JWT = process.env.TEST_JWT;
var TENANT_ID = process.env.TEST_TENANT_ID || "tvg";

function authHeaders() {
  return { Authorization: "Bearer " + TEST_JWT };
}

function assertConfigured() {
  helpers.assert(TEST_JWT, "Missing TEST_JWT (JWT must include app_metadata.tenant_id).");
}

helpers.addTest("kanban: zombie lead transform hides lead + creates quote", async function () {
  assertConfigured();
  var nonce = Date.now();
  var leadInsert = await helpers.restInsert("leads", [{
    tenant_id: TENANT_ID,
    status: "qualified",
    first_name: "Test",
    last_name: "Lead " + nonce,
    email: "lead+" + nonce + "@example.com"
  }]);

  helpers.assertEquals(201, leadInsert.status, "Lead insert failed");
  var lead = leadInsert.json[0];

  var moveResp = await helpers.postEdge("kanban-move", {
    entity_type: "lead",
    entity_id: lead.id,
    to_column_key: "quote_draft"
  }, authHeaders());

  helpers.assertEquals(200, moveResp.status, "Lead->quote move failed");
  helpers.assertEquals("quote", moveResp.json.entity_type, "Expected quote entity after transform");

  var listResp = await helpers.postEdge("kanban-list", {}, authHeaders());
  helpers.assertEquals(200, listResp.status, "kanban-list failed");

  var items = listResp.json.items || [];
  var leadStillPresent = items.some(function (item) {
    return item.entity_type === "lead" && item.entity_id === lead.id;
  });
  var quotePresent = items.some(function (item) {
    return item.entity_type === "quote" && item.related && item.related.lead_id === lead.id;
  });

  helpers.assert(!leadStillPresent, "Lead should be removed from board after conversion");
  helpers.assert(quotePresent, "Quote should appear on board after conversion");
});

helpers.addTest("kanban: tenant mismatch rejected", async function () {
  assertConfigured();
  var resp = await helpers.postEdge("kanban-list", { tenant_id: "wrong-tenant" }, authHeaders());
  helpers.assertEquals(403, resp.status, "Expected tenant mismatch to be rejected");
});

helpers.addTest("kanban: lead->quote transform is idempotent", async function () {
  assertConfigured();
  var nonce = Date.now();
  var leadInsert = await helpers.restInsert("leads", [{
    tenant_id: TENANT_ID,
    status: "qualified",
    first_name: "Idem",
    last_name: "Lead " + nonce,
    email: "idem+" + nonce + "@example.com"
  }]);

  helpers.assertEquals(201, leadInsert.status, "Lead insert failed");
  var lead = leadInsert.json[0];

  var moveResp1 = await helpers.postEdge("kanban-move", {
    entity_type: "lead",
    entity_id: lead.id,
    to_column_key: "quote_draft"
  }, authHeaders());

  helpers.assertEquals(200, moveResp1.status, "First transform failed");

  var moveResp2 = await helpers.postEdge("kanban-move", {
    entity_type: "lead",
    entity_id: lead.id,
    to_column_key: "quote_draft"
  }, authHeaders());

  helpers.assertEquals(200, moveResp2.status, "Second transform failed");
  helpers.assertEquals(moveResp1.json.entity_id, moveResp2.json.entity_id, "Expected idempotent quote id");
});

helpers.addTest("kanban: quote send failure sets send_failed", async function () {
  assertConfigured();
  var nonce = Date.now();
  var leadInsert = await helpers.restInsert("leads", [{
    tenant_id: TENANT_ID,
    status: "qualified",
    first_name: "No",
    last_name: "Email " + nonce
  }]);

  helpers.assertEquals(201, leadInsert.status, "Lead insert failed");
  var lead = leadInsert.json[0];

  var quoteInsert = await helpers.restInsert("quotes", [{
    tenant_id: TENANT_ID,
    lead_id: lead.id,
    status: "draft",
    quote_number: Math.floor(100000 + Math.random() * 900000),
    public_token: "token-" + nonce,
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 0,
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  }]);

  helpers.assertEquals(201, quoteInsert.status, "Quote insert failed");
  var quote = quoteInsert.json[0];

  var moveResp = await helpers.postEdge("kanban-move", {
    entity_type: "quote",
    entity_id: quote.id,
    to_column_key: "quote_sent"
  }, authHeaders());

  helpers.assertEquals(422, moveResp.status, "Expected send failure to return 422");

  var statusResp = await helpers.restSelect("quotes?id=eq." + quote.id + "&select=status");
  helpers.assertEquals(200, statusResp.status, "Quote status fetch failed");
  helpers.assertEquals("quote_send_failed", statusResp.json[0].status, "Quote status should be quote_send_failed");
});

helpers.addTest("kanban: invalid move rejected (snap-back hook)", async function () {
  assertConfigured();
  var nonce = Date.now();
  var leadInsert = await helpers.restInsert("leads", [{
    tenant_id: TENANT_ID,
    status: "new",
    first_name: "Invalid",
    last_name: "Move " + nonce,
    email: "invalid+" + nonce + "@example.com"
  }]);

  helpers.assertEquals(201, leadInsert.status, "Lead insert failed");
  var lead = leadInsert.json[0];

  var moveResp = await helpers.postEdge("kanban-move", {
    entity_type: "lead",
    entity_id: lead.id,
    to_column_key: "quote_sent"
  }, authHeaders());

  helpers.assert(moveResp.status >= 400, "Expected invalid move to be rejected");
});

if (CONFIG.TEST_MODE !== "false") {
  helpers.runAllTests();
}
