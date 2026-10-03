/**
 * Report packets for the eight governed presets.
 * Every figure is copied from buildDecisionSupport, buildFinanceView,
 * or an engine field already on `result`, then formatted with the
 * existing display helpers. This module does not define a metric.
 */
import { CHECKIN_FIELDS, REVENUE_DEFINITION, plannedFactsForMonth } from './actuals.js';
import { BASIS_COPY, displayCheckinValue } from './modes.js';
import { presentLabel } from './presentLabel.js';
import { EXPLANATIONS, MISSING_MARK, showCents, showMoney } from './viewModel.js';

export const HVAC_REPORT_HEADING = 'Future/Licensing Dependent HVAC';

export const FINANCE_REPORT_PRESETS = Object.freeze([
  { id: 'monthly-summary', title: 'Monthly Financial Summary' },
  { id: 'owner-operating', title: 'Owner Operating Report' },
  { id: 'cost-structure', title: 'Cost Structure Report' },
  { id: 'growth-readiness', title: 'Growth Readiness Report' },
  { id: 'pricing-economics', title: 'Pricing & Service Economics' },
  { id: 'working-capital', title: 'Working Capital Report' },
  { id: 'assumptions', title: 'Assumptions Report' },
  { id: 'plan-vs-actual', title: 'Plan vs. Actual' },
]);

const COST_STAGE_KEYS = Object.freeze([
  'stage_0',
  'stage_1',
  'stage_2',
  'stage_3',
  'stage_3_core',
  'stage_3_plus_hvac',
]);

const COST_COMPONENTS = Object.freeze([
  ['hiredFieldPayroll', 'Hired field payroll'],
  ['supportPayroll', 'Support payroll'],
  ['directProductionNonLabor', 'Direct production, non-labor'],
  ['indirectField', 'Indirect field'],
  ['ga', 'G&A'],
  ['sales', 'Sales'],
  ['insurance', 'Insurance'],
  ['indirectNonLabor', 'Indirect non-labor'],
  ['ownerManagementComp', 'Owner management compensation'],
  ['ownerFieldReplacement', 'Owner field reserve'],
  ['cashOperatingCost', 'Cash operating cost'],
  ['economicOperatingCost', 'Economic operating cost'],
]);

const STRUCTURAL_FIELDS = Object.freeze([
  ['weeks_per_year', 'Weeks per year'],
  ['months_per_year', 'Months per year'],
  ['days_per_month_ar', 'Days per month for AR'],
  ['rounding_increment_usd', 'Rounding increment'],
]);

function presetById(id) {
  return FINANCE_REPORT_PRESETS.find((item) => item.id === id) || null;
}

function text(value) {
  if (value === null || value === undefined || value === '') return MISSING_MARK;
  return presentLabel(String(value));
}

function identifier(value) {
  if (value === null || value === undefined || value === '') return MISSING_MARK;
  return String(value);
}

function rowDisplay(rows, key, side) {
  const row = (rows || []).find((item) => item.key === key);
  if (!row) return MISSING_MARK;
  return row[side]?.display || MISSING_MARK;
}

function derivedFacts(derived, prefix) {
  const source = derived || {};
  return [
    ['Average ticket', source.averageTicket, `${prefix}-average-ticket`],
    ['Revenue per productive hour', source.revenuePerHour, `${prefix}-revenue-per-hour`],
    ['Jobs per productive hour', source.jobsPerHour, `${prefix}-jobs-per-hour`],
    ['Field payroll share of revenue', source.fieldPayrollShare, `${prefix}-field-payroll-share`],
    ['Indirect cost share of revenue', source.indirectCostShare, `${prefix}-indirect-share`],
    ['Portal share', source.portalShare, `${prefix}-portal-share`],
    ['Direct share', source.directShare, `${prefix}-direct-share`],
    ['AR / revenue', source.arOverRevenue, `${prefix}-ar-over-revenue`],
    ['Cash reserve / revenue', source.cashReserveOverRevenue, `${prefix}-cash-over-revenue`],
  ].map(([label, value, testId]) => ({ label, value: text(value), testId }));
}

function comparisonBlock(title, rows, prefix) {
  return {
    type: 'comparison',
    title,
    prefix,
    columns: ['Metric', 'Plan', 'Actual', 'Variance', 'Variance %'],
    rows: (rows || []).map((row) => ({
      key: row.key,
      label: row.label,
      plan: row.plan.display,
      actual: row.actual.display,
      variance: row.variance.display,
      variancePct: row.variancePct,
    })),
  };
}

function factBlock(title, pairs) {
  return {
    type: 'facts',
    title,
    rows: pairs.map((pair) => (Array.isArray(pair)
      ? { label: pair[0], value: text(pair[1]), testId: pair[2] }
      : { label: pair.label, value: text(pair.value), testId: pair.testId })),
  };
}

