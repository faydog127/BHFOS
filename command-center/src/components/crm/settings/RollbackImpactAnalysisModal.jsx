import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ShieldAlert, Activity, AlertTriangle, CheckCircle2, 
  Database, Layers, Zap, Loader2, Undo2
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

export default function RollbackImpactAnalysisModal({ open, onOpenChange, inverseSql, onConfirmRollback }) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && inverseSql) {
      analyzeImpact();
    }
  }, [open, inverseSql]);

  const analyzeImpact = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('rollback_impact_analysis', {
        p_inverse_sql: inverseSql
      });

      if (error) throw error;
      setAnalysis(data);
    } catch (err) {
      console.error('Impact Analysis Failed:', err);
      setError('Failed to generate impact analysis. Proceed with extreme caution.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setExecuting(true);
    await onConfirmRollback();
    setExecuting(false);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-red-700">
            <ShieldAlert className="h-6 w-6" />
            Rollback Impact Analysis
          </DialogTitle>
          <DialogDescription>
            AI-driven assessment of potential side effects before executing this rollback.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
              <p className="text-sm text-slate-500 font-medium">Scanning dependencies and calculating risk...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Analysis Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : analysis ? (
            <div className="space-y-6 py-4">
              
              {/* Risk Meter */}
              <div className={cn(
                "p-4 rounded-lg border-2 flex items-center justify-between",
                analysis.risk_level === 'HIGH' ? "bg-red-50 border-red-200" :
                analysis.risk_level === 'MEDIUM' ? "bg-yellow-50 border-yellow-200" :
                "bg-green-50 border-green-200"
              )}>
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-1">Estimated Risk Level</h4>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {analysis.risk_level}
                    {analysis.risk_level === 'HIGH' && <AlertTriangle className="h-6 w-6 text-red-600" />}
                    {analysis.risk_level === 'MEDIUM' && <Activity className="h-6 w-6 text-yellow-600" />}
                    {analysis.risk_level === 'LOW' && <CheckCircle2 className="h-6 w-6 text-green-600" />}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold opacity-20">{analysis.risk_score}</div>
                  <div className="text-xs font-mono opacity-50">RISK SCORE</div>
                </div>
              </div>

              {/* Recommendations */}
              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Recommendations</h3>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator />

              {/* Affected Objects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tables */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Database className="h-3 w-3" /> Affected Tables
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.affected_tables?.length > 0 ? (
                      analysis.affected_tables.map(t => (
                        <Badge key={t} variant="secondary" className="font-mono text-xs">{t}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">None detected</span>
                    )}
                  </div>
                </div>

                {/* Views */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Layers className="h-3 w-3" /> Dependent Views
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.affected_views?.length > 0 ? (
                      analysis.affected_views.map(v => (
                        <Badge key={v} variant="outline" className="font-mono text-xs border-orange-200 bg-orange-50 text-orange-800">{v}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">None detected</span>
                    )}
                  </div>
                </div>

                {/* Triggers */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Zap className="h-3 w-3" /> Active Triggers
                  </h4>
                   <div className="flex flex-col gap-1">
                    {analysis.affected_triggers?.length > 0 ? (
                      analysis.affected_triggers.map(t => (
                        <span key={t} className="text-xs text-slate-600 font-mono truncate block" title={t}>
                          • {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">None detected</span>
                    )}
                  </div>
                </div>

                 {/* Functions */}
                 <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Dependent Functions
                  </h4>
                   <div className="flex flex-wrap gap-2">
                    {analysis.affected_functions?.length > 0 ? (
                      analysis.affected_functions.map(f => (
                        <Badge key={f} variant="outline" className="font-mono text-xs">{f}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">None detected</span>
                    )}
                  </div>
                </div>
              </div>

              {/* SQL Preview */}
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Payload Preview</h4>
                <div className="bg-slate-950 text-red-300 p-3 rounded-md font-mono text-xs overflow-x-auto max-h-32">
                  {inverseSql}
                </div>
              </div>

            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={executing}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={executing || loading || !analysis}
            className="bg-red-600 hover:bg-red-700"
          >
            {executing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
            Confirm Rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}