import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { createConventionPolicy } from '@/lib/networkOs/conventionDemoPolicy';
import { createNetworkOsConventionService } from '@/services/networkOsConventionService';
import { ConventionBanner, ConventionError, ConventionLoading } from './conventionUi';

const ConventionWorkspaceContext = createContext(null);

export function useConventionWorkspace() {
  const value = useContext(ConventionWorkspaceContext);
  if (!value) {
    throw new Error('useConventionWorkspace must be used inside ConventionDemoLayout');
  }
  return value;
}

function sessionTenantId(session) {
  try {
    const decoded = jwtDecode(session?.access_token || '');
    return decoded?.app_metadata?.tenant_id || null;
  } catch {
    return null;
  }
}

const NAV = [
  { to: '/network-os/convention', label: 'Attention', end: true },
  { to: '/network-os/convention/needs', label: 'Service needs' },
  { to: '/network-os/convention/contacts', label: 'Contacts' },
  { to: '/network-os/convention/catalog', label: 'Catalog' },
  { to: '/network-os/convention/intake', label: 'Intake' },
];

export default function ConventionDemoLayout() {
  const { session } = useSupabaseAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState(null);

  const service = useMemo(
    () => createNetworkOsConventionService({ supabase, policy: createConventionPolicy() }),
    [],
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setFatal(null);
      try {
        const next = await service.loadWorkspace({
          sessionTenantId: sessionTenantId(session),
          urlTenantId: null,
        });
        if (mounted) setWorkspace(next);
      } catch (error) {
        if (mounted) {
          setWorkspace(null);
          setFatal(error);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [service, session]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Network OS</p>
            <h1 className="text-xl font-semibold">Convention demo</h1>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? 'border-b-2 border-slate-900 pb-1 font-medium text-slate-900'
                    : 'pb-1 text-slate-500'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {workspace?.write && !workspace.write.allowed && (
          <ConventionBanner tone="blocked">
            Writes are disabled ({workspace.write.code}). Isolated demo tenant and
            effective RLS are not proven.
          </ConventionBanner>
        )}
        {workspace?.tenant && (
          <p className="text-xs text-slate-500">
            {workspace.tenant.isolatedDemo
              ? 'Isolated demo scope resolved from session.'
              : workspace.tenant.customerScope
                ? 'Active compatibility scope resolved. Showing test records only.'
                : 'Active session scope resolved. Showing test records only.'}
          </p>
        )}
        {loading ? (
          <ConventionLoading />
        ) : fatal ? (
          <ConventionError error={fatal} />
        ) : (
          <ConventionWorkspaceContext.Provider value={{ workspace, service }}>
            <Outlet />
          </ConventionWorkspaceContext.Provider>
        )}
      </main>
    </div>
  );
}
