import React, { useEffect, useState } from 'react';
import {
  resolveMilEnvironmentLabel,
  shouldShowMilEnvironmentIndicator,
} from '@/lib/mediaIntel/environment';

/**
 * Plain-language environment indicator for owner/admin on MIL surfaces.
 * Never displays project refs, keys, or secret material.
 */
export default function MilEnvironmentBanner({ caps }) {
  const [label, setLabel] = useState(null);

  useEffect(() => {
    if (!shouldShowMilEnvironmentIndicator(caps)) {
      setLabel(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/build-info.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('build-info unavailable');
        const info = await res.json();
        if (!cancelled) {
          setLabel(resolveMilEnvironmentLabel(info, window.location.hostname));
        }
      } catch {
        if (!cancelled) {
          setLabel(resolveMilEnvironmentLabel(null, window.location.hostname));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caps?.isOwnerAdmin]);

  if (!label || !shouldShowMilEnvironmentIndicator(caps)) return null;

  return (
    <div
      className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
      role="status"
      data-testid="mil-environment-indicator"
    >
      {label}
    </div>
  );
}
