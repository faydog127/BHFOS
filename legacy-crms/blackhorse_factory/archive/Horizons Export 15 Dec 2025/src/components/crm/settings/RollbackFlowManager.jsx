
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Undo2 } from 'lucide-react';

const RollbackFlowManager = () => {
  return (
    <div className="p-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Undo2 className="h-6 w-6 text-red-600" />
             Rollback Flow Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Rollback orchestration tools coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RollbackFlowManager;
