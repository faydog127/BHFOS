import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';
import { tenantPath } from '@/lib/tenantUtils';
import { MIL_NAV } from '@/lib/mediaIntel/constants';
import { fetchMilRole, milCapabilities } from '@/lib/mediaIntel/roles';
import { getAiConfigState } from '@/lib/mediaIntel/api';
import MilEnvironmentBanner from '@/components/media/MilEnvironmentBanner';

export default function MediaLibraryLayout() {
  const [caps, setCaps] = useState(milCapabilities('unauthenticated'));
  const [aiState, setAiState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const role = await fetchMilRole();
      if (!cancelled) setCaps(milCapabilities(role));
      const ai = await getAiConfigState();
      if (!cancelled) setAiState(ai);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo(() => {
    // Creators never remain in this shell (redirected to /creator). Staff get full IA.
    return MIL_NAV.filter((n) => n.id !== 'creator');
  }, []);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="media-intelligence-library">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-4 sm:px-6 py-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-700">
                <Image className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                  Media Intelligence Library
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                  Private intake for photos and videos. AI suggests organization; people verify what media shows and where it may be used.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <MilEnvironmentBanner caps={caps} />
              {caps.isStaff && (
                <Link
                  // Legacy V1 CRM remains on tenant-prefixed routes; MIL product routes are /media
                  to={tenantPath('/crm', DEFAULT_TENANT_ID)}
                  className="text-sm text-blue-700 underline-offset-2 hover:underline min-h-[44px] inline-flex items-center"
                >
                  Back to Hub
                </Link>
              )}
            </div>
          </div>
          {aiState && !aiState.configured && (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="status"
            >
              {aiState.message}
            </div>
          )}
        </div>
        <nav
          className="px-2 sm:px-4 flex gap-1 overflow-x-auto pb-2"
          aria-label="Media library sections"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={`/media/${item.path}`}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px] inline-flex items-center',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="px-4 sm:px-6 py-5">
        <Outlet context={{ caps, aiState }} />
      </div>
    </div>
  );
}
