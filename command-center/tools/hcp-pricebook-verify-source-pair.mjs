/**
 * Verify authoritative HCP CSV + XLSX Import Draft are the same approved version.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dir = path.join(root, 'tmp/hcp-pricebook');
const require = createRequire(path.join(dir, 'package.json'));
const XLSX = require('xlsx');

const DOWNLOADS_CSV = String.raw`C:\Users\erron\Downloads\The_Vent_Guys_HCP_Pricebook_Expanded.csv`;
const DOWNLOADS_XLSX = String.raw`C:\Users\erron\Downloads\The_Vent_Guys_HCP_Pricebook_Expanded.xlsx`;
const csvPath = path.join(dir, 'The_Vent_Guys_HCP_Pricebook_Expanded.csv');
const xlsxPath = path.join(dir, 'The_Vent_Guys_HCP_Pricebook_Expanded.xlsx');

function sha256(p) {
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

function norm(v) {
  return String(v ?? '').trim();
}

function money(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function boolish(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (['TRUE', 'YES', '1', 'Y'].includes(s)) return true;
  if (['FALSE', 'NO', '0', 'N', ''].includes(s)) return false;
  return null;
}

function keyRow(r) {
  return {
    task_code: norm(r.task_code),
    industry: norm(r.industry),
    category: norm(r.category),
    subcategory_1: norm(r.subcategory_1),
    subcategory_2: norm(r.subcategory_2),
    name: norm(r.name),
    description: norm(r.description),
    price: money(r.price),
    cost: money(r.cost),
    taxable: boolish(r.taxable),
    unit_of_measure: norm(r.unit_of_measure),
    online_booking_enabled: boolish(r.online_booking_enabled),
  };
}

const csvShaDl = sha256(DOWNLOADS_CSV);
const xlsxShaDl = sha256(DOWNLOADS_XLSX);
const csvSha = sha256(csvPath);
const xlsxSha = sha256(xlsxPath);

const csvRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const wb = XLSX.readFile(xlsxPath);
const draft = XLSX.utils.sheet_to_json(wb.Sheets['HCP Import Draft'], { defval: '' });
const hold = XLSX.utils.sheet_to_json(wb.Sheets['Hold - Do Not Import'], { defval: '' });

const csvBy = new Map(csvRows.map((r) => [norm(r.task_code).toUpperCase(), keyRow(r)]));
const xBy = new Map(draft.map((r) => [norm(r.task_code).toUpperCase(), keyRow(r)]));

const onlyCsv = [...csvBy.keys()].filter((k) => !xBy.has(k));
const onlyX = [...xBy.keys()].filter((k) => !csvBy.has(k));
const disagreements = [];
for (const [k, c] of csvBy) {
  const x = xBy.get(k);
  if (!x) continue;
  const diffs = [];
  for (const f of Object.keys(c)) {
    const cv = c[f];
    const xv = x[f];
    const bothNull = (cv === null || cv === undefined) && (xv === null || xv === undefined);
    const bothNaN = Number.isNaN(cv) && Number.isNaN(xv);
    if (!bothNull && !bothNaN && cv !== xv) diffs.push({ field: f, csv: cv, xlsx: xv });
  }
  if (diffs.length) disagreements.push({ task_code: k, diffs });
}

const materialFields = new Set([
  'task_code',
  'price',
  'name',
  'description',
  'category',
  'subcategory_1',
  'subcategory_2',
  'taxable',
  'unit_of_measure',
  'online_booking_enabled',
]);
const material =
  onlyCsv.length > 0 ||
  onlyX.length > 0 ||
  disagreements.some((d) => d.diffs.some((x) => materialFields.has(x.field))) ||
  csvShaDl !== csvSha ||
  xlsxShaDl !== xlsxSha;

const holdNames = new Set(hold.map((r) => norm(r.Item || r.item).toLowerCase()).filter(Boolean));
const holdInImport = [...csvBy.values()].filter((r) => holdNames.has(r.name.toLowerCase()));

let prior = null;
const priorPath = path.join(dir, 'DRY_RUN_RECONCILIATION.json');
if (fs.existsSync(priorPath)) {
  prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
}

const disposition = material
  ? 'CRM_PRICEBOOK_UPDATE_REQUIRES_PRODUCT_DECISION'
  : 'SOURCE_PAIR_VERIFIED — prior dry-run product decisions still open';

const report = {
  recorded_at: new Date().toISOString(),
  sources: {
    csv: {
      downloads_path: DOWNLOADS_CSV,
      worktree_path: csvPath,
      sha256_downloads: csvShaDl,
      sha256_worktree: csvSha,
      bytes: fs.statSync(DOWNLOADS_CSV).size,
      rows: csvRows.length,
    },
    xlsx: {
      downloads_path: DOWNLOADS_XLSX,
      worktree_path: xlsxPath,
      sha256_downloads: xlsxShaDl,
      sha256_worktree: xlsxSha,
      bytes: fs.statSync(DOWNLOADS_XLSX).size,
      sheets: wb.SheetNames,
      import_draft_rows: draft.length,
    },
  },
  excluded_sources: [
    'The_Vent_Guys_HCP_Pricebook_Online_Booking.csv',
    'The_Vent_Guys_HCP_Pricebook_Online_Booking.xlsx',
    'pricebook_template.csv',
  ],
  import_contract: {
    machine_source: 'CSV',
    xlsx_role: 'supporting sheets only',
  },
  version_agreement: {
    csv_matches_xlsx_import_draft: !material && onlyCsv.length === 0 && onlyX.length === 0 && disagreements.length === 0,
    only_in_csv: onlyCsv,
    only_in_xlsx_draft: onlyX,
    field_disagreement_count: disagreements.length,
    field_disagreements: disagreements,
    material_disagreement: material,
  },
  hold: {
    hold_sheet_count: holdNames.size,
    hold_items_present_in_import: holdInImport.map((r) => ({ task_code: r.task_code, name: r.name })),
  },
  prior_dry_run_present: !!prior,
  prior_dry_run_summary: prior
    ? {
        approved: prior.import_candidate?.approved,
        new_items: prior.reconciliation?.new_items?.length,
        absent_live: prior.reconciliation?.live_absent_from_hcp?.length,
        rejected: prior.import_candidate?.rejected,
        product_decision_required_for_absent_legacy: prior.product_decision_required_for_absent_legacy,
      }
    : null,
  open_product_decisions: ['PD-PB-01', 'PD-PB-02', 'PD-PB-03', 'PD-PB-04'],
  disposition,
};

fs.writeFileSync(path.join(dir, 'SOURCE_PAIR_VERIFICATION.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      csvShaDl,
      xlsxShaDl,
      worktreeMatch: csvShaDl === csvSha && xlsxShaDl === xlsxSha,
      csvRows: csvRows.length,
      draftRows: draft.length,
      onlyCsv,
      onlyX,
      disagreements: disagreements.length,
      material,
      holdInImport: holdInImport.length,
      disposition,
    },
    null,
    2,
  ),
);
