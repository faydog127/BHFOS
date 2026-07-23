/**
 * Apply Founder-approved HCP → CRM pricebook import.
 *
 * - Verifies CSV SHA-256
 * - Builds SQL: upsert 52 HCP rows + deactivate approved legacy codes
 * - Does NOT delete catalog rows
 * - Does NOT rewrite quote/job/invoice history
 *
 * Usage:
 *   node tools/hcp-pricebook-apply.mjs            # write SQL + plan JSON
 *   node tools/hcp-pricebook-apply.mjs --execute  # also run via supabase db query --linked
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

const HOLD_DEACTIVATE = [
  'BATH-FAN',
  'BLOWER-RESTORE',
  'CHECKUP-1YR',
  'DUCT-FOG',
  'DV-CABINET',
  'HDW-ALARM',
  'HDW-FIL-ES',
  'HDW-PCO-010',
  'HDW-UV-010',
  'PKG-REALTOR-REFRESH',
  'SANITIZER-BASIC',
];

/** Direct overlaps, consolidations, obsolete packages, removals, and clear HCP replacements. */
const OVERLAP_OR_REPLACED_DEACTIVATE = [
  // PD-PB-01 / PD-PB-03 survivors
  'BUNDLE-DISCOUNT-50',
  'DV-CLAMP',
  'DV-SEAL',
  'DV-STD',
  'DV-ROOF',
  'DUCT-SYS2',
  'DUCT-SYS-ADD',
  'DUCT-VENT',
  'DUCT-RET',
  // Explicit Founder examples + obsolete packages / removals
  'PKG-MIN',
  'PKG-COMP',
  'PKG-REST',
  'MIN-VISIT',
  'EXT-GUARD-STD',
  // Clear functional replacements by imported HCP codes
  'DV-ADD-DRYER', // → DV-120
  'DV-XTRA', // → DV-130
  'DV-LINT-TRAP', // → DV-170
  'DV-TRANS-HD', // → DV-210
  'DV-CONN-MAG', // → DV-230
  'EXT-HOOD-FIX', // → DV-240
  'EXT-HOOD-NO', // → DV-250
  'ROOF-CAP', // → DV-260
  'ACC-TIGHT', // → ACC-100
  'ACC-ATTIC', // → ACC-110
  'ACC-CRAWL', // → ACC-120
  'ACC-ROOF', // → ACC-130
  'TRIP-ZONE-2', // → TRIP-200
  'DUCT-SYS1', // → AD-100
  'CONDO-SYS1', // → AD-140
  'DUCT-BLOW', // → HVAC-210
  'COIL-CLEAN', // → HVAC-230
  'ODOR-NEUTRAL', // → OD-100
];

const RETAIN_ACTIVE = ['DISC-MIL-10PCT'];

const DEACTIVATE = [...new Set([...HOLD_DEACTIVATE, ...OVERLAP_OR_REPLACED_DEACTIVATE])].sort();

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

function boolish(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toUpperCase();
  if (['TRUE', 'YES', '1', 'Y'].includes(s)) return true;
  if (['FALSE', 'NO', '0', 'N', ''].includes(s)) return false;
  throw new Error(`invalid bool: ${v}`);
}

function money(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) throw new Error(`invalid money: ${v}`);
  return Math.round(n * 100) / 100;
}

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlBool(v) {
  return v ? 'true' : 'false';
}

function sqlNum(v) {
  if (v === null || v === undefined) return 'NULL';
  return String(v);
}

const csvSha = sha256File(csvPath);
if (csvSha !== EXPECTED_CSV_SHA) {
  console.error('CSV SHA mismatch', { expected: EXPECTED_CSV_SHA, got: csvSha });
  process.exit(1);
}

const rawRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
if (rawRows.length !== 52) {
  console.error(`Expected 52 CSV rows, got ${rawRows.length}`);
  process.exit(1);
}

const importRows = rawRows.map((r) => {
  const task_code = String(r.task_code ?? '').trim();
  const name = String(r.name ?? '').trim();
  const price = money(r.price);
  if (!task_code || !name || price === null) {
    throw new Error(`Invalid HCP row: ${JSON.stringify(r)}`);
  }
  const sub1 = String(r.subcategory_1 ?? '').trim();
  const sub2 = String(r.subcategory_2 ?? '').trim();
  const subcategory = [sub1, sub2].filter(Boolean).join(' / ');
  const isDiscount = task_code.toUpperCase() === 'DISC-050' || price < 0;
  return {
    code: task_code,
    name,
    category: String(r.category ?? '').trim() || null,
    description: String(r.description ?? '').trim() || null,
    base_price: price,
    taxable: boolish(r.taxable),
    online_booking_enabled: boolish(r.online_booking_enabled),
    subcategory: subcategory || null,
    industry: String(r.industry ?? '').trim() || null,
    unit_of_measure: String(r.unit_of_measure ?? '').trim() || null,
    item_type: isDiscount ? 'discount' : 'service',
    discount_type: isDiscount ? 'fixed' : null,
    discount_value: isDiscount ? Math.abs(price) : null,
    discount_eligible: isDiscount ? false : true,
    active: true,
  };
});

