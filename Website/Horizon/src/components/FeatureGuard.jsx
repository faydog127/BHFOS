
import React from 'react';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { AlertCircle, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const FeatureGuard = ({ flag, children, fallback }) => {
  const { flags, isLoading } = useFeatureFlags();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading module permissions...</div>;
  }

  // If flag is provided and disabled in config
  if (flag && flags[flag] === false) {
    if (fallback) return fallback;

    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-slate-50">
        <Card className="max-w-md w-full border-red-100 shadow-sm">
          <CardContent className="flex flex-col items-center text-center p-8 space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
              <Lock className="h-6 w-6 text-red-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Access Restricted</h3>
              <p className="text-sm text-slate-500">
                The <strong>{flag}</strong> module is currently disabled for this tenant environment.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/bhf/crm')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
};

export default FeatureGuard;
