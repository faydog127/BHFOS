import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, AlertCircle, History, Sparkles, Send } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const DraftApprovalModal = ({ action, open, onOpenChange, onUpdate }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ subject_line: '', body: '', platform: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    if (action) {
      setFormData({
        subject_line: action.subject_line || '',
        body: action.body || '',
        platform: action.target_details?.platform || 'Unknown'
      });
      setShowRejectInput(false);
      setRejectionReason('');
    }
  }, [action]);

  const handleDecision = async (decision) => {
    setIsProcessing(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      const changes = [];
      if (formData.subject_line !== action.subject_line) changes.push(`Subject changed from "${action.subject_line}"`);
      if (formData.body !== action.body) changes.push(`Body content modified`);

      const auditEntry = {
        action: decision,
        timestamp: new Date().toISOString(),
        user_id: user?.id,
        user_email: user?.email,
        notes: decision === 'rejected' ? rejectionReason : (changes.length > 0 ? changes.join('; ') : 'Approved without changes')
      };

      const newHistory = [...(action.history || []), auditEntry];

      const { error } = await supabase
        .from('marketing_actions')
        .update({
          status: decision,
          subject_line: formData.subject_line,
          body: formData.body,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: decision === 'rejected' ? rejectionReason : null,
          history: newHistory
        })
        .eq('id', action.id);

      if (error) throw error;

      toast({
        title: decision === 'approved' ? "Draft Approved" : "Draft Rejected",
        description: decision === 'approved' ? "Content is ready for publication." : "Sent back to drafts with notes.",
        variant: decision === 'approved' ? 'default' : 'destructive'
      });

      onUpdate();
      onOpenChange(false);

    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!action) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                Review Draft 
                <Badge variant="outline" className="capitalize">{formData.platform}</Badge>
              </DialogTitle>
              <DialogDescription>Review AI-generated content before publishing.</DialogDescription>
            </div>
            {action.status === 'approved' && <Badge className="bg-green-100 text-green-700">Approved</Badge>}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 py-4">
          {/* Editor */}
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Headline / Subject</Label>
              <Input 
                value={formData.subject_line} 
                onChange={e => setFormData(prev => ({ ...prev, subject_line: e.target.value }))}
                className="font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label>Ad Copy / Body</Label>
              <Textarea 
                value={formData.body} 
                onChange={e => setFormData(prev => ({ ...prev, body: e.target.value }))}
                className="min-h-[200px]"
              />
            </div>
            
            {showRejectInput && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-2">
                <Label className="text-red-800">Reason for Rejection</Label>
                <Input 
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g., Tone is too aggressive, Wrong offer..."
                  className="bg-white mt-2"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Audit Log Sidebar */}
          <div className="w-full md:w-64 border-l pl-6 hidden md:flex flex-col">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" /> Audit Log
            </h4>
            <ScrollArea className="flex-1">
              <div className="space-y-4">
                <div className="text-xs space-y-1">
                  <div className="font-medium text-slate-700">AI Generation</div>
                  <div className="text-slate-500">{new Date(action.created_at).toLocaleString()}</div>
                  <div className="text-slate-400 italic">Created draft via {action.ai_model || 'GPT-4'}</div>
                </div>
                {action.history?.map((entry, i) => (
                  <div key={i} className="text-xs space-y-1 pt-3 border-t">
                    <div className={`font-medium capitalize ${entry.action === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.action}
                    </div>
                    <div className="text-slate-500">{new Date(entry.timestamp).toLocaleString()}</div>
                    <div className="text-slate-600 bg-slate-50 p-1.5 rounded">{entry.notes}</div>
                    <div className="text-[10px] text-slate-400">{entry.user_email}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!showRejectInput ? (
            <>
              <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200" onClick={() => setShowRejectInput(true)}>
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button onClick={() => handleDecision('approved')} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Publish
              </Button>
            </>
          ) : (
            <div className="flex w-full gap-2">
              <Button variant="ghost" onClick={() => setShowRejectInput(false)} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={() => handleDecision('rejected')} disabled={!rejectionReason || isProcessing} className="flex-1">
                Confirm Rejection
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DraftApprovalModal;