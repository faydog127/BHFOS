import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Shared CRM page chrome (PD-UX-04 A).
 */
export default function CrmPageHeader({
  title,
  description = null,
  breadcrumbs = [],
  actions = null,
  className = '',
}) {
  return (
    <header
      className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}
      data-testid="crm-page-header"
    >
      <div className="min-w-0 space-y-1">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            {breadcrumbs.map((crumb, idx) => (
              <span key={`${crumb.label}-${idx}`} className="inline-flex items-center gap-1">
                {idx > 0 ? <span aria-hidden="true">/</span> : null}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-[hsl(var(--foreground))] hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[hsl(var(--foreground))]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">{title}</h1>
        {description ? (
          <p className="max-w-3xl text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
