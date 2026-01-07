import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BrainCircuit } from 'lucide-react';

const BrandBrainLoader = () => {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-indigo-600" />
            Brand Brain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">AI Context Loader coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandBrainLoader;