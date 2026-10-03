// Proposed Stage C1 follow-up: structural wiring asserts for AnalyticsDashboard failure states.
// Source-level (no render), same style as l4-wiring-asserts.test.mjs. Place in tests/unit/ and add to test:finance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(path.join(root, 'src/pages/crm/AnalyticsDashboard.jsx'), 'utf8');

describe('AnalyticsDashboard failure-state wiring', () => {
  it('reads every query through queryRows and prices through summarizeScheduledPrices', () => {
    assert.match(src, /import \{[^}]*queryRows[^}]*\} from '@\/lib\/crm\/analyticsIntegrity'/);
    assert.match(src, /import \{[^}]*summarizeScheduledPrices[^}]*\} from '@\/lib\/crm\/analyticsIntegrity'/);
    for (const table of ['appointments', 'leads', 'referrals']) {
      assert.match(src, new RegExp(`queryRows\\(await supabase\\s*\\.from\\('${table}'\\)`), `${table} query is wrapped by queryRows`);
    }
    assert.match(src, /summarizeScheduledPrices\(completedJobs\)/);
    assert.match(src, /completedJobs = appointmentResult\.ok \? appointmentResult\.rows\.filter/);
    assert.equal(/(Result)\.ok\s*=[^=]/.test(src), false, 'a query result flag is never overwritten');
    assert.equal(/const \{ data: (appointments|leads|referrals) \}/.test(src), false);
  });
  it('never coerces a missing price or count to zero', () => {
    assert.equal(/pricing_snapshot\??\.price\s*\|\|\s*0/.test(src), false);
    assert.equal(/metrics\.(revenue\.total|jobs\.count|leads\.total)\s*\|\|\s*0/.test(src), false);
    assert.equal(/\(metrics\.revenue\.total\s*\|\|\s*0\)/.test(src), false);
  });
  it('gates each card and chart on an ok state', () => {
    assert.match(src, /metrics\.revenue\.state === 'ok' \? `\$\$\{metrics\.revenue\.total\.toLocaleString\(\)\}` : NOT_CONNECTED/);
    assert.match(src, /metrics\.jobs\.state === 'ok' \? metrics\.jobs\.count : NOT_CONNECTED/);
    assert.match(src, /metrics\.leads\.state === 'ok' \? metrics\.leads\.total : NOT_CONNECTED/);
    assert.match(src, /\{metrics\.revenue\.state === 'ok' \? \(\s*<ResponsiveContainer/);
    assert.match(src, /metrics\.jobs\.state !== 'ok' \? \(/);
    assert.match(src, /metrics\.referrals\.state !== 'ok' \? \(/);
    assert.match(src, /state: !appointmentResult\.ok \? 'unavailable' : \(prices\.ok \? 'ok' : 'incomplete'\)/);
  });
  it('catch resets every metric to unavailable and clears the charts', () => {
    const catchBlock = src.match(/\} catch \(error\) \{[\s\S]*?\} finally/)?.[0] ?? '';
    for (const k of ['revenue', 'jobs', 'leads', 'referrals']) assert.match(catchBlock, new RegExp(`${k}: \\{[^}]*state: 'unavailable'`));
    assert.match(catchBlock, /setCharts\(\{ revenueTrend: \[\], partnerPerformance: \[\], jobsByStatus: \[\] \}\)/);
    assert.equal(/console\./.test(catchBlock), false);
  });
  it('blocks export unless the price series is ok', () => {
    assert.match(src, /handleExport = \(\) => \{\s*if \(metrics\.revenue\.state !== 'ok'\) \{/);
  });
  it('keeps the label, neutral style, retired conversion rate, and unavailable invoiced/cash', () => {
    assert.match(src, /subtext="Scheduled appointment price — not earned operating revenue\."/);
    assert.match(src, /color="slate"/);
    assert.equal(/color="(green|emerald)"/.test(src), false);
    assert.equal(/Conv\.? ?[Rr]ate/.test(src), false);
    assert.equal(/conversionRate/.test(src), false);
    assert.match(src, /Invoiced amount: \{NOT_CONNECTED\}\. Cash collected: \{NOT_CONNECTED\}\./);
  });
});
