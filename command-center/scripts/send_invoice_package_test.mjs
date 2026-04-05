import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseEnv(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
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

const asString = (value) => (typeof value === 'string' ? value.trim() : '');

async function fileToAttachment(filePath) {
  const absolute = path.resolve(filePath);
  const content = await fs.readFile(absolute);
  return {
    filename: path.basename(absolute),
    content_base64: content.toString('base64'),
    content_type: 'application/pdf',
  };
}

async function listPdfFiles(folderPath) {
  const absolute = path.resolve(folderPath);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => path.join(absolute, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

const args = parseArgs(process.argv.slice(2));
const env = parseEnv(await fs.readFile('.env', 'utf8'));

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const tenantId = asString(args.tenant || 'tvg');
const toEmail = asString(args.to || 'erron.fayson@gmail.com');
const invoiceIdArg = asString(args['invoice-id']);
const invoiceNumberArg = asString(args['invoice-number']);
const includeStripe = args['no-stripe'] ? false : true;
const dryRun = Boolean(args['dry-run']);

if (!supabaseUrl || !serviceKey || !anonKey) {
  throw new Error('Missing Supabase env keys in .env (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY)');
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let invoiceId = invoiceIdArg;
if (!invoiceId && invoiceNumberArg) {
  const { data: row, error } = await admin
    .from('invoices')
    .select('id, invoice_number, tenant_id')
    .eq('tenant_id', tenantId)
    .eq('invoice_number', invoiceNumberArg)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!row?.id) throw new Error(`No invoice found for invoice_number=${invoiceNumberArg} tenant=${tenantId}`);
  invoiceId = row.id;
}

if (!invoiceId) {
  throw new Error('Provide --invoice-id <uuid> or --invoice-number <number>');
}

const attachmentFiles = [];

if (args['main-pdf']) {
  attachmentFiles.push(path.resolve(String(args['main-pdf'])));
}

if (args['audit-dir']) {
  const pdfs = await listPdfFiles(String(args['audit-dir']));
  attachmentFiles.push(...pdfs);
}

if (args['files']) {
  const explicitFiles = String(args.files)
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
  attachmentFiles.push(...explicitFiles);
}

const dedupedFiles = Array.from(new Set(attachmentFiles));
const attachments = [];
for (const file of dedupedFiles) {
  attachments.push(await fileToAttachment(file));
}

const payload = {
  invoice_id: invoiceId,
  tenant_id: tenantId,
  to_email: toEmail,
  include_stripe_invoice: includeStripe,
  attachments,
  dry_run: dryRun,
};

const tempUserEmail = `send.invoice.${Date.now()}@vent-guys.com`;
const tempUserPassword = 'Passw0rd!InvoiceSend1';
let tempUserId = null;

try {
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email: tempUserEmail,
    password: tempUserPassword,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId },
  });
  if (createUserError) throw createUserError;
  tempUserId = createdUser?.user?.id || null;

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: tempUserEmail,
    password: tempUserPassword,
  });
  if (signInError) throw signInError;
  const accessToken = signInData?.session?.access_token;
  if (!accessToken) throw new Error('Failed to get access token for temporary user');

  const response = await fetch(`${supabaseUrl}/functions/v1/send-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));

  console.log(
    JSON.stringify(
      {
        ok: response.ok,
        status: response.status,
        invoice_id: invoiceId,
        to: toEmail,
        include_stripe_invoice: includeStripe,
        dry_run: dryRun,
        attachments_count: attachments.length,
        attachments_files: dedupedFiles.map((entry) => path.basename(entry)),
        response: json,
      },
      null,
      2,
    ),
  );
} finally {
  if (tempUserId) {
    await admin.auth.admin.deleteUser(tempUserId);
  }
}
