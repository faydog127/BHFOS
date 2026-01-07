
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Crm from '@/pages/crm/Crm';

const CRMRoutes = () => {
  return (
    <Routes>
      <Route path="*" element={<Crm />} />
    </Routes>
  );
};

export default CRMRoutes;
