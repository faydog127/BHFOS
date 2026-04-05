/**
 * P0-02.D — public-pay initiation boundary
 *
 * Must prove:
 * 1) public-pay is not a second money authority (no transactions/applications created on initiation)
 * 2) repeated submits are safe (DB-backed idempotency; no duplicate provider objects)
 * 3) initiation + webhook converge on the same provider_payment_id (Stripe PaymentIntent id)
 * 4) amount validation is server-authoritative (tampered client amount rejected)
 * 5) tenant/public-route safety does not regress (token-derived tenant; mismatch rejected)
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

async function restUpsertGlobalConfig(key, value) {
  var url = joinUrl(CONFIG.REST, "global_config") + "?on_conflict=key&select=*";
  var headers = {
    "Content-Type": "application/json",
    apikey: CONFIG.SERVICE,
    Authorization: "Bearer " + CONFIG.SERVICE,
    Prefer: "return=representation,resolution=merge-duplicates"
  };
  var resp = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify([{ key: key, value: value }])
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

  var secretCandidates = [
    process.env.STRIPE_WEBHOOK_SECRET,
    readEnvFromFile(".env", "STRIPE_WEBHOOK_SECRET"),
    readEnvFromFile(path.join("supabase", ".env"), "STRIPE_WEBHOOK_SECRET")
  ].filter(function (v) {
    return typeof v === "string" && v.trim().length > 0;
  });

  helpers.assert(secretCandidates.length > 0, "Missing Stripe webhook secret in env/.env/supabase/.env");

  var last = null;
  for (var i = 0; i < secretCandidates.length; i++) {
    var secret = String(secretCandidates[i]).trim();
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
    last = { status: resp.status, json: json };
    if (!(resp.status === 400 && json && json.error === "Invalid signature")) {
      return last;
    }
  }
  return last;
}

helpers.addTest("P0-02.D: initiation-only + duplicate-safe + webhook convergence", async function () {
  var tenantId = "tvg";
  var token = crypto.randomUUID();
  var idempotencyKey = "p0-02d-" + crypto.randomUUID();

  // Ensure payments_mode routes into stripe initiation path.
  var mode = await restUpsertGlobalConfig("payments_mode", "stripe_checkout");
  assertOk2xx(mode.status, "Failed to upsert payments_mode", mode.json);
  var tm = await restUpsertGlobalConfig("test_mode", "true");
  assertOk2xx(tm.status, "Failed to upsert test_mode", tm.json);

  var created = { jobId: null, invoiceId: null };

  var jobIns = await helpers.restInsert("jobs", [{ tenant_id: tenantId, status: "unscheduled", total_amount: 100 }]);
  assertOk2xx(jobIns.status, "Failed to insert job fixture", jobIns.json);
  created.jobId = jobIns.json[0].id;

  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: created.jobId,
      status: "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: "P0-02D-" + crypto.randomUUID().slice(0, 8),
      total_amount: 100,
      amount_paid: 0,
      balance_due: 100,
      public_token: token,
      customer_email: "p0-02d@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  created.invoiceId = invoiceIns.json[0].id;

  // Tampered amount should be rejected.
  var badAmount = await helpers.postEdge(
    "public-pay",
    { token: token, amount: 1, method: "card", idempotency_key: idempotencyKey },
    { "x-test-pay": "1" }
  );
  helpers.assertEquals(badAmount.status, 400, "Expected amount mismatch to be rejected (400)");

  // Tenant mismatch should be rejected.
  var badTenant = await helpers.postEdge(
    "public-pay",
    { token: token, tenant_id: "wrong", amount: 100, method: "card", idempotency_key: idempotencyKey },
    { "x-test-pay": "1" }
  );
  helpers.assertEquals(badTenant.status, 403, "Expected tenant mismatch to be rejected (403)");

  // Initiation succeeds with token-derived tenant and authoritative amount.
  var r1 = await helpers.postEdge(
    "public-pay",
    { token: token, amount: 100, method: "card", idempotency_key: idempotencyKey },
    { "x-test-pay": "1" }
  );
  assertOk2xx(r1.status, "public-pay initiation failed", r1.json);
  helpers.assert(r1.json && r1.json.checkout_url, "Expected checkout_url");
  helpers.assert(r1.json && r1.json.provider_payment_id, "Expected provider_payment_id");
  helpers.assert(r1.json.payment_status === "pending_confirmation", "Expected pending_confirmation status");

  var providerPaymentId = r1.json.provider_payment_id;
  var checkoutUrl = r1.json.checkout_url;
  var sessionId = r1.json.session_id;

  // Duplicate-safe under replay + concurrency: same idempotency key should not create a second attempt/payment object.
  var r2 = await helpers.postEdge(
    "public-pay",
    { token: token, amount: 100, method: "card", idempotency_key: idempotencyKey },
    { "x-test-pay": "1" }
  );
  assertOk2xx(r2.status, "public-pay replay failed", r2.json);
  helpers.assert(r2.json.duplicate === true || r2.json.checkout_url === checkoutUrl, "Expected duplicate=true or identical checkout_url");
  helpers.assertEquals(r2.json.provider_payment_id, providerPaymentId, "provider_payment_id must be stable across replay");

  var conc = await Promise.all([
    helpers.postEdge(
      "public-pay",
      { token: token, amount: 100, method: "card", idempotency_key: idempotencyKey },
      { "x-test-pay": "1" }
    ),
    helpers.postEdge(
      "public-pay",
      { token: token, amount: 100, method: "card", idempotency_key: idempotencyKey },
      { "x-test-pay": "1" }
    )
  ]);
  for (var i = 0; i < conc.length; i++) {
    assertOk2xx(conc[i].status, "Concurrent initiation failed", conc[i].json);
    helpers.assertEquals(conc[i].json.provider_payment_id, providerPaymentId, "provider_payment_id stable under concurrency");
  }

  // Canonical initiation event should dedupe to one per checkout_session_id.
  // The REST API doesn't expose payload search helpers; filter by checkout_session_id client-side.
  var initiatedAll = await helpers.restSelect(
    "events?event_type=eq.PaymentInitiated&entity_type=eq.payment&entity_id=eq." +
      encodeURIComponent(created.invoiceId) +
      "&select=id,payload"
  );
  assertOk2xx(initiatedAll.status, "Failed to select PaymentInitiated events", initiatedAll.json);
  var filtered = initiatedAll.json.filter(function (row) {
    return row && row.payload && row.payload.checkout_session_id === sessionId;
  });
  helpers.assertEquals(filtered.length, 1, "Expected exactly 1 PaymentInitiated for checkout_session_id");

  // Proof: public-pay did NOT create money effects.
  var txRows = await helpers.restSelect("transactions?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,source");
  assertOk2xx(txRows.status, "Failed to select transactions", txRows.json);
  helpers.assertEquals(txRows.json.length, 0, "Expected no transactions created by public-pay initiation");

  var appRows = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=id"
  );
  assertOk2xx(appRows.status, "Failed to select transaction_applications", appRows.json);
  helpers.assertEquals(appRows.json.length, 0, "Expected no applications created by public-pay initiation");

  var attempts = await helpers.restSelect(
    "public_payment_attempts?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,provider_payment_id,checkout_url,idempotency_key"
  );
  assertOk2xx(attempts.status, "Failed to select public_payment_attempts", attempts.json);
  helpers.assertEquals(attempts.json.length, 1, "Expected exactly one public_payment_attempt for idempotency key");
  helpers.assertEquals(attempts.json[0].provider_payment_id, providerPaymentId, "Attempt must link provider_payment_id");

  var invBefore = await helpers.restSelect(
    "invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,status,amount_paid,balance_due,provider_payment_id,provider_payment_status"
  );
  assertOk2xx(invBefore.status, "Failed to select invoice before webhook", invBefore.json);
  helpers.assert(String(invBefore.json[0].status).toLowerCase() !== "paid", "Invoice must not be marked paid on initiation");
  helpers.assertEquals(Number(invBefore.json[0].amount_paid), 0, "Invoice amount_paid must remain 0 before webhook");
  helpers.assertEquals(invBefore.json[0].provider_payment_id, providerPaymentId, "Invoice provider_payment_id must be set for webhook convergence");

  // Webhook convergence: same provider_payment_id settles via canonical path.
  var evId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var ev = makeStripeEvent({
    eventId: evId,
    type: "payment_intent.succeeded",
    object: {
      id: providerPaymentId,
      object: "payment_intent",
      amount_received: 10000,
      currency: "usd",
      metadata: { invoice_id: created.invoiceId }
    }
  });

  var wh = await postWebhookEvent(ev);
  assertOk2xx(wh.status, "Webhook settle failed", wh.json);
  helpers.assert(wh.json && wh.json.ok === true, "Expected webhook ok=true");

  var txAfter = await helpers.restSelect(
    "transactions?provider_reference=eq." + encodeURIComponent(providerPaymentId) + "&source=eq.webhook&select=id,provider_reference,source,amount"
  );
  assertOk2xx(txAfter.status, "Failed to select webhook transactions", txAfter.json);
  helpers.assertEquals(txAfter.json.length, 1, "Expected exactly 1 webhook transaction after settlement");

  var appsAfter = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,applied_amount"
  );
  assertOk2xx(appsAfter.status, "Failed to select applications after webhook", appsAfter.json);
  helpers.assertEquals(appsAfter.json.length, 1, "Expected exactly 1 application after webhook settlement");
  helpers.assertEquals(Number(appsAfter.json[0].applied_amount), 100, "Expected applied_amount == 100.00 after settlement");

  var invAfter = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,amount_paid,balance_due");
  assertOk2xx(invAfter.status, "Failed to select invoice after webhook", invAfter.json);
  helpers.assertEquals(Number(invAfter.json[0].amount_paid), 100, "Expected invoice.amount_paid == 100.00 after webhook");

  console.log(
    "PROOF:p0_02d",
    JSON.stringify({
      tenant_id: tenantId,
      invoice_id: created.invoiceId,
      token: token,
      idempotency_key: idempotencyKey,
      checkout_url_present: Boolean(checkoutUrl),
      provider_payment_id: providerPaymentId,
      initiation_transactions_count: txRows.json.length,
      initiation_applications_count: appRows.json.length,
      attempts_count: attempts.json.length,
      webhook_transactions_count: txAfter.json.length,
      webhook_applications_count: appsAfter.json.length,
      invoice_amount_paid_after: invAfter.json[0].amount_paid
    })
  );

  // Cleanup (reverse order).
  await restDeleteWhere("transaction_applications", "invoice_id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(providerPaymentId));
  await restDeleteWhere("stripe_webhook_events", "event_id=eq." + encodeURIComponent(evId));
  await restDeleteWhere(
    "events",
    "entity_type=eq.payment&entity_id=eq." + encodeURIComponent(created.invoiceId) + "&event_type=eq.PaymentInitiated"
  );
  await restDeleteWhere("public_payment_attempts", "invoice_id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.jobId));
});
