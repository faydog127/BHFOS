import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchMilRole, milCapabilities } from '@/lib/mediaIntel/roles';

/**
 * Focused reel-creator portal — intentionally not the CRM shell.
 * Single workspace surface (no fake section tabs).
 */
export default function CreatorPortalLayout() {
  const { signOut, user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const role = await fetchMilRole();
      const caps = milCapabilities(role);
      if (cancelled) return;
      if (caps.isStaff) {
        setAllowed(true);
        return;
      }
      if (!caps.isCreator) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Opening creator workspace…
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Creator access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            This workspace is only for invited reel creators. Contact the owner if you need access.
          </p>
          <button
            type="button"
            className="mt-4 text-sm text-blue-700 underline"
            onClick={() => navigate(`/${DEFAULT_TENANT_ID}/login`)}
          >
            Sign in with another account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="creator-portal">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">Creator workspace</div>
            <div className="text-xs text-slate-500 truncate">Approved media &amp; reel submissions only</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-slate-500 truncate max-w-[160px]">{user?.email}</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium min-h-[40px]"
              onClick={async () => {
                await signOut();
                // Legacy V1 login path until company-wide auth cleanup
                navigate(`/${DEFAULT_TENANT_ID}/login`, { replace: true });
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
