/**
 * Monthly Check-In entry and history.
 * Plan and variance stay blank unless a declared monthly basis exists.
 * Schema version 1 has none, so they stay blank even when a comparison plan is associated.
 */
import React, { useState } from 'react';
import {
  CHANNEL_ISSUE_COPY,
  CHECKIN_FIELDS,
  REVENUE_DEFINITION,
  actualFactsFromForm,
  declaredMonthlyBasis,
  derivedActualMetrics,
  formatStoredDecimal,
  parseActualMonth,
} from '@/lib/finance/actuals';
import { FAVORABLE_DIRECTION, variance } from '@/lib/finance/variance';
import { formatCurrencyCents, formatHours, formatNumber, formatPercentFromFraction } from '@/lib/finance/format';
import { MISSING_MARK } from '@/lib/finance/viewModel';

const DERIVED = Object.freeze([
  { key: 'average_ticket', label: 'Average ticket', technical: 'Total Revenue / jobs', kind: 'money' },
  { key: 'revenue_per_productive_hour', label: 'Revenue per productive hour', technical: 'Total Revenue / productive unit-hours', kind: 'money' },
  { key: 'portal_share', label: 'Portal share', technical: 'Portal / Total Revenue', kind: 'share' },
  { key: 'direct_share', label: 'Direct share', technical: 'Direct Residential + Commercial Direct / Total Revenue', kind: 'share' },
  { key: 'jobs_per_productive_hour', label: 'Jobs per productive hour', technical: 'Jobs / productive unit-hours', kind: 'number' },
  { key: 'field_payroll_pct_of_revenue', label: 'Field payroll share of revenue', technical: 'Field payroll / Total Revenue', kind: 'share' },
  { key: 'indirect_cost_pct_of_revenue', label: 'Indirect cost share of revenue', technical: 'Indirect cash costs / Total Revenue', kind: 'share' },
  { key: 'ar_over_revenue', label: 'AR compared with revenue', technical: 'Ending AR / Total Revenue', kind: 'share' },
  { key: 'cash_reserve_over_revenue', label: 'Cash reserve compared with revenue', technical: 'Cash reserve / Total Revenue', kind: 'share' },
]);

function blankForm() {
  const form = { notes: '', source_note: '' };
  for (const field of CHECKIN_FIELDS) form[field.key] = '';
  return form;
}

function formFromActual(row) {
  const form = blankForm();
  for (const field of CHECKIN_FIELDS) {
    if (field.kind === 'count') {
      form[field.key] = row[field.key] === null || row[field.key] === undefined ? '' : String(row[field.key]);
    } else {
      form[field.key] = formatStoredDecimal(row[field.key], 2);
    }
  }
  form.notes = row.notes || '';
  form.source_note = row.source_note || '';
  return form;
}

