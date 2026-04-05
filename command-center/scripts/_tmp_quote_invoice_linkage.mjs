#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
const envRaw = fs.readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }),
);

const base = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function get(pathname) {
  const res = await fetch(`${base}/rest/v1/${pathname}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(`${pathname}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const quotes = await get(
  "quotes?select=id,quote_number,status,updated_at&tenant_id=eq.tvg&status=eq.approved&order=updated_at.desc&limit=100",
);
const invoices = await get(
  "invoices?select=id,quote_id,status,invoice_number,created_at&tenant_id=eq.tvg&order=created_at.desc&limit=200",
);

const invoiceByQuote = new Map();
for (const inv of invoices) {
  if (!inv.quote_id) continue;
  if (!invoiceByQuote.has(inv.quote_id)) invoiceByQuote.set(inv.quote_id, []);
  invoiceByQuote.get(inv.quote_id).push(inv);
}

const approvedWithoutInvoice = quotes.filter((q) => !invoiceByQuote.has(q.id));

console.log(`approved_quotes=${quotes.length}`);
console.log(`invoices_total=${invoices.length}`);
console.log(`approved_without_invoice=${approvedWithoutInvoice.length}`);
if (approvedWithoutInvoice.length > 0) {
  console.log("sample_missing:");
  for (const q of approvedWithoutInvoice.slice(0, 10)) {
    console.log(`- quote_id=${q.id} quote_number=${q.quote_number} updated_at=${q.updated_at}`);
  }
}
