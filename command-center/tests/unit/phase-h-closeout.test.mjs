/**
 * Phase H closeout. Mutation-style checks for print CSS, the leave guard,
 * the entity profile, and the release CI gate. Each mutant is a copy of the
 * shipped source with one ruling removed. The clean source must pass.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blankPlanInputs } from '../../src/lib/finance/blankPlan.js';
import { calculatePlan } from '../../src/lib/finance/calculate.js';
import { resolveEntityBrand } from '../../src/lib/finance/entityBrand.js';
import { buildDecisionSupport } from '../../src/lib/finance/modes.js';
import { buildFinanceReport } from '../../src/lib/finance/reports.js';
import { buildFinanceView } from '../../src/lib/finance/viewModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const repoRoot = path.resolve(root, '..');

function printFailures(css) {
  const failures = [];
  if ((css.match(/@media print/g) || []).length !== 2) failures.push('two print blocks');
  if (/@page[^{]*\{[^}]*size\s*:/.test(css)) failures.push('page size');
  if (/orientation\s*:\s*portrait/.test(css)) failures.push('portrait media');
  if (!/table:has\(th:nth-child\(10\)\) \.report-value\s*\{[^}]*white-space:\s*nowrap\s*!important/.test(css)) failures.push('value nowrap');
  if (/(^|\n)\s*\.report-value\s*\{[^}]*nowrap/.test(css)) failures.push('global nowrap');
  if (/th,\s*td\s*\{[^}]*nowrap/.test(css) || /\n {2}th \{[^}]*nowrap/.test(css)) failures.push('label nowrap');
  if (!/width:\s*8%/.test(css)) failures.push('value width');
  if (!/\.report-value\s*\{[^}]*overflow-wrap:\s*normal\s*!important/.test(css)) failures.push('report-value');
  if (!/table:has\(th:nth-child\(10\)\) th:first-child, table:has\(th:nth-child\(10\)\) td:first-child\s*\{[^}]*overflow-wrap:\s*anywhere\s*!important/.test(css)) failures.push('label wrap');
  if (!/th,\s*td\s*\{[^}]*overflow-wrap:\s*anywhere;/.test(css)) failures.push('anywhere');
  if (!/\n {2}th \{[^}]*overflow-wrap:\s*anywhere\s*!important/.test(css)) failures.push('header wrap');
  const faceAt = css.indexOf('@font-face');
  const mediaAt = css.indexOf('@media');
  if (faceAt < 0 || mediaAt < 0 || faceAt > mediaAt) failures.push('font face');
  if (!/font-display:\s*swap/.test(css)) failures.push('font display');
  if (/font-display:\s*block/.test(css)) failures.push('font block');
  if (!/thead\s*\{[^}]*display:\s*table-header-group/.test(css)) failures.push('thead');
  if (!/font-size:\s*8px\s*!important/.test(css)) failures.push('8px');
  if (!/font-size:\s*10px\s*!important/.test(css)) failures.push('10px');
  if (!css.includes('font-family: "Finance Report Sans", "Liberation Sans"')) failures.push('report font');
  if (!css.includes('url("/assets/finance/report-sans.woff2")')) failures.push('report font file');
  if (/https?:\/\//.test(css)) failures.push('remote font');
  if (!existsSync(path.join(root, 'public/assets/finance/report-sans.woff2'))) failures.push('woff2 missing');
  if (!/table-layout:\s*fixed/.test(css)) failures.push('fixed');
  if (/@media\s+(?!print\b)/.test(css)) failures.push('non-print media');
  return failures;
}

function navFailures(shell, main = '') {
  const failures = [];
  if (!shell.includes('role="alertdialog"')) failures.push('role');
  if (!shell.includes('aria-labelledby="finance-leave-title"')) failures.push('label');
  if (!shell.includes("event.key === 'Escape'")) failures.push('esc');
  if (!shell.includes("event.key !== 'Tab'")) failures.push('trap');
  if (!shell.includes('stayRef.current?.focus()')) failures.push('focus');
  if (!main.includes("window.addEventListener('popstate', (e) => window.__financeLeaveHold?.(e), true)")) failures.push('pop');
  if (!shell.includes('window.__financeLeaveHold = onPopState')) failures.push('pop hold');
  if (!shell.includes('delete window.__financeLeaveHold')) failures.push('pop cleanup');
  if (!shell.includes("addEventListener('navigate'")) failures.push('navigate');
  if (!shell.includes('history.pushState = function guardedPush')) failures.push('push');
  if (!shell.includes('history.replaceState = function guardedReplace')) failures.push('replace');
  if (!shell.includes('allowLeaveRef')) failures.push('allow');
  if (!shell.includes('stopImmediatePropagation')) failures.push('stop');
  if (!shell.includes("dataset.financeLeaveGuard = 'on'")) failures.push('guard flag');
  if (shell.includes('finance-leave-cancel')) failures.push('cancel');
  return failures;
}

function brandFailures(source) {
  const failures = [];
  if (!source.includes("displayName: 'The Vent Guys'")) failures.push('name');
  if (!source.includes("logoUrl: TVG_LOGO_PATH")) failures.push('logo');
  if (!source.includes("'/assets/finance/tvg-logo-primary.png'")) failures.push('path');
  if (!source.includes("navy: '#173861'")) failures.push('navy');
  if (!source.includes("red: '#b52025'")) failures.push('red');
  if (/https?:\/\//.test(source)) failures.push('remote');
  if (source.includes('brandAssets') || source.includes('brandConfig')) failures.push('other module');
  const tvgAt = source.indexOf("entityId: 'tvg'");
  const tvgBlock = tvgAt < 0 ? '' : source.slice(tvgAt, tvgAt + 500);
  if (!tvgBlock.includes('legalName: null')) failures.push('legal name');
  if (tvgBlock.includes("legalName: '")) failures.push('legal name');
  const bhfosAt = source.indexOf("entityId: 'bhfos'");
  const bhfosBlock = bhfosAt < 0 ? '' : source.slice(bhfosAt, bhfosAt + 400);
  if (!bhfosBlock.includes('complete: false')) failures.push('incomplete slot');
  if (!bhfosBlock.includes('logoUrl: null')) failures.push('bhfos logo');
  return failures;
}

function ciFailures({ yml, gate, check, specs }) {
  const job = yml.split('finance_e2e:')[1].split('\n  build:')[0];
  const failures = [];
  if (!/permissions:\n\s+contents: read/.test(job)) failures.push('permissions');
  if (!yml.includes('permissions:\n  contents: read\n')) failures.push('workflow permissions');
  if (/uses:\s*\S+@v\d/.test(yml)) failures.push('floating action');
  if (yml.includes('# v4.2.2')) failures.push('checkout comment');
  if (!yml.includes('actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0')) failures.push('checkout comment');
  if (!job.includes('actions/checkout@11d5960a326750d5838078e36cf38b85af677262')) failures.push('checkout');
  if (!job.includes('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020')) failures.push('node');
  if (!job.includes('supabase/setup-cli@1dedf2c611547ede7232d26866dd3c56ab903bbb')) failures.push('cli');
  if (!/version:\s*2\.119\.0/.test(job)) failures.push('cli version');
  if (/version:\s*latest/.test(job)) failures.push('latest');
  if (!job.includes('finance-e2e-report-check.mjs')) failures.push('step');
  if (!gate.includes('delete playwrightEnv.SERVICE_ROLE_KEY')) failures.push('strip role');
  if (/SERVICE_ROLE_KEY:\s*serviceRole/.test(gate)) failures.push('leak');
  if (!gate.includes('FINANCE_OWNER_EMAIL: ownerEmail')) failures.push('owner');
  if (!check.includes('skipped > 0') || !check.includes('passed < 5')) failures.push('fail closed');
  if (!gate.includes('new URL(value).hostname')) failures.push('local host');
  if (!gate.includes("hostname === '127.0.0.1'") || !gate.includes("hostname === 'localhost'")) failures.push('local host');
  if (/127\\\.0\\\.0\\\.1\|localhost/.test(gate)) failures.push('unanchored host');
  if (specs.some((spec) => /test\.skip\(/.test(spec))) failures.push('skip');
  return failures;
}

const printCss = read('src/pages/finance/FinanceReports.jsx').match(/const PRINT_CSS = `([\s\S]*?)`;/)[1];
const shell = read('src/pages/finance/FinanceShell.jsx');
const mainJsx = read('src/main.jsx');
const brandSource = read('src/lib/finance/entityBrand.js');
const identity = read('src/components/finance/EntityBrandIdentity.jsx');
const yml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const gate = read('tools/finance-release-gate.mjs');
const check = read('tools/finance-e2e-report-check.mjs');
const specs = ['tests/finance/monthly-checkin.spec.js', 'tests/finance/reports.spec.js', 'tests/finance/owner-denied.spec.js'].map(read);
const ciInput = { yml, gate, check, specs };

describe('phase H print style mutants', () => {
  it('the shipped print stylesheet passes', () => {
    assert.deepEqual(printFailures(printCss), []);
  });
  it('each print mutant fails closed', () => {
    const mutants = [
      printCss.replace('@page { margin: 12mm; }', '@page { size: letter; margin: 12mm; }'),
      printCss.replace('@media print {\n  table:has(th:nth-child(10))', '@media print and (orientation: portrait) {\n  table:has(th:nth-child(10))'),
      printCss.replace('white-space: nowrap !important;', 'white-space: normal !important;'),
      printCss.replace('width: 8%', 'width: 11%'),
      printCss.replace('th { overflow-wrap: anywhere !important;', 'th { white-space: nowrap !important; overflow-wrap: anywhere !important;'),
      printCss.replace('table:has(th:nth-child(10)) th:first-child, table:has(th:nth-child(10)) td:first-child { width: 8%; overflow-wrap: anywhere !important; }', 'table:has(th:nth-child(10)) th:first-child, table:has(th:nth-child(10)) td:first-child { width: 8%; }'),
      printCss.replace('font-display: swap', 'font-display: block'),
      printCss.replace('font-size: 8px !important;', 'font-size: 10px !important;'),
      printCss.replace('thead { display: table-header-group; }', 'thead { display: table-row-group; }'),
      printCss.replace('table-layout: fixed;', 'table-layout: auto;'),
      printCss.replace('overflow-wrap: anywhere;', 'overflow-wrap: normal;'),
      printCss.replace(/\.report-value \{[^}]+\}\n/, ''),
      `${printCss}\n@media screen { body { color: red; } }`,
      printCss.replace('url("/assets/finance/report-sans.woff2")', 'url("https://example.invalid/report-sans.woff2")'),
      printCss.replace('font-family: "Finance Report Sans", "Liberation Sans", "Nimbus Sans", "Noto Sans", sans-serif', 'font-family: sans-serif'),
    ];
    for (const mutant of mutants) {
      assert.ok(printFailures(mutant).length > 0, mutant.slice(0, 80));
    }
  });
});

describe('phase H navigation hold mutants', () => {
  it('the shipped leave guard passes', () => {
    assert.deepEqual(navFailures(shell, mainJsx), []);
  });
  it('each navigation mutant fails closed', () => {
    const cases = [
      [shell.replace('role="alertdialog"', 'role="dialog"'), mainJsx],
      [shell.replace('aria-labelledby="finance-leave-title"', ''), mainJsx],
      [shell.replace("event.key === 'Escape'", "event.key === 'F1'"), mainJsx],
      [shell.replace("event.key !== 'Tab'", "event.key !== 'Enter'"), mainJsx],
      [shell.replace('stayRef.current?.focus()', ''), mainJsx],
      [shell.replace('window.__financeLeaveHold = onPopState', 'window.__unusedHold = onPopState'), mainJsx],
      [shell, mainJsx.replace("window.addEventListener('popstate'", "window.addEventListener('click'")],
      [shell.replace("addEventListener('navigate'", "addEventListener('click'"), mainJsx],
      [shell.replace('history.pushState = function guardedPush', 'history.forward = function guardedPush'), mainJsx],
      [shell.replace('history.replaceState = function guardedReplace', 'history.forward = function guardedReplace'), mainJsx],
      [shell.replaceAll('allowLeaveRef', 'unusedLeave'), mainJsx],
      [shell.replace('stopImmediatePropagation', 'stopPropagation'), mainJsx],
      [shell.replace('data-testid="finance-leave-discard"', 'data-testid="finance-leave-cancel"'), mainJsx],
    ];
    for (const [nextShell, nextMain] of cases) {
      assert.ok(navFailures(nextShell, nextMain).length > 0, nextShell.slice(0, 60));
    }
  });
});

describe('phase H entity profile mutants', () => {
  it('the shipped TVG profile is complete and local, and Black Horse stays open', () => {
    assert.deepEqual(brandFailures(brandSource), []);
    assert.equal(existsSync(path.join(root, 'public/assets/finance/tvg-logo-primary.png')), true);
    const tvg = resolveEntityBrand('tvg');
    assert.equal(tvg.complete, true);
    assert.equal(tvg.identityLabel, 'The Vent Guys');
    assert.equal(resolveEntityBrand('bhfos').complete, false);
    assert.match(identity, /data-testid="entity-brand-pending"/);
    assert.match(identity, /data-print-hide="true"/);
    assert.match(identity, /brand\.complete \? null/);
    assert.equal(read('src/lib/finance/reports.js').includes('The Vent Guys'), false);
  });
  it('each brand mutant fails closed', () => {
    const mutants = [
      brandSource.replace("displayName: 'The Vent Guys'", "displayName: 'BHFOS'"),
      brandSource.replace('legalName: null', "legalName: 'The Vent Guys'"),
      brandSource.replace("'/assets/finance/tvg-logo-primary.png'", "'https://vent-guys.com/brand/logo-primary.png'"),
      brandSource.replace("navy: '#173861'", "navy: '#0a56a6'"),
      brandSource.replace("red: '#b52025'", "red: '#2563eb'"),
      brandSource.replace('complete: false', 'complete: true'),
      `${brandSource}\nimport x from '../brandAssets.js';`,
    ];
    for (const mutant of mutants) assert.ok(brandFailures(mutant).length > 0, mutant.slice(-80));
  });
  it('a real pricing report shows 7-digit and 8-digit signed planned prices', () => {
    const inputs = blankPlanInputs();
    inputs.monthly_basis = {};
    inputs.services.residential_dryer_vent.planned_price = -1234567.89;
    inputs.services.duct_12_drop_floor.planned_price = -12345678.89;
    const record = { id: 'p', schema_version: 2, status: 'draft', notes: null, inputs };
    const result = calculatePlan(inputs);
    const view = buildFinanceView({ meta: { label: 'Stored plan', data_class: 'stored' }, inputs }, result, 'stage_2');
    const support = buildDecisionSupport({ view, result, inputs, actuals: [], plans: [record] });
    const packet = buildFinanceReport({
      id: 'pricing-economics',
      support,
      view,
      result,
      inputs,
      record,
      generatedAt: '2026-10-03T12:00:00.000Z',
      dirty: true,
      conflict: false,
    });
    const cells = packet.blocks.find((block) => block.testId === 'report-services').rows.flatMap((row) => row.cells);
    assert.ok(cells.includes('-$1,234,567.89'));
    assert.ok(cells.includes('-$12,345,678.89'));
  });
});

describe('phase H release gate mutants', () => {
  it('the shipped gate fails closed and does not pass the service role to Playwright', () => {
    assert.deepEqual(ciFailures(ciInput), []);
  });
  it('each CI mutant fails closed', () => {
    const mutants = [
      { ...ciInput, yml: yml.replace('permissions:\n      contents: read\n', '') },
      { ...ciInput, yml: yml.replace('actions/checkout@11d5960a326750d5838078e36cf38b85af677262', 'actions/checkout@v4') },
      { ...ciInput, yml: yml.replace('version: 2.119.0', 'version: latest') },
      { ...ciInput, yml: yml.replace('node tools/finance-e2e-report-check.mjs', 'node tools/noop.mjs') },
      { ...ciInput, gate: gate.replace('delete playwrightEnv.SERVICE_ROLE_KEY;', '') },
      { ...ciInput, gate: gate.replace('FINANCE_OWNER_EMAIL: ownerEmail', 'SERVICE_ROLE_KEY: serviceRole') },
      { ...ciInput, check: check.replace('skipped > 0', 'skipped < 0') },
      { ...ciInput, check: check.replace('passed < 5', 'passed < 1') },
      { ...ciInput, gate: gate.replace("hostname === '127.0.0.1'", "value.includes('127.0.0.1')") },
      { ...ciInput, specs: [...specs, 'test.skip(true)'] },
    ];
    for (const mutant of mutants) assert.ok(ciFailures(mutant).length > 0);
  });
  it('preflight names both version 1 and version 2 rows, and the runbook records the TenantGuard limit', () => {
    const preflight = read('docs/finance/MALFORMED_PLAN_PREFLIGHT.md');
    const runbook = read('docs/finance/STAGING_MIGRATION_RUNBOOK.md');
    assert.match(preflight, /schema_version = 2/);
    assert.match(preflight, /schema_version = 1/);
    assert.match(runbook, /same-tenant navigation does not re-run the superuser check/);
    assert.match(runbook, /do not run supabase db reset/);
    assert.match(runbook, /exwochkjngdztrdtxnsa/);
    assert.match(read('src/components/TenantGuard.jsx'), /Same-tenant navigation does not re-run this effect/);
    assert.equal(shell.includes('function share'), false);
  });
});
