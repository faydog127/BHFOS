import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ConventionSessionGuard from './ConventionSessionGuard';
import ConventionDemoLayout from './ConventionDemoLayout';
import {
  ConventionAttentionPage,
  ConventionCatalogPage,
  ConventionContactsPage,
  ConventionNeedsPage,
} from './ConventionScreens';

export default function ConventionRoutes() {
  return (
    <ConventionSessionGuard>
      <Routes>
        <Route element={<ConventionDemoLayout />}>
          <Route index element={<ConventionAttentionPage />} />
          <Route path="needs" element={<ConventionNeedsPage />} />
          <Route path="contacts" element={<ConventionContactsPage />} />
          <Route path="catalog" element={<ConventionCatalogPage />} />
          <Route path="*" element={<Navigate to="/network-os/convention" replace />} />
        </Route>
      </Routes>
    </ConventionSessionGuard>
  );
}
