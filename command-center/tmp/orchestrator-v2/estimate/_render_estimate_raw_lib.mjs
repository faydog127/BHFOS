import {
  asString,
  assertEstimateInvariants,
  canonicalRel,
  mdInline,
  normalizeNewlines,
  formatMoneyUsd,
} from './_estimate_lib.mjs';

const renderEvidenceRefs = (refs) => {
  const lines = [];
  lines.push('## Evidence Refs');
  const arr = Array.isArray(refs) ? refs : [];
  for (const r of arr) {
    lines.push(`- type: ${mdInline(r?.type)} id: ${mdInline(r?.id)} uri: ${mdInline(r?.uri)}`);
  }
  if (!arr.length) lines.push('- (none)');
  lines.push('');
  return lines;
};

const renderListBlock = (heading, items) => {
  const lines = [];
  lines.push(`## ${heading}`);
  const arr = Array.isArray(items) ? items : [];
  for (const x of arr) lines.push(`- ${asString(x)}`);
  if (!arr.length) lines.push('- (none)');
  lines.push('');
  return lines;
};

const renderOptionPricingSummary = (opt) => {
  if (opt?.pricing) {
    return `pricing_total=${asString(opt.pricing.total_cents)} (${formatMoneyUsd(opt.pricing.total_cents)})`;
  }
  if (opt?.estimated_total) {
    return `estimated_total=${asString(opt.estimated_total.total_cents)} (${formatMoneyUsd(opt.estimated_total.total_cents)})`;
  }
  if (opt?.price_range) {
    return `price_range=${asString(opt.price_range.min_total_cents)}..${asString(opt.price_range.max_total_cents)} (${formatMoneyUsd(
      opt.price_range.min_total_cents
    )}–${formatMoneyUsd(opt.price_range.max_total_cents)})`;
  }
  return 'pricing=UNKNOWN';
};

const renderLineItems = (items) => {
  const lines = [];
  const arr = Array.isArray(items) ? items : [];
  for (const li of arr) {
    lines.push(
      `- ${asString(li.line_id)}: ${asString(li.name)} qty=${asString(li.quantity)} unit=${asString(li.unit)} unit_price_cents=${asString(
        li.unit_price_cents
      )} amount_cents=${asString(li.amount_cents)} taxable=${asString(li.taxable)}`
    );
    if (li?.notes) lines.push(`  - notes: ${asString(li.notes)}`);
  }
  if (!arr.length) lines.push('- (none)');
  return lines;
};

const renderBoundaries = (b) => {
  const lines = [];
  lines.push('### Scope Boundaries');
  const inc = Array.isArray(b?.included) ? b.included : [];
  const notInc = Array.isArray(b?.not_included) ? b.not_included : [];
  lines.push('- included:');
  for (const x of inc) lines.push(`  - ${asString(x)}`);
  if (!inc.length) lines.push('  - (none)');
  lines.push('- not_included:');
  for (const x of notInc) lines.push(`  - ${asString(x)}`);
  if (!notInc.length) lines.push('  - (none)');
  return lines;
};

