import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ShieldAlert, AlertTriangle, AlertOctagon, CheckCircle2, 
  Loader2, XCircle, Undo2, Activity, Clock, FileDown,
  Terminal, Eye, Database, FileText, RefreshCw, HelpCircle, X,
  Wrench, Copy, LifeBuoy, Zap, FileCode, ChevronDown, ChevronRight, Layers
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const EXECUTION_TIMEOUT_MS = 300000; // 5 minutes

// Helper Component for Collapsible Sections in Dependent Objects Modal
const DependentGroupSection = ({ title, objects, icon: Icon, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  if (!objects || objects.length === 0) return null;

  return (
    <div className="border rounded-md bg-white mb-2 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <span>{title}</span>
          <Badge variant="secondary" className="text-xs h-5 px-1.5">{objects.length}</Badge>
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      
      {isOpen && (
        <div className="divide-y divide-slate-100">
          {objects.map((obj, idx) => (
            <div key={idx} className="p-3 text-xs flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium text-slate-800">{obj.name}</span>
                <span className="text-slate-400 italic">{obj.schema || 'public'}</span>
              </div>
              {obj.table && (
                <div className="text-slate-500">
                  On table: <span className="font-mono text-slate-600">{obj.table}</span>
                </div>
              )}
              {obj.affected_tables && obj.affected_tables.length > 0 && (
                <div className="text-slate-500 mt-1">
                  <span className="font-semibold text-[10px] uppercase tracking-wide text-slate-400">Impacts:</span>{' '}
                  {Array.isArray(obj.affected_tables) ? obj.affected_tables.join(', ') : obj.affected_tables}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Dependent Objects Modal Component
const DependentObjectsModal = ({ open, onOpenChange, dependentObjects = [] }) => {
  const views = dependentObjects.filter(o => o.type === 'VIEW');
  const triggers = dependentObjects.filter(o => o.type === 'TRIGGER');
  const functions = dependentObjects.filter(o => o.type === 'FUNCTION');
  
  const totalCount = dependentObjects.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-indigo-600" />
            Dependent Objects
          </DialogTitle>
          <DialogDescription>
            The following database objects depend on the tables affected by this rollback.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6 max-h-96">
          <div className="pb-6 space-y-4">
            {totalCount > 5 && (
              <Alert className="bg-amber-50 border-amber-200 text-amber-900 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs ml-2 font-medium">
                  Multiple dependent objects detected. Review carefully before proceeding.
                </AlertDescription>
              </Alert>
            )}

            {totalCount === 0 ? (
               <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                 <CheckCircle2 className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                 <p className="text-sm">No dependent objects found.</p>
               </div>
            ) : (
              <div className="space-y-1">
                <DependentGroupSection 
                  title="Views" 
                  objects={views} 
                  icon={Database} 
                  defaultOpen={true}
                />
                <DependentGroupSection 
                  title="Triggers" 
                  objects={triggers} 
                  icon={Zap} 
                  defaultOpen={true}
                />
                <DependentGroupSection 
                  title="Functions" 
                  objects={functions} 
                  icon={FileCode} 
                  defaultOpen={true}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t bg-slate-50/50">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function RollbackConfirmationDialog({ open, onOpenChange, rollbackPlan, onComplete }) {
  // 1. State Management
  const [confirmationText, setConfirmationText] = useState('');
  const [acknowledgeReview, setAcknowledgeReview] = useState(false);
  const [acknowledgeDataLoss, setAcknowledgeDataLoss] = useState(false);
  
  const [showDependentObjectsModal, setShowDependentObjectsModal] = useState(false);

  const [isExecuting, setIsExecuting] = useState(false);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const [executionResult, setExecutionResult] = useState(null); 
  const [dryRunResult, setDryRunResult] = useState(null);
  const [executionSteps, setExecutionSteps] = useState([]); // Visual log of steps
  
  const [executionStartTime, setExecutionStartTime] = useState(null);
  const executionTimerRef = useRef(null);
  const errorLogRef = useRef(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  // Derived State
  const auditId = rollbackPlan?.audit_id;
  const environment = rollbackPlan?.environment || 'production';
  const isDestructive = rollbackPlan?.highest_risk === 'HIGH' || rollbackPlan?.affected_tables_count > 0;
  const isExpired = rollbackPlan?.hours_until_expiration < 0;
  const dependentObjects = rollbackPlan?.dependent_objects || [];
  const dependentCount = dependentObjects.length;

  // 2. Safety Validation
  const isFormValid = 
    confirmationText === 'ROLLBACK' && 
    acknowledgeReview && 
    (!isDestructive || acknowledgeDataLoss) &&
    !isExecuting &&
    !isExpired;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      resetState();
      // Debug Log
      console.group('Rollback Dialog Initialized');
      console.log('Audit ID:', auditId);
      console.log('Environment:', environment);
      console.log('Plan:', rollbackPlan);
      console.groupEnd();
    }
  }, [open]);

  // Keyboard shortcut for copying errors
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Only trigger if we have a result and are not selecting text elsewhere
        if (executionResult && !window.getSelection().toString()) {
           // If focus is near the error log or just globally available in this dialog context
           handleCopyErrorDetails();
        }
      }
    };

    if (open && executionResult && (executionResult.status === 'FAILURE' || executionResult.status === 'PARTIAL')) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, executionResult]);

  const resetState = () => {
    setConfirmationText('');
    setAcknowledgeReview(false);
    setAcknowledgeDataLoss(false);
    setShowDependentObjectsModal(false);
    setIsExecuting(false);
    setIsDryRunLoading(false);
    setIsCancelling(false);
    setExecutionResult(null);
    setDryRunResult(null);
    setExecutionSteps([]);
    setExecutionStartTime(null);
  };

  // Timeout Watcher
  useEffect(() => {
    if (isExecuting && executionStartTime) {
      const checkTimeout = () => {
        const elapsed = Date.now() - executionStartTime;
        if (elapsed > EXECUTION_TIMEOUT_MS) {
          setIsExecuting(false);
          setExecutionResult(prev => ({
            ...prev,
            status: 'FAILURE',
            summary: "Execution timeout: Rollback took longer than 5 minutes. Please contact support.",
            failed_steps: [...(prev?.failed_steps || []), { description: "Timeout", error_message: "Operation exceeded 5 minute limit" }]
          }));
          toast({
            variant: "destructive",
            title: "Execution Timeout",
            description: "Rollback took longer than 5 minutes. Please contact support."
          });
        }
      };

      executionTimerRef.current = setInterval(checkTimeout, 1000);
    }

    return () => {
      if (executionTimerRef.current) clearInterval(executionTimerRef.current);
    };
  }, [isExecuting, executionStartTime, toast]);


  // 5. Simulated Step Progress Tracking & Start Time Handling
  useEffect(() => {
    let interval;
    if (isExecuting && !executionResult) {
      if (!executionStartTime) {
        setExecutionStartTime(Date.now());
      }

      const totalSteps = rollbackPlan?.total_steps || 5;
      
      // Initialize steps only once per execution start
      if (executionSteps.length === 0) {
        setExecutionSteps(Array(totalSteps).fill(0).map((_, i) => ({
          id: i,
          status: 'pending', 
          message: `Reverting step ${rollbackPlan?.rollback_steps?.[i]?.step_index || i + 1}...`
        })));
      }

      interval = setInterval(() => {
        setExecutionSteps(prev => {
          const next = [...prev];
          const activeIdx = next.findIndex(s => s.status === 'pending' || s.status === 'in-progress');
          
          if (activeIdx !== -1) {
             if (activeIdx > 0 && next[activeIdx - 1].status !== 'completed') {
                next[activeIdx - 1].status = 'completed';
             }
             next[activeIdx].status = 'in-progress';
             
             // Randomly complete steps for visual feedback
             if (Math.random() > 0.6) {
                next[activeIdx].status = 'completed';
             }
          }
          return next;
        });
      }, 400); 
    } else if (!isExecuting) {
      // Reset start time when execution stops
      if (executionResult) {
        // keep start time if we want metrics, but for timeout logic we can stop tracking
      }
    }
    return () => clearInterval(interval);
  }, [isExecuting, executionResult, rollbackPlan, executionSteps.length, executionStartTime]);


  // 3. Handle Dry Run
  const handleDryRun = async () => {
    if (isDryRunLoading) return;
    setIsDryRunLoading(true);
    setDryRunResult(null);

    try {
      console.log('Running Dry Run for audit:', auditId);
      const { data, error } = await supabase.rpc('execute_rollback_plan_dry_run', { 
        p_audit_id: auditId 
      });

      if (error) throw error;

      console.log('Dry Run Result:', data);
      setDryRunResult(data);

      if (data.success) {
        toast({
          title: "Dry Run Passed",
          description: "Simulation completed successfully. No immediate errors detected.",
          className: "bg-green-50 border-green-200 text-green-800"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Dry Run Failed",
          description: "Simulation encountered errors. Review before proceeding."
        });
      }
    } catch (err) {
      console.error("Dry run error:", err);
      setDryRunResult({
        success: false,
        message: err.message,
        errors: [{ error: err.message }]
      });
    } finally {
      setIsDryRunLoading(false);
    }
  };

  // 4. Handle Execute Rollback
  const handleExecuteRollback = async () => {
    if (!isFormValid && !executionResult) return; 
    
    setIsExecuting(true);
    setExecutionStartTime(Date.now());
    setExecutionResult(null); 
    
    console.group('Executing Rollback');
    console.log('Audit ID:', auditId);
    console.time('Rollback RPC Duration');
    
    try {
      // Small delay for UI transition
      await new Promise(r => setTimeout(r, 500));

      const { data, error } = await supabase.rpc('execute_rollback_plan', { 
        p_log_id: auditId 
      });

      console.timeEnd('Rollback RPC Duration');
      console.log('RPC Response:', data);

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      // Force complete all steps visually for success
      if (data.success) {
        setExecutionSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
      } else {
        // Mark partially executed or failed state
        setExecutionSteps(prev => {
          const next = [...prev];
          // Mark executed count as completed
          for(let i=0; i < (data.metrics?.steps_executed || 0); i++) {
            if (next[i]) next[i].status = 'completed';
          }
          // Mark skipped/failed
          const failIndex = data.metrics?.steps_executed || 0;
          if (next[failIndex]) next[failIndex].status = 'error';
          
          return next;
        });
      }

      setExecutionResult(data);

      if (data.success) {
        toast({
          title: "Rollback Complete",
          description: "System state has been restored successfully.",
          className: "bg-green-50 border-green-200 text-green-800"
        });
        if (onComplete) onComplete(true);
      } else {
        toast({
          variant: "destructive",
          title: "Rollback Issues",
          description: data.summary || "Errors occurred during execution."
        });
      }

    } catch (err) {
      console.error("Execution exception:", err);
      setExecutionResult({
        success: false,
        status: 'FAILURE',
        summary: err.message,
        metrics: {
           steps_executed: 0,
           steps_total: rollbackPlan?.total_steps || 0,
           execution_time_ms: 0
        },
        failed_steps: [{ description: "RPC Execution Error", error_message: err.message }],
        recovery_recommendations: ["Contact system administrator.", "Check database logs manually."]
      });
      setExecutionSteps(prev => prev.map(s => ({ ...s, status: 'error' })));
    } finally {
      console.groupEnd();
      setIsExecuting(false);
    }
  };

  // Handle Cancel Rollback
  const handleCancelRollback = async () => {
    if (!executionResult?.rollback_id) {
       setIsExecuting(false);
       toast({
         title: "Client Wait Cancelled",
         description: "Stopped waiting for response. The server process may still be running.",
         variant: "destructive"
       });
       return;
    }

    if (isCancelling) return;
    setIsCancelling(true);

    try {
      const { data, error } = await supabase.rpc('cancel_rollback_plan', { 
        p_rollback_id: executionResult.rollback_id 
      });

      if (error) throw error;

      if (data.success) {
        setIsExecuting(false);
        setExecutionResult(prev => ({
          ...prev,
          status: 'CANCELLED',
          summary: "Rollback was cancelled by user request."
        }));
        toast({
          title: "Rollback Cancelled",
          description: "Operation cancelled successfully.",
          className: "bg-yellow-50 border-yellow-200 text-yellow-800"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Cancel Failed",
          description: data.error || "Could not cancel the operation."
        });
      }
    } catch (err) {
      console.error("Cancel error:", err);
      toast({
        variant: "destructive",
        title: "Cancel Error",
        description: err.message
      });
    } finally {
      setIsCancelling(false);
    }
  };
  
  // Handle Retry Rollback (Reset State)
  const handleRetryRollback = () => {
    // Removed native confirm() dialog as requested.
    // Instead, a toast message will be shown.
    toast({
        title: "Retrying Rollback",
        description: "Rollback state reset. Please review and re-execute.",
    });
    resetState();
  };

  const getReportData = () => {
    if (!executionResult) return null;
    return {
      timestamp: new Date().toISOString(),
      auditId: auditId,
      environment: environment,
      rollback_status: executionResult.status,
      errors: executionResult.failed_steps || executionResult.errors || [],
      metrics: executionResult.metrics || {},
      recovery_recommendations: executionResult.recovery_recommendations || [],
      executionSteps: executionSteps
    };
  };

  const handleDownloadErrorReport = () => {
    try {
      const reportData = getReportData();
      if (!reportData) return;

      const jsonString = JSON.stringify(reportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = `rollback-error-report-${auditId}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Downloaded",
        description: "Error report downloaded successfully.",
        className: "bg-green-50 border-green-200 text-green-800"
      });
    } catch (err) {
      console.error("Download failed:", err);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download error report."
      });
    }
  };

  const handleCopyErrorDetails = () => {
    try {
      const reportData = getReportData();
      if (!reportData) return;

      const jsonString = JSON.stringify(reportData, null, 2);
      navigator.clipboard.writeText(jsonString);
      
      toast({
        title: "Copied to Clipboard",
        description: "Error details copied to clipboard.",
      });
    } catch (err) {
      console.error("Copy failed:", err);
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy error details."
      });
    }
  };

  const handleContactSupport = () => {
    try {
      const reportData = getReportData();
      if (!reportData) return;

      // Base64 encode the context for URL safety
      const contextString = JSON.stringify(reportData);
      const encodedContext = btoa(contextString);
      
      onOpenChange(false);
      
      // Navigate to support page with pre-filled context
      navigate(`/support?ticket_context=${encodedContext}&type=rollback_failure&audit_id=${auditId}`);

    } catch (err) {
      console.error("Support navigation failed:", err);
      toast({
        variant: "destructive",
        title: "Navigation Error",
        description: "Could not open support ticket automatically."
      });
    }
  };

  const handleAttemptAlternativeFix = () => {
    onOpenChange(false);
    navigate(`/testing/system-doctor?audit_id=${auditId}&mode=alternative_fix`);
  };

  // 6. Render Progress Tracker
  const renderProgressTracker = () => {
    // Calculate estimated time remaining
    const totalSteps = rollbackPlan?.total_steps || 1;
    // Assume roughly 1 second per step as a baseline estimate
    const estimatedTotalMs = totalSteps * 1000; 
    const elapsedMs = executionStartTime ? Date.now() - executionStartTime : 0;
    const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    return (
      <div className="space-y-6 py-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-white p-3 rounded-full border-2 border-indigo-100 shadow-xl">
               <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Executing Rollback...</h3>
            <div className="flex items-center gap-2 justify-center text-sm text-slate-500 mt-1">
              <Badge variant="outline" className={cn(
                "uppercase text-[10px]",
                environment === 'production' ? "border-red-200 text-red-700 bg-red-50" : "border-yellow-200 text-yellow-700 bg-yellow-50"
              )}>
                {environment}
              </Badge>
              <span>Restoring previous state</span>
            </div>
            {executionStartTime && (
               <div className="mt-2 text-xs font-mono text-slate-400">
                  Estimated time remaining: ~{remainingSeconds}s
               </div>
            )}
          </div>
        </div>
  
        <div className="bg-slate-50 rounded-lg border p-0 overflow-hidden max-h-[300px] flex flex-col">
          <div className="px-4 py-3 bg-slate-100 border-b flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500 uppercase">Live Log</span>
            <span className="text-xs font-mono text-slate-400">
              {executionSteps.filter(s => s.status === 'completed').length} / {executionSteps.length}
            </span>
          </div>
          <ScrollArea className="flex-1 p-4 h-[200px]">
            <div className="space-y-3">
               {executionSteps.map((step, idx) => (
                 <div key={idx} className="flex items-start gap-3 text-sm animate-in slide-in-from-left-2">
                   <div className="mt-0.5 shrink-0">
                     {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                     {step.status === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                     {step.status === 'in-progress' && <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />}
                     {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-slate-200" />}
                   </div>
                   <span className={cn(
                     "font-mono text-xs",
                     step.status === 'pending' && "text-slate-400",
                     step.status === 'in-progress' && "text-indigo-700 font-medium",
                     step.status === 'completed' && "text-slate-700",
                     step.status === 'error' && "text-red-600"
                   )}>
                     {step.message}
                   </span>
                 </div>
               ))}
            </div>
          </ScrollArea>
        </div>
        
        {/* Cancel Button */}
        <div className="flex justify-center">
           <Button 
             variant="outline" 
             size="sm"
             onClick={handleCancelRollback}
             disabled={isCancelling || (executionResult && executionResult.status !== 'PENDING' && executionResult.status !== 'IN_PROGRESS')}
             className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
           >
             {isCancelling ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <X className="h-3 w-3 mr-2" />}
             {isCancelling ? "Cancelling..." : "Cancel Operation"}
           </Button>
        </div>
      </div>
    );
  };

  // 7. Render Commitment Form
  const renderCommitmentForm = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Warning Banner */}
      <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
        <ShieldAlert className="h-5 w-5 text-red-600" />
        <AlertTitle className="ml-2 font-bold flex items-center gap-2">
          Warning: Irreversible Action
          {environment === 'production' && <Badge variant="destructive" className="ml-auto text-[10px]">PRODUCTION</Badge>}
        </AlertTitle>
        <AlertDescription className="ml-2 mt-1 text-sm opacity-90">
          You are about to roll back changes for feature <span className="font-mono font-bold">{rollbackPlan?.feature_id || 'Unknown'}</span>. 
          This may result in data loss for records created after the original event.
        </AlertDescription>
      </Alert>
      
      {/* Expiration Blocker */}
      {isExpired && (
        <Alert className="bg-slate-100 border-slate-300 text-slate-700">
          <Clock className="h-4 w-4" />
          <AlertTitle className="ml-2">Window Expired</AlertTitle>
          <AlertDescription className="ml-2 text-xs">
            The 24-hour safety window for this action has passed. Automatic rollback is disabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Checkboxes */}
      {!isExpired && (
        <div className="space-y-4 pt-2">
           <div className="flex items-start space-x-3 p-3 rounded-md border bg-slate-50/50 hover:bg-slate-50 transition-colors">
             <Checkbox 
               id="ack-review" 
               checked={acknowledgeReview} 
               onCheckedChange={setAcknowledgeReview}
               className="mt-0.5"
             />
             <div className="space-y-1">
               <Label htmlFor="ack-review" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                 <Eye className="h-3 w-3 text-slate-500" /> Review Confirmation
               </Label>
               <p className="text-xs text-slate-500">
                 I have reviewed the inverse SQL statements and understand the impact analysis.
               </p>
             </div>
           </div>
           
           {(isDestructive || true) && (
             <div className="flex items-start space-x-3 p-3 rounded-md border bg-slate-50/50 hover:bg-slate-50 transition-colors">
               <Checkbox 
                 id="ack-loss" 
                 checked={acknowledgeDataLoss} 
                 onCheckedChange={setAcknowledgeDataLoss}
                 className="mt-0.5"
               />
               <div className="space-y-1">
                 <Label htmlFor="ack-loss" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                   <Database className="h-3 w-3 text-slate-500" /> Acknowledge Data Impact
                 </Label>
                 <p className="text-xs text-slate-500">
                   I acknowledge that {rollbackPlan?.affected_tables_count || 'unknown'} tables will be modified.
                 </p>
               </div>
             </div>
           )}
        </div>
      )}

      {/* Dry Run Section */}
      {!isExpired && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-500 uppercase">Verification</Label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDryRun} 
              disabled={isDryRunLoading}
              className="h-7 text-xs"
            >
              {isDryRunLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Terminal className="h-3 w-3 mr-1" />}
              Run Simulation
            </Button>
          </div>
          
          {dryRunResult && (
            <Alert variant={dryRunResult.success ? "default" : "destructive"} className={cn(
              "py-2", 
              dryRunResult.success ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200"
            )}>
              <div className="flex items-center gap-2">
                {dryRunResult.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                <span className="text-xs font-medium">
                  {dryRunResult.message || (dryRunResult.success ? "Dry run successful" : "Dry run failed")}
                </span>
              </div>
            </Alert>
          )}
        </div>
      )}

      {/* Final Commitment */}
      {!isExpired && (
        <div className="pt-2">
           <div className="flex justify-between items-center mb-2">
              <Label htmlFor="confirm-text" className="text-xs font-semibold text-red-600 uppercase tracking-wider block">
                Type "ROLLBACK" to confirm execution
              </Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                onClick={() => setShowDependentObjectsModal(true)}
              >
                View Dependent Objects
                {dependentCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px] bg-indigo-100 text-indigo-700">{dependentCount}</Badge>
                )}
              </Button>
           </div>
           <Input
             id="confirm-text"
             value={confirmationText}
             onChange={(e) => setConfirmationText(e.target.value)}
             placeholder="ROLLBACK"
             className="font-mono border-red-200 focus-visible:ring-red-500 bg-red-50/10 text-red-900 placeholder:text-red-200"
             autoComplete="off"
           />
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        {!isExpired && (
          <Button 
            variant="destructive" 
            onClick={handleExecuteRollback}
            disabled={!isFormValid}
            className="bg-red-600 hover:bg-red-700 min-w-[140px] shadow-sm ml-auto"
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Execute Rollback
          </Button>
        )}
      </DialogFooter>
    </div>
  );

  // 8. Render Post Execution Status (UPDATED as requested)
  const renderPostExecutionStatus = () => {
    const status = executionResult?.status; // SUCCESS, PARTIAL, FAILURE, CANCELLED
    const isSuccess = status === 'SUCCESS';
    const isPartial = status === 'PARTIAL';
    const isCancelled = status === 'CANCELLED';
    const metrics = executionResult?.metrics || {};

    return (
      <TooltipProvider>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Status Alert */}
        <Alert variant={isSuccess ? "default" : "destructive"} className={cn(
          "border-2 py-4",
          isSuccess ? "bg-green-50 border-green-200 text-green-900 [&>svg]:text-green-600" :
          isPartial ? "bg-yellow-50 border-yellow-200 text-yellow-900 [&>svg]:text-yellow-600" :
          isCancelled ? "bg-slate-50 border-slate-200 text-slate-900 [&>svg]:text-slate-600" :
          "bg-red-50 border-red-200 text-red-900 [&>svg]:text-red-600"
        )}>
          {isSuccess ? <CheckCircle2 className="h-6 w-6" /> : 
           isPartial ? <AlertTriangle className="h-6 w-6" /> : 
           isCancelled ? <XCircle className="h-6 w-6" /> :
           <AlertOctagon className="h-6 w-6" />}
          
          <div className="ml-2">
            <AlertTitle className="text-lg font-bold">
              {isSuccess ? "Rollback Completed Successfully" : 
               isPartial ? "Partial Rollback" : 
               isCancelled ? "Rollback Cancelled" :
               "Rollback Failed"}
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm opacity-90">
              {isSuccess ? "The system state has been successfully restored. You may now attempt an alternative fix or review the audit log." :
               isPartial ? "Some steps executed successfully, but others were skipped or failed." :
               isCancelled ? "The operation was cancelled by the user." :
               "The rollback operation failed. Data inconsistencies may exist."}
            </AlertDescription>
          </div>
        </Alert>

        {/* Info Grid (All States) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 bg-slate-50 rounded border">
            <div className="text-xs text-slate-500 uppercase font-semibold">Timestamp</div>
            <div className="font-mono">{new Date().toLocaleTimeString()}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded border">
             <div className="text-xs text-slate-500 uppercase font-semibold">Execution Time</div>
             <div className="font-mono font-medium">
               {(metrics.execution_time_ms / 1000).toFixed(2)}s
             </div>
          </div>
           <div className="p-3 bg-slate-50 rounded border">
             <div className="text-xs text-slate-500 uppercase font-semibold">Progress</div>
             <div className="font-mono font-medium">
               {metrics.steps_executed} / {metrics.steps_total} Steps
             </div>
          </div>
          <div className="p-3 bg-slate-50 rounded border">
             <div className="text-xs text-slate-500 uppercase font-semibold">Rollback ID</div>
             <div className="font-mono text-xs truncate" title={executionResult.rollback_id}>
               {executionResult.rollback_id?.split('-')[0]}...
             </div>
          </div>
        </div>

        {/* SUCCESS State: Detailed Metrics */}
        {isSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-2">
            <h4 className="text-sm font-semibold text-green-900 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Success Metrics
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-green-700">Tables Affected:</span>
                <span className="font-mono ml-2 font-medium">{metrics.tables_affected_count || 'N/A'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-green-700">Completion Time:</span>
                <span className="font-mono ml-2 font-medium">{new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* PARTIAL / FAILURE: Error & Skip Logs */}
        {!isSuccess && !isCancelled && (
          <div className="space-y-4" ref={errorLogRef} tabIndex={-1}>
            
            {/* Partial Summary Note */}
            {isPartial && (
                <div className="text-sm text-yellow-800 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                    <span className="font-semibold">Note:</span> Only {metrics.steps_executed} of {metrics.steps_total} steps completed. Review the failed steps below before retrying.
                </div>
            )}

            {/* Failed Steps */}
            {executionResult.failed_steps?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b border-red-200 bg-red-100/50 flex items-center justify-between">
                   <span className="text-xs font-bold text-red-800 uppercase flex items-center gap-2">
                     <XCircle className="h-3 w-3" /> Failed Steps
                   </span>
                   <Button variant="ghost" size="sm" className="h-6 px-2 text-red-700 hover:text-red-900 hover:bg-red-200" onClick={handleCopyErrorDetails}>
                     <Copy className="h-3 w-3 mr-1" /> Copy Details
                   </Button>
                </div>
                <div className="max-h-48 overflow-y-auto p-3 space-y-3">
                  {executionResult.failed_steps.map((err, i) => (
                    <div key={i} className="text-xs font-mono text-red-800">
                      <div className="font-bold">Step {err.step_index}: {err.description}</div>
                      <div className="mt-1 opacity-90 bg-red-100 p-2 rounded">{err.error_message || err.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped Steps */}
            {executionResult.skipped_steps?.length > 0 && (
               <div className="bg-yellow-50 border border-yellow-200 rounded-md overflow-hidden">
                 <div className="px-3 py-2 border-b border-yellow-200 bg-yellow-100/50 flex items-center justify-between">
                    <span className="text-xs font-bold text-yellow-800 uppercase flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" /> Skipped Steps
                    </span>
                 </div>
                 <div className="max-h-48 overflow-y-auto p-3 space-y-2">
                   {executionResult.skipped_steps.map((skip, i) => (
                     <div key={i} className="text-xs font-mono text-yellow-900 flex justify-between">
                       <span>Step {skip.step_index}: {skip.description}</span>
                       <span className="italic opacity-70">{skip.skip_reason}</span>
                     </div>
                   ))}
                 </div>
               </div>
            )}

            {/* Recovery Recommendations */}
            {executionResult.recovery_recommendations && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                 <h4 className="font-medium text-blue-900 text-sm mb-2 flex items-center gap-2">
                   <Activity className="h-4 w-4" /> Recommended Actions
                 </h4>
                 <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1 ml-1">
                   {(Array.isArray(executionResult.recovery_recommendations) 
                     ? executionResult.recovery_recommendations 
                     : [executionResult.recovery_recommendations.next_steps]
                   ).map((rec, i) => (
                     <li key={i}>{rec}</li>
                   ))}
                 </ol>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 justify-between items-center w-full">
           <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-start">
             {!isSuccess && !isCancelled && (
               <>
                 <Button variant="outline" size="sm" onClick={handleDownloadErrorReport}>
                   <FileDown className="h-4 w-4 mr-2" /> Download Report
                 </Button>
               </>
             )}
             <Button variant="ghost" size="sm" onClick={() => window.open(`/crm/settings/audit-logs/${auditId}`, '_blank')}>
               <FileText className="h-4 w-4 mr-2" /> View Audit Log
             </Button>
           </div>
           
           <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
             {isPartial && (
               <Button 
                 variant="secondary" 
                 onClick={handleRetryRollback}
               >
                 <RefreshCw className="h-4 w-4 mr-2" /> Retry Rollback
               </Button>
             )}

             {isSuccess && (
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button 
                     variant="outline" 
                     className="border-indigo-200 hover:bg-indigo-50 text-indigo-700"
                     onClick={handleAttemptAlternativeFix}
                   >
                     <Wrench className="h-4 w-4 mr-2" /> Attempt Alternative Fix
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent>
                   <p>Generate a new fix using a different approach or strategy</p>
                 </TooltipContent>
               </Tooltip>
             )}
             
             {(!isSuccess && !isCancelled) && (
               <Button 
                 variant={isPartial ? "warning" : "destructive"}
                 className={cn(isPartial ? "bg-amber-600 hover:bg-amber-700 text-white" : "")}
                 onClick={handleContactSupport}
               >
                 <LifeBuoy className="h-4 w-4 mr-2" /> Contact Support
               </Button>
             )}

             <Button 
               className={isSuccess ? "bg-green-600 hover:bg-green-700" : ""}
               onClick={() => {
                 if (onComplete) onComplete(isSuccess);
                 onOpenChange(false);
               }}
             >
               {isSuccess ? "Close & Continue" : "Close"}
             </Button>
           </div>
        </DialogFooter>
      </div>
      </TooltipProvider>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !isExecuting && onOpenChange(val)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:p-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                executionResult ? (executionResult.success ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600") : "bg-red-100 text-red-600"
              )}>
                {executionResult ? (executionResult.success ? <CheckCircle2 className="h-6 w-6" /> : <AlertOctagon className="h-6 w-6" />) : <Undo2 className="h-6 w-6" />}
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {executionResult ? 'Rollback Results' : 'Confirm Rollback'}
                </DialogTitle>
                <DialogDescription>
                  {executionResult 
                    ? `Operation completed on ${new Date().toLocaleDateString()}` 
                    : 'Review the plan details and confirm your intent to revert changes.'
                  }
                </DialogDescription>
              </div>
              
              <div className="ml-auto">
                  <Badge variant="outline" className={cn(
                    "uppercase text-[10px]",
                    environment === 'production' ? "border-red-200 text-red-700 bg-red-50" : "border-yellow-200 text-yellow-700 bg-yellow-50"
                  )}>
                    {environment}
                  </Badge>
              </div>
            </div>
          </DialogHeader>

          <Separator className="my-2" />

          {isExecuting ? renderProgressTracker() : 
          executionResult ? renderPostExecutionStatus() : 
          renderCommitmentForm()}
          
        </DialogContent>
      </Dialog>
      
      {/* Dependent Objects Modal */}
      <DependentObjectsModal 
        open={showDependentObjectsModal} 
        onOpenChange={setShowDependentObjectsModal} 
        dependentObjects={dependentObjects}
      />
    </>
  );
}