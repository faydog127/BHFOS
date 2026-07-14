import fs from 'node:fs';
import path from 'node:path';

// Minimal hygiene gate for customer-facing documents/pages/emails.
// Goal: prevent mojibake + Unicode punctuation that has caused customer-visible garbling.
//
// We intentionally scan only customer document/pipeline surfaces (not marketing pages).

const ROOTS = [
  'src/pages/public',
  'src/components/documents',
  'supabase/functions/_shared',
  'supabase/functions/send-estimate',
  'supabase/functions/send-invoice',
  'supabase/functions/send-receipt',
  'supabase/functions/public-quote',
  'supabase/functions/public-quote-approve',
  'supabase/functions/public-invoice',
  'supabase/functions/public-pay',
  'supabase/functions/inspection-report-pdf',
].filter((p) => fs.existsSync(p));

const FILE_RE = /\.(js|jsx|ts|tsx|mjs|cjs|md|html|css)$/i;

// Mojibake patterns we've seen when UTF-8 punctuation is mis-decoded (often as Windows-1252).
// Keep this file ASCII-only to avoid editor/terminal encoding drift.
const MOJIBAKE_NEEDLES = [
  // Mis-decoded UTF-8 punctuation.
  '\u00e2\u20ac\u00a2',
  '\u00e2\u20ac\u2122',
  '\u00e2\u20ac\u02dc',
  '\u00e2\u20ac\u0153',
  '\u00e2\u20ac\u009d',
  '\u00e2\u20ac\u201c',
  '\u00e2\u20ac\u201d',
  // Double-encoding / mixed decoding artifacts.
  '\u00c3\u00a2\u00e2\u201a\u00ac',
  '\u00c3\u0083\u00c2\u00a2\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00ac',
  // Stray leading U+00C2 and similar artifacts.
  '\u00c2',
];

// Block actual Unicode punctuation that has historically caused customer-visible garbling
// in downstream email/PDF renderers (prefer ASCII equivalents in customer docs).
const UNICODE_PUNCTUATION_RE = /[\u2022\u2019\u2018\u201c\u201d\u2014\u2013\u00a0]/;

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (FILE_RE.test(ent.name)) out.push(full);
  }
}

const files = [];
for (const root of ROOTS) walk(root, files);

const violations = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');

  for (const needle of MOJIBAKE_NEEDLES) {
    if (text.includes(needle)) {
      violations.push({ file, kind: 'mojibake', needle });
      break;
    }
  }

  const m = text.match(UNICODE_PUNCTUATION_RE);
  if (m) {
    violations.push({ file, kind: 'unicode_punct', needle: m[0] });
  }
}

if (violations.length === 0) {
  console.log(`OK: customer doc encoding hygiene (${files.length} files scanned)`);
  process.exit(0);
}

console.error(`FAIL: customer doc encoding hygiene (${violations.length} violation(s))`);
for (const v of violations.slice(0, 80)) {
  console.error(`- ${v.kind}: ${v.file} :: ${JSON.stringify(v.needle)}`);
}
if (violations.length > 80) {
  console.error(`...and ${violations.length - 80} more`);
}
process.exit(1);
