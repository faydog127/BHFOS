import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';

/**
 * Session-only guard for MIL product routes (/media, /creator).
 * Does NOT require URL tenant identity or JWT tenant claims.
 * Unauthenticated users are sent to legacy V1 login (/:tenantId/login) until
 * company-wide /login cleanup is authorized — that path is not MIL tenancy.
 */
export default function MediaSessionGuard({ children }) {
  const { session, loading } = useSupabaseAuth();
  const location = useLocation();
  const [ready, setReady] = useState(!loading);

  useEffect(() => {
    if (!loading) setReady(true);
  }, [loading]);

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-slate-500 bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin" /> Checking session…
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    // Legacy V1 auth entry — not an MIL product tenant boundary.
    return <Navigate to={`/${DEFAULT_TENANT_ID}/login?next=${next}`} replace />;
  }

  return children;
}
