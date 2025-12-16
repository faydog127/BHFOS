
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SupabaseAuthProvider } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import MobileCtaBar from '@/components/MobileCtaBar';
import ChatWidget from '@/components/ChatWidget';

// Public Pages
import Home from '@/pages/Home';
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

// CRM Pages (Old & New Mixed - transitioning to Enterprise)
import AdminRoute from '@/components/AdminRoute';
import BackendTest from '@/pages/crm/BackendTest';
import AdvancedDiagnostics from '@/components/crm/settings/AdvancedDiagnostics';
import MasterDiagnostics from '@/pages/bhf/MasterDiagnostics';
import ImprovementAnalysis from '@/pages/bhf/ImprovementAnalysis';
import ConfigExplainer from '@/pages/bhf/ConfigExplainer';
import ChangeLog from '@/pages/bhf/ChangeLog';

// ENTERPRISE CRM PAGES
import Dashboard from '@/pages/crm/Dashboard';
import CallsPage from '@/pages/crm/CallsPage';
import ContactsPage from '@/pages/crm/ContactsPage';
import LeadsPage from '@/pages/crm/LeadsPage';
import DealsPage from '@/pages/crm/DealsPage';
import ReportsPage from '@/pages/crm/ReportsPage';
import SettingsPage from '@/pages/crm/SettingsPage';

// DOCUMENTATION PAGES
import DocumentationDashboard from '@/pages/bhf/DocumentationDashboard';
import SessionReport from '@/pages/bhf/SessionReport';
import FixesDocumentation from '@/pages/bhf/FixesDocumentation';
import IssuesDocumentation from '@/pages/bhf/IssuesDocumentation';

// Other Pages
import ForContractors from '@/pages/ForContractors';
import Pricebook from '@/pages/Pricebook';
import Standards from '@/pages/Standards';
import FreeAirCheckModal from '@/components/FreeAirCheckModal';
import VendorPacket from '@/pages/VendorPacket';
import CleanAirRefreshPartner from '@/pages/CleanAirRefreshPartner';
import PropertyManagers from '@/pages/PropertyManagers';
import BuildHealth from '@/pages/BuildHealth';
import SystemDoctorConsole from '@/components/SystemDoctorConsole';

const PublicRoutes = () => {
  const location = useLocation();
  
  // Hide public nav/footer on CRM pages to allow full Enterprise Layout control
  const isCrmRoute = location.pathname.startsWith('/crm');
  const isSpecialRoute = location.pathname === '/thank-you' || location.pathname === '/partners/welcome' || location.pathname === '/login';
  const hidePublicNav = isCrmRoute || isSpecialRoute;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {!hidePublicNav && <Navigation />}
      <main className={`flex-grow ${!hidePublicNav ? 'pb-20 lg:pb-0' : ''}`}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
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

          <Route path="/service-areas/melbourne" element={<Melbourne />} />
          <Route path="/service-areas/merritt-island" element={<MerrittIsland />} />
          <Route path="/service-areas/new-smyrna-beach" element={<NewSmyrnaBeach />} />
          <Route path="/service-areas/port-st-john" element={<PortStJohn />} />
          <Route path="/service-areas/rockledge" element={<Rockledge />} />
          <Route path="/service-areas/suntree" element={<Suntree />} />
          <Route path="/service-areas/titusville" element={<Titusville />} />
          <Route path="/service-areas/viera" element={<Viera />} />
          <Route path="/service-areas/cocoa" element={<Cocoa />} />

          <Route path="/partners" element={<PartnersLanding />} />
          <Route path="/partners/realtor" element={<RealtorPartner />} />
          <Route path="/partners/property-manager" element={<PropertyManagerPartner />} />
          <Route path="/partners/hoa" element={<HoaPartner />} />
          <Route path="/partners/government" element={<GovernmentPartner />} />
          <Route path="/partners/b2b" element={<B2bPartner />} />
          <Route path="/partners/welcome" element={<PartnerWelcome />} />

          <Route path="/blog/clean-air-certified" element={<CleanAirCertified />} />
          <Route path="/blog/dryer-vent-fire-safety" element={<DryerVentFireSafety />} />
          <Route path="/blog/florida-filter-guide" element={<FloridaFilterGuide />} />
          <Route path="/blog/florida-humidity-duct-contamination" element={<FloridaHumidityDuctContamination />} />
          <Route path="/blog/free-air-check" element={<FreeAirCheck />} />
          <Route path="/blog/mechanical-hygiene-vs-duct-cleaning" element={<MechanicalHygieneVsDuctCleaning />} />
          <Route path="/blog/nadca-standards" element={<NadcaStandards />} />
          <Route path="/blog/return-duct-leak" element={<ReturnDuctLeak />} />

          <Route path="/for-contractors" element={<ForContractors />} />
          <Route path="/pricebook" element={<Pricebook />} />
          <Route path="/standards" element={<Standards />} />
          <Route path="/free-air-check" element={<FreeAirCheckModal />} />
          <Route path="/vendor-packet" element={<VendorPacket />} />
          <Route path="/clean-air-refresh-partner" element={<CleanAirRefreshPartner />} />
          <Route path="/property-managers" element={<PropertyManagers />} />
          <Route path="/build-health" element={<BuildHealth />} />
          <Route path="/system-doctor" element={<AdminRoute><SystemDoctorConsole /></AdminRoute>} />

          {/* CRM ROUTES (New Enterprise Structure) */}
          <Route path="/crm" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/crm/calls" element={<AdminRoute><CallsPage /></AdminRoute>} />
          <Route path="/crm/contacts" element={<AdminRoute><ContactsPage /></AdminRoute>} />
          <Route path="/crm/leads" element={<AdminRoute><LeadsPage /></AdminRoute>} />
          <Route path="/crm/deals" element={<AdminRoute><DealsPage /></AdminRoute>} />
          <Route path="/crm/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
          <Route path="/crm/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />

          {/* Legacy/Tech Routes kept accessible for admins but maybe not in main nav */}
          <Route path="/crm/backend-test" element={<AdminRoute><BackendTest /></AdminRoute>} />
          <Route path="/crm/advanced-diagnostics" element={<AdminRoute><AdvancedDiagnostics /></AdminRoute>} />

          {/* Diagnostics & Documentation Routes */}
          <Route path="/bhf/master-diagnostics" element={<AdminRoute><MasterDiagnostics /></AdminRoute>} />
          <Route path="/bhf/improvement-analysis" element={<AdminRoute><ImprovementAnalysis /></AdminRoute>} />
          <Route path="/bhf/config-explainer" element={<AdminRoute><ConfigExplainer /></AdminRoute>} />
          <Route path="/bhf/change-log" element={<AdminRoute><ChangeLog /></AdminRoute>} />
          <Route path="/bhf/documentation" element={<AdminRoute><DocumentationDashboard /></AdminRoute>} />
          <Route path="/bhf/session-report/:sessionId" element={<AdminRoute><SessionReport /></AdminRoute>} />
          <Route path="/bhf/session-report" element={<AdminRoute><SessionReport /></AdminRoute>} />
          <Route path="/bhf/fixes" element={<AdminRoute><FixesDocumentation /></AdminRoute>} />
          <Route path="/bhf/issues" element={<AdminRoute><IssuesDocumentation /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hidePublicNav && <Footer />}
      {!hidePublicNav && <MobileCtaBar />}
      {!hidePublicNav && <ChatWidget />}
    </div>
  );
};

function App() {
  return (
    <SupabaseAuthProvider>
      <Router>
        <PublicRoutes />
      </Router>
    </SupabaseAuthProvider>
  );
}

export default App;
