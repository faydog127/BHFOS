import React, { useMemo } from 'react';
import { useConventionWorkspace } from './ConventionDemoLayout';
import { createNetworkOsConventionIntakeService } from '@/services/networkOsConventionIntakeService';
import { ConventionBanner, ConventionEmpty } from './conventionUi';

export default function ConventionIntakeQueuePage() {
  const { workspace } = useConventionWorkspace();
  const service = useMemo(() => createNetworkOsConventionIntakeService(), []);
  const queue = service.listIntakeQueue({
    session: workspace?.tenant?.tenantId ? { tenantId: workspace.tenant.tenantId } : null,
    bhisIntakeGrant: false,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Onboarding intake</h2>
      <ConventionBanner tone="blocked">
        {queue.error?.message ||
          'Provider interest cannot be stored until an isolated intake object and effective RLS are proven.'}
      </ConventionBanner>
      <ConventionEmpty>
        No convention intake rows are visible. Customer and partner operational
        records are not queried from this queue.
      </ConventionEmpty>
    </div>
  );
}
