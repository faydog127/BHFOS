
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import FeatureFlagManager from '@/components/crm/settings/FeatureFlagManager';
import SecretsManager from '@/components/crm/settings/SecretsManager';
import SystemDiagnostics from '@/components/crm/settings/SystemDiagnostics';
import TrainingDataSettings from '@/components/crm/settings/TrainingDataSettings';
import SYSTEM_VERSION from '@/config/version';

const SettingsPage = () => {
  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-slate-500 mt-2">Configuration, security, and feature management.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="secrets">Secrets</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
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
