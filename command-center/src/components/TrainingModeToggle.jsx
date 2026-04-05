import React from 'react';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GraduationCap } from 'lucide-react';

const TrainingModeToggle = () => {
  const { isTrainingMode, toggleTrainingMode, loading } = useTrainingMode();

  if (loading) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
        isTrainingMode 
            ? 'bg-amber-100 border-amber-300 text-amber-900' 
            : 'bg-slate-100 border-slate-200 text-slate-600'
    }`}>
      <GraduationCap className="h-4 w-4" />
      <div className="flex items-center gap-2">
        <Switch 
            id="training-mode" 
            checked={isTrainingMode} 
            onCheckedChange={toggleTrainingMode}
            className="data-[state=checked]:bg-amber-600"
        />
        <Label htmlFor="training-mode" className="text-xs font-semibold cursor-pointer">
          {isTrainingMode ? 'Training Mode' : 'Real Data'}
        </Label>
      </div>
    </div>
  );
};

export default TrainingModeToggle;