import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const AiResponseGrid = ({ options, onSelectResponse, isGenerating }) => {
  if (isGenerating) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg h-full border border-slate-200 dark:border-slate-700 p-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!options || options.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] border-2 border-dashed border-slate-200 rounded-lg">
        <Sparkles className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-slate-500">Select a call intent to generate AI scripts</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {options.map((option, idx) => (
        <Card 
          key={idx} 
          className={cn(
            "relative group hover:shadow-md transition-all cursor-pointer border-l-4",
            option.risk_level === 'high' ? 'border-l-red-500' : 
            option.risk_level === 'medium' ? 'border-l-amber-500' : 'border-l-emerald-500'
          )}
          onClick={() => onSelectResponse(option, idx)}
        >
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider">
                {option.tone}
              </Badge>
              {option.risk_level === 'high' && (
                <Badge variant="destructive" className="text-[10px]">High Risk</Badge>
              )}
            </div>
            <h4 className="font-semibold text-slate-800 dark:text-white mb-2 text-sm">{option.title}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              "{option.script}"
            </p>
            
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="ghost" className="h-6 text-xs bg-slate-100 hover:bg-slate-200 text-slate-900">
                <PlayCircle className="w-3 h-3 mr-1" /> Use Script
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default AiResponseGrid;