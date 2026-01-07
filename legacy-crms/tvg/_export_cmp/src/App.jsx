
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import MobileCtaBar from '@/components/MobileCtaBar';
import ChatWidget from '@/components/ChatWidget';
import FeatureGuard from '@/components/FeatureGuard';
import BHFCrmLayout from '@/components/BHFCrmLayout';
import TrainingModeBanner from '@/components/TrainingModeBanner';
import SelectTenant from '@/pages/SelectTenant';
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
import SystemDoctorConsole from '@/components/SystemDoctorConsole';

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
const EstimatesPage = React.lazy(() => import('@/pages/crm/Estimates'));
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

// Sub-module Lazy Loads
const InvoiceBuilder = React.lazy(() => import('@/pages/crm/InvoiceBuilder'));

const LoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

const titleCase = (value = '') =>
  value
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const computeTitle = (pathname = '/') => {
  const siteName = 'The Vent Guys';
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const segments = cleanPath.split('/').filter(Boolean);

  // Handle tenant-prefixed routes by stripping the first segment if more remain
  const pathSegs = segments.length > 1 ? segments.slice(1) : segments;
  const seg0 = pathSegs[0] || '';
  const seg1 = pathSegs[1] || '';

  const staticMap = {
    '': `Home | ${siteName}`,
    home: `Home | ${siteName}`,
    services: `Services | ${siteName}`,
    about: `About | ${siteName}`,
    contact: `Contact | ${siteName}`,
    booking: `Booking | ${siteName}`,
    blog: `Blog | ${siteName}`,
    faq: `FAQ | ${siteName}`,
    gallery: `Gallery | ${siteName}`,
    privacy: `Privacy Policy | ${siteName}`,
    'thank-you': `Thank You | ${siteName}`,
    partners: `Partners | ${siteName}`,
    'select-tenant': `Select Tenant | ${siteName}`,
    login: `Login | ${siteName}`,
    crm: `CRM | ${siteName}`,
    // Removed pricebook from static map
  };

  // Blog detail
  if (seg0 === 'blog' && seg1) {
    return `Blog: ${titleCase(seg1)} | ${siteName}`;
  }

  // Service areas
  if (seg0 === 'service-areas' && seg1) {
    return `Service Area: ${titleCase(seg1)} | ${siteName}`;
  }

  // Partners detail
  if (seg0 === 'partners' && seg1) {
    return `Partners: ${titleCase(seg1)} | ${siteName}`;
  }

  if (staticMap[seg0] !== undefined) return staticMap[seg0];

  // Tenant root pages (/:tenantId with no further path)
  if (segments.length === 1) return `Tenant | ${siteName}`;

  return `Page | ${siteName}`;
};

const TitleManager = () => {
  const location = useLocation();
  useEffect(() => {
    document.title = computeTitle(location.pathname);
  }, [location.pathname]);
  return null;
};

const NotFound = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 text-center px-6 py-12">
    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">Page not found</div>
    <div className="text-gray-600 dark:text-gray-300">
      Looks like this page got lost in the ductwork. Let’s get you back on track.
    </div>
    <div className="flex gap-3 flex-wrap items-center justify-center">
      <Link
        to="/"
        className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
      >
        Go Home
      </Link>
      <Link
        to="/contact"
        className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        Contact Us
      </Link>
    </div>
  </div>
);

// Layout wrapper
const PublicLayout = () => (
  <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
    <TrainingModeBanner />
    <Navigation />
    <main className="flex-grow">
      <Suspense fallback={<LoadingFallback />}>
        <Outlet />
      </Suspense>
    </main>
    <Footer />
    <MobileCtaBar />
    <ChatWidget />
  </div>
);

const CRMRoutes = () => (
  <Routes>
    <Route element={<BHFCrmLayout />}>
      <Route index element={<CRMHub />} />
      <Route path="leads" element={<FeatureGuard flag="enableLeads"><LeadsPage /></FeatureGuard>} />
      <Route path="pipeline" element={<FeatureGuard flag="enablePipeline"><PipelinePage /></FeatureGuard>} />
      <Route path="jobs" element={<FeatureGuard flag="enableJobs"><JobsPage /></FeatureGuard>} />
      <Route path="schedule" element={<FeatureGuard flag="enableSchedule"><SchedulePage /></FeatureGuard>} />
      <Route path="estimates" element={<FeatureGuard flag="enableEstimates"><EstimatesPage /></FeatureGuard>} />
      <Route path="proposals" element={<FeatureGuard flag="enableEstimates"><ProposalList /></FeatureGuard>} />
      <Route path="proposals/new" element={<FeatureGuard flag="enableEstimates"><ProposalBuilder /></FeatureGuard>} />
      <Route path="proposals/:id" element={<FeatureGuard flag="enableEstimates"><ProposalBuilder /></FeatureGuard>} />
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
    </Route>
  </Routes>
);