export const renderEstimateRawV1 = ({ inputJsonPath, estimateJson }) => {
  const src = estimateJson || {};
  assertEstimateInvariants(src);

  const options = src.options || {};
  const desired = ['good', 'better', 'best'];
  const optionKeys = [
    ...desired.filter((k) => Object.prototype.hasOwnProperty.call(options, k)),
    ...Object.keys(options).filter((k) => !desired.includes(k)).sort(),
  ];

  const lines = [];
  lines.push('# Estimate v1 (Raw) — Judgment Contract');
  lines.push('');
  lines.push('Contract: `estimate_raw_v1`');
  lines.push('');
  lines.push(`Input: \`${canonicalRel(inputJsonPath)}\``);
  lines.push('');

  lines.push('## Snapshot');
  lines.push(`- tenant_id: ${mdInline(src.tenant_id)}`);
  lines.push(`- estimate_record_id: ${mdInline(src.estimate_record_id)}`);
  lines.push(`- estimate_number: ${mdInline(src.estimate_number)}`);
  lines.push(`- job_id: ${mdInline(src.job_id)}`);
  lines.push(`- status: ${mdInline(src.status)}`);
  lines.push(`- issue_date: ${mdInline(src.issue_date)}`);
  lines.push(`- valid_through_date: ${mdInline(src.valid_through_date)}`);
  lines.push(`- timezone: ${mdInline(src.timezone)}`);
  lines.push(`- currency_code: ${mdInline(src.currency_code)}`);
  lines.push(`- version_label: ${mdInline(src.version_label)}`);
  lines.push(`- terms_reference: ${mdInline(src?.approval_terms?.terms_reference)}`);
  lines.push(`- boundary_inheritance_policy: ${mdInline(src.boundary_inheritance_policy)}`);
  lines.push(`- recommended_option_key: ${mdInline(src?.recommendation?.recommended_option_key)}`);
  lines.push(`- selected_option_key: ${mdInline(src?.selection?.selected_option_key)}`);
  lines.push('');

  lines.push(...renderEvidenceRefs(src.evidence_refs));

  lines.push('## Situation Summary');
  lines.push(`- headline: ${mdInline(src?.situation_summary?.headline)}`);
  lines.push('- observations:');
  for (const o of src?.situation_summary?.observations || []) lines.push(`  - ${asString(o)}`);
  if (!(src?.situation_summary?.observations || []).length) lines.push('  - (none)');
  lines.push('- notes:');
  for (const n of src?.situation_summary?.notes || []) lines.push(`  - ${asString(n)}`);
  if (!(src?.situation_summary?.notes || []).length) lines.push('  - (none)');
  lines.push('');

  lines.push('## Risk & Impact');
  lines.push(`- risk_level: ${mdInline(src?.risk_impact?.risk_level)}`);
  lines.push('- customer_facing_impacts:');
  for (const x of src?.risk_impact?.customer_facing_impacts || []) lines.push(`  - ${asString(x)}`);
  if (!(src?.risk_impact?.customer_facing_impacts || []).length) lines.push('  - (none)');
  lines.push('- what_if_ignored:');
  for (const x of src?.risk_impact?.what_if_ignored || []) lines.push(`  - ${asString(x)}`);
  if (!(src?.risk_impact?.what_if_ignored || []).length) lines.push('  - (none)');
  lines.push('');

  lines.push('## Recommendation');
  lines.push(`- recommended_option_key: ${mdInline(src?.recommendation?.recommended_option_key)}`);
  lines.push(`- reason: ${mdInline(src?.recommendation?.reason)}`);
  lines.push('');

  lines.push('## Options');
  for (const k of optionKeys) {
    const opt = options[k] || {};
    lines.push(`### Option: ${asString(k)}`);
    lines.push(`- label: ${mdInline(opt.label)}`);
    lines.push(`- name: ${mdInline(opt.name)}`);
    lines.push(`- recommended: ${mdInline(opt.recommended)}`);
    lines.push(`- is_fully_quoted: ${mdInline(opt.is_fully_quoted)}`);
    lines.push(`- commercial: ${mdInline(renderOptionPricingSummary(opt))}`);
    lines.push('- line_items:');
    for (const liLine of renderLineItems(opt.line_items)) lines.push(`  ${liLine}`);

    if (opt?.pricing) {
      lines.push('- pricing:');
      lines.push(`  - subtotal_cents: ${mdInline(opt.pricing.subtotal_cents)}`);
      lines.push(`  - tax_total_cents: ${mdInline(opt.pricing.tax_total_cents)}`);
      lines.push(`  - total_cents: ${mdInline(opt.pricing.total_cents)}`);
    } else if (opt?.estimated_total) {
      lines.push('- estimated_total:');
      lines.push(`  - total_cents: ${mdInline(opt.estimated_total.total_cents)}`);
      if (opt.estimated_total?.notes) lines.push(`  - notes: ${mdInline(opt.estimated_total.notes)}`);
    } else if (opt?.price_range) {
      lines.push('- price_range:');
      lines.push(`  - min_total_cents: ${mdInline(opt.price_range.min_total_cents)}`);
      lines.push(`  - max_total_cents: ${mdInline(opt.price_range.max_total_cents)}`);
      if (opt.price_range?.notes) lines.push(`  - notes: ${mdInline(opt.price_range.notes)}`);
    }

    for (const bLine of renderBoundaries(opt.scope_boundaries || {})) lines.push(bLine);
    lines.push('');
  }

  lines.push(...renderListBlock('Universal Boundaries — Not Included', src?.universal_boundaries?.not_included));

  lines.push('## Approval Terms');
  lines.push(`- terms_reference: ${mdInline(src?.approval_terms?.terms_reference)}`);
  lines.push(`- approval_copy: ${mdInline(src?.approval_terms?.approval_copy)}`);
  lines.push('');

  return normalizeNewlines(lines.join('\n') + '\n');
};
