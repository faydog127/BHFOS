/**
 * Phase H extra coverage for mutants that survived mut_h.py:
 *   N02/N14/N21 (leave guard, source level), B09 (footer contact),
 *   V07/V10 (validateMonthlyBasis), G07-G11 + G14 (release gate and CI).
 * Drop into command-center/tests/unit/ (and append to test:finance), or run
 * from anywhere with CC_ROOT=<path to a command-center checkout>.
 * No network. The gate is run in a child process with spawn and fetch stubbed.
 * The behavioral UI half of N02/N14/N21 is phaseh-extra.navquick-add.mjs.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.CC_ROOT || path.join(here, '../..'));
const repoRoot = path.resolve(root, '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const load = (p) => import(pathToFileURL(path.join(root, p)).href);

/** Body of `function name(...) { ... }` by brace matching. */
function fnBody(src, name) {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} exists`);
  const open = src.indexOf('{', src.indexOf(')', at));
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(open + 1, i); }
  }
  throw new Error(`unterminated ${name}`);
}

describe('N02/N21: Discard clears dirty and never writes', () => {
  const shell = read('src/pages/finance/FinanceShell.jsx');
  it('N02: discardAndLeave sets the allow flag, closes the prompt, clears dirty, then navigates (in that order)', () => {
    const b = fnBody(shell, 'discardAndLeave');
    const idx = ['allowLeaveRef.current = true', 'setLeavePrompt(null)', 'setDirty(false)', 'navigate(next)'].map((s) => b.indexOf(s));
    assert.ok(idx.every((i) => i >= 0), `all four statements present: ${idx}`);
    assert.deepEqual(idx, [...idx].sort((a, z) => a - z), 'order: allow, close, clear dirty, navigate');
  });
  it('N21: leaving and staying never persist; saveDraft is called only from onSave', () => {
    for (const name of ['discardAndLeave', 'stayOnFinance']) {
      const b = fnBody(shell, name);
      assert.doesNotMatch(b, /saveDraft|supabase|await |\.from\(|\.rpc\(|approvePlan|createBlankPlan/, `${name} has no write path`);
    }
    const calls = [...shell.matchAll(/\bsaveDraft\(/g)].length;
    assert.equal(calls, 1, 'one saveDraft call site');
    assert.ok(fnBody(shell, 'onSave').includes('saveDraft('), 'and it is inside onSave');
    // the guard effect itself must not write either
    const effect = shell.slice(shell.indexOf('const prefix = `/${routeTenantId}/finance`'), shell.indexOf('function stayOnFinance'));
    assert.doesNotMatch(effect, /saveDraft|supabase/);
  });
});

describe('N14: click interceptor stays registered and is released', () => {
  const shell = read('src/pages/finance/FinanceShell.jsx');
  it('captures anchor clicks in the capture phase and removes the same listener on cleanup', () => {
    assert.ok(shell.includes("document.addEventListener('click', onClick, true);"), 'add capture click');
    assert.ok(shell.includes("document.removeEventListener('click', onClick, true);"), 'remove capture click');
    const m = /const onClick = \(event\) => \{([\s\S]*?)\n    \};/.exec(shell);
    assert.ok(m, 'onClick body');
    for (const part of ['event.preventDefault()', 'event.stopPropagation()', "closest?.('a[href]')", 'setLeavePrompt(']) {
      assert.ok(m[1].includes(part), `onClick has ${part}`);
    }
    // modified clicks, new tabs, downloads and cross-origin links are not held
    for (const part of ['event.metaKey', 'event.ctrlKey', "anchor.target === '_blank'", "anchor.hasAttribute('download')", 'url.origin !== window.location.origin']) {
      assert.ok(m[1].includes(part), `onClick passes through ${part}`);
    }
  });
});

describe('B09: footer shows phone and email from the entity profile', () => {
  it('source: contact line is rendered only in the footer variant, from brand.contact', () => {
    const src = read('src/components/finance/EntityBrandIdentity.jsx');
    assert.match(src, /variant === 'footer' && brand\.contact \? \(/);
    assert.match(src, /data-testid="entity-brand-contact"[^>]*>\{brand\.contact\.phone\} · \{brand\.contact\.email\}/);
  });
  it('behavior: rendered footer carries the TVG phone and email; header does not; BHFOS has no contact', async () => {
    const esbuild = createRequire(path.join(root, 'package.json'))('esbuild');
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'phaseh-brand-'));
    const entry = path.join(tmp, 'entry.jsx');
    writeFileSync(entry, `import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EntityBrandIdentity from '@/components/finance/EntityBrandIdentity';
export const html = (props) => renderToStaticMarkup(React.createElement(EntityBrandIdentity, props));`);
    await esbuild.build({
      entryPoints: [entry], bundle: true, outfile: path.join(tmp, 'out.cjs'), format: 'cjs', platform: 'node',
      jsx: 'automatic', loader: { '.js': 'jsx' }, logLevel: 'silent', nodePaths: [path.join(root, 'node_modules')],
      plugins: [{ name: 'at', setup(b) {
        b.onResolve({ filter: /^@\// }, (a) => {
          const base = path.join(root, 'src', a.path.slice(2));
          for (const e of ['.jsx', '.js', '/index.js', '']) if (existsSync(base + e) && /\.jsx?$/.test(base + e)) return { path: base + e };
          throw new Error(`unresolved ${a.path}`);
        });
      } }],
    });
    const { html } = createRequire(import.meta.url)(path.join(tmp, 'out.cjs'));
    const footer = html({ entityId: 'tvg', variant: 'footer', testId: 'entity-brand-footer' });
    assert.match(footer, /data-testid="entity-brand-contact"/);
    assert.match(footer, /\(321\) 360-9704/);
    assert.match(footer, /info@vent-guys\.com/);
    assert.match(footer, /data-testid="entity-brand-tagline"/);
    const header = html({ entityId: 'tvg' });
    assert.doesNotMatch(header, /entity-brand-contact|360-9704/);
    const bh = html({ entityId: 'bhfos', variant: 'footer' });
    assert.doesNotMatch(bh, /entity-brand-contact|360-9704|vent-guys\.com/);
  });
});

describe('V07: -0 is rejected for every monthly-basis field, including counts', () => {
  it('validateMonthlyBasis rejects -0 per field (count fields have no other -0 guard)', async () => {
    const { validateMonthlyBasis, CHECKIN_FIELDS } = await load('src/lib/finance/actuals.js');
    assert.ok(CHECKIN_FIELDS.some((f) => f.kind === 'count'), 'has count fields');
    for (const field of CHECKIN_FIELDS) {
      assert.deepEqual(validateMonthlyBasis({ '2026-01-01': { [field.key]: -0 } }), { ok: false, code: 'invalid_monthly_basis' }, `${field.key} (${field.kind}) rejects -0`);
      assert.equal(validateMonthlyBasis({ '2026-01-01': { [field.key]: 0 } }).ok, true, `${field.key} accepts +0`);
      assert.equal(validateMonthlyBasis({ '2026-01-01': { [field.key]: -1 } }).ok, false, `${field.key} rejects negatives`);
    }
  });
});

describe('V10: the 1e21 guard in hasAtMostTwoDecimals is equivalent (characterization)', () => {
  it('values at or above 1e21 are rejected for money and hours with or without that line', async () => {
    // Number#toString switches to exponent form at 1e21, and the next line rejects any /e/ text,
    // so the explicit guard is redundant. This passes on the shipped code and on the mutant by design.
    assert.ok(String(1e21).includes('e') && !String(999999999999999900000).includes('e'));
    const { validateMonthlyBasis, CHECKIN_FIELDS } = await load('src/lib/finance/actuals.js');
    for (const field of CHECKIN_FIELDS.filter((f) => f.kind !== 'count')) {
      for (const v of [1e21, 1.5e21, 1e22, Number.MAX_VALUE, Infinity, NaN]) {
        assert.equal(validateMonthlyBasis({ '2026-01-01': { [field.key]: v } }).ok, false, `${field.key} ${v}`);
      }
    }
  });
});

describe('G09-G11: CI wiring for the Finance release gate', () => {
  const ci = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const jobBlock = (name) => {
    const m = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [A-Za-z_][\\w-]*:\\n|(?![\\s\\S]))`, 'm').exec(ci);
    assert.ok(m, `job ${name}`);
    return m[1];
  };
  const steps = (block) => block.split(/\n(?=      - )/).filter((s) => s.trimStart().startsWith('- '));
  const e2e = jobBlock('finance_e2e');
  const e2eSteps = steps(e2e);
  const at = (needle) => e2eSteps.findIndex((s) => s.includes(needle));

  it('G09: the report check step always runs, after the gate step, and nothing is continue-on-error', () => {
    const gate = at('node tools/finance-release-gate.mjs');
    const check = at('node tools/finance-e2e-report-check.mjs');
    assert.ok(gate >= 0 && check > gate, 'check follows gate');
    assert.match(e2eSteps[check], /^\s+if: always\(\)\s*$/m);
    assert.doesNotMatch(e2eSteps[gate], /^\s+if:/m, 'gate step is unconditional');
    assert.doesNotMatch(e2e, /continue-on-error/);
  });
  it('G10: build needs lint, finance_unit and finance_e2e', () => {
    const m = /^    needs:\s*(\[[^\]]*\]|(?:\n      - .*)+)/m.exec(jobBlock('build'));
    assert.ok(m, 'build has needs');
    const needs = m[1].replace(/[\[\]\n\s-]+/g, ' ').trim().split(/[ ,]+/).filter(Boolean);
    for (const j of ['lint', 'finance_unit', 'finance_e2e']) assert.ok(needs.includes(j), `build needs ${j}: ${needs}`);
  });
  it('G11: local Supabase is started, then reset from zero, before the gate runs', () => {
    const start = at('supabase start');
    const reset = at('supabase db reset');
    const gate = at('node tools/finance-release-gate.mjs');
    assert.ok(start >= 0 && reset > start && gate > reset, `order start(${start}) < reset(${reset}) < gate(${gate})`);
    assert.match(e2eSteps[reset], /^\s+run: supabase db reset --local --yes\s*$/m);
    assert.doesNotMatch(e2eSteps[reset], /--linked|--db-url|--project-ref/);
  });
});

describe('G07/G08/G14: gate script exit codes and local-only guard (stubbed spawn and fetch)', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'phaseh-gate-'));
  const gateSrc = read('tools/finance-release-gate.mjs');
  assert.ok(gateSrc.includes("from 'node:child_process'"), 'gate imports spawn from node:child_process');
  mkdirSync(path.join(tmp, 'tools'), { recursive: true });
  writeFileSync(path.join(tmp, 'tools/finance-release-gate.mjs'), gateSrc.replace("from 'node:child_process'", "from './fake-cp.mjs'"));
  writeFileSync(path.join(tmp, 'tools/fake-cp.mjs'), `
import { EventEmitter } from 'node:events';
import { appendFileSync } from 'node:fs';
export function spawn(cmd, args, opts = {}) {
  const key = [cmd, ...args].join(' ');
  const c = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter();
  appendFileSync(process.env.FAKE_LOG, JSON.stringify({ kind: 'spawn', key, svc: Boolean(opts.env && ('SERVICE_ROLE_KEY' in opts.env || 'SUPABASE_SERVICE_ROLE_KEY' in opts.env)) }) + '\\n');
  let code = 99; let out = '';
  if (key.startsWith('npx supabase status')) { code = 0; out = process.env.FAKE_STATUS; }
  else if (key.startsWith('npx playwright test')) code = Number(process.env.FAKE_PW);
  else if (key.startsWith('node tools/finance-version-conflict-http.mjs')) code = Number(process.env.FAKE_HTTP || 0);
  else if (key.startsWith('node tools/finance-e2e-report-check.mjs')) code = Number(process.env.FAKE_CHK);
  setImmediate(() => { if (out) c.stdout.emit('data', Buffer.from(out)); c.emit('close', code); });
  return c;
}`);
  writeFileSync(path.join(tmp, 'tools/fetch-stub.mjs'), `
import { appendFileSync } from 'node:fs';
globalThis.fetch = async (url) => { appendFileSync(process.env.FAKE_LOG, JSON.stringify({ kind: 'fetch', url: String(url) }) + '\\n'); return { ok: true, status: 200, json: async () => ({ users: [] }) }; };`);

  const status = (api, db, svc = 'svc-key') => [`API_URL="${api}"`, 'ANON_KEY="anon"', svc ? `SERVICE_ROLE_KEY="${svc}"` : '', `DB_URL="${db}"`].filter(Boolean).join('\n');
  let n = 0;
  function run({ pw = 0, chk = 0, http = 0, api = 'http://127.0.0.1:54321', db = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', svc } = {}) {
    n += 1;
    const log = path.join(tmp, `log-${n}.jsonl`);
    writeFileSync(log, '');
    const r = spawnSync(process.execPath, ['--import', path.join(tmp, 'tools/fetch-stub.mjs'), path.join(tmp, 'tools/finance-release-gate.mjs')], {
      cwd: tmp, encoding: 'utf8', timeout: 20000,
      env: { PATH: process.env.PATH, FAKE_LOG: log, FAKE_PW: String(pw), FAKE_CHK: String(chk), FAKE_HTTP: String(http), FAKE_STATUS: status(api, db, svc), FINANCE_EVIDENCE_ROOT: path.join(tmp, 'evidence'), SERVICE_ROLE_KEY: 'leak-me', SUPABASE_SERVICE_ROLE_KEY: 'leak-me' },
    });
    const events = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    return { code: r.status, err: r.stderr, events, keys: events.filter((e) => e.kind === 'spawn').map((e) => e.key) };
  }

  it('baseline: playwright 0 and report check 0 -> exit 0; both spawned in order; service role not forwarded', () => {
    const r = run({ pw: 0, chk: 0 });
    assert.equal(r.code, 0, r.err);
    assert.deepEqual(r.keys.map((k) => k.split(' ').slice(0, 3).join(' ')), ['npx supabase status', 'node tools/finance-version-conflict-http.mjs', 'npx playwright test', 'node tools/finance-e2e-report-check.mjs']);
    assert.equal(r.events.find((e) => e.key?.startsWith('npx playwright')).svc, false);
    assert.equal(r.events.find((e) => e.key?.startsWith('node tools/finance-version-conflict-http.mjs')).svc, false);
  });
  it('a failing version-conflict probe fails the gate, and Playwright and the report check still run', () => {
    const r = run({ pw: 0, chk: 0, http: 1 });
    assert.equal(r.code, 1, r.err);
    assert.ok(r.keys.some((k) => k.startsWith('npx playwright test')));
    assert.ok(r.keys.some((k) => k.startsWith('node tools/finance-e2e-report-check.mjs')));
    assert.equal(r.events.find((e) => e.key?.startsWith('node tools/finance-version-conflict-http.mjs')).svc, false);
  });
  it('G07: a failing playwright run fails the gate (exit code propagated), and the report check still runs', () => {
    for (const pw of [1, 2, 137]) {
      const r = run({ pw, chk: 0 });
      assert.equal(r.code, pw, `playwright exit ${pw}`);
      assert.ok(r.keys.some((k) => k.startsWith('node tools/finance-e2e-report-check.mjs')));
    }
  });
  it('G08: a failing report check fails the gate even when playwright passed', () => {
    for (const chk of [1, 3]) {
      assert.equal(run({ pw: 0, chk }).code, chk, `check exit ${chk}`);
    }
    assert.notEqual(run({ pw: 1, chk: 1 }).code, 0);
  });
  it('local-only: loopback URLs are fetched, nothing else is', () => {
    for (const [api, db] of [['http://127.0.0.1:54321', 'postgresql://p:p@127.0.0.1:54322/postgres'], ['http://localhost:54321', 'postgresql://p:p@localhost:54322/postgres']]) {
      const r = run({ api, db });
      assert.equal(r.code, 0, r.err);
      const urls = r.events.filter((e) => e.kind === 'fetch').map((e) => new URL(e.url).hostname);
      assert.ok(urls.length > 0 && urls.every((h) => h === '127.0.0.1' || h === 'localhost'), String(urls));
    }
  });
  it('G14: non-loopback API or DB URLs are refused before any fetch or Playwright spawn (incl. look-alike hosts)', () => {
    const bad = [
      ['http://127.0.0.1.evil.example:54321', 'postgresql://p:p@127.0.0.1:54322/postgres'],
      ['http://127.0.0.1:54321', 'postgresql://p:p@db.localhost.evil.example:5432/postgres'],
      ['http://evil.example/localhost', 'postgresql://p:p@127.0.0.1:54322/postgres'],
      ['http://127.0.0.1:54321', 'postgresql://p:p@evil.example:5432/127.0.0.1'],
      ['https://abcdefgh.supabase.co', 'postgresql://p:p@db.abcdefgh.supabase.co:5432/postgres'],
      ['not a url 127.0.0.1', 'postgresql://p:p@127.0.0.1:54322/postgres'],
    ];
    for (const [api, db] of bad) {
      const r = run({ api, db });
      assert.equal(r.code, 1, `${api} | ${db}`);
      assert.match(r.err, /Refusing to run/);
      assert.equal(r.events.filter((e) => e.kind === 'fetch').length, 0, 'no fetch');
      assert.ok(!r.keys.some((k) => k.startsWith('npx playwright')), 'no playwright');
    }
  });
  it('missing service role -> exit 1 naming the value, no fetch', () => {
    const r = run({ svc: '' });
    assert.equal(r.code, 1);
    assert.match(r.err, /SERVICE_ROLE_KEY/);
    assert.equal(r.events.filter((e) => e.kind === 'fetch').length, 0);
  });
});

