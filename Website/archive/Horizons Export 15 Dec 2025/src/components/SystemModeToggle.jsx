import React from 'react';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const SystemModeToggle = ({ className }) => {
  const { isTrainingMode, toggleTrainingMode, loading } = useTrainingMode();

  if (loading) return null;

  return (
    <>
      {/* Persistent Banner for Training Mode */}
      {isTrainingMode && (
        <div className="fixed top-0 left-0 right-0 z-[60] h-8 bg-amber-400 text-amber-950 flex items-center justify-center text-xs font-bold tracking-wider shadow-sm">
          <AlertTriangle className="w-3 h-3 mr-2" />
          TRAINING MODE – Changes do not affect real customers or reports
          <AlertTriangle className="w-3 h-3 ml-2" />
        </div>
      )}

      {/* Toggle Switch UI */}
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors", 
          isTrainingMode ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200",
          className
      )}>
        <Switch 
          id="mode-toggle" 
          checked={isTrainingMode}
          onCheckedChange={toggleTrainingMode}
          className="data-[state=checked]:bg-amber-500"
        />
        <Label htmlFor="mode-toggle" className="cursor-pointer text-xs font-semibold flex items-center gap-1.5 select-none">
          {isTrainingMode ? (
             <>
               <span className="text-amber-700">Training</span>
             </>
          ) : (
             <>
               <ShieldCheck className="w-3 h-3 text-green-600" />
               <span className="text-slate-600">Live</span>
             </>
          )}
        </Label>
      </div>
    </>
  );
};

export default SystemModeToggle;