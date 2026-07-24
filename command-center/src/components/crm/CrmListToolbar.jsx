import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Thin list/search chrome for CRM list screens (PD-UX-04 A).
 */
export default function CrmListToolbar({
  search = null,
  filters = null,
  actions = null,
  className = '',
}) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      data-testid="crm-list-toolbar"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {search}
        {filters}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
