import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { buildMilRecordUrl, isCrmProductionHost } from '@/config/milRecordHost';

/** On app.bhfos.com, send MIL product routes to mil.bhfos.com. Elsewhere, render children. */
export function CrmHostMilOffload({ children }) {
  if (isCrmProductionHost()) {
    return <MilRecordRedirect />;
  }
  return children;
}

export default function MilRecordRedirect() {
  const location = useLocation();

  useEffect(() => {
    const dest = buildMilRecordUrl(location);
    window.location.replace(dest);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center gap-2">
      <p className="text-sm font-medium text-slate-800">Opening Media Intelligence…</p>
      <p className="text-xs text-slate-500">Redirecting to mil.bhfos.com</p>
    </div>
  );
}
