
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';

const FeedbackImpactDashboard = () => {
  return (
    <div className="p-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Activity className="h-6 w-6 text-indigo-600" />
             Feedback Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Feedback analytics coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackImpactDashboard;
