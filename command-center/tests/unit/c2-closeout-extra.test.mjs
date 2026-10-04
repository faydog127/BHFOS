/**
 * Stage C2 closeout coverage for the conflict copy and the Check-In viewport.
 * These tests run under test:finance.
 * They guard the Reload height, the dirty and clean conflict sentences,
 * and the classes that keep the wide Check-In table inside the viewport.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const shell = read('src/pages/finance/FinanceShell.jsx');
const checkin = read('src/pages/finance/MonthlyCheckIn.jsx');
const block = (src, testId) => {
  const at = src.indexOf(`data-testid="${testId}"`);
  assert.ok(at > 0, `${testId} exists`);
  return src.slice(src.lastIndexOf('<div', at), src.indexOf('</div>', at) + 6);
};

describe('C2 closeout extra: conflict copy follows dirty, in both places', () => {
  it('read-only banner: conflict && dirty keeps-edits copy; conflict && clean reload copy', () => {
    const b = block(shell, 'finance-unsaved-in-readonly-mode');
    assert.match(b, /conflict\s*\?\s*\(dirty\s*\?\s*'Changed elsewhere\. Your unsaved edits are kept in Guided\. These figures include them\.'\s*:\s*'Changed elsewhere\. Return to Guided to reload the latest plan\.'\)\s*:\s*'These figures include unsaved edits\. Return to Guided to save or discard them\.'/);
  });

  it('Guided conflict box: dirty keeps-edits copy; clean replace-screen copy; Reload is 44px', () => {
    const b = block(shell, 'finance-version-conflict');
    assert.match(b, /\{dirty\s*\?\s*'Changed elsewhere\. Your unsaved edits are still on this screen\.'\s*:\s*'Changed elsewhere\. Reload to replace this screen with the latest plan\.'\}/);
    assert.match(b, /className="[^"]*min-h-11[^"]*"\s+data-testid="finance-reload"/);
  });

  it('no unconditional "unsaved edits" string sits inside a conflict branch', () => {
    for (const id of ['finance-unsaved-in-readonly-mode', 'finance-version-conflict']) {
      const b = block(shell, id);
      for (const m of b.matchAll(/'[^']*unsaved edits[^']*'/g)) {
        const before = b.slice(0, m.index);
        assert.match(before, /dirty\s*\?\s*$|\?\s*\(dirty\s*\?\s*$|:\s*$|\?\s*$/, `${id}: unsaved-edits copy must be inside a dirty branch`);
      }
    }
  });
});

describe('C2 closeout extra: Check-In stays inside the viewport (390px)', () => {
  it('every flex/grid ancestor of the wide table can shrink, and only the table wrapper scrolls', () => {
    assert.match(shell, /<div className="min-w-0 lg:grid lg:grid-cols-\[240px_minmax\(0,1fr\)\]">/);
    assert.match(shell, /<main className="min-w-0 px-4 py-6 lg:px-8">/);
    assert.match(checkin, /<div className="min-w-0 space-y-4" data-testid="finance-checkin">/);
    assert.match(checkin, /<div className="grid min-w-0 gap-4 lg:grid-cols-\[240px_minmax\(0,1fr\)\]">/);
    assert.match(checkin, /<aside className="min-w-0 [^"]*" data-testid="checkin-history">/);
    assert.match(checkin, /<form\s+className="min-w-0 space-y-4[^"]*"\s+data-testid="checkin-entry"/);
    assert.match(checkin, /<div className="min-w-0 overflow-x-auto">\s*<table className="min-w-full text-sm">/);
  });

  it('nothing is clipped or hidden: no overflow-hidden / overflow-x-hidden on the shell or Check-In', () => {
    for (const src of [shell, checkin]) {
      assert.equal(/overflow-hidden|overflow-x-hidden|overflow-clip/.test(src), false);
    }
  });
});
