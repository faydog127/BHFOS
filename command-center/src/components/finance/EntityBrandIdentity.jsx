import React from 'react';
import { resolveEntityBrand } from '@/lib/finance/entityBrand';

/**
 * One identity line for the shell and for report/PDF headers.
 * Renders the product framework name until an approved entity profile exists.
 * No logo element and no color treatment are invented here.
 */
export default function EntityBrandIdentity({ entityId, className = 'text-sm text-slate-700' }) {
  const brand = resolveEntityBrand(entityId);
  return (
    <p className={className} data-testid="entity-brand-identity" data-brand-complete={brand.complete ? 'true' : 'false'} data-entity-id={brand.entityId}>
      {brand.identityLabel}
    </p>
  );
}