describe('report-check script (real file, temp root)', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'phaseh-check-'));
  mkdirSync(path.join(tmp, 'tools'), { recursive: true });
  mkdirSync(path.join(tmp, 'test-results'), { recursive: true });
  writeFileSync(path.join(tmp, 'tools/finance-e2e-report-check.mjs'), read('tools/finance-e2e-report-check.mjs'));
  const report = path.join(tmp, 'test-results/finance-playwright.json');
  const run = (body) => {
    if (body === null) { try { writeFileSync(report, ''); } catch { /* */ } writeFileSync(report, 'not json'); } else writeFileSync(report, JSON.stringify(body));
    return spawnSync(process.execPath, [path.join(tmp, 'tools/finance-e2e-report-check.mjs')], { encoding: 'utf8' }).status;
  };
  it('fails closed on unparsable, empty, short, or skipped reports; passes once five specs have no skips', () => {
    assert.equal(run(null), 1);
    assert.equal(run({}), 1);
    assert.equal(run({ stats: { expected: 0, skipped: 0 } }), 1);
    assert.equal(run({ stats: { expected: 2, skipped: 0 } }), 1);
    assert.equal(run({ stats: { expected: 3, skipped: 0 } }), 1);
    assert.equal(run({ stats: { expected: 4, skipped: 0 } }), 1);
    assert.equal(run({ stats: { expected: 5, skipped: 1 } }), 1);
    assert.equal(run({ stats: { expected: 5, skipped: 0 } }), 0);
    assert.equal(run({ stats: { expected: 9, skipped: 0 } }), 0);
  });
});
