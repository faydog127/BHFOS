import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import EntityBrandIdentity from '@/components/finance/EntityBrandIdentity';
import { FINANCE_REPORT_PRESETS, buildFinanceReport, screenNote } from '@/lib/finance/reports';

const PRINT_CSS = `
@font-face {
  font-family: "Finance Report Sans";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/assets/finance/report-sans.woff2") format("woff2");
}
@media print {
  [data-print-hide] { display: none !important; }
  html, body { background: #fff !important; }
  .report-sheet { max-width: none !important; background: #fff !important; color: #0f172a !important; padding-left: 0 !important; padding-right: 0 !important; }
  .overflow-x-auto { overflow: visible !important; }
  .report-block { break-inside: avoid; page-break-inside: avoid; }
  table { width: 100% !important; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr, th, td { break-inside: avoid; page-break-inside: avoid; }
  th, td { border-bottom: 1px solid #cbd5e1; padding: 4px 6px !important; text-align: left; vertical-align: top; font-size: 10px !important; white-space: normal !important; overflow-wrap: anywhere; }
  th { overflow-wrap: anywhere !important; word-break: normal !important; hyphens: manual !important; }
  .report-value { overflow-wrap: normal !important; word-break: normal !important; hyphens: manual !important; }
}
@media print {
  table:has(th:nth-child(10)) th, table:has(th:nth-child(10)) td { font-family: "Finance Report Sans", "Liberation Sans", "Nimbus Sans", "Noto Sans", sans-serif !important; font-weight: 400 !important; font-size: 8px !important; padding: 2px 1px !important; }
  table:has(th:nth-child(10)) th:first-child, table:has(th:nth-child(10)) td:first-child { width: 8%; overflow-wrap: anywhere !important; }
  table:has(th:nth-child(10)) th:not(:first-child) { overflow-wrap: normal !important; word-break: normal !important; hyphens: manual !important; }
  table:has(th:nth-child(10)) .report-value { white-space: nowrap !important; }
}
@page { margin: 12mm; }
`;

function FactTable({ title, rows, testId }) {
  return (
    <section className="report-block mt-6" data-testid={testId}>
      {title ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : null}
      <div className="mt-2 min-w-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.testId || row.label} className="border-t border-slate-200">
                <th className="py-2 pr-3 text-left font-medium text-slate-600" scope="row">{row.label}</th>
                <td className="report-value py-2 font-medium text-slate-950" data-testid={row.testId}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GridTable({ title, columns, rows, testId }) {
  return (
    <section className="report-block mt-6" data-testid={testId}>
      {title ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : null}
      <div className="mt-2 min-w-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              {columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-200">
                <th className="px-2 py-2 text-left font-medium text-slate-800" scope="row">{row.label}</th>
                {row.cells.map((cell, index) => (
                  <td key={`${row.label}-${columns[index + 1] || index}`} className="report-value px-2 py-2 font-medium text-slate-950">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Comparison({ block }) {
  return (
    <section className="report-block mt-6">
      <h2 className="text-sm font-semibold text-slate-900">{block.title}</h2>
      <div className="mt-2 min-w-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              {block.columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-200">
                <th className="px-2 py-2 text-left font-medium text-slate-800" scope="row">{row.label}</th>
                <td className="report-value px-2 py-2 font-medium" data-testid={`${block.prefix}-plan-${row.key.replaceAll('_', '-')}`}>{row.plan}</td>
                <td className="report-value px-2 py-2 font-medium" data-testid={`${block.prefix}-actual-${row.key.replaceAll('_', '-')}`}>{row.actual}</td>
                <td className="report-value px-2 py-2 font-medium" data-testid={`${block.prefix}-variance-${row.key.replaceAll('_', '-')}`}>{row.variance}</td>
                <td className="report-value px-2 py-2 font-medium">{row.variancePct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MonthBlock({ block }) {
  return (
    <section className="report-month mt-8 border-t border-slate-300 pt-4" data-testid={block.testId}>
      <h2 className="text-base font-semibold text-slate-950">{block.title}</h2>
      <p className="mt-1 text-sm text-slate-700" data-testid={`${block.testId}-basis`}>{block.basis}</p>
      <p className="mt-1 text-sm text-slate-700">Comparison plan <span data-testid={`${block.testId}-comparison-plan`}>{block.comparisonPlan}</span></p>
      <p className="mt-1 text-sm text-slate-700">Schema version <span data-testid={`${block.testId}-schema`}>{block.schemaVersion}</span></p>
      <Comparison block={block.comparison} />
      <FactTable title="Derived from the actual" rows={block.actualDerived} />
      <FactTable title="Derived from the locked plan month" rows={block.plannedDerived} />
    </section>
  );
}

function Block({ block }) {
  if (block.type === 'note') {
    return <p className="report-block mt-4 text-sm leading-6 text-slate-700">{block.text}</p>;
  }
  if (block.type === 'facts') return <FactTable title={block.title} rows={block.rows} testId={block.testId} />;
  if (block.type === 'table') return <GridTable title={block.title} columns={block.columns} rows={block.rows} testId={block.testId} />;
  if (block.type === 'comparison') return <Comparison block={block} />;
  if (block.type === 'list') {
    return (
      <section className="report-block mt-6" data-testid={block.testId}>
        <h2 className="text-sm font-semibold text-slate-900">{block.title}</h2>
        <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-slate-800">
          {block.items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
        </ul>
      </section>
    );
  }
  if (block.type === 'months') {
    return (
      <section className="report-block mt-6" data-testid={block.testId}>
        <h2 className="text-sm font-semibold text-slate-900">{block.title}</h2>
        {block.months.length === 0 ? <p className="mt-2 text-sm text-slate-700">--</p> : null}
        {block.months.map((month) => (
          <div key={month.month} className="mt-4" data-testid={`report-basis-${month.label}`}>
            <h3 className="text-sm font-semibold">{month.label}</h3>
            <FactTable rows={month.rows.map((row) => ({ ...row, testId: `report-basis-${month.label}-${row.key.replaceAll('_', '-')}` }))} />
          </div>
        ))}
      </section>
    );
  }
  if (block.type === 'month') return <MonthBlock block={block} />;
  return null;
}

export default function FinanceReportScreen({
  reportId,
  entityId,
  base,
  support,
  view,
  result,
  inputs,
  record,
  dirty,
  conflict,
}) {
  const [generatedAt] = useState(() => new Date().toISOString());
  const [printReady, setPrintReady] = useState(false);
  useEffect(() => {
    let live = true;
    const load = document.fonts.load('400 8px "Finance Report Sans"');
    Promise.resolve(load).catch(() => undefined).then(() => {
      if (live) setPrintReady(true);
    });
    return () => { live = false; };
  }, []);
  const liveNotice = screenNote(dirty, conflict);
  const report = reportId === 'index' ? null : buildFinanceReport({
    id: reportId,
    support,
    view,
    result,
    inputs,
    record,
    generatedAt,
    dirty,
    conflict,
  });

  return (
    <div className="min-h-screen min-w-0 bg-white text-slate-950" data-testid="finance-reports">
      <style>{PRINT_CSS}</style>
      <div className="border-b border-slate-200 px-4 py-3" data-print-hide="true">
        <div className="flex flex-wrap items-center gap-3">
          <NavLink className="inline-flex min-h-11 items-center text-sm font-medium text-slate-900 underline" to={base}>Back to planning</NavLink>
          <NavLink className="inline-flex min-h-11 items-center text-sm font-medium text-slate-900 underline" data-testid="finance-report-index-link" to={`${base}/reports`}>All reports</NavLink>
        </div>
        <nav className="mt-2 flex flex-wrap gap-2" aria-label="Reports">
          {FINANCE_REPORT_PRESETS.map((item) => (
            <NavLink
              key={item.id}
              to={`${base}/reports/${item.id}`}
              data-testid={`finance-report-link-${item.id}`}
              className={({ isActive }) => `inline-flex min-h-11 items-center rounded border px-3 text-sm ${isActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'}`}
            >
              {item.title}
            </NavLink>
          ))}
        </nav>
      </div>
      <article className="report-sheet mx-auto min-w-0 max-w-5xl px-4 py-6" data-print-ready={printReady ? 'yes' : 'no'} data-testid={report ? `finance-report-${report.id}` : 'finance-report-index'}>
        {report ? (
          <>
            <header className="report-block border-b border-slate-300 pb-4">
              <EntityBrandIdentity entityId={entityId} />
              <h1 className="mt-2 text-2xl font-semibold" data-testid="finance-report-title">{report.title}</h1>
              <p className="mt-2 text-sm text-slate-700">Reporting period <span data-testid="finance-report-period">{report.context.period}</span></p>
              <p className="mt-1 text-sm text-slate-700" data-testid="finance-report-basis">{report.context.basis}</p>
              <p className="mt-1 text-sm text-slate-700">Generated <time data-testid="finance-report-generated-at" dateTime={report.generatedAt}>{report.generatedAt}</time> UTC</p>
              <p className="mt-1 text-sm text-slate-700" data-testid="finance-report-plan-context">{report.context.plan} Selected stage {report.context.stage}. Latest comparison plan {report.context.comparisonPlan}. Latest schema {report.context.schemaVersion}.</p>
              {report.notice ? <p className="mt-3 text-sm text-slate-800" data-testid="finance-report-notice">{report.notice}</p> : null}
            </header>
            {report.blocks.map((block, index) => <Block key={`${block.type}-${block.title || index}`} block={block} />)}
            <footer className="report-block mt-8 border-t border-slate-300 pt-4" data-testid="finance-report-footer">
              <EntityBrandIdentity entityId={entityId} variant="footer" testId="entity-brand-footer" />
            </footer>
          </>
        ) : (
          <>
            <header className="report-block border-b border-slate-300 pb-4">
              <EntityBrandIdentity entityId={entityId} />
              <h1 className="mt-2 text-2xl font-semibold" data-testid="finance-report-title">Reports</h1>
              <p className="mt-2 text-sm text-slate-700">Generated <time data-testid="finance-report-generated-at" dateTime={generatedAt}>{generatedAt}</time> UTC</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">Eight reports. They read the plan on this screen and Monthly Check-In. They do not save.</p>
              {liveNotice ? <p className="mt-3 text-sm text-slate-800" data-testid="finance-report-notice">{liveNotice}</p> : null}
            </header>
            <ol className="mt-4 list-decimal pl-5 text-sm leading-7">
              {FINANCE_REPORT_PRESETS.map((item) => <li key={item.id}>{item.title}</li>)}
            </ol>
            {reportId !== 'index' ? <p className="mt-4 text-sm text-slate-700">That report is not one of the eight.</p> : null}
            <footer className="report-block mt-8 border-t border-slate-300 pt-4" data-testid="finance-report-footer">
              <EntityBrandIdentity entityId={entityId} variant="footer" testId="entity-brand-footer" />
            </footer>
          </>
        )}
      </article>
    </div>
  );
}
