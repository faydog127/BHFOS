/**
 * UX-REFACTOR — canonical IA + shell source guards.
 * Run: node --test tests/unit/ux-refactor-nav-ia.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const EXPECTED_PRIMARY = [
  { name: 'Hub', path: '/crm' },
  { name: 'Work Orders', path: '/crm/jobs' },
  { name: 'Quotes', path: '/crm/quotes' },
  { name: 'Inspections', path: '/crm/inspections' },
  { name: 'Analytics', path: '/crm/reporting' },
  { name: 'Settings', path: '/crm/settings' },
];

const TOP5 = [
  'src/pages/crm/CRMHub.jsx',
  'src/pages/crm/Jobs.jsx',
  'src/pages/crm/proposals/ProposalList.jsx',
  'src/pages/crm/Inspections.jsx',
  'src/pages/crm/Settings.jsx',
];

describe('UX-REFACTOR primary nav IA', () => {
  it('crmPrimaryNav declares canonical order and labels', () => {
    const src = read('src/config/crmPrimaryNav.js');
    let cursor = 0;
    for (const item of EXPECTED_PRIMARY) {
      const nameIdx = src.indexOf(`name: '${item.name}'`, cursor);
      assert.ok(nameIdx >= 0, `missing label ${item.name}`);
      const pathIdx = src.indexOf(`path: '${item.path}'`, nameIdx);
      assert.ok(pathIdx >= 0, `missing path ${item.path} after ${item.name}`);
      cursor = pathIdx;
    }
  });

  it('sidebar + layout consume shared nav config', () => {
    assert.match(read('src/components/BHFSidebar.jsx'), /CRM_PRIMARY_NAV/);
    assert.match(read('src/components/BHFSidebar.jsx'), /crm-nav-divider/);
    assert.match(read('src/components/BHFCrmLayout.jsx'), /CRM_MOBILE_BOTTOM_NAV/);
    assert.match(read('src/components/BHFCrmLayout.jsx'), /openSidebar/);
  });

  it('mobile bottom bar uses Hub · Work Orders · Quotes · Invoices · More (UXV2 money parity)', () => {
    const src = read('src/config/crmPrimaryNav.js');
    const mobileBlock = src.slice(src.indexOf('CRM_MOBILE_BOTTOM_NAV'));
    for (const name of ['Hub', 'Work Orders', 'Quotes', 'Invoices', 'More']) {
      assert.ok(mobileBlock.includes(`name: '${name}'`), `mobile missing ${name}`);
    }
  });
});

describe('UX-REFACTOR top-5 chrome', () => {
  it('all top 5 screens use CrmPageHeader', () => {
    for (const file of TOP5) {
      assert.match(read(file), /CrmPageHeader/, file);
    }
  });

  it('Quotes list uses CrmListToolbar for search/filter chrome', () => {
    assert.match(read('src/pages/crm/proposals/ProposalList.jsx'), /CrmListToolbar/);
  });

  it('design token aliases exist', () => {
    const css = read('src/index.css');
    for (const token of ['--surface-page', '--surface-panel', '--nav-active', '--cta']) {
      assert.ok(css.includes(token), `missing token ${token}`);
    }
  });

  it('slice forbids new migrations in A2 commit surface (guard path)', () => {
    // Soft guard: A2 code paths must not import migrate tooling as a runtime dep.
    const a2Files = [
      'src/config/crmPrimaryNav.js',
      'src/components/crm/CrmPageHeader.jsx',
      'src/components/BHFSidebar.jsx',
      'src/components/BHFCrmLayout.jsx',
    ];
    for (const file of a2Files) {
      const src = read(file);
      assert.doesNotMatch(src, /supabase\/migrations|applyMigration/i, file);
    }
  });
});