function noteBlock(textValue) {
  return { type: 'note', text: textValue };
}

function storedBasis(record, inputs) {
  if (!record || record.schema_version !== 2) {
    return { copy: BASIS_COPY.no_monthly_basis, months: [] };
  }
  const keys = Object.keys(inputs?.monthly_basis || {}).sort();
  return {
    copy: BASIS_COPY.declared_monthly_basis,
    months: keys.map((month) => {
      const facts = plannedFactsForMonth({ schema_version: 2, inputs }, month) || {};
      return {
        month,
        label: String(month).slice(0, 7),
        rows: CHECKIN_FIELDS.map((field) => ({
          key: field.key,
          label: field.technical,
          value: displayCheckinValue(field.kind, facts[field.key]),
        })),
      };
    }),
  };
}

function costTable(result) {
  const stages = COST_STAGE_KEYS.map((key) => {
    const stage = result?.stages?.[key] || null;
    const label = stage?.label || key;
    return {
      key,
      label: key === 'stage_3_plus_hvac' ? `${label} (${HVAC_REPORT_HEADING})` : label,
    };
  });
  return {
    type: 'table',
    title: 'Cost components by stage',
    testId: 'report-cost-table',
    columns: ['Component', ...stages.map((stage) => stage.label)],
    rows: COST_COMPONENTS.map(([key, label]) => ({
      label,
      cells: stages.map((stage) => showMoney(result?.stages?.[stage.key]?.[key] ?? null)),
    })),
  };
}

function contextFor(support, record) {
  const planBits = record
    ? [`Status ${record.status || MISSING_MARK}`, `Schema version ${record.schema_version ?? MISSING_MARK}`, `Plan ${record.id || MISSING_MARK}`]
    : ['No stored plan.'];
  return {
    period: support?.latest?.label || MISSING_MARK,
    basis: support?.latest?.basisCopy || BASIS_COPY.no_actual,
    stage: support?.stageLabel || MISSING_MARK,
    plan: planBits.join('. '),
    comparisonPlan: support?.latest?.comparisonPlanId || MISSING_MARK,
    schemaVersion: support?.latest?.schemaVersion == null ? MISSING_MARK : String(support.latest.schemaVersion),
  };
}

function screenNote(dirty, conflict) {
  if (conflict && dirty) return 'Changed elsewhere. Your unsaved edits are kept in Guided. These figures include them.';
  if (conflict) return 'Changed elsewhere. Return to Guided to reload the latest plan.';
  if (dirty) return 'These figures include unsaved edits. Return to Guided to save or discard them.';
  return null;
}

function monthlySummary(support) {
  return [
    noteBlock(REVENUE_DEFINITION),
    noteBlock(support.appointmentBoundary),
    comparisonBlock('Latest month', support.latest.rows, 'report'),
    factBlock('Derived from the latest actual', derivedFacts(support.actualDerived, 'report-derived')),
    factBlock('Derived from the planned month', derivedFacts(support.plannedDerived, 'report-planned-derived')),
    factBlock('Not connected', (support.unconnected || []).map((item) => [item.label, item.display, `report-unconnected-${item.key}`])),
  ];
}

function ownerOperating(support) {
  const earned = rowDisplay(support.latest.rows, 'total_revenue', 'actual');
  return [
    factBlock('Owner summary', [
      ['Selected stage', support.stageLabel, 'report-stage'],
      ['Required monthly revenue', support.requiredMonthlyRevenue, 'report-required-revenue'],
      ['Actual earned revenue', earned, 'report-actual-earned-revenue'],
      ['Cash operating cost', support.cashOperatingCost, 'report-cash-cost'],
      ['Economic operating cost', support.economicOperatingCost, 'report-economic-cost'],
      ['Liquidity planning target', support.liquidity, 'report-liquidity'],
      ['Readiness', support.readiness, 'report-readiness'],
      ['Utilization band', support.utilizationBand, 'report-utilization'],
      ['Productive unit-hours', support.productiveHours, 'report-productive-hours'],
      ['Revenue per productive unit-hour', support.perHour, 'report-per-hour'],
      ['Field headcount', support.fieldHeadcount, 'report-field-headcount'],
      ['Owner field reserve', support.ownerFieldReserve, 'report-owner-reserve'],
      ['Hired field payroll', support.hiredFieldPayroll, 'report-hired-payroll'],
    ]),
    {
      type: 'list',
      title: 'Material exceptions',
      testId: 'report-exceptions',
      items: (support.exceptions || []).map((item) => text(item.text)),
    },
    noteBlock(support.appointmentBoundary),
    factBlock('Not connected', (support.unconnected || []).map((item) => [item.label, item.display, `report-unconnected-${item.key}`])),
  ];
}

