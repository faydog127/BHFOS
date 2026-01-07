
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

const AdminPanel = () => {
  return (
    <div className="p-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Shield className="h-6 w-6 text-slate-800" />
             Super Admin Control Panel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Advanced administrative controls coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
