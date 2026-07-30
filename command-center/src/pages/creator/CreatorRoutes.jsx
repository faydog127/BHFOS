import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CreatorPortalLayout from './CreatorPortalLayout';
import MediaCreatorWorkspace from '@/pages/crm/media/MediaCreatorWorkspace';
import { fetchMilRole, milCapabilities } from '@/lib/mediaIntel/roles';

function CreatorWorkspacePage() {
  const [caps, setCaps] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const role = await fetchMilRole();
      if (!cancelled) setCaps(milCapabilities(role));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!caps) {
    return <div className="text-sm text-slate-500 py-6">Loading workspace…</div>;
  }

  return <MediaCreatorWorkspace caps={caps} />;
}

/**
 * One honest Creator workspace. Legacy /creator/media|reels|upload bookmarks
 * redirect here — those were never distinct sections.
 */
export default function CreatorRoutes() {
  return (
    <Routes>
      <Route element={<CreatorPortalLayout />}>
        <Route index element={<CreatorWorkspacePage />} />
        <Route path="media" element={<Navigate to="/creator" replace />} />
        <Route path="reels" element={<Navigate to="/creator" replace />} />
        <Route path="upload" element={<Navigate to="/creator" replace />} />
        <Route path="*" element={<Navigate to="/creator" replace />} />
      </Route>
    </Routes>
  );
}
