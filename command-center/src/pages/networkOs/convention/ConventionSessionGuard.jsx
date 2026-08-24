import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';

/**
 * Session-only guard for the Network OS convention demo.
 * Does not introduce tenant selection or a tenant URL segment.
 */
export default function ConventionSessionGuard({ children }) {
  const { session, loading } = useSupabaseAuth();
  const location = useLocation();
  const [ready, setReady] = useState(!loading);

  useEffect(() => {
    if (!loading) setReady(true);
  }, [loading]);

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 bg-slate-50 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Checking session…
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/${DEFAULT_TENANT_ID}/login?next=${next}`} replace />;
  }

  return children;
}
