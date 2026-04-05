/**
 * P0-02.B — Offline/Manual Payment Writer Rebuild
 *
 * Evidence-grade assertions:
 * - ledger-first: payment_attempts + transactions + transaction_applications exist
 * - settlement recompute: invoice.amount_paid == sum(applied_amount)
 * - duplicate replay: same manual reference returns same transaction_id, no second financial effect
 * - manual reference rejection: banned/low-signal references rejected
 * - legacy invoice handling: legacy money state without ledger is blocked
 */

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var CONFIG = require("./config.js");
var helpers = require("./helpers.js");

var LOCAL_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

function joinUrl(base, suffix) {
  if (base.charAt(base.length - 1) === "/") return base + suffix;
  return base + "/" + suffix;
}

async function authAdminCreateUser(email, password) {
  var base = CONFIG.REST.replace("/rest/v1", "");
  var url = joinUrl(base, "auth/v1/admin/users");
  var resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.SERVICE,
      Authorization: "Bearer " + CONFIG.SERVICE
    },
    body: JSON.stringify({
      email: email,
      password: password,
      email_confirm: true
    })
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

async function authAdminDeleteUser(userId) {
  var base = CONFIG.REST.replace("/rest/v1", "");
  var url = joinUrl(base, "auth/v1/admin/users/" + encodeURIComponent(userId));
  var resp = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: CONFIG.SERVICE,
      Authorization: "Bearer " + CONFIG.SERVICE
    }
  });
  return { status: resp.status };
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwtHS256(payload) {
  var header = { alg: "HS256", typ: "JWT" };
  var headerB64 = base64UrlEncode(JSON.stringify(header));
  var payloadB64 = base64UrlEncode(JSON.stringify(payload));
  var data = headerB64 + "." + payloadB64;
  var sig = crypto.createHmac("sha256", LOCAL_JWT_SECRET).update(data).digest("base64");
  var sigB64 = sig.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return data + "." + sigB64;
}

async function postEdgeAuth(functionName, body, jwt) {
  var url = joinUrl(CONFIG.EDGE, functionName);
  var resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + jwt
    },
    body: JSON.stringify(body)
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
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

async function restSelectWhere(table, whereQuery) {
  return helpers.restSelect(table + "?" + whereQuery);
}

function assertOk2xx(status, message, json) {
  helpers.assert(status >= 200 && status < 300, message + " (status " + status + "): " + JSON.stringify(json));
}

