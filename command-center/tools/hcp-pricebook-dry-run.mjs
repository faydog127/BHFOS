/**
 * HCP → BHFOS pricebook dry-run reconciliation (no mutation).
 * Sources: HCP Import Draft CSV + Hold sheet + live price_book export.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dir = path.join(root, 'tmp/hcp-pricebook');
const require = createRequire(path.join(dir, 'package.json'));
const XLSX = require('xlsx');

const csvPath = path.join(dir, 'The_Vent_Guys_HCP_Pricebook_Expanded.csv');
const xlsxPath = path.join(dir, 'The_Vent_Guys_HCP_Pricebook_Expanded.xlsx');
const livePath = path.join(dir, 'live_price_book.json');

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
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

function boolish(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toUpperCase();
  if (['TRUE', 'YES', '1', 'Y'].includes(s)) return true;
  if (['FALSE', 'NO', '0', 'N', ''].includes(s)) return false;
  return null;
}

function money(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

const liveRaw = fs.readFileSync(livePath, 'utf8').replace(/^\uFEFF/, '');
const live = JSON.parse(liveRaw);
const liveByCode = new Map(live.map((r) => [String(r.code).trim().toUpperCase(), r]));

const csvRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const wb = XLSX.readFile(xlsxPath);
const draftSheet = XLSX.utils.sheet_to_json(wb.Sheets['HCP Import Draft'], { defval: '' });
const holdSheet = XLSX.utils.sheet_to_json(wb.Sheets['Hold - Do Not Import'], { defval: '' });
const reviewSheet = XLSX.utils.sheet_to_json(wb.Sheets['Pricebook Review'], { defval: '' });
const sqlAudit = XLSX.utils.sheet_to_json(wb.Sheets['Current SQL Audit'], { defval: '' });

// Prefer sheet as authoritative import draft if present; else CSV
const sourceRows = (draftSheet.length ? draftSheet : csvRows).map((r) => ({
  industry: String(r.industry ?? '').trim(),
  category: String(r.category ?? '').trim(),
  subcategory_1: String(r.subcategory_1 ?? '').trim(),
  subcategory_2: String(r.subcategory_2 ?? '').trim(),
  name: String(r.name ?? '').trim(),
  description: String(r.description ?? '').trim(),
  price: money(r.price),
  cost: money(r.cost),
  taxable: boolish(r.taxable),
  unit_of_measure: String(r.unit_of_measure ?? '').trim(),
  task_code: String(r.task_code ?? r['Task Code'] ?? '').trim(),
  online_booking_enabled: boolish(r.online_booking_enabled ?? r['Online Booking']),
}));

const holdNames = new Set(
  holdSheet
    .map((r) => String(r.Item || r.item || '').trim().toLowerCase())
    .filter(Boolean),
);

const defects = [];
const rejected = [];
const held = [];
const approved = [];
const seenCodes = new Map();

for (const row of sourceRows) {
  const code = row.task_code;
  if (!code) {
    defects.push({ type: 'missing_task_code', row });
    rejected.push({ reason: 'missing_task_code', row });
    continue;
  }
  if (seenCodes.has(code.toUpperCase())) {
    defects.push({ type: 'duplicate_task_code', code, prior: seenCodes.get(code.toUpperCase()), row });
    rejected.push({ reason: 'duplicate_task_code', code, row });
    continue;
  }
  seenCodes.set(code.toUpperCase(), row);
  const isApprovedDiscount =
    code.toUpperCase() === 'DISC-050' ||
    (Number.isFinite(row.price) && row.price < 0 && /discount/i.test(row.name || ''));
  if (!Number.isFinite(row.price) || (row.price < 0 && !isApprovedDiscount)) {
    defects.push({ type: 'invalid_price', code, price: row.price });
    rejected.push({ reason: 'invalid_price', code, row });
    continue;
  }
  if (isApprovedDiscount) {
    row._item_type = 'discount';
  }
  if (!row.name) {
    defects.push({ type: 'missing_name', code });
    rejected.push({ reason: 'missing_name', code, row });
    continue;
  }
  if (!row.unit_of_measure) {
    defects.push({ type: 'missing_unit', code });
    rejected.push({ reason: 'missing_unit', code, row });
    continue;
  }
  if (row.taxable === null) {
    defects.push({ type: 'invalid_taxable', code });
    rejected.push({ reason: 'invalid_taxable', code, row });
    continue;
  }
  if (row.online_booking_enabled === null) {
    defects.push({ type: 'invalid_online_booking', code });
    rejected.push({ reason: 'invalid_online_booking', code, row });
    continue;
  }
  // Hold sheet match by name
  if (holdNames.has(row.name.toLowerCase())) {
    held.push(row);
    rejected.push({ reason: 'hold_do_not_import', code, row });
    continue;
  }
  approved.push(row);
}

const newItems = [];
const changed = [];
const unchanged = [];
const onlineBookingChanges = [];

for (const row of approved) {
  const liveRow = liveByCode.get(row.task_code.toUpperCase());
  if (!liveRow) {
    newItems.push(row);
    continue;
  }
  const diffs = [];
  const livePrice = Number(liveRow.base_price);
  if (livePrice !== row.price) diffs.push({ field: 'price', live: livePrice, hcp: row.price });
  if (String(liveRow.name || '') !== row.name) diffs.push({ field: 'name', live: liveRow.name, hcp: row.name });
  if (String(liveRow.description || '') !== row.description)
    diffs.push({ field: 'description', live: liveRow.description, hcp: row.description });
  if (String(liveRow.category || '') !== row.category)
    diffs.push({ field: 'category', live: liveRow.category, hcp: row.category });
  // unit / booking / taxable may be missing on live
  const liveUnit = String(liveRow.unit_basis || '').toLowerCase();
  const hcpUnit = row.unit_of_measure.toLowerCase();
  if (liveUnit && liveUnit !== hcpUnit && liveUnit !== 'each_job') {
    diffs.push({ field: 'unit', live: liveRow.unit_basis, hcp: row.unit_of_measure });
  } else if (!liveUnit || liveUnit === 'each_job') {
    if (hcpUnit !== 'each') diffs.push({ field: 'unit', live: liveRow.unit_basis, hcp: row.unit_of_measure });
  }
  if (liveRow.active === false) diffs.push({ field: 'active', live: false, hcp: true });

  if (diffs.some((d) => d.field === 'online_booking' || d.field === 'price' || d.field === 'name')) {
    /* tracked below */
  }
  // online booking not stored live yet — always report as schema gap / change
  onlineBookingChanges.push({
    code: row.task_code,
    hcp: row.online_booking_enabled,
    live: '(column absent — will add)',
  });

  if (diffs.length === 0) unchanged.push({ code: row.task_code, name: row.name });
  else changed.push({ code: row.task_code, name: row.name, diffs });
}

