
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import FeatureGuard from '@/components/FeatureGuard';
import BHFCrmLayout from '@/components/BHFCrmLayout';
import SelectTenant from '@/pages/SelectTenant';
import { Loader2 } from 'lucide-react';
import TenantGuard from '@/components/TenantGuard';
import MediaSessionGuard from '@/components/media/MediaSessionGuard';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
  OAUTH_CALLBACK_MAX_WAIT_MS,
  readOAuthErrorFromUrl,
  resolveOAuthCallbackNavigation,
  urlHasOAuthCallbackParams,
} from '@/lib/oauthCallbackGate';

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
const MlP1S1DraftQuotePage = React.lazy(() => import('@/pages/crm/MlP1S1DraftQuotePage'));
const MlP1S2QuoteLifecyclePage = React.lazy(() => import('@/pages/crm/MlP1S2QuoteLifecyclePage'));
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
const InspectionsPage = React.lazy(() => import('@/pages/crm/Inspections'));
const InspectionEditorPage = React.lazy(() => import('@/pages/crm/inspections/InspectionEditor'));
const InspectionReportPage = React.lazy(() => import('@/pages/crm/inspections/InspectionReport'));
const MediaOwnerShell = React.lazy(() => import('@/pages/crm/media/MediaOwnerShell'));
const MediaDashboard = React.lazy(() => import('@/pages/crm/media/MediaDashboard'));
const MediaUploads = React.lazy(() => import('@/pages/crm/media/MediaUploads'));
const MediaMobileUpload = React.lazy(() => import('@/pages/crm/media/MediaMobileUpload'));
const MediaReviewQueue = React.lazy(() => import('@/pages/crm/media/MediaReviewQueue'));
const MediaAllMedia = React.lazy(() => import('@/pages/crm/media/MediaAllMedia'));
const MediaCollections = React.lazy(() => import('@/pages/crm/media/MediaCollections'));
const MediaBeforeAfter = React.lazy(() => import('@/pages/crm/media/MediaBeforeAfter'));
const MediaReelReview = React.lazy(() => import('@/pages/crm/media/MediaReelReview'));
const MediaApprovedToPost = React.lazy(() => import('@/pages/crm/media/MediaApprovedToPost'));
const MediaArchive = React.lazy(() => import('@/pages/crm/media/MediaArchive'));
const MediaSettings = React.lazy(() => import('@/pages/crm/media/MediaSettings'));
const CreatorRoutesPage = React.lazy(() => import('@/pages/creator/CreatorRoutes'));
const TechRoutesPage = React.lazy(() => import('@/pages/tech/TechRoutes'));

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
  const [oauthWaitStartedAt, setOauthWaitStartedAt] = useState(null);
  const [oauthWaitTick, setOauthWaitTick] = useState(0);
  const [oauthFailMessage, setOauthFailMessage] = useState(null);

  const hasOAuthParams = useMemo(
    () => urlHasOAuthCallbackParams(location.search, location.hash),
    [location.search, location.hash]
  );

  const { oauthError, oauthErrorDescription } = useMemo(
    () => readOAuthErrorFromUrl(location.search, location.hash),
    [location.search, location.hash]
  );

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

  // Keep waiting while PKCE exchange can still complete — do not drop ?code=.
  useEffect(() => {
    if (!hasOAuthParams || session || oauthError) {
      setOauthWaitStartedAt(null);
      return undefined;
    }
    if (oauthWaitStartedAt == null) {
      setOauthWaitStartedAt(Date.now());
    }
    const timer = setInterval(() => {
      setOauthWaitTick((tick) => tick + 1);
    }, 500);
    return () => clearInterval(timer);
  }, [hasOAuthParams, session, oauthError, oauthWaitStartedAt]);

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

    const waitedMs =
      hasOAuthParams && oauthWaitStartedAt != null
        ? Date.now() - oauthWaitStartedAt
        : 0;

    const decision = resolveOAuthCallbackNavigation({
      hasOAuthParams,
      session,
      oauthError,
      oauthErrorDescription,
      waitedMs,
      maxWaitMs: OAUTH_CALLBACK_MAX_WAIT_MS,
      postLoginRedirect: safeGetRedirect(),
      tenantFallback: getTenantFromStorage(),
    });

    if (decision.action === 'wait') {
      setOauthFailMessage(null);
      return;
    }

    if (decision.action === 'fail') {
      // Stay on this screen so we do not silently dump the user on select-tenant.
      // Offer an explicit path back to login (email/password still works on phone).
      setOauthFailMessage(decision.message || 'Sign-in did not complete.');
      return;
    }

    if (decision.action === 'navigate' && decision.to) {
      if (decision.clearPostLoginRedirect) {
        safeClearRedirect();
      }
      setOauthFailMessage(null);
      navigate(decision.to, { replace: decision.replace !== false });
    }
  }, [
    hasOAuthParams,
    loading,
    navigate,
    session,
    oauthError,
    oauthErrorDescription,
    oauthWaitStartedAt,
    oauthWaitTick,
  ]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
      <p className="text-slate-500 text-sm">
        {hasOAuthParams ? 'Completing sign-in…' : 'Loading…'}
      </p>
      {oauthFailMessage && (
        <div className="mt-4 flex max-w-sm flex-col items-center gap-2 px-4 text-center">
          <p className="text-xs text-red-600">{oauthFailMessage}</p>
          <button
            type="button"
            className="text-xs font-medium text-blue-700 underline underline-offset-2"
            onClick={() => navigate(`/${getTenantFromStorage()}/login`, { replace: true })}
          >
            Back to Login
          </button>
        </div>
      )}
      {showTimeoutUI && !oauthFailMessage && (
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

/** Compatibility: /crm/estimates/* and /crm/proposals/* → canonical /crm/quotes/* */
const QuoteCompatRedirect = () => {
  const location = useLocation();
  const targetPath = location.pathname.replace(
    /\/crm\/(?:estimates|proposals)(?=\/|$)/,
    '/crm/quotes',
  );
  return <Navigate to={`${targetPath}${location.search || ''}${location.hash || ''}`} replace />;
};

/**
 * Temporary non-tenant alias: /crm/media/* → /media/*
 * Why: CRM shell historically nested Media; bookmarks may use /crm/media.
 * Auth: destination uses MediaSessionGuard + MediaCapabilityGuard / RLS — alias does not grant access.
 * Loop prevention: one-way Navigate replace; /media never redirects back to /crm/media.
 * Removal: after MIL is the sole entry and CRM nav no longer implies /crm/media (post V1 IA cleanup).
 */
const MediaCrmAliasRedirect = () => {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/(?:[^/]+\/)?crm\/media\/?/, '');
  const target = `/media/${rest || 'dashboard'}${location.search || ''}${location.hash || ''}`;
  return <Navigate to={target} replace />;
};

/**
 * Phone upload entry:
 * - ?session=TOKEN → scoped upload-only (no CRM auth / no library browse)
 * - otherwise → authenticated upload under session guard (not TenantGuard)
 */
const MediaUploadEntry = () => {
  const [params] = useSearchParams();
  const hasSession = Boolean(params.get('session'));

  if (hasSession) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6">
        <MediaMobileUpload />
      </div>
    );
  }

  return (
    <MediaSessionGuard>
      <RouteErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <FeatureGuard flag="enableMediaIntelligence">
            <div className="min-h-screen bg-slate-50">
              <div className="border-b bg-white px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Phone media transfer</div>
                  <div className="text-xs text-slate-500">Upload-only · The Vent Guys</div>
                </div>
                <a href="/media/dashboard" className="text-sm text-blue-700 underline">
                  Full library
                </a>
              </div>
              <div className="px-4 py-5">
                <MediaMobileUpload />
              </div>
            </div>
          </FeatureGuard>
        </Suspense>
      </RouteErrorBoundary>
    </MediaSessionGuard>
  );
};

const MediaStaffLayout = () => (
  <MediaSessionGuard>
    <FeatureGuard flag="enableMediaIntelligence">
      <MediaOwnerShell />
    </FeatureGuard>
  </MediaSessionGuard>
);

const MediaLibraryRoutes = () => (
  <Routes>
    {/* Session upload must not require CRM login */}
    <Route path="upload" element={<MediaUploadEntry />} />
    <Route element={<MediaStaffLayout />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<MediaDashboard />} />
      <Route path="uploads" element={<MediaUploads />} />
      <Route path="review" element={<MediaReviewQueue />} />
      <Route path="all" element={<MediaAllMedia />} />
      <Route path="collections" element={<MediaCollections />} />
      <Route path="before-after" element={<MediaBeforeAfter />} />
      <Route path="reel-review" element={<MediaReelReview />} />
      <Route path="approved-to-post" element={<MediaApprovedToPost />} />
      <Route path="archive" element={<MediaArchive />} />
      <Route path="settings" element={<MediaSettings />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Route>
  </Routes>
);

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
      <Route path="inspections" element={<FeatureGuard flag="enableInspections"><InspectionsPage /></FeatureGuard>} />
      <Route path="inspections/new" element={<FeatureGuard flag="enableInspections"><InspectionEditorPage forceNew /></FeatureGuard>} />
      <Route path="inspections/:id/report" element={<FeatureGuard flag="enableInspections"><InspectionReportPage /></FeatureGuard>} />
      <Route path="inspections/:id" element={<FeatureGuard flag="enableInspections"><InspectionEditorPage /></FeatureGuard>} />
      {/* Temporary alias: /:tenantId/crm/media/* → /media/* (non-tenant product routes). */}
      <Route path="media/*" element={<MediaCrmAliasRedirect />} />
      {/* ML-P1 canonical Quotes surface (quotes table). estimates/proposals redirect only. */}
      <Route path="quotes" element={<FeatureGuard flag="enableEstimates"><ProposalList /></FeatureGuard>} />
      <Route path="quotes/p1-draft" element={<FeatureGuard flag="enableEstimates"><MlP1S1DraftQuotePage /></FeatureGuard>} />
      <Route path="quotes/new" element={<FeatureGuard flag="enableEstimates"><MlP1S1DraftQuotePage /></FeatureGuard>} />
      <Route path="quotes/p1-lifecycle/:id" element={<FeatureGuard flag="enableEstimates"><MlP1S2QuoteLifecyclePage /></FeatureGuard>} />
      <Route path="quotes/:id" element={<FeatureGuard flag="enableEstimates"><ProposalBuilder /></FeatureGuard>} />
      <Route path="estimates/*" element={<QuoteCompatRedirect />} />
      <Route path="proposals/*" element={<QuoteCompatRedirect />} />
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
        {/* Temporary top-level CRM alias may hit /crm/media — redirect before CrmAliasRedirect. */}
        <Route path="/crm/media/*" element={<MediaCrmAliasRedirect />} />
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
        {/* MIL product routes — single-company; no tenant segment. */}
        <Route
          path="/media/*"
          element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <MediaLibraryRoutes />
              </Suspense>
            </RouteErrorBoundary>
          }
        />
        <Route
          path="/creator/*"
          element={
            <MediaSessionGuard>
              <RouteErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <FeatureGuard flag="enableMediaIntelligence">
                    <CreatorRoutesPage />
                  </FeatureGuard>
                </Suspense>
              </RouteErrorBoundary>
            </MediaSessionGuard>
          }
        />
        <Route
          path="/:tenantId/tech/*"
          element={
            <TenantGuard>
              <RouteErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <FeatureGuard flag="enableTechPwa">
                    <TechRoutesPage />
                  </FeatureGuard>
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
