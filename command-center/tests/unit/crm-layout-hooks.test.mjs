/**
 * CRM layout hook-order contract.
 * A creator-access early return that ran before useMemo crashed staff Hub with
 * "Rendered more hooks than during the previous render."
 * Run: node --test tests/unit/crm-layout-hooks.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const layoutSrc = fs.readFileSync(
  path.join(root, 'src/components/BHFCrmLayout.jsx'),
  'utf8',
);
const appSrc = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');

const HOOK_RE = /\buse(?:State|Effect|Memo|Callback|Ref|Context|LayoutEffect|ImperativeHandle)\s*\(/g;

describe('BHFCrmLayout creator-access gate hook order', () => {
  it('still gates creators away from CRM chrome', () => {
    assert.match(layoutSrc, /accessGate === 'checking'/);
    assert.match(layoutSrc, /accessGate === 'creator'/);
    assert.match(layoutSrc, /Navigate to="\/creator"/);
    assert.match(layoutSrc, /fetchMilRole/);
  });

  it('declares all React hooks before any accessGate early return', () => {
    const gateIdx = layoutSrc.search(/if \(accessGate === '/);
    assert.ok(gateIdx > 0, 'expected an accessGate early return');

    const before = layoutSrc.slice(0, gateIdx);
    const after = layoutSrc.slice(gateIdx);
    const hooksBefore = [...before.matchAll(HOOK_RE)].map((m) => m[0]);
    const hooksAfter = [...after.matchAll(HOOK_RE)].map((m) => m[0]);

    assert.ok(hooksBefore.includes('useMemo('), 'useMemo must run before accessGate returns');
    assert.equal(
      hooksAfter.length,
      0,
      `hooks after accessGate early return would crash staff CRM: ${hooksAfter.join(', ')}`,
    );
  });
});

describe('RouteErrorBoundary reports the render failure', () => {
  it('keeps a visible error detail for operators', () => {
    assert.match(appSrc, /errorMessage/);
    assert.match(appSrc, /route-error-detail/);
    assert.match(appSrc, /Unable to load this screen/);
  });
});
