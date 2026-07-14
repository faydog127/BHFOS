import React, { useMemo } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { ClipboardList, Home, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';
import { tenantPath } from '@/lib/tenantUtils';

const navItems = [
  { id: 'queue', label: 'Queue', icon: ClipboardList, path: '/tech/queue' },
  { id: 'home', label: 'CRM', icon: Home, path: '/crm/dashboard' },
];

export default function TechLayout() {
  const location = useLocation();
  const { tenantId = DEFAULT_TENANT_ID } = useParams();
  const { signOut } = useSupabaseAuth();

  const pageLabel = useMemo(() => {
    const path = String(location.pathname || '').toLowerCase();
    if (path.includes('/tech/queue')) return 'Queue';
    if (path.includes('/tech/jobs/')) return 'Job';
    if (path.includes('/tech/inspections/')) return 'Inspection';
    return 'Tech';
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">TVG Tech</div>
            <div className="text-xs text-slate-500 truncate">{pageLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-medium text-slate-500">{String(tenantId || '').toUpperCase()}</div>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out">
              <LogOut className="h-4 w-4 text-slate-600" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 px-3 py-2">
          {navItems.map((item) => {
            const href = tenantPath(item.path, tenantId);
            const isActive = String(location.pathname || '').toLowerCase().includes(item.path);
            return (
              <Link
                key={item.id}
                to={href}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors',
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

