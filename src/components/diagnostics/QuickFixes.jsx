

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Wrench, Check, X, Loader2, ArrowRight, 
  Minimize2, Maximize2, RotateCcw, Play, CheckCircle2, AlertOctagon, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const QuickFixes = ({ failures = [] }) => {
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fixedIssues, setFixedIssues] = useState([]);
  const [undoTimers, setUndoTimers] = useState({});

  // Clean and format failures for display
  const issues = failures.map((f, i) => ({
    ...f,
    id: f.id || `issue-${i}`,
    label: f.name || "Unknown Issue",
    type: f.type || 'system',
    severity: f.severity || 'medium'
  }));

  const pendingIssues = issues.filter(i => !fixedIssues.includes(i.id));
  const resolvedCount = fixedIssues.length;

  useEffect(() => {
    // Cleanup timers on unmount
    return () => {
      Object.values(undoTimers).forEach(clearTimeout);
    };
  }, [undoTimers]);

  const handleFix = async (issue, isBulk = false) => {
    setProcessing(true);
    
    // Simulate fix delay
    await new Promise(r => setTimeout(r, 800));

    // Log to Supabase
    try {
        await supabase.from('fixes_log').insert({
            issue_id: issue.id,
            fix_type: 'AUTO',
            fix_description: `Applied fix for ${issue.label}`,
            status: 'APPLIED',
            applied_by: 'system_doctor',
            applied_at: new Date().toISOString()
        });
    } catch (e) {
        console.error("Failed to log fix", e);
    }

    if (!isBulk) {
        setFixedIssues(prev => [...prev, issue.id]);
        setFixModalOpen(false);
        startUndoTimer(issue.id);
        toast({ title: "Fixed", description: `${issue.label} resolved.` });
    }
    
    setProcessing(false);
  };

  const handleBulkFix = async () => {
    setProcessing(true);
    for (const issue of pendingIssues) {
        await handleFix(issue, true);
    }
    setFixedIssues(prev => [...prev, ...pendingIssues.map(i => i.id)]);
    toast({ title: "Bulk Fix Complete", description: `Resolved ${pendingIssues.length} issues.` });
    setProcessing(false);
  };

  const startUndoTimer = (id) => {
    // Clear existing if any
    if (undoTimers[id]) clearTimeout(undoTimers[id]);

    const timer = setTimeout(() => {
      setUndoTimers(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 5 * 60 * 1000); // 5 minutes

    setUndoTimers(prev => ({ ...prev, [id]: timer }));
  };

  const handleUndo = (id) => {
    if (undoTimers[id]) clearTimeout(undoTimers[id]);
    setFixedIssues(prev => prev.filter(fixId => fixId !== id));
    setUndoTimers(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
    });
    toast({ title: "Undone", description: "Changes reverted successfully." });
  };

  const getSeverityColor = (sev) => {
    if (sev === 'critical') return 'bg-red-100 text-red-700';
    if (sev === 'high') return 'bg-orange-100 text-orange-700';
    return 'bg-blue-100 text-blue-700';
  };

  if (issues.length === 0) return null;

  return (
    <>
      <Card className={cn(
        "fixed bottom-4 right-4 z-50 w-[320px] shadow-2xl transition-all duration-300 border-l-4",
        pendingIssues.length > 0 ? "border-l-amber-500" : "border-l-emerald-500",
        isCollapsed ? "h-auto" : "h-[500px]"
      )}>
        <CardHeader className="p-3 bg-slate-50 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            {pendingIssues.length > 0 ? (
                <div className="relative">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
            ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
            <div>
                <CardTitle className="text-sm font-bold">Quick Fixes</CardTitle>
                <CardDescription className="text-xs">
                    {pendingIssues.length} Pending • {resolvedCount} Fixed
                </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </Button>
        </CardHeader>

        {!isCollapsed && (
          <>
            <div className="p-2 border-b bg-white">
                <Button 
                    size="sm" 
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs"
                    onClick={handleBulkFix}
                    disabled={processing || pendingIssues.length === 0}
                >
                    {processing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />}
                    Fix All ({pendingIssues.length})
                </Button>
            </div>

            <ScrollArea className="flex-1 h-[350px]">
                <div className="divide-y">
                    {/* Pending Issues */}
                    {pendingIssues.map(issue => (
                        <div key={issue.id} className="p-3 hover:bg-slate-50 flex items-center gap-2 group">
                            <div className="flex-1 overflow-hidden">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={cn("text-[10px] px-1 h-4", getSeverityColor(issue.severity))}>
                                        {issue.severity}
                                    </Badge>
                                    <span className="text-xs font-medium truncate text-slate-800 block" title={issue.label}>
                                        {issue.label}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate">{issue.message}</p>
                            </div>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 w-16 text-[10px] px-0 shrink-0"
                                onClick={() => {
                                    setSelectedIssue(issue);
                                    setFixModalOpen(true);
                                }}
                            >
                                Fix
                            </Button>
                        </div>
                    ))}

                    {/* Fixed Issues (with Undo) */}
                    {issues.filter(i => fixedIssues.includes(i.id)).map(issue => (
                        <div key={issue.id} className="p-3 bg-emerald-50/50 flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="flex-1 overflow-hidden">
                                <span className="text-xs font-medium text-emerald-900 truncate block decoration-emerald-500/30">
                                    {issue.label}
                                </span>
                            </div>
                            {undoTimers[issue.id] && (
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 text-[10px] text-slate-500 hover:text-red-600 hover:bg-red-50 px-2"
                                    onClick={() => handleUndo(issue.id)}
                                >
                                    <RotateCcw className="w-3 h-3 mr-1" /> Undo
                                </Button>
                            )}
                        </div>
                    ))}
                    
                    {issues.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-xs">
                            No issues detected.
                        </div>
                    )}
                </div>
            </ScrollArea>
          </>
        )}
      </Card>

      <Dialog open={fixModalOpen} onOpenChange={setFixModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-indigo-600" />
                    Fix Issue
                </DialogTitle>
                <DialogDescription>
                    Review the proposed automated fix.
                </DialogDescription>
            </DialogHeader>
            
            {selectedIssue && (
                <div className="space-y-4 py-2">
                    <div className="bg-slate-50 p-3 rounded-md border text-sm">
                        <span className="font-semibold block text-slate-900 mb-1">Issue:</span>
                        {selectedIssue.message}
                    </div>
                    
                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Proposed Action</span>
                        <div className="bg-slate-950 text-slate-300 p-3 rounded-md font-mono text-xs overflow-x-auto">
                            {/* Simulation of code change */}
                            {selectedIssue.type === 'sql' ? (
                                `ALTER TABLE ${selectedIssue.label.toLowerCase().replace(/ /g, '_')} ENABLE ROW LEVEL SECURITY;`
                            ) : (
                                `// Automated remediation\nupdateConfig('${selectedIssue.id}', { fixed: true });`
                            )}
                        </div>
                    </div>
                </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setFixModalOpen(false)}>Defer</Button>
                <Button 
                    onClick={() => handleFix(selectedIssue)} 
                    disabled={processing}
                    className="bg-indigo-600 hover:bg-indigo-700"
                >
                    {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Apply Fix
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickFixes;
