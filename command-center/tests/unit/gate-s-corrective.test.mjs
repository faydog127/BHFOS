/**
 * Gate S corrective checks that run without a browser or a hosted project.
 * C5 is the bare HTTP 409 case. E2 retention is the draft store plus the leave disposition.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { approvabilityCopy, hurdleSumExceedsOne, planApprovabilityErrors } from '../../src/lib/finance/approvability.js';
import { calculatePlan, retentionHurdle } from '../../src/lib/finance/calculate.js';
import { evaluateFinanceAccess } from '../../src/lib/finance/authz.js';
import {
  clearFinanceDrafts,
  readCheckinDraft,
  readPlanDraft,
  rememberCheckinDraft,
  rememberPlanDraft,
  resolveStoredPlan,
} from '../../src/lib/finance/dirtyDraft.js';
import { leaveDisposition } from '../../src/lib/finance/leaveGuard.js';
import { approvePlan, isFinanceVersionConflict } from '../../src/lib/finance/persistence.js';
import { financeWritesEnabled } from '../../src/lib/finance/writeGate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

describe('E2 dirty drafts survive intra-finance navigation', () => {
  it('keeps a plan draft on Cancel and drops it only after confirmed leave', () => {
    clearFinanceDrafts();
    const server = { id: 'plan-1', version: 3, inputs: { stages: {} }, notes: 'server' };
    rememberPlanDraft({ id: 'plan-1', version: 3, inputs: { stages: { held: true } }, notes: 'unsaved key note' });
    const held = resolveStoredPlan(server);
    assert.equal(held.held, true);
    assert.equal(held.dirty, true);
    assert.equal(held.notes, 'unsaved key note');
    assert.equal(leaveDisposition('/tvg/finance/checkin', 'tvg'), 'retain');
    assert.equal(leaveDisposition('/tvg/finance', 'tvg'), 'retain');
    assert.equal(readPlanDraft().notes, 'unsaved key note');
    clearFinanceDrafts();
    const afterLeave = resolveStoredPlan(server);
    assert.equal(afterLeave.held, false);
    assert.equal(afterLeave.dirty, false);
    assert.equal(afterLeave.notes, 'server');
    assert.equal(readPlanDraft(), null);
  });

  it('restores the check-in form after the screen unmounts', () => {
    clearFinanceDrafts();
    rememberCheckinDraft({
      selectedId: null,
      monthInput: '2026-04',
      form: { source_note: 'check-in draft note', total_revenue: '4.00' },
      associateOnCreate: false,
    });
    assert.equal(readCheckinDraft().form.source_note, 'check-in draft note');
    assert.equal(leaveDisposition('/tvg/crm/dashboard', 'tvg'), 'prompt');
    clearFinanceDrafts();
    assert.equal(readCheckinDraft(), null);
  });

  it('a different version does not restore a stale draft', () => {
    clearFinanceDrafts();
    rememberPlanDraft({ id: 'plan-1', version: 3, inputs: { kept: true }, notes: 'stale' });
    const next = resolveStoredPlan({ id: 'plan-1', version: 4, inputs: { kept: false }, notes: 'saved' });
    assert.equal(next.held, false);
    assert.equal(next.notes, 'saved');
  });
});

describe('E2 leave dialog is reachable from Finance', () => {
  const shell = read('src/pages/finance/FinanceShell.jsx');
  it('offers Leave planning and Cancel keeps the screen', () => {
    assert.match(shell, /data-testid="finance-exit"/);
    assert.match(shell, /to=\{`\/\$\{routeTenantId\}\/crm\/dashboard`\}/);
    assert.match(shell, /Leave planning/);
    assert.match(shell, /data-testid="finance-leave-stay" onClick=\{onStay\}>Cancel</);
    assert.match(shell, /Cancel keeps them on this screen/);
    assert.equal(shell.includes('finance-leave-cancel'), false);
    const discard = shell.slice(shell.indexOf('function discardAndLeave'), shell.indexOf('function selectFinanceMode'));
    assert.match(discard, /clearFinanceDrafts\(\)/);
    const stay = shell.slice(shell.indexOf('function stayOnFinance'), shell.indexOf('function discardAndLeave'));
    assert.equal(/clearFinanceDrafts|navigate\(/.test(stay), false);
  });
});

describe('C5 bare HTTP 409 is not a version conflict', () => {
  it('approvePlan maps a bare 409 to finance_approve_failed and leaves the identifier path as version_conflict', async () => {
    const bare = { status: 409, message: 'conflict' };
    assert.equal(isFinanceVersionConflict(bare), false);
    const rejected = await approvePlan({
      rpc() {
        return { data: null, error: bare };
      },
    }, { id: '00000000-0000-4000-8000-000000000001', expectedVersion: 1 }, { MODE: 'test' });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, 'finance_approve_failed');
    const identified = await approvePlan({
      rpc() {
        return { data: null, error: { status: 409, code: 'PT409', message: 'finance_version_conflict' } };
      },
    }, { id: '00000000-0000-4000-8000-000000000001', expectedVersion: 1 }, { MODE: 'test' });
    assert.equal(identified.code, 'version_conflict');
  });
});

describe('read-only build mutation controls', () => {
  const shell = read('src/pages/finance/FinanceShell.jsx');
  const checkin = read('src/pages/finance/MonthlyCheckIn.jsx');
  it('writes stay off when the synthetic flag is absent', () => {
    assert.equal(financeWritesEnabled({}), false);
    assert.equal(financeWritesEnabled({ MODE: 'production' }), false);
    assert.equal(financeWritesEnabled({ VITE_FINANCE_SYNTHETIC_ONLY: '' }), false);
    assert.equal(financeWritesEnabled({ MODE: 'test' }), true);
  });

  it('New month is disabled and its handler returns before a write', () => {
    assert.match(checkin, /data-testid="checkin-new" onClick=\{openNew\} disabled=\{!writesEnabled\}/);
    const openNew = checkin.slice(checkin.indexOf('function openNew'), checkin.indexOf('function openRow'));
    assert.match(openNew, /if \(!writesEnabled\) return;/);
    assert.match(checkin, /data-testid="checkin-save"[\s\S]*disabled=\{!writesEnabled \|\| saving \|\| conflict\}/);
    assert.match(checkin, /data-testid="checkin-associate"[\s\S]*disabled=\{!writesEnabled \|\| saving \|\| conflict\}/);
    assert.match(checkin, /if \(!writesEnabled \|\| !selected \|\| !approved \|\| basisLocked \|\| saving \|\| conflict\) return;/);
  });

  it('plan mutation controls are disabled and guarded', () => {
    assert.match(shell, /data-testid="finance-create-plan" onClick=\{onCreate\} disabled=\{!writesEnabled\}/);
    assert.match(shell, /data-testid="finance-save" onClick=\{onSave\} disabled=\{!writesEnabled \|\| conflict\}/);
    assert.match(shell, /data-testid="finance-approve" onClick=\{onApprove\} disabled=\{!writesEnabled \|\| conflict \|\| planNotApprovable\}/);
    assert.match(shell, /data-testid="finance-new-draft" onClick=\{onNewDraft\} disabled=\{!writesEnabled \|\| conflict\}/);
    assert.match(shell, /data-testid="finance-upgrade-schema" onClick=\{onUpgradeSchema\} disabled=\{!writesEnabled \|\| dirty \|\| conflict\}/);
    assert.match(shell, /async function onCreate\(\) \{\n    setSaveCode\(null\);\n    if \(!writesEnabled\)/);
    assert.match(shell, /async function onSave\(\) \{\n    if \(conflict\) return;\n    if \(!writesEnabled/);
    assert.match(shell, /async function onApprove\(\) \{\n    if \(conflict\) return;\n    if \(!writesEnabled\) return;\n    if \(planNotApprovable\)/);
    assert.match(shell, /async function onNewDraft\(\) \{\n    if \(conflict\) return;\n    if \(!writesEnabled/);
    assert.match(shell, /async function onUpgradeSchema\(\) \{\n    if \(conflict\) return;\n    if \(!writesEnabled/);
    assert.match(shell, /async function onCreateActual\(payload\) \{\n    if \(!writesEnabled\) return/);
    assert.match(shell, /async function onCorrectActual\(payload\) \{\n    if \(!writesEnabled\) return/);
    assert.match(shell, /async function onAssociateActual\(payload\) \{\n    if \(!writesEnabled\) return/);
    assert.match(shell, /<fieldset disabled=\{draftLocked \|\| !writesEnabled\}/);
    assert.match(shell, /disabled=\{draftLocked \|\| !writesEnabled\}/);
  });
});

describe('A9 the client cannot escalate from localStorage', () => {
  const authz = read('src/lib/finance/authz.js');
  it('reads only JWT app_metadata', () => {
    assert.match(authz, /app_metadata/);
    assert.match(authz, /localStorage are not authorities/);
    assert.equal(/localStorage\.getItem|localStorage\[/.test(authz), false);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      app_metadata: { tenant_id: 'tvg', role: 'viewer' },
      user_metadata: { tenant_id: 'tvg', role: 'admin' },
    })}.sig`;
    const decision = evaluateFinanceAccess({ accessToken: token, routeTenantId: 'tvg' });
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'role');
  });
});

describe('approve parity for the hurdle boundary', () => {
  const hurdles = {
    true_operating_profit_pct: 0.7,
    growth_reserve_pct: 0.2,
    bad_debt_warranty_pct: 0.1,
    unidentified_cost_contingency_pct: 0,
  };

  it('rejects 0.7+0.2+0.1+0 as exactly 1 and keeps 0.9999 below the boundary', () => {
    assert.equal(0.7 + 0.2 + 0.1 + 0 < 1, true);
    assert.equal(hurdleSumExceedsOne([0.7, 0.2, 0.0999, 0]), false);
    assert.equal(hurdleSumExceedsOne([0.7, 0.2, 0.1, 0]), true);
    assert.equal(hurdleSumExceedsOne([0.7, 0.2, 0.1, 0.0001]), true);
    const below = retentionHurdle({
      ...hurdles,
      bad_debt_warranty_pct: 0.0999,
    });
    assert.equal(below.valid, true);
    assert.equal(below.value, 0.9999);
    const verdict = retentionHurdle(hurdles);
    assert.equal(verdict.valid, false);
    assert.equal(verdict.value, null);
    assert.deepEqual(verdict.errors, ['retention_hurdle:invalid']);
    const zeros = {
      true_operating_profit_pct: 0,
      growth_reserve_pct: 0,
      bad_debt_warranty_pct: 0,
      unidentified_cost_contingency_pct: 0,
    };
    const inputs = { stages: { stage_0: hurdles, stage_1: zeros, stage_2: zeros, stage_3: zeros } };
    const calculated = calculatePlan(inputs);
    assert.equal(calculated.stages.stage_0.requiredMonthlyRevenue, null);
    assert.equal(calculated.errors.some((error) => error === 'stage_0:retention_hurdle:invalid'), true);
    assert.equal(planApprovabilityErrors(inputs).some((error) => error === 'stage_0:retention_hurdle:invalid'), true);
    assert.match(approvabilityCopy(calculated.errors), /exactly 1 is not allowed/);
    const blankStage = {
      stages: {
        stage_0: zeros,
        stage_1: zeros,
        stage_2: { true_operating_profit_pct: 0, bad_debt_warranty_pct: 0, unidentified_cost_contingency_pct: 0 },
        stage_3: zeros,
      },
    };
    assert.equal(planApprovabilityErrors(blankStage).some((error) => error === 'stage_2:growth_reserve_pct:missing'), true);
    assert.equal(calculatePlan(blankStage).stages.stage_2.requiredMonthlyRevenue, null);
    const over = {
      ...inputs,
      stages: {
        ...inputs.stages,
        stage_0: { ...hurdles, unidentified_cost_contingency_pct: 0.0001 },
      },
    };
    assert.equal(planApprovabilityErrors(over).some((error) => error.includes('retention_hurdle')), true);
  });

  it('maps a server approve refusal to finance_plan_not_approvable', async () => {
    const refused = await approvePlan({
      rpc: async () => ({
        data: null,
        error: { code: '23514', message: 'finance_plan_not_approvable', details: 'finance_plan_not_approvable' },
      }),
    }, { id: '00000000-0000-4000-8000-000000000001', expectedVersion: 1 }, { MODE: 'test' });
    assert.equal(refused.code, 'finance_plan_not_approvable');
    const locked = await approvePlan({
      rpc: async () => ({ data: null, error: { code: '23514', message: 'finance_plan_locked' } }),
    }, { id: '00000000-0000-4000-8000-000000000001', expectedVersion: 1 }, { MODE: 'test' });
    assert.equal(locked.code, 'finance_plan_locked');
    const bare = await approvePlan({
      rpc: async () => ({ data: null, error: { code: '23514', message: '23514' } }),
    }, { id: '00000000-0000-4000-8000-000000000001', expectedVersion: 1 }, { MODE: 'test' });
    assert.equal(bare.code, 'finance_check_failed');
  });

  it('shows plain language for an approve refusal and keeps other codes', () => {
    const shell = read('src/pages/finance/FinanceShell.jsx');
    const contract = read('src/lib/finance/approvability.js');
    assert.match(shell, /function saveErrorCopy\(code, errors\)/);
    assert.match(shell, /saveErrorCopy\(saveCode, result\?\.errors\)/);
    assert.match(contract, /must total less than 1/);
    assert.match(shell, /exactly 1 is not allowed/);
    assert.match(contract, /Approve is blocked until the validation message is clear\./);
    assert.match(contract, /Management compensation cannot be negative\./);
    assert.equal(approvabilityCopy(['stage_0:owner_management_comp:invalid']).includes('23514'), false);
    assert.equal(shell.includes('{saveCode}'), false);
    assert.equal(shell.includes('23514'), false);
  });
});