function growthReadiness(support, view) {
  const stages = view?.stages || [];
  return [
    {
      type: 'facts',
      title: HVAC_REPORT_HEADING,
      testId: 'report-hvac',
      rows: [
        { label: 'Identification', value: HVAC_REPORT_HEADING, testId: 'report-hvac-name' },
        { label: 'Authorization', value: text(view ? (view.hvacEnabled ? 'Stage 3 + HVAC' : view.hvacDisabledCopy) : MISSING_MARK), testId: 'report-hvac-authorization' },
        { label: 'HVAC revenue', value: text(support.hvacRevenue), testId: 'report-hvac-revenue' },
        { label: 'Stage 3 note', value: text(view?.stage3Headline?.caveat || support.stage3Caveat), testId: 'report-hvac-caveat' },
      ],
    },
    noteBlock(EXPLANATIONS.hvac),
    {
      type: 'table',
      title: 'Stage readiness',
      testId: 'report-stage-readiness',
      columns: ['Stage', 'Required revenue', 'Cash cost', 'Economic cost', 'Liquidity', 'Readiness', 'Hurdle'],
      rows: stages.map((stage) => ({
        label: stage.label,
        cells: [stage.requiredRevenue, stage.cash, stage.economic, stage.liquidity, stage.readiness, stage.hurdle].map((cell) => text(cell)),
      })),
    },
    factBlock('Selected stage capacity', [
      ['Required monthly revenue', support.requiredMonthlyRevenue, 'report-required-revenue'],
      ['Liquidity planning target', support.liquidity, 'report-liquidity'],
      ['Weighted DSO', support.weightedDso, 'report-weighted-dso'],
      ['Estimated AR', support.estimatedAr, 'report-estimated-ar'],
      ['Operating cash float', support.operatingCashFloat, 'report-cash-float'],
      ['Utilization band', support.utilizationBand, 'report-utilization'],
      ['Productive unit-hours', support.productiveHours, 'report-productive-hours'],
      ['Field headcount', support.fieldHeadcount, 'report-field-headcount'],
    ]),
    factBlock('Scenario inputs on the selected stage', (support.assumptions || []).map((item) => [item.label, item.display, `report-assumption-${item.key}`])),
    {
      type: 'list',
      title: 'Incomplete states',
      testId: 'report-exceptions',
      items: (support.exceptions || []).map((item) => text(item.text)),
    },
    noteBlock(support.advisory || MISSING_MARK),
  ];
}

function pricingEconomics(view) {
  const services = view?.services || [];
  const routes = view?.routes || [];
  return [
    noteBlock(EXPLANATIONS.pricing),
    {
      type: 'table',
      title: 'Service economics',
      testId: 'report-services',
      columns: ['Service', 'Planned price', 'Direct labor', 'Materials', 'Dispatch', 'Direct job cost', 'Indirect', 'Fully supported', 'Stage 2 capacity', 'Signed variance'],
      rows: services.map((service) => ({
        label: service.label,
        cells: [
          service.plannedPrice,
          service.directLabor,
          service.materials,
          service.dispatch,
          service.directJobCost,
          service.indirect,
          service.fullySupported,
          service.stage2Capacity,
          service.variance,
        ],
      })),
    },
    factBlock('Capacity pricing diagnostics', [
      ['Stage 2 indirect per productive unit-hour', view?.controls?.indirectPerHour, 'report-indirect-per-hour'],
      ['Stage 2 duct per drop, target', view?.controls?.ductTargetPerDrop, 'report-duct-target'],
      ['Stage 2 duct per drop, stress', view?.controls?.ductStressPerDrop, 'report-duct-stress'],
      ['Suggested stress book price per drop', view?.controls?.suggestedStressBook, 'report-stress-book'],
    ]),
    {
      type: 'table',
      title: 'Route diagnostics',
      testId: 'report-routes',
      columns: ['Stops', 'Daily', 'Stage 1 gap', 'Stage 2 gap', 'Stage 2 ticket'],
      rows: routes.map((route) => ({
        label: route.stops,
        cells: [route.daily, route.stage1Gap, route.stage2Gap, route.ticketStage2],
      })),
    },
  ];
}

