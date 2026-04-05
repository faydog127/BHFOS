import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { 
  ShieldAlert, ShieldCheck, Clock, AlertTriangle, 
  Database, AlertOctagon, Copy, Check, ChevronRight,
  Activity, FileCode, Loader2, Ban, Flame, Undo2
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function PreviewRollbackModal({ open, onOpenChange, auditLog, onContinue }) {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && auditLog?.id) {
      fetchPreview();
    } else {
      setPreviewData(null);
      setError(null);
    }
  }, [open, auditLog]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('preview_rollback_plan', {
        p_audit_id: auditLog.id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate preview');
      
      setPreviewData(data);
    } catch (err) {
      console.error('Preview Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({
      title: "Copied to clipboard",
      description: "SQL query copied successfully.",
      duration: 2000,
    });
  };

  if (!open || !auditLog) return null;

  // Derive stats from preview data
  const highestRisk = previewData?.rollback_steps?.reduce((acc, step) => {
    const risks = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'UNKNOWN': 0 };
    return risks[step.rollback_risk] > risks[acc] ? step.rollback_risk : acc;
  }, 'LOW');

  const affectedTablesCount = previewData?.rollback_steps?.reduce((acc, step) => {
    // Simple heuristic to count tables involved in the inverse SQL
    const tables = (step.inverse_sql?.match(/(?:FROM|UPDATE|INTO|TABLE)\s+["']?([a-zA-Z0-9_]+)["']?/gi) || [])
      .map(m => m.split(/\s+/)[1].replace(/["']/g, ''));
    return new Set([...acc, ...tables]);
  }, new Set()).size || 0;

  const stepsSkipped = previewData?.total_steps - (previewData?.rollback_steps?.length || 0);
  const confidenceScore = auditLog.doctor_response_jsonb?.recommendation?.confidence_score || 0;
  const rollbackAllowed = !previewData?.rollback_window_expired && !error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        
        {/* 1. Header Section */}
        <div className="p-6 pb-4 border-b bg-slate-50/50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Activity className="h-5 w-5 text-indigo-600" />
                Rollback Preview: {auditLog.feature_id || 'System Action'}
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="bg-white">
                  Env: {auditLog.environment}
                </Badge>
                <span className="text-slate-400">•</span>
                <span className="text-xs">
                  Executed {formatDistanceToNow(new Date(auditLog.timestamp_utc), { addSuffix: true })}
                </span>
              </DialogDescription>
            </div>
            
            <div className="flex flex-col items-end gap-2">
               {auditLog.is_safe_mode_at_execution ? (
                 <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 flex items-center gap-1">
                   <ShieldCheck className="h-3 w-3" /> Safe Mode ON
                 </Badge>
               ) : (
                 <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700 flex items-center gap-1">
                   <ShieldAlert className="h-3 w-3" /> Safe Mode OFF
                 </Badge>
               )}
            </div>
          </div>

          {/* Confidence Meter */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-slate-500 uppercase tracking-wider">
              <span>Original AI Confidence</span>
              <span>{(confidenceScore * 100).toFixed(0)}%</span>
            </div>
            <Progress 
              value={confidenceScore * 100} 
              className={cn("h-2", 
                confidenceScore >= 0.8 ? "[&>div]:bg-green-500" : 
                confidenceScore >= 0.5 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"
              )} 
            />
          </div>

          {/* Time Status Alert */}
          {previewData?.rollback_window_expired && (
            <Alert variant="destructive" className="mt-4 bg-red-50 border-red-200 text-red-900">
              <Clock className="h-4 w-4" />
              <AlertTitle>Rollback Window Expired</AlertTitle>
              <AlertDescription>
                This action was executed more than 24 hours ago. Automatic rollback is disabled to prevent data inconsistency.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <ScrollArea className="flex-1 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
              <p className="text-sm text-slate-500 font-medium">Analyzing rollback impact...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Preview Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : previewData ? (
            <div className="space-y-8">
              
              {/* 2. Impact Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 pt-5">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Highest Risk</div>
                    <div className={cn("text-2xl font-bold flex items-center gap-2", 
                      highestRisk === 'HIGH' ? "text-red-600" : 
                      highestRisk === 'MEDIUM' ? "text-yellow-600" : "text-green-600"
                    )}>
                      {highestRisk}
                      {highestRisk === 'HIGH' && <Flame className="h-5 w-5" />}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 pt-5">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Affected Tables</div>
                    <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                      {affectedTablesCount}
                      <Database className="h-4 w-4 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 pt-5">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Dependent Objects</div>
                    <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                      0
                      <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Coming Soon</span>
                    </div>
                  </CardContent>
                </Card>
                 <Card className={cn(stepsSkipped > 0 ? "border-yellow-200 bg-yellow-50" : "")}>
                  <CardContent className="p-4 pt-5">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Plan Quality</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {stepsSkipped > 0 ? (
                        <span className="text-yellow-700 flex items-center gap-2">
                          Warning
                          <AlertTriangle className="h-5 w-5" />
                        </span>
                      ) : (
                        <span className="text-green-700 flex items-center gap-2">
                          Complete
                          <Check className="h-5 w-5" />
                        </span>
                      )}
                    </div>
                    {stepsSkipped > 0 && <p className="text-xs text-yellow-800 mt-1">{stepsSkipped} steps missing inverse SQL</p>}
                  </CardContent>
                </Card>
              </div>

              {/* 3. Inverse Execution Sequence */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Undo2 className="h-5 w-5 text-indigo-600" />
                  Inverse Execution Sequence
                </h3>
                
                <div className="space-y-4">
                  {previewData.rollback_steps?.map((step, idx) => (
                    <div key={idx} className="relative border rounded-lg overflow-hidden bg-white shadow-sm group">
                      {/* Step Header */}
                      <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold font-mono">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-slate-700 text-sm">Undo Step {step.step_index + 1}</span>
                          <span className="text-slate-400 text-sm hidden sm:inline">•</span>
                          <span className="text-xs text-slate-500 italic hidden sm:inline max-w-[300px] truncate" title={step.original_sql_description}>
                            Reverting: {step.original_sql_description || 'SQL Execution'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                           <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge className={cn(
                                  "font-mono cursor-help",
                                  step.rollback_risk === 'HIGH' ? "bg-red-100 text-red-700 hover:bg-red-200 border-red-200" :
                                  step.rollback_risk === 'MEDIUM' ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200" :
                                  "bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
                                )}>
                                  {step.rollback_risk} RISK
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Risk level assessed based on operation type and dependencies.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* SQL Content */}
                      <div className="p-4 bg-slate-950 group relative">
                        {step.rollback_risk === 'HIGH' && (
                          <div className="absolute top-0 right-0 p-2 z-10">
                            <Badge variant="destructive" className="animate-pulse shadow-md border-red-400 bg-red-600">
                              <Flame className="w-3 h-3 mr-1" /> CRITICAL: DATA LOSS POSSIBLE
                            </Badge>
                          </div>
                        )}
                        
                        <div className="relative">
                          <pre className="font-mono text-xs text-green-400 overflow-x-auto whitespace-pre-wrap max-h-[200px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent p-2">
                            {step.inverse_sql || "-- No inverse SQL provided"}
                          </pre>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-0 right-0 text-slate-500 hover:text-white hover:bg-white/10"
                            onClick={() => handleCopy(step.inverse_sql, idx)}
                          >
                            {copiedIndex === idx ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="p-4 border-t bg-slate-50 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel & Close
          </Button>
          <Button 
            onClick={() => onContinue(previewData)}
            disabled={!rollbackAllowed || loading}
            className={cn(
              "gap-2",
              rollbackAllowed ? "bg-indigo-600 hover:bg-indigo-700" : "opacity-50 cursor-not-allowed"
            )}
          >
            Continue to Confirmation
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}