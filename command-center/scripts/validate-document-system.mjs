import {
  DOCUMENT_SYSTEM_VERSION,
  QUOTE_FIXTURES,
  canTransitionDocumentState,
  getDisplayLabel,
  requiresChangeOrder,
  validateDocumentPayload,
} from '../src/lib/documentSystem/index.js';

let hasFailure = false;

console.log(`Document system validation :: ${DOCUMENT_SYSTEM_VERSION}`);
console.log('');

for (const fixture of QUOTE_FIXTURES) {
  const validation = validateDocumentPayload('quote', fixture.payload, {
    pagePlan: fixture.pagePlan,
  });

  if (!validation.valid) {
    hasFailure = true;
    console.log(`FAIL ${fixture.id} :: ${fixture.name}`);

    for (const missing of validation.requiredFields.missing) {
      console.log(`  - missing field: ${missing}`);
    }

    for (const error of validation.pagePlan.errors) {
      console.log(`  - page plan: ${error}`);
    }

    for (const error of validation.content.errors) {
      console.log(`  - content: ${error}`);
    }

    for (const check of validation.releaseChecklist.results.filter((result) => !result.passed)) {
      console.log(`  - release: ${check.label}`);
    }

    console.log('');
    continue;
  }

  console.log(`PASS ${fixture.id} :: ${fixture.name}`);
}

console.log('');

const approvalTransition = canTransitionDocumentState(
  'quote',
  'sent',
  'approved',
  QUOTE_FIXTURES[0]?.payload || {}
);
if (!approvalTransition.allowed) {
  hasFailure = true;
  console.log('FAIL transition :: quote sent -> approved');
  for (const reason of approvalTransition.reasons) {
    console.log(`  - ${reason}`);
  }
} else {
  console.log('PASS transition :: quote sent -> approved');
}

const changeOrderCheck = requiresChangeOrder('quote_to_invoice', [
  'scope_snapshot_text',
  'payment_status',
]);
if (!changeOrderCheck.required || !changeOrderCheck.triggeredBy.includes('scope_snapshot_text')) {
  hasFailure = true;
  console.log('FAIL change-order :: quote_to_invoice did not trigger for scope change');
} else {
  console.log(`PASS change-order :: triggered by ${changeOrderCheck.triggeredBy.join(', ')}`);
}

const quoteLabel = getDisplayLabel('quote', 'total_amount');
if (quoteLabel !== 'Total Investment') {
  hasFailure = true;
  console.log(`FAIL label :: expected "Total Investment", received "${quoteLabel}"`);
} else {
  console.log(`PASS label :: quote total_amount -> ${quoteLabel}`);
}

console.log('');

if (hasFailure) {
  console.error('Document system validation failed.');
  process.exit(1);
}

console.log(`Validated ${QUOTE_FIXTURES.length} quote fixtures successfully.`);
