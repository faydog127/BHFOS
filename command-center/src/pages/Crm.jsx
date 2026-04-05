import React from 'react';
import { Navigate } from 'react-router-dom';
import { canonicalCrmRoutePaths } from '@/routes/canonicalCrmPaths';

// Legacy shim: App.jsx is the only authoritative CRM route tree.
// Keep this export for diagnostics modules that consume "actualRoutePaths".
export const actualRoutePaths = canonicalCrmRoutePaths;

const CrmLegacyShim = () => <Navigate to="/select-tenant" replace />;

export default CrmLegacyShim;