function App() {
  return (
    <Router>
      <TitleManager />
      <Routes>
        {/* Root Path Handler */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="home" element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="booking" element={<Booking />} />
          <Route path="blog" element={<Blog />} />
          <Route path="faq" element={<Faq />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="privacy" element={<PrivacyPolicy />} />
          <Route path="thank-you" element={<ThankYou />} />

          {/* Service Areas */}
          <Route path="service-areas/melbourne" element={<Melbourne />} />
          <Route path="service-areas/merritt-island" element={<MerrittIsland />} />
          <Route path="service-areas/new-smyrna-beach" element={<NewSmyrnaBeach />} />
          <Route path="service-areas/port-st-john" element={<PortStJohn />} />
          <Route path="service-areas/rockledge" element={<Rockledge />} />
          <Route path="service-areas/suntree" element={<Suntree />} />
          <Route path="service-areas/titusville" element={<Titusville />} />
          <Route path="service-areas/viera" element={<Viera />} />
          <Route path="service-areas/cocoa" element={<Cocoa />} />

          {/* Partners */}
          <Route path="partners" element={<PartnersLanding />} />
          <Route path="partners/realtor" element={<RealtorPartner />} />
          <Route path="partners/property-manager" element={<PropertyManagerPartner />} />
          <Route path="partners/hoa" element={<HoaPartner />} />
          <Route path="partners/government" element={<GovernmentPartner />} />
          <Route path="partners/b2b" element={<B2bPartner />} />
          <Route path="partners/welcome" element={<PartnerWelcome />} />

           {/* Blog Content */}
          <Route path="blog/clean-air-certified" element={<CleanAirCertified />} />
          <Route path="blog/dryer-vent-fire-safety" element={<DryerVentFireSafety />} />
          <Route path="blog/florida-filter-guide" element={<FloridaFilterGuide />} />
          <Route path="blog/florida-humidity-duct-contamination" element={<FloridaHumidityDuctContamination />} />
          <Route path="blog/free-air-check" element={<FreeAirCheck />} />
          <Route path="blog/mechanical-hygiene-vs-duct-cleaning" element={<MechanicalHygieneVsDuctCleaning />} />
          <Route path="blog/nadca-standards" element={<NadcaStandards />} />
          <Route path="blog/return-duct-leak" element={<ReturnDuctLeak />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/select-tenant" element={<SelectTenant />} />

        {/* Dynamic Tenant Route - Wraps everything under /:tenantId */}
        <Route path="/:tenantId">
          <Route path="login" element={<Login />} />

          <Route element={<PublicLayout />}>
            <Route path="home" element={<Home />} />
            <Route path="services" element={<Services />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="booking" element={<Booking />} />
            <Route path="blog" element={<Blog />} />
            <Route path="faq" element={<Faq />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="privacy" element={<PrivacyPolicy />} />
            <Route path="thank-you" element={<ThankYou />} />

            {/* Service Areas */}
            <Route path="service-areas/melbourne" element={<Melbourne />} />
            <Route path="service-areas/merritt-island" element={<MerrittIsland />} />
            <Route path="service-areas/new-smyrna-beach" element={<NewSmyrnaBeach />} />
            <Route path="service-areas/port-st-john" element={<PortStJohn />} />
            <Route path="service-areas/rockledge" element={<Rockledge />} />
            <Route path="service-areas/suntree" element={<Suntree />} />
            <Route path="service-areas/titusville" element={<Titusville />} />
            <Route path="service-areas/viera" element={<Viera />} />
            <Route path="service-areas/cocoa" element={<Cocoa />} />

            {/* Partners */}
            <Route path="partners" element={<PartnersLanding />} />
            <Route path="partners/realtor" element={<RealtorPartner />} />
            <Route path="partners/property-manager" element={<PropertyManagerPartner />} />
            <Route path="partners/hoa" element={<HoaPartner />} />
            <Route path="partners/government" element={<GovernmentPartner />} />
            <Route path="partners/b2b" element={<B2bPartner />} />
            <Route path="partners/welcome" element={<PartnerWelcome />} />

             {/* Blog Content */}
            <Route path="blog/clean-air-certified" element={<CleanAirCertified />} />
            <Route path="blog/dryer-vent-fire-safety" element={<DryerVentFireSafety />} />
            {/* Removed the duplicate route for the blog from here, as it was already defined earlier in the public routes */}
            {/* <Route path="*" element={<NotFound />} /> This line also creates issues and should be at the end of the Routes list for /:tenantId block*/}
          </Route>

          {/* CRM Routes - Now Public, TenantGuard Removed */}
          <Route 
            path="crm/*" 
            element={
                <Suspense fallback={<LoadingFallback />}>
                  <CRMRoutes />
                </Suspense>
            } 
          />
          {/* NotFound for tenantId path */}
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/bhf/tenant-management" element={<BHFCrmLayout><TenantManagement /></BHFCrmLayout>} />
        <Route path="/bhf/tenant-onboarding" element={<TenantOnboarding />} />
        <Route path="/system-doctor" element={<SystemDoctorConsole />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
