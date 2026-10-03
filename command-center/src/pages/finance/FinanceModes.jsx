import React from 'react';
import { NavLink } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FINANCE_MODES, GUIDED_BRIEFS } from '@/lib/finance/modes';
import { showMoney } from '@/lib/finance/viewModel';

const STEPS = [
  ['what', 'What this is'],
  ['enter', 'What to enter'],
  ['why', 'Why it matters'],
  ['affects', 'What it affects'],
  ['result', 'Result'],
];

export function ModeSwitch({ mode, onMode }) {
  return (
    <div
      role="tablist"
      aria-label="Planning mode"
      data-testid="finance-mode"
      data-mode={mode}
      className="grid grid-cols-3 gap-1 rounded-md border border-slate-300 bg-white p-1"
    >
      {FINANCE_MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          data-testid={`finance-mode-${item.id}`}
          className={`min-h-11 rounded px-2 py-2 text-left text-xs font-medium leading-4 sm:text-sm ${mode === item.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          onClick={() => onMode(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function GuidedBrief({ section }) {
  const copy = GUIDED_BRIEFS[section] || GUIDED_BRIEFS.overview;
  return (
    <details open className="mb-4 rounded border border-slate-200 bg-white" data-testid="finance-guided-brief">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-900">How to use this section</summary>
      <ol className="divide-y divide-slate-100 border-t border-slate-200">
        {STEPS.map(([key, label]) => (
          <li key={key} className="grid gap-1 px-3 py-2 sm:grid-cols-[9.5rem_minmax(0,1fr)]" data-testid={`guided-${key}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            <span className="text-sm leading-6 text-slate-800">{copy[key]}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function EditInGuided({ onEdit }) {
  return (
    <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900" data-testid="finance-edit-in-guided" onClick={onEdit}>
      Edit assumptions in Guided
    </button>
  );
}

function FactLine({ testId, label, value, note }) {
  return (
    <div className="grid gap-1 border-b border-slate-200 py-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(6rem,0.6fr)] sm:items-baseline">
      <dt className="text-sm text-slate-700">{label}</dt>
      <dd className="text-sm font-semibold text-slate-950 sm:text-right">
        <span data-testid={testId}>{value}</span>
        {note ? <span className="mt-0.5 block text-xs font-normal text-slate-500 sm:text-right">{note}</span> : null}
      </dd>
    </div>
  );
}

function ComparisonTable({ rows, prefix }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Metric</th>
            <th className="py-2 pr-3 font-medium">Plan</th>
            <th className="py-2 pr-3 font-medium">Actual</th>
            <th className="py-2 pr-3 font-medium">Variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-slate-100">
              <th className="py-2 pr-3 text-left font-normal text-slate-700">{row.label}</th>
              <td className="py-2 pr-3 font-medium" data-testid={`${prefix}-plan-${row.key.replaceAll('_', '-')}`}>{row.plan.display}</td>
              <td className="py-2 pr-3 font-medium" data-testid={`${prefix}-actual-${row.key.replaceAll('_', '-')}`}>{row.actual.display}</td>
              <td className="py-2 pr-3 font-medium" data-testid={`${prefix}-variance-${row.key.replaceAll('_', '-')}`}>{row.variance.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeriesChart({ rows, bars, testId }) {
  return (
    <div className="mt-3 h-52 w-full min-w-0" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip formatter={(value) => showMoney(value)} />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} name={bar.name} fill={bar.fill} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Boundaries({ support }) {
  return (
    <p className="text-xs leading-5 text-slate-600" data-testid="finance-unconnected">
      {support.unconnected.map((item) => `${item.label}: ${item.display}`).join('. ')}. {support.appointmentBoundary}
    </p>
  );
}

function StageFacts({ support }) {
  return (
    <dl>
      <FactLine testId="canonical-required-revenue" label="Required monthly revenue" value={support.requiredMonthlyRevenue} note={support.stageLabel} />
      <FactLine label="Operating cash cost" value={support.cashOperatingCost} note="Stage calculator" />
      <FactLine label="Economic operating cost" value={support.economicOperatingCost} note="Includes the owner field reserve" />
      <FactLine label="Cash reserve target" value={support.liquidity} note="Liquidity planning target" />
      <FactLine label="Field headcount" value={support.fieldHeadcount} />
      <FactLine label="Field payroll" value={support.hiredFieldPayroll} note="Hired field payroll for the selected stage" />
      <FactLine label="Owner field reserve" value={support.ownerFieldReserve} />
      <FactLine label="Productive unit-hours" value={support.productiveHours} />
      <FactLine label="Revenue per productive unit-hour" value={support.perHour} />
      <FactLine label="Readiness" value={support.readiness} note={support.advisory} />
      <FactLine label="Utilization band" value={support.utilizationBand} />
    </dl>
  );
}

export function ExecutiveView({ support, onEdit, checkinHref }) {
  return (
    <div className="space-y-6" data-testid="finance-executive">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Decision view</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">How the selected stage stands, and how the latest Monthly Check-In compares with the plan that month was associated to.</p>
        </div>
        <EditInGuided onEdit={onEdit} />
      </div>
      <section className="rounded border border-slate-200 bg-white px-3 sm:px-4">
        <h3 className="border-b border-slate-200 py-3 text-sm font-semibold">Selected stage</h3>
        <StageFacts support={support} />
      </section>
      <section className="rounded border border-slate-200 bg-white px-3 py-3 sm:px-4" data-testid="finance-latest-checkin">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="text-sm font-semibold">Latest Monthly Check-In</h3>
          <p className="text-sm text-slate-600" data-testid="decision-latest-month">{support.latest.label || '--'}</p>
        </div>
        <p className="mt-2 text-sm text-slate-700" data-testid="decision-basis-state">{support.latest.basisCopy}</p>
        <ComparisonTable rows={support.latest.rows} prefix="decision" />
        <p className="mt-3 text-xs text-slate-500">Ending AR is the check-in AR figure. Cash collected is not that figure.</p>
        <NavLink className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-slate-900 underline" to={checkinHref}>
          Enter or correct actuals on Monthly Check-In
        </NavLink>
      </section>
      <section className="rounded border border-slate-200 bg-white px-3 py-3 sm:px-4" data-testid="finance-exceptions">
        <h3 className="text-sm font-semibold">Needs attention</h3>
        <ul className="mt-2 divide-y divide-slate-100">
          {support.exceptions.map((item) => (
            <li key={item.id} className="py-2 text-sm leading-6 text-slate-800">{item.text}</li>
          ))}
        </ul>
        {support.stage3Caveat ? <p className="mt-2 text-xs leading-5 text-slate-600">{support.stage3Caveat}</p> : null}
        <p className="mt-2 text-xs text-slate-600">{support.hvacRevenue}</p>
      </section>
      <section className="rounded border border-slate-200 bg-white px-3 py-3 sm:px-4">
        <h3 className="text-sm font-semibold">Pricing diagnostics</h3>
        <p className="mt-1 text-xs text-slate-500">Capacity prices are diagnostics. They are not a customer pricing policy.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Service</th>
                <th className="py-2 pr-3 font-medium">Planned</th>
                <th className="py-2 pr-3 font-medium">Stage 2 capacity</th>
                <th className="py-2 pr-3 font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {support.services.map((service) => (
                <tr key={service.key} className="border-t border-slate-100">
                  <th className="py-2 pr-3 text-left font-normal">{service.label}</th>
                  <td className="py-2 pr-3">{service.plannedPrice}</td>
                  <td className="py-2 pr-3">{service.stage2Capacity}</td>
                  <td className="py-2 pr-3">{service.variance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Boundaries support={support} />
    </div>
  );
}

function Block({ title, testId, children }) {
  return (
    <section className="rounded border border-slate-200 bg-white px-3 py-3 sm:px-4" data-testid={testId}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function AdvancedView({ support, onEdit, checkinHref }) {
  return (
    <div className="space-y-4" data-testid="finance-advanced">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Advanced analytics</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">The same stage results and the same check-in comparison. Charts plot those figures and do not calculate new ones.</p>
        </div>
        <EditInGuided onEdit={onEdit} />
      </div>
      <Block title="Cost structure by stage" testId="advanced-cost">
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Stage</th>
                <th className="py-2 pr-3 font-medium">Operating cash cost</th>
                <th className="py-2 pr-3 font-medium">Economic cost</th>
                <th className="py-2 pr-3 font-medium">Required revenue</th>
              </tr>
            </thead>
            <tbody>
              {support.stageSeries.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <th className="py-2 pr-3 text-left font-normal">{row.label}</th>
                  <td className="py-2 pr-3">{row.cashDisplay}</td>
                  <td className="py-2 pr-3">{row.economicDisplay}</td>
                  <td className="py-2 pr-3">{row.requiredDisplay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">A blank stage figure is not drawn as zero. The table shows the calculator value, including a planned zero.</p>
        <SeriesChart
          testId="advanced-cost-chart"
          rows={support.stageSeries.map((row) => ({
            label: row.label,
            cashOperatingCost: row.cashOperatingCost,
            economicOperatingCost: row.economicOperatingCost,
          }))}
          bars={[
            { key: 'cashOperatingCost', name: 'Operating cash cost', fill: '#334155' },
            { key: 'economicOperatingCost', name: 'Economic cost', fill: '#64748b' },
          ]}
        />
      </Block>
      <Block title="Capacity and utilization" testId="advanced-capacity">
        <dl className="mt-1">
          <FactLine label="Productive unit-hours" value={support.productiveHours} />
          <FactLine label="Field headcount" value={support.fieldHeadcount} />
          <FactLine label="Revenue per productive unit-hour" value={support.perHour} />
          <FactLine label="Utilization band" value={support.utilizationBand} />
          <FactLine label="Actual revenue per productive hour" value={support.actualDerived.revenuePerHour} note="From the latest check-in" />
          <FactLine label="Actual jobs per productive hour" value={support.actualDerived.jobsPerHour} />
        </dl>
      </Block>
      <Block title="Service economics and pricing diagnostics" testId="advanced-pricing">
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                {['Service', 'Direct job', 'Fully supported', 'Planned', 'Stage 2 cap.', 'Variance'].map((heading) => (
                  <th key={heading} className="py-2 pr-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {support.services.map((service) => (
                <tr key={service.key} className="border-t border-slate-100">
                  <th className="py-2 pr-3 text-left font-normal">{service.label}</th>
                  <td className="py-2 pr-3">{service.directJobCost}</td>
                  <td className="py-2 pr-3">{service.fullySupported}</td>
                  <td className="py-2 pr-3">{service.plannedPrice}</td>
                  <td className="py-2 pr-3">{service.stage2Capacity}</td>
                  <td className="py-2 pr-3">{service.variance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SeriesChart
          testId="advanced-price-chart"
          rows={support.services.map((service) => ({ label: service.label, variance: service.varianceRaw }))}
          bars={[{ key: 'variance', name: 'Variance vs stage 2', fill: '#334155' }]}
        />
      </Block>
      <Block title="Working capital" testId="advanced-working-capital">
        <dl className="mt-1">
          <FactLine label="Liquidity planning target" value={support.liquidity} />
          <FactLine label="Estimated AR" value={support.estimatedAr} note="Stage illustration" />
          <FactLine label="Operating cash float" value={support.operatingCashFloat} />
          <FactLine label="Weighted DSO" value={support.weightedDso} />
          <FactLine label="Latest ending AR" value={support.latest.rows.find((row) => row.key === 'ar_ending')?.actual.display || '--'} />
          <FactLine label="Latest cash reserve" value={support.latest.rows.find((row) => row.key === 'cash_reserve')?.actual.display || '--'} />
        </dl>
      </Block>
      <Block title="Plan versus actual history" testId="advanced-history">
        <p className="mt-1 text-xs leading-5 text-slate-500">Each month uses its own comparison plan. A newer plan is not substituted.</p>
        <p className="mt-2 text-sm">Required monthly revenue <span data-testid="canonical-required-revenue">{support.requiredMonthlyRevenue}</span></p>
        {support.history.map((month) => (
          <div key={month.month} className="mt-4" data-testid={`history-month-${month.label}`}>
            <h4 className="text-sm font-semibold">{month.label}</h4>
            <p className="text-xs text-slate-500">{month.basisCopy}</p>
            <ComparisonTable rows={month.rows} prefix={`history-${month.label}`} />
          </div>
        ))}
        <SeriesChart
          testId="advanced-history-chart"
          rows={support.revenueHistory}
          bars={[
            { key: 'plan', name: 'Plan revenue', fill: '#334155' },
            { key: 'actual', name: 'Actual earned operating revenue', fill: '#94a3b8' },
          ]}
        />
        <NavLink className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline" to={checkinHref}>Open Monthly Check-In</NavLink>
      </Block>
      <Block title="Channel mix" testId="advanced-channels">
        <p className="mt-1 text-xs text-slate-500">Shares below are stored assumptions. Actual channel dollars are check-in facts. A share is not invented when a channel is missing.</p>
        <p className="mt-2 text-sm">Stored share total {support.channelShareTotal}. Latest portal share {support.actualDerived.portalShare}. Latest direct share {support.actualDerived.directShare}.</p>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {support.channels.map((channel) => (
            <li key={channel.key} className="flex justify-between gap-3 py-2">
              <span>{channel.label}</span>
              <span>Share {channel.share} · DSO {channel.dso}</span>
            </li>
          ))}
        </ul>
        <SeriesChart
          testId="advanced-channel-chart"
          rows={support.channelActuals.map((row) => ({ label: row.label, value: row.value }))}
          bars={[{ key: 'value', name: 'Actual channel revenue', fill: '#334155' }]}
        />
      </Block>
      <Block title="Labor efficiency and cost burden" testId="advanced-labor">
        <dl className="mt-1">
          <FactLine label="Hired field payroll" value={support.hiredFieldPayroll} />
          <FactLine label="Latest field payroll" value={support.latest.rows.find((row) => row.key === 'field_payroll')?.actual.display || '--'} />
          <FactLine label="Field payroll share of revenue" value={support.actualDerived.fieldPayrollShare} note="Latest check-in" />
          <FactLine label="Plan revenue per productive hour" value={support.plannedDerived?.revenuePerHour || '--'} />
        </dl>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Wage</th>
                <th className="py-2 pr-3 font-medium">Burden</th>
              </tr>
            </thead>
            <tbody>
              {support.burden.map((role) => (
                <tr key={role.key} className="border-t border-slate-100">
                  <th className="py-2 pr-3 text-left font-normal">{role.label}</th>
                  <td className="py-2 pr-3">{role.wage}</td>
                  <td className="py-2 pr-3">{role.burden}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
      <Block title="Assumptions" testId="advanced-assumptions">
        <p className="mt-1 text-xs text-slate-500">Entered values for the selected stage. They are not inferred from actuals.</p>
        <dl className="mt-1">
          {support.assumptions.map((item) => (
            <FactLine key={item.key} label={item.label} value={item.display} />
          ))}
        </dl>
      </Block>
      <Block title="Growth stage and scenario" testId="advanced-stages">
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {support.stageSeries.map((row) => (
            <li key={row.key} className="flex justify-between gap-3 py-2">
              <span>{row.label}</span>
              <span>{row.readiness}</span>
            </li>
          ))}
        </ul>
        <SeriesChart
          testId="advanced-revenue-chart"
          rows={support.stageSeries.map((row) => ({ label: row.label, requiredMonthlyRevenue: row.requiredMonthlyRevenue }))}
          bars={[{ key: 'requiredMonthlyRevenue', name: 'Required monthly revenue', fill: '#334155' }]}
        />
      </Block>
      <Boundaries support={support} />
    </div>
  );
}
