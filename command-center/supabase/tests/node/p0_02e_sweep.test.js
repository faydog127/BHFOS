/**
 * P0-02.E — Reconciliation sweep (convergence-grade)
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
  var headers = { apikey: CONFIG.SERVICE, Authorization: "Bearer " + CONFIG.SERVICE };
  var resp = await fetch(url, { method: "DELETE", headers: headers });
  return { status: resp.status };
}

async function restPatchWhere(table, whereQuery, patchObj) {
  var url = joinUrl(CONFIG.REST, table) + "?" + whereQuery;
  var headers = {
    "Content-Type": "application/json",
    apikey: CONFIG.SERVICE,
    Authorization: "Bearer " + CONFIG.SERVICE,
    Prefer: "return=representation"
  };
  var resp = await fetch(url, { method: "PATCH", headers: headers, body: JSON.stringify(patchObj || {}) });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

async function restRpc(fnName, bodyObj) {
  var url = joinUrl(CONFIG.REST, "rpc/" + fnName);
  var headers = { "Content-Type": "application/json", apikey: CONFIG.SERVICE, Authorization: "Bearer " + CONFIG.SERVICE };
  var resp = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(bodyObj || {}) });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
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

async function postWebhookBypass(eventObj) {
  // Local-only bypass is hard-gated inside the edge function (TEST_MODE + localhost).
  return await helpers.postEdge("payment-webhook", eventObj, { "x-test-webhook": "1" });
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

async function postWebhookSigned(eventObj) {
  var payload = JSON.stringify(eventObj);
  var url = joinUrl(CONFIG.EDGE, "payment-webhook");

  var secret =
    readEnvFromFile(path.join("supabase", ".env"), "STRIPE_WEBHOOK_SECRET") ||
    readEnvFromFile(".env", "STRIPE_WEBHOOK_SECRET") ||
    "";
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

async function setupInvoice(params) {
  var tenantId = params.tenantId || "tvg";
  var jobIns = await helpers.restInsert("jobs", [{ tenant_id: tenantId, status: "unscheduled", total_amount: params.totalAmount || 12 }]);
  assertOk2xx(jobIns.status, "Failed to insert job", jobIns.json);
  var jobId = jobIns.json[0].id;

  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: jobId,
      status: params.status || "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: params.invoiceNumber || "P0-02E-S-" + crypto.randomUUID().slice(0, 8),
      total_amount: params.totalAmount || 12,
      amount_paid: params.amountPaid || 0,
      balance_due: params.balanceDue != null ? params.balanceDue : (params.totalAmount || 12) - (params.amountPaid || 0),
      reconciliation_required: params.reconciliationRequired || false,
      reconciliation_reason: params.reconciliationReason || null,
      provider_payment_id: params.providerPaymentId || null,
      provider_payment_status: params.providerPaymentStatus || null,
      customer_email: "p0-02e-sweep@example.com",
      updated_at: params.updatedAt || new Date().toISOString(),
      created_at: params.createdAt || new Date().toISOString()
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice", invoiceIns.json);

  return { tenantId: tenantId, jobId: jobId, invoiceId: invoiceIns.json[0].id };
}

async function cleanupBase(tenantId, ids) {
  if (ids && ids.attemptId) await restDeleteWhere("public_payment_attempts", "id=eq." + encodeURIComponent(ids.attemptId));
  if (ids && ids.invoiceId) await restDeleteWhere("transaction_applications", "invoice_id=eq." + encodeURIComponent(ids.invoiceId));
  if (ids && ids.providerPaymentId) await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(ids.providerPaymentId));
  if (ids && ids.providerPaymentId) await restDeleteWhere("provider_payment_observations", "provider_payment_id=eq." + encodeURIComponent(ids.providerPaymentId));
  if (ids && ids.eventId) await restDeleteWhere("stripe_webhook_events", "event_id=eq." + encodeURIComponent(ids.eventId));
  if (ids && ids.invoiceId) await restDeleteWhere("reconciliation_alerts", "invoice_id=eq." + encodeURIComponent(ids.invoiceId));
  if (ids && ids.attemptId) await restDeleteWhere("events", "payload->>attempt_id=eq." + encodeURIComponent(String(ids.attemptId)));
  if (ids && ids.invoiceId) await restDeleteWhere("events", "entity_id=eq." + encodeURIComponent(ids.invoiceId));
  if (ids && ids.invoiceId) await restDeleteWhere("crm_tasks", "tenant_id=eq." + encodeURIComponent(tenantId) + "&source_type=eq.invoice&source_id=eq." + encodeURIComponent(ids.invoiceId));
  if (ids && ids.invoiceId) await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(ids.invoiceId));
  if (ids && ids.jobId) await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(ids.jobId));
}

helpers.addTest("P0-02.E sweep: dropped webhook recovery replays canonical finalization", async function () {
  var tenantId = "tvg";
  var ids = { jobId: null, invoiceId: null, attemptId: null, providerPaymentId: null };
  ids.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var now = Date.now();

  var inv = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 12,
    amountPaid: 0,
    balanceDue: 12,
    providerPaymentId: ids.providerPaymentId,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
  });
  ids.jobId = inv.jobId;
  ids.invoiceId = inv.invoiceId;

  var attemptIns = await helpers.restInsert("public_payment_attempts", [
    {
      tenant_id: tenantId,
      invoice_id: ids.invoiceId,
      public_token: crypto.randomUUID(),
      amount_cents: 1200,
      currency: "usd",
      idempotency_key: "idem_" + crypto.randomUUID().slice(0, 8),
      checkout_session_id: "cs_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      provider_payment_id: ids.providerPaymentId,
      attempt_status: "initiated",
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      last_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    }
  ]);
  assertOk2xx(attemptIns.status, "Failed to insert attempt", attemptIns.json);
  ids.attemptId = attemptIns.json[0].id;

  var obsIns = await helpers.restInsert("provider_payment_observations", [
    {
      provider: "stripe",
      provider_payment_id: ids.providerPaymentId,
      status: "succeeded",
      amount_cents: 1200,
      currency: "usd",
      observed_at: new Date(now - 90 * 60 * 1000).toISOString(),
      payload: { source: "test", invoice_id: ids.invoiceId }
    }
  ]);
  assertOk2xx(obsIns.status, "Failed to insert observation", obsIns.json);

  var sweep = await restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 50 });
  assertOk2xx(sweep.status, "Sweep RPC failed", sweep.json);
  helpers.assert(sweep.json && sweep.json.ok === true, "Expected sweep ok=true");
  helpers.assertEquals(Number(sweep.json.recovered), 1, "Expected recovered=1");

  var tx = await helpers.restSelect(
    "transactions?provider_reference=eq." + encodeURIComponent(ids.providerPaymentId) + "&source=eq.webhook&select=id,invoice_id"
  );
  assertOk2xx(tx.status, "Failed to select tx", tx.json);
  helpers.assertEquals(tx.json.length, 1, "Expected exactly 1 transaction");
  helpers.assertEquals(String(tx.json[0].invoice_id), ids.invoiceId, "Expected tx.invoice_id mapped");

  var apps = await helpers.restSelect("transaction_applications?invoice_id=eq." + encodeURIComponent(ids.invoiceId) + "&select=id,applied_amount");
  assertOk2xx(apps.status, "Failed to select apps", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected exactly 1 application");
  helpers.assertEquals(Number(apps.json[0].applied_amount), 12, "Expected applied_amount=12");

  var inv2 = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(ids.invoiceId) + "&select=amount_paid,balance_due");
  assertOk2xx(inv2.status, "Failed to select invoice", inv2.json);
  helpers.assertEquals(Number(inv2.json[0].amount_paid), 12, "Expected invoice.amount_paid=12");
  helpers.assertEquals(Number(inv2.json[0].balance_due), 0, "Expected invoice.balance_due=0");

  console.log("PROOF:p0_02e_sweep_recovery", JSON.stringify({ invoice_id: ids.invoiceId, provider_payment_id: ids.providerPaymentId }));
  await cleanupBase(tenantId, ids);
});

helpers.addTest("P0-02.E sweep: ghost intent cleanup (canceled) creates no financial effect", async function () {
  var tenantId = "tvg";
  var ids = { jobId: null, invoiceId: null, attemptId: null, providerPaymentId: null };
  ids.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var now = Date.now();

  var inv = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 20,
    amountPaid: 0,
    balanceDue: 20,
    providerPaymentId: ids.providerPaymentId,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
  });
  ids.jobId = inv.jobId;
  ids.invoiceId = inv.invoiceId;

  var attemptIns = await helpers.restInsert("public_payment_attempts", [
    {
      tenant_id: tenantId,
      invoice_id: ids.invoiceId,
      public_token: crypto.randomUUID(),
      amount_cents: 2000,
      currency: "usd",
      idempotency_key: "idem_" + crypto.randomUUID().slice(0, 8),
      checkout_session_id: "cs_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      provider_payment_id: ids.providerPaymentId,
      attempt_status: "initiated",
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      last_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    }
  ]);
  assertOk2xx(attemptIns.status, "Failed to insert attempt", attemptIns.json);
  ids.attemptId = attemptIns.json[0].id;

  var obsIns = await helpers.restInsert("provider_payment_observations", [
    {
      provider: "stripe",
      provider_payment_id: ids.providerPaymentId,
      status: "canceled",
      amount_cents: 2000,
      currency: "usd",
      observed_at: new Date(now - 90 * 60 * 1000).toISOString(),
      payload: { source: "test" }
    }
  ]);
  assertOk2xx(obsIns.status, "Failed to insert observation", obsIns.json);

  var sweep = await restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 50 });
  assertOk2xx(sweep.status, "Sweep RPC failed", sweep.json);
  helpers.assertEquals(Number(sweep.json.closed), 1, "Expected closed=1");

  var tx = await helpers.restSelect("transactions?provider_reference=eq." + encodeURIComponent(ids.providerPaymentId) + "&select=id");
  assertOk2xx(tx.status, "Failed to select tx", tx.json);
  helpers.assertEquals(tx.json.length, 0, "Expected no transactions created");

  var apps = await helpers.restSelect("transaction_applications?invoice_id=eq." + encodeURIComponent(ids.invoiceId) + "&select=id");
  assertOk2xx(apps.status, "Failed to select apps", apps.json);
  helpers.assertEquals(apps.json.length, 0, "Expected no applications created");

  var inv2 = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(ids.invoiceId) + "&select=amount_paid,balance_due");
  assertOk2xx(inv2.status, "Failed to select invoice", inv2.json);
  helpers.assertEquals(Number(inv2.json[0].amount_paid), 0, "Expected invoice.amount_paid unchanged");
  helpers.assertEquals(Number(inv2.json[0].balance_due), 20, "Expected invoice.balance_due unchanged");

  var alerts = await helpers.restSelect(
    "reconciliation_alerts?invoice_id=eq." + encodeURIComponent(ids.invoiceId) + "&anomaly_type=eq.GHOST_INTENT_CLEANUP&select=alert_key"
  );
  assertOk2xx(alerts.status, "Failed to select alerts", alerts.json);
  helpers.assertEquals(alerts.json.length, 1, "Expected 1 ghost-intent alert (latched)");

  console.log("PROOF:p0_02e_sweep_ghost_cleanup", JSON.stringify({ invoice_id: ids.invoiceId, provider_payment_id: ids.providerPaymentId }));
  await cleanupBase(tenantId, ids);
});

helpers.addTest("P0-02.E sweep: settlement drift is flagged (not fixed) and alert-latched", async function () {
  var tenantId = "tvg";
  var ids = { jobId: null, invoiceId: null, providerPaymentId: null };
  ids.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var now = Date.now();

  var inv = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 20,
    amountPaid: 0,
    balanceDue: 20,
    providerPaymentId: ids.providerPaymentId,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
  });
  ids.jobId = inv.jobId;
  ids.invoiceId = inv.invoiceId;

  var txIns = await helpers.restInsert("transactions", [
    {
      tenant_id: tenantId,
      invoice_id: ids.invoiceId,
      amount: 5,
      method: "stripe",
      status: "succeeded",
      source: "webhook",
      currency: "usd",
      provider_reference: ids.providerPaymentId,
      idempotency_key: "stripe:" + ids.providerPaymentId
    }
  ]);
  assertOk2xx(txIns.status, "Failed to insert tx", txIns.json);
  var txId = txIns.json[0].id;

  var appIns = await helpers.restInsert("transaction_applications", [
    {
      tenant_id: tenantId,
      transaction_id: txId,
      invoice_id: ids.invoiceId,
      applied_amount: 5,
      applied_at: new Date().toISOString()
    }
  ]);
  assertOk2xx(appIns.status, "Failed to insert app", appIns.json);

  var invCorrupt = await restPatchWhere(
    "invoices",
    "id=eq." + encodeURIComponent(ids.invoiceId),
    {
      amount_paid: 4,
      balance_due: 16,
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    }
  );
  assertOk2xx(invCorrupt.status, "Failed to corrupt invoice projection", invCorrupt.json);

  var sweep = await restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 50 });
  assertOk2xx(sweep.status, "Sweep RPC failed", sweep.json);

  var inv2 = await helpers.restSelect(
    "invoices?id=eq." + encodeURIComponent(ids.invoiceId) + "&select=reconciliation_required,reconciliation_reason,amount_paid,balance_due"
  );
  assertOk2xx(inv2.status, "Failed to select invoice", inv2.json);
  helpers.assert(inv2.json[0].reconciliation_required === true, "Expected invoice.reconciliation_required=true");
  helpers.assertEquals(inv2.json[0].reconciliation_reason, "SETTLEMENT_DRIFT", "Expected settlement drift reason");
  helpers.assertEquals(Number(inv2.json[0].amount_paid), 4, "Expected invoice.amount_paid NOT fixed by sweep");
  helpers.assertEquals(Number(inv2.json[0].balance_due), 16, "Expected invoice.balance_due NOT fixed by sweep");

  var alerts = await helpers.restSelect(
    "reconciliation_alerts?invoice_id=eq." + encodeURIComponent(ids.invoiceId) + "&anomaly_type=eq.SETTLEMENT_DRIFT&select=alert_key"
  );
  assertOk2xx(alerts.status, "Failed to select drift alerts", alerts.json);
  helpers.assertEquals(alerts.json.length, 1, "Expected 1 drift alert (latched)");

  console.log("PROOF:p0_02e_sweep_drift_flag", JSON.stringify({ invoice_id: ids.invoiceId, tx_id: txId }));
  await cleanupBase(tenantId, ids);
});

helpers.addTest("P0-02.E sweep: ambiguous association quarantine creates alert but no application", async function () {
  var ids = { providerPaymentId: null, eventId: null };
  ids.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  ids.eventId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var now = Date.now();

  var rpc = await restRpc("record_stripe_webhook_payment", {
    p_gateway_event_id: ids.eventId,
    p_event_type: "payment_intent.succeeded",
    p_provider_payment_id: ids.providerPaymentId,
    p_amount_cents: 1200,
    p_currency: "usd",
    p_payload: { source: "test_unmapped" },
    p_invoice_id: null
  });
  assertOk2xx(rpc.status, "Setup unmapped webhook via RPC failed", rpc.json);

  await restPatchWhere(
    "stripe_webhook_events",
    "event_id=eq." + encodeURIComponent(ids.eventId),
    { received_at: new Date(now - 2 * 60 * 60 * 1000).toISOString() }
  );

  var sweep = await restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 50 });
  assertOk2xx(sweep.status, "Sweep RPC failed", sweep.json);

  var alerts = await helpers.restSelect(
    "reconciliation_alerts?gateway_event_id=eq." + encodeURIComponent(ids.eventId) + "&anomaly_type=eq.WEBHOOK_QUARANTINED&select=alert_key"
  );
  assertOk2xx(alerts.status, "Failed to select quarantine alerts", alerts.json);
  helpers.assertEquals(alerts.json.length, 1, "Expected 1 quarantine alert (latched)");

  var tx = await helpers.restSelect(
    "transactions?provider_reference=eq." + encodeURIComponent(ids.providerPaymentId) + "&source=eq.webhook&select=id,invoice_id"
  );
  assertOk2xx(tx.status, "Failed to select tx", tx.json);
  helpers.assertEquals(tx.json.length, 1, "Expected 1 tx row");
  helpers.assert(tx.json[0].invoice_id === null, "Expected tx.invoice_id remains null (no wrong apply)");

  var apps = await helpers.restSelect("transaction_applications?select=id&transaction_id=eq." + encodeURIComponent(tx.json[0].id));
  assertOk2xx(apps.status, "Failed to select apps", apps.json);
  helpers.assertEquals(apps.json.length, 0, "Expected no applications created for unmapped payment");

  console.log("PROOF:p0_02e_sweep_ambiguous_quarantine", JSON.stringify({ gateway_event_id: ids.eventId, provider_payment_id: ids.providerPaymentId }));

  await restDeleteWhere("reconciliation_alerts", "gateway_event_id=eq." + encodeURIComponent(ids.eventId));
  await restDeleteWhere("stripe_webhook_events", "event_id=eq." + encodeURIComponent(ids.eventId));
  await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(ids.providerPaymentId));
});

helpers.addTest("P0-02.E sweep: legacy/corrupt invoice with valid external money is ingested + flagged", async function () {
  var tenantId = "tvg";
  var ids = { jobId: null, invoiceId: null, attemptId: null, providerPaymentId: null };
  ids.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var now = Date.now();

  var inv = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 20,
    amountPaid: 5,
    balanceDue: 15,
    providerPaymentId: ids.providerPaymentId,
    reconciliationRequired: true,
    reconciliationReason: "LEGACY_MONEY_STATE_WITHOUT_LEDGER",
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
  });
  ids.jobId = inv.jobId;
  ids.invoiceId = inv.invoiceId;

  var attemptIns = await helpers.restInsert("public_payment_attempts", [
    {
      tenant_id: tenantId,
      invoice_id: ids.invoiceId,
      public_token: crypto.randomUUID(),
      amount_cents: 1500,
      currency: "usd",
      idempotency_key: "idem_" + crypto.randomUUID().slice(0, 8),
      checkout_session_id: "cs_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      provider_payment_id: ids.providerPaymentId,
      attempt_status: "initiated",
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      last_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    }
  ]);
  assertOk2xx(attemptIns.status, "Failed to insert attempt", attemptIns.json);
  ids.attemptId = attemptIns.json[0].id;

  var obsIns = await helpers.restInsert("provider_payment_observations", [
    {
      provider: "stripe",
      provider_payment_id: ids.providerPaymentId,
      status: "succeeded",
      amount_cents: 1500,
      currency: "usd",
      observed_at: new Date(now - 90 * 60 * 1000).toISOString(),
      payload: { source: "test_legacy" }
    }
  ]);
  assertOk2xx(obsIns.status, "Failed to insert observation", obsIns.json);

  var sweep = await restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 50 });
  assertOk2xx(sweep.status, "Sweep RPC failed", sweep.json);
  helpers.assert(Number(sweep.json.flagged) >= 1, "Expected sweep flagged >= 1 (legacy quarantine)");

  var tx = await helpers.restSelect(
    "transactions?provider_reference=eq." + encodeURIComponent(ids.providerPaymentId) + "&source=eq.webhook&select=id,invoice_id"
  );
  assertOk2xx(tx.status, "Failed to select tx", tx.json);
  helpers.assertEquals(tx.json.length, 1, "Expected transaction ingested as external truth");

  var apps = await helpers.restSelect("transaction_applications?invoice_id=eq." + encodeURIComponent(ids.invoiceId) + "&select=id");
  assertOk2xx(apps.status, "Failed to select apps", apps.json);
  helpers.assertEquals(apps.json.length, 0, "Expected no application created (quarantined legacy state)");

  var inv2 = await helpers.restSelect(
    "invoices?id=eq." + encodeURIComponent(ids.invoiceId) + "&select=reconciliation_required,reconciliation_reason,amount_paid,balance_due"
  );
  assertOk2xx(inv2.status, "Failed to select invoice", inv2.json);
  helpers.assert(inv2.json[0].reconciliation_required === true, "Expected reconciliation_required remains true");
  helpers.assert(inv2.json[0].reconciliation_reason != null, "Expected reconciliation_reason set");
  helpers.assertEquals(Number(inv2.json[0].amount_paid), 5, "Expected invoice.amount_paid unchanged (no silent settlement)");
  helpers.assertEquals(Number(inv2.json[0].balance_due), 15, "Expected invoice.balance_due unchanged (no silent settlement)");

  console.log("PROOF:p0_02e_sweep_legacy_ingest_flag", JSON.stringify({ invoice_id: ids.invoiceId, provider_payment_id: ids.providerPaymentId }));
  await cleanupBase(tenantId, ids);
});

helpers.addTest("P0-02.E sweep: idempotent rerun produces no second financial effect", async function () {
  var tenantId = "tvg";
  var ids = { jobId: null, invoiceId: null, attemptId: null, providerPaymentId: null };
  ids.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var now = Date.now();

  var inv = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 12,
    amountPaid: 0,
    balanceDue: 12,
    providerPaymentId: ids.providerPaymentId,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
  });
  ids.jobId = inv.jobId;
  ids.invoiceId = inv.invoiceId;

  var attemptIns = await helpers.restInsert("public_payment_attempts", [
    {
      tenant_id: tenantId,
      invoice_id: ids.invoiceId,
      public_token: crypto.randomUUID(),
      amount_cents: 1200,
      currency: "usd",
      idempotency_key: "idem_" + crypto.randomUUID().slice(0, 8),
      checkout_session_id: "cs_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      provider_payment_id: ids.providerPaymentId,
      attempt_status: "initiated",
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      last_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    }
  ]);
  assertOk2xx(attemptIns.status, "Failed to insert attempt", attemptIns.json);
  ids.attemptId = attemptIns.json[0].id;

  var obsIns = await helpers.restInsert("provider_payment_observations", [
    {
      provider: "stripe",
      provider_payment_id: ids.providerPaymentId,
      status: "succeeded",
      amount_cents: 1200,
      currency: "usd",
      observed_at: new Date(now - 90 * 60 * 1000).toISOString(),
      payload: { source: "test" }
    }
  ]);
  assertOk2xx(obsIns.status, "Failed to insert observation", obsIns.json);

  var sweep1 = await restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 50 });
  assertOk2xx(sweep1.status, "Sweep1 RPC failed", sweep1.json);
  helpers.assertEquals(Number(sweep1.json.recovered), 1, "Expected recovered=1 on first sweep");

  var sweep2 = await restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 50 });
  assertOk2xx(sweep2.status, "Sweep2 RPC failed", sweep2.json);
  helpers.assertEquals(Number(sweep2.json.recovered), 0, "Expected recovered=0 on second sweep");

  var tx = await helpers.restSelect(
    "transactions?provider_reference=eq." + encodeURIComponent(ids.providerPaymentId) + "&source=eq.webhook&select=id"
  );
  assertOk2xx(tx.status, "Failed to select tx", tx.json);
  helpers.assertEquals(tx.json.length, 1, "Expected exactly 1 transaction after rerun");

  var apps = await helpers.restSelect("transaction_applications?invoice_id=eq." + encodeURIComponent(ids.invoiceId) + "&select=id");
  assertOk2xx(apps.status, "Failed to select apps", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected exactly 1 application after rerun");

  var evPay = await helpers.restSelect(
    "events?event_type=eq.PaymentSucceeded&entity_id=eq." + encodeURIComponent(ids.invoiceId) + "&select=id"
  );
  assertOk2xx(evPay.status, "Failed to select events", evPay.json);
  helpers.assertEquals(evPay.json.length, 1, "Expected exactly 1 PaymentSucceeded event");

  console.log("PROOF:p0_02e_sweep_idempotent", JSON.stringify({ invoice_id: ids.invoiceId, provider_payment_id: ids.providerPaymentId }));
  await cleanupBase(tenantId, ids);
});

helpers.addTest("P0-02.E sweep: late webhook vs sweep race converges to one financial effect", async function () {
  var tenantId = "tvg";
  var ids = { jobId: null, invoiceId: null, attemptId: null, providerPaymentId: null, eventId: null };
  ids.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  ids.eventId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var now = Date.now();

  var inv = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 12,
    amountPaid: 0,
    balanceDue: 12,
    providerPaymentId: ids.providerPaymentId,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
  });
  ids.jobId = inv.jobId;
  ids.invoiceId = inv.invoiceId;

  var attemptIns = await helpers.restInsert("public_payment_attempts", [
    {
      tenant_id: tenantId,
      invoice_id: ids.invoiceId,
      public_token: crypto.randomUUID(),
      amount_cents: 1200,
      currency: "usd",
      idempotency_key: "idem_" + crypto.randomUUID().slice(0, 8),
      checkout_session_id: "cs_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      provider_payment_id: ids.providerPaymentId,
      attempt_status: "initiated",
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      last_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    }
  ]);
  assertOk2xx(attemptIns.status, "Failed to insert attempt", attemptIns.json);
  ids.attemptId = attemptIns.json[0].id;

  var obsIns = await helpers.restInsert("provider_payment_observations", [
    {
      provider: "stripe",
      provider_payment_id: ids.providerPaymentId,
      status: "succeeded",
      amount_cents: 1200,
      currency: "usd",
      observed_at: new Date(now - 90 * 60 * 1000).toISOString(),
      payload: { source: "test_race" }
    }
  ]);
  assertOk2xx(obsIns.status, "Failed to insert observation", obsIns.json);

  var ev = makeStripeEvent({
    eventId: ids.eventId,
    type: "payment_intent.succeeded",
    object: {
      id: ids.providerPaymentId,
      object: "payment_intent",
      amount_received: 1200,
      currency: "usd",
      metadata: { invoice_id: ids.invoiceId }
    }
  });

  var results = await Promise.all([
    restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 50 }),
    postWebhookSigned(ev)
  ]);

  assertOk2xx(results[0].status, "Sweep RPC failed", results[0].json);
  helpers.assert(results[1].status >= 200 && results[1].status < 300, "Webhook bypass failed (status " + results[1].status + ")");

  var tx = await helpers.restSelect(
    "transactions?provider_reference=eq." + encodeURIComponent(ids.providerPaymentId) + "&source=eq.webhook&select=id"
  );
  assertOk2xx(tx.status, "Failed to select tx", tx.json);
  helpers.assertEquals(tx.json.length, 1, "Expected exactly 1 transaction after race");

  var apps = await helpers.restSelect("transaction_applications?invoice_id=eq." + encodeURIComponent(ids.invoiceId) + "&select=id");
  assertOk2xx(apps.status, "Failed to select apps", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected exactly 1 application after race");

  var inv2 = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(ids.invoiceId) + "&select=amount_paid,balance_due");
  assertOk2xx(inv2.status, "Failed to select invoice", inv2.json);
  helpers.assertEquals(Number(inv2.json[0].amount_paid), 12, "Expected amount_paid=12 after race convergence");
  helpers.assertEquals(Number(inv2.json[0].balance_due), 0, "Expected balance_due=0 after race convergence");

  console.log("PROOF:p0_02e_sweep_race_converged", JSON.stringify({ invoice_id: ids.invoiceId, provider_payment_id: ids.providerPaymentId }));
  await cleanupBase(tenantId, ids);
});

helpers.addTest("P0-02.E sweep: batch safety returns accurate counts and correct branches", async function () {
  var tenantId = "tvg";
  var now = Date.now();

  // A) succeeded orphan -> recovered
  var a = { providerPaymentId: "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24) };
  var invA = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 12,
    amountPaid: 0,
    balanceDue: 12,
    providerPaymentId: a.providerPaymentId,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
  });
  a.jobId = invA.jobId;
  a.invoiceId = invA.invoiceId;
  var aAttempt = await helpers.restInsert("public_payment_attempts", [
    {
      tenant_id: tenantId,
      invoice_id: a.invoiceId,
      public_token: crypto.randomUUID(),
      amount_cents: 1200,
      currency: "usd",
      idempotency_key: "idem_" + crypto.randomUUID().slice(0, 8),
      checkout_session_id: "cs_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      provider_payment_id: a.providerPaymentId,
      attempt_status: "initiated",
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      last_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    }
  ]);
  assertOk2xx(aAttempt.status, "Failed to insert attempt A", aAttempt.json);
  a.attemptId = aAttempt.json[0].id;
  await helpers.restInsert("provider_payment_observations", [
    {
      provider: "stripe",
      provider_payment_id: a.providerPaymentId,
      status: "succeeded",
      amount_cents: 1200,
      currency: "usd",
      observed_at: new Date(now - 90 * 60 * 1000).toISOString()
    }
  ]);

  // B) canceled orphan -> closed
  var b = { providerPaymentId: "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24) };
  var invB = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 20,
    amountPaid: 0,
    balanceDue: 20,
    providerPaymentId: b.providerPaymentId,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
  });
  b.jobId = invB.jobId;
  b.invoiceId = invB.invoiceId;
  var bAttempt = await helpers.restInsert("public_payment_attempts", [
    {
      tenant_id: tenantId,
      invoice_id: b.invoiceId,
      public_token: crypto.randomUUID(),
      amount_cents: 2000,
      currency: "usd",
      idempotency_key: "idem_" + crypto.randomUUID().slice(0, 8),
      checkout_session_id: "cs_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      provider_payment_id: b.providerPaymentId,
      attempt_status: "initiated",
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      last_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    }
  ]);
  assertOk2xx(bAttempt.status, "Failed to insert attempt B", bAttempt.json);
  b.attemptId = bAttempt.json[0].id;
  await helpers.restInsert("provider_payment_observations", [
    {
      provider: "stripe",
      provider_payment_id: b.providerPaymentId,
      status: "canceled",
      amount_cents: 2000,
      currency: "usd",
      observed_at: new Date(now - 90 * 60 * 1000).toISOString()
    }
  ]);

  // C) ambiguous mapping (quarantined webhook event) -> flagged
  var c = {
    providerPaymentId: "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
    eventId: "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24)
  };
  await restRpc("record_stripe_webhook_payment", {
    p_gateway_event_id: c.eventId,
    p_event_type: "payment_intent.succeeded",
    p_provider_payment_id: c.providerPaymentId,
    p_amount_cents: 1200,
    p_currency: "usd",
    p_payload: { source: "test_unmapped_batch" },
    p_invoice_id: null
  });
  await restPatchWhere(
    "stripe_webhook_events",
    "event_id=eq." + encodeURIComponent(c.eventId),
    { received_at: new Date(now - 2 * 60 * 60 * 1000).toISOString() }
  );

  // D) drifted invoice -> flagged
  var d = { providerPaymentId: "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24) };
  var invD = await setupInvoice({
    tenantId: tenantId,
    totalAmount: 20,
    amountPaid: 4,
    balanceDue: 16,
    providerPaymentId: d.providerPaymentId,
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString()
  });
  d.jobId = invD.jobId;
  d.invoiceId = invD.invoiceId;
  var txD = await helpers.restInsert("transactions", [
    {
      tenant_id: tenantId,
      invoice_id: d.invoiceId,
      amount: 5,
      method: "stripe",
      status: "succeeded",
      source: "webhook",
      currency: "usd",
      provider_reference: d.providerPaymentId,
      idempotency_key: "stripe:" + d.providerPaymentId
    }
  ]);
  assertOk2xx(txD.status, "Failed to insert txD", txD.json);
  await helpers.restInsert("transaction_applications", [
    { tenant_id: tenantId, transaction_id: txD.json[0].id, invoice_id: d.invoiceId, applied_amount: 5, applied_at: new Date().toISOString() }
  ]);

  var sweep = await restRpc("p0_02e_run_sweep", { p_min_age_minutes: 60, p_limit: 200 });
  assertOk2xx(sweep.status, "Sweep RPC failed", sweep.json);

  helpers.assertEquals(Number(sweep.json.processed_attempts), 2, "Expected processed_attempts=2 (A+B)");
  helpers.assertEquals(Number(sweep.json.recovered), 1, "Expected recovered=1 (A)");
  helpers.assertEquals(Number(sweep.json.closed), 1, "Expected closed=1 (B)");
  helpers.assert(Number(sweep.json.flagged) >= 2, "Expected flagged >= 2 (quarantine + drift)");

  console.log(
    "PROOF:p0_02e_sweep_batch",
    JSON.stringify({
      processed_attempts: sweep.json.processed_attempts,
      recovered: sweep.json.recovered,
      closed: sweep.json.closed,
      flagged: sweep.json.flagged
    })
  );

  await cleanupBase(tenantId, a);
  await cleanupBase(tenantId, b);
  await restDeleteWhere("reconciliation_alerts", "gateway_event_id=eq." + encodeURIComponent(c.eventId));
  await restDeleteWhere("stripe_webhook_events", "event_id=eq." + encodeURIComponent(c.eventId));
  await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(c.providerPaymentId));
  await cleanupBase(tenantId, d);
});