function workingCapital(support, view) {
  const cash = (support.assumptions || []).find((item) => item.key === 'cash_reserve');
  return [
    noteBlock(EXPLANATIONS.workingCapital),
    noteBlock(EXPLANATIONS.dso),
    noteBlock(view?.weightedDsoAssumption || MISSING_MARK),
    factBlock('Liquidity outputs', [
      ['Weighted DSO', support.weightedDso, 'report-weighted-dso'],
      ['Estimated AR', support.estimatedAr, 'report-estimated-ar'],
      ['Operating cash float', support.operatingCashFloat, 'report-cash-float'],
      ['Liquidity planning target', support.liquidity, 'report-liquidity'],
      ['Scenario cash reserve', cash?.display, 'report-scenario-cash'],
      ['Latest ending AR', rowDisplay(support.latest.rows, 'ar_ending', 'actual'), 'report-actual-ar'],
      ['Latest plan ending AR', rowDisplay(support.latest.rows, 'ar_ending', 'plan'), 'report-plan-ar'],
      ['Latest cash reserve', rowDisplay(support.latest.rows, 'cash_reserve', 'actual'), 'report-actual-cash'],
      ['Latest plan cash reserve', rowDisplay(support.latest.rows, 'cash_reserve', 'plan'), 'report-plan-cash'],
    ]),
    {
      type: 'table',
      title: 'Channel DSO assumptions',
      testId: 'report-channels',
      columns: ['Channel', 'Share', 'DSO days'],
      rows: (support.channels || []).map((channel) => ({
        label: channel.label,
        cells: [channel.share, channel.dso],
      })),
    },
    factBlock('Not connected', (support.unconnected || []).map((item) => [item.label, item.display, `report-unconnected-${item.key}`])),
  ];
}

function assumptions(support, view, inputs, record) {
  const basis = storedBasis(record, inputs);
  const structural = inputs?.structural || {};
  return [
    factBlock('Plan document', [
      ['Status', record?.status, 'report-plan-status'],
      ['Schema version', record ? record.schema_version : null, 'report-schema-version'],
      ['Notes', record?.notes, 'report-notes'],
      ['Channel share total', support.channelShareTotal, 'report-channel-total'],
    ]),
    noteBlock(basis.copy),
    factBlock('Structural inputs', STRUCTURAL_FIELDS.map(([key, label]) => [
      label,
      key === 'rounding_increment_usd' ? showCents(structural[key] ?? null) : displayCheckinValue('count', structural[key] ?? null),
      `report-structural-${key}`,
    ])),
    {
      type: 'table',
      title: 'Staff burden and wage',
      testId: 'report-burden',
      columns: ['Role', 'Wage', 'Burden'],
      rows: (support.burden || []).map((role) => ({
        label: role.label,
        cells: [role.wage, role.burden],
      })),
    },
    factBlock('Scenario inputs on the selected stage', (support.assumptions || []).map((item) => [item.label, item.display, `report-assumption-${item.key}`])),
    {
      type: 'months',
      title: 'Stored monthly basis',
      testId: 'report-stored-basis',
      months: basis.months,
    },
    {
      type: 'list',
      title: 'Source and caveats',
      testId: 'report-caveats',
      items: [
        support.advisory,
        ...(support.exceptions || []).map((item) => text(item.text)),
        ...(support.history || []).map((month) => `${month.label} source ${text(month.source)}. Note ${text(month.sourceNote)}.`),
      ].filter(Boolean),
    },
    noteBlock(view?.weightedDsoAssumption || MISSING_MARK),
  ];
}

function planVsActual(support) {
  const history = support.history || [];
  if (!history.length) {
    return [noteBlock(BASIS_COPY.no_actual)];
  }
  return history.map((month) => ({
    type: 'month',
    title: month.label,
    testId: `report-history-${month.label}`,
    comparisonPlan: identifier(month.comparisonPlanId),
    schemaVersion: month.schemaVersion == null ? MISSING_MARK : String(month.schemaVersion),
    basisKind: month.basisKind,
    basis: month.basisCopy,
    comparison: comparisonBlock(month.label, month.rows, `report-history-${month.label}`),
    actualDerived: derivedFacts(month.derived, `report-history-${month.label}-derived`),
    plannedDerived: derivedFacts(month.plannedDerived, `report-history-${month.label}-planned`),
  }));
}

export function buildFinanceReport({ id, support, view, result, inputs, record, generatedAt, dirty, conflict }) {
  const preset = presetById(id);
  if (!preset || !support) return null;
  const builders = {
    'monthly-summary': () => monthlySummary(support),
    'owner-operating': () => ownerOperating(support),
    'cost-structure': () => [
      noteBlock(EXPLANATIONS.directProduction),
      noteBlock(EXPLANATIONS.fieldOverhead),
      noteBlock(EXPLANATIONS.ga),
      noteBlock(EXPLANATIONS.ownerManagement),
      noteBlock(EXPLANATIONS.ownerField),
      costTable(result),
    ],
    'growth-readiness': () => growthReadiness(support, view),
    'pricing-economics': () => pricingEconomics(view),
    'working-capital': () => workingCapital(support, view),
    assumptions: () => assumptions(support, view, inputs, record),
    'plan-vs-actual': () => planVsActual(support),
  };
  const blocks = builders[preset.id]();
  return {
    id: preset.id,
    title: preset.title,
    generatedAt: text(generatedAt),
    context: contextFor(support, record),
    notice: screenNote(dirty, conflict),
    blocks,
  };
}
