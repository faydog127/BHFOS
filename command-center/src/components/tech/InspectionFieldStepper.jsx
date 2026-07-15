import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

export const FIELD_STEPS = [
  { id: 'customer', label: 'Customer', shortLabel: '1. Customer', route: 'session' },
  { id: 'photos', label: 'Photos', shortLabel: '2. Photos', route: 'session' },
  { id: 'findings', label: 'Findings', shortLabel: '3. Findings', route: 'review' },
  { id: 'recommendation', label: 'Recommendation', shortLabel: '4. Rec', route: 'review' },
  { id: 'finish', label: 'Review & Finish', shortLabel: '5. Finish', route: 'review' },
];

export const stepHref = (inspectionId, stepId) => {
  const step = FIELD_STEPS.find((row) => row.id === stepId) || FIELD_STEPS[0];
  const base = step.route === 'review'
    ? `../inspections/${inspectionId}/review`
    : `../inspections/${inspectionId}`;
  return `${base}?step=${step.id}`;
};

/**
 * Compact five-step field navigation for phone use.
 * completionByStep: { customer: true, photos: true, ... }
 */
export default function InspectionFieldStepper({
  inspectionId,
  currentStep,
  completionByStep = {},
  className = '',
}) {
  const currentIndex = Math.max(0, FIELD_STEPS.findIndex((step) => step.id === currentStep));

  return (
    <nav
      className={`rounded-xl border border-slate-200 bg-white p-2 ${className}`.trim()}
      aria-label="Inspection field steps"
    >
      <ol className="grid grid-cols-5 gap-1">
        {FIELD_STEPS.map((step, index) => {
          const complete = Boolean(completionByStep[step.id]);
          const active = step.id === currentStep;
          const href = stepHref(inspectionId, step.id);
          return (
            <li key={step.id}>
              <Link
                to={href}
                className={[
                  'flex min-h-11 flex-col items-center justify-center rounded-lg px-1 py-2 text-center text-[10px] font-medium leading-tight',
                  active ? 'bg-blue-600 text-white' : complete ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600',
                ].join(' ')}
                aria-current={active ? 'step' : undefined}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                  {complete && !active ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="mt-1 truncate w-full">{step.shortLabel.replace(/^\d+\.\s*/, '')}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 px-1 text-xs text-slate-500">
        Step {currentIndex + 1} of {FIELD_STEPS.length}: {FIELD_STEPS[currentIndex]?.label}
      </p>
    </nav>
  );
}
