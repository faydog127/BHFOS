#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || './artifacts/tenants';

const allowedExt = new Set(['.json', '.md', '.txt', '.log']);
const maxBytes = 2 * 1024 * 1024; // 2 MiB per file (guardrail, not a storage system)

const fail = (msg) => {
  console.error(`TENANT ARTIFACTS: FAILED\n\n${msg}\n`);
  process.exit(1);
};

const ok = () => {
  console.log('TENANT ARTIFACTS: PASSED');
};

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

if (!isDir(root)) {
  // No tenants yet is allowed; this is a validator, not a creator.
  ok();
  process.exit(0);
}

const bad = [];

const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.DS_Store') continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(abs);
      continue;
    }
    if (!ent.isFile()) continue;

    const rel = path.relative(process.cwd(), abs).replaceAll('\\', '/');
    const ext = path.extname(ent.name).toLowerCase();
    const st = fs.statSync(abs);

    if (!allowedExt.has(ext)) {
      bad.push(`Disallowed extension (${ext}): ${rel}`);
      continue;
    }
    if (st.size > maxBytes) {
      bad.push(`File too large (${st.size} bytes > ${maxBytes}): ${rel}`);
      continue;
    }
    // Guardrail: never allow raw secrets dumps / archives under artifacts.
    if (/\.(zip|tar|gz|7z|rar)$/i.test(ent.name)) {
      bad.push(`Archives are forbidden under artifacts: ${rel}`);
    }
  }
};

walk(root);

if (bad.length) {
  fail(bad.slice(0, 50).join('\n') + (bad.length > 50 ? `\n...and ${bad.length - 50} more` : ''));
}

ok();

