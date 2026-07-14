import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildPreflightBlockerModel } from '@/lib/inspectionPreflightBlockers';

export default function InspectionPreflightBlockers({
  issues = [],
  context = {},
  onNavigate,
  className = '',
}) {
  const { groups } = buildPreflightBlockerModel(issues, context);
  if (!groups.length) return null;

  return (
    <div className={`rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950 ${className}`.trim()} role="region" aria-label="Finalization blockers">
      <div className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Resolve before finalizing
          <div className="mt-0.5 text-xs font-normal text-rose-800">
            {groups.length} issue group{groups.length === 1 ? '' : 's'} must be fixed before the customer PDF can be enabled.
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-3">
        {groups.map((group) => (
          <li key={group.key} className="rounded-lg border border-rose-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">
                  {group.count} {group.title}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {group.messages[0] || 'Open the affected items and correct them.'}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 border-rose-300 text-rose-900 hover:bg-rose-50"
                onClick={() => onNavigate?.(group)}
              >
                {group.actionLabel}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
