import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, Info, AlertTriangle, Play, Save, RotateCcw, 
  ArrowLeft, CheckCircle2, Server, Database, Globe, Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Mock Config Data
const INITIAL_CONFIG = {
  enableMockData: {
    value: true,
    label: "Enable Mock Data",
    description: "Uses generated data instead of live database connections for offline/dev work.",
    impact: {
      onTrue: "App works offline, data is consistent but fake.",
      onFalse: "App requires live Supabase connection. 15 components may break if DB is empty.",
      consequence: "Switching to false will reveal connection errors if backend is not ready.",
      recommendation: true
    }
  },
  enableAutoFix: {
    value: true,
    label: "Auto-Fix Issues",
    description: "Automatically applies remediation for detected critical issues.",
    impact: {
      onTrue: "Issues are resolved instantly in background.",
      onFalse: "Issues accumulate and require manual intervention.",
      consequence: "If false, you will need to manually fix 28 known issues.",
      recommendation: true
    }
  },
  enableLogging: {
    value: true,
    label: "System Logging",
    description: "Persists all diagnostic events and fixes to the database.",
    impact: {
      onTrue: "Full audit trail available. Slight storage increase.",
      onFalse: "No history of fixes or rollbacks.",
      consequence: "Loss of compliance trail.",
      recommendation: true
    }
  },
  enableSimulation: {
    value: true,
    label: "Change Simulation",
    description: "Allows previewing logic changes before applying them.",
    impact: {
      onTrue: "Safer operations, ability to see 2nd order effects.",
      onFalse: "Faster execution but higher risk of regression.",
      consequence: "High risk of accidental breakage.",
      recommendation: true
    }
  },
  enableRollback: {
    value: true,
    label: "Enable Rollback",
    description: "Stores state snapshots to allow undo operations.",
    impact: {
      onTrue: "Safety net for all operations.",
      onFalse: "Actions are permanent immediately.",
      consequence: "Mistakes cannot be undone.",
      recommendation: true
    }
  }
};

const ConfigExplainer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [selectedSetting, setSelectedSetting] = useState(null); // Key of setting being modified
  const [undoTimers, setUndoTimers] = useState({});

  const handleToggle = (key) => {
    setSelectedSetting(key);
  };

  const applyChange = () => {
    if (!selectedSetting) return;
    
    const key = selectedSetting;
    const newValue = !config[key].value;
    
    setConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], value: newValue }
    }));
    
    setSelectedSetting(null);
    toast({ title: "Setting Updated", description: `${config[key].label} is now ${newValue ? 'Enabled' : 'Disabled'}.` });

    // Start Undo Timer
    if (undoTimers[key]) clearTimeout(undoTimers[key]);
    const timer = setTimeout(() => {
        setUndoTimers(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, 5 * 60 * 1000);
    setUndoTimers(prev => ({ ...prev, [key]: timer }));
  };

  const undoChange = (key) => {
    const newValue = !config[key].value;
    setConfig(prev => ({
        ...prev,
        [key]: { ...prev[key], value: newValue }
    }));
    if (undoTimers[key]) clearTimeout(undoTimers[key]);
    setUndoTimers(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
    });
    toast({ title: "Undone", description: "Setting reverted to previous state." });
  };

  const currentSettingData = selectedSetting ? config[selectedSetting] : null;
  const proposedValue = selectedSetting ? !currentSettingData.value : null;

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen bg-slate-50">
      <Helmet><title>System Configuration | BHF</title></Helmet>

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/bhf/master-diagnostics')}>
           <ArrowLeft className="w-4 h-4 mr-2" /> Back to Console
        </Button>
        <div>
            <h1 className="text-2xl font-bold text-slate-900">System Configuration Strategy</h1>
            <p className="text-slate-500 text-sm">Manage core behavior flags and understand their impact.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {Object.entries(config).map(([key, setting]) => (
            <Card key={key} className={cn("transition-all", selectedSetting === key ? "ring-2 ring-indigo-500" : "")}>
                <div className="flex items-center p-4">
                    <div className="mr-4">
                        <div className={cn("p-2 rounded-lg", setting.value ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                            {key === 'enableMockData' ? <Database className="w-5 h-5" /> : 
                             key === 'enableLogging' ? <Server className="w-5 h-5" /> :
                             key === 'enableAutoFix' ? <Wrench className="w-5 h-5" /> :
                             <Settings className="w-5 h-5" />}
                        </div>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{setting.label}</h3>
                            <Badge variant={setting.value ? "default" : "secondary"} className={setting.value ? "bg-emerald-600" : ""}>
                                {setting.value ? "Enabled" : "Disabled"}
                            </Badge>
                            {undoTimers[key] && (
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-6 text-xs text-red-600 border-red-200 hover:bg-red-50 ml-2"
                                    onClick={() => undoChange(key)}
                                >
                                    <RotateCcw className="w-3 h-3 mr-1" /> Undo
                                </Button>
                            )}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{setting.description}</p>
                    </div>
                    <div className="pl-4 border-l">
                        <Switch checked={setting.value} onCheckedChange={() => handleToggle(key)} />
                    </div>
                </div>
                
                {/* Details Expansion (Static for now, could be collapsible) */}
                <div className="px-4 pb-4 pt-0 text-xs text-slate-500 flex gap-4">
                    <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" /> Recommended: <span className="font-medium text-slate-700">{setting.impact.recommendation ? "Enabled" : "Disabled"}</span>
                    </span>
                </div>
            </Card>
        ))}
      </div>

      {/* Change Confirmation Modal */}
      <Dialog open={!!selectedSetting} onOpenChange={(open) => !open && setSelectedSetting(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Modify Configuration: {currentSettingData?.label}</DialogTitle>
                <DialogDescription>
                    Review the impact of changing this setting from <strong className={currentSettingData?.value ? "text-emerald-600" : "text-slate-600"}>{currentSettingData?.value ? 'Enabled' : 'Disabled'}</strong> to <strong className={!currentSettingData?.value ? "text-emerald-600" : "text-slate-600"}>{!currentSettingData?.value ? 'Enabled' : 'Disabled'}</strong>.
                </DialogDescription>
            </DialogHeader>

            {currentSettingData && (
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 border rounded bg-slate-50">
                            <h4 className="font-bold text-xs uppercase text-slate-500 mb-2">If Enabled</h4>
                            <p className="text-sm">{currentSettingData.impact.onTrue}</p>
                        </div>
                        <div className="p-3 border rounded bg-slate-50">
                            <h4 className="font-bold text-xs uppercase text-slate-500 mb-2">If Disabled</h4>
                            <p className="text-sm">{currentSettingData.impact.onFalse}</p>
                        </div>
                    </div>

                    <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <AlertTitle>Consequence Analysis</AlertTitle>
                        <AlertDescription>{currentSettingData.impact.consequence}</AlertDescription>
                    </Alert>

                    {currentSettingData.impact.recommendation !== proposedValue && (
                        <div className="flex items-center gap-2 text-sm text-red-600 font-medium p-2 bg-red-50 rounded">
                            <AlertTriangle className="w-4 h-4" />
                            Warning: This contradicts the recommended setting.
                        </div>
                    )}
                </div>
            )}

            <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedSetting(null)}>Cancel</Button>
                <Button onClick={applyChange}>Confirm Change</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ConfigExplainer;