
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import MobileCtaBar from '@/components/MobileCtaBar';
import ChatWidget from '@/components/ChatWidget';
import FeatureGuard from '@/components/FeatureGuard';
import AdminRoute from '@/components/AdminRoute';
import BHFCrmLayout from '@/components/BHFCrmLayout';
import TrainingModeBanner from '@/components/TrainingModeBanner';
import { Loader2 } from 'lucide-react';

// Public Pages
import Home from '@/pages/Home';
import DemoHome from '@/pages/DemoHome';
import InstallWorxsHome from '@/pages/InstallWorxsHome';
import Services from '@/pages/Services';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import Booking from '@/pages/Booking';
import Blog from '@/pages/Blog';
import Faq from '@/pages/Faq';
import Gallery from '@/pages/Gallery';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import ThankYou from '@/pages/ThankYou';
import Login from '@/pages/Login';

// Service Area Pages
import Melbourne from '@/pages/Melbourne';
import MerrittIsland from '@/pages/MerrittIsland';
import NewSmyrnaBeach from '@/pages/NewSmyrnaBeach';
import PortStJohn from '@/pages/PortStJohn';
import Rockledge from '@/pages/Rockledge';
import Suntree from '@/pages/Suntree';
import Titusville from '@/pages/Titusville';
import Viera from '@/pages/Viera';
import Cocoa from '@/pages/Cocoa';

// Partner Pages
import PartnersLanding from '@/pages/PartnersLanding';
import RealtorPartner from '@/pages/partners/RealtorPartner';
import PropertyManagerPartner from '@/pages/partners/PropertyManagerPartner';
import HoaPartner from '@/pages/partners/HoaPartner';
import GovernmentPartner from '@/pages/partners/GovernmentPartner';
import B2bPartner from '@/pages/partners/B2bPartner';
import PartnerWelcome from '@/pages/partners/PartnerWelcome';

// Blog Pages
import CleanAirCertified from '@/pages/blog/CleanAirCertified';
import DryerVentFireSafety from '@/pages/blog/DryerVentFireSafety';
import FloridaFilterGuide from '@/pages/blog/FloridaFilterGuide';
import FloridaHumidityDuctContamination from '@/pages/blog/FloridaHumidityDuctContamination';
import FreeAirCheck from '@/pages/blog/FreeAirCheck';
import MechanicalHygieneVsDuctCleaning from '@/pages/blog/MechanicalHygieneVsDuctCleaning';
import NadcaStandards from '@/pages/blog/NadcaStandards';
import ReturnDuctLeak from '@/pages/blog/ReturnDuctLeak';

// BHF Core Pages
import TenantManagement from '@/pages/bhf/TenantManagement';
import TenantOnboarding from '@/pages/bhf/TenantOnboarding';
import MasterDiagnostics from '@/pages/bhf/MasterDiagnostics';
import ImprovementAnalysis from '@/pages/bhf/ImprovementAnalysis';
import ConfigExplainer from '@/pages/bhf/ConfigExplainer';
import ChangeLog from '@/pages/bhf/ChangeLog';
import DocumentationDashboard from '@/pages/bhf/DocumentationDashboard';
import SessionReport from '@/pages/bhf/SessionReport';
import FixesDocumentation from '@/pages/bhf/FixesDocumentation';
import IssuesDocumentation from '@/pages/bhf/IssuesDocumentation';
import SystemDoctorConsole from '@/components/SystemDoctorConsole';

// Legacy Diagnostics
import BackendTest from '@/pages/crm/BackendTest';
import AdvancedDiagnostics from '@/components/crm/settings/AdvancedDiagnostics';

// Lazy Loaded CRM Modules
const CRMHub = React.lazy(() => import('@/pages/crm/CRMHub'));
const LeadsPage = React.lazy(() => import('@/pages/crm/Leads'));
const PipelinePage = React.lazy(() => import('@/pages/crm/Pipeline'));
const JobsPage = React.lazy(() => import('@/pages/crm/Jobs'));
const SchedulePage = React.lazy(() => import('@/pages/crm/Schedule'));
const EstimatesPage = React.lazy(() => import('@/pages/crm/Estimates'));
const InvoicesPage = React.lazy(() => import('@/pages/crm/Invoices'));
const ContactsPage = React.lazy(() => import('@/pages/crm/ContactsPage'));
const CallConsolePage = React.lazy(() => import('@/pages/crm/CallConsole'));
const SmsInboxPage = React.lazy(() => import('@/pages/crm/SmsInbox'));
const MarketingPage = React.lazy(() => import('@/pages/crm/Marketing'));
const ReportingPage = React.lazy(() => import('@/pages/crm/Reporting'));
const PricebookPage = React.lazy(() => import('@/pages/crm/PricebookManager'));
const PartnersPage = React.lazy(() => import('@/pages/crm/Partners'));
const SettingsPage = React.lazy(() => import('@/pages/crm/Settings'));

// Sub-module Lazy Loads (if needed for deep linking or modals)
const InvoiceBuilder = React.lazy(() => import('@/pages/crm/InvoiceBuilder'));

const LoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

const PublicRoutes = () => {
  const location = useLocation();
  
  // Hide public nav/footer on BHF CRM pages and Demo/InstallWorxs pages
  const isCrmRoute = location.pathname.startsWith('/bhf/crm') || location.pathname.startsWith('/bhf/tenant-management') || location.pathname.startsWith('/bhf/tenant-onboarding');
  const isDemoRoute = location.pathname.startsWith('/demo');
  const isInstallWorxsRoute = location.pathname.startsWith('/installworxs');
  const isSpecialRoute = location.pathname === '/thank-you' || location.pathname === '/partners/welcome' || location.pathname === '/login';
  const hidePublicNav = isCrmRoute || isSpecialRoute || isDemoRoute || isInstallWorxsRoute;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Training Banner injected at top of layout */}
      <TrainingModeBanner />
      
      {!hidePublicNav && <Navigation />}
      <main className={`flex-grow ${!hidePublicNav ? 'pb-20 lg:pb-0' : ''}`}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/demo/home" element={<DemoHome />} />
            <Route path="/installworxs/home" element={<InstallWorxsHome />} />
            
            <Route path="/services" element={<Services />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/thank-you" element={<ThankYou />} />
            <Route path="/login" element={<Login />} />

            {/* Service Areas */}
            <Route path="/service-areas/melbourne" element={<Melbourne />} />
            <Route path="/service-areas/merritt-island" element={<MerrittIsland />} />
            <Route path="/service-areas/new-smyrna-beach" element={<NewSmyrnaBeach />} />
            <Route path="/service-areas/port-st-john" element={<PortStJohn />} />
            <Route path="/service-areas/rockledge" element={<Rockledge />} />
            <Route path="/service-areas/suntree" element={<Suntree />} />
            <Route path="/service-areas/titusville" element={<Titusville />} />
            <Route path="/service-areas/viera" element={<Viera />} />
            <Route path="/service-areas/cocoa" element={<Cocoa />} />

            {/* Partners */}
            <Route path="/partners" element={<PartnersLanding />} />
            <Route path="/partners/realtor" element={<RealtorPartner />} />
            <Route path="/partners/property-manager" element={<PropertyManagerPartner />} />
            <Route path="/partners/hoa" element={<HoaPartner />} />
            <Route path="/partners/government" element={<GovernmentPartner />} />
            <Route path="/partners/b2b" element={<B2bPartner />} />
            <Route path="/partners/welcome" element={<PartnerWelcome />} />

            {/* Blog Content */}
            <Route path="/blog/clean-air-certified" element={<CleanAirCertified />} />
            <Route path="/blog/dryer-vent-fire-safety" element={<DryerVentFireSafety />} />
            <Route path="/blog/florida-filter-guide" element={<FloridaFilterGuide />} />
            <Route path="/blog/florida-humidity-duct-contamination" element={<FloridaHumidityDuctContamination />} />
            <Route path="/blog/free-air-check" element={<FreeAirCheck />} />
            <Route path="/blog/mechanical-hygiene-vs-duct-cleaning" element={<MechanicalHygieneVsDuctCleaning />} />
            <Route path="/blog/nadca-standards" element={<NadcaStandards />} />
            <Route path="/blog/return-duct-leak" element={<ReturnDuctLeak />} />

            {/* BHF CRM Routes (Protected & Flagged) */}
            <Route path="/bhf/crm" element={<AdminRoute><BHFCrmLayout /></AdminRoute>}>
              <Route index element={<CRMHub />} />
              <Route path="leads" element={<FeatureGuard flag="enableLeads"><LeadsPage /></FeatureGuard>} />
              <Route path="pipeline" element={<FeatureGuard flag="enablePipeline"><PipelinePage /></FeatureGuard>} />
              <Route path="jobs" element={<FeatureGuard flag="enableJobs"><JobsPage /></FeatureGuard>} />
              <Route path="schedule" element={<FeatureGuard flag="enableSchedule"><SchedulePage /></FeatureGuard>} />
              <Route path="estimates" element={<FeatureGuard flag="enableEstimates"><EstimatesPage /></FeatureGuard>} />
              <Route path="invoices" element={<FeatureGuard flag="enableInvoicing"><InvoicesPage /></FeatureGuard>} />
              <Route path="invoices/:id" element={<FeatureGuard flag="enableInvoicing"><InvoiceBuilder /></FeatureGuard>} />
              <Route path="invoices/new" element={<FeatureGuard flag="enableInvoicing"><InvoiceBuilder /></FeatureGuard>} />
              <Route path="contacts" element={<FeatureGuard flag="enableContacts"><ContactsPage /></FeatureGuard>} />
              <Route path="call-console" element={<FeatureGuard flag="enableCallConsole"><CallConsolePage /></FeatureGuard>} />
              <Route path="sms" element={<FeatureGuard flag="enableSMS"><SmsInboxPage /></FeatureGuard>} />
              <Route path="marketing" element={<FeatureGuard flag="enableMarketing"><MarketingPage /></FeatureGuard>} />
              <Route path="reporting" element={<FeatureGuard flag="enableReporting"><ReportingPage /></FeatureGuard>} />
              <Route path="pricebook" element={<FeatureGuard flag="enablePricebook"><PricebookPage /></FeatureGuard>} />
              <Route path="partners" element={<FeatureGuard flag="enablePartners"><PartnersPage /></FeatureGuard>} />
              <Route path="settings" element={<FeatureGuard flag="enableSettings"><SettingsPage /></FeatureGuard>} />
            </Route>

            {/* Admin Management Routes (Protected) */}
            <Route path="/bhf/tenant-management" element={<AdminRoute><BHFCrmLayout /></AdminRoute>}>
               <Route index element={<TenantManagement />} />
            </Route>

            {/* Tenant Onboarding Wizard */}
            <Route path="/bhf/tenant-onboarding" element={<AdminRoute><TenantOnboarding /></AdminRoute>} />

            {/* Legacy & Diagnostic Routes */}
            <Route path="/bhf/communications" element={<AdminRoute><FeatureGuard flag="enableSMS"><SmsInboxPage /></FeatureGuard></AdminRoute>} />
            <Route path="/bhf/master-diagnostics" element={<AdminRoute><MasterDiagnostics /></AdminRoute>} />
            <Route path="/bhf/improvement-analysis" element={<AdminRoute><ImprovementAnalysis /></AdminRoute>} />
            <Route path="/bhf/config-explainer" element={<AdminRoute><ConfigExplainer /></AdminRoute>} />
            <Route path="/bhf/change-log" element={<AdminRoute><ChangeLog /></AdminRoute>} />
            <Route path="/bhf/documentation" element={<AdminRoute><DocumentationDashboard /></AdminRoute>} />
            <Route path="/bhf/session-report/:sessionId" element={<AdminRoute><SessionReport /></AdminRoute>} />
            <Route path="/bhf/session-report" element={<AdminRoute><SessionReport /></AdminRoute>} />
            <Route path="/bhf/fixes" element={<AdminRoute><FixesDocumentation /></AdminRoute>} />
            <Route path="/bhf/issues" element={<AdminRoute><IssuesDocumentation /></AdminRoute>} />
            <Route path="/system-doctor" element={<AdminRoute><SystemDoctorConsole /></AdminRoute>} />
            <Route path="/crm/backend-test" element={<AdminRoute><BackendTest /></AdminRoute>} />
            <Route path="/crm/advanced-diagnostics" element={<AdminRoute><AdvancedDiagnostics /></AdminRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      {!hidePublicNav && <Footer />}
      {!hidePublicNav && <MobileCtaBar />}
      {!hidePublicNav && <ChatWidget />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <PublicRoutes />
    </Router>
  );
}

export default App;
