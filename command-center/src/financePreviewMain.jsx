/**
 * Local screenshot harness. Not imported by the production entry.
 * Vite's default build input is index.html only, so this file is not a public route.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import FinanceShell from '@/pages/finance/FinanceShell';
import '@/index.css';

const params = new URLSearchParams(window.location.search);
const start = params.get('section') || '';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[start ? `/tvg/finance/${start}` : '/tvg/finance']}>
      <FinanceShell routeTenantId="tvg" sessionTenantId="tvg" />
    </MemoryRouter>
  </React.StrictMode>,
);
