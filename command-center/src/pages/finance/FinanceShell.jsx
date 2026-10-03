import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useParams } from 'react-router-dom';
import { calculatePlan, monthlyPayroll, OWNER_FIELD_RESERVE_LABEL, STAGE_3_CORE_CAVEAT } from '@/lib/finance/calculate';
import { supabase } from '@/lib/customSupabaseClient';
import {
  approvePlan,
  createBlankPlan,
  listPlans,
  openDraftFromApproved,
  saveDraft,
  selectVisiblePlan,
} from '@/lib/finance/persistence';
import { FINANCE_NOTES_MAX } from '@/lib/finance/blankPlan';
import { EXPLANATIONS, FINANCE_SECTIONS, buildFinanceView, showCents, showMoney } from '@/lib/finance/viewModel';

function sectionIdFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const financeIndex = parts.indexOf('finance');
  const id = financeIndex >= 0 ? parts[financeIndex + 1] : '';
  return FINANCE_SECTIONS.some((section) => section.path === id) ? (id || 'overview') : 'overview';
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block text-xs text-slate-600">
      <span>{label}</span>
      <input
        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
        inputMode="decimal"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw.trim() === '') onChange(null);
          else {
            const parsed = Number(raw);
            onChange(Number.isFinite(parsed) ? parsed : null);
          }
        }}
      />
    </label>
  );
}

