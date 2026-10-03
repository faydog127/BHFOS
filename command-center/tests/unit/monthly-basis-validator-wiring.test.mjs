// Proposed Stage C1 follow-up: closes JS validator branches and component wiring that no CI test covers.
// Place in tests/unit/ and add to test:finance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { validateMonthlyBasis, plannedFactsForMonth, comparisonPlanForCheckin } from '../../src/lib/finance/actuals.js';
import { validatePlanInputs, blankPlanInputs } from '../../src/lib/finance/blankPlan.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const checkin = readFileSync(path.join(root, 'src/pages/finance/MonthlyCheckIn.jsx'), 'utf8');
const shell = readFileSync(path.join(root, 'src/pages/finance/FinanceShell.jsx'), 'utf8');
const M = '2026-02-01';
const bad = (basis) => assert.equal(validateMonthlyBasis(basis).ok, false, JSON.stringify(basis));
const good = (basis) => assert.equal(validateMonthlyBasis(basis).ok, true, JSON.stringify(basis));

describe('validateMonthlyBasis mirrors the database check', () => {
  it('rejects wrong types and ranges', () => {
    bad([]); bad('x'); bad(null); bad(1);
    bad({ [M]: [] }); bad({ [M]: null });
    bad({ [M]: { total_revenue: -1 } });
    bad({ [M]: { total_jobs: -1 } });
    bad({ [M]: { total_revenue: '10' } });
    bad({ [M]: { total_revenue: true } });
    bad({ [M]: { total_revenue: [1] } });
    bad({ [M]: { total_revenue: { v: 1 } } });
    bad({ [M]: { total_revenue: Number.NaN } });
    bad({ [M]: { total_revenue: Number.POSITIVE_INFINITY } });
    bad({ [M]: { total_revenue: 10.005 } });
    bad({ [M]: { total_jobs: 1.5 } });
    bad({ [M]: { total_revenue: 1e12 } });
    bad({ '2026-02-15': {} }); bad({ '2026-13-01': {} }); bad({ '2026-02': {} });
    bad({ '0000-01-01': { total_revenue: 1 } });
    bad({ [M]: { total_revenue: -0 } });
    good({ [M]: { total_revenue: 1234567.89 } });
    bad({ [M]: { total_revenue: 1234567.891 } });
    bad({ [M]: { bogus: 1 } });
  });
  it('rejects amounts of 21 or more whole digits like the database (FAILS on 60773aa: finding F2)', () => {
    bad({ [M]: { total_revenue: 1e21 } });
    bad({ [M]: { productive_unit_hours: 1e30 } });
  });
  it('accepts null, zero, and partial months', () => {
    good({}); good({ [M]: {} }); good({ [M]: { total_revenue: null } }); good({ [M]: { total_revenue: 0, total_jobs: 0 } });
  });
  it('enforces channel integrity', () => {
    bad({ [M]: { total_revenue: 10, portal_revenue: 11 } });
    bad({ [M]: { total_revenue: 10, direct_residential_revenue: 3, commercial_direct_revenue: 3, portal_revenue: 3 } });
    bad({ [M]: { direct_residential_revenue: 3, commercial_direct_revenue: 3, portal_revenue: 3 } });
    good({ [M]: { total_revenue: 9, direct_residential_revenue: 3, commercial_direct_revenue: 3, portal_revenue: 3 } });
  });
  it('validatePlanInputs gates version 1 and version 2 documents', () => {
    const doc = blankPlanInputs();
    assert.equal(validatePlanInputs({ ...doc, monthly_basis: {} }, 1).ok, false);
    assert.equal(validatePlanInputs(doc, 2).ok, false);
    assert.equal(validatePlanInputs({ ...doc, monthly_basis: {} }, 2).ok, true);
    assert.equal(validatePlanInputs({ ...doc, monthly_basis: [] }, 2).ok, false);
    assert.equal(validatePlanInputs(doc, 3).ok, false);
  });
  it('plannedFacts: v1 is null, null stays null, zero stays zero, other months blank', () => {
    assert.equal(plannedFactsForMonth({ schema_version: 1, inputs: {} }, M), null);
    const plan = { schema_version: 2, inputs: { monthly_basis: { [M]: { total_revenue: 0, total_jobs: null } } } };
    const f = plannedFactsForMonth(plan, M);
    assert.equal(f.total_revenue, 0); assert.equal(f.total_jobs, null); assert.equal(f.cash_reserve, null);
    assert.equal(plannedFactsForMonth(plan, '2026-03').total_revenue, null);
    const hist = { id: 'old', schema_version: 2, inputs: { monthly_basis: {} } };
    assert.equal(comparisonPlanForCheckin({ selected: { comparison_plan_id: 'old' }, plans: [hist, { id: 'new' }], approved: { id: 'new', status: 'approved' }, associateOnCreate: true }), hist);
    assert.equal(comparisonPlanForCheckin({ selected: { comparison_plan_id: 'gone' }, plans: [], approved: { id: 'new', status: 'approved' } }), null);
  });
});

describe('check-in and shell wiring (source level; Playwright is not in CI)', () => {
  it('Plan and Variance come from the comparison plan and never default null to zero', () => {
    assert.match(checkin, /comparisonPlanForCheckin\(\{ selected, plans, approved, associateOnCreate \}\)/);
    assert.match(checkin, /plannedFactsForMonth\(basisPlan, monthKey\)/);
    assert.equal(/plannedFactsForMonth\(approved/.test(checkin), false);
    assert.match(checkin, /const planValue = planned \? planned\[field\.key\] : null;/);
    assert.equal(/planValue\s*\?\?\s*0/.test(checkin), false);
    assert.match(checkin, /planValue === null \|\| planValue === undefined \? null : Number\(planValue\)/);
  });
  it('shell passes the record schema version on save and gates the upgrade to v1 drafts', () => {
    assert.match(shell, /schemaVersion: record\.schema_version/);
    assert.match(shell, /record\.status !== 'draft' \|\| record\.schema_version !== FINANCE_PLAN_SCHEMA_WITHOUT_MONTHLY_BASIS\) return;/);
    assert.match(shell, /record\.status === 'draft' && record\.schema_version === FINANCE_PLAN_SCHEMA_WITHOUT_MONTHLY_BASIS/);
    assert.match(shell, /planHasMonthlyBasis\(record\?\.schema_version\) && record\.status === 'draft' && section === 'overview'/);
  });
});
