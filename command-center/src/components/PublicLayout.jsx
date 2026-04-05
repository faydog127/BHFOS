
import React from 'react';
import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <div className="public-layout min-h-screen bg-slate-50 dark:bg-slate-950">
      <Outlet />
    </div>
  );
};

export default PublicLayout;
