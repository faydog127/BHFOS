
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

const BrandReview = () => {
  return (
    <div className="p-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            Brand Consistency Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Brand compliance tools coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandReview;
