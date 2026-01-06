import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BuildHealth from './bhf/BuildHealth';
import SupabaseProbe from './bhf/SupabaseProbe';
import SystemDoctorConsole from './bhf/SystemDoctorConsole';

const Bhf = () => (
  <Routes>
    <Route path="build-health" element={<BuildHealth />} />
    <Route path="probe" element={<SupabaseProbe />} />
    <Route path="system-doctor" element={<SystemDoctorConsole />} />
    <Route path="*" element={<Navigate to="/bhf/build-health" replace />} />
  </Routes>
);

export default Bhf;
