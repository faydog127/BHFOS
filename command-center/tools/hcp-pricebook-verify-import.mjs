/**
 * Post-import verification against authoritative HCP CSV.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dir = path.join(root, 'tmp/hcp-pricebook');
const csvPath = path.join(dir, 'The_Vent_Guys_HCP_Pricebook_Expanded.csv');
const EXPECTED_CSV_SHA =
  'FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3';
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'APPLY_PLAN.json'), 'utf8'));

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

function money(v) {
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Math.round(n * 100) / 100;
}

function boolish(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (['TRUE', 'YES', '1', 'Y'].includes(s)) return true;
  return false;
}

function dbQueryFile(sql, outName) {
  const sqlPath = path.join(dir, outName);
  fs.writeFileSync(sqlPath, sql, 'utf8');
  const q = spawnSync(
    'supabase',
    ['db', 'query', '--linked', '--agent=no', '-f', sqlPath, '--output', 'json'],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (q.status !== 0) {
    throw new Error(q.stderr || q.stdout || 'db query failed');
  }
  // CLI may print warnings on stderr; stdout is JSON
  const raw = (q.stdout || '').replace(/^\uFEFF/, '').trim();
  const start = raw.indexOf('[');
  const json = start >= 0 ? raw.slice(start) : raw;
  return JSON.parse(json);
}

const csvSha = sha256File(csvPath);
if (csvSha !== EXPECTED_CSV_SHA) {
  console.error('CSV SHA mismatch');
  process.exit(1);
}

const live = dbQueryFile(
  `select code, name, category, base_price::float8 as base_price, active, taxable, online_booking_enabled,
          subcategory, industry, unit_of_measure, item_type
   from public.price_book where coalesce(tenant_id,'default')='default' order by code;`,
  'VERIFY_LIVE.sql',
);
const byCode = new Map(live.map((r) => [String(r.code).toUpperCase(), r]));

const hcp = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const mismatches = [];
for (const row of hcp) {
  const code = String(row.task_code).trim().toUpperCase();
  const crm = byCode.get(code);
  if (!crm) {
    mismatches.push({ code, type: 'missing_in_crm' });
    continue;
  }
  if (Number(crm.base_price) !== money(row.price)) {
    mismatches.push({ code, type: 'price', hcp: money(row.price), crm: crm.base_price });
  }
  if (String(crm.name) !== String(row.name).trim()) {
    mismatches.push({ code, type: 'name', hcp: row.name, crm: crm.name });
  }
  if (crm.active !== true) {
    mismatches.push({ code, type: 'not_active' });
  }
  if (Boolean(crm.taxable) !== boolish(row.taxable)) {
    mismatches.push({ code, type: 'taxable', hcp: boolish(row.taxable), crm: crm.taxable });
  }
  if (Boolean(crm.online_booking_enabled) !== boolish(row.online_booking_enabled)) {
    mismatches.push({
      code,
      type: 'online_booking',
      hcp: boolish(row.online_booking_enabled),
      crm: crm.online_booking_enabled,
    });
  }
  const unit = String(row.unit_of_measure ?? '').trim();
  if (unit && String(crm.unit_of_measure || '') !== unit) {
    mismatches.push({ code, type: 'unit', hcp: unit, crm: crm.unit_of_measure });
  }
}

const stillActiveShouldBeOff = [];
for (const code of plan.deactivate) {
  const crm = byCode.get(code.toUpperCase());
  if (crm && crm.active === true) stillActiveShouldBeOff.push(code);
}

const mil = byCode.get('DISC-MIL-10PCT');
const counts = dbQueryFile(
  `select
     (select count(*)::int from public.quote_items) as quote_items,
     (select count(*)::int from public.invoice_items) as invoice_items,
     (select count(*)::int from public.price_book) as price_book_rows,
     (select count(*)::int from public.price_book where active) as price_book_active,
     (select count(*)::int from public.price_book where code = any(array[${plan.import_codes
       .map((c) => `'${c.replace(/'/g, "''")}'`)
       .join(',')}])) as hcp_codes_present,
     (select count(*)::int from public.price_book where code='BUNDLE-DISCOUNT-50' and active) as bundle_still_active,
     (select count(*)::int from public.price_book where code='DISC-050' and active and base_price = -50) as disc050_ok;`,
  'VERIFY_COUNTS.sql',
);

const report = {
  disposition: null,
  csv_sha256: csvSha,
  hcp_rows: hcp.length,
  mismatches,
  still_active_should_be_off: stillActiveShouldBeOff,
  disc_mil_active: mil?.active === true,
  counts: counts[0] || counts,
  history_untouched:
    (counts[0] || counts).quote_items === 119 && (counts[0] || counts).invoice_items === 11,
  pass:
    mismatches.length === 0 &&
    stillActiveShouldBeOff.length === 0 &&
    mil?.active === true &&
    hcp.length === 52 &&
    (counts[0] || counts).hcp_codes_present === 52 &&
    (counts[0] || counts).bundle_still_active === 0 &&
    (counts[0] || counts).disc050_ok === 1,
};
report.disposition = report.pass
  ? 'CRM_HCP_PRICEBOOK_IMPORT_PASS'
  : 'CRM_HCP_PRICEBOOK_IMPORT_FAIL';

fs.writeFileSync(path.join(dir, 'VERIFY_REPORT.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
