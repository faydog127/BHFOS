import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CrmLayout from '@/components/CrmLayout';
import CrmHome from '@/pages/crm/CrmHome';
import Leads from '@/pages/crm/Leads';
import Jobs from '@/pages/crm/Jobs';
import Partners from '@/pages/crm/Partners';
import Inbox from '@/pages/crm/Inbox';
import Schedule from '@/pages/crm/Schedule';
import Customers from '@/pages/crm/Customers';
import MyMoney from '@/pages/crm/MyMoney';
import Payroll from '@/pages/crm/Payroll';
import Reporting from '@/pages/crm/Reporting';
import Marketing from '@/pages/crm/Marketing';
import SmartCallConsole from '@/pages/crm/SmartCallConsole';
import Settings from '@/pages/crm/Settings';
import ChatWidgetSettings from '@/pages/crm/ChatWidgetSettings';
import BusinessSettings from '@/pages/crm/settings/BusinessSettings';
import BrandingSettings from '@/pages/crm/settings/BrandingSettings';
import SystemDiagnostics from '@/pages/crm/settings/SystemDiagnostics'; // Keep this import for the direct route

// New Imports for Wiring
import Pipeline from '@/pages/crm/Pipeline';
import Estimates from '@/pages/crm/Estimates';
import ProposalList from '@/pages/crm/proposals/ProposalList';
import ActionHub from '@/pages/crm/ActionHub';
import AdminPanel from '@/pages/crm/AdminPanel';
import PartnerSubmissions from '@/pages/crm/PartnerSubmissions';
import DataTools from '@/pages/crm/DataTools';
import BrandReview from '@/pages/crm/BrandReview';
import BrandBrainLoader from '@/pages/crm/BrandBrainLoader';
import SystemHealth from '@/pages/crm/SystemHealth';
import AuditInspector from '@/pages/crm/AuditInspector';
import BackendTest from '@/pages/crm/BackendTest'; // Assuming BackendTest is the new component for Diagnostics as per the image

const Crm = () => {
  return (
    <CrmLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/crm/dashboard" replace />} />
        <Route path="dashboard" element={<CrmHome />} />
        <Route path="leads" element={<Leads />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="partners" element={<Partners />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="customers" element={<Customers />} />
        <Route path="money" element={<MyMoney />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="reporting" element={<Reporting />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="call-console" element={<SmartCallConsole />} />
        <Route path="chat-settings" element={<ChatWidgetSettings />} />
        
        {/* NEW DIRECT ROUTE FOR SYSTEM DIAGNOSTICS */}
        <Route path="diagnostics" element={<SystemDiagnostics />} />
        <Route path="backend-test" element={<BackendTest />} /> {/* This seems to be the diagnostics page as per the image */}
        
        {/* Newly Wired Routes */}
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="estimates" element={<Estimates />} />
        <Route path="proposals" element={<ProposalList />} />
        <Route path="action-hub" element={<ActionHub />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="submissions" element={<PartnerSubmissions />} />
        <Route path="data-tools" element={<DataTools />} />
        <Route path="brand-review" element={<BrandReview />} />
        <Route path="brand-brain" element={<BrandBrainLoader />} />
        <Route path="system-health" element={<SystemHealth />} />
        <Route path="audit-log" element={<AuditInspector />} />

        {/* Settings with Nested Routes (The /crm/settings/diagnostics route will still exist if it's explicitly needed here) */}
        <Route path="settings" element={<Settings />}>
          <Route index element={<BusinessSettings />} />
          <Route path="branding" element={<BrandingSettings />} />
          {/* Note: If /crm/diagnostics serves the same purpose, this nested route might be redundant or serve a different context */}
          <Route path="diagnostics" element={<SystemDiagnostics />} /> 
        </Route>

        {/* Fallback for undefined sub-routes */}
        <Route path="*" element={<Navigate to="/crm/dashboard" replace />} />
      </Routes>
    </CrmLayout>
  );
};

export default Crm;