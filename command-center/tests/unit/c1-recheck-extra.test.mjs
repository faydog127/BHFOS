// Proposed extra asserts for Stage C1 recheck. Kills the mutants that survive the adopted tests
// (F1d,F1e,F1f,F3a,F3b,F3c,F3e,F3f,F3g,F3h). Source-level; the rendered proof is in /workspace/pr164/proposed/render-harness.
// N1: ".5" is no longer junk. It commits as 0.5. The other reject cases stay.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blankPlanInputs } from '../../src/lib/finance/blankPlan.js';
import { basisAmountDraft, typeBasisAmount } from '../../src/lib/finance/actuals.js';
import { STORED_PLAN_INVALID_COPY, storedPlanDecision } from '../../src/lib/finance/persistence.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shell = readFileSync(process.env.FS || path.join(root, 'src/pages/finance/FinanceShell.jsx'), 'utf8');
const blank = () => blankPlanInputs();

describe('stored plan load guard (extra)', () => {
  it('accepts valid v1 and valid v2 docs, rejects every malformed shape', () => {
    assert.equal(storedPlanDecision({ schema_version: 1, inputs: blank() }).ok, true);
    assert.equal(storedPlanDecision({ schema_version: 2, inputs: { ...blank(), monthly_basis: {} } }).ok, true);
    assert.equal(storedPlanDecision({ schema_version: 2, inputs: { ...blank(), monthly_basis: { '2026-02-01': { total_revenue: 10.5 } } } }).ok, true);
    const noStages = blank(); delete noStages.stages;
    const bad = [
      { schema_version: 2, inputs: { monthly_basis: {} } },
      { schema_version: 2, inputs: { ...noStages, monthly_basis: {} } },
      { schema_version: 2, inputs: blank() },
      { schema_version: 1, inputs: { ...blank(), monthly_basis: {} } },
      { schema_version: 1, inputs: null }, { schema_version: 1, inputs: 'x' }, { schema_version: 1, inputs: [] },
      { schema_version: 1, inputs: {} }, { schema_version: 3, inputs: blank() }, { schema_version: null, inputs: blank() },
      { schema_version: 2, inputs: { ...blank(), monthly_basis: null } },
      { schema_version: 2, inputs: { ...blank(), monthly_basis: { '2026-02-01': { total_revenue: '10' } } } },
      { schema_version: 1, inputs: { ...blank(), stages: null } },
    ];
    for (const plan of bad) {
      const d = storedPlanDecision(plan);
      assert.equal(d.ok, false, JSON.stringify(plan).slice(0, 80));
      assert.equal(d.code, 'finance_schema_unsupported');
    }
    assert.equal(storedPlanDecision(null).ok, true);
  });
  it('failed load clears the record and maps the code to the repair copy', () => {
    const apply = shell.slice(shell.indexOf('function applyPlan'), shell.indexOf('async function refreshPlans'));
    const fail = apply.slice(apply.indexOf('if (!decision.ok) {'), apply.indexOf('return;'));
    for (const call of ['setRecord(null)', 'setInputs(null)', 'setApprovedBasis(null)', 'setDirty(false)']) assert.ok(fail.includes(call), call);
    assert.match(shell, /function loadErrorCopy\(code\) \{\s*if \(code === 'finance_schema_unsupported'\) return STORED_PLAN_INVALID_COPY;/);
    assert.equal(STORED_PLAN_INVALID_COPY, 'A stored plan failed validation. An administrator must repair the draft.');
  });
});

describe('monthly basis amount text (extra)', () => {
  it('classifies typed text and never turns blank or junk into zero', () => {
    assert.deepEqual(basisAmountDraft(''), { text: '', commit: 'clear', value: null });
    assert.deepEqual(basisAmountDraft('  '), { text: '', commit: 'clear', value: null });
    assert.equal(basisAmountDraft('0').value, 0);
    assert.equal(basisAmountDraft('0').commit, 'set');
    assert.equal(basisAmountDraft('10.').commit, 'hold');
    assert.equal(Object.prototype.hasOwnProperty.call(basisAmountDraft('10.'), 'value'), false);
    assert.equal(basisAmountDraft('10.50').value, 10.5);
    for (const junk of ['-', '-1', 'abc', '1e3', '10.555', '1,000', ' 12', '10.5.', '+1']) {
      assert.equal(basisAmountDraft(junk).commit, 'reject', junk);
      assert.deepEqual(typeBasisAmount('7', junk), { text: '7', commit: 'reject' }, junk);
    }
  });
  it('typing or pasting a leading decimal commits half a unit, and a trailing point still resolves', () => {
    function typeSequence(chars) {
      let text = '';
      let value = null;
      const seen = [];
      for (const ch of chars) {
        const next = typeBasisAmount(text, text + ch);
        assert.notEqual(next.commit, 'reject');
        text = next.text;
        seen.push(text);
        if (next.commit === 'set') value = next.value;
      }
      return { text, value, seen };
    }
    const typed = typeSequence('.5');
    assert.deepEqual(typed.seen, ['.', '.5']);
    assert.equal(typed.text, '.5');
    assert.equal(typed.value, 0.5);
    assert.equal(typed.seen.includes('5'), false);
    const pasted = typeBasisAmount('', '.5');
    assert.equal(pasted.commit, 'set');
    assert.equal(pasted.text, '.5');
    assert.equal(pasted.value, 0.5);
    const pastedCents = typeBasisAmount('', '.50');
    assert.equal(pastedCents.commit, 'set');
    assert.equal(pastedCents.text, '.50');
    assert.equal(pastedCents.value, 0.5);
    assert.equal(basisAmountDraft('0.').commit, 'hold');
    assert.equal(basisAmountDraft('12.').commit, 'hold');
    assert.equal(basisAmountDraft('.').commit, 'hold');
    assert.equal('0.'.slice(0, -1), '0');
    assert.equal('12.'.slice(0, -1), '12');
    assert.equal(Number('0.'.slice(0, -1)), 0);
    assert.equal(Number('12.'.slice(0, -1)), 12);
    assert.match(shell, /if \(text === '\.'\) onPatch\(month, key, ''\)/);
    const patch = shell.slice(shell.indexOf('function patchMonthlyBasis'), shell.indexOf('async function onUpgradeSchema'));
    assert.match(patch, /\^\\\.\\d\{1,2\}\$/);
  });
  it('shell: reject returns before state, blank clears, blur commits a trailing point, blank never writes zero', () => {
    assert.match(shell, /if \(decision\.commit === 'reject'\) return;\s*setDraft/);
    assert.match(shell, /onPatch\(month, key, decision\.commit === 'clear' \? '' : decision\.text\)/);
    assert.match(shell, /if \(\/\^\\d\+\\\.\$\/\.test\(text\)\) onPatch\(month, key, text\.slice\(0, -1\)\)/);
    const patch = shell.slice(shell.indexOf('function patchMonthlyBasis'), shell.indexOf('async function onUpgradeSchema'));
    assert.match(patch, /if \(String\(raw\)\.trim\(\) === ''\) \{\s*delete row\[key\];/);
    assert.equal(/row\[key\] = 0/.test(patch), false);
  });
});
