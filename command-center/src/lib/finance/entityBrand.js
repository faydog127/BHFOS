/**
 * Entity brand profile for Finance screens and reports.
 * BHFOS is the product framework. The operating entity supplies visible identity.
 * This module is the only brand lookup. It does not fork Finance logic.
 *
 * No approved logo file, color token set, legal name, or contact block for TVG
 * or Black Horse is present in this application. brandAssets.js points at a
 * remote storage host and placeholder paths. brandConfig.js names files that
 * are not in this tree, and its colors disagree with brandAssets.js.
 * Those modules are not an approved Finance profile. This resolver does not
 * read them and does not invent a mark, a color, or a treatment.
 */
export const ENTITY_BRAND_MISSING_INPUTS = Object.freeze([
  'Approved TVG logo or mark file stored in this repository (not a remote storage URL).',
  'Approved Black Horse / BHFOS logo or mark file stored in this repository.',
  'One approved color-token set. The two existing modules disagree and are not adopted.',
  'Approved legal name for the operating entity on Finance documents.',
  'Contact metadata, only if Command Center requires it on a Finance document.',
]);

export function resolveEntityBrand(entityId) {
  const id = entityId || 'tvg';
  return {
    productName: 'BHFOS',
    entityId: id,
    displayName: null,
    legalName: null,
    logoUrl: null,
    colors: null,
    contact: null,
    identityLabel: 'BHFOS',
    complete: false,
    missingInputs: ENTITY_BRAND_MISSING_INPUTS,
  };
}
