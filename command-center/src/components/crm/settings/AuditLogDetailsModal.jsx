import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Ensure these are imported
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle, AlertTriangle, AlertCircle, Clock, 
  Terminal, User, Activity, ShieldCheck, Database,
  Undo2, FileCode
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import PreviewRollbackModal from '@/components/crm/settings/PreviewRollbackModal';
import RollbackConfirmationDialog from '@/components/crm/settings/RollbackConfirmationDialog';

export default function AuditLogDetailsModal({ open, onOpenChange, log }) {
  const { toast } = useToast();
  
  // Rollback Flow State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [rollbackPlan, setRollbackPlan] = useState(null);

  if (!log) return null;

  // Derive status colors
  const statusColor = 
    log.execution_status === 'SUCCESS' ? 'text-green-600 bg-green-50 border-green-200' :
    log.execution_status === 'ROLLED_BACK' ? 'text-indigo-600 bg-indigo-50 border-indigo-200' :
    log.execution_status === 'MANUAL_EXECUTION_ADVISED' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
    'text-red-600 bg-red-50 border-red-200';

  const StatusIcon = 
    log.execution_status === 'SUCCESS' ? CheckCircle :
    log.execution_status === 'ROLLED_BACK' ? Undo2 :
    log.execution_status === 'MANUAL_EXECUTION_ADVISED' ? AlertTriangle : AlertCircle;

  // Extract fix plan details if available
  const fixPlan = log.doctor_response_jsonb?.recommendation?.fix_plan || log.doctor_response_jsonb?.fix_plan;
  const confidenceScore = log.doctor_response_jsonb?.recommendation?.confidence_score;

  // --- Handlers ---

  const handleInitiateRollback = () => {
    setShowPreviewModal(true);
    // Note: We don't close the Details modal yet, we stack the Preview modal on top 
    // or we could close this one. Stacking is usually better context.
  };

  const handlePreviewContinue = (planData) => {
    setRollbackPlan(planData);
    setShowPreviewModal(false);
    setShowConfirmationModal(true);
  };

  const handleRollbackComplete = (success) => {
    // Refresh parent or local state if needed. 
    // Since 'log' prop comes from parent, we rely on parent refresh or just close.
    // For now, we just close the flow.
    setShowConfirmationModal(false);
    onOpenChange(false); // Close the main details modal too
    
    // In a real app, you'd trigger a refetch of the audit log list here
    window.location.reload(); // Simple brute-force refresh for demo
  };

  const isRollbackAvailable = 
    ['SUCCESS', 'MANUAL_EXECUTION_ADVISED'].includes(log.execution_status) &&
    // Check if within 24 hours (optional UI hint, though backend enforces it too)
    (new Date() - new Date(log.timestamp_utc)) < 24 * 60 * 60 * 1000;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          
          {/* Header */}
          <div className="p-6 pb-4 border-b bg-slate-50/50">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn("flex items-center gap-1.5 px-3 py-1", statusColor)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {log.execution_status}
                </Badge>
                <span className="text-xs text-slate-400 font-mono">{log.id.split('-')[0]}</span>
              </div>
              <div className="text-right">
                <div className="flex items-center text-sm text-slate-500 gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(log.timestamp_utc), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            </div>
            
            <DialogTitle className="text-xl font-bold text-slate-900 mt-2">
              Action Details: {log.feature_id}
            </DialogTitle>
            <DialogDescription className="mt-1 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {log.user_email || 'System User'}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" /> {log.environment}
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className={cn("h-3 w-3", log.is_safe_mode_at_execution ? "text-green-600" : "text-yellow-600")} /> 
                {log.is_safe_mode_at_execution ? 'Safe Mode On' : 'Safe Mode Off'}
              </span>
            </DialogDescription>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              
              {/* Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                      <Terminal className="h-4 w-4" /> Root Cause
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="font-medium text-slate-900">{log.root_cause_type}</p>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {log.original_error_message || 'No error message recorded.'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                      <Database className="h-4 w-4" /> Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-2xl font-bold text-slate-900">{log.total_steps}</div>
                        <div className="text-xs text-slate-500">Total Steps</div>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div>
                        <div className="text-2xl font-bold text-red-600">{log.destructive_steps}</div>
                        <div className="text-xs text-slate-500">Destructive</div>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      {confidenceScore && (
                        <div>
                          <div className="text-2xl font-bold text-green-600">{(confidenceScore * 100).toFixed(0)}%</div>
                          <div className="text-xs text-slate-500">AI Confidence</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Fix Plan Details */}
              {fixPlan && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-indigo-500" />
                    Executed Plan
                  </h3>
                  <div className="border rounded-md divide-y overflow-hidden">
                    {fixPlan.steps?.map((step, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-slate-700">Step {idx + 1}</span>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {step.action_type || 'SQL'}
                          </Badge>
                        </div>
                        <div className="font-mono text-xs text-slate-600 bg-white p-2 rounded border mt-2 overflow-x-auto">
                          {step.sql}
                        </div>
                        {step.explanation && (
                          <p className="text-xs text-slate-500 mt-2 italic">
                            {step.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Rollback History Section */}
              <div className="pt-4">
                 <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Undo2 className="h-4 w-4 text-slate-500" />
                    Rollback History
                 </h3>
                 
                 {/* 
                    Note: Ideally we fetch this from `system_rollback_log` via a join or separate query.
                    For this implementation, assuming `log` might have a joined property or we display a placeholder 
                    if we haven't implemented the fetch logic in the parent component yet.
                    
                    Assuming log.execution_status === 'ROLLED_BACK' implies a history exists.
                 */}
                 {log.execution_status === 'ROLLED_BACK' ? (
                   <Alert className="bg-slate-50 border-slate-200">
                     <CheckCircle className="h-4 w-4 text-slate-500" />
                     <AlertTitle>Action Rolled Back</AlertTitle>
                     <AlertDescription className="text-xs text-slate-500">
                       This action was reversed by a system rollback. Check the Audit Log list for the corresponding Rollback event details.
                     </AlertDescription>
                   </Alert>
                 ) : (
                   <div className="text-xs text-slate-400 italic pl-6">
                     No rollback attempts recorded for this action.
                   </div>
                 )}
              </div>

            </div>
          </ScrollArea>

          <DialogFooter className="p-4 border-t bg-slate-50 flex justify-between sm:justify-between items-center">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            
            {isRollbackAvailable && (
              <Button 
                variant="destructive" 
                onClick={handleInitiateRollback}
                className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 border shadow-sm"
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Initiate Rollback
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Flow Modals */}
      <PreviewRollbackModal 
        open={showPreviewModal} 
        onOpenChange={setShowPreviewModal}
        auditLog={log}
        onContinue={handlePreviewContinue}
      />

      <RollbackConfirmationDialog
        open={showConfirmationModal}
        onOpenChange={setShowConfirmationModal}
        rollbackPlan={rollbackPlan}
        onComplete={handleRollbackComplete}
      />
    </>
  );
}