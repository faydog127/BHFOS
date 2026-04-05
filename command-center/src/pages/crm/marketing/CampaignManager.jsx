import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const CampaignManager = () => {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    channel: 'Facebook',
    monthly_budget: '',
    start_date: '',
    end_date: '',
    slug: '', // Used for UTM campaign usually
    status: 'active'
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else setCampaigns(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    try {
        if (!formData.name || !formData.channel) {
            toast({ variant: 'destructive', title: 'Required', description: 'Name and Channel are required.' });
            return;
        }

        const payload = { 
            ...formData,
            slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
            monthly_budget: parseFloat(formData.monthly_budget) || 0
        };

        let error;
        if (editingId) {
            ({ error } = await supabase.from('marketing_campaigns').update(payload).eq('id', editingId));
        } else {
            ({ error } = await supabase.from('marketing_campaigns').insert([payload]));
        }

        if (error) throw error;

        toast({ title: 'Success', description: 'Campaign saved.' });
        setIsModalOpen(false);
        fetchCampaigns();
    } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const openModal = (camp = null) => {
      if (camp) {
          setEditingId(camp.id);
          setFormData({ ...camp });
      } else {
          setEditingId(null);
          setFormData({
            name: '',
            channel: 'Facebook',
            monthly_budget: '',
            start_date: '',
            end_date: '',
            slug: '',
            status: 'active'
          });
      }
      setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketing Campaigns</h1>
            <p className="text-gray-500">Track budgets and performance by campaign.</p>
        </div>
        <Button onClick={() => openModal()} className="bg-blue-600">
            <Plus className="mr-2 h-4 w-4" /> New Campaign
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? <TableRow><TableCell colSpan={6} className="text-center py-4"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> : 
                    campaigns.map(c => (
                        <TableRow key={c.id}>
                            <TableCell className="font-medium">
                                {c.name}
                                <div className="text-xs text-gray-400 font-mono">utm_campaign: {c.slug}</div>
                            </TableCell>
                            <TableCell>{c.channel}</TableCell>
                            <TableCell>${c.monthly_budget}</TableCell>
                            <TableCell className="text-sm text-gray-500">
                                {c.start_date ? format(new Date(c.start_date), 'MMM d') : 'No Start'} - {c.end_date ? format(new Date(c.end_date), 'MMM d') : 'Ongoing'}
                            </TableCell>
                            <TableCell>
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {c.status}
                                </span>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => openModal(c)}>
                                    <Edit className="h-4 w-4 text-blue-500" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2 space-y-2">
                    <Label>Campaign Name</Label>
                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Q3 Promo" />
                </div>
                <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={formData.channel} onValueChange={val => setFormData({...formData, channel: val})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Facebook">Facebook</SelectItem>
                            <SelectItem value="Google">Google Ads</SelectItem>
                            <SelectItem value="Instagram">Instagram</SelectItem>
                            <SelectItem value="Email">Email</SelectItem>
                            <SelectItem value="Offline">Offline / Print</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Monthly Budget ($)</Label>
                    <Input type="number" value={formData.monthly_budget} onChange={e => setFormData({...formData, monthly_budget: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-2">
                    <Label>UTM Slug (Optional)</Label>
                    <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="auto-generated-if-empty" />
                </div>
                <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save Campaign</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignManager;