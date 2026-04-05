import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, UserCheck, Headphones as Headset } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AgentSessionOverlay = ({ onSessionStart }) => {
  const { user } = useAuth();
  const [agentName, setAgentName] = useState(user?.user_metadata?.full_name || '');
  const [stationId, setStationId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = () => {
    setIsLoading(true);
    // Simulate auth check/logging login to DB
    setTimeout(() => {
        onSessionStart({ agentName, stationId: stationId || 'Remote' });
        setIsLoading(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Headset className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">Smart Call Console</CardTitle>
          <CardDescription>Authenticate to begin your dialing session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Agent Name</label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                value={agentName} 
                onChange={(e) => setAgentName(e.target.value)}
                className="pl-9"
                placeholder="Enter your full name"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Station ID / Extension</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                value={stationId} 
                onChange={(e) => setStationId(e.target.value)}
                className="pl-9"
                placeholder="Ex: 104 or Remote"
              />
            </div>
          </div>

          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-6 h-12 text-lg"
            onClick={handleStart}
            disabled={!agentName || isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Start Session'}
          </Button>

          <p className="text-xs text-center text-slate-500 mt-4">
            Session activity is logged for quality assurance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentSessionOverlay;