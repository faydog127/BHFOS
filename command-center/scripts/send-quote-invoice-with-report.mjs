import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const asString = (value) => (typeof value === 'string' ? value.trim() : '');

function parseEnv(content) {
  const out = {};
  for (const line of String(content || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    out[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  return out;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readBase64(filePath) {
  const bytes = await fs.readFile(filePath);
  return bytes.toString('base64');
}

async function pickLatestPdf(dirPath, namePrefix = '') {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const pdfs = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.pdf')) continue;
    if (namePrefix && !entry.name.startsWith(namePrefix)) continue;
    const full = path.join(dirPath, entry.name);
    const st = await fs.stat(full);
    pdfs.push({ full, mtimeMs: st.mtimeMs });
  }
  pdfs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return pdfs[0]?.full || null;
}

function daysBetween(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

async function generateInvoicePdfFromHtml({ html, outPath }) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('Playwright is not available; cannot render invoice PDF locally.');
  }

  const stripped = String(html || '').replace(/<img\b[^>]*>/gi, '');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.setContent(stripped, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.pdf({
      path: outPath,
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.55in', right: '0.55in', bottom: '0.55in', left: '0.55in' },
    });
    await page.close();
  } finally {
    await browser.close();
  }
}

async function createTempUserAndToken({ admin, client, tenantId }) {
  const tempUserEmail = `ops.invoice.send.${Date.now()}@vent-guys.com`;
  const tempUserPassword = 'Passw0rd!InvoiceSend1';

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email: tempUserEmail,
    password: tempUserPassword,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId },
  });
  if (createUserError) throw createUserError;
  const tempUserId = createdUser?.user?.id || null;
  if (!tempUserId) throw new Error('Failed to create temporary user');

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: tempUserEmail,
    password: tempUserPassword,
  });
  if (signInError) throw signInError;

  const accessToken = signInData?.session?.access_token;
  if (!accessToken) throw new Error('Failed to get access token for temporary user');

  return { tempUserId, accessToken };
}

function buildEmailHtml() {
  return `
    <p>Hi,</p>
    <p>Attached is your <strong>air system condition report</strong> along with your invoice from today’s service.</p>
    <p>This report documents what was observed during the cleaning and the current condition of the system.</p>
    <p><strong>Key Takeaways:</strong></p>
    <ul>
      <li>Significant buildup was present on major air-contact components (coil and blower).</li>
      <li>Duct system cleaning was completed using a NADCA-aligned process.</li>
      <li>Certain internal HVAC components were handled by a licensed contractor.</li>
    </ul>
    <p>If you have any questions about the report or the work performed, I’m happy to go over it with you.</p>
    <p>Thanks,<br/>Erron<br/>The Vent Guys</p>
  `.trim();
}

function parseNumeric(value) {
  const raw = asString(value);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function nextInvoiceNumber(admin, tenantId) {
  const { data, error } = await admin
    .from('invoices')
    .select('invoice_number')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const nums = (Array.isArray(data) ? data : [])
    .map((r) => parseNumeric(r?.invoice_number))
    .filter((n) => typeof n === 'number');
  const max = nums.length ? Math.max(...nums) : 100000;
  return String(max + 1);
}

async function updateInvoiceBestEffort(admin, invoiceId, tenantId, patch) {
  let nextPatch = { ...patch };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await admin
      .from('invoices')
      .update(nextPatch)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);
    if (!error) return;

    const msg = String(error?.message || '');
    const match = msg.match(/column \"([^\"]+)\"/i);
    const col = match?.[1];
    if (!col || !(col in nextPatch)) throw error;
    delete nextPatch[col];
  }
  throw new Error('Invoice update failed after retrying without incompatible columns.');
}

const args = parseArgs(process.argv.slice(2));

const tenantId = asString(args.tenant || 'tvg');
const toEmail = asString(args.to || 'joel_a@comcast.net');
const bccEmail = asString(args.bcc || 'erron.fayson@vent-guys.com');
const quoteIdArg = asString(args['quote-id']);
const forceResend = Boolean(args.force);
const dryRun = Boolean(args['dry-run']);

const env = parseEnv(await fs.readFile('.env', 'utf8'));
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
  throw new Error('Missing Supabase env keys in .env (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY)');
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const reportDirDefault = path.join('tmp', '730 Scott', 'estimate-20267601-before-report');
const reportPdfExplicit = asString(args['report-pdf']);
let reportPdfPath = reportPdfExplicit ? path.resolve(reportPdfExplicit) : null;
if (!reportPdfPath) {
  const candidate = await pickLatestPdf(reportDirDefault, 'estimate-');
  if (candidate) reportPdfPath = path.resolve(candidate);
}
if (!reportPdfPath || !(await exists(reportPdfPath))) {
  throw new Error('Report PDF not found. Provide --report-pdf "<path>" or ensure the 730 report directory contains a PDF.');
}

// 1) Locate quote
let quote = null;
if (quoteIdArg) {
  const { data, error } = await admin
    .from('quotes')
    .select('id, tenant_id, lead_id, quote_number, status, subtotal, tax_rate, tax_amount, total_amount, customer_email, sent_at, created_at')
    .eq('tenant_id', tenantId)
    .eq('id', quoteIdArg)
    .maybeSingle();
  if (error) throw error;
  quote = data;
} else {
  const { data, error } = await admin
    .from('quotes')
    .select('id, tenant_id, lead_id, quote_number, status, subtotal, tax_rate, tax_amount, total_amount, customer_email, sent_at, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_email', toEmail)
    .order('sent_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  const list = Array.isArray(data) ? data : [];
  if (!list.length) throw new Error(`No quotes found for ${toEmail} (tenant=${tenantId}).`);

  const primary = list[0];
  const now = new Date();
  const recentOthers = list.slice(1).filter((q) => {
    if (!q?.sent_at) return false;
    const dt = new Date(String(q.sent_at));
    return Number.isFinite(dt.getTime()) && daysBetween(now, dt) <= 30;
  });
  if (recentOthers.length) {
    throw new Error(`Multiple recent quotes found for ${toEmail}. Re-run with --quote-id <uuid> to select the correct quote.`);
  }
  quote = primary;
}

if (!quote?.id) throw new Error('Quote lookup failed.');

// 2) Fetch quote items, lead, job
const [{ data: quoteItems, error: quoteItemsError }, { data: lead, error: leadError }, { data: job, error: jobError }] = await Promise.all([
  admin.from('quote_items').select('description, quantity, unit_price, total_price').eq('quote_id', quote.id).order('created_at', { ascending: true }),
  quote.lead_id
    ? admin.from('leads').select('id, first_name, last_name, company, email, phone').eq('id', quote.lead_id).maybeSingle()
    : Promise.resolve({ data: null, error: null }),
  admin.from('jobs').select('id, status, lead_id, quote_id').eq('tenant_id', tenantId).eq('quote_id', quote.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
]);
if (quoteItemsError) throw quoteItemsError;
if (leadError) throw leadError;
if (jobError) throw jobError;

// 3) Find or create invoice
let invoice = null;
{
  const { data, error } = await admin
    .from('invoices')
    .select('id, tenant_id, quote_id, job_id, lead_id, status, sent_at, invoice_number, public_token, issue_date, due_date, total_amount, balance_due, customer_email')
    .eq('tenant_id', tenantId)
    .eq('quote_id', quote.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  invoice = data;
}

if (invoice?.id && invoice.sent_at && !forceResend) {
  throw new Error(`Invoice already has sent_at set (invoice_number=${invoice.invoice_number || ''}). Re-run with --force to resend.`);
}

let tempUserId = null;
let accessToken = null;

try {
  const auth = await createTempUserAndToken({ admin, client, tenantId });
  tempUserId = auth.tempUserId;
  accessToken = auth.accessToken;

  if (!invoice?.id) {
    const invoiceNumber = await nextInvoiceNumber(admin, tenantId);
    const today = new Date();
    const issueDate = today.toISOString().slice(0, 10);
    const due = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const dueDate = due.toISOString().slice(0, 10);

    const items = Array.isArray(quoteItems) ? quoteItems : [];
    const subtotal = Number(quote.subtotal ?? items.reduce((sum, it) => sum + Number(it?.total_price ?? 0), 0)) || 0;
    const taxRate = Number(quote.tax_rate ?? 0) || 0;
    const taxAmount = Number(quote.tax_amount ?? 0) || 0;
    const totalAmount = Number(quote.total_amount ?? (subtotal + taxAmount)) || 0;

    const customerName = asString(lead?.company) || [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ') || 'Customer';

    const invoicePayload = {
      lead_id: quote.lead_id || null,
      quote_id: quote.id,
      job_id: job?.id || null,
      status: 'draft',
      invoice_type: 'final',
      issue_date: issueDate,
      due_date: dueDate,
      notes: 'Thank you for your business.',
      terms: 'Payment is due within 14 days.',
      customer_name: customerName,
      customer_email: toEmail,
      customer_phone: asString(lead?.phone) || null,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: 0,
      total_amount: totalAmount,
      amount_paid: 0,
      balance_due: totalAmount,
      invoice_number: invoiceNumber,
    };

    if (dryRun) {
      console.log(JSON.stringify({ dry_run: true, action: 'would_create_invoice', quote_id: quote.id, invoice_number: invoiceNumber }, null, 2));
    } else {
      const resp = await fetch(`${supabaseUrl}/functions/v1/invoice-save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          invoice: invoicePayload,
          items: items.map((it) => ({
            description: asString(it?.description) || null,
            quantity: typeof it?.quantity === 'number' ? it.quantity : Number(it?.quantity ?? 1),
            unit_price: typeof it?.unit_price === 'number' ? it.unit_price : Number(it?.unit_price ?? 0),
            total_price: typeof it?.total_price === 'number' ? it.total_price : Number(it?.total_price ?? 0),
          })),
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.error) {
        throw new Error(`invoice-save failed: HTTP ${resp.status} ${(json?.error || '')}`.trim());
      }
    }

    const { data: created, error: reloadError } = await admin
      .from('invoices')
      .select('id, tenant_id, quote_id, job_id, lead_id, status, sent_at, invoice_number, public_token, issue_date, due_date, total_amount, balance_due, customer_email')
      .eq('tenant_id', tenantId)
      .eq('quote_id', quote.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reloadError) throw reloadError;
    invoice = created;
  }

  if (!invoice?.id) throw new Error('Invoice not found or created.');
  if (!invoice.public_token) {
    throw new Error('Invoice is missing public_token; cannot render public invoice HTML.');
  }

  const invoiceNumberText = asString(invoice.invoice_number) || 'invoice';
  const outDir = path.join('tmp', 'outgoing-email');
  await ensureDir(outDir);
  const invoicePdfPath = path.join(outDir, `invoice-${invoiceNumberText}.pdf`);

  const invoiceHtmlUrl = `${supabaseUrl}/functions/v1/public-invoice?token=${encodeURIComponent(String(invoice.public_token))}&tenant_id=${encodeURIComponent(tenantId)}`;
  const htmlResp = await fetch(invoiceHtmlUrl);
  const html = await htmlResp.text();
  if (!htmlResp.ok || !html || !html.toLowerCase().includes('<html')) {
    throw new Error(`public-invoice HTML fetch failed (HTTP ${htmlResp.status}).`);
  }

  if (!dryRun) {
    await generateInvoicePdfFromHtml({ html, outPath: invoicePdfPath });
  }

  const subject = `Invoice #${invoiceNumberText} + Air System Condition Report`;
  const emailHtml = buildEmailHtml();

  const attachments = [
    {
      filename: path.basename(invoicePdfPath),
      content: dryRun ? '' : await readBase64(invoicePdfPath),
      content_type: 'application/pdf',
    },
    {
      filename: path.basename(reportPdfPath),
      content: dryRun ? '' : await readBase64(reportPdfPath),
      content_type: 'application/pdf',
    },
  ];

  const sendPayload = {
    to: toEmail,
    subject,
    html: emailHtml,
    from: 'The Vent Guys <info@vent-guys.com>',
    reply_to: 'erron.fayson@vent-guys.com',
    bcc: bccEmail ? [bccEmail] : undefined,
    attachments,
  };

  if (dryRun) {
    console.log(JSON.stringify({
      dry_run: true,
      quote: { id: quote.id, quote_number: quote.quote_number || null, status: quote.status || null, sent_at: quote.sent_at || null },
      invoice: { id: invoice.id, invoice_number: invoice.invoice_number || null, status: invoice.status || null, sent_at: invoice.sent_at || null },
      email: { to: toEmail, bcc: bccEmail || null, subject, attachments: attachments.map((a) => a.filename) },
      report_pdf: reportPdfPath,
      invoice_pdf: invoicePdfPath,
    }, null, 2));
    process.exit(0);
  }

  // Send email via Edge Function (auth required)
  const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify(sendPayload),
  });
  const sendJson = await sendResp.json().catch(() => ({}));
  if (!sendResp.ok || sendJson?.success !== true) {
    throw new Error(`send-email failed: HTTP ${sendResp.status} ${(sendJson?.error || '')}`.trim());
  }

  // Mark invoice as sent + log event (best-effort)
  const nowIso = new Date().toISOString();
  await updateInvoiceBestEffort(admin, invoice.id, tenantId, {
    updated_at: nowIso,
    sent_at: invoice.sent_at ?? nowIso,
    status: asString(invoice.status).toLowerCase() === 'draft' ? 'sent' : (invoice.status || 'sent'),
    release_approved: true,
    release_approved_at: nowIso,
  });

  await admin.from('events').insert({
    tenant_id: tenantId,
    entity_type: 'invoice',
    entity_id: invoice.id,
    event_type: 'InvoiceSent',
    actor_type: 'system',
    actor_id: null,
    payload: {
      recipient_email: toEmail,
      bcc: bccEmail ? [bccEmail] : [],
      subject,
      send_email_id: sendJson?.id ?? null,
      attachments: attachments.map((a) => a.filename),
      report_pdf: path.basename(reportPdfPath),
    },
  });

  console.log(JSON.stringify({
    ok: true,
    quote_id: quote.id,
    quote_number: quote.quote_number || null,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number || null,
    to: toEmail,
    bcc: bccEmail || null,
    report_pdf: reportPdfPath,
    invoice_pdf: invoicePdfPath,
    send_email_id: sendJson?.id ?? null,
  }, null, 2));
} finally {
  if (tempUserId) {
    await admin.auth.admin.deleteUser(tempUserId);
  }
}

