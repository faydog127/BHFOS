/* eslint-disable testing-library/prefer-screen-queries */
/**
 * UX-REFACTOR shell/nav source smoke (no live auth required).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const TOP5 = [
  'src/pages/crm/CRMHub.jsx',
  'src/pages/crm/Jobs.jsx',
  'src/pages/crm/proposals/ProposalList.jsx',
  'src/pages/crm/Inspections.jsx',
  'src/pages/crm/Settings.jsx',
];

test('primary nav IA matches ratified Hub→Settings order', async () => {
  const src = read('src/config/crmPrimaryNav.js');
  const order = [
    "name: 'Hub'",
    "name: 'Work Orders'",
    "name: 'Quotes'",
    "name: 'Inspections'",
    "name: 'Analytics'",
    "name: 'Settings'",
  ];
  let cursor = 0;
  for (const needle of order) {
    const idx = src.indexOf(needle, cursor);
    expect(idx, needle).toBeGreaterThanOrEqual(0);
    cursor = idx;
  }
});

test('shell wires shared nav + top 5 headers', async () => {
  expect(read('src/components/BHFSidebar.jsx')).toContain('CRM_PRIMARY_NAV');
  expect(read('src/components/BHFCrmLayout.jsx')).toContain('CRM_MOBILE_BOTTOM_NAV');
  for (const file of TOP5) {
    expect(read(file), file).toContain('CrmPageHeader');
  }
});

test('semantic tokens are defined for shell consumption', async () => {
  const css = read('src/index.css');
  expect(css).toContain('--nav-active');
  expect(css).toContain('--cta');
  expect(css).toContain('--surface-page');
});
