import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import MediaLibraryLayout from './MediaLibraryLayout';
import { fetchMilRole, milCapabilities } from '@/lib/mediaIntel/roles';

/**
 * Owner/staff Media Library entry. Creators are redirected to the focused portal
 * before CRM chrome can appear.
 */
export default function MediaOwnerShell() {
  const [state, setState] = useState({ loading: true, caps: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const role = await fetchMilRole();
      if (!cancelled) setState({ loading: false, caps: milCapabilities(role) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-slate-500 bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin" /> Opening Media Library…
      </div>
    );
  }

  if (state.caps?.isCreator && !state.caps?.isStaff) {
    return <Navigate to="/creator" replace />;
  }

  if (state.caps?.isPhoneUploader && !state.caps?.isStaff) {
    return <Navigate to="/media/upload" replace />;
  }

  if (!state.caps?.isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold">Access not available</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in with an authorized Media Library account.</p>
        </div>
      </div>
    );
  }

  return <MediaLibraryLayout />;
}
