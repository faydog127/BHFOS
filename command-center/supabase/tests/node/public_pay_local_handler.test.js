/**
 * Local public-pay handler regression.
 *
 * Proves that two identical, explicitly authorized local-bypass requests reuse
 * one registered checkout without creating any settlement effects.
 */

var crypto = require("crypto");
var helpers = require("./helpers.js");
var CONFIG = require("./config.js");

function joinUrl(base, suffix) {
  return base.charAt(base.length - 1) === "/" ? base + suffix : base + "/" + suffix;
}

function assertOk2xx(result, message) {
  helpers.assert(
    result.status >= 200 && result.status < 300,
    message + " (status " + result.status + "): " + JSON.stringify(result.json)
  );
}

async function restDeleteWhere(table, whereQuery) {
  var response = await fetch(joinUrl(CONFIG.REST, table) + "?" + whereQuery, {
    method: "DELETE",
    headers: {
      apikey: CONFIG.SERVICE,
      Authorization: "Bearer " + CONFIG.SERVICE
    }
  });
  return response.status;
}

async function upsertGlobalConfig(key, value) {
  var response = await fetch(joinUrl(CONFIG.REST, "global_config") + "?on_conflict=key&select=key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.SERVICE,
      Authorization: "Bearer " + CONFIG.SERVICE,
      Prefer: "return=representation,resolution=merge-duplicates"
    },
    body: JSON.stringify([{ key: key, value: value }])
  });
  var json = await response.json();
  return { status: response.status, json: json };
}

