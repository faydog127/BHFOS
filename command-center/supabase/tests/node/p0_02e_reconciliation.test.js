/**
 * P0-02.E — Reconciliation tools
 *
 * Must prove locally:
 * - Quarantined webhook transaction can be applied to a known invoice deterministically.
 * - Legacy invoice money state can be captured into ledger as an opening balance.
 */

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var helpers = require("./helpers.js");
var CONFIG = require("./config.js");

function joinUrl(base, suffix) {
  if (base.charAt(base.length - 1) === "/") return base + suffix;
  return base + "/" + suffix;
}

function assertOk2xx(status, message, json) {
  helpers.assert(status >= 200 && status < 300, message + " (status " + status + "): " + JSON.stringify(json));
}

async function restDeleteWhere(table, whereQuery) {
  var url = joinUrl(CONFIG.REST, table) + "?" + whereQuery;
  var headers = {
    apikey: CONFIG.SERVICE,
    Authorization: "Bearer " + CONFIG.SERVICE
  };
  var resp = await fetch(url, { method: "DELETE", headers: headers });
  return { status: resp.status };
}

async function restRpc(fnName, bodyObj) {
  var url = joinUrl(CONFIG.REST, "rpc/" + fnName);
  var headers = {
    "Content-Type": "application/json",
    apikey: CONFIG.SERVICE,
    Authorization: "Bearer " + CONFIG.SERVICE
  };
  var resp = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(bodyObj || {})
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

function readEnvFromFile(filePath, key) {
  try {
    var raw = fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
    var lines = raw.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = String(lines[i] || "").trim();
      if (!line || line.startsWith("#")) continue;
      var eq = line.indexOf("=");
      if (eq === -1) continue;
      var k = line.slice(0, eq).trim();
      if (k !== key) continue;
      return line.slice(eq + 1).trim();
    }
  } catch (e) {
    return null;
  }
  return null;
}

function stripeSignatureForPayload(payloadString, secret, timestampSeconds) {
  var signedPayload = String(timestampSeconds) + "." + payloadString;
  var sig = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return "t=" + String(timestampSeconds) + ",v1=" + sig;
}

function makeStripeEvent(params) {
  return {
    id: params.eventId,
    object: "event",
    api_version: "2024-06-20",
    created: params.created || Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    type: params.type,
    data: { object: params.object },
    request: { id: null, idempotency_key: null }
  };
}

async function postWebhookEvent(eventObj) {
  var payload = JSON.stringify(eventObj);
  var url = joinUrl(CONFIG.EDGE, "payment-webhook");

  var secret = readEnvFromFile(path.join("supabase", ".env"), "STRIPE_WEBHOOK_SECRET") || readEnvFromFile(".env", "STRIPE_WEBHOOK_SECRET") || "";
  helpers.assert(secret && secret.length > 0, "Missing STRIPE_WEBHOOK_SECRET");

  var t = Math.floor(Date.now() / 1000);
  var signature = stripeSignatureForPayload(payload, secret, t);
  var resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signature },
    body: payload
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

helpers.addTest("P0-02.E: capture legacy invoice opening balance into ledger", async function () {
  var tenantId = "tvg";
  var created = { jobId: null, invoiceId: null, txId: null };

  var jobIns = await helpers.restInsert("jobs", [{ tenant_id: tenantId, status: "unscheduled", total_amount: 20 }]);
  assertOk2xx(jobIns.status, "Failed to insert job", jobIns.json);
  created.jobId = jobIns.json[0].id;

  // Legacy invoice: amount_paid set but no ledger apps, and reconciliation_required flagged.
  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: created.jobId,
      status: "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: "P0-02E-L-" + crypto.randomUUID().slice(0, 8),
      total_amount: 20,
      amount_paid: 5,
      balance_due: 15,
      reconciliation_required: true,
      reconciliation_reason: "LEGACY_MONEY_STATE_WITHOUT_LEDGER",
      customer_email: "p0-02e-l@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice", invoiceIns.json);
  created.invoiceId = invoiceIns.json[0].id;

  var rpc = await restRpc("reconcile_capture_legacy_invoice_opening_balance", {
    p_invoice_id: created.invoiceId,
    p_actor_user_id: "00000000-0000-0000-0000-000000000001",
    p_note: "p0-02e-test"
  });
  assertOk2xx(rpc.status, "Legacy capture RPC failed", rpc.json);
  var parsed = typeof rpc.json === "string" ? JSON.parse(rpc.json) : rpc.json;
  helpers.assert(parsed.ok === true, "Expected ok=true");

  created.txId = parsed.transaction_id;

  var apps = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=applied_amount"
  );
  assertOk2xx(apps.status, "Failed to select apps", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected exactly 1 app for legacy capture");
  helpers.assertEquals(Number(apps.json[0].applied_amount), 5, "Expected applied_amount == 5");

  var inv = await helpers.restSelect(
    "invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=amount_paid,balance_due,reconciliation_required"
  );
  assertOk2xx(inv.status, "Failed to select invoice", inv.json);
  helpers.assertEquals(Number(inv.json[0].amount_paid), 5, "Expected invoice.amount_paid == 5 after capture");
  helpers.assertEquals(Number(inv.json[0].balance_due), 15, "Expected invoice.balance_due == 15 after capture");
  helpers.assert(inv.json[0].reconciliation_required === false, "Expected reconciliation_required cleared");

  console.log(
    "PROOF:p0_02e_legacy_capture",
    JSON.stringify({ invoice_id: created.invoiceId, transaction_id: created.txId, applied_amount: apps.json[0].applied_amount })
  );

  await restDeleteWhere("transaction_applications", "invoice_id=eq." + encodeURIComponent(created.invoiceId));
  if (created.txId) await restDeleteWhere("transactions", "id=eq." + encodeURIComponent(created.txId));
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.jobId));
});

helpers.addTest("P0-02.E: apply quarantined webhook transaction to invoice", async function () {
  var tenantId = "tvg";
  var created = { jobId: null, invoiceId: null, txId: null, eventId: null, providerPaymentId: null };

  // Create quarantined (unmapped) webhook transaction.
  created.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.eventId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var ev = makeStripeEvent({
    eventId: created.eventId,
    type: "payment_intent.succeeded",
    object: { id: created.providerPaymentId, object: "payment_intent", amount_received: 1200, currency: "usd", metadata: {} }
  });

  var wh = await postWebhookEvent(ev);
  assertOk2xx(wh.status, "Webhook quarantine setup failed", wh.json);
  helpers.assert(wh.json && wh.json.quarantined === true, "Expected quarantined=true setup");

  // Find transaction id by provider_reference.
  var tx = await helpers.restSelect(
    "transactions?provider_reference=eq." +
      encodeURIComponent(created.providerPaymentId) +
      "&source=eq.webhook&select=id,invoice_id,tenant_id,amount"
  );
  assertOk2xx(tx.status, "Failed to select tx", tx.json);
  helpers.assertEquals(tx.json.length, 1, "Expected 1 quarantined tx");
  created.txId = tx.json[0].id;
  helpers.assert(tx.json[0].invoice_id === null, "Expected tx.invoice_id null pre-reconcile");

  // Create target invoice to reconcile to.
  var jobIns = await helpers.restInsert("jobs", [{ tenant_id: tenantId, status: "unscheduled", total_amount: 12 }]);
  assertOk2xx(jobIns.status, "Failed to insert job", jobIns.json);
  created.jobId = jobIns.json[0].id;

  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: created.jobId,
      status: "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: "P0-02E-Q-" + crypto.randomUUID().slice(0, 8),
      total_amount: 12,
      amount_paid: 0,
      balance_due: 12,
      reconciliation_required: true,
      reconciliation_reason: "QUARANTINED_WEBHOOK",
      customer_email: "p0-02e-q@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice", invoiceIns.json);
  created.invoiceId = invoiceIns.json[0].id;

  var rpc = await restRpc("reconcile_apply_webhook_transaction_to_invoice", {
    p_transaction_id: created.txId,
    p_invoice_id: created.invoiceId,
    p_actor_user_id: "00000000-0000-0000-0000-000000000001",
    p_note: "p0-02e-test"
  });
  assertOk2xx(rpc.status, "Reconcile apply RPC failed", rpc.json);
  var parsed = typeof rpc.json === "string" ? JSON.parse(rpc.json) : rpc.json;
  helpers.assert(parsed.ok === true, "Expected ok=true");

  var apps = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=applied_amount"
  );
  assertOk2xx(apps.status, "Failed to select apps", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected 1 app after reconcile apply");
  helpers.assertEquals(Number(apps.json[0].applied_amount), 12, "Expected applied_amount == 12");

  var inv = await helpers.restSelect(
    "invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=amount_paid,balance_due,reconciliation_required,provider_payment_id"
  );
  assertOk2xx(inv.status, "Failed to select invoice", inv.json);
  helpers.assertEquals(Number(inv.json[0].amount_paid), 12, "Expected invoice.amount_paid == 12 after reconcile");
  helpers.assert(inv.json[0].reconciliation_required === false, "Expected reconciliation_required cleared");
  helpers.assertEquals(inv.json[0].provider_payment_id, created.providerPaymentId, "Expected invoice.provider_payment_id linked");

  var eventRow = await helpers.restSelect(
    "stripe_webhook_events?event_id=eq." + encodeURIComponent(created.eventId) + "&select=processed_status,reconciliation_required,invoice_id"
  );
  assertOk2xx(eventRow.status, "Failed to select webhook event row", eventRow.json);
  helpers.assertEquals(eventRow.json.length, 1, "Expected 1 webhook event row");
  helpers.assert(eventRow.json[0].reconciliation_required === false, "Expected webhook reconciliation_required cleared");
  helpers.assert(eventRow.json[0].invoice_id === created.invoiceId, "Expected webhook event invoice_id set");

  console.log(
    "PROOF:p0_02e_quarantine_apply",
    JSON.stringify({ transaction_id: created.txId, invoice_id: created.invoiceId, gateway_event_id: created.eventId })
  );

  await restDeleteWhere("transaction_applications", "invoice_id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("transactions", "id=eq." + encodeURIComponent(created.txId));
  await restDeleteWhere("stripe_webhook_events", "event_id=eq." + encodeURIComponent(created.eventId));
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.jobId));
});

module.exports = {};

