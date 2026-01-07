import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Trash2, Loader2, Plus, Save, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const AdSpendTracker = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    source: 'Google Ads',
    ad_spend: '',
    leads_count: 0, // Optional manual override
    impressions: 0,
    clicks: 0
  });

  const SOURCES = ['Google Ads', 'Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'Bing'];

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('marketing_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(50);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      setMetrics(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ad_spend) return;

    const { error } = await supabase.from('marketing_metrics').insert([{
      date: formData.date,
      source: formData.source,
      ad_spend: parseFloat(formData.ad_spend),
      leads_count: parseInt(formData.leads_count) || 0,
      impressions: parseInt(formData.impressions) || 0,
      clicks: parseInt(formData.clicks) || 0,
    }]);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Success', description: 'Ad spend logged.' });
      fetchMetrics();
      setFormData(prev => ({ ...prev, ad_spend: '', leads_count: 0, impressions: 0, clicks: 0 }));
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('marketing_metrics').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Deleted', description: 'Record removed.' });
      setMetrics(prev => prev.filter(m => m.id !== id));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ad Spend Tracker</h1>
          <p className="text-gray-500">Manually log advertising costs to calculate ROI.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Log Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={formData.source} onValueChange={val => setFormData({...formData, source: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={formData.ad_spend} onChange={e => setFormData({...formData, ad_spend: e.target.value})} required />
              </div>
              
              <div className="pt-2 border-t grid grid-cols-2 gap-2">
                 <div className="space-y-1">
                    <Label className="text-xs">Impressions (Opt)</Label>
                    <Input type="number" className="h-8 text-sm" value={formData.impressions} onChange={e => setFormData({...formData, impressions: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                    <Label className="text-xs">Clicks (Opt)</Label>
                    <Input type="number" className="h-8 text-sm" value={formData.clicks} onChange={e => setFormData({...formData, clicks: e.target.value})} />
                 </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Log Entry
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Spend History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4"><Loader2 className="animate-spin mx-auto h-6 w-6" /></TableCell></TableRow>
                ) : metrics.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No records found.</TableCell></TableRow>
                ) : (
                  metrics.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{format(new Date(m.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{m.source}</TableCell>
                      <TableCell className="text-right font-medium">${m.ad_spend?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{m.impressions || '-'}</TableCell>
                      <TableCell className="text-right">{m.clicks || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdSpendTracker;