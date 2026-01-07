
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { HeartPulse } from 'lucide-react';

const SystemHealth = () => {
  return (
    <div className="p-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <HeartPulse className="h-6 w-6 text-rose-600" />
             System Health Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Real-time system health metrics coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemHealth;
