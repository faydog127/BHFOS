import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import FactoryLayout from './pages/FactoryLayout';
import FactoryLobby from './pages/FactoryLobby';
import SystemDoctorConsole from './pages/bhf/SystemDoctorConsole';
import SupabaseProbe from './pages/bhf/SupabaseProbe';
import BuildHealthDashboard from './components/admin/BuildHealthDashboard';
import CRMCore from './pages/CRMCore';
import Communications from './pages/Communications';

const queryClient = new QueryClient();

const TenantSimulator = () => (
  <div className="p-8 text-slate-200">
    <h1 className="text-2xl font-bold mb-2">Tenant Simulator</h1>
    <p className="text-slate-400">Simulation tooling placeholder. Wire RLS tests here.</p>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<FactoryLayout />}>
            <Route path="/" element={<FactoryLobby />} />
            <Route path="/bhf/crm" element={<CRMCore />} />
            <Route path="/bhf/communications" element={<Communications />} />
            <Route path="/bhf/system-doctor" element={<SystemDoctorConsole />} />
            <Route path="/bhf/probe" element={<SupabaseProbe />} />
            <Route path="/bhf/build-health" element={<BuildHealthDashboard />} />
            <Route path="/bhf/tenant-simulator" element={<TenantSimulator />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
