import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dashboard = readFileSync(process.env.AD || path.join(root, 'src/pages/crm/AnalyticsDashboard.jsx'), 'utf8');

describe('business analytics: no inferred or fabricated figures (structural)', () => {
  it('every trend/trendValue is null / NOT_CONNECTED', () => {
    for (const m of dashboard.matchAll(/\btrend=\{([^}]*)\}/g)) assert.equal(m[1].trim(), 'null', `trend=${m[1]}`);
    for (const m of dashboard.matchAll(/\btrendValue=(\{[^}]*\}|"[^"]*")/g)) assert.equal(m[1], '{NOT_CONNECTED}', `trendValue=${m[1]}`);
  });
  it('unsupported cards and no growth/rating/sentiment/score state', () => {
    assert.match(dashboard, /title="Avg Rating"\s+value=\{NOT_CONNECTED\}\s+subtext=\{NOT_CONNECTED\}/);
    assert.match(dashboard, /Average duration: \$\{NOT_CONNECTED\}/);
    for (const k of ['growth', 'avgRating', 'avgDuration', 'healthScore', 'sentiment:', 'repeatRate', 'targetRevenue', 'benchmark', 'grossMargin']) {
      assert.equal(new RegExp(k, 'i').test(dashboard.replace(/data-testid="analytics-sentiment"/, '')), false, k);
    }
  });
  it('no numeric literal rendered as text (percent/minute/decimal rating) and no constant arrays of numbers', () => {
    assert.equal(/(subtext|trendValue|description|title)=\{?["'`][^"'`]*\d+(\.\d+)?\s*(%|m\b| reviews)/.test(dashboard), false);
    assert.equal(/>\s*[+-]?\d+(\.\d+)?\s*(%|m\b| reviews)\s*</.test(dashboard), false);
    assert.equal(/\bvalue:\s*\d/.test(dashboard.replace(/name: '[^']*', value: (jobsCount|appointments)/g, '')), false);
  });
});
