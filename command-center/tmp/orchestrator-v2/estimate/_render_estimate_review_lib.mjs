import {
  asString,
  assertEstimateInvariants,
  canonicalRel,
  mdInline,
  normalizeNewlines,
  formatMoneyUsd,
} from './_estimate_lib.mjs';

const moneyLine = (label, cents) => `${label}: ${formatMoneyUsd(cents)} (${asString(cents)}¢)`;

const optionTotalText = (opt) => {
  if (opt?.pricing?.total_cents !== undefined) return formatMoneyUsd(opt.pricing.total_cents);
  if (opt?.estimated_total?.total_cents !== undefined) return formatMoneyUsd(opt.estimated_total.total_cents);
  if (opt?.price_range) {
    return `${formatMoneyUsd(opt.price_range.min_total_cents)}–${formatMoneyUsd(opt.price_range.max_total_cents)}`;
  }
  return 'TBD';
};

export const renderEstimateReviewV1 = ({
  inputJsonPath,
  reviewDocPath,
  rawDocPath,
  estimateJson,
}) => {
  const src = estimateJson || {};
  assertEstimateInvariants(src);

  const options = src.options || {};
  const recommendedKey = src?.recommendation?.recommended_option_key;
  const selectedKey = src?.selection?.selected_option_key;
  const selected = options[selectedKey] || {};
  const recommended = options[recommendedKey] || {};

  const lines = [];
  lines.push('# Estimate — Review Summary');
  lines.push('');
  lines.push('Contract: `estimate_review_v1`');
  lines.push('Audience: internal/client-facing (human-optimized)');
  lines.push('SSOT: Estimate raw contract doc + estimate judgment JSON (no extra interpretation).');
  lines.push('');

  lines.push('## Inputs');
  lines.push(`- Estimate judgment JSON: ${mdInline(canonicalRel(inputJsonPath))}`);
  lines.push(`- Estimate raw contract doc: ${mdInline(canonicalRel(rawDocPath))}`);
  lines.push('');

  lines.push('## Snapshot');
  lines.push(`- tenant_id: ${mdInline(src.tenant_id)}`);
  lines.push(`- estimate_number: ${mdInline(src.estimate_number)}`);
  lines.push(`- job_id: ${mdInline(src.job_id)}`);
  lines.push(`- status: ${mdInline(src.status)}`);
  lines.push(`- issue_date: ${mdInline(src.issue_date)}`);
  lines.push(`- valid_through_date: ${mdInline(src.valid_through_date)}`);
  lines.push(`- version: ${mdInline(src.version_label)}`);
  lines.push(`- terms_reference: ${mdInline(src?.approval_terms?.terms_reference)}`);
  lines.push('');

  lines.push('## Situation');
  lines.push(asString(src?.situation_summary?.headline));
  lines.push('');

  lines.push('## Recommendation');
  lines.push(`Recommended option: ${mdInline(recommendedKey)} — ${asString(recommended?.name)} (${optionTotalText(recommended)})`);
  lines.push(asString(src?.recommendation?.reason));
  lines.push('');

  lines.push('## Options');
  for (const k of Object.keys(options)) {
    const opt = options[k] || {};
    const tags = [];
    if (opt.recommended) tags.push('recommended');
    if (k === selectedKey) tags.push('selected');
    const tagText = tags.length ? ` [${tags.join(', ')}]` : '';
    lines.push(`- ${asString(opt.label)} (${k})${tagText}: ${asString(opt.name)} — ${optionTotalText(opt)}${opt.is_fully_quoted ? '' : ' (not fully quoted)'}`);
  }
  lines.push('');

  lines.push('## Selected Scope (What You Are Approving)');
  for (const li of selected.line_items || []) {
    lines.push(`- ${asString(li.name)} x${asString(li.quantity)}: ${formatMoneyUsd(li.amount_cents)}`);
  }
  lines.push('');

  lines.push('## Investment');
  if (selected.pricing) {
    lines.push(`- ${moneyLine('Subtotal', selected.pricing.subtotal_cents)}`);
    lines.push(`- ${moneyLine('Tax', selected.pricing.tax_total_cents)}`);
    lines.push(`- ${moneyLine('Total', selected.pricing.total_cents)}`);
  } else if (selected.price_range) {
    lines.push(`- Total (range): ${optionTotalText(selected)}`);
  } else if (selected.estimated_total) {
    lines.push(`- Total (estimate): ${optionTotalText(selected)}`);
  }
  lines.push('');

  lines.push('## Scope Boundaries (How to Read This)');
  lines.push(`Boundary policy: ${mdInline(src.boundary_inheritance_policy)}`);
  lines.push('Renderer behavior: show universal not-included + selected option boundaries (included + not included).');
  lines.push('');

  lines.push('## Not Included (Universal)');
  for (const x of src?.universal_boundaries?.not_included || []) lines.push(`- ${asString(x)}`);
  if (!(src?.universal_boundaries?.not_included || []).length) lines.push('- (none)');
  lines.push('');

  lines.push('## Included / Not Included (Selected Option)');
  const sb = selected.scope_boundaries || {};
  lines.push('- Included:');
  for (const x of sb.included || []) lines.push(`  - ${asString(x)}`);
  if (!(sb.included || []).length) lines.push('  - (none)');
  lines.push('- Not Included:');
  for (const x of sb.not_included || []) lines.push(`  - ${asString(x)}`);
  if (!(sb.not_included || []).length) lines.push('  - (none)');
  lines.push('');

  lines.push('## Approval Terms');
  lines.push(asString(src?.approval_terms?.approval_copy));
  lines.push('');

  lines.push('## Evidence');
  for (const r of src.evidence_refs || []) {
    lines.push(`- ${asString(r.type)} ${asString(r.id)}: ${asString(r.uri)}`);
  }
  if (!(src.evidence_refs || []).length) lines.push('- (none)');
  lines.push('');

  lines.push('## Re-render');
  lines.push(`- Raw: \`node tmp/orchestrator-v2/estimate/render_estimate_raw.mjs ${canonicalRel(inputJsonPath)} ${canonicalRel(rawDocPath)}\``);
  lines.push(
    `- Review: \`node tmp/orchestrator-v2/estimate/render_estimate_review.mjs --json ${canonicalRel(
      inputJsonPath
    )} --out ${canonicalRel(reviewDocPath)} --raw ${canonicalRel(rawDocPath)}\``
  );
  lines.push('');

  return normalizeNewlines(lines.join('\n') + '\n');
};

