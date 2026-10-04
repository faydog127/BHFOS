import React, { Suspense, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { evaluateFinanceAccess } from '@/lib/finance/authz';

const FinanceShell = React.lazy(() => import('@/pages/finance/FinanceShell'));

/**
 * Finance access uses the session access token only.
 * The context role value is intentionally unused.
 */
export default function FinanceGuard() {
  const { tenantId } = useParams();
  const { session, loading } = useSupabaseAuth();
  const access = useMemo(
    () => evaluateFinanceAccess({
      accessToken: session?.access_token,
      routeTenantId: tenantId,
    }),
    [session, tenantId],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600" data-testid="finance-guard-loading">
        Checking access…
      </div>
    );
  }

  if (!access.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" data-testid="finance-access-denied">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Financial planning is unavailable</h1>
          <p className="mt-3 text-sm text-slate-600">
            This workspace is limited to TVG administrators. No planning illustration is loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Loading planning workspace…</div>}>
      <FinanceShell grantedAccess={access} />
    </Suspense>
  );
}
