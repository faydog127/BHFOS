
import React from 'react';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { getModuleDefinitions, defaultFlags } from '@/config/featureFlags';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FeatureFlagManager = () => {
  const { flags, updateFlag, isLoading } = useFeatureFlags();
  const modules = getModuleDefinitions();

  // Create a map of all known flags including those not in crm_modules
  const allKnownFlags = [...new Set([
    ...modules.map(m => m.flag),
    ...Object.keys(defaultFlags)
  ])];

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading feature configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Feature Management</h2>
          <p className="text-sm text-slate-500">Control module availability for this tenant.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allKnownFlags.map(flagKey => {
          const moduleInfo = modules.find(m => m.flag === flagKey);
          const isEnabled = flags[flagKey] !== false;
          const isDefault = flags[flagKey] === undefined;
          
          return (
            <Card key={flagKey} className={!isEnabled ? "opacity-75 border-slate-200 bg-slate-50/50" : "border-blue-100 bg-white"}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={flagKey} className="font-semibold cursor-pointer">
                      {moduleInfo ? moduleInfo.label : flagKey.replace('enable', '')}
                    </Label>
                    {isDefault && <Badge variant="secondary" className="text-[10px] h-4">Default</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 leading-tight">
                    {moduleInfo ? moduleInfo.description : 'System capability'}
                  </p>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">{flagKey}</div>
                </div>
                
                <Switch 
                  id={flagKey}
                  checked={isEnabled}
                  onCheckedChange={(checked) => updateFlag(flagKey, checked)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4 text-xs text-slate-500 flex gap-4">
          <div>
            <span className="font-bold">Storage:</span> <code>system_settings</code> table
          </div>
          <div>
            <span className="font-bold">Key:</span> <code>feature_flags</code>
          </div>
          <div>
            <span className="font-bold">Scope:</span> Tenant Global
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeatureFlagManager;