helpers.addTest("P0-02.B: manual payment ledger-first + duplicate-safe + reconciliation", async function () {
  var tenantId = "tvg";
  var email = "p0-02b-" + crypto.randomUUID().slice(0, 8) + "@example.com";
  var userCreate = await authAdminCreateUser(email, "Passw0rd!" + crypto.randomUUID().slice(0, 8));
  assertOk2xx(userCreate.status, "Failed to create auth user", userCreate.json);
  var userId = userCreate.json.id;
  var now = Math.floor(Date.now() / 1000);
  var jwt = signJwtHS256({
    iss: joinUrl(CONFIG.REST.replace("/rest/v1", ""), "auth/v1"),
    aud: "authenticated",
    role: "authenticated",
    sub: userId,
    iat: now,
    exp: now + 60 * 60,
    app_metadata: { tenant_id: tenantId }
  });

  var created = {
    job_id: null,
    invoice_id: null,
    tx1: null,
    tx2: null
  };

  // Role gate: allow this user to record offline payments.
  var roleIns = await helpers.restInsert("app_user_roles", [{ tenant_id: tenantId, user_id: userId, role: "admin" }]);
  assertOk2xx(roleIns.status, "Failed to insert app_user_roles", roleIns.json);

  // Fixtures: job + invoice (guardrails require job_id).
  var jobIns = await helpers.restInsert("jobs", [
    { tenant_id: tenantId, status: "unscheduled", total_amount: 100 }
  ]);
  assertOk2xx(jobIns.status, "Failed to insert job fixture", jobIns.json);
  created.job_id = jobIns.json[0].id;

  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: created.job_id,
      status: "draft",
      invoice_number: "P0-02B-" + crypto.randomUUID().slice(0, 8),
      total_amount: 100,
      customer_email: "p0-02b@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  created.invoice_id = invoiceIns.json[0].id;

  // 1) First manual payment
  var first = await postEdgeAuth(
    "invoice-update-status",
    {
      tenant_id: tenantId,
      invoice_id: created.invoice_id,
      payment_amount: 40,
      payment_method: "check",
      payment_reference: "CHK 10001",
      source_screen: "p0-02b-test"
    },
    jwt
  );
  helpers.assertEquals(
    first.status,
    200,
    "Expected first manual payment to succeed (status " + first.status + "): " + JSON.stringify(first.json)
  );
  helpers.assert(first.json && first.json.ok === true, "Expected ok=true");
  helpers.assert(first.json.duplicate === false, "Expected duplicate=false on first write");
  helpers.assert(first.json.financial_effect_created === true, "Expected financial_effect_created=true on first write");
  helpers.assert(first.json.event_emitted === true, "Expected event_emitted=true on first write");
  helpers.assert(first.json.transaction_id, "Expected transaction_id on first write");
  created.tx1 = first.json.transaction_id;

  // DB proof objects
  var attempts1 = await restSelectWhere(
    "payment_attempts",
    "select=*&tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(created.invoice_id)
  );
  helpers.assertEquals(attempts1.status, 200, "Expected payment_attempts select 200");
  helpers.assert(Array.isArray(attempts1.json) && attempts1.json.length === 1, "Expected 1 payment_attempt row after first payment");

  var apps1 = await restSelectWhere(
    "transaction_applications",
    "select=*&tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(created.invoice_id)
  );
  helpers.assertEquals(apps1.status, 200, "Expected transaction_applications select 200");
  helpers.assert(Array.isArray(apps1.json) && apps1.json.length === 1, "Expected 1 transaction_application row after first payment");

  var invoiceAfter1 = await restSelectWhere(
    "invoices",
    "select=id,tenant_id,status,total_amount,amount_paid,balance_due,settlement_status,last_payment_at&tenant_id=eq." +
      encodeURIComponent(tenantId) +
      "&id=eq." +
      encodeURIComponent(created.invoice_id)
  );
  helpers.assertEquals(invoiceAfter1.status, 200, "Expected invoice select 200");
  helpers.assert(Array.isArray(invoiceAfter1.json) && invoiceAfter1.json.length === 1, "Expected invoice row after first payment");
  var inv1 = invoiceAfter1.json[0];
  helpers.assertEquals(String(inv1.status).toLowerCase(), "partial", "Expected invoice status partial after first payment");
  helpers.assertEquals(Number(inv1.amount_paid), 40, "Expected invoice.amount_paid=40 after first payment");
  helpers.assertEquals(Number(inv1.balance_due), 60, "Expected invoice.balance_due=60 after first payment");
  helpers.assertEquals(String(inv1.settlement_status).toLowerCase(), "partial", "Expected invoice.settlement_status=partial");

  // Reconciliation proof
  var appliedSum1 = apps1.json.reduce(function (acc, row) { return acc + Number(row.applied_amount || 0); }, 0);
  helpers.assertEquals(Number(inv1.amount_paid), appliedSum1, "Reconciliation invariant failed after first payment");

  // 2) Duplicate replay (same reference)
  var dup = await postEdgeAuth(
    "invoice-update-status",
    {
      tenant_id: tenantId,
      invoice_id: created.invoice_id,
      payment_amount: 40,
      payment_method: "check",
      payment_reference: "CHK 10001",
      source_screen: "p0-02b-test"
    },
    jwt
  );
  helpers.assertEquals(dup.status, 200, "Expected duplicate manual payment to return 200");
  helpers.assert(dup.json && dup.json.ok === true, "Expected ok=true on duplicate");
  helpers.assert(dup.json.duplicate === true, "Expected duplicate=true on duplicate");
  helpers.assertEquals(String(dup.json.transaction_id), String(created.tx1), "Expected duplicate to return existing transaction_id");
  helpers.assert(dup.json.financial_effect_created === false, "Expected financial_effect_created=false on duplicate");
  helpers.assert(dup.json.event_emitted === false, "Expected event_emitted=false on duplicate");

  var attemptsAfterDup = await restSelectWhere(
    "payment_attempts",
    "select=id&tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(created.invoice_id)
  );
  helpers.assert(Array.isArray(attemptsAfterDup.json) && attemptsAfterDup.json.length === 1, "Expected no new payment_attempt on duplicate");

  var appsAfterDup = await restSelectWhere(
    "transaction_applications",
    "select=id&tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(created.invoice_id)
  );
  helpers.assert(Array.isArray(appsAfterDup.json) && appsAfterDup.json.length === 1, "Expected no new transaction_application on duplicate");

  // Event emission dedupe: duplicate replay must not emit a second OfflinePaymentRecorded event.
  var eventsAfterDup = await restSelectWhere(
    "events",
    "select=id&entity_type=eq.payment&entity_id=eq." +
      encodeURIComponent(created.invoice_id) +
      "&event_type=eq.OfflinePaymentRecorded"
  );
  assertOk2xx(eventsAfterDup.status, "Failed to select OfflinePaymentRecorded events", eventsAfterDup.json);
  helpers.assertEquals(eventsAfterDup.json.length, 1, "Expected exactly 1 OfflinePaymentRecorded after duplicate replay");

  // 3) Second payment (partial -> paid)
  var second = await postEdgeAuth(
    "invoice-update-status",
    {
      tenant_id: tenantId,
      invoice_id: created.invoice_id,
      payment_amount: 60,
      payment_method: "check",
      payment_reference: "CHK 10002",
      source_screen: "p0-02b-test"
    },
    jwt
  );
  helpers.assertEquals(second.status, 200, "Expected second manual payment to succeed");
  helpers.assert(second.json && second.json.ok === true, "Expected ok=true on second payment");
  helpers.assert(second.json.duplicate === false, "Expected duplicate=false on second payment");
  helpers.assert(second.json.transaction_id, "Expected transaction_id on second payment");
  created.tx2 = second.json.transaction_id;

  var invoiceAfter2 = await restSelectWhere(
    "invoices",
    "select=id,status,total_amount,amount_paid,balance_due,settlement_status&tenant_id=eq." +
      encodeURIComponent(tenantId) +
      "&id=eq." +
      encodeURIComponent(created.invoice_id)
  );
  var inv2 = invoiceAfter2.json[0];
  helpers.assertEquals(String(inv2.status).toLowerCase(), "paid", "Expected invoice status paid after second payment");
  helpers.assertEquals(Number(inv2.amount_paid), 100, "Expected invoice.amount_paid=100 after second payment");
  helpers.assertEquals(Number(inv2.balance_due), 0, "Expected invoice.balance_due=0 after second payment");
  helpers.assertEquals(String(inv2.settlement_status).toLowerCase(), "paid", "Expected invoice.settlement_status=paid");

  var apps2 = await restSelectWhere(
    "transaction_applications",
    "select=applied_amount&tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(created.invoice_id)
  );
  var appliedSum2 = apps2.json.reduce(function (acc, row) { return acc + Number(row.applied_amount || 0); }, 0);
  helpers.assertEquals(Number(inv2.amount_paid), appliedSum2, "Reconciliation invariant failed after second payment");

  // Evidence artifact dump (rows + responses)
  var proof = {
    tenant_id: tenantId,
    invoice_id: created.invoice_id,
    job_id: created.job_id,
    responses: { first: first.json, duplicate: dup.json, second: second.json },
    db: {
      payment_attempts: attempts1.json,
      transaction_applications: apps2.json,
      invoice: inv2
    }
  };
  var outPath = path.join(process.cwd(), "tmp", "p0-02b-db-proof.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2), "utf8");

  // Cleanup (best-effort): applications -> transactions -> attempts -> invoice -> job -> role
  await restDeleteWhere("transaction_applications", "tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(created.invoice_id));
  if (created.tx1) await restDeleteWhere("transactions", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.tx1));
  if (created.tx2) await restDeleteWhere("transactions", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.tx2));
  await restDeleteWhere("payment_attempts", "tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(created.invoice_id));
  await restDeleteWhere(
    "events",
    "entity_type=eq.payment&entity_id=eq." + encodeURIComponent(created.invoice_id) + "&event_type=eq.OfflinePaymentRecorded"
  );
  if (created.invoice_id) await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.invoice_id));
  if (created.job_id) await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(created.job_id));
  await restDeleteWhere("app_user_roles", "tenant_id=eq." + encodeURIComponent(tenantId) + "&user_id=eq." + encodeURIComponent(userId));
  await authAdminDeleteUser(userId);
});

helpers.addTest("P0-02.B: concurrent duplicate manual reference creates one effect and one event", async function () {
  var tenantId = "tvg";
  var email = "p0-02b-cdup-" + crypto.randomUUID().slice(0, 8) + "@example.com";
  var userCreate = await authAdminCreateUser(email, "Passw0rd!" + crypto.randomUUID().slice(0, 8));
  assertOk2xx(userCreate.status, "Failed to create auth user", userCreate.json);
  var userId = userCreate.json.id;
  var now = Math.floor(Date.now() / 1000);
  var jwt = signJwtHS256({
    iss: joinUrl(CONFIG.REST.replace("/rest/v1", ""), "auth/v1"),
    aud: "authenticated",
    role: "authenticated",
    sub: userId,
    iat: now,
    exp: now + 60 * 60,
    app_metadata: { tenant_id: tenantId }
  });

  var roleIns = await helpers.restInsert("app_user_roles", [{ tenant_id: tenantId, user_id: userId, role: "admin" }]);
  assertOk2xx(roleIns.status, "Failed to insert app_user_roles", roleIns.json);

  var jobIns = await helpers.restInsert("jobs", [{ tenant_id: tenantId, status: "unscheduled", total_amount: 20 }]);
  assertOk2xx(jobIns.status, "Failed to insert job fixture", jobIns.json);
  var jobId = jobIns.json[0].id;

  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: jobId,
      status: "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: "P0-02B-CDUP-" + crypto.randomUUID().slice(0, 8),
      total_amount: 20,
      amount_paid: 0,
      balance_due: 20,
      customer_email: "p0-02b-cdup@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  var invoiceId = invoiceIns.json[0].id;

  var payload = {
    tenant_id: tenantId,
    invoice_id: invoiceId,
    payment_amount: 5,
    payment_method: "check",
    payment_reference: "CHK 22222",
    source_screen: "p0-02b-test"
  };

  var results = await Promise.all([
    postEdgeAuth("invoice-update-status", payload, jwt),
    postEdgeAuth("invoice-update-status", payload, jwt)
  ]);
  for (var i = 0; i < results.length; i++) {
    assertOk2xx(results[i].status, "Concurrent duplicate submission failed", results[i].json);
  }

  // Response contract: at least one response must report duplicate/no financial effect.
  var effects = results.map(function (r) { return Boolean(r.json && r.json.financial_effect_created); });
  helpers.assert(
    effects.filter(Boolean).length === 1,
    "Expected exactly one response with financial_effect_created=true under concurrent duplicate reference"
  );

  var apps = await restSelectWhere(
    "transaction_applications",
    "select=id,applied_amount&tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(invoiceId)
  );
  assertOk2xx(apps.status, "Failed to select applications", apps.json);
  helpers.assertEquals(apps.json.length, 1, "Expected exactly 1 transaction_application under concurrent duplicate reference");

  var evRows = await restSelectWhere(
    "events",
    "select=id&entity_type=eq.payment&entity_id=eq." + encodeURIComponent(invoiceId) + "&event_type=eq.OfflinePaymentRecorded"
  );
  assertOk2xx(evRows.status, "Failed to select OfflinePaymentRecorded events", evRows.json);
  helpers.assertEquals(evRows.json.length, 1, "Expected exactly 1 OfflinePaymentRecorded under concurrent duplicate");

  await restDeleteWhere("transaction_applications", "tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(invoiceId));
  await restDeleteWhere("transactions", "tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(invoiceId));
  await restDeleteWhere("payment_attempts", "tenant_id=eq." + encodeURIComponent(tenantId) + "&invoice_id=eq." + encodeURIComponent(invoiceId));
  await restDeleteWhere("events", "entity_type=eq.payment&entity_id=eq." + encodeURIComponent(invoiceId) + "&event_type=eq.OfflinePaymentRecorded");
  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(jobId));
  await restDeleteWhere("app_user_roles", "tenant_id=eq." + encodeURIComponent(tenantId) + "&user_id=eq." + encodeURIComponent(userId));
  await authAdminDeleteUser(userId);
});

helpers.addTest("P0-02.B: amount precision >2 decimals is rejected", async function () {
  var tenantId = "tvg";
  var email = "p0-02b-prec-" + crypto.randomUUID().slice(0, 8) + "@example.com";
  var userCreate = await authAdminCreateUser(email, "Passw0rd!" + crypto.randomUUID().slice(0, 8));
  assertOk2xx(userCreate.status, "Failed to create auth user", userCreate.json);
  var userId = userCreate.json.id;
  var now = Math.floor(Date.now() / 1000);
  var jwt = signJwtHS256({
    iss: joinUrl(CONFIG.REST.replace("/rest/v1", ""), "auth/v1"),
    aud: "authenticated",
    role: "authenticated",
    sub: userId,
    iat: now,
    exp: now + 60 * 60,
    app_metadata: { tenant_id: tenantId }
  });

  var roleIns = await helpers.restInsert("app_user_roles", [{ tenant_id: tenantId, user_id: userId, role: "admin" }]);
  assertOk2xx(roleIns.status, "Failed to insert app_user_roles", roleIns.json);

  var jobIns = await helpers.restInsert("jobs", [{ tenant_id: tenantId, status: "unscheduled", total_amount: 10 }]);
  assertOk2xx(jobIns.status, "Failed to insert job fixture", jobIns.json);
  var jobId = jobIns.json[0].id;

  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: jobId,
      status: "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: "P0-02B-PREC-" + crypto.randomUUID().slice(0, 8),
      total_amount: 10,
      amount_paid: 0,
      balance_due: 10,
      customer_email: "p0-02b-prec@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);
  var invoiceId = invoiceIns.json[0].id;

  var bad = await postEdgeAuth(
    "invoice-update-status",
    {
      tenant_id: tenantId,
      invoice_id: invoiceId,
      payment_amount: 1.001,
      payment_method: "check",
      payment_reference: "CHK 33333",
      source_screen: "p0-02b-test"
    },
    jwt
  );

  helpers.assertEquals(bad.status, 400, "Expected precision-invalid amount to be rejected (400)");

  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(invoiceId));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(jobId));
  await restDeleteWhere("app_user_roles", "tenant_id=eq." + encodeURIComponent(tenantId) + "&user_id=eq." + encodeURIComponent(userId));
  await authAdminDeleteUser(userId);
});

helpers.addTest("P0-02.B: manual reference rejection (banned values)", async function () {
  var tenantId = "tvg";
  var email = "p0-02b-r-" + crypto.randomUUID().slice(0, 8) + "@example.com";
  var userCreate = await authAdminCreateUser(email, "Passw0rd!" + crypto.randomUUID().slice(0, 8));
  assertOk2xx(userCreate.status, "Failed to create auth user", userCreate.json);
  var userId = userCreate.json.id;
  var now = Math.floor(Date.now() / 1000);
  var jwt = signJwtHS256({
    iss: joinUrl(CONFIG.REST.replace("/rest/v1", ""), "auth/v1"),
    aud: "authenticated",
    role: "authenticated",
    sub: userId,
    iat: now,
    exp: now + 60 * 60,
    app_metadata: { tenant_id: tenantId }
  });

  var roleIns = await helpers.restInsert("app_user_roles", [{ tenant_id: tenantId, user_id: userId, role: "admin" }]);
  assertOk2xx(roleIns.status, "Failed to insert app_user_roles", roleIns.json);

  var jobIns = await helpers.restInsert("jobs", [
    { tenant_id: tenantId, status: "unscheduled", total_amount: 10 }
  ]);
  assertOk2xx(jobIns.status, "Failed to insert job fixture", jobIns.json);

  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: jobIns.json[0].id,
      status: "draft",
      invoice_number: "P0-02B-R-" + crypto.randomUUID().slice(0, 8),
      total_amount: 10,
      customer_email: "p0-02b-reject@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);

  var bad = await postEdgeAuth(
    "invoice-update-status",
    {
      tenant_id: tenantId,
      invoice_id: invoiceIns.json[0].id,
      payment_amount: 1,
      payment_method: "offline",
      payment_reference: "cash",
      source_screen: "p0-02b-test"
    },
    jwt
  );
  helpers.assertEquals(bad.status, 400, "Expected banned manual reference to be rejected (400)");

  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(invoiceIns.json[0].id));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(jobIns.json[0].id));
  await restDeleteWhere("app_user_roles", "tenant_id=eq." + encodeURIComponent(tenantId) + "&user_id=eq." + encodeURIComponent(userId));
  await authAdminDeleteUser(userId);
});

helpers.addTest("P0-02.B: legacy invoice without ledger is blocked", async function () {
  var tenantId = "tvg";
  var email = "p0-02b-l-" + crypto.randomUUID().slice(0, 8) + "@example.com";
  var userCreate = await authAdminCreateUser(email, "Passw0rd!" + crypto.randomUUID().slice(0, 8));
  assertOk2xx(userCreate.status, "Failed to create auth user", userCreate.json);
  var userId = userCreate.json.id;
  var now = Math.floor(Date.now() / 1000);
  var jwt = signJwtHS256({
    iss: joinUrl(CONFIG.REST.replace("/rest/v1", ""), "auth/v1"),
    aud: "authenticated",
    role: "authenticated",
    sub: userId,
    iat: now,
    exp: now + 60 * 60,
    app_metadata: { tenant_id: tenantId }
  });

  var roleIns = await helpers.restInsert("app_user_roles", [{ tenant_id: tenantId, user_id: userId, role: "admin" }]);
  assertOk2xx(roleIns.status, "Failed to insert app_user_roles", roleIns.json);

  var jobIns = await helpers.restInsert("jobs", [
    { tenant_id: tenantId, status: "unscheduled", total_amount: 20 }
  ]);
  assertOk2xx(jobIns.status, "Failed to insert job fixture", jobIns.json);

  // Legacy money state: amount_paid already set, but no ledger rows exist.
  var invoiceIns = await helpers.restInsert("invoices", [
    {
      tenant_id: tenantId,
      job_id: jobIns.json[0].id,
      status: "sent",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
      invoice_number: "P0-02B-L-" + crypto.randomUUID().slice(0, 8),
      total_amount: 20,
      amount_paid: 5,
      balance_due: 15,
      customer_email: "p0-02b-legacy@example.com"
    }
  ]);
  assertOk2xx(invoiceIns.status, "Failed to insert invoice fixture", invoiceIns.json);

  var blocked = await postEdgeAuth(
    "invoice-update-status",
    {
      tenant_id: tenantId,
      invoice_id: invoiceIns.json[0].id,
      payment_amount: 1,
      payment_method: "check",
      payment_reference: "CHK 99999",
      source_screen: "p0-02b-test"
    },
    jwt
  );

  helpers.assert(blocked.status === 409 || blocked.status === 500, "Expected legacy money state to be blocked (409 preferred)");
  helpers.assert(
    String(blocked.json && blocked.json.error ? blocked.json.error : "").includes("LEGACY_MONEY_STATE_MIGRATION_REQUIRED"),
    "Expected LEGACY_MONEY_STATE_MIGRATION_REQUIRED error"
  );

  await restDeleteWhere("invoices", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(invoiceIns.json[0].id));
  await restDeleteWhere("jobs", "tenant_id=eq." + encodeURIComponent(tenantId) + "&id=eq." + encodeURIComponent(jobIns.json[0].id));
  await restDeleteWhere("app_user_roles", "tenant_id=eq." + encodeURIComponent(tenantId) + "&user_id=eq." + encodeURIComponent(userId));
  await authAdminDeleteUser(userId);
});