const hcpCodes = new Set(approved.map((r) => r.task_code.toUpperCase()));
const absentLive = live
  .filter((r) => !hcpCodes.has(String(r.code).toUpperCase()))
  .map((r) => {
    const audit = sqlAudit.find((a) => String(a['Old Code'] || '').toUpperCase() === String(r.code).toUpperCase());
    let recommendation = 'needs_founder_decision';
    if (audit) {
      const action = String(audit['Recommended Action'] || '').toUpperCase();
      if (action.includes('HOLD') || action.includes('DEACTIV')) recommendation = 'deactivate';
      else if (action.includes('RETAIN') || action.includes('KEEP')) recommendation = 'retain';
      else if (action.includes('CONSOLID') || action.includes('MAP') || action.includes('REPLACE'))
        recommendation = 'consolidate';
    } else if (r.active === false) recommendation = 'retain'; // already inactive
    else recommendation = 'needs_founder_decision';
    return {
      code: r.code,
      name: r.name,
      category: r.category,
      base_price: r.base_price,
      active: r.active,
      recommendation,
      audit_action: audit?.['Recommended Action'] || null,
      audit_reason: audit?.Reason || null,
    };
  });

const schemaGaps = [
  { column: 'taxable', present: false, note: 'HCP taxable must be stored; add boolean column' },
  { column: 'online_booking_enabled', present: false, note: 'HCP online booking flag; add boolean column' },
  { column: 'subcategory_1', present: false, note: 'HCP subcategory; add text column' },
  { column: 'subcategory_2', present: false, note: 'HCP subcategory; add text column' },
  { column: 'industry', present: false, note: 'HCP industry; add text column' },
  {
    column: 'code vs task_code',
    present: true,
    note: 'Map HCP task_code → price_book.code (stable business id)',
  },
  {
    column: 'tenant_id',
    present: true,
    note: "Existing nullable default 'default'; preserve value; do not use for auth",
  },
];

