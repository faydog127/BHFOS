import fs from 'node:fs/promises';
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

const env = parseEnv(await fs.readFile('.env', 'utf8'));
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error('Missing Supabase keys');

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const recipientEmail = 'erron.fayson@gmail.com';
const tenantId = 'tvg';
const validUntil = '2026-03-17';

const tempUserEmail = `sample.sender+${Date.now()}@vent-guys.com`;
const tempUserPassword = 'Passw0rd!Aexec2';

const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
  email: tempUserEmail,
  password: tempUserPassword,
  email_confirm: true,
  app_metadata: { tenant_id: tenantId },
});
if (createUserError) throw createUserError;

try {
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: tempUserEmail,
    password: tempUserPassword,
  });
  if (signInError) throw signInError;
  const accessToken = signInData?.session?.access_token;
  if (!accessToken) throw new Error('No access token from sign-in');

  const leadEmail = `jaxson.smith+${Date.now()}@vent-guys.com`;
  const { data: lead, error: createLeadError } = await admin
    .from('leads')
    .insert({
      tenant_id: tenantId,
      first_name: 'Jaxson',
      last_name: 'Smith',
      email: leadEmail,
      phone: '(321) 555-0101',
      service: 'Dryer Vent Cleaning',
      status: 'qualified',
      stage: 'proposal',
    })
    .select('id,first_name,last_name,email')
    .single();
  if (createLeadError) throw createLeadError;

  let pbRow = null;
  {
    const { data, error } = await admin
      .from('price_book')
      .select('tenant_id,code,name,base_price,active')
      .eq('active', true)
      .eq('code', 'DV-STD')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    pbRow = data;
  }

  if (!pbRow) {
    const { data, error } = await admin
      .from('price_book')
      .select('tenant_id,code,name,base_price,active')
      .eq('active', true)
      .or('name.ilike.%dryer vent%,name.ilike.%dryer%')
      .order('base_price', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    pbRow = data;
  }

  if (!pbRow) throw new Error('No active dryer-vent price book item found');

  const unitPrice = Number(pbRow.base_price ?? 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error('Invalid unit price from price_book');

  const quantity = 1;
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  const taxAmount = Number((subtotal * 0.07).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  const lineItemsArrayWithSnapshot = [{
    description: pbRow.name || 'Dryer Vent Clean',
    quantity,
    unit_price: unitPrice,
    total_price: subtotal,
    estimated_labor: Number((subtotal * 0.40).toFixed(2)),
    estimated_material: Number((subtotal * 0.20).toFixed(2)),
    estimated_equipment: Number((subtotal * 0.10).toFixed(2)),
    total_estimated_cost: Number((subtotal * 0.70).toFixed(2)),
  }];

  const quoteNumber = Math.floor(Date.now() / 1000);
  const { data: quote, error: quoteErr } = await admin
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      lead_id: lead.id,
      quote_number: quoteNumber,
      status: 'draft',
      valid_until: validUntil,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      user_id: createdUser.user.id,
      public_token: crypto.randomUUID(),
      line_items: lineItemsArrayWithSnapshot,
    })
    .select('id,quote_number,public_token,total_amount,subtotal,tax_amount')
    .single();
  if (quoteErr) throw quoteErr;

  const { error: qiError } = await admin
    .from('quote_items')
    .insert({
      quote_id: quote.id,
      description: pbRow.name || 'Dryer Vent Clean',
      quantity,
      unit_price: unitPrice,
      total_price: subtotal,
      price_book_code: pbRow.code || null,
    });
  if (qiError) throw qiError;

  const sendResp = await fetch(`${url}/functions/v1/send-estimate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${accessToken}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      quote_id: quote.id,
      email: recipientEmail,
      lead_id: lead.id,
      tenant_id: tenantId,
    }),
  });

  const sendJson = await sendResp.json().catch(() => ({}));

  console.log(JSON.stringify({
    ok: sendResp.ok,
    status: sendResp.status,
    send_response: sendJson,
    recipient: recipientEmail,
    customer_name: 'Jaxson Smith',
    quote_id: quote.id,
    quote_number: quote.quote_number,
    valid_through: validUntil,
    price_book_code: pbRow.code,
    price_book_name: pbRow.name,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    approval_link: `${(env.VITE_API_BASE_URL || 'https://api.bhfos.com').replace(/\/$/, '')}/quotes/${quote.public_token}`,
  }, null, 2));

} finally {
  await admin.auth.admin.deleteUser(createdUser.user.id);
}
