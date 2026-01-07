
import React from 'react';
import EnterpriseLayout from '@/components/crm/EnterpriseLayout';
import { EnterpriseCard, EnterpriseCardHeader, EnterpriseCardContent, EnterpriseCardFooter } from '@/components/crm/EnterpriseCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const SettingsPage = () => {
  return (
    <EnterpriseLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-slate-500 mt-1">Manage your account preferences and system configurations.</p>
        </div>

        <EnterpriseCard>
          <EnterpriseCardHeader title="Profile Information" subtitle="Update your personal details" />
          <EnterpriseCardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input defaultValue="Admin" className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input defaultValue="User" className="bg-slate-50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input defaultValue="admin@example.com" disabled className="bg-slate-100" />
            </div>
          </EnterpriseCardContent>
          <EnterpriseCardFooter className="flex justify-end">
             <Button className="bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
          </EnterpriseCardFooter>
        </EnterpriseCard>

        <EnterpriseCard>
          <EnterpriseCardHeader title="Notifications" subtitle="Configure how you receive alerts" />
          <EnterpriseCardContent>
             <div className="space-y-6">
               <div className="flex items-center justify-between">
                 <div className="space-y-0.5">
                   <Label className="text-base">Email Notifications</Label>
                   <p className="text-sm text-slate-500">Receive daily summaries via email.</p>
                 </div>
                 <Button variant="outline" className="w-24">Enabled</Button>
               </div>
               <Separator />
               <div className="flex items-center justify-between">
                 <div className="space-y-0.5">
                   <Label className="text-base">Push Notifications</Label>
                   <p className="text-sm text-slate-500">Get real-time alerts for new leads.</p>
                 </div>
                 <Button variant="outline" className="w-24 text-slate-500">Disabled</Button>
               </div>
             </div>
          </EnterpriseCardContent>
        </EnterpriseCard>
      </div>
    </EnterpriseLayout>
  );
};

export default SettingsPage;