const codes = importRows.map((r) => r.code.toUpperCase());
if (new Set(codes).size !== codes.length) {
  console.error('Duplicate task codes in CSV');
  process.exit(1);
}

const upsertValues = importRows
  .map((r) => {
    return `(
    'default',
    ${sqlStr(r.code)},
    ${sqlStr(r.name)},
    ${sqlStr(r.category)},
    ${sqlNum(r.base_price)},
    'fixed',
    ${sqlStr(r.description)},
    ${sqlBool(r.active)},
    ${sqlStr(r.item_type)},
    ${sqlStr(r.discount_type)},
    ${sqlNum(r.discount_value)},
    ${sqlBool(r.discount_eligible)},
    ${sqlBool(r.taxable)},
    ${sqlBool(r.online_booking_enabled)},
    ${sqlStr(r.subcategory)},
    ${sqlStr(r.industry)},
    ${sqlStr(r.unit_of_measure)},
    now()
  )`;
  })
  .join(',\n');

const deactivateList = DEACTIVATE.map((c) => sqlStr(c)).join(', ');

const sql = `-- Generated by hcp-pricebook-apply.mjs
-- CSV SHA-256: ${csvSha}
-- Import rows: ${importRows.length}
-- Deactivate codes: ${DEACTIVATE.length}
-- RETAIN active (explicit): ${RETAIN_ACTIVE.join(', ')}

BEGIN;

-- 1) Upsert exact HCP rows into price_book (tenant_id='default')
INSERT INTO public.price_book (
  tenant_id,
  code,
  name,
  category,
  base_price,
  price_type,
  description,
  active,
  item_type,
  discount_type,
  discount_value,
  discount_eligible,
  taxable,
  online_booking_enabled,
  subcategory,
  industry,
  unit_of_measure,
  updated_at
)
VALUES
${upsertValues}
ON CONFLICT (code) DO UPDATE SET
  tenant_id = COALESCE(public.price_book.tenant_id, 'default'),
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  base_price = EXCLUDED.base_price,
  price_type = EXCLUDED.price_type,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  item_type = EXCLUDED.item_type,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  discount_eligible = EXCLUDED.discount_eligible,
  taxable = EXCLUDED.taxable,
  online_booking_enabled = EXCLUDED.online_booking_enabled,
  subcategory = EXCLUDED.subcategory,
  industry = EXCLUDED.industry,
  unit_of_measure = EXCLUDED.unit_of_measure,
  updated_at = now();

-- 2) Deactivate approved legacy codes for new quotes (never delete)
UPDATE public.price_book
SET active = false, updated_at = now()
WHERE tenant_id = 'default'
  AND code IN (${deactivateList})
  AND active IS DISTINCT FROM false;

-- 3) Ensure military discount remains active (PD-PB-02)
UPDATE public.price_book
SET active = true, updated_at = now()
WHERE tenant_id = 'default'
  AND code = 'DISC-MIL-10PCT'
  AND active IS DISTINCT FROM true;

COMMIT;
`;

const sqlOut = path.join(dir, 'APPLY_IMPORT.sql');
const planOut = path.join(dir, 'APPLY_PLAN.json');
fs.writeFileSync(sqlOut, sql, 'utf8');
fs.writeFileSync(
  planOut,
  JSON.stringify(
    {
      csv_sha256: csvSha,
      import_count: importRows.length,
      import_codes: importRows.map((r) => r.code),
      deactivate: DEACTIVATE,
      retain_active: RETAIN_ACTIVE,
      hold_deactivate: HOLD_DEACTIVATE,
      overlap_or_replaced_deactivate: OVERLAP_OR_REPLACED_DEACTIVATE,
      prices: importRows.map((r) => ({ code: r.code, base_price: r.base_price })),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Wrote ${sqlOut}`);
console.log(`Wrote ${planOut}`);
console.log(`Import ${importRows.length}; deactivate ${DEACTIVATE.length}; retain ${RETAIN_ACTIVE.join(',')}`);

const execute = process.argv.includes('--execute');
if (!execute) {
  console.log('Dry write only. Pass --execute to apply via supabase db query --linked');
  process.exit(0);
}

const result = spawnSync(
  'supabase',
  ['db', 'query', '--linked', '--agent=no', '-f', sqlOut],
  { cwd: root, encoding: 'utf8', shell: true },
);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.status !== 0) {
  console.error('Apply failed');
  process.exit(result.status || 1);
}
console.log('APPLY_OK');
