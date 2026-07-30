import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { fetchMilRole, milCapabilities } from '@/lib/mediaIntel/roles';

/**
 * Route guard for Media Library surfaces.
 * capability: 'staff' | 'reviewer' | 'ownerAdmin' | 'creator' | 'upload'
 */
export default function MediaCapabilityGuard({ capability = 'staff', children, forbiddenRedirect }) {
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
      <div className="min-h-[40vh] flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Checking access…
      </div>
    );
  }

  const caps = state.caps;
  const allowed =
    (capability === 'staff' && caps.isStaff) ||
    (capability === 'reviewer' && caps.isReviewer) ||
    (capability === 'ownerAdmin' && caps.isOwnerAdmin) ||
    (capability === 'creator' && caps.isCreator) ||
    // Phone uploads are bearer-session-authorized (mil_upload_sessions), not role-based;
    // phone_uploader carries no library capability here.
    (capability === 'upload' && caps.canUpload);

  if (!allowed) {
    if (caps.isCreator && forbiddenRedirect !== false) {
      return <Navigate to="/creator" replace />;
    }
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center mt-10">
        <h1 className="text-lg font-semibold text-slate-900">Access not available</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account does not have permission for this part of the Media Library.
        </p>
      </div>
    );
  }

  return children;
}