const report = {
  sources: {
    csv: { path: csvPath, sha256: sha256File(csvPath), rows: csvRows.length },
    xlsx: { path: xlsxPath, sha256: sha256File(xlsxPath), sheets: wb.SheetNames },
    live: { count: live.length, distinct_codes: liveByCode.size },
  },
  import_candidate: {
    source: draftSheet.length ? 'HCP Import Draft sheet' : 'CSV',
    raw_rows: sourceRows.length,
    approved: approved.length,
    held_excluded: held.length,
    rejected: rejected.length,
  },
  defects,
  held: held.map((h) => ({ task_code: h.task_code, name: h.name })),
  reconciliation: {
    new_items: newItems.map((r) => ({
      task_code: r.task_code,
      name: r.name,
      price: r.price,
      category: r.category,
      online_booking_enabled: r.online_booking_enabled,
    })),
    changed_items: changed,
    unchanged_items: unchanged,
    live_absent_from_hcp: absentLive,
    online_booking_changes_count: onlineBookingChanges.length,
  },
  recommendations_for_absent: {
    deactivate: absentLive.filter((a) => a.recommendation === 'deactivate').map((a) => a.code),
    retain: absentLive.filter((a) => a.recommendation === 'retain').map((a) => a.code),
    consolidate: absentLive.filter((a) => a.recommendation === 'consolidate').map((a) => a.code),
    needs_founder_decision: absentLive
      .filter((a) => a.recommendation === 'needs_founder_decision')
      .map((a) => ({ code: a.code, name: a.name, price: a.base_price, active: a.active })),
  },
  schema_gaps: schemaGaps,
  material_defects: defects.filter((d) =>
    ['duplicate_task_code', 'missing_task_code', 'invalid_price', 'invalid_online_booking'].includes(d.type),
  ),
  proceed_import_of_hcp_without_deleting_absent: true,
  product_decision_required_for_absent_legacy:
    absentLive.filter((a) => a.recommendation === 'needs_founder_decision' && a.active).length > 0,
  note:
    'Absent live items will NOT be deleted. Active absents recommended for Founder decision post-import unless auto-classified.',
};

fs.writeFileSync(path.join(dir, 'DRY_RUN_RECONCILIATION.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      approved: approved.length,
      new: newItems.length,
      changed: changed.length,
      unchanged: unchanged.length,
      absent_live: absentLive.length,
      absent_needs_decision_active: report.recommendations_for_absent.needs_founder_decision.filter(
        (x) => liveByCode.get(x.code.toUpperCase())?.active !== false,
      ).length,
      defects: defects.length,
      held: held.length,
      sample_new: newItems.slice(0, 5).map((r) => r.task_code),
      sample_absent: absentLive.slice(0, 8).map((a) => `${a.code}:${a.recommendation}`),
    },
    null,
    2,
  ),
);
