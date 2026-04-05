import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { jwtDecode } from "jwt-decode";
import { toast } from '@/components/ui/use-toast';
import { getUrlTenant } from '@/lib/tenantUtils';

const TenantGuard = ({ children }) => {
  const { tenantId: paramTenant } = useParams(); 
  const urlTenant = paramTenant || getUrlTenant();
  
  const { session, loading: authLoading, signOut } = useSupabaseAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    let mounted = true;

    const safeSet = (setter) => {
      if (mounted) setter();
    };

    const withTimeout = (promise, timeoutMs = 5000) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        ),
      ]);

    const verifyTenantAccess = async () => {
      if (authLoading) return;

      safeSet(() => {
        setIsChecking(true);
        setAccessDenied(false);
      });

      try {
        // Strict enforcement: tenant must exist in URL path.
        if (!urlTenant) {
          navigate('/select-tenant', { replace: true });
          return;
        }

        // 1. Not Logged In
        if (!session) {
          const next = encodeURIComponent(location.pathname + location.search);
          const loginPath = `/${urlTenant || 'tvg'}/login?next=${next}`;
          navigate(loginPath, { replace: true });
          return;
        }

        // 2. Check Superuser Status First (Bypass), but don't block forever.
        let isSuper = false;
        try {
          const result = await withTimeout(supabase.rpc('check_is_superuser'), 4000);
          isSuper = Boolean(result?.data);
        } catch (err) {
          console.warn('TenantGuard: superuser check timed out or failed, continuing normal tenant check.', err);
        }

        if (isSuper) {
          return;
        }

        // 3. Normal Tenant Check
        const token = session.access_token;
        let jwtTenant;
        try {
          const decoded = jwtDecode(token);
          jwtTenant = decoded.app_metadata?.tenant_id;
        } catch (e) {
          console.error('TenantGuard: Failed to decode token', e);
        }

        if (!jwtTenant) {
          safeSet(() => setAccessDenied(true));
          return;
        }

        if (urlTenant && jwtTenant !== urlTenant) {
          console.warn(`Mismatch: URL=${urlTenant}, JWT=${jwtTenant}. Attempting refresh...`);

          try {
            const { data: refreshData, error: refreshError } = await withTimeout(
              supabase.auth.refreshSession(),
              5000
            );

            if (!refreshError && refreshData?.session) {
              const newToken = refreshData.session.access_token;
              const newDecoded = jwtDecode(newToken);
              const newJwtTenant = newDecoded.app_metadata?.tenant_id;

              if (newJwtTenant === urlTenant) {
                return;
              }
            }
          } catch (refreshErr) {
            console.warn('TenantGuard: refresh session failed/timed out.', refreshErr);
          }

          toast({
            title: 'Access Mismatch',
            description: `You are logged in to '${jwtTenant}' but trying to access '${urlTenant}'.`,
            variant: 'destructive'
          });

          navigate(`/${jwtTenant}/crm/dashboard`, { replace: true });
          return;
        }
      } catch (err) {
        console.error('TenantGuard: unexpected verification error', err);
      } finally {
        safeSet(() => setIsChecking(false));
      }
    };

    verifyTenantAccess();

    return () => {
      mounted = false;
    };
  }, [session, authLoading, urlTenant, navigate, location]);

  if (authLoading || isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 text-sm">Verifying access rights...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg border border-red-100 shadow-lg text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-600 mb-6">
            Your account is not currently assigned to a valid tenant organization.
          </p>
          <Button onClick={() => signOut()} variant="outline" className="gap-2 w-full">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return children;
};

export default TenantGuard;
