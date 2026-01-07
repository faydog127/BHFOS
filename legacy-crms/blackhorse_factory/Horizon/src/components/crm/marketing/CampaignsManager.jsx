import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Loader2, Calendar, DollarSign, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';

const CampaignsManager = () => {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    channel: 'Digital',
    status: 'active',
    start_date: '',
    end_date: '',
    monthly_budget: '',
    notes: ''
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data: campaignsData, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(campaignsData || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({ title: "Error", description: "Failed to load campaigns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    // 1. Input Validation
    if (!formData.name || !formData.slug) {
      toast({ title: "Validation Error", description: "Name and Slug are required.", variant: "destructive" });
      return;
    }

    try {
      // 2. Authentication Check
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Auth Check Failed:', authError);
        toast({ 
          title: "Authentication Error", 
          description: "Please log in to create campaigns.", 
          variant: "destructive" 
        });
        return;
      }

      // 3. Attempt Insertion
      const payload = {
        ...formData,
        monthly_budget: formData.monthly_budget ? parseFloat(formData.monthly_budget) : null,
        created_at: new Date().toISOString() // Explicitly set created_at if needed, though DB usually handles it
      };

      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert([payload])
        .select();

      // 4. Detailed Error Logging
      if (error) {
        console.group('Supabase Campaign Creation Error');
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        console.error('Error Details:', error.details);
        console.error('Hint:', error.hint);
        console.error('Payload:', payload);
        console.groupEnd();
        
        throw error;
      }

      // 5. Success Handling
      toast({ title: "Success", description: "Campaign created successfully." });
      setIsCreateOpen(false);
      fetchCampaigns();
      setFormData({ name: '', slug: '', channel: 'Digital', status: 'active', start_date: '', end_date: '', monthly_budget: '', notes: '' });

    } catch (error) {
      // 6. User-Friendly Error Display
      let errorMessage = error.message || "An unknown error occurred.";
      if (error.code === '42501') {
        errorMessage = "Permission denied (RLS). Check database policies.";
      }
      
      toast({ 
        title: "Error Creating Campaign", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return c.status === 'active';
    if (activeTab === 'planned') return c.status === 'planned';
    if (activeTab === 'completed') return c.status === 'completed';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Tracking Campaigns</h3>
          <p className="text-sm text-muted-foreground">Manage inbound marketing sources and attribution.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Campaign
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="planned">Planned</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug / ID</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                  ) : filteredCampaigns.length === 0 ? (
                     <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No campaigns found.</TableCell></TableRow>
                  ) : (
                    filteredCampaigns.map((campaign) => (
                      <TableRow key={campaign.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{campaign.slug}</TableCell>
                        <TableCell>{campaign.channel}</TableCell>
                        <TableCell>{campaign.monthly_budget ? `$${campaign.monthly_budget}` : '-'}</TableCell>
                        <TableCell className="text-xs">
                          {campaign.start_date || '?'} - {campaign.end_date || '?'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Tracking Campaign</DialogTitle>
            <DialogDescription>
              Set up a new campaign to track inbound lead sources.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Summer Promo 2025" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (Tracking ID)</Label>
                <Input id="slug" value={formData.slug} onChange={(e) => setFormData({...formData, slug: e.target.value})} placeholder="summer-25" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Select value={formData.channel} onValueChange={(v) => setFormData({...formData, channel: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Digital">Digital</SelectItem>
                    <SelectItem value="Print">Print</SelectItem>
                    <SelectItem value="Social">Social</SelectItem>
                    <SelectItem value="Event">Event</SelectItem>
                    <SelectItem value="Partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Monthly Budget</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" type="number" value={formData.monthly_budget} onChange={(e) => setFormData({...formData, monthly_budget: e.target.value})} placeholder="0.00" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignsManager;