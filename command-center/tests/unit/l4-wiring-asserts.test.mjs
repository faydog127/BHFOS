// Wiring asserts for MonthlyCheckIn L4 (source-level; stronger = jsdom/Playwright render test)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(process.env.MC || path.join(root, 'src/pages/finance/MonthlyCheckIn.jsx'), 'utf8');

describe('MonthlyCheckIn L4 wiring', () => {
  const reload = src.match(/async function onReloadClick\(\) \{[\s\S]*?\n  \}\n/)?.[0] ?? '';
  it('Reload copies the server form and only then clears the conflict', () => {
    assert.ok(reload, 'onReloadClick present');
    const iForm = reload.indexOf('setForm(applied.form)');
    const iClear = reload.indexOf('setConflict(false)');
    assert.ok(iForm > -1 && iClear > iForm, 'setForm(applied.form) precedes setConflict(false)');
    assert.equal(/applied\.form\s*=/.test(reload), false);
    assert.match(reload, /if \(!listed\?\.ok \|\| !applied\.ok\) \{\s*setConflict\(true\);[\s\S]*?return;/);
  });
  it('conflict is passed to the save gate and gates save + associate', () => {
    assert.match(src, /nextCheckinCorrection\(\{\s*conflict,/);
    assert.match(src, /basisLocked \|\| saving \|\| conflict\) return;/);
    assert.match(src, /disabled=\{!writesEnabled \|\| saving \|\| conflict\}>\s*Associate|disabled=\{!writesEnabled \|\| saving \|\| conflict\}>Associate/);
    assert.match(src, /data-testid="checkin-save" disabled=\{!writesEnabled \|\| saving \|\| conflict\}/);
  });
  it('New month does not clear an unresolved conflict', () => {
    const openNew = src.match(/function openNew\(\) \{[\s\S]*?\n  \}\n/)?.[0] ?? '';
    assert.match(openNew, /function openNew\(\) \{\s*if \(conflict\)/);
    const guard = openNew.indexOf('if (conflict) return;');
    assert.ok(guard > -1);
    assert.equal(openNew.slice(0, guard).includes('setConflict(false)'), false);
    assert.equal(openNew.slice(0, guard).includes('setForm'), false);
  });
  it('history selection does not clear a conflict or load the cached row', () => {
    const openRow = src.match(/function openRow\(row\) \{[\s\S]*?\n  \}\n/)?.[0] ?? '';
    assert.match(openRow, /if \(conflict\) return;/);
    const guard = openRow.indexOf('if (conflict) return;');
    assert.ok(guard > -1);
    assert.equal(openRow.slice(0, guard).includes('setConflict(false)'), false);
    assert.equal(openRow.slice(0, guard).includes('formFromActual'), false);
  });
  it('no console.* in check-in and conflict modules', () => {
    assert.equal(/console\./.test(src), false);
    assert.equal(/console\./.test(readFileSync(path.join(root, 'src/lib/finance/checkinConflict.js'), 'utf8')), false);
  });
});
