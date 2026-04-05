import React from 'react';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ShieldCheck, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SystemModeToggle = ({ className, showLabel = true }) => {
  const { isTrainingMode, toggleTrainingMode } = useTrainingMode();

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-1.5 rounded-full border transition-all duration-300", 
      isTrainingMode 
        ? "bg-amber-50 border-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.2)]" 
        : "bg-white border-slate-200",
      className
    )}>
      <div className="flex items-center gap-2">
        <Switch 
          id="system-mode-toggle" 
          checked={isTrainingMode}
          onCheckedChange={toggleTrainingMode}
          className={cn(
            "data-[state=checked]:bg-amber-500", 
            "data-[state=unchecked]:bg-slate-200"
          )}
        />
        {showLabel && (
          <Label 
            htmlFor="system-mode-toggle" 
            className="cursor-pointer text-xs font-semibold flex items-center gap-1.5 select-none"
          >
            {isTrainingMode ? (
              <>
                <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-amber-700">Training Mode</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                <span className="text-slate-600">Live Data</span>
              </>
            )}
          </Label>
        )}
      </div>
      
      {isTrainingMode && (
        <Badge variant="outline" className="hidden sm:flex border-amber-200 text-amber-700 text-[10px] px-1.5 py-0 h-5 bg-amber-100/50">
          TEST DATA ONLY
        </Badge>
      )}
    </div>
  );
};

export default SystemModeToggle;