import React from 'react';

/** Join/confirmation banner only. Demo-shell helpers were not ported. */
export function ConventionBanner({ children, tone = 'neutral' }) {
  const toneClass =
    tone === 'blocked'
      ? 'border-amber-300 bg-amber-50 text-amber-950'
      : tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-950'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}
