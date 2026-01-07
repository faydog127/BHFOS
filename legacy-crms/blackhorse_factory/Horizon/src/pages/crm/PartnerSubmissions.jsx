
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

const PartnerSubmissions = () => {
  return (
    <div className="p-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <FileText className="h-6 w-6 text-orange-600" />
             Partner Application Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Submission review list coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerSubmissions;
