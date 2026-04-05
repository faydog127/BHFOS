#!/usr/bin/env node
/* eslint-disable no-console */
import { spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";

const PROJECT_REF = process.env.PROJECT_REF ?? "wwyxohjnyqnegzbxtuxs";
const SUPABASE_URL = process.env.SUPABASE_URL ?? `https://${PROJECT_REF}.supabase.co`;
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const REST_BASE = `${SUPABASE_URL}/rest/v1`;
const SUPABASE_CLI = process.env.SUPABASE_CLI ?? "C:\\Users\\ol_ma\\.supabase\\bin\\supabase.exe";
const STRIPE_CLI =
  process.env.STRIPE_CLI ??
  "C:\\Users\\ol_ma\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe\\stripe.exe";
const NO_STRIPE = process.env.NO_STRIPE === "1";

const runId = `aexec2stg_${Math.random().toString(16).slice(2, 10)}`;
const failures = [];

function noProxyEnv(base = process.env) {
  const env = { ...base };
  delete env.HTTP_PROXY;
  delete env.HTTPS_PROXY;
  delete env.ALL_PROXY;
  delete env.GIT_HTTP_PROXY;
  delete env.GIT_HTTPS_PROXY;
  return env;
}

function fail(msg) {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function assertTrue(cond, msg) {
  if (cond) pass(msg);
  else fail(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(bin, args, env = process.env, label = "") {
  const result = spawnSync(bin, args, {
    env,
    encoding: "utf8",
    shell: false,
  });
  if (result.error) {
    const context = label ? `${label}: ` : "";
    throw new Error(`${context}command spawn failed (${bin} ${args.join(" ")}):\n${result.error.stack ?? result.error}`);
  }
  if (result.status !== 0) {
    const context = label ? `${label}: ` : "";
    throw new Error(
      `${context}command failed (${bin} ${args.join(" ")}):\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout.trim();
}

function getSupabaseKeys() {
  const anonFromEnv = process.env.ANON_KEY;
  const serviceFromEnv = process.env.SERVICE_ROLE_KEY;
  if (anonFromEnv && serviceFromEnv) {
    return { anon: anonFromEnv, service: serviceFromEnv };
  }

  const raw = runCommand(
    SUPABASE_CLI,
    ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"],
    noProxyEnv(),
    "supabase api-keys",
  );
  const keys = JSON.parse(raw);
  const anon = keys.find((k) => k.id === "anon")?.api_key;
  const service = keys.find((k) => k.id === "service_role")?.api_key;
  if (!anon || !service) {
    throw new Error("Missing anon/service_role keys from Supabase API.");
  }
  return { anon, service };
}

function getWebhookSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;
  throw new Error("Missing STRIPE_WEBHOOK_SECRET in environment.");
}

async function restRequest({
  method = "GET",
  path,
  query = "",
  headers = {},
  body,
  serviceKey,
  expectJson = true,
}) {
  const url = `${REST_BASE}/${path}${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const parsed = expectJson && text ? JSON.parse(text) : text;
  return { status: res.status, body: parsed, raw: text };
}

async function fnRequest({ method = "GET", functionName, query = "", body, anonKey }) {
  const url = `${FUNCTIONS_BASE}/${functionName}${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, raw: text };
}

async function rawFnRequest({ method = "POST", functionName, rawBody, headers = {} }) {
  const url = `${FUNCTIONS_BASE}/${functionName}`;
  const res = await fetch(url, {
    method,
    headers,
    body: rawBody,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, raw: text };
}

async function ensureFunctionRoute(functionName, anonKey) {
  const res = await fnRequest({ functionName, anonKey });
  return res.status !== 503;
}

async function setPaymentsModeStripe(serviceKey) {
  const payload = {
    key: "payments_mode",
    value: "stripe",
    updated_at: new Date().toISOString(),
  };
  const res = await restRequest({
    method: "POST",
    path: "global_config",
    query: "?on_conflict=key",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: payload,
    serviceKey,
    expectJson: false,
  });
  assertTrue(res.status >= 200 && res.status < 300, "payments_mode set to stripe on staging");
}

async function createFixture(serviceKey) {
  const email = `${runId}@example.com`;
  const phone = `555${Math.floor(1000000 + Math.random() * 9000000)}`;

  const contactRes = await restRequest({
    method: "POST",
    path: "contacts",
    query: "?select=id",
    headers: { Prefer: "return=representation" },
    body: {
      tenant_id: "tvg",
      first_name: "AEXEC2",
      last_name: "Staging",
      email,
      phone,
    },
    serviceKey,
  });
  if (contactRes.status !== 201) throw new Error(`contacts insert failed: ${contactRes.raw}`);
  const contactId = contactRes.body[0]?.id;

  const leadRes = await restRequest({
    method: "POST",
    path: "leads",
    query: "?select=id,status,tenant_id",
    headers: { Prefer: "return=representation" },
    body: {
      tenant_id: "tvg",
      contact_id: contactId,
      first_name: "AEXEC2",
      last_name: "Staging",
      email,
      phone,
      service: "residential",
      status: "new",
    },
    serviceKey,
  });
  if (leadRes.status !== 201) throw new Error(`leads insert failed: ${leadRes.raw}`);
  const leadId = leadRes.body[0]?.id;

  const quoteRes = await restRequest({
    method: "POST",
    path: "quotes",
    query: "?select=id,public_token,status,tenant_id",
    headers: { Prefer: "return=representation" },
    body: {
      tenant_id: "tvg",
      lead_id: leadId,
      status: "draft",
      subtotal: 900,
      tax_amount: 100,
      total_amount: 1000,
    },
    serviceKey,
  });
  if (quoteRes.status !== 201) throw new Error(`quotes insert failed: ${quoteRes.raw}`);
  const quoteId = quoteRes.body[0]?.id;
  const quoteToken = quoteRes.body[0]?.public_token;

  const billingJobRes = await restRequest({
    method: "POST",
    path: "jobs",
    query: "?select=id,tenant_id,total_amount,status",
    headers: { Prefer: "return=representation" },
    body: {
      tenant_id: "tvg",
      lead_id: leadId,
      status: "unscheduled",
      total_amount: 1000,
    },
    serviceKey,
  });
  if (billingJobRes.status !== 201) throw new Error(`billing job insert failed: ${billingJobRes.raw}`);
  const billingJobId = billingJobRes.body[0]?.id;

  const billingJob2Res = await restRequest({
    method: "POST",
    path: "jobs",
    query: "?select=id,tenant_id,total_amount,status",
    headers: { Prefer: "return=representation" },
    body: {
      tenant_id: "tvg",
      lead_id: leadId,
      status: "unscheduled",
      total_amount: 900,
    },
    serviceKey,
  });
  if (billingJob2Res.status !== 201) throw new Error(`billing job #2 insert failed: ${billingJob2Res.raw}`);
  const billingJob2Id = billingJob2Res.body[0]?.id;

  const invoice1Res = await restRequest({
    method: "POST",
    path: "invoices",
    query: "?select=id,public_token,status,tenant_id,total_amount,amount_paid,balance_due",
    headers: { Prefer: "return=representation" },
    body: {
      tenant_id: "tvg",
      lead_id: leadId,
      job_id: billingJobId,
      status: "sent",
      subtotal: 90,
      tax_amount: 10,
      total_amount: 100,
      amount_paid: 0,
      invoice_type: "deposit",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
    },
    serviceKey,
  });
  if (invoice1Res.status !== 201) throw new Error(`invoice1 insert failed: ${invoice1Res.raw}`);
  const invoice1Id = invoice1Res.body[0]?.id;
  const invoice1Token = invoice1Res.body[0]?.public_token;

  const invoice2Res = await restRequest({
    method: "POST",
    path: "invoices",
    query: "?select=id,public_token,status,tenant_id,total_amount,amount_paid,balance_due",
    headers: { Prefer: "return=representation" },
    body: {
      tenant_id: "tvg",
      lead_id: leadId,
      job_id: billingJob2Id,
      status: "sent",
      subtotal: 810,
      tax_amount: 90,
      total_amount: 900,
      amount_paid: 0,
      invoice_type: "final",
      release_approved: true,
      release_approved_at: new Date().toISOString(),
    },
    serviceKey,
  });
  if (invoice2Res.status !== 201) throw new Error(`invoice2 insert failed: ${invoice2Res.raw}`);
  const invoice2Id = invoice2Res.body[0]?.id;
  const invoice2Token = invoice2Res.body[0]?.public_token;

  return {
    contactId,
    leadId,
    quoteId,
    quoteToken,
    billingJobId,
    billingJob2Id,
    invoice1Id,
    invoice1Token,
    invoice2Id,
    invoice2Token,
  };
}

async function getEventsCount({ serviceKey, eventType, entityType, entityId }) {
  const query =
    `?select=id` +
    `&event_type=eq.${encodeURIComponent(eventType)}` +
    `&entity_type=eq.${encodeURIComponent(entityType)}` +
    `&entity_id=eq.${entityId}`;
  const res = await restRequest({
    path: "events",
    query,
    serviceKey,
  });
  if (res.status !== 200) throw new Error(`events query failed: ${res.raw}`);
  return res.body.length;
}

async function getStripeWebhookEventCount({ serviceKey, eventId }) {
  const res = await restRequest({
    path: "stripe_webhook_events",
    query: `?select=event_id&event_id=eq.${eventId}`,
    serviceKey,
  });
  if (res.status !== 200) throw new Error(`stripe_webhook_events query failed: ${res.raw}`);
  return res.body.length;
}

async function getTasksCount({ serviceKey, sourceType, sourceId, title, type }) {
  let query = `?select=id&source_type=eq.${sourceType}&source_id=eq.${sourceId}`;
  if (title) query += `&title=eq.${encodeURIComponent(title)}`;
  if (type) query += `&type=eq.${encodeURIComponent(type)}`;
  const res = await restRequest({
    path: "crm_tasks",
    query,
    serviceKey,
  });
  if (res.status !== 200) throw new Error(`crm_tasks query failed: ${res.raw}`);
  return res.body.length;
}

async function getLeadStatus(serviceKey, leadId) {
  const res = await restRequest({
    path: "leads",
    query: `?select=status&id=eq.${leadId}&limit=1`,
    serviceKey,
  });
  if (res.status !== 200) throw new Error(`lead status query failed: ${res.raw}`);
  return res.body[0]?.status ?? "";
}

async function getInvoiceStatus(serviceKey, invoiceId) {
  const res = await restRequest({
    path: "invoices",
    query: `?select=status&id=eq.${invoiceId}&limit=1`,
    serviceKey,
  });
  if (res.status !== 200) throw new Error(`invoice status query failed: ${res.raw}`);
  return res.body[0]?.status ?? "";
}

async function getInvoiceRow(serviceKey, invoiceId) {
  const res = await restRequest({
    path: "invoices",
    query: `?select=id,status,amount_paid,balance_due,provider_payment_id,provider_payment_status,paid_at&id=eq.${invoiceId}&limit=1`,
    serviceKey,
  });
  if (res.status !== 200) throw new Error(`invoice row query failed: ${res.raw}`);
  return res.body[0] ?? null;
}

async function getJobForQuote(serviceKey, quoteId) {
  const res = await restRequest({
    path: "jobs",
    query: `?select=id,quote_id&quote_id=eq.${quoteId}`,
    serviceKey,
  });
  if (res.status !== 200) throw new Error(`jobs query failed: ${res.raw}`);
  return res.body;
}

function makeStripeSignature(payload, webhookSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const digest = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

async function sendSignedWebhook({
  eventId,
  eventType,
  paymentIntentId,
  invoiceId,
  amountCents,
  tenantId,
  webhookSecret,
}) {
  const payloadObj = {
    id: eventId,
    object: "event",
    type: eventType,
    data: {
      object: {
        id: paymentIntentId,
        object: "payment_intent",
        amount: amountCents,
        status: eventType === "payment_intent.succeeded" ? "succeeded" : "requires_payment_method",
        metadata: {
          invoice_id: invoiceId,
          tenant_id: tenantId,
        },
      },
    },
  };

  const payload = JSON.stringify(payloadObj);
  const signature = makeStripeSignature(payload, webhookSecret);

  return rawFnRequest({
    method: "POST",
    functionName: "payment-webhook",
    rawBody: payload,
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
  });
}

function quotePwsh(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildStripePwshCommand(args, stripeApiKey) {
  const argPart = args.map((a) => quotePwsh(a)).join(" ");
  return [
    "$ErrorActionPreference = 'Stop'",
    "Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue",
    "Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue",
    "Remove-Item Env:ALL_PROXY -ErrorAction SilentlyContinue",
    "Remove-Item Env:GIT_HTTP_PROXY -ErrorAction SilentlyContinue",
    "Remove-Item Env:GIT_HTTPS_PROXY -ErrorAction SilentlyContinue",
    `$env:STRIPE_API_KEY = ${quotePwsh(stripeApiKey)}`,
    `& ${quotePwsh(STRIPE_CLI)} ${argPart}`,
  ].join("; ");
}

function runStripeJson(args, stripeApiKey) {
  const cmd = buildStripePwshCommand(args, stripeApiKey);
  const out = runCommand("pwsh", ["-NoProfile", "-Command", cmd], noProxyEnv(), "stripe");
  return JSON.parse(out);
}

function runStripeRaw(args, stripeApiKey) {
  const cmd = buildStripePwshCommand(args, stripeApiKey);
  return runCommand("pwsh", ["-NoProfile", "-Command", cmd], noProxyEnv(), "stripe");
}

async function getStripeWebhookEndpointId(stripeApiKey) {
  const list = runStripeJson(["webhook_endpoints", "list", "--limit", "100"], stripeApiKey);
  const expectedUrls = [
    `${FUNCTIONS_BASE}/stripe-webhook`,
    `${FUNCTIONS_BASE}/payment-webhook`,
  ];
  const match = (list.data ?? []).find((ep) => expectedUrls.includes(ep.url));
  if (!match) {
    throw new Error(`No Stripe webhook endpoint found for URLs: ${expectedUrls.join(", ")}`);
  }
  return { endpointId: match.id, endpointUrl: match.url };
}

function startStripeListen(stripeApiKey, forwardTo) {
  const stripeArgs = [
    "listen",
    "--events",
    "payment_intent.succeeded,payment_intent.payment_failed",
    "--forward-to",
    forwardTo,
    "--format",
    "JSON",
    "--skip-verify",
  ];
  const cmd = buildStripePwshCommand(stripeArgs, stripeApiKey);
  const child = spawn("pwsh", ["-NoProfile", "-Command", cmd], {
    env: noProxyEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  const lines = [];
  child.stdout.on("data", (buf) => lines.push(buf.toString("utf8")));
  child.stderr.on("data", (buf) => lines.push(buf.toString("utf8")));
  return { child, lines };
}

async function waitForListenReady(lines, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const joined = lines.join("");
    if (joined.includes("Ready!")) return true;
    await sleep(300);
  }
  return false;
}

function stopProcess(child) {
  if (!child || child.killed) return;
  child.kill("SIGINT");
}

async function getSucceededEventForPaymentIntent(stripeApiKey, paymentIntentId) {
  for (let i = 0; i < 10; i++) {
    const events = runStripeJson(["events", "list", "--type", "payment_intent.succeeded", "--limit", "25"], stripeApiKey);
    const match = (events.data ?? []).find((ev) => ev?.data?.object?.id === paymentIntentId);
    if (match?.id) return match.id;
    await sleep(1500);
  }
  return null;
}

async function main() {
  console.log(`== A-EXEC-2 Staging Runtime Proof (${runId}) ==`);
  const webhookSecret = getWebhookSecret();
  const { anon, service } = getSupabaseKeys();

  const routeChecks = await Promise.all([
    ensureFunctionRoute("public-quote", anon),
    ensureFunctionRoute("public-invoice", anon),
    ensureFunctionRoute("public-pay", anon),
    ensureFunctionRoute("public-quote-approve", anon),
    ensureFunctionRoute("stripe-webhook", anon),
  ]);
  assertTrue(routeChecks.every(Boolean), "Core staging function routes are reachable (non-503/non-404)");

  const preflightTables = await Promise.all([
    restRequest({ path: "events?select=id&limit=1", serviceKey: service }),
    restRequest({ path: "automation_suspensions?select=id&limit=1", serviceKey: service }),
    restRequest({ path: "crm_tasks?select=id&limit=1", serviceKey: service }),
    restRequest({ path: "stripe_webhook_events?select=event_id&limit=1", serviceKey: service }),
  ]);
  assertTrue(preflightTables.every((r) => r.status === 200), "Preflight tables exist on staging");

  const lineItemsCols = await Promise.all([
    restRequest({ path: "quotes?select=line_items&limit=1", serviceKey: service }),
    restRequest({ path: "invoices?select=line_items&limit=1", serviceKey: service }),
  ]);
  assertTrue(lineItemsCols.every((r) => r.status === 200), "quotes/invoices line_items columns are queryable");

  const signalCol = await restRequest({
    path: "leads?select=last_human_signal_at&limit=1",
    serviceKey: service,
  });
  assertTrue(signalCol.status === 200, "leads.last_human_signal_at is queryable");

  await setPaymentsModeStripe(service);
  const fx = await createFixture(service);
  assertTrue(Boolean(fx.leadId && fx.quoteId && fx.invoice1Id && fx.invoice2Id), "Created staging fixture records");

  const quoteView = await fnRequest({
    functionName: "public-quote",
    query: `?token=${encodeURIComponent(fx.quoteToken)}&tenant_id=tvg&run_id=${runId}`,
    anonKey: anon,
  });
  assertTrue(quoteView.status === 200, "public-quote returns 200 on staging");

  const invoiceView = await fnRequest({
    functionName: "public-invoice",
    query: `?token=${encodeURIComponent(fx.invoice1Token)}&tenant_id=tvg&run_id=${runId}`,
    anonKey: anon,
  });
  assertTrue(invoiceView.status === 200, "public-invoice returns 200 on staging");

  const approveResponses = [];
  for (let i = 0; i < 5; i++) {
    approveResponses.push(
      await fnRequest({
        method: "POST",
        functionName: "public-quote-approve",
        body: {
          token: fx.quoteToken,
          quote_id: fx.quoteId,
          tenant_id: "tvg",
          action: "approved",
          run_id: runId,
        },
        anonKey: anon,
      }),
    );
  }
  assertTrue(approveResponses.every((r) => r.status === 200), "public-quote-approve burst returns 200 on staging");

  const pay1 = await fnRequest({
    method: "POST",
    functionName: "public-pay",
    body: {
      token: fx.invoice1Token,
      tenant_id: "tvg",
      method: "card",
      run_id: runId,
    },
    anonKey: anon,
  });
  const pay2 = await fnRequest({
    method: "POST",
    functionName: "public-pay",
    body: {
      token: fx.invoice2Token,
      tenant_id: "tvg",
      method: "card",
      run_id: runId,
    },
    anonKey: anon,
  });
  const session1 = pay1.body?.session_id;
  const session2 = pay2.body?.session_id;
  assertTrue(
    pay1.status === 200 &&
      pay1.body?.mode === "stripe_checkout" &&
      typeof pay1.body?.checkout_url === "string" &&
      typeof session1 === "string",
    "public-pay initiate #1 returns Stripe Checkout session",
  );
  assertTrue(
    pay2.status === 200 &&
      pay2.body?.mode === "stripe_checkout" &&
      typeof pay2.body?.checkout_url === "string" &&
      typeof session2 === "string",
    "public-pay initiate #2 returns Stripe Checkout session",
  );

  const quoteTaskBefore = await getTasksCount({
    serviceKey: service,
    sourceType: "quote",
    sourceId: fx.quoteId,
    type: "follow_up",
  });
  for (let i = 0; i < 10; i++) {
    await fnRequest({
      functionName: "public-quote",
      query: `?token=${encodeURIComponent(fx.quoteToken)}&tenant_id=tvg&run_id=${runId}`,
      anonKey: anon,
    });
  }
  const quoteTaskAfter = await getTasksCount({
    serviceKey: service,
    sourceType: "quote",
    sourceId: fx.quoteId,
    type: "follow_up",
  });
  assertTrue(quoteTaskAfter - quoteTaskBefore <= 1, "Quote refresh burst does not spam follow-up tasks on staging");

  if (NO_STRIPE) {
    const checkpoint = {
      run_id: runId,
      lead_id: fx.leadId,
      quote_id: fx.quoteId,
      invoice1_id: fx.invoice1Id,
      invoice2_id: fx.invoice2Id,
      session_1: session1,
      session_2: session2,
    };
    console.log(`CHECKPOINT=${JSON.stringify(checkpoint)}`);
    if (failures.length > 0) {
      console.error(`\nA-EXEC-2 STAGING pre-stripe checks FAILED (${failures.length} issue(s)).`);
      process.exit(1);
    }
    console.log("\nA-EXEC-2 STAGING pre-stripe checks PASSED.");
    process.exit(0);
  }

  const pi1 = `pi_${runId.replace(/[^a-z0-9]/gi, "").slice(0, 18)}_1`;
  const pi2 = `pi_${runId.replace(/[^a-z0-9]/gi, "").slice(0, 18)}_2`;
  const evt1 = `evt_${runId.replace(/[^a-z0-9]/gi, "").slice(0, 18)}_1`;
  const evt2 = `evt_${runId.replace(/[^a-z0-9]/gi, "").slice(0, 18)}_2`;

  const wh1 = await sendSignedWebhook({
    eventId: evt1,
    eventType: "payment_intent.succeeded",
    paymentIntentId: pi1,
    invoiceId: fx.invoice1Id,
    amountCents: 10000,
    tenantId: "tvg",
    webhookSecret,
  });
  const wh2 = await sendSignedWebhook({
    eventId: evt2,
    eventType: "payment_intent.succeeded",
    paymentIntentId: pi2,
    invoiceId: fx.invoice2Id,
    amountCents: 90000,
    tenantId: "tvg",
    webhookSecret,
  });
  assertTrue(wh1.status === 200, "Signed payment_intent.succeeded webhook accepted for invoice #1");
  assertTrue(wh2.status === 200, "Signed payment_intent.succeeded webhook accepted for invoice #2");

  const inv1Row = await getInvoiceRow(service, fx.invoice1Id);
  const inv2Row = await getInvoiceRow(service, fx.invoice2Id);
  const leadStatusAfterFirst = await getLeadStatus(service, fx.leadId);
  assertTrue(
    inv1Row?.status === "paid" &&
      Number(inv1Row?.amount_paid || 0) >= 100 &&
      Number(inv1Row?.balance_due || 0) <= 0 &&
      inv1Row?.provider_payment_id === pi1,
    "Invoice #1 becomes paid after signed webhook reconciliation",
  );
  assertTrue(
    inv2Row?.status === "paid" &&
      Number(inv2Row?.amount_paid || 0) >= 900 &&
      Number(inv2Row?.balance_due || 0) <= 0 &&
      inv2Row?.provider_payment_id === pi2,
    "Invoice #2 becomes paid after signed webhook reconciliation",
  );
  assertTrue(leadStatusAfterFirst === "paid", "Lead becomes paid after both invoice webhooks reconcile");

  const evt1CountBefore = await getStripeWebhookEventCount({ serviceKey: service, eventId: evt1 });
  const paySucceededBefore = await getEventsCount({
    serviceKey: service,
    eventType: "PaymentSucceeded",
    entityType: "payment",
    entityId: fx.invoice1Id,
  });
  const invoicePaidBefore = await getEventsCount({
    serviceKey: service,
    eventType: "InvoicePaid",
    entityType: "invoice",
    entityId: fx.invoice1Id,
  });
  const receiptTaskBefore = await getTasksCount({
    serviceKey: service,
    sourceType: "invoice",
    sourceId: fx.invoice1Id,
    title: "Send Receipt",
  });

  const wh1Resend = await sendSignedWebhook({
    eventId: evt1,
    eventType: "payment_intent.succeeded",
    paymentIntentId: pi1,
    invoiceId: fx.invoice1Id,
    amountCents: 10000,
    tenantId: "tvg",
    webhookSecret,
  });
  assertTrue(wh1Resend.status === 200, "Duplicate signed webhook is accepted and deduped");

  const evt1CountAfter = await getStripeWebhookEventCount({ serviceKey: service, eventId: evt1 });
  const paySucceededAfter = await getEventsCount({
    serviceKey: service,
    eventType: "PaymentSucceeded",
    entityType: "payment",
    entityId: fx.invoice1Id,
  });
  const invoicePaidAfter = await getEventsCount({
    serviceKey: service,
    eventType: "InvoicePaid",
    entityType: "invoice",
    entityId: fx.invoice1Id,
  });
  const receiptTaskAfter = await getTasksCount({
    serviceKey: service,
    sourceType: "invoice",
    sourceId: fx.invoice1Id,
    title: "Send Receipt",
  });

  assertTrue(evt1CountBefore === 1 && evt1CountAfter === 1, "stripe_webhook_events dedupes resend by event_id on staging");
  assertTrue(paySucceededBefore === paySucceededAfter, "PaymentSucceeded not duplicated on resend (staging)");
  assertTrue(invoicePaidBefore === invoicePaidAfter, "InvoicePaid not duplicated on resend (staging)");
  assertTrue(receiptTaskBefore === receiptTaskAfter, "Receipt task not duplicated on resend (staging)");

  const jobsForQuote = await getJobForQuote(service, fx.quoteId);
  const jobId = jobsForQuote[0]?.id;
  const jobCreatedCount = jobId
    ? await getEventsCount({
        serviceKey: service,
        eventType: "JobCreated",
        entityType: "job",
        entityId: jobId,
      })
    : 0;
  const scheduleTasks = jobId
    ? await getTasksCount({
        serviceKey: service,
        sourceType: "job",
        sourceId: jobId,
        title: "Schedule Job",
      })
    : 0;
  assertTrue(jobsForQuote.length === 1, "Only one job exists for accepted quote (staging)");
  assertTrue(jobCreatedCount === 1, "Only one JobCreated event emitted (staging)");
  assertTrue(scheduleTasks === 1, "Only one Schedule Job task exists (staging)");

  console.log("\nRun summary:");
  console.log(`run_id=${runId}`);
  console.log(`lead_id=${fx.leadId}`);
  console.log(`quote_id=${fx.quoteId}`);
  console.log(`invoice1_id=${fx.invoice1Id}`);
  console.log(`invoice2_id=${fx.invoice2Id}`);
  console.log(`session1_id=${session1}`);
  console.log(`session2_id=${session2}`);
  if (evt1) console.log(`event1_id=${evt1}`);
  if (evt2) console.log(`event2_id=${evt2}`);

  if (failures.length > 0) {
    console.error(`\nA-EXEC-2 STAGING runtime proof FAILED (${failures.length} issue(s)).`);
    process.exit(1);
  }
  console.log("\nA-EXEC-2 STAGING runtime proof PASSED.");
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
