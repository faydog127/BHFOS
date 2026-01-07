import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CrmLayout from '@/components/CrmLayout';
import CrmHome from '@/pages/crm/CrmHome';

// Import existing components from the codebase
// Using lazy loading or direct imports depending on what's typically best for this structure
// Assuming standard imports for stability given the constraints

import Partners from '@/pages/crm/Partners';
import Inbox from '@/pages/crm/Inbox';
import SmsInbox from '@/pages/crm/SmsInbox';
import CallConsole from '@/pages/crm/CallConsole';
import CallScripts from '@/pages/crm/CallScripts';
import Schedule from '@/pages/crm/Schedule';
import AppointmentScheduler from '@/pages/crm/appointments/AppointmentScheduler';
import Customers from '@/pages/crm/Customers';
import MyMoney from '@/pages/crm/MyMoney';
import Marketing from '@/pages/crm/Marketing';
import Reporting from '@/pages/crm/Reporting';
import Settings from '@/pages/crm/Settings';
import TechDashboard from '@/pages/tech/TechDashboard';
import Pipeline from '@/pages/crm/Pipeline';

// Leads pages
import LeadsList from '@/pages/crm/LeadsList';
import Leads from '@/pages/crm/Leads'; 

// Quotes & Invoices
import Quotes from '@/pages/crm/Quotes';
import Invoices from '@/pages/crm/Invoices';

// Export the list of actual routes defined in this file for BuildHealth validation
export const actualRoutePaths = [
  '/crm',
  '/crm/partners',
  '/crm/inbox',
  '/crm/sms',
  '/crm/call-console',
  '/crm/scripts',
  '/crm/schedule',
  '/crm/appointments',
  '/crm/customers',
  '/crm/my-money',
  '/crm/marketing',
  '/crm/reporting',
  '/crm/settings',
  '/crm/tech-portal',
  '/crm/pipeline',
  '/crm/leads',
  '/crm/quotes',
  '/crm/invoices'
];

const Crm = () => {
  return (
    <CrmLayout>
      <Routes>
        {/* Dashboard Home */}
        <Route index element={<CrmHome />} />
        
        {/* Core Navigation */}
        <Route path="partners" element={<Partners />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="sms" element={<SmsInbox />} />
        <Route path="call-console" element={<CallConsole />} />
        <Route path="scripts" element={<CallScripts />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="appointments" element={<AppointmentScheduler />} />
        <Route path="customers" element={<Customers />} />
        <Route path="my-money" element={<MyMoney />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="reporting" element={<Reporting />} />
        <Route path="settings" element={<Settings />} />
        <Route path="tech-portal" element={<TechDashboard />} />
        
        {/* Quick Action Targets */}
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="leads" element={<LeadsList />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="invoices" element={<Invoices />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Routes>
    </CrmLayout>
  );
};

export default Crm;