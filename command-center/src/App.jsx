
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import FeatureGuard from '@/components/FeatureGuard';
import BHFCrmLayout from '@/components/BHFCrmLayout';
import SelectTenant from '@/pages/SelectTenant';
import { Loader2 } from 'lucide-react';
import TenantGuard from '@/components/TenantGuard';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

import Login from '@/pages/Login';
import Contact from '@/pages/Contact';
import ThankYou from '@/pages/ThankYou';
import QuoteView from '@/pages/public/QuoteView';
import PaymentPage from '@/pages/public/PaymentPage';
import InvoiceView from '@/pages/public/InvoiceView';
import QuoteConfirmation from '@/pages/public/QuoteConfirmation';

// Legacy Diagnostics
import BackendTest from '@/pages/crm/BackendTest';
import AdvancedDiagnostics from '@/components/crm/settings/AdvancedDiagnostics';
import OpsDashboard from '@/pages/crm/settings/OpsDashboard';

// Lazy Loaded CRM Modules
// NOTE: Visual Editor imports have been completely removed
const CRMHub = React.lazy(() => import('@/pages/crm/CRMHub'));
const LeadsPage = React.lazy(() => import('@/pages/crm/Leads'));
const PipelinePage = React.lazy(() => import('@/pages/crm/Pipeline'));
const JobsPage = React.lazy(() => import('@/pages/crm/Jobs'));
const SchedulePage = React.lazy(() => import('@/pages/crm/Schedule'));
const AppointmentSchedulerPage = React.lazy(() => import('@/pages/crm/appointments/AppointmentScheduler'));
const ProposalList = React.lazy(() => import('@/pages/crm/proposals/ProposalList'));
const ProposalBuilder = React.lazy(() => import('@/pages/crm/proposals/ProposalBuilder'));
const InvoicesPage = React.lazy(() => import('@/pages/crm/Invoices'));
const ContactsPage = React.lazy(() => import('@/pages/crm/ContactsPage'));
const CallConsolePage = React.lazy(() => import('@/pages/crm/CallConsole'));
const SmsInboxPage = React.lazy(() => import('@/pages/crm/SmsInbox'));
const MarketingPage = React.lazy(() => import('@/pages/crm/Marketing'));
const ReportingPage = React.lazy(() => import('@/pages/crm/Reporting'));
// Removed PricebookPage import as it's no longer linked from public areas
// const PricebookPage = React.lazy(() => import('@/pages/crm/PricebookManager')); 
const PartnersPage = React.lazy(() => import('@/pages/crm/Partners'));
const SettingsPage = React.lazy(() => import('@/pages/crm/Settings'));
const FlowConsolePage = React.lazy(() => import('@/pages/crm/FlowConsole'));

// Sub-module Lazy Loads
const InvoiceBuilder = React.lazy(() => import('@/pages/crm/InvoiceBuilder'));

const LoadingFallback = () => {
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSlowMessage(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center min-h-[400px] gap-3 px-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      {showSlowMessage && (
        <>
          <p className="text-sm text-slate-600">This screen is taking longer than expected.</p>
          <button
            type="button"
            className="text-sm font-medium text-blue-700 underline underline-offset-2"
            onClick={() => window.location.reload()}
          >
            Reload App
          </button>
        </>
      )}
    </div>
  );
};

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Route render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center gap-3">
          <p className="text-base font-semibold text-slate-900">Unable to load this screen.</p>
          <p className="text-sm text-slate-600">Please reload and try again.</p>
          <button
            type="button"
            className="text-sm font-medium text-blue-700 underline underline-offset-2"
            onClick={() => window.location.reload()}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const getTenantFromStorage = () => {
  try {
    return (localStorage.getItem('currentTenantId') || 'tvg').toLowerCase();
  } catch {
    return 'tvg';
  }
};

const RootGate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, loading } = useSupabaseAuth();
  const [showTimeoutUI, setShowTimeoutUI] = useState(false);

  const hasOAuthParams = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (
      params.has('code') ||
      params.has('access_token') ||
      params.has('refresh_token') ||
      params.has('error') ||
      params.has('error_description')
    );
  }, [location.search]);

  useEffect(() => {
    if (!loading) {
      setShowTimeoutUI(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowTimeoutUI(true);
    }, 9000);

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (loading) return;

    const safeGetRedirect = () => {
      try {
        return localStorage.getItem('post_oauth_redirect');
      } catch {
        return null;
      }
    };

    const safeClearRedirect = () => {
      try {
        localStorage.removeItem('post_oauth_redirect');
      } catch {
        // ignore
      }
    };

    if (hasOAuthParams) {
      // OAuth redirect landed here (origin-only). Wait for Supabase to hydrate a session,
      // then forward to the intended post-login route.
      if (session) {
        const redirect = safeGetRedirect();
        safeClearRedirect();
        navigate(redirect || `/${getTenantFromStorage()}/crm`, { replace: true });
      } else {
        // Auth failed or was cancelled; return to tenant selection.
        navigate('/select-tenant', { replace: true });
      }
      return;
    }

    // Normal root visits: if we have a session, go to the last tenant CRM; otherwise select-tenant.
    if (session) {
      navigate(`/${getTenantFromStorage()}/crm`, { replace: true });
    } else {
      navigate('/select-tenant', { replace: true });
    }
  }, [hasOAuthParams, loading, navigate, session]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
      <p className="text-slate-500 text-sm">
        {hasOAuthParams ? 'Completing sign-in…' : 'Loading…'}
      </p>
      {showTimeoutUI && (
        <div className="mt-4 flex flex-col items-center gap-2 px-4 text-center">
          <p className="text-xs text-slate-500">Still loading your session.</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs font-medium text-blue-700 underline underline-offset-2"
              onClick={() => window.location.reload()}
            >
              Reload App
            </button>
            <button
              type="button"
              className="text-xs font-medium text-slate-700 underline underline-offset-2"
              onClick={() => navigate('/select-tenant', { replace: true })}
            >
              Go to Tenant Select
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CrmAliasRedirect = ({ fromPrefix }) => {
  const location = useLocation();
  const tenantId = getTenantFromStorage();
  const rest = location.pathname.slice(fromPrefix.length);
  const target = `/${tenantId}/crm${rest}${location.search || ''}${location.hash || ''}`;
  return <Navigate to={target} replace />;
};

const AppAliasRedirect = () => {
  const location = useLocation();
  const { tenantId = 'tvg' } = useParams();
  const rest = location.pathname.replace(new RegExp(`^/app/${tenantId}`), '');

  if (!rest || rest === '/') {
    return <Navigate to={`/${tenantId}/crm${location.search || ''}${location.hash || ''}`} replace />;
  }

  if (rest === '/setup') {
    return <Navigate to={`/${tenantId}/crm/setup${location.search || ''}${location.hash || ''}`} replace />;
  }

  const crmPath = rest.startsWith('/crm') ? rest : `/crm${rest}`;
  return <Navigate to={`/${tenantId}${crmPath}${location.search || ''}${location.hash || ''}`} replace />;
};

const EstimateAliasRedirect = () => {
  const location = useLocation();
  const targetPath = location.pathname.replace(/\/crm\/(?:proposals|quotes)(?=\/|$)/, '/crm/estimates');
  return <Navigate to={`${targetPath}${location.search || ''}${location.hash || ''}`} replace />;
};

// Canonical CRM route tree (Sprint 1 route freeze).
const CRMRoutes = () => (
  <Routes>
    <Route element={<BHFCrmLayout />}>
      <Route index element={<CRMHub />} />
      <Route path="dashboard" element={<CRMHub />} />
      <Route path="leads" element={<FeatureGuard flag="enableLeads"><LeadsPage /></FeatureGuard>} />
      <Route path="opportunities" element={<FeatureGuard flag="enablePipeline"><PipelinePage /></FeatureGuard>} />
      <Route path="pipeline" element={<Navigate to="../opportunities" replace />} />
      <Route path="jobs" element={<FeatureGuard flag="enableJobs"><JobsPage /></FeatureGuard>} />
      <Route path="dispatch" element={<FeatureGuard flag="enableSchedule"><SchedulePage /></FeatureGuard>} />
      <Route path="schedule" element={<Navigate to="../dispatch" replace />} />
      <Route path="calendar" element={<FeatureGuard flag="enableSchedule"><AppointmentSchedulerPage /></FeatureGuard>} />
      <Route path="appointments" element={<Navigate to="../calendar" replace />} />
      <Route path="estimates" element={<FeatureGuard flag="enableEstimates"><ProposalList /></FeatureGuard>} />
      <Route path="estimates/new" element={<FeatureGuard flag="enableEstimates"><ProposalBuilder /></FeatureGuard>} />
      <Route path="estimates/:id" element={<FeatureGuard flag="enableEstimates"><ProposalBuilder /></FeatureGuard>} />
      <Route path="quotes/*" element={<EstimateAliasRedirect />} />
      <Route path="proposals/*" element={<EstimateAliasRedirect />} />
      <Route path="money" element={<FlowConsolePage />} />
      <Route path="setup" element={<Navigate to="dashboard" replace />} />
      <Route path="invoices" element={<FeatureGuard flag="enableInvoicing"><InvoicesPage /></FeatureGuard>} />
      <Route path="invoices/:id" element={<FeatureGuard flag="enableInvoicing"><InvoiceBuilder /></FeatureGuard>} />
      <Route path="invoices/new" element={<FeatureGuard flag="enableInvoicing"><InvoiceBuilder /></FeatureGuard>} />
      <Route path="contacts" element={<FeatureGuard flag="enableContacts"><ContactsPage /></FeatureGuard>} />
      <Route path="call-console" element={<FeatureGuard flag="enableCallConsole"><CallConsolePage /></FeatureGuard>} />
      <Route path="sms" element={<FeatureGuard flag="enableSMS"><SmsInboxPage /></FeatureGuard>} />
      <Route path="marketing" element={<FeatureGuard flag="enableMarketing"><MarketingPage /></FeatureGuard>} />
      <Route path="reporting" element={<FeatureGuard flag="enableReporting"><ReportingPage /></FeatureGuard>} />
      {/* Removed link to PricebookManager from CRM routes */}
      {/* <Route path="pricebook" element={<FeatureGuard flag="enablePricebook"><PricebookPage /></FeatureGuard>} /> */}
      <Route path="partners" element={<FeatureGuard flag="enablePartners"><PartnersPage /></FeatureGuard>} />
      <Route path="settings" element={<FeatureGuard flag="enableSettings"><SettingsPage /></FeatureGuard>} />
      <Route path="ops" element={<OpsDashboard />} />
      
      {/* Legacy & Diagnostic Routes */}
      <Route path="backend-test" element={<BackendTest />} />
      <Route path="advanced-diagnostics" element={<AdvancedDiagnostics />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Route>
  </Routes>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootGate />} />
        <Route path="/select-tenant" element={<SelectTenant />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/quotes/:token" element={<QuoteView />} />
        <Route path="/quote-confirmation" element={<QuoteConfirmation />} />
        <Route path="/pay/:token" element={<PaymentPage />} />
        <Route path="/invoices/:token" element={<InvoiceView />} />
        <Route path="/crm/*" element={<CrmAliasRedirect fromPrefix="/crm" />} />
        <Route path="/bhf/crm/*" element={<CrmAliasRedirect fromPrefix="/bhf/crm" />} />
        <Route path="/app/:tenantId/*" element={<AppAliasRedirect />} />
        <Route path="/:tenantId/login" element={<Login />} />
        <Route
          path="/:tenantId/crm/*"
          element={
            <TenantGuard>
              <RouteErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <CRMRoutes />
                </Suspense>
              </RouteErrorBoundary>
            </TenantGuard>
          }
        />
        <Route path="*" element={<Navigate to="/select-tenant" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
