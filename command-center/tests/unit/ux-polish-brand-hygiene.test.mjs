/**
 * UX-POLISH — brand, exclude helper, and chrome source guards.
 * Run: node --test tests/unit/ux-polish-brand-hygiene.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isSynthetic,
  excludeSyntheticRows,
} from '../../src/lib/excludeSynthetic.js';
import { CRM_PRODUCT_NAME } from '../../src/config/productBrand.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const HEADER_SCREENS = [
  'src/pages/crm/Leads.jsx',
  'src/pages/crm/CallConsole.jsx',
  'src/pages/crm/appointments/AppointmentScheduler.jsx',
  'src/pages/crm/Schedule.jsx',
  'src/pages/crm/Invoices.jsx',
];

const SHELL_BRAND_FILES = [
  'src/components/BHFCrmLayout.jsx',
  'src/components/BHFSidebar.jsx',
  'src/config/productBrand.js',
];

describe('UX-POLISH product brand', () => {
  it('locks CRM_PRODUCT_NAME to TVG CRM', () => {
    assert.equal(CRM_PRODUCT_NAME, 'TVG CRM');
  });

  it('shell components do not show BHF CRM', () => {
    for (const file of SHELL_BRAND_FILES) {
      assert.doesNotMatch(read(file), /BHF CRM/, file);
    }
  });

  it('layout and sidebar consume CRM_PRODUCT_NAME or TVG CRM', () => {
    assert.match(read('src/config/productBrand.js'), /TVG CRM/);
    assert.match(read('src/components/BHFCrmLayout.jsx'), /CRM_PRODUCT_NAME/);
    assert.match(read('src/components/BHFSidebar.jsx'), /CRM_PRODUCT_NAME/);
  });
});

describe('UX-POLISH brand tokens', () => {
  it('defines --brand-* and wires body font', () => {
    const css = read('src/index.css');
    for (const token of ['--brand-primary', '--brand-accent', '--font-body']) {
      assert.ok(css.includes(token), `missing ${token}`);
    }
    assert.match(css, /font-family:\s*var\(--font-body\)/);
  });
});

describe('UX-POLISH CrmPageHeader coverage', () => {
  it('office screens use CrmPageHeader', () => {
    for (const file of HEADER_SCREENS) {
      assert.match(read(file), /CrmPageHeader/, file);
    }
  });
});

describe('UX-POLISH excludeSynthetic helper', () => {
  it('flags is_test_data and known synth patterns', () => {
    assert.equal(isSynthetic({ is_test_data: true }), true);
    assert.equal(isSynthetic({ email: 'demo@example.com' }), true);
    assert.equal(isSynthetic({ first_name: 'SYNTH Lead', last_name: 'Demo' }), true);
    assert.equal(isSynthetic({ title: 'TVG Release Synthetic invoice' }), true);
    assert.equal(isSynthetic({ first_name: 'Ada', last_name: 'Lovelace', email: 'ada@realcustomer.com' }), false);
  });

  it('live mode excludes synth; training mode keeps synth-ish rows', () => {
    const rows = [
      { id: 1, first_name: 'Ada', email: 'ada@realcustomer.com' },
      { id: 2, is_test_data: true, first_name: 'Test' },
      { id: 3, email: 'x@example.invalid' },
    ];
    const live = excludeSyntheticRows(rows, { trainingMode: false });
    assert.deepEqual(live.map((r) => r.id), [1]);

    const training = excludeSyntheticRows(rows, { trainingMode: true });
    assert.deepEqual(training.map((r) => r.id), [2, 3]);
  });
});

describe('UX-POLISH copy + night mode', () => {
  it('Quotes filter uses Accepted vocabulary', () => {
    assert.match(read('src/pages/crm/proposals/ProposalList.jsx'), /label: 'Accepted'/);
    assert.doesNotMatch(
      read('src/pages/crm/proposals/ProposalList.jsx'),
      /value: 'accepted',\s*label: 'Approved'/,
    );
  });

  it('kanban after-hours badge is After hours, not Night Mode', () => {
    const src = read('src/lib/kanbanUtils.js');
    assert.match(src, /After hours/);
    assert.doesNotMatch(src, /Night Mode/);
  });
});
