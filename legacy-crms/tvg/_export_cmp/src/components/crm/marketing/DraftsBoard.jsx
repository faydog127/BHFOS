import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Edit, CheckCircle2, AlertOctagon, Megaphone, Plus, LayoutGrid } from 'lucide-react';
import DraftApprovalModal from './DraftApprovalModal';

const StatusColumn = ({ title, status, actions, onSelect, color }) => (
  <div className="flex flex-col h-full bg-slate-50/50 rounded-lg border border-slate-200 overflow-hidden">
    <div className={`p-3 border-b border-slate-200 bg-white font-semibold text-sm flex justify-between items-center ${color}`}>
      {title}
      <Badge variant="secondary" className="bg-white/50">{actions.length}</Badge>
    </div>
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {actions.map(action => (
        <Card key={action.id} className="cursor-pointer hover:shadow-md transition-all group" onClick={() => onSelect(action)}>
          <CardContent className="p-3 space-y-2">
            <div className="flex justify-between items-start">
              <Badge variant="outline" className="text-[10px] capitalize">
                {action.target_details?.platform || action.action_type || 'General'}
              </Badge>
              <span className="text-[10px] text-slate-400">
                {new Date(action.created_at).toLocaleDateString()}
              </span>
            </div>
            <h4 className="font-semibold text-sm leading-tight line-clamp-2">{action.subject_line || 'No Subject'}</h4>
            <p className="text-xs text-slate-500 line-clamp-3 bg-slate-50 p-2 rounded">
              {action.content_preview || action.body || 'No content...'}
            </p>
          </CardContent>
          <CardFooter className="p-3 pt-0 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-6 text-xs">Review <Edit className="ml-1 w-3 h-3" /></Button>
          </CardFooter>
        </Card>
      ))}
      {actions.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-xs italic">
          No items
        </div>
      )}
    </div>
  </div>
);

const DraftsBoard = () => {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchActions();
    
    // Subscribe to changes
    const sub = supabase
        .channel('drafts-board')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_actions' }, () => {
            fetchActions();
        })
        .subscribe();
        
    return () => supabase.removeChannel(sub);
  }, []);

  const fetchActions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('marketing_actions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setActions(data);
    setLoading(false);
  };

  const generateDraft = async (platform) => {
    setGenerating(true);
    toast({ title: "Generating Draft", description: `Creating ${platform} ad copy with AI...` });
    
    try {
        const { data, error } = await supabase.functions.invoke('generate-marketing-draft', {
            body: { 
                platform, 
                audience: 'Homeowners in Brevard County',
                context: 'Seasonal allergy and mold prevention' 
            }
        });
        
        if (error) throw error;
        
        toast({ title: "Success", description: "Draft created successfully." });
        fetchActions(); // Manual refresh just in case realtime lags
    } catch (err) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
        setGenerating(false);
    }
  };

  const drafts = actions.filter(a => a.status === 'draft' || a.status === 'needs_approval');
  const approved = actions.filter(a => a.status === 'approved' || a.status === 'scheduled');
  const rejected = actions.filter(a => a.status === 'rejected');
  const published = actions.filter(a => a.status === 'published' || a.status === 'sent');

  const handleSelect = (action) => {
    setSelectedAction(action);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-slate-500" /> Content Pipeline
        </h3>
        <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => generateDraft('Facebook')} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Plus className="w-4 h-4 mr-2" />}
                FB Ad
            </Button>
            <Button size="sm" variant="outline" onClick={() => generateDraft('Google Ads')} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Plus className="w-4 h-4 mr-2" />}
                Google Ad
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 min-h-0">
        <StatusColumn 
            title="Drafts & Review" 
            status="draft" 
            actions={drafts} 
            onSelect={handleSelect} 
            color="text-blue-700 border-l-4 border-l-blue-500"
        />
        <StatusColumn 
            title="Approved" 
            status="approved" 
            actions={approved} 
            onSelect={handleSelect}
            color="text-green-700 border-l-4 border-l-green-500" 
        />
        <StatusColumn 
            title="Published" 
            status="published" 
            actions={published} 
            onSelect={handleSelect}
            color="text-purple-700 border-l-4 border-l-purple-500" 
        />
        <StatusColumn 
            title="Rejected" 
            status="rejected" 
            actions={rejected} 
            onSelect={handleSelect}
            color="text-red-700 border-l-4 border-l-red-500" 
        />
      </div>

      <DraftApprovalModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        action={selectedAction}
        onUpdate={fetchActions}
      />
    </div>
  );
};

export default DraftsBoard;