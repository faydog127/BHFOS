/**
 * P0-01 Tenant Isolation Lock — public endpoints must derive tenant from token-bound record.
 *
 * This is intentionally narrow:
 * - Proves wrong-tenant requests are rejected (403).
 * - Proves missing-tenant requests do not silently "default" to some tenant.
 */

var crypto = require("crypto");
var CONFIG = require("./config.js");
var helpers = require("./helpers.js");

function joinUrl(base, suffix) {
  if (base.charAt(base.length - 1) === "/") return base + suffix;
  return base + "/" + suffix;
}

async function restDelete(table, id) {
  var url = joinUrl(CONFIG.REST, table) + "?id=eq." + encodeURIComponent(id);
  var headers = {
    apikey: CONFIG.SERVICE,
    Authorization: "Bearer " + CONFIG.SERVICE
  };
  var resp = await fetch(url, { method: "DELETE", headers: headers });
  return { status: resp.status };
}

async function restUpsertGlobalConfig(tenantId, key, value) {
  var url = joinUrl(CONFIG.REST, "global_config") + "?select=*&on_conflict=key";
  var headers = {
    "Content-Type": "application/json",
    apikey: CONFIG.SERVICE,
    Authorization: "Bearer " + CONFIG.SERVICE,
    Prefer: "resolution=merge-duplicates,return=representation"
  };
  var resp = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify([{ tenant_id: tenantId, key: key, value: value }])
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

helpers.addTest("P0-01 setup: payments_mode present (non-stripe)", async function () {
  var upsert = await restUpsertGlobalConfig("tvg", "payments_mode", "mock");
  helpers.assert(
    upsert.status >= 200 && upsert.status < 300,
    "Failed to upsert global_config.payments_mode (status " + upsert.status + "): " + JSON.stringify(upsert.json)
  );
});

helpers.addTest("P0-01 public-quote: wrong tenant_id rejects (403)", async function () {
  var tenantA = "tenant_p0_01_a";
  var quoteInsert = await helpers.restInsert("quotes", [
    {
      tenant_id: tenantA,
      status: "sent",
      quote_number: "P0-01-Q-" + crypto.randomUUID().slice(0, 8),
      subtotal: 100,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 100,
      customer_email: "p0-01-quote@example.com"
    }
  ]);
  helpers.assert(quoteInsert.status >= 200 && quoteInsert.status < 300, "Failed to insert quote fixture");
  var quote = Array.isArray(quoteInsert.json) ? quoteInsert.json[0] : null;
  helpers.assert(quote && quote.public_token, "Quote fixture missing public_token");

  var ok = await helpers.postEdge("public-quote", { token: quote.public_token });
  helpers.assertEquals(ok.status, 200, "Expected public-quote to succeed without tenant_id");

  var okExplicitTenant = await helpers.postEdge("public-quote", { token: quote.public_token, tenant_id: tenantA });
  helpers.assertEquals(okExplicitTenant.status, 200, "Expected public-quote to succeed with correct tenant_id");

  var wrong = await helpers.postEdge("public-quote", { token: quote.public_token, tenant_id: "tenant_wrong" });
  helpers.assertEquals(wrong.status, 403, "Expected public-quote to reject wrong tenant_id");

  await restDelete("quotes", quote.id);
});

helpers.addTest("P0-01 public-invoice: wrong tenant_id rejects (403)", async function () {
  var tenantA = "tenant_p0_01_a";
  var jobInsert = await helpers.restInsert("jobs", [
    {
      tenant_id: tenantA,
      status: "unscheduled",
      total_amount: 100
    }
  ]);
  helpers.assert(jobInsert.status >= 200 && jobInsert.status < 300, "Failed to insert job fixture");
  var job = Array.isArray(jobInsert.json) ? jobInsert.json[0] : null;
  helpers.assert(job && job.id, "Job fixture missing id");

  var invoiceInsert = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantA,
      job_id: job.id,
      status: "draft",
      invoice_number: "P0-01-I-" + crypto.randomUUID().slice(0, 8),
      total_amount: 100,
      customer_email: "p0-01-invoice@example.com"
    }
  ]);
  helpers.assert(
    invoiceInsert.status >= 200 && invoiceInsert.status < 300,
    "Failed to insert invoice fixture (status " + invoiceInsert.status + "): " + JSON.stringify(invoiceInsert.json)
  );
  var invoice = Array.isArray(invoiceInsert.json) ? invoiceInsert.json[0] : null;
  helpers.assert(invoice && invoice.public_token, "Invoice fixture missing public_token");

  var ok = await helpers.postEdge("public-invoice", { token: invoice.public_token });
  helpers.assertEquals(ok.status, 200, "Expected public-invoice to succeed without tenant_id");

  var okExplicitTenant = await helpers.postEdge("public-invoice", { token: invoice.public_token, tenant_id: tenantA });
  helpers.assertEquals(okExplicitTenant.status, 200, "Expected public-invoice to succeed with correct tenant_id");

  var wrong = await helpers.postEdge("public-invoice", { token: invoice.public_token, tenant_id: "tenant_wrong" });
  helpers.assertEquals(wrong.status, 403, "Expected public-invoice to reject wrong tenant_id");

  await restDelete("invoices", invoice.id);
  await restDelete("jobs", job.id);
});

helpers.addTest("P0-01 public-pay: wrong tenant_id rejects (403)", async function () {
  var tenantA = "tenant_p0_01_a";
  var jobInsert = await helpers.restInsert("jobs", [
    {
      tenant_id: tenantA,
      status: "unscheduled",
      total_amount: 100
    }
  ]);
  helpers.assert(jobInsert.status >= 200 && jobInsert.status < 300, "Failed to insert job fixture");
  var job = Array.isArray(jobInsert.json) ? jobInsert.json[0] : null;
  helpers.assert(job && job.id, "Job fixture missing id");

  var invoiceInsert = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantA,
      job_id: job.id,
      status: "draft",
      invoice_number: "P0-01-P-" + crypto.randomUUID().slice(0, 8),
      total_amount: 100,
      customer_email: "p0-01-pay@example.com"
    }
  ]);
  helpers.assert(
    invoiceInsert.status >= 200 && invoiceInsert.status < 300,
    "Failed to insert invoice fixture (status " + invoiceInsert.status + "): " + JSON.stringify(invoiceInsert.json)
  );
  var invoice = Array.isArray(invoiceInsert.json) ? invoiceInsert.json[0] : null;
  helpers.assert(invoice && invoice.public_token, "Invoice fixture missing public_token");

  var wrong = await helpers.postEdge("public-pay", {
    token: invoice.public_token,
    tenant_id: "tenant_wrong",
    method: "card",
    amount: 1,
    run_id: "p0-01"
  });
  helpers.assertEquals(wrong.status, 403, "Expected public-pay to reject wrong tenant_id");

  var okExplicitTenant = await helpers.postEdge("public-pay", {
    token: invoice.public_token,
    tenant_id: tenantA,
    method: "card",
    amount: 1,
    run_id: "p0-01"
  });
  console.log("   (debug) public-pay correct-tenant status:", okExplicitTenant.status);
  helpers.assert(okExplicitTenant.status !== 403, "Expected public-pay to accept correct tenant_id");
  helpers.assert(okExplicitTenant.status !== 404, "Expected public-pay to not 404 for valid token");

  var missingTenant = await helpers.postEdge("public-pay", {
    token: invoice.public_token,
    method: "card",
    amount: 1,
    run_id: "p0-01"
  });
  console.log("   (debug) public-pay missing-tenant status:", missingTenant.status);
  helpers.assert(missingTenant.status !== 403, "Expected public-pay to not reject missing tenant_id");
  helpers.assert(missingTenant.status !== 404, "Expected public-pay to not 404 for valid token");

  await restDelete("invoices", invoice.id);
  await restDelete("jobs", job.id);
});

helpers.addTest("P0-01 public-quote-approve: wrong tenant_id rejects (403)", async function () {
  var tenantA = "tenant_p0_01_a";
  var quoteInsert = await helpers.restInsert("quotes", [
    {
      tenant_id: tenantA,
      status: "sent",
      quote_number: "P0-01-A-" + crypto.randomUUID().slice(0, 8),
      subtotal: 100,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 100,
      customer_email: "p0-01-approve@example.com"
    }
  ]);
  helpers.assert(quoteInsert.status >= 200 && quoteInsert.status < 300, "Failed to insert quote fixture");
  var quote = Array.isArray(quoteInsert.json) ? quoteInsert.json[0] : null;
  helpers.assert(quote && quote.public_token, "Quote fixture missing public_token");

  var wrong = await helpers.postEdge("public-quote-approve", {
    token: quote.public_token,
    tenant_id: "tenant_wrong",
    action: "approved",
    run_id: "p0-01"
  });
  helpers.assertEquals(wrong.status, 403, "Expected public-quote-approve to reject wrong tenant_id");

  await restDelete("quotes", quote.id);
});
