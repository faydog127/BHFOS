#!/usr/bin/env node
/**
 * Quick schema usage validator.
 * - Scans src/ for supabase.from('table') calls.
 * - Compares tables against tvg_schema.sql.
 * - Exits non-zero if unknown tables are referenced.
 *
 * Fast by design: table-level only. Extend later for column/enum checks.
 */
const fs = require('fs');
const path = require('path');

// Repo structure: Website/ (this script), sibling "Common Folder" contains schema dump.
const schemaPath = path.join(__dirname, '..', '..', 'Common Folder', 'tvg_schema.sql');
const srcDir = path.join(__dirname, '..', 'src');

// Tables known to exist but not present in the static dump (e.g., newly added in migrations not yet reflected)
const allowList = new Set([
  'signals',
  'rep_checklists',
  'property_inspections',
]);

function collectTablesFromSchema(sql) {
  const createTableRegex = /CREATE TABLE\s+[\w.]*?(\w+)\s*\(/gi;
  const tables = new Set();
  let match;
  while ((match = createTableRegex.exec(sql)) !== null) {
    tables.add(match[1]);
  }
  return tables;
}

function collectTablesFromSrc(dir) {
  const tables = new Set();
  const fileRegex = /\.(js|jsx|ts|tsx)$/i;
  const fromRegex = /from\(\s*['"]([\w.]+)['"]\s*\)/g;

  function walk(p) {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (fileRegex.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf8');
        let m;
        while ((m = fromRegex.exec(content)) !== null) {
          tables.add(m[1]);
        }
      }
    }
  }

  walk(dir);
  return tables;
}

function main() {
  if (!fs.existsSync(schemaPath)) {
    console.error(`Schema file not found at ${schemaPath}`);
    process.exit(1);
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const schemaTables = collectTablesFromSchema(schemaSql);
  const srcTables = collectTablesFromSrc(srcDir);

  const unknown = [];
  for (const t of srcTables) {
    if (
      !allowList.has(t) &&
      !schemaTables.has(t) &&
      !schemaTables.has(t.split('.').pop())
    ) {
      unknown.push(t);
    }
  }

  if (unknown.length) {
    console.error('Schema validation failed: tables referenced in code not found in schema:');
    unknown.forEach(t => console.error(`  - ${t}`));
    process.exit(1);
  }

  console.log('Schema validation passed: all referenced tables exist.');
}

main();
