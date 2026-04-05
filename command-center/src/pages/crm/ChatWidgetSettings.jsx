import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

const ChatWidgetSettings = () => {
  return (
    <div className="p-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <MessageSquare className="h-6 w-6 text-blue-600" />
             Chat Widget Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Widget customization coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatWidgetSettings;