import React from 'react';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { AlertTriangle, GraduationCap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

const TrainingModeBanner = () => {
  const { isTrainingMode, toggleTrainingMode } = useTrainingMode();
  const location = useLocation();

  // Don't show on public landing pages unless specifically desired, 
  // but showing it everywhere ensures safety.
  // We'll hide it on the login page specifically to avoid clutter.
  if (!isTrainingMode || location.pathname === '/login') return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 shadow-md relative z-[100] print:hidden">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div className="flex items-center gap-2 justify-center">
          <div className="bg-white/20 p-1.5 rounded-full">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
            <span className="font-bold text-sm tracking-wide uppercase">Training Mode Active</span>
            <span className="hidden sm:inline text-white/40">|</span>
            <span className="text-xs sm:text-sm font-medium text-white/90">
              You are viewing & creating <strong>TEST DATA</strong>. Real customers are hidden.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => toggleTrainingMode(false)}
            className="text-amber-950 bg-white/20 hover:bg-white/30 border-transparent h-8 text-xs font-semibold"
          >
            Switch to Live
          </Button>
          <button 
            onClick={() => toggleTrainingMode(false)}
            className="sm:hidden text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingModeBanner;