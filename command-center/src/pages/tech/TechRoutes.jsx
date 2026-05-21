import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import TechLayout from '@/components/tech/TechLayout';

import TechQueue from '@/pages/tech/TechQueue';
import TechJobDetail from '@/pages/tech/TechJobDetail';
import TechInspectionSession from '@/pages/tech/TechInspectionSession';
import TechInspectionReview from '@/pages/tech/TechInspectionReview';

export default function TechRoutes() {
  return (
    <Routes>
      <Route element={<TechLayout />}>
        <Route index element={<Navigate to="queue" replace />} />
        <Route path="queue" element={<TechQueue />} />
        <Route path="jobs/:jobId" element={<TechJobDetail />} />
        <Route path="inspections/:inspectionId" element={<TechInspectionSession />} />
        <Route path="inspections/:inspectionId/review" element={<TechInspectionReview />} />
        <Route path="*" element={<Navigate to="queue" replace />} />
      </Route>
    </Routes>
  );
}

