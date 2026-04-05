/**
 * P0-02.C — Payment webhook rebuild
 *
 * Proof requirements:
 * - Dual idempotency:
 *   - network/event replay: same gateway_event_id does not create duplicate financial effect
 *   - financial duplication: different event_ids referencing the same provider_payment_id do not create duplicate transaction/application
 * - Concurrency safety:
 *   - concurrent distinct successful payments to same invoice settle correctly (no last-writer-wins)
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

function readRepoEnvValue(key) {
  return readEnvFromFile(".env", key);
}

function stripeSignatureForPayload(payloadString, secret, timestampSeconds) {
  var signedPayload = String(timestampSeconds) + "." + payloadString;
  var sig = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return "t=" + String(timestampSeconds) + ",v1=" + sig;
}

function makeStripeEvent(params) {
  // Minimal Stripe event shape sufficient for webhook verification + parsing.
  return {
    id: params.eventId,
    object: "event",
    api_version: "2024-06-20",
    created: params.created || Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    type: params.type,
    data: {
      object: params.object
    },
    request: { id: null, idempotency_key: null }
  };
}

async function postWebhookEvent(eventObj) {
  var payload = JSON.stringify(eventObj);
  var url = joinUrl(CONFIG.EDGE, "payment-webhook");

  // In local setups, the webhook secret may be sourced from either repo root `.env`
  // or `supabase/.env` depending on how the edge runtime is configured.
  var secretCandidates = [
    process.env.STRIPE_WEBHOOK_SECRET,
    readRepoEnvValue("STRIPE_WEBHOOK_SECRET"),
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
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature
      },
      body: payload
    });
    var json;
    try {
      json = await resp.json();
    } catch (e) {
      json = { parseError: String(e) };
    }
    last = { status: resp.status, json: json };

    // Accept first non-signature failure response.
    if (!(resp.status === 400 && json && json.error === "Invalid signature")) {
      return last;
    }
  }

  return last;
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

function centsToMajor(amountCents) {
  return amountCents / 100;
}

helpers.addTest("P0-02.C: event replay (same gateway_event_id) is duplicate-safe", async function () {
  var tenantId = "tvg";
  var created = { jobId: null, invoiceId: null, providerPaymentId: null, eventId: null };

  // Fixtures: job + invoice.
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
      invoice_number: "P0-02C-E-" + crypto.randomUUID().slice(0, 8),
      total_amount: 100,
      amount_paid: 0,
      balance_due: 100,
      customer_email: "p0-02c-e@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  created.invoiceId = invoiceIns.json[0].id;

  created.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.eventId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var amountCents = 5000;

  var piObj = {
    id: created.providerPaymentId,
    object: "payment_intent",
    amount_received: amountCents,
    currency: "usd",
    metadata: { invoice_id: created.invoiceId }
  };

  var ev1 = makeStripeEvent({ eventId: created.eventId, type: "payment_intent.succeeded", object: piObj });
  var r1 = await postWebhookEvent(ev1);
  assertOk2xx(r1.status, "Webhook first delivery failed", r1.json);
  helpers.assert(r1.json && r1.json.ok === true, "Expected ok=true on first delivery");
  helpers.assert(r1.json.financial_effect_created === true, "Expected financial_effect_created=true on first delivery");

  var r2 = await postWebhookEvent(ev1);
  assertOk2xx(r2.status, "Webhook replay delivery failed", r2.json);
  helpers.assert(r2.json && r2.json.ok === true, "Expected ok=true on replay delivery");
  helpers.assert(r2.json.financial_effect_created === false, "Expected financial_effect_created=false on replay");

  // Proof: only one event receipt, one transaction, one application, invoice settles to amount.
  var evRows = await helpers.restSelect("stripe_webhook_events?event_id=eq." + encodeURIComponent(created.eventId) + "&select=event_id");
  assertOk2xx(evRows.status, "Failed to select stripe_webhook_events", evRows.json);
  helpers.assertEquals(evRows.json.length, 1, "Expected exactly 1 stripe_webhook_events row for event_id");

  var txRows = await helpers.restSelect(
    "transactions?provider_reference=eq." +
      encodeURIComponent(created.providerPaymentId) +
      "&source=eq.webhook&select=id,provider_reference,source,amount"
  );
  assertOk2xx(txRows.status, "Failed to select transactions", txRows.json);
  helpers.assertEquals(txRows.json.length, 1, "Expected exactly 1 webhook transaction for provider_payment_id");

  var apps = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,applied_amount"
  );
  assertOk2xx(apps.status, "Failed to select transaction_applications", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected exactly 1 transaction_application after replay");
  helpers.assertEquals(Number(apps.json[0].applied_amount), centsToMajor(amountCents), "Applied amount mismatch");

  var inv = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,amount_paid,balance_due");
  assertOk2xx(inv.status, "Failed to select invoice projection", inv.json);
  helpers.assertEquals(Number(inv.json[0].amount_paid), centsToMajor(amountCents), "Invoice amount_paid mismatch after webhook");

  // Event emission dedupe proof: replay must not emit duplicate canonical events.
  var evPayment = await helpers.restSelect(
    "events?entity_type=eq.payment&entity_id=eq." +
      encodeURIComponent(created.invoiceId) +
      "&event_type=eq.PaymentSucceeded&select=id"
  );
  assertOk2xx(evPayment.status, "Failed to select PaymentSucceeded events", evPayment.json);
  helpers.assert(evPayment.json.length <= 1, "Expected <= 1 PaymentSucceeded event after replay");

  var evInvoicePaid = await helpers.restSelect(
    "events?entity_type=eq.invoice&entity_id=eq." +
      encodeURIComponent(created.invoiceId) +
      "&event_type=eq.InvoicePaid&select=id"
  );
  assertOk2xx(evInvoicePaid.status, "Failed to select InvoicePaid events", evInvoicePaid.json);
  helpers.assert(evInvoicePaid.json.length <= 1, "Expected <= 1 InvoicePaid event after replay");

  console.log(
    "PROOF:event_replay",
    JSON.stringify({
      tenant_id: tenantId,
      job_id: created.jobId,
      invoice_id: created.invoiceId,
      gateway_event_id: created.eventId,
      provider_payment_id: created.providerPaymentId,
      stripe_webhook_events_count: evRows.json.length,
      transactions_count: txRows.json.length,
      applications_count: apps.json.length,
      invoice_amount_paid: inv.json[0].amount_paid
    })
  );

  // Cleanup
  await restDeleteWhere("transaction_applications", "invoice_id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(created.providerPaymentId));
  await restDeleteWhere("stripe_webhook_events", "event_id=eq." + encodeURIComponent(created.eventId));
  await restDeleteWhere(
    "events",
    "entity_type=in.(payment,invoice)&entity_id=eq." + encodeURIComponent(created.invoiceId) + "&event_type=in.(PaymentSucceeded,InvoicePaid)"
  );
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.jobId));
});

helpers.addTest("P0-02.C: financial idempotency (different event_ids -> same payment_intent) is duplicate-safe", async function () {
  var tenantId = "tvg";
  var created = { jobId: null, invoiceId: null, paymentIntentId: null, eventIdA: null, eventIdB: null };

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
      invoice_number: "P0-02C-F-" + crypto.randomUUID().slice(0, 8),
      total_amount: 100,
      amount_paid: 0,
      balance_due: 100,
      customer_email: "p0-02c-f@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  created.invoiceId = invoiceIns.json[0].id;

  created.paymentIntentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.eventIdA = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.eventIdB = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var amountCents = 2500;

  // Event A: charge.succeeded referencing payment_intent (canonical provider_payment_id becomes payment_intent).
  var chargeObj = {
    id: "ch_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
    object: "charge",
    amount: amountCents,
    currency: "usd",
    payment_intent: created.paymentIntentId,
    metadata: { invoice_id: created.invoiceId }
  };
  var evA = makeStripeEvent({ eventId: created.eventIdA, type: "charge.succeeded", object: chargeObj });
  var rA = await postWebhookEvent(evA);
  assertOk2xx(rA.status, "Webhook charge.succeeded failed", rA.json);
  helpers.assert(rA.json.financial_effect_created === true, "Expected effect on first event");

  // Event B: payment_intent.succeeded for same intent id (should be financially duplicate).
  var piObj = {
    id: created.paymentIntentId,
    object: "payment_intent",
    amount_received: amountCents,
    currency: "usd",
    metadata: { invoice_id: created.invoiceId }
  };
  var evB = makeStripeEvent({ eventId: created.eventIdB, type: "payment_intent.succeeded", object: piObj });
  var rB = await postWebhookEvent(evB);
  assertOk2xx(rB.status, "Webhook payment_intent.succeeded failed", rB.json);
  helpers.assert(rB.json.financial_effect_created === false, "Expected no second financial effect for same provider_payment_id");

  var txRows = await helpers.restSelect(
    "transactions?provider_reference=eq." +
      encodeURIComponent(created.paymentIntentId) +
      "&source=eq.webhook&select=id,provider_reference,source"
  );
  assertOk2xx(txRows.status, "Failed to select webhook transactions", txRows.json);
  helpers.assertEquals(txRows.json.length, 1, "Expected exactly 1 transaction for provider_payment_id across two events");

  var apps = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,applied_amount"
  );
  assertOk2xx(apps.status, "Failed to select transaction_applications", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected exactly 1 application for provider_payment_id across two events");

  var inv = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,amount_paid");
  assertOk2xx(inv.status, "Failed to select invoice projection", inv.json);
  helpers.assertEquals(Number(inv.json[0].amount_paid), centsToMajor(amountCents), "Invoice amount_paid mismatch across two events");

  console.log(
    "PROOF:financial_idempotency",
    JSON.stringify({
      tenant_id: tenantId,
      job_id: created.jobId,
      invoice_id: created.invoiceId,
      gateway_event_ids: [created.eventIdA, created.eventIdB],
      provider_payment_id: created.paymentIntentId,
      transactions_count: txRows.json.length,
      applications_count: apps.json.length,
      invoice_amount_paid: inv.json[0].amount_paid
    })
  );

  // Cleanup
  await restDeleteWhere("transaction_applications", "invoice_id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(created.paymentIntentId));
  await restDeleteWhere("stripe_webhook_events", "event_id=in.(" + created.eventIdA + "," + created.eventIdB + ")");
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.jobId));
});

helpers.addTest("P0-02.C: concurrency safety (two concurrent payments) settles correctly", async function () {
  var tenantId = "tvg";
  var created = { jobId: null, invoiceId: null, pi1: null, pi2: null, e1: null, e2: null };

  var jobIns = await helpers.restInsert("jobs", [{ tenant_id: tenantId, status: "unscheduled", total_amount: 200 }]);
  assertOk2xx(jobIns.status, "Failed to insert job fixture", jobIns.json);
  created.jobId = jobIns.json[0].id;

  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: created.jobId,
      status: "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: "P0-02C-C-" + crypto.randomUUID().slice(0, 8),
      total_amount: 200,
      amount_paid: 0,
      balance_due: 200,
      customer_email: "p0-02c-c@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  created.invoiceId = invoiceIns.json[0].id;

  created.pi1 = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.pi2 = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.e1 = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.e2 = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

  var ev1 = makeStripeEvent({
    eventId: created.e1,
    type: "payment_intent.succeeded",
    object: {
      id: created.pi1,
      object: "payment_intent",
      amount_received: 10000,
      currency: "usd",
      metadata: { invoice_id: created.invoiceId }
    }
  });

  var ev2 = makeStripeEvent({
    eventId: created.e2,
    type: "payment_intent.succeeded",
    object: {
      id: created.pi2,
      object: "payment_intent",
      amount_received: 5000,
      currency: "usd",
      metadata: { invoice_id: created.invoiceId }
    }
  });

  var results = await Promise.all([postWebhookEvent(ev1), postWebhookEvent(ev2)]);
  for (var i = 0; i < results.length; i++) {
    assertOk2xx(results[i].status, "Concurrent webhook call failed", results[i].json);
    helpers.assert(results[i].json && results[i].json.ok === true, "Expected ok=true from concurrent webhook call");
  }

  var apps = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=applied_amount"
  );
  assertOk2xx(apps.status, "Failed to select applications for concurrency proof", apps.json);
  helpers.assertEquals(apps.json.length, 2, "Expected exactly 2 applications after concurrent payments");
  var sum = 0;
  for (var j = 0; j < apps.json.length; j++) sum += Number(apps.json[j].applied_amount);
  helpers.assertEquals(sum, 150, "Expected applied_amount sum == 150.00 after concurrent payments");

  var inv = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,amount_paid,balance_due");
  assertOk2xx(inv.status, "Failed to select invoice projection after concurrency", inv.json);
  helpers.assertEquals(Number(inv.json[0].amount_paid), 150, "Expected invoice.amount_paid == 150.00 after concurrent payments");

  console.log(
    "PROOF:concurrency",
    JSON.stringify({
      tenant_id: tenantId,
      job_id: created.jobId,
      invoice_id: created.invoiceId,
      provider_payment_ids: [created.pi1, created.pi2],
      gateway_event_ids: [created.e1, created.e2],
      applications_count: apps.json.length,
      applications_sum: sum,
      invoice_amount_paid: inv.json[0].amount_paid,
      invoice_balance_due: inv.json[0].balance_due
    })
  );

  // Cleanup
  await restDeleteWhere("transaction_applications", "invoice_id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("transactions", "provider_reference=in.(" + created.pi1 + "," + created.pi2 + ")");
  await restDeleteWhere("stripe_webhook_events", "event_id=in.(" + created.e1 + "," + created.e2 + ")");
  await restDeleteWhere(
    "events",
    "entity_type=in.(payment,invoice)&entity_id=eq." + encodeURIComponent(created.invoiceId) + "&event_type=in.(PaymentSucceeded,InvoicePaid)"
  );
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.jobId));
});

helpers.addTest("P0-02.C: out-of-order non-final event after success is non-financial", async function () {
  var tenantId = "tvg";
  var created = { jobId: null, invoiceId: null, providerPaymentId: null, successEventId: null, failEventId: null };

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
      invoice_number: "P0-02C-O-" + crypto.randomUUID().slice(0, 8),
      total_amount: 100,
      amount_paid: 0,
      balance_due: 100,
      customer_email: "p0-02c-o@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  created.invoiceId = invoiceIns.json[0].id;

  created.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.successEventId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.failEventId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

  var successEv = makeStripeEvent({
    eventId: created.successEventId,
    type: "payment_intent.succeeded",
    object: {
      id: created.providerPaymentId,
      object: "payment_intent",
      amount_received: 5000,
      currency: "usd",
      metadata: { invoice_id: created.invoiceId }
    }
  });

  var r1 = await postWebhookEvent(successEv);
  assertOk2xx(r1.status, "Webhook success failed", r1.json);

  var inv1 = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,amount_paid");
  assertOk2xx(inv1.status, "Failed to select invoice after success", inv1.json);
  helpers.assertEquals(Number(inv1.json[0].amount_paid), 50, "Expected invoice amount_paid=50 after success");

  // Out-of-order: older non-final failure event after success should not change money.
  var failEv = makeStripeEvent({
    eventId: created.failEventId,
    type: "payment_intent.payment_failed",
    object: {
      id: created.providerPaymentId,
      object: "payment_intent",
      amount_received: 5000,
      currency: "usd",
      metadata: { invoice_id: created.invoiceId }
    }
  });

  var r2 = await postWebhookEvent(failEv);
  assertOk2xx(r2.status, "Webhook non-final event failed", r2.json);

  var inv2 = await helpers.restSelect("invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,amount_paid");
  assertOk2xx(inv2.status, "Failed to select invoice after non-final", inv2.json);
  helpers.assertEquals(Number(inv2.json[0].amount_paid), 50, "Expected amount_paid unchanged after non-final");

  var apps = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=id"
  );
  assertOk2xx(apps.status, "Failed to select applications", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected no new applications on non-final event");

  await restDeleteWhere("transaction_applications", "invoice_id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(created.providerPaymentId));
  await restDeleteWhere("stripe_webhook_events", "event_id=in.(" + created.successEventId + "," + created.failEventId + ")");
  await restDeleteWhere(
    "events",
    "entity_type=in.(payment,invoice)&entity_id=eq." + encodeURIComponent(created.invoiceId) + "&event_type=in.(PaymentSucceeded,InvoicePaid)"
  );
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.jobId));
});

helpers.addTest("P0-02.C: ambiguous association quarantines (tx only, no app)", async function () {
  var providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  var eventId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

  var ev = makeStripeEvent({
    eventId: eventId,
    type: "payment_intent.succeeded",
    object: {
      id: providerPaymentId,
      object: "payment_intent",
      amount_received: 1200,
      currency: "usd",
      metadata: {}
    }
  });

  var r = await postWebhookEvent(ev);
  assertOk2xx(r.status, "Webhook ambiguous association failed", r.json);
  helpers.assert(r.json && r.json.quarantined === true, "Expected quarantined=true for unmapped payment");
  helpers.assert(r.json && r.json.reconciliation_required === true, "Expected reconciliation_required=true for unmapped payment");

  var tx = await helpers.restSelect(
    "transactions?provider_reference=eq." + encodeURIComponent(providerPaymentId) + "&source=eq.webhook&select=id,invoice_id"
  );
  assertOk2xx(tx.status, "Failed to select quarantined transaction", tx.json);
  helpers.assertEquals(tx.json.length, 1, "Expected exactly 1 quarantined transaction");
  helpers.assert(tx.json[0].invoice_id === null, "Expected transaction.invoice_id to be null (quarantine)");

  var apps = await helpers.restSelect(
    "transaction_applications?transaction_id=eq." + encodeURIComponent(tx.json[0].id) + "&select=id"
  );
  assertOk2xx(apps.status, "Failed to select applications for quarantined tx", apps.json);
  helpers.assertEquals(apps.json.length, 0, "Expected no applications for quarantined tx");

  await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(providerPaymentId));
  await restDeleteWhere("stripe_webhook_events", "event_id=eq." + encodeURIComponent(eventId));
});

helpers.addTest("P0-02.C: legacy/corrupt invoice ingests tx but quarantines application", async function () {
  var tenantId = "tvg";
  var created = { jobId: null, invoiceId: null, providerPaymentId: null, eventId: null };

  var jobIns = await helpers.restInsert("jobs", [{ tenant_id: tenantId, status: "unscheduled", total_amount: 20 }]);
  assertOk2xx(jobIns.status, "Failed to insert job fixture", jobIns.json);
  created.jobId = jobIns.json[0].id;

  // Legacy money state: amount_paid already set, but no ledger apps exist.
  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: created.jobId,
      status: "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: "P0-02C-L-" + crypto.randomUUID().slice(0, 8),
      total_amount: 20,
      amount_paid: 5,
      balance_due: 15,
      customer_email: "p0-02c-l@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  created.invoiceId = invoiceIns.json[0].id;

  created.providerPaymentId = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  created.eventId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

  var ev = makeStripeEvent({
    eventId: created.eventId,
    type: "payment_intent.succeeded",
    object: {
      id: created.providerPaymentId,
      object: "payment_intent",
      amount_received: 1000,
      currency: "usd",
      metadata: { invoice_id: created.invoiceId }
    }
  });

  var r = await postWebhookEvent(ev);
  assertOk2xx(r.status, "Webhook legacy/corrupt ingest failed", r.json);
  helpers.assert(r.json && r.json.quarantined === true, "Expected quarantined=true for legacy state");
  helpers.assert(r.json && r.json.reconciliation_required === true, "Expected reconciliation_required=true for legacy state");

  var apps = await helpers.restSelect(
    "transaction_applications?invoice_id=eq." + encodeURIComponent(created.invoiceId) + "&select=id"
  );
  assertOk2xx(apps.status, "Failed to select applications for legacy state", apps.json);
  helpers.assertEquals(apps.json.length, 0, "Expected no applications created for legacy state quarantine");

  var inv = await helpers.restSelect(
    "invoices?id=eq." + encodeURIComponent(created.invoiceId) + "&select=id,reconciliation_required"
  );
  assertOk2xx(inv.status, "Failed to select invoice reconciliation flag", inv.json);
  helpers.assert(inv.json[0].reconciliation_required === true, "Expected invoice.reconciliation_required=true");

  await restDeleteWhere("transactions", "provider_reference=eq." + encodeURIComponent(created.providerPaymentId));
  await restDeleteWhere("stripe_webhook_events", "event_id=eq." + encodeURIComponent(created.eventId));
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.jobId));
});
