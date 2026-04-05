import {
  DISPLAY_LABELS,
  DOCUMENT_CONTENT_RULES,
  DOCUMENT_FIELD_REQUIREMENTS,
  DOCUMENT_STATE_RULES,
  PAGE_MASTER_RULES,
  PAGE_MASTER_TYPES,
  RELEASE_CHECKLISTS,
  REQUIRED_PROTECTION_LINES,
  SECTION_DEFINITIONS,
  TRANSFORMATION_RULES,
} from './config.js';

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const titleCase = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeSectionEntry = (entry) =>
  typeof entry === 'string'
    ? { key: entry, continued: false }
    : { key: entry?.key, continued: Boolean(entry?.continued) };

const getValue = (input, path) =>
  String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, segment) => current?.[segment], input);

const isBlank = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const getRequirementLabel = (requirement) => {
  if (typeof requirement === 'string') {
    return requirement;
  }

  if (Array.isArray(requirement?.anyOf)) {
    return requirement.label || requirement.anyOf.join(' or ');
  }

  return 'unknown_requirement';
};

const isRequirementSatisfied = (requirement, payload) => {
  if (typeof requirement === 'string') {
    return !isBlank(payload?.[requirement]);
  }

  if (Array.isArray(requirement?.anyOf)) {
    return requirement.anyOf.some((field) => !isBlank(payload?.[field]));
  }

  return false;
};

const getPagePlan = (payload, context = {}) => context.pagePlan || payload?.page_plan || null;

const getReleaseAuditFlag = (payload, flag) =>
  Boolean(getValue(payload, `release_audit.${flag}`) ?? getValue(payload, flag));

const getLineItemAmount = (lineItem = {}) => {
  if (!isBlank(lineItem.total_price)) {
    return Number(lineItem.total_price);
  }

  if (!isBlank(lineItem.amount)) {
    return Number(lineItem.amount);
  }

  return Number(lineItem.quantity || 0) * Number(lineItem.unit_price || 0);
};

const getFlattenedSectionKeys = (pagePlan) =>
  (pagePlan?.pages || []).flatMap((page) => (page.sections || []).map((entry) => normalizeSectionEntry(entry).key));

const isSectionAllowedOnPage = (sectionKey, master, pageCount) => {
  const rule = PAGE_MASTER_RULES[master];

  if (!rule) {
    return false;
  }

  if (rule.allowedSections.includes(sectionKey)) {
    return true;
  }

  if (
    master === PAGE_MASTER_TYPES.FIRST &&
    pageCount === 1 &&
    rule.allowFinalSectionsOnSinglePage &&
    PAGE_MASTER_RULES.final.allowedSections.includes(sectionKey)
  ) {
    return true;
  }

  return false;
};

const validateFinalTailOrder = (page, errors) => {
  const order = PAGE_MASTER_RULES.final.requiredTailOrder;
  const sectionKeys = (page.sections || []).map((entry) => normalizeSectionEntry(entry).key);
  let previousIndex = -1;

  for (const sectionKey of order) {
    const currentIndex = sectionKeys.indexOf(sectionKey);
    if (currentIndex === -1) {
      errors.push(`Final page is missing required section "${sectionKey}".`);
      continue;
    }

    if (currentIndex < previousIndex) {
      errors.push(`Final page section "${sectionKey}" is out of order.`);
    }

    previousIndex = Math.max(previousIndex, currentIndex);
  }
};

export const getRequiredFields = (documentType) =>
  DOCUMENT_FIELD_REQUIREMENTS[documentType]?.required || [];

export const getOptionalFields = (documentType) =>
  DOCUMENT_FIELD_REQUIREMENTS[documentType]?.optional || [];

export const getDisplayLabel = (documentType, fieldName) =>
  DISPLAY_LABELS[documentType]?.[fieldName] ||
  DISPLAY_LABELS.shared?.[fieldName] ||
  titleCase(fieldName);

export const validateRequiredFields = (documentType, payload = {}) => {
  const requirements = getRequiredFields(documentType);
  const missing = requirements
    .filter((requirement) => !isRequirementSatisfied(requirement, payload))
    .map((requirement) => getRequirementLabel(requirement));

  return {
    valid: missing.length === 0,
    missing,
  };
};

export const totalsReconcile = (payload = {}) => {
  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];

  if (lineItems.length === 0) {
    return false;
  }

  const computedSubtotal = roundCurrency(lineItems.reduce((sum, item) => sum + getLineItemAmount(item), 0));
  const subtotalMatches = roundCurrency(payload.subtotal) === computedSubtotal;
  const expectedTotal = roundCurrency(
    computedSubtotal - Number(payload.discount_amount || 0) + Number(payload.tax_amount || 0) + Number(payload.fees_amount || 0)
  );
  const totalMatches = roundCurrency(payload.total_amount) === expectedTotal;

  return subtotalMatches && totalMatches;
};

export const validatePagePlan = (documentType, pagePlan) => {
  const errors = [];
  const pages = pagePlan?.pages || [];
  const atomicOccurrences = new Map();

  if (pages.length === 0) {
    return {
      valid: false,
      errors: ['Missing page plan.'],
    };
  }

  if (pages[0].master !== PAGE_MASTER_TYPES.FIRST) {
    errors.push('The first page must use the first page master.');
  }

  if (pages.length > 1 && pages.at(-1)?.master !== PAGE_MASTER_TYPES.FINAL) {
    errors.push('A multi-page document must end on the final page master.');
  }

  for (let index = 1; index < pages.length - 1; index += 1) {
    if (pages[index].master !== PAGE_MASTER_TYPES.INTERIOR) {
      errors.push(`Page ${index + 1} must use the interior page master.`);
    }
  }

  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    const sectionEntries = (page.sections || []).map(normalizeSectionEntry);
    const denseTables =
      typeof page.denseTables === 'number'
        ? page.denseTables
        : sectionEntries.filter(({ key }) => SECTION_DEFINITIONS[key]?.denseTable).length;
    const majorSections =
      typeof page.majorSections === 'number'
        ? page.majorSections
        : sectionEntries.filter(({ key }) => SECTION_DEFINITIONS[key]?.major).length;
    const fillRatio = Number(page.fillRatio || 0);

    if (!page.footerLocked) {
      errors.push(`Page ${pageNumber} footer is not locked.`);
    }

    if (fillRatio > 0.9) {
      errors.push(`Page ${pageNumber} exceeds the footer protection threshold.`);
    }

    if (majorSections > 2) {
      errors.push(`Page ${pageNumber} exceeds the major section density threshold.`);
    }

    if (denseTables > 1) {
      errors.push(`Page ${pageNumber} exceeds the dense table threshold.`);
    }

    sectionEntries.forEach(({ key, continued }) => {
      const definition = SECTION_DEFINITIONS[key];

      if (!definition) {
        errors.push(`Page ${pageNumber} uses unknown section "${key}".`);
        return;
      }

      if (!isSectionAllowedOnPage(key, page.master, pages.length)) {
        errors.push(`Section "${key}" is not allowed on page master "${page.master}" (page ${pageNumber}).`);
      }

      if (continued && !definition.splittable) {
        errors.push(`Section "${key}" cannot be marked as continued on page ${pageNumber}.`);
      }

      if (definition.atomic) {
        atomicOccurrences.set(key, (atomicOccurrences.get(key) || 0) + 1);
      }
    });

    if (pages.length > 1 && page.master !== PAGE_MASTER_TYPES.FINAL && sectionEntries.some(({ key }) => key === 'approval')) {
      errors.push(`Approval may only appear on the final page of a multi-page ${documentType}.`);
    }

    if (page.master === PAGE_MASTER_TYPES.FINAL) {
      validateFinalTailOrder(page, errors);
    }
  });

  atomicOccurrences.forEach((count, sectionKey) => {
    if (count > 1) {
      errors.push(`Atomic section "${sectionKey}" cannot appear on more than one page.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateContentSections = (documentType, pagePlan) => {
  const errors = [];
  const rules = DOCUMENT_CONTENT_RULES[documentType];
  const flattenedSections = getFlattenedSectionKeys(pagePlan);

  if (!rules) {
    return { valid: true, errors };
  }

  for (const requiredSection of rules.requiredSections) {
    if (!flattenedSections.includes(requiredSection)) {
      errors.push(`Missing required section "${requiredSection}" for ${documentType}.`);
    }
  }

  for (const prohibitedSection of rules.prohibitedSections) {
    if (flattenedSections.includes(prohibitedSection)) {
      errors.push(`Section "${prohibitedSection}" is not allowed in ${documentType}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateApprovalPlacement = (documentType, pagePlan) => {
  if (!pagePlan) {
    return { valid: false, errors: ['Missing page plan.'] };
  }

  const pageValidation = validatePagePlan(documentType, pagePlan);

  return {
    valid: pageValidation.valid,
    errors: pageValidation.errors.filter((error) => error.includes('Approval') || error.includes('final page')),
  };
};

const releaseCheckHandlers = {
  required_fields: (documentType, payload) => validateRequiredFields(documentType, payload).valid,
  document_version_assigned: (_, payload) => !isBlank(payload.document_version),
  scope_snapshot_present: (_, payload) => !isBlank(payload.scope_snapshot_text),
  totals_reconcile: (_, payload) => totalsReconcile(payload),
  page_count_stable: (_, payload) => getReleaseAuditFlag(payload, 'page_count_stable'),
  approval_placement_correct: (documentType, payload, context) =>
    validateApprovalPlacement(documentType, getPagePlan(payload, context)).valid,
  po_resolved_if_applicable: (_, payload) => !payload.po_required || !isBlank(payload.po_number),
  dispute_line_present: (_, payload) =>
    !isBlank(payload.dispute_protection_line) && payload.dispute_protection_line === REQUIRED_PROTECTION_LINES.dispute,
  null_render_pass_clean: (_, payload) => getReleaseAuditFlag(payload, 'null_render_clean'),
  service_date_present: (_, payload) => !isBlank(payload.service_date),
  balance_due_correct: (_, payload) =>
    roundCurrency(Number(payload.total_amount || 0) - Number(payload.amount_paid || 0)) === roundCurrency(payload.balance_due),
  payment_instructions_present: (_, payload) => !isBlank(payload.payment_instructions),
  service_verification_present: (_, payload) =>
    !isBlank(payload.service_verification_text) && payload.service_verification_text === REQUIRED_PROTECTION_LINES.serviceVerification,
  release_approval_present: (_, payload) => payload.status !== 'sent' || Boolean(payload.release_approved),
  payment_event_confirmed: (_, payload, context) =>
    Boolean(payload.paid_in_full) ||
    !isBlank(payload.payment_received_at) ||
    Boolean(context?.transactionConfirmed),
  payment_amount_matches: (_, payload, context) => {
    if (isBlank(context?.transactionAmount)) {
      return !isBlank(payload.payment_amount);
    }

    return roundCurrency(payload.payment_amount) === roundCurrency(context.transactionAmount);
  },
  payment_method_present: (_, payload) => !isBlank(payload.payment_method),
  payment_timestamp_present: (_, payload) => !isBlank(payload.payment_received_at),
  balance_outcome_clear: (_, payload) => Boolean(payload.paid_in_full) || !isBlank(payload.remaining_balance),
};

export const evaluateReleaseChecklist = (documentType, payload = {}, context = {}) => {
  const checklist = RELEASE_CHECKLISTS[documentType] || [];
  const results = checklist.map((item) => {
    const passed = Boolean(releaseCheckHandlers[item.id]?.(documentType, payload, context));

    return {
      id: item.id,
      label: item.label,
      passed,
    };
  });

  return {
    passed: results.every((item) => item.passed),
    results,
  };
};

export const validateDocumentPayload = (documentType, payload = {}, context = {}) => {
  const pagePlan = getPagePlan(payload, context);
  const requiredFields = validateRequiredFields(documentType, payload);
  const pagePlanValidation = pagePlan ? validatePagePlan(documentType, pagePlan) : { valid: true, errors: [] };
  const contentValidation = pagePlan ? validateContentSections(documentType, pagePlan) : { valid: true, errors: [] };
  const releaseChecklist = evaluateReleaseChecklist(documentType, payload, { ...context, pagePlan });

  return {
    valid:
      requiredFields.valid &&
      pagePlanValidation.valid &&
      contentValidation.valid &&
      releaseChecklist.passed,
    requiredFields,
    pagePlan: pagePlanValidation,
    content: contentValidation,
    releaseChecklist,
  };
};

export const canTransitionDocumentState = (documentType, fromStatus, toStatus, payload = {}) => {
  const rules = DOCUMENT_STATE_RULES[documentType];
  const reasons = [];

  if (!rules) {
    return { allowed: false, reasons: [`Unknown document type "${documentType}".`] };
  }

  const allowedTransitions = rules.transitions[fromStatus] || [];
  if (!allowedTransitions.includes(toStatus)) {
    reasons.push(`Transition ${fromStatus} -> ${toStatus} is not allowed for ${documentType}.`);
  }

  if (documentType === 'quote' && toStatus === 'approved') {
    if (isBlank(payload.approved_version)) {
      reasons.push('Quote approval requires approved_version.');
    }

    if (isBlank(payload.source_snapshot_id)) {
      reasons.push('Quote approval requires source_snapshot_id.');
    }
  }

  if (documentType === 'invoice' && toStatus === 'sent' && !payload.release_approved) {
    reasons.push('Invoice must have release_approved before becoming sent.');
  }

  if (documentType === 'invoice' && toStatus === 'partial') {
    if (!(Number(payload.amount_paid || 0) > 0 && Number(payload.balance_due || 0) > 0)) {
      reasons.push('Invoice partial state requires amount_paid > 0 and balance_due > 0.');
    }
  }

  if (documentType === 'invoice' && toStatus === 'paid') {
    if (!(Number(payload.balance_due || 0) <= 0 || Boolean(payload.payment_received_at))) {
      reasons.push('Invoice paid state requires balance_due <= 0 or a payment event.');
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
};

export const requiresChangeOrder = (transformationKey, changedFields = []) => {
  const rule = TRANSFORMATION_RULES[transformationKey];
  const fields = Array.isArray(changedFields) ? changedFields : [];

  if (!rule?.changeOrderRequiredFor) {
    return {
      required: false,
      triggeredBy: [],
    };
  }

  const triggeredBy = rule.changeOrderRequiredFor.filter((field) => fields.includes(field));

  return {
    required: triggeredBy.length > 0,
    triggeredBy,
  };
};
