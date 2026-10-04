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
    assert.match(source, /\}, \[session, authLoading, urlTenant\]\);/);
    assert.equal(/\}, \[session, authLoading, urlTenant, navigate\]\);/.test(source), false);
    assert.equal(/location\]\);/.test(source), false);
    assert.match(source, /navigateRef/);
    assert.match(source, /verifiedFor/);
    assert.match(source, /keepMounted/);
    assert.match(source, /check_is_superuser/);
    assert.match(source, /jwtTenant !== urlTenant/);
  });

  it('leaving Finance asks to stay or discard and does not save', () => {
    const shell = read('src/pages/finance/FinanceShell.jsx');
    assert.match(shell, /data-testid="finance-leave-stay"/);
    assert.equal(shell.includes('finance-leave-cancel'), false);
    assert.match(shell, /role="alertdialog"/);
    assert.match(shell, /aria-labelledby="finance-leave-title"/);
    assert.match(shell, /event\.key === 'Escape'/);
    assert.match(shell, /popstate/);
    assert.match(shell, /history\.pushState/);
    assert.match(shell, /history\.replaceState/);
    assert.match(shell, /data-testid="finance-leave-discard"/);
    assert.match(shell, /Nothing is saved automatically/);
    assert.match(shell, /data-testid="finance-unsaved-held"/);
    const reportsScreen = read('src/pages/finance/FinanceReports.jsx');
    assert.match(reportsScreen, /const liveNotice = screenNote\(dirty, conflict\)/);
    assert.match(reportsScreen, /data-testid="finance-report-notice">\{liveNotice\}/);
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
    assert.equal(brand.identityLabel, 'The Vent Guys');
    assert.equal(brand.displayName, 'The Vent Guys');
    assert.equal(brand.legalName, null);
    assert.equal(brand.logoUrl, '/assets/finance/tvg-logo-primary.png');
    assert.equal(brand.logoUrl.startsWith('http'), false);
    assert.equal(brand.colors.navy, '#173861');
    assert.equal(brand.colors.red, '#b52025');
    assert.equal(brand.complete, true);
    assert.equal(brand.contact.email, 'info@vent-guys.com');
    assert.ok(ENTITY_BRAND_MISSING_INPUTS.length >= 4);
    const blackHorse = resolveEntityBrand('bhfos');
    assert.equal(blackHorse.identityLabel, 'BHFOS');
    assert.equal(blackHorse.complete, false);
    assert.equal(blackHorse.logoUrl, null);
    assert.equal(blackHorse.colors, null);
  });
});
