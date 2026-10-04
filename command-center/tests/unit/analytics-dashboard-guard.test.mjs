/**
 * Business Analytics must not present fabricated measurements.
 * Run with: npm run test:finance
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dashboard = readFileSync(path.join(root, 'src/pages/crm/AnalyticsDashboard.jsx'), 'utf8');
const reporting = readFileSync(path.join(root, 'src/pages/crm/Reporting.jsx'), 'utf8');

describe('business analytics hard-coded retirement', () => {
  it('keeps Reporting as a wrapper and drops fabricated measurements', () => {
    assert.match(reporting, /AnalyticsDashboard/);
    assert.match(dashboard, /unavailable \/ not connected/);
    assert.match(dashboard, /Scheduled appointment price — not earned operating revenue/);
    assert.equal(dashboard.includes('color="green"'), false);
    assert.equal(dashboard.includes('Conv. Rate'), false);
    assert.equal(dashboard.includes('pricing_snapshot?.price || 0'), false);
    assert.match(dashboard, /Scheduled appointment price/);
    assert.equal(dashboard.includes('Total Revenue'), false);
    for (const fabricated of ['12.5', '4.8', '+8%', '-2.5%', '75m', '+0.2', 'healthScore', '1250', 'repeatRate']) {
      assert.equal(dashboard.includes(fabricated), false, fabricated);
    }
    assert.equal(dashboard.includes('Promoter'), false);
    assert.equal(dashboard.includes('Detractor'), false);
    assert.match(dashboard, /from\('appointments'\)/);
    assert.match(dashboard, /from\('leads'\)/);
    assert.match(dashboard, /from\('referrals'\)/);
  });
});