/**
 * UXV2_APP_POLISH — source guards for A2 polish track.
 * Run: node --test tests/unit/uxv2-app-polish.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSynthetic, excludeSyntheticRows } from '../../src/lib/excludeSynthetic.js';
import { CRM_PRODUCT_NAME } from '../../src/config/productBrand.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('UXV2 brand + tokens', () => {
  it('locks TVG CRM product name', () => {
    assert.equal(CRM_PRODUCT_NAME, 'TVG CRM');
    assert.match(read('src/components/BHFCrmLayout.jsx'), /CRM_PRODUCT_NAME/);
    assert.doesNotMatch(read('src/components/BHFCrmLayout.jsx'), /BHF CRM/);
  });

  it('foundation tokens remain wired', () => {
    const css = read('src/index.css');
    for (const token of ['--brand-accent', '--font-body', '--nav-active', '--cta']) {
      assert.ok(css.includes(token), `missing ${token}`);
    }
  });
});

describe('UXV2 Hub Today composition', () => {
  it('Hub ships Today hero + KPI toggle (collapsed by default)', () => {
    const hub = read('src/pages/crm/CRMHub.jsx');
    assert.match(hub, /hub-today-hero/);
    assert.match(hub, /showKpis/);
    assert.match(hub, /Show performance KPIs/);
    assert.match(hub, /useState\(false\)/);
  });
});

describe('UXV2 integrity filter', () => {
  it('treats is_legacy as excluded when present', () => {
    assert.equal(isSynthetic({ is_legacy: true, first_name: 'Real' }), true);
    assert.equal(isSynthetic({ first_name: 'Ada', email: 'ada@customer.com' }), false);
  });

  it('money/list call sites consume excludeSyntheticRows', () => {
    for (const file of [
      'src/pages/crm/proposals/ProposalList.jsx',
      'src/pages/crm/FlowConsole.jsx',
      'src/pages/crm/Schedule.jsx',
      'src/pages/crm/Inspections.jsx',
      'src/pages/crm/CRMHub.jsx',
    ]) {
      assert.match(read(file), /excludeSyntheticRows/, file);
    }
    const filtered = excludeSyntheticRows([
      { id: 1, email: 'ok@customer.com' },
      { id: 2, is_legacy: true },
    ]);
    assert.deepEqual(filtered.map((r) => r.id), [1]);
  });
});

describe('UXV2 mobile money parity', () => {
  it('bottom bar includes Invoices one-tap', () => {
    const nav = read('src/config/crmPrimaryNav.js');
    const mobile = nav.slice(nav.indexOf('CRM_MOBILE_BOTTOM_NAV'));
    assert.match(mobile, /name: 'Invoices'/);
    assert.match(mobile, /path: '\/crm\/invoices'/);
  });
});

describe('UXV2 Inspections toolbar', () => {
  it('search lives in CrmListToolbar not a Search card', () => {
    const src = read('src/pages/crm/Inspections.jsx');
    assert.match(src, /CrmListToolbar/);
    assert.doesNotMatch(src, /CardTitle className="text-base">Search</);
  });
});
