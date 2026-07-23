import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../tmp/hcp-pricebook');

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

const text = fs.readFileSync(path.join(dir, 'The_Vent_Guys_HCP_Pricebook_Expanded.csv'), 'utf8').replace(/^\uFEFF/, '');
const lines = text.split(/\r?\n/).filter((l) => l.length);
const headers = splitCsvLine(lines[0]);
const rows = lines.slice(1).map((line) => {
  const cols = splitCsvLine(line);
  const r = {};
  headers.forEach((h, i) => {
    r[h] = cols[i] ?? '';
  });
  return r;
});
console.log('HCP', rows.length);
for (const r of rows) {
  console.log(`${r.task_code}\t${r.price}\t${r.name}`);
}
const live = JSON.parse(fs.readFileSync(path.join(dir, 'live_price_book.json'), 'utf8').replace(/^\uFEFF/, ''));
console.log('\nLIVE_ACTIVE');
for (const l of live.filter((x) => x.active).sort((a, b) => a.code.localeCompare(b.code))) {
  console.log(`${l.code}\t${l.base_price}\t${l.name}`);
}
