import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertCircle, Loader2, Mail, MessageSquare, ArrowRight, Clock } from 'lucide-react';
import { format } from 'date-fns';

const MarketingConsole = () => {
  const { toast } = useToast();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState('');

  useEffect(() => {
    fetchPendingActions();
  }, []);

  const fetchPendingActions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
         setActions([]);
         setLoading(false);
         return;
      }

      // RLS will automatically filter by tenant_id
      const { data, error } = await supabase
        .from('marketing_actions')
        .select('*, leads(first_name, last_name, email, company)')
        .in('status', ['needs_approval', 'pending', 'pending_approval'])
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
      toast({
        title: "Error fetching data",
        description: error.message || "Failed to load pending marketing actions.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (item) => {
    setSelectedAction(item);
    setReviewerNotes(item.reviewer_notes || '');
    setIsSheetOpen(true);
  };

  const updateStatus = async (newStatus) => {
    if (!selectedAction) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("You must be logged in to perform this action.");
      }

      const updates = {
        status: newStatus,
        reviewer_notes: reviewerNotes ? reviewerNotes.trim() : null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        approved_by: user.id,
        approved_at: newStatus === 'approved' ? new Date().toISOString() : null
      };

      const { count, error } = await supabase
        .from('marketing_actions')
        .update(updates)
        .eq('id', selectedAction.id)
        .select('*', { count: 'exact' });

      if (error) {
        throw new Error(`Database Error: ${error.message} (Code: ${error.code})`);
      }

      // 5) Add optimistic removal/refetch on approvals list after approve/reject succeeds.
      // Optimistic Update: Remove from local list immediately
      setActions((prev) => prev.filter((a) => a.id !== selectedAction.id));
      
      setIsSheetOpen(false);
      setSelectedAction(null);

      toast({
        title: newStatus === 'approved' ? "Approved" : "Rejected",
        description: `Action has been ${newStatus}.`,
        variant: newStatus === 'approved' ? "default" : "destructive"
      });
      
      // Background Sync to ensure consistency
      fetchPendingActions();

    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Could not update the action status.",
        variant: "destructive"
      });
      // Revert optimistic update (refetch)
      fetchPendingActions();
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Now';
    return format(new Date(dateString), 'MMM d, h:mm a');
  };

  const getChannelIcon = (channel) => {
    if (channel === 'email') return <Mail className="w-4 h-4" />;
    if (channel === 'sms') return <MessageSquare className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6 space-y-6 bg-slate-50">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Marketing Console</h1>
        <p className="text-muted-foreground">
          Review, approve, or reject pending AI marketing actions before they are sent.
        </p>
      </div>

      <div className="flex-1 min-h-0 border rounded-lg bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <h2 className="font-semibold flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-blue-500" />
            Pending Approvals ({actions.length})
          </h2>
          <Button variant="outline" size="sm" onClick={fetchPendingActions} disabled={loading}>
            <span className={loading ? "animate-spin mr-2" : "mr-2"}>⟳</span> Refresh List
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
              <div className="p-4 rounded-full bg-green-100">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-slate-900">All Caught Up!</h3>
                <p className="text-muted-foreground">There are no marketing actions waiting for approval.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {actions.map((action) => (
                <Card key={action.id} className="flex flex-col hover:shadow-md transition-all border-l-4 border-l-amber-400 bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary" className="flex items-center gap-1 capitalize">
                        {getChannelIcon(action.channel)} {action.channel}
                      </Badge>
                      <span className="text-xs font-medium text-slate-500">
                        {formatDate(action.scheduled_at)}
                      </span>
                    </div>
                    <CardTitle className="text-base pt-2 line-clamp-1">
                      {action.content_preview?.split('\n')[0] || 'No Subject'}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">
                      To: {action.target_details?.name || action.leads?.first_name || 'Unknown Recipient'}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 py-2">
                    <div className="bg-slate-50 p-3 rounded border text-xs text-slate-600 italic line-clamp-3 min-h-[4rem]">
                      "{action.content_preview}"
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 pb-4">
                    <Button 
                      className="w-full bg-blue-600 text-white hover:bg-blue-700 shadow-sm" 
                      onClick={() => handlePreview(action)}
                    >
                      Review Details <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col h-full p-0 gap-0" side="right">
          <SheetHeader className="p-6 border-b bg-white flex-shrink-0">
            <SheetTitle className="text-xl">Review Action</SheetTitle>
            <SheetDescription>
              Verify the content and recipient details below before approving.
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {selectedAction && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Recipient Details</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                    <div>
                      <span className="text-xs text-slate-500 uppercase font-medium">Name</span>
                      <div className="font-medium">{selectedAction.target_details?.name || selectedAction.leads?.first_name || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 uppercase font-medium">Contact Info</span>
                      <div className="font-medium break-all">{selectedAction.target_details?.email || selectedAction.target_details?.phone || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 uppercase font-medium">Channel</span>
                      <div className="capitalize flex items-center gap-1">
                        {getChannelIcon(selectedAction.channel)} {selectedAction.channel}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 uppercase font-medium">Playbook</span>
                      <div className="font-medium">{selectedAction.playbook_key || selectedAction.type || 'Manual'}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Message Preview</label>
                  <div className="w-full rounded-lg border bg-white p-4 text-sm leading-relaxed shadow-sm font-mono whitespace-pre-wrap text-slate-800">
                    {selectedAction.content_preview || selectedAction.body || selectedAction.subject_line}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Reviewer Notes (Internal)</label>
                  <Textarea 
                    placeholder="Add any notes about why this was approved or rejected..."
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    className="bg-white resize-none focus-visible:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="p-6 border-t bg-white flex-shrink-0 flex-col sm:flex-row gap-3 sm:gap-2">
             <Button 
              variant="outline" 
              className="flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-300"
              onClick={() => updateStatus('rejected')}
              disabled={processing}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject
            </Button>
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm"
              onClick={() => updateStatus('approved')}
              disabled={processing}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve & Send
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MarketingConsole;