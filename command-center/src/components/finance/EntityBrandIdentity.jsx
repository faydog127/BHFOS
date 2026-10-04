import React from 'react';
import { resolveEntityBrand } from '@/lib/finance/entityBrand';

/**
 * The only Finance identity mark. Header, shell, and print footer all use it.
 * Colors and the logo come from the entity profile. Report builders do not.
 */
export default function EntityBrandIdentity({
  entityId,
  className = '',
  variant = 'header',
  testId = 'entity-brand-identity',
}) {
  const brand = resolveEntityBrand(entityId);
  const style = brand.colors
    ? {
      backgroundColor: brand.colors.paper,
      color: brand.colors.ink,
      borderTop: `3px solid ${brand.colors.red}`,
    }
    : undefined;
  return (
    <div
      className={`rounded bg-white px-2 py-2 ${className}`.trim()}
      style={style}
      data-testid={testId}
      data-brand-complete={brand.complete ? 'true' : 'false'}
      data-entity-id={brand.entityId}
    >
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt={brand.logoAlt || brand.identityLabel} className="h-12 w-auto max-w-full bg-white object-contain" data-testid="entity-brand-logo" />
      ) : null}
      <p className="text-sm font-semibold" style={brand.colors ? { color: brand.colors.navy } : undefined} data-testid="entity-brand-name">
        {brand.identityLabel}
      </p>
      {brand.complete ? null : (
        <p className="text-sm font-semibold text-amber-800" data-print-hide="true" data-testid="entity-brand-pending">Brand pending</p>
      )}
      {variant === 'footer' && brand.tagline ? (
        <p className="mt-1 text-xs" data-testid="entity-brand-tagline">{brand.tagline}</p>
      ) : null}
      {variant === 'footer' && brand.contact ? (
        <p className="mt-1 text-xs" data-testid="entity-brand-contact">{brand.contact.phone} · {brand.contact.email}</p>
      ) : null}
    </div>
  );
}
