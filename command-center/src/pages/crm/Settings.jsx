import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import FeatureFlagManager from '@/components/crm/settings/FeatureFlagManager';
import SecretsManager from '@/components/crm/settings/SecretsManager';
import SystemDiagnostics from '@/components/crm/settings/SystemDiagnostics';
import TrainingDataSettings from '@/components/crm/settings/TrainingDataSettings';
import BillingPaymentsSettings from '@/components/crm/settings/BillingPaymentsSettings';
import SYSTEM_VERSION from '@/config/version';
import CrmPageHeader from '@/components/crm/CrmPageHeader';
import { getTenantId } from '@/lib/tenantUtils';

const SettingsPage = () => {
  const tenantId = getTenantId();

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <CrmPageHeader
        title="System Settings"
        description="Configuration, security, and feature management."
        breadcrumbs={[
          { label: 'Hub', to: `/${tenantId}/crm` },
          { label: 'Settings' },
        ]}
      />

      <Tabs defaultValue="billing" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[720px]">
          <TabsTrigger value="billing">Billing & Payments</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="secrets">Secrets</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="space-y-6">
          <BillingPaymentsSettings />
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <TrainingDataSettings />
          
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Environment details and versioning.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 border-b pb-4">
                <div className="font-medium text-slate-700">App Version</div>
                <div className="text-sm text-slate-500">{SYSTEM_VERSION.getDisplayString()}</div>
              </div>
              <div className="grid gap-2 border-b pb-4">
                <div className="font-medium text-slate-700">Build Codename</div>
                <div className="text-sm text-slate-500 font-mono">{SYSTEM_VERSION.codeName}</div>
              </div>
              <div className="grid gap-2">
                <div className="font-medium text-slate-700">Environment</div>
                <div className="text-sm text-slate-500 uppercase font-mono bg-slate-100 inline-block px-2 py-1 rounded w-fit">
                   {import.meta.env.MODE}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <FeatureFlagManager />
        </TabsContent>

        <TabsContent value="secrets">
          <SecretsManager />
        </TabsContent>

        <TabsContent value="diagnostics">
          <SystemDiagnostics />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