function Stat({ label, value, note }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

function Explain({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 leading-6">{children}</p>
    </section>
  );
}

export default function FinanceShell({ grantedAccess }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantId: routeTenantId } = useParams();
  const allowed = grantedAccess?.allowed === true;
  const [inputs, setInputs] = useState(null);
  const [record, setRecord] = useState(null);
  const [approvedBasis, setApprovedBasis] = useState(null);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(allowed);
  const [loadCode, setLoadCode] = useState(null);
  const [saveCode, setSaveCode] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [selectedStage, setSelectedStage] = useState('stage_2');
  const section = sectionIdFromPath(location.pathname);

  function applyPlan(plan, basis) {
    setRecord(plan);
    setApprovedBasis(basis || null);
    setInputs(plan.inputs);
    setNotes(plan.notes || '');
    setDirty(false);
    setConflict(false);
    setSaveCode(null);
  }

  async function refreshPlans() {
    const listed = await listPlans(supabase);
    if (!listed.ok) {
      setLoadCode(listed.code);
      setLoading(false);
      return;
    }
    const choice = selectVisiblePlan(listed.plans);
    setLoadCode(null);
    setLoading(false);
    if (!choice.visible) {
      setRecord(null);
      setInputs(null);
      setApprovedBasis(null);
      return;
    }
    applyPlan(choice.visible, choice.draft ? choice.approved : null);
  }

  useEffect(() => {
    if (!allowed) return undefined;
    let live = true;
    listPlans(supabase).then((listed) => {
      if (!live) return;
      if (!listed.ok) {
        setLoadCode(listed.code);
        setLoading(false);
        return;
      }
      const choice = selectVisiblePlan(listed.plans);
      setLoading(false);
      if (!choice.visible) return;
      applyPlan(choice.visible, choice.draft ? choice.approved : null);
    });
    return () => {
      live = false;
    };
  }, [allowed]);

  function editInputs(updater) {
    setDirty(true);
    setInputs(updater);
  }

  const result = useMemo(() => (inputs ? calculatePlan(inputs) : null), [inputs]);
  const view = useMemo(
    () => (inputs && result ? buildFinanceView({ meta: { label: 'Stored plan', data_class: 'stored' }, inputs }, result, selectedStage) : null),
    [inputs, result, selectedStage],
  );

  function patchStage(stageKey, field, value) {
    editInputs((current) => {
      const next = structuredClone(current);
      next.stages[stageKey][field] = value;
      return next;
    });
  }

  function patchOwner(field, value) {
    editInputs((current) => {
      const next = structuredClone(current);
      next.owner_field_replacement[field] = value;
      return next;
    });
  }

  function patchRole(roleKey, field, value) {
    editInputs((current) => {
      const next = structuredClone(current);
      const role = next.staffing.find((item) => item.key === roleKey);
      if (role) role[field] = value;
      return next;
    });
  }

  function patchHeadcount(roleKey, stageKey, value) {
    editInputs((current) => {
      const next = structuredClone(current);
      const role = next.staffing.find((item) => item.key === roleKey);
      if (role) role.headcount[stageKey] = value;
      return next;
    });
  }

  function patchPool(group, line, stageKey, value) {
    editInputs((current) => {
      const next = structuredClone(current);
      next.cost_pools[group][line][stageKey] = value;
      return next;
    });
  }

  function patchChannel(index, field, value) {
    editInputs((current) => {
      const next = structuredClone(current);
      next.channels[index][field] = value;
      return next;
    });
  }

  function patchService(serviceKey, field, value) {
    editInputs((current) => {
      const next = structuredClone(current);
      next.services[serviceKey][field] = value;
      return next;
    });
  }

  async function onCreate() {
    setSaveCode(null);
    const created = await createBlankPlan(supabase);
    if (!created.ok) {
      setSaveCode(created.code);
      return;
    }
    applyPlan(created.plan, null);
  }

  async function onSave() {
    if (!record || record.status !== 'draft') return;
    const saved = await saveDraft(supabase, {
      id: record.id,
      expectedVersion: record.version,
      inputs,
      notes,
    });
    if (!saved.ok) {
      if (saved.code === 'version_conflict') setConflict(true);
      setSaveCode(saved.code);
      return;
    }
    applyPlan(saved.plan, approvedBasis);
  }

  async function onApprove() {
    if (!record || record.status !== 'draft' || dirty) {
      setSaveCode('finance_save_before_approve');
      return;
    }
    const approved = await approvePlan(supabase, { id: record.id, expectedVersion: record.version });
    if (!approved.ok) {
      if (approved.code === 'version_conflict') setConflict(true);
      setSaveCode(approved.code);
      return;
    }
    applyPlan(approved.plan, null);
  }

  async function onNewDraft() {
    if (!record || record.status !== 'approved') return;
    const opened = await openDraftFromApproved(supabase, { id: record.id });
    if (!opened.ok) {
      setSaveCode(opened.code);
      return;
    }
    applyPlan(opened.plan, record);
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" data-testid="finance-shell-unguarded">
        <p className="text-slate-700">Planning is unavailable.</p>
      </div>
    );
  }
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Loading plan…</div>;
  }
  if (!record) {
    return (
      <div className="min-h-screen bg-slate-100 p-8" data-testid="finance-empty">
        <h1 className="text-2xl font-semibold">No plan yet</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">Create a blank plan. Nothing is filled in for you.</p>
        {saveCode ? <p className="mt-3 text-sm text-red-700" data-testid="finance-save-error">{saveCode}</p> : null}
        {loadCode ? <p className="mt-3 text-sm text-red-700" data-testid="finance-load-error">{loadCode}</p> : null}
        <button type="button" className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-testid="finance-create-plan" onClick={onCreate}>Create plan</button>
      </div>
    );
  }
  if (!view || !inputs) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Loading plan…</div>;
  }

  const base = `/${routeTenantId}/finance`;
  const draftLocked = record.status !== 'draft';
  const stageKeys = ['stage_0', 'stage_1', 'stage_2', 'stage_3'];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" data-testid="finance-shell">
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950" data-testid="plan-banner">
        Stored plan ({record.status}). Save writes this draft. Refresh discards unsaved edits. The synthetic illustration is not this plan.
      </div>
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-900 text-slate-100 lg:min-h-screen lg:border-b-0 lg:border-r">
          <div className="px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Planning</div>
            <div className="mt-1 text-lg font-semibold">Financial model</div>
          </div>
          <label className="block px-4 pb-3 lg:hidden">
            <span className="sr-only">Section</span>
            <select
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm"
              value={section === 'overview' ? '' : section}
              onChange={(event) => {
                const next = event.target.value;
                navigate(next ? `${base}/${next}` : base);
              }}
            >
              {FINANCE_SECTIONS.map((item) => (
                <option key={item.id} value={item.path}>{item.label}</option>
              ))}
            </select>
          </label>
          <nav className="hidden lg:block px-3 pb-6 space-y-1" aria-label="Planning sections">
            {FINANCE_SECTIONS.map((item, index) => (
              <NavLink
                key={item.id}
                to={item.path ? `${base}/${item.path}` : base}
                end={item.path === ''}
                className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-xs">{index + 1}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="px-4 py-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{FINANCE_SECTIONS.find((item) => (item.path || 'overview') === section)?.label}</h1>
              <p className="mt-1 text-sm text-slate-600">What this section is, what you can change, and what the formulas return.</p>
            </div>
            <label className="text-sm text-slate-600">
              Display stage
              <select
                className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1.5"
                value={selectedStage}
                onChange={(event) => setSelectedStage(event.target.value)}
              >
                {stageKeys.map((key) => (
                  <option key={key} value={key}>{inputs.stages[key].label}</option>
                ))}
              </select>
            </label>
          </header>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {record.status === 'draft' ? (
              <button type="button" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="finance-save" onClick={onSave}>Save draft</button>
            ) : null}
            {record.status === 'draft' ? (
              <button type="button" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm" data-testid="finance-approve" onClick={onApprove}>Approve plan</button>
            ) : null}
            {record.status === 'approved' ? (
              <button type="button" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="finance-new-draft" onClick={onNewDraft}>New draft</button>
            ) : null}
            {approvedBasis ? <p className="text-xs text-slate-500">An approved plan basis exists. This draft does not drive variance until it is approved.</p> : null}
          </div>
          <label className="mb-4 block text-sm text-slate-600">
            Notes
            <textarea
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              maxLength={FINANCE_NOTES_MAX}
              disabled={draftLocked}
              value={notes}
              onChange={(event) => {
                setDirty(true);
                setNotes(event.target.value);
              }}
            />
            <span className="mt-1 block text-xs text-slate-500">Plain text only. Do not enter employee or customer names or other personal data.</span>
          </label>
          {conflict ? (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="finance-version-conflict">
              Changed elsewhere. Your unsaved edits are still on this screen.
              <button type="button" className="ml-3 underline" data-testid="finance-reload" onClick={refreshPlans}>Reload</button>
            </div>
          ) : null}
          {saveCode ? <p className="mb-4 text-sm text-red-700" data-testid="finance-save-error">{saveCode}</p> : null}
          {view.errors.length > 0 ? (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="finance-validation">
              Some inputs are incomplete or invalid. Affected results show --. Retention hurdles must satisfy 0 ≤ value &lt; 1.
            </div>
          ) : null}
          <fieldset disabled={draftLocked} className="min-w-0 border-0 p-0">
          {section === 'overview' ? <Overview view={view} inputs={inputs} /> : null}
          {section === 'people' ? (
            <People inputs={inputs} result={result} onRole={patchRole} onHeadcount={patchHeadcount} onStage={patchStage} onOwner={patchOwner} />
          ) : null}
          {section === 'trucks' ? <Pools title="Trucks & Equipment" groups={['direct_production', 'indirect_field']} inputs={inputs} onPatch={patchPool} copy={[EXPLANATIONS.directProduction, EXPLANATIONS.fieldOverhead]} /> : null}
          {section === 'office' ? <Office inputs={inputs} result={result} onPatch={patchPool} /> : null}
          {section === 'growth' ? <Growth inputs={inputs} view={view} result={result} onStage={patchStage} onChannel={patchChannel} /> : null}
          {section === 'production' ? <Production inputs={inputs} view={view} onService={patchService} onInput={editInputs} /> : null}
          {section === 'pricing' ? <Pricing view={view} inputs={inputs} onService={patchService} /> : null}
          {section === 'stages' ? <Stages view={view} inputs={inputs} /> : null}
          {section === 'checkin' ? <Checkin view={view} /> : null}
          </fieldset>
          <div className="mt-8 flex justify-between text-sm">
            <SectionLink sections={FINANCE_SECTIONS} current={section} base={base} direction={-1} label="Back" />
            <SectionLink sections={FINANCE_SECTIONS} current={section} base={base} direction={1} label="Next" />
          </div>
        </main>
      </div>
    </div>
  );
}

function SectionLink({ sections, current, base, direction, label }) {
  const index = sections.findIndex((item) => (item.path || 'overview') === current);
  const next = sections[index + direction];
  if (!next) return <span />;
  return (
    <NavLink className="rounded bg-blue-600 px-4 py-2 font-medium text-white" to={next.path ? `${base}/${next.path}` : base}>
      {label}: {next.label}
    </NavLink>
  );
}

function Overview({ view, inputs }) {
  const selected = view.stages.find((stage) => stage.key === view.selectedStageKey);
  return (
    <div className="space-y-6" data-testid="finance-overview">
      <p className="text-sm text-slate-600">A snapshot of the synthetic illustration. Current cash cost is not current revenue. No revenue actual has been entered.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Illustrated cash baseline" value={view.stages[0].cash} note="Derived from the stage 0 cost pools. Not verified revenue." />
        <Stat label="Selected stage required revenue" value={selected.requiredRevenue} note={inputs.stages[view.selectedStageKey].label} />
        <Stat label="Selected liquidity target" value={selected.liquidity} note="Max of operating cash float and safety reserve." />
        <Stat label="Stage 3 headline" value={view.stage3Headline.requiredRevenue} note={view.hvacEnabled ? 'Stage 3 + HVAC' : view.hvacDisabledCopy} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Required monthly revenue by stage</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view.chart.map((item) => ({ name: item.label, value: item.value }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => showMoney(value)} />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {view.stage3Headline.derived ? <p className="mt-3 text-xs text-slate-600" data-testid="stage3-core-caveat">{view.stage3CoreCaveat}</p> : null}
        </div>
        <div className="space-y-3">
          <Explain title="How is this calculated?">Required revenue is economic operating cost divided by one minus the retention hurdle. Economic cost is cash operating cost plus the owner field replacement reserve. Empty inputs stay blank. Divide-by-zero shows --.</Explain>
          <Explain title="Key takeaways">Readiness stays Incomplete / Needs review until practical billable capacity and projected results are supplied. {view.advisory}</Explain>
          <p className="text-xs text-slate-500" data-testid="capacity-missing">Practical billable capacity: {view.missing.practicalBillableCapacity}. Utilization band: {view.utilizationBand}.</p>
        </div>
      </div>
    </div>
  );
}

function roleMonthly(inputs, role, stageKey) {
  return monthlyPayroll({
    headcount: role.headcount[stageKey],
    hourlyWage: role.wage,
    weeklyHours: role.weekly_hours,
    burdenPct: role.burden,
    weeksPerYear: inputs.structural.weeks_per_year,
    monthsPerYear: inputs.structural.months_per_year,
  });
}

function People({ inputs, result, onRole, onHeadcount, onStage, onOwner }) {
  const stageKeys = ['stage_0', 'stage_1', 'stage_2', 'stage_3'];
  return (
    <div className="space-y-6" data-testid="finance-people">
      <Explain title="What this section is">{EXPLANATIONS.ownerManagement} {EXPLANATIONS.laborBurden}</Explain>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Wage</th>
              <th className="px-3 py-2">Burden</th>
              <th className="px-3 py-2">Hours/week</th>
              {stageKeys.map((key) => <th key={key} className="px-3 py-2">{key.replace('stage_', 'S')}</th>)}
              <th className="px-3 py-2">S2 loaded</th>
            </tr>
          </thead>
          <tbody>
            {inputs.staffing.map((role) => (
              <tr key={role.key} className="border-t border-slate-100">
                <td className="px-3 py-2">{role.label}</td>
                <td className="px-3 py-2 text-xs">{role.classification === 'direct_field' ? 'Direct field' : 'Indirect support'}</td>
                <td className="px-3 py-2"><NumberField label="" value={role.wage} onChange={(value) => onRole(role.key, 'wage', value)} /></td>
                <td className="px-3 py-2"><NumberField label="" value={role.burden} onChange={(value) => onRole(role.key, 'burden', value)} /></td>
                <td className="px-3 py-2"><NumberField label="" value={role.weekly_hours} onChange={(value) => onRole(role.key, 'weekly_hours', value)} /></td>
                {stageKeys.map((key) => (
                  <td key={key} className="px-3 py-2">
                    <NumberField label="" value={role.headcount[key]} onChange={(value) => onHeadcount(role.key, key, value)} />
                  </td>
                ))}
                <td className="px-3 py-2">{showCents(roleMonthly(inputs, role, 'stage_2'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Owner</h2>
        <p className="mt-2 text-sm text-slate-600" data-testid="owner-reserve-label">{OWNER_FIELD_RESERVE_LABEL}</p>
        <p className="mt-1 text-sm">Stage 2 field technicians come from the direct-field headcount rows. Productive unit-hours do not include shadow hours. The owner is not included in either.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <NumberField label="Replacement wage" value={inputs.owner_field_replacement.wage} onChange={(value) => onOwner('wage', value)} />
          <NumberField label="Replacement burden" value={inputs.owner_field_replacement.burden} onChange={(value) => onOwner('burden', value)} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stageKeys.map((key) => (
            <div key={key} className="space-y-2 rounded border border-slate-100 p-3">
              <div className="text-sm font-medium">{inputs.stages[key].label}</div>
              <NumberField label="Management compensation" value={inputs.stages[key].owner_management_comp} onChange={(value) => onStage(key, 'owner_management_comp', value)} />
              <NumberField label="Shadow field hours" value={inputs.stages[key].owner_shadow_hours} onChange={(value) => onStage(key, 'owner_shadow_hours', value)} />
              <p className="text-xs text-slate-500">Reserve {showMoney(result.stages[key].ownerFieldReplacement)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pools({ title, groups, inputs, onPatch, copy }) {
  const stageKeys = ['stage_0', 'stage_1', 'stage_2', 'stage_3'];
  return (
    <div className="space-y-4" data-testid={`finance-${title}`}>
      <Explain title={title}>{copy.join(' ')} Debt service and the replacement sinking fund stay separate lines.</Explain>
      {groups.map((group) => (
        <div key={group} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <h2 className="px-3 py-2 font-semibold capitalize">{group.replaceAll('_', ' ')}</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Line</th>
                {stageKeys.map((key) => <th key={key} className="px-3 py-2">{key}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(inputs.cost_pools[group]).map(([line, values]) => (
                <tr key={line} className="border-t border-slate-100">
                  <td className="px-3 py-2">{line.replaceAll('_', ' ')}{line === 'office_misc' ? ' (stage 0 balancing amount, not a verified cost)' : ''}</td>
                  {stageKeys.map((key) => (
                    <td key={key} className="px-3 py-2">
                      <NumberField label="" value={values[key]} onChange={(value) => onPatch(group, line, key, value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function Office({ inputs, result, onPatch }) {
  return (
    <div className="space-y-4" data-testid="finance-office">
      <Explain title="Office & G&A">{EXPLANATIONS.ga} Support payroll is edited on People & Payroll and shown here as a result.</Explain>
      <Pools title="Office lines" groups={['ga']} inputs={inputs} onPatch={onPatch} copy={['']} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {['stage_0', 'stage_1', 'stage_2', 'stage_3'].map((key) => (
          <Stat
            key={key}
            label={`${inputs.stages[key].label} G&A`}
            value={showMoney(result.stages[key].ga)}
            note={`Share of required revenue: ${share(result.stages[key].ga, result.stages[key].requiredMonthlyRevenue)}`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">{EXPLANATIONS.balancing}</p>
    </div>
  );
}

function share(part, total) {
  if (part === null || total === null || total === 0) return '--';
  return `${((part / total) * 100).toFixed(2)}%`;
}

function Growth({ inputs, view, result, onStage, onChannel }) {
  const stageKeys = ['stage_0', 'stage_1', 'stage_2', 'stage_3'];
  return (
    <div className="space-y-4" data-testid="finance-growth">
      <Explain title="Retention hurdle">{EXPLANATIONS.growthReserve} {EXPLANATIONS.badDebt} {EXPLANATIONS.contingency} The total must satisfy 0 ≤ value &lt; 1.</Explain>
      <div className="grid gap-3 lg:grid-cols-2">
        {stageKeys.map((key) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">{inputs.stages[key].label}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumberField label="Operating profit fraction" value={inputs.stages[key].true_operating_profit_pct} onChange={(value) => onStage(key, 'true_operating_profit_pct', value)} />
              <NumberField label="Growth reserve fraction" value={inputs.stages[key].growth_reserve_pct} onChange={(value) => onStage(key, 'growth_reserve_pct', value)} />
              <NumberField label="Bad debt / warranty fraction" value={inputs.stages[key].bad_debt_warranty_pct} onChange={(value) => onStage(key, 'bad_debt_warranty_pct', value)} />
              <NumberField label="Contingency fraction" value={inputs.stages[key].unidentified_cost_contingency_pct} onChange={(value) => onStage(key, 'unidentified_cost_contingency_pct', value)} />
              <NumberField label="Safety months" value={inputs.stages[key].safety_months} onChange={(value) => onStage(key, 'safety_months', value)} />
            </div>
            <p className="mt-3 text-sm">Hurdle {view.stages.find((stage) => stage.key === key).hurdle}. Required revenue {showMoney(result.stages[key].requiredMonthlyRevenue)}.</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="channel-panel">
        <h2 className="font-semibold">Channels and receivables</h2>
        <p className="mt-2 text-sm text-slate-600">{view.weightedDsoAssumption} {EXPLANATIONS.dso} {EXPLANATIONS.workingCapital}</p>
        {view.channelShareWarning ? (
          <p className="mt-2 text-sm text-amber-800" data-testid="channel-share-warning">Channel shares do not total 100%. Shown total {view.channelShareTotalDisplay}. The weighted DSO is not renormalized.</p>
        ) : null}
        <div className="mt-3 space-y-3">
          {inputs.channels.map((channel, index) => (
            <div key={channel.key} className="grid gap-2 md:grid-cols-4">
              <div className="text-sm font-medium">{channel.label}</div>
              <NumberField label="Share" value={channel.share} onChange={(value) => onChannel(index, 'share', value)} />
              <NumberField label="DSO days" value={channel.dso_days} onChange={(value) => onChannel(index, 'dso_days', value)} />
              <p className="text-xs text-slate-500">Acquisition {channel.acquisition_pct} and vent price {channel.vent_price} are display-only.</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">Weighted DSO assumption: {view.stages[0].weightedDso}. Liquidity stage 2: {view.stages.find((stage) => stage.key === 'stage_2').liquidity}.</p>
      </div>
    </div>
  );
}

function Production({ inputs, view, onService, onInput }) {
  return (
    <div className="space-y-4" data-testid="finance-production">
      <Explain title="Production units">{EXPLANATIONS.productionUnit} {inputs.stages.stage_2.production_units_definition}</Explain>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Route services</h2>
          <p className="mt-2 text-sm">Standard crew: {inputs.production_copy.route_crew} technician. Travel hours: -- / Not provided.</p>
          <NumberField label="Dense stops / day" value={inputs.route.dense_stops} onChange={(value) => onInput((current) => ({ ...structuredClone(current), route: { ...current.route, dense_stops: value } }))} />
          <ul className="mt-3 space-y-1 text-sm">
            {view.routes.map((row) => (
              <li key={row.stops}>{row.stops} stops: daily {row.daily}, stage 2 gap {row.stage2Gap}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Mechanical hygiene</h2>
          <p className="mt-2 text-sm">Technical minimum crew {inputs.production_copy.duct_technical_minimum_crew}. Preferred crew {inputs.production_copy.duct_preferred_crew}. Workbook labor still prices the duct job with all three technicians on one crew; the third person is also described as a shared floater across two units. The labor math follows the crew formula.</p>
          <p className="mt-2 text-sm">Floor/drop {inputs.production_copy.floor_per_drop}. Book/drop {inputs.production_copy.book_per_drop}. Drops {inputs.production_copy.typical_drops}.</p>
          <NumberField label="Target site clock" value={inputs.services.duct_12_drop_floor.site_clock_hours} onChange={(value) => onService('duct_12_drop_floor', 'site_clock_hours', value)} />
          <NumberField label="Stress site clock" value={inputs.services.duct_12_drop_stress.site_clock_hours} onChange={(value) => onService('duct_12_drop_stress', 'site_clock_hours', value)} />
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4" data-testid="hvac-card">
          <h2 className="font-semibold">HVAC / AHU — Future / Licensing Dependent</h2>
          <p className="mt-2 text-sm">{EXPLANATIONS.hvac}</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inputs.hvac_delivery_authorized === true}
              onChange={(event) => onInput((current) => ({ ...structuredClone(current), hvac_delivery_authorized: event.target.checked }))}
            />
            HVAC delivery authorized in this plan
          </label>
          <p className="mt-2 text-sm" data-testid="hvac-revenue-missing">{view.missing.hvacRevenue}</p>
          <p className="mt-2 text-sm">{inputs.hvac_delivery_authorized ? 'Stage 3 + HVAC is the headline.' : view.hvacDisabledCopy}</p>
        </div>
      </div>
    </div>
  );
}

function Pricing({ view, inputs, onService }) {
  return (
    <div className="space-y-4" data-testid="finance-pricing">
      <Explain title="Pricing diagnostics">{EXPLANATIONS.pricing} Each row shows the planned price, both capacity prices, and the signed variance. A price-band status is omitted until one is defined.</Explain>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {['Service', 'Planned', 'Site clock', 'Unit hours', 'Travel hours', 'Labor', 'Materials', 'Dispatch', 'Direct job', 'Indirect', 'Fully supported', 'Stage 1 cap.', 'Stage 2 cap.', 'Variance vs stage 2'].map((heading) => (
                <th key={heading} className="px-2 py-2">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.services.map((service) => (
              <tr key={service.key} className="border-t border-slate-100" data-testid={`price-row-${service.key}`}>
                <td className="px-2 py-2">{service.label}</td>
                <td className="px-2 py-2">
                  <NumberField label="" value={inputs.services[service.key].planned_price} onChange={(value) => onService(service.key, 'planned_price', value)} />
                </td>
                <td className="px-2 py-2" data-testid={`site-${service.key}`}>{service.siteClock}</td>
                <td className="px-2 py-2">{service.unitHours}</td>
                <td className="px-2 py-2" data-testid={`travel-${service.key}`}>{service.travelHours}</td>
                <td className="px-2 py-2">{service.directLabor}</td>
                <td className="px-2 py-2">{service.materials}</td>
                <td className="px-2 py-2">{service.dispatch}</td>
                <td className="px-2 py-2">{service.directJobCost}</td>
                <td className="px-2 py-2">{service.indirect}</td>
                <td className="px-2 py-2">{service.fullySupported}</td>
                <td className="px-2 py-2">{service.stage1Capacity}</td>
                <td className="px-2 py-2">{service.stage2Capacity}</td>
                <td className="px-2 py-2">{service.variance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm">Stage 2 indirect per productive unit-hour {view.controls.indirectPerHour}. Target duct per drop {view.controls.ductTargetPerDrop}. Stress duct per drop {view.controls.ductStressPerDrop}. Suggested stress book increment {view.controls.suggestedStressBook}.</p>
      <p className="text-xs text-slate-500">{inputs.services.duct_plus_ahu_package.dispatch_note} Package site window is the max of the duct and AHU clocks. Package unit-hours are the sum.</p>
    </div>
  );
}

function Stages({ view, inputs }) {
  const cards = [...view.stages.filter((stage) => stage.key !== 'stage_3'), view.stage3Headline];
  return (
    <div className="space-y-4" data-testid="finance-stages">
      <Explain title="Growth stages">{inputs.stages.stage_2.operating_model} {view.advisory}</Explain>
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <article key={card.key} className="rounded-lg border border-slate-200 bg-white p-4" data-testid={`stage-card-${card.key}`}>
            <h2 className="font-semibold">{card.label}</h2>
            <p className="mt-2 text-sm text-slate-600">{inputs.stages[card.key === 'stage_3_core' || card.key === 'stage_3_plus_hvac' ? 'stage_3' : card.key]?.operating_model}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>Units <span className="font-medium">{card.units}</span></div>
              <div>Field headcount <span className="font-medium">{card.fieldHeadcount}</span></div>
              <div>Cash cost <span className="font-medium">{card.cash}</span></div>
              <div>Economic cost <span className="font-medium">{card.economic}</span></div>
              <div>Required revenue <span className="font-medium">{card.requiredRevenue}</span></div>
              <div>Available-day hurdle <span className="font-medium">{card.perAvailableDay}</span></div>
              <div>Realized-day hurdle <span className="font-medium">{card.perRealizedDay}</span></div>
              <div>Hour hurdle <span className="font-medium">{card.perHour}</span></div>
              <div>Liquidity <span className="font-medium">{card.liquidity}</span></div>
              <div>Readiness <span className="font-medium" data-testid={`readiness-${card.key}`}>{card.readiness}</span></div>
            </dl>
            {card.caveat ? <p className="mt-3 text-xs text-slate-600" data-testid="stage3-core-caveat">{card.caveat}</p> : null}
          </article>
        ))}
      </div>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <p>{view.hvacEnabled ? 'Stage 3 + HVAC includes HVAC technician payroll.' : view.hvacDisabledCopy}</p>
        <p className="mt-2" data-testid="hvac-revenue-missing">{view.missing.hvacRevenue}</p>
        <p className="mt-2">{STAGE_3_CORE_CAVEAT}</p>
        <p className="mt-2">Core units: {view.missing.stage3CoreUnits}. Core utilization: {view.missing.stage3CoreUtilization}. Core productive hours/day: {view.missing.stage3CoreProductiveHoursPerDay}. HVAC non-labor share: {view.missing.hvacNonLaborShare}.</p>
      </div>
    </div>
  );
}

function Checkin({ view }) {
  return (
    <div className="space-y-4" data-testid="finance-checkin">
      <Explain title="Monthly check-in">No authoritative actuals source is mapped. Actual and variance stay blank. A monthly plan series is not defined, so none is invented. There is no entry form and nothing is stored.</Explain>
      <p className="text-sm" data-testid="actuals-missing">Actuals source: {view.missing.actualsSource}. Monthly plan series: {view.missing.monthlyPlanSeries}.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Metric</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Actual</th>
              <th className="px-3 py-2">Variance</th>
              <th className="px-3 py-2">Favorable direction</th>
            </tr>
          </thead>
          <tbody>
            {view.checkin.map((row) => (
              <tr key={row.key} className="border-t border-slate-100" data-testid={`checkin-${row.key}`}>
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2">{row.plan}</td>
                <td className="px-3 py-2">{row.actual}</td>
                <td className="px-3 py-2">{row.variance}</td>
                <td className="px-3 py-2">{row.direction === null ? 'Not declared' : row.direction === 'higher' ? 'Higher is favorable' : 'Lower is favorable'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
