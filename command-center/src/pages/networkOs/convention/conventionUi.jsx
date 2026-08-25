import React from 'react';
import { Loader2 } from 'lucide-react';

/** Shared join / protected-queue chrome. Demo-shell helpers stay unported. */
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

export function ConventionLoading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ConventionEmpty({ children }) {
  return (
    <div className="border border-dashed border-slate-200 px-3 py-8 text-sm text-slate-500">
      {children}
    </div>
  );
}
