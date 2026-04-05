
import React from 'react';
import { Navigate } from 'react-router-dom';

// Legacy shim: prevent use of duplicate CRM route trees.
// Canonical routing lives in src/App.jsx (/:tenantId/crm/*).
const CRMRoutes = () => <Navigate to="/select-tenant" replace />;

export default CRMRoutes;
