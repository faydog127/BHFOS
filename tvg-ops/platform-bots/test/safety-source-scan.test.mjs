import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const forbidden = [
  /\bfetch\s*\(/, /from ['"](?:node:)?http/, /from ['"](?:node:)?https/, /from ['"](?:node:)?net/, /from ['"](?:node:)?child_process/,
  /from ['"](?:node:)?fs/, /process\.env/
];

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(p)); else if (p.endsWith('.mjs')) out.push(p);
  }
  return out;
}

test('source package has no network, filesystem, child-process, or environment access', async () => {
  for (const file of await files(root)) {
    const source = await readFile(file, 'utf8');
    for (const pattern of forbidden) assert.equal(pattern.test(source), false, `${pattern} found in ${file}`);
  }
});
