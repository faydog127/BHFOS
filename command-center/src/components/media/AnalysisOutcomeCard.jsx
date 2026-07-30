import React from 'react';
import { analysisOutcomeAnswers, buildAnalysisOutcome } from '@/lib/mediaIntel/analysisDisplay';

/**
 * Technician-facing AI outcome. Plain text only — never HTML from the model.
 */
export default function AnalysisOutcomeCard({ asset, analysis, compact = false }) {
  const outcome = buildAnalysisOutcome(asset, analysis);
  const answers = analysisOutcomeAnswers(outcome);

  if (!outcome) return null;

  if (outcome.uiStatus === 'queued' || outcome.uiStatus === 'not_requested') {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" data-testid="analysis-outcome">
        Awaiting analysis…
      </div>
    );
  }
  if (outcome.uiStatus === 'analyzing') {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900" data-testid="analysis-outcome">
        Analyzing…
      </div>
    );
  }
  if (outcome.uiStatus === 'failed') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 space-y-1" data-testid="analysis-outcome">
        <p className="font-medium">Analysis failed</p>
        <p>{outcome.errorMessage || 'Structured analysis could not be completed.'}</p>
        {outcome.videoNote ? <p className="text-xs">{outcome.videoNote}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-3 text-sm text-slate-800 space-y-2" data-testid="analysis-outcome">
      <div className="font-medium text-emerald-900">Analysis complete</div>
      {outcome.videoNote ? <p className="text-xs text-amber-900">{outcome.videoNote}</p> : null}
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">What it appears to show</div>
        <p className="mt-0.5 whitespace-pre-wrap">{answers.whatItShows}</p>
      </div>
      {!compact && outcome.classification?.length ? (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Classification</div>
          <p className="mt-0.5">{outcome.classification.join(' · ')}</p>
        </div>
      ) : null}
      {outcome.tags?.length ? (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Suggested tags</div>
          <p className="mt-0.5">{outcome.tags.join(', ')}</p>
        </div>
      ) : null}
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Usability</div>
          <p className="mt-0.5 capitalize">{answers.usable}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Recommended use</div>
          <p className="mt-0.5">{answers.recommendedUse}</p>
        </div>
      </div>
      <div className="rounded-md border border-slate-200 bg-white/70 px-2 py-2 space-y-1">
        <div className="text-xs uppercase tracking-wide text-slate-500">Suggested cleanup action (advisory)</div>
        <p className="font-medium text-slate-900">{answers.recommendedAction}</p>
        {outcome.qualityIssueLabels?.length ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {outcome.qualityIssueLabels.map((label) => (
              <span
                key={label}
                className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-950"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        {outcome.lifecycleRationale ? (
          <p className="text-xs text-slate-600">{outcome.lifecycleRationale}</p>
        ) : null}
        <p className="text-[11px] text-slate-500">AI never archives, trashes, or deletes originals automatically.</p>
      </div>
      {!compact && outcome.observations ? (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Observations</div>
          <p className="mt-0.5 whitespace-pre-wrap">{outcome.observations}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {outcome.confidence != null ? <span>Confidence: {Math.round(outcome.confidence * 100)}%</span> : null}
        <span>{answers.needsReview ? 'Needs human review' : 'Review still recommended'}</span>
      </div>
      {outcome.privacyWarnings?.length ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-rose-900 text-xs">
          Privacy / public-use warning: {outcome.privacyWarnings.join('; ')}
        </div>
      ) : null}
    </div>
  );
}