helpers.addTest("public-pay local handler reuses one canonical checkout", async function () {
  var nonce = crypto.randomUUID();
  var tenantId = "local-handler-" + nonce;
  var token = crypto.randomUUID();
  var idempotencyKey = "local-handler-" + crypto.randomUUID();
  var runId = "local-handler-" + crypto.randomUUID();
  var jobId = null;
  var invoiceId = null;
  var providerPaymentId = null;

  try {
    assertOk2xx(await upsertGlobalConfig("payments_mode", "stripe_checkout"), "Failed to set payments_mode");
    assertOk2xx(await upsertGlobalConfig("test_mode", "true"), "Failed to set test_mode");

    var job = await helpers.restInsert("jobs", [
      {
        tenant_id: tenantId,
        status: "unscheduled",
        work_order_number: "LOCAL-" + nonce.slice(0, 8),
        total_amount: 100,
        payment_status: "unpaid"
      }
    ]);
    assertOk2xx(job, "Failed to insert job");
    jobId = job.json[0].id;

    var invoice = await helpers.restInsert("invoices", [
      {
        tenant_id: tenantId,
        job_id: jobId,
        invoice_number: "LOCAL-" + nonce.slice(0, 8),
        status: "sent",
        settlement_status: "unpaid",
        release_approved: true,
        release_approved_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        subtotal: 100,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: 100,
        amount_paid: 0,
        balance_due: 100,
        public_token: token,
        customer_email: "local-handler@example.test"
      }
    ]);
    assertOk2xx(invoice, "Failed to insert invoice");
    invoiceId = invoice.json[0].id;

    var requestBody = {
      token: token,
      tenant_id: tenantId,
      amount: 100,
      method: "card",
      idempotency_key: idempotencyKey,
      run_id: runId
    };
    var requestHeaders = { "x-test-pay": "1" };

    var first = await helpers.postEdge("public-pay", requestBody, requestHeaders);
    var second = await helpers.postEdge("public-pay", requestBody, requestHeaders);
    assertOk2xx(first, "First local public-pay call failed");
    assertOk2xx(second, "Second local public-pay call failed");

    helpers.assertEquals(first.json.session_id, second.json.session_id, "Both calls must reuse one session");
    helpers.assertEquals(
      first.json.provider_payment_id,
      second.json.provider_payment_id,
      "Both calls must reuse one provider identifier"
    );
    helpers.assert(second.json.duplicate === true, "Second call must report duplicate reuse");

    providerPaymentId = first.json.provider_payment_id;
    helpers.assert(/^pi_test_[a-z0-9]+$/i.test(providerPaymentId), "Expected canonical pi_test provider identifier");

    var checkoutUrl = new URL(first.json.checkout_url);
    helpers.assert(
      /^(127\.0\.0\.1|localhost)$/i.test(checkoutUrl.hostname),
      "Checkout URL must use an explicit loopback host"
    );
    helpers.assert(
      checkoutUrl.protocol === "http:" || checkoutUrl.protocol === "https:",
      "Checkout URL must use HTTP or HTTPS"
    );
    helpers.assertEquals(second.json.checkout_url, first.json.checkout_url, "Checkout URL must remain stable");

    var attempts = await helpers.restSelect(
      "public_payment_attempts?invoice_id=eq." +
        encodeURIComponent(invoiceId) +
        "&attempt_status=in.(initiated,pending)&select=id,attempt_status,checkout_session_id,provider_payment_id,checkout_url"
    );
    assertOk2xx(attempts, "Failed to read checkout attempts");
    helpers.assertEquals(attempts.json.length, 1, "Expected exactly one active checkout attempt");
    helpers.assertEquals(
      attempts.json[0].checkout_session_id,
      first.json.session_id,
      "Registered attempt must use the returned session"
    );
    helpers.assertEquals(
      attempts.json[0].provider_payment_id,
      providerPaymentId,
      "Registered attempt must use the canonical provider identifier"
    );
    helpers.assertEquals(attempts.json[0].checkout_url, first.json.checkout_url, "Registered URL must match");

    var transactions = await helpers.restSelect(
      "transactions?invoice_id=eq." + encodeURIComponent(invoiceId) + "&select=id"
    );
    assertOk2xx(transactions, "Failed to read transactions");
    helpers.assertEquals(transactions.json.length, 0, "Checkout initiation must not create a transaction");

    var applications = await helpers.restSelect(
      "transaction_applications?invoice_id=eq." + encodeURIComponent(invoiceId) + "&select=id"
    );
    assertOk2xx(applications, "Failed to read payment applications");
    helpers.assertEquals(applications.json.length, 0, "Checkout initiation must not create an application");

    var webhooks = await helpers.restSelect(
      "stripe_webhook_events?provider_payment_id=eq." +
        encodeURIComponent(providerPaymentId) +
        "&select=event_id"
    );
    assertOk2xx(webhooks, "Failed to read webhook events");
    helpers.assertEquals(webhooks.json.length, 0, "Checkout initiation must not create a webhook event");

    var invoiceAfter = await helpers.restSelect(
      "invoices?id=eq." +
        encodeURIComponent(invoiceId) +
        "&select=id,status,settlement_status,amount_paid,balance_due,provider_payment_id"
    );
    assertOk2xx(invoiceAfter, "Failed to read invoice");
    helpers.assertEquals(invoiceAfter.json.length, 1, "Expected the synthetic invoice");
    helpers.assert(String(invoiceAfter.json[0].status).toLowerCase() !== "paid", "Invoice must remain unpaid");
    helpers.assertEquals(Number(invoiceAfter.json[0].amount_paid), 0, "Invoice amount_paid must remain zero");
    helpers.assertEquals(Number(invoiceAfter.json[0].balance_due), 100, "Invoice balance must remain 100.00");
    helpers.assertEquals(
      invoiceAfter.json[0].provider_payment_id,
      providerPaymentId,
      "Invoice must contain the canonical provider identifier"
    );
    helpers.assert(
      !String(invoiceAfter.json[0].provider_payment_id).startsWith("checkout_session:"),
      "Checkout placeholder must not enter the invoice provider identifier"
    );

    var publicEvents = await helpers.restSelect(
      "public_events?invoice_id=eq." + encodeURIComponent(invoiceId) + "&select=status,metadata"
    );
    assertOk2xx(publicEvents, "Failed to read public events");
    var invalidUrlFailures = publicEvents.json.filter(function (row) {
      return row && row.metadata && row.metadata.error === "PROVIDER_CHECKOUT_URL_INVALID";
    });
    helpers.assertEquals(invalidUrlFailures.length, 0, "Valid local URL must not emit PROVIDER_CHECKOUT_URL_INVALID");

    console.log(
      "PROOF:public_pay_local_handler",
      JSON.stringify({
        invoice_id: invoiceId,
        active_attempts: attempts.json.length,
        session_id: first.json.session_id,
        provider_payment_id: providerPaymentId,
        checkout_url: first.json.checkout_url,
        transactions: transactions.json.length,
        applications: applications.json.length,
        webhook_events: webhooks.json.length,
        invoice_status: invoiceAfter.json[0].status,
        invoice_amount_paid: invoiceAfter.json[0].amount_paid,
        invoice_balance_due: invoiceAfter.json[0].balance_due
      })
    );
  } finally {
    if (invoiceId) {
      await restDeleteWhere("public_events", "invoice_id=eq." + encodeURIComponent(invoiceId));
      await restDeleteWhere("events", "entity_id=eq." + encodeURIComponent(invoiceId));
      await restDeleteWhere("crm_tasks", "source_id=eq." + encodeURIComponent(invoiceId));
      await restDeleteWhere("public_payment_attempts", "invoice_id=eq." + encodeURIComponent(invoiceId));
      await restDeleteWhere("invoices", "id=eq." + encodeURIComponent(invoiceId));
    }
    if (jobId) {
      await restDeleteWhere("jobs", "id=eq." + encodeURIComponent(jobId));
    }
  }
});
