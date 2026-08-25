import React from 'react';
import ConventionSessionGuard from './ConventionSessionGuard';
import ConventionIntakeQueuePage from './ConventionIntakeQueuePage';

export default function ConventionIntakeRoutes() {
  return (
    <ConventionSessionGuard>
      <ConventionIntakeQueuePage />
    </ConventionSessionGuard>
  );
}