function monthLabel(value) {
  const text = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-01$/.exec(text);
  if (!match) return text || 'Month';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function showFact(kind, value) {
  if (value === null || value === undefined) return MISSING_MARK;
  if (kind === 'count') return String(value);
  if (kind === 'hours') return formatHours(Number(value));
  return formatCurrencyCents(Number(value));
}

function showDerived(kind, value) {
  if (value === null || value === undefined) return MISSING_MARK;
  if (kind === 'money') return formatCurrencyCents(value);
  if (kind === 'share') return formatPercentFromFraction(value);
  return formatNumber(value, 2);
}

function messageFor(result) {
  if (!result) return 'The month could not be saved.';
  if (result.code === 'version_conflict') return 'Changed elsewhere. Your edits are still on this screen. Reload the month before saving again.';
  if (result.code === '23505' || String(result.detail || '').includes('finance_actuals_month_key')) {
    return 'This month already has an actual. Open that month to correct it.';
  }
  if (CHANNEL_ISSUE_COPY[result.code]) return CHANNEL_ISSUE_COPY[result.code];
  if (String(result.detail || '').includes('finance_actuals_channel_reconcile')) {
    return CHANNEL_ISSUE_COPY.known_channels_exceed_total;
  }
  if (String(result.detail || '').includes('finance_actuals_require_approved_plan')) {
    return 'Only an approved plan can be used as the comparison basis.';
  }
  if (String(result.detail || '').includes('finance_actuals_basis_locked')) {
    return 'The comparison basis is already set and cannot be changed.';
  }
  const field = CHECKIN_FIELDS.find((item) => item.key === result.field);
  const fieldName = field ? field.guided : 'This field';
  if (result.code === 'amount_too_large' && field?.kind === 'hours') return `${fieldName} can have at most 8 digits before the cents.`;
  if (result.code === 'amount_too_large') return `${fieldName} can have at most 12 digits before the cents.`;
  if (result.code === 'count_too_large') return `${fieldName} must be a whole number up to 2147483647, or blank.`;
  if (result.code === 'invalid_amount') return 'Enter a blank, or a zero or positive amount. Money and hours keep cents. Counts are whole jobs. A blank is unknown, not zero.';
  if (result.code === 'invalid_month') return 'Choose the reporting month.';
  if (result.code === 'invalid_notes') return 'Notes must be 2000 characters or fewer.';
  if (result.code === 'finance_writes_disabled') return 'Finance writes are disabled. This screen is read-only.';
  return 'The month could not be saved.';
}

export default function MonthlyCheckIn({
  actuals,
  approvedPlan,
  writesEnabled,
  onCreate,
  onCorrect,
  onAssociate,
  onReload,
}) {
  const rows = Array.isArray(actuals) ? actuals : [];
  const [selectedId, setSelectedId] = useState(null);
  const [monthInput, setMonthInput] = useState('');
  const [form, setForm] = useState(blankForm);
  const [associateOnCreate, setAssociateOnCreate] = useState(false);
  const [message, setMessage] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const selected = rows.find((row) => row.id === selectedId) || null;
  const approved = approvedPlan && approvedPlan.status === 'approved' ? approvedPlan : null;
  const basisLocked = Boolean(selected?.comparison_plan_id);
  const planBasis = declaredMonthlyBasis(approved);

  function openNew() {
    setSelectedId(null);
    setMonthInput('');
    setForm(blankForm());
    setAssociateOnCreate(false);
    setMessage(null);
    setConflict(false);
  }

  function openRow(row) {
    setSelectedId(row.id);
    setMonthInput(String(row.month || '').slice(0, 7));
    setForm(formFromActual(row));
    setAssociateOnCreate(false);
    setMessage(null);
    setConflict(false);
  }

  function editField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSave() {
    if (!writesEnabled || saving) return;
    const month = selected ? { ok: true, value: String(selected.month).slice(0, 10) } : parseActualMonth(monthInput);
    if (!month.ok) {
      setMessage(messageFor(month));
      return;
    }
    const parsed = actualFactsFromForm(form);
    if (!parsed.ok) {
      setMessage(messageFor(parsed));
      return;
    }
    setSaving(true);
    const result = selected
      ? await onCorrect({ id: selected.id, expectedVersion: selected.version, facts: parsed.facts })
      : await onCreate({
        month: month.value,
        facts: parsed.facts,
        comparisonPlanId: associateOnCreate && approved ? approved.id : null,
      });
    setSaving(false);
    if (!result?.ok) {
      setConflict(result?.code === 'version_conflict');
      setMessage(messageFor(result));
      return;
    }
    setConflict(false);
    setMessage(null);
    setSelectedId(result.actual.id);
    setMonthInput(String(result.actual.month || '').slice(0, 7));
    setForm(formFromActual(result.actual));
    setAssociateOnCreate(false);
  }

  async function onAssociateClick() {
    if (!writesEnabled || !selected || !approved || basisLocked || saving) return;
    setSaving(true);
    const result = await onAssociate({
      id: selected.id,
      expectedVersion: selected.version,
      comparisonPlanId: approved.id,
    });
    setSaving(false);
    if (!result?.ok) {
      setConflict(result?.code === 'version_conflict');
      setMessage(messageFor(result));
      return;
    }
    setConflict(false);
    setMessage(null);
    setForm(formFromActual(result.actual));
  }

  const parsedPreview = actualFactsFromForm(form);
  const previewFacts = parsedPreview.ok ? parsedPreview.facts : null;
  const derived = derivedActualMetrics(previewFacts || {});

  return (
    <div className="space-y-4" data-testid="finance-checkin">
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">Monthly check-in</h2>
        <p className="mt-2 leading-6" data-testid="checkin-revenue-definition">{REVENUE_DEFINITION}</p>
        <p className="mt-2 leading-6">Enter one actual for the month. Leave a field blank when you do not know it. Blank stays unknown. Zero means the amount really is zero. Cents are kept. This screen does not invent a monthly plan series.</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3" data-testid="checkin-history">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">History</h3>
            <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" data-testid="checkin-new" onClick={openNew}>New month</button>
          </div>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500" data-testid="checkin-empty">No months entered yet.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`w-full rounded px-2 py-2 text-left text-sm ${row.id === selectedId ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
                    data-testid={`checkin-history-${String(row.month).slice(0, 7)}`}
                    onClick={() => openRow(row)}
                  >
                    {monthLabel(row.month)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <form
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
          data-testid="checkin-entry"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-600">
              Reporting month
              <input
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                type="month"
                data-testid="checkin-month"
                value={monthInput}
                disabled={Boolean(selected) || !writesEnabled}
                onChange={(event) => setMonthInput(event.target.value)}
              />
            </label>
            <p className="text-xs text-slate-500 sm:pt-5">Source: entered by hand. No import is connected.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHECKIN_FIELDS.map((field) => (
              <label key={field.key} className="block text-xs text-slate-600">
                <span>{field.guided}</span>
                <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-slate-400">{field.technical}</span>
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  inputMode={field.kind === 'count' ? 'numeric' : 'decimal'}
                  data-testid={`checkin-${field.key.replaceAll('_', '-')}`}
                  value={form[field.key]}
                  disabled={!writesEnabled}
                  onChange={(event) => editField(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="block text-xs text-slate-600">
            Where these figures came from
            <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-slate-400">Source note</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              data-testid="checkin-source-note"
              value={form.source_note}
              disabled={!writesEnabled}
              onChange={(event) => editField('source_note', event.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-600">
            Notes for this month
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              data-testid="checkin-notes"
              value={form.notes}
              disabled={!writesEnabled}
              onChange={(event) => editField('notes', event.target.value)}
            />
          </label>
          <section className="rounded border border-slate-200 bg-slate-50 p-3 text-sm" data-testid="checkin-basis">
            {basisLocked ? (
              <p>Comparison basis is locked to the approved plan recorded for this month. A newer plan does not replace it. Plan and variance stay blank because that plan has no declared monthly figure.</p>
            ) : approved ? (
              selected ? (
                <div className="space-y-2">
                  <p>No comparison plan is associated, so Plan and Variance stay blank. Associating the current approved plan is optional and can be done only once.</p>
                  <button type="button" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:text-slate-400" data-testid="checkin-associate" onClick={onAssociateClick} disabled={!writesEnabled || saving}>Associate the approved plan</button>
                </div>
              ) : (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    data-testid="checkin-associate-on-create"
                    checked={associateOnCreate}
                    disabled={!writesEnabled}
                    onChange={(event) => setAssociateOnCreate(event.target.checked)}
                  />
                  <span>Also use the current approved plan as the comparison basis for this month. Leave this unchecked to save the month with no plan. This choice cannot be changed later.</span>
                </label>
              )
            ) : (
              <p data-testid="checkin-no-plan">No approved plan is available. This month can be saved without one. Plan and variance stay blank.</p>
            )}
            {planBasis === null ? <p className="mt-2 text-xs text-slate-500" data-testid="checkin-no-monthly-basis">No declared monthly basis. Plan and variance are not zero.</p> : null}
          </section>
          {conflict ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="checkin-version-conflict">
              {message}
              <button type="button" className="ml-3 underline" data-testid="checkin-reload" onClick={onReload}>Reload</button>
            </div>
          ) : null}
          {message && !conflict ? <p className="text-sm text-red-700" data-testid="checkin-error">{message}</p> : null}
          <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400" data-testid="checkin-save" disabled={!writesEnabled || saving}>
            {selected ? 'Save correction' : 'Save month'}
          </button>
          {selected ? <p className="text-xs text-slate-500" data-testid="checkin-version">Edit version {selected.version}. There is no delete.</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Metric</th>
                  <th className="px-2 py-2">Plan</th>
                  <th className="px-2 py-2">Actual</th>
                  <th className="px-2 py-2">Variance</th>
                  <th className="px-2 py-2">Favorable direction</th>
                </tr>
              </thead>
              <tbody>
                {CHECKIN_FIELDS.map((field) => {
                  const actual = previewFacts ? previewFacts[field.key] : null;
                  const delta = variance(actual === null ? null : Number(actual), null);
                  const direction = FAVORABLE_DIRECTION[field.key];
                  return (
                    <tr key={field.key} className="border-t border-slate-100" data-testid={`checkin-row-${field.key.replaceAll('_', '-')}`}>
                      <td className="px-2 py-2">{field.guided}</td>
                      <td className="px-2 py-2" data-testid={`checkin-plan-${field.key.replaceAll('_', '-')}`}>{MISSING_MARK}</td>
                      <td className="px-2 py-2" data-testid={`checkin-actual-${field.key.replaceAll('_', '-')}`}>{showFact(field.kind, actual)}</td>
                      <td className="px-2 py-2" data-testid={`checkin-variance-${field.key.replaceAll('_', '-')}`}>{delta === null ? MISSING_MARK : showFact(field.kind, delta)}</td>
                      <td className="px-2 py-2">{direction === 'higher' ? 'Higher is favorable' : direction === 'lower' ? 'Lower is favorable' : 'Not declared'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <section data-testid="checkin-derived">
            <h3 className="text-sm font-semibold">Calculated from this month</h3>
            <p className="mt-1 text-xs text-slate-500">These use the actuals above. A missing input stays blank. They are not a second revenue definition.</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {DERIVED.map((item) => (
                <div key={item.key} className="rounded border border-slate-100 px-2 py-2" data-testid={`checkin-derived-${item.key.replaceAll('_', '-')}`}>
                  <dt className="text-xs text-slate-500">{item.label}</dt>
                  <dd className="text-sm font-medium">{showDerived(item.kind, derived[item.key])}</dd>
                  <dd className="text-[11px] uppercase tracking-wide text-slate-400">{item.technical}</dd>
                </div>
              ))}
            </dl>
          </section>
        </form>
      </div>
    </div>
  );
}
