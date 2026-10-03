/**
 * Pre-staging hardening locks. These tests run under test:finance.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ENTITY_BRAND_MISSING_INPUTS, resolveEntityBrand } from '../../src/lib/finance/entityBrand.js';
import {
  FINANCE_MONTHLY_BASIS_SCHEMA,
  FINANCE_PLAN_SCHEMA_WITHOUT_MONTHLY_BASIS,
  FINANCE_SUPPORTED_PLAN_SCHEMAS,
  isSupportedPlanSchema,
  planHasMonthlyBasis,
} from '../../src/lib/finance/schemaContract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

describe('pre-staging hardening: navigation, brand, schema', () => {
  it('TenantGuard re-checks session and tenant, not every same-tenant location change', () => {
    const source = read('src/components/TenantGuard.jsx');
    assert.match(source, /\}, \[session, authLoading, urlTenant, navigate\]\);/);
    assert.equal(/\}, \[session, authLoading, urlTenant, navigate, location\]\);/.test(source), false);
    assert.match(source, /check_is_superuser/);
    assert.match(source, /jwtTenant !== urlTenant/);
  });

  it('leaving Finance asks to stay, cancel, or discard and does not save', () => {
    const shell = read('src/pages/finance/FinanceShell.jsx');
    assert.match(shell, /data-testid="finance-leave-stay"/);
    assert.match(shell, /data-testid="finance-leave-cancel"/);
    assert.match(shell, /data-testid="finance-leave-discard"/);
    assert.match(shell, /Nothing is saved automatically/);
    assert.equal(shell.includes('function share'), false);
    assert.equal(shell.includes('Share of required revenue'), false);
    assert.match(shell, /presentLabel\(view\.utilizationBand\)/);
  });

  it('the schema contract is the only monthly-basis version gate', () => {
    assert.deepEqual([...FINANCE_SUPPORTED_PLAN_SCHEMAS], [1, 2]);
    assert.equal(FINANCE_PLAN_SCHEMA_WITHOUT_MONTHLY_BASIS, 1);
    assert.equal(FINANCE_MONTHLY_BASIS_SCHEMA, 2);
    assert.equal(isSupportedPlanSchema(1), true);
    assert.equal(isSupportedPlanSchema(2), true);
    assert.equal(isSupportedPlanSchema(3), false);
    assert.equal(planHasMonthlyBasis(1), false);
    assert.equal(planHasMonthlyBasis(2), true);
    const reports = read('src/lib/finance/reports.js');
    assert.equal(/record\.schema_version !== 2/.test(reports), false);
    assert.match(reports, /planHasMonthlyBasis\(record\.schema_version\)/);
  });

  it('report components do not hard-code an entity mark or the eight-way brand fork', () => {
    const reports = read('src/lib/finance/reports.js');
    const screen = read('src/pages/finance/FinanceReports.jsx');
    assert.equal(reports.includes('The Vent Guys'), false);
    assert.equal(screen.includes('The Vent Guys'), false);
    assert.equal(reports.includes('brandAssets'), false);
    assert.equal(screen.includes('brandAssets'), false);
    assert.equal((screen.match(/EntityBrandIdentity/g) || []).length >= 2, true);
    const brand = resolveEntityBrand('tvg');
    assert.equal(brand.identityLabel, 'BHFOS');
    assert.equal(brand.logoUrl, null);
    assert.equal(brand.colors, null);
    assert.equal(brand.complete, false);
    assert.ok(ENTITY_BRAND_MISSING_INPUTS.length >= 4);
    const blackHorse = resolveEntityBrand('bhfos');
    assert.equal(blackHorse.logoUrl, null);
    assert.equal(blackHorse.colors, null);
  });
});
