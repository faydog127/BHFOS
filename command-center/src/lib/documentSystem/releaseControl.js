const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

export const QUOTE_EDITABLE_STATUSES = Object.freeze(['draft', 'pending_review']);
export const QUOTE_RELEASED_STATUSES = Object.freeze([
  'sent',
  'viewed',
  'approved',
  'accepted',
  'paid',
  'declined',
  'rejected',
  'expired',
  'superseded',
  'void',
]);

export const isEditableQuoteStatus = (status) => QUOTE_EDITABLE_STATUSES.includes(normalizeStatus(status));

export const isReleasedQuoteStatus = (status) => QUOTE_RELEASED_STATUSES.includes(normalizeStatus(status));

export const requiresSupersedeBeforeRevision = (status) => {
  const normalized = normalizeStatus(status);
  return normalized === 'sent' || normalized === 'viewed';
};

export const getQuoteRevisionMode = (status) =>
  isReleasedQuoteStatus(status) ? 'create_revision' : 'edit_in_place';

export const getQuoteRevisionNotice = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === 'sent' || normalized === 'viewed') {
    return 'This quote has already been released to the customer. Saving will create a revised draft and retire the current approval link.';
  }

  if (['approved', 'accepted', 'paid'].includes(normalized)) {
    return 'This quote already has a recorded customer decision. Saving will create a new draft revision and preserve the approved version.';
  }

  if (['declined', 'rejected', 'expired', 'void', 'superseded'].includes(normalized)) {
    return 'This quote is no longer an editable draft. Saving will create a new draft revision instead of changing the released record.';
  }

  return 'This quote can be edited in place.';
};
