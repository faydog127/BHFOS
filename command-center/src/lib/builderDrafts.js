const BUILDER_DRAFT_PREFIX = 'builder_draft';

export const buildBuilderDraftKey = (builderKey, tenantId, recordId = 'new') =>
  `${BUILDER_DRAFT_PREFIX}:${builderKey}:${tenantId || 'default'}:${recordId || 'new'}`;

export const loadBuilderDraft = (builderKey, tenantId, recordId = 'new') => {
  try {
    const raw = window.localStorage.getItem(buildBuilderDraftKey(builderKey, tenantId, recordId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn(`Unable to load ${builderKey} draft:`, error);
    return null;
  }
};

export const saveBuilderDraft = (builderKey, tenantId, recordId = 'new', payload) => {
  try {
    window.localStorage.setItem(
      buildBuilderDraftKey(builderKey, tenantId, recordId),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        ...payload,
      }),
    );
  } catch (error) {
    console.warn(`Unable to store ${builderKey} draft:`, error);
  }
};

export const clearBuilderDraft = (builderKey, tenantId, recordId = 'new') => {
  try {
    window.localStorage.removeItem(buildBuilderDraftKey(builderKey, tenantId, recordId));
  } catch (error) {
    console.warn(`Unable to clear ${builderKey} draft:`, error);
  }
};
