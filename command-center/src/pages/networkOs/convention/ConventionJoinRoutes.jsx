import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ConventionJoinPage from './ConventionJoinPage';
import ConventionJoinThanksPage from './ConventionJoinThanksPage';

export default function ConventionJoinRoutes() {
  return (
    <Routes>
      <Route index element={<ConventionJoinPage />} />
      <Route path="thanks" element={<ConventionJoinThanksPage />} />
      <Route path="*" element={<Navigate to="/network-os/convention/join" replace />} />
    </Routes>
  );
}
