import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PhoneCall, Plus, Filter, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const CallLog = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState('All');
  const [formData, setFormData] = useState({
    caller_name: '',
    caller_phone: '',
    source: 'Google Ads',
    service_interest: '',
    duration_minutes: '',
    notes: '',
    converted: false,
    job_amount: ''
  });

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase.from('manual_call_logs').select('*').order('created_at', { ascending: false });
    
    if (filterSource !== 'All') {
      query = query.eq('source', filterSource);
    }

    const { data, error } = await query;
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('manual_call_logs').insert([{
      ...formData,
      job_amount: formData.job_amount ? parseFloat(formData.job_amount) : 0,
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : 0
    }]);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Success', description: 'Call logged successfully.' });
      setFormData({
        caller_name: '',
        caller_phone: '',
        source: 'Google Ads',
        service_interest: '',
        duration_minutes: '',
        notes: '',
        converted: false,
        job_amount: ''
      });
      fetchLogs();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Call Log</h1>
          <p className="text-gray-500">Manually track inbound calls and conversions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Log Form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-blue-500"/> Log New Call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Caller Name</Label>
                <Input value={formData.caller_name} onChange={e => setFormData({...formData, caller_name: e.target.value})} required placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={formData.caller_phone} onChange={e => setFormData({...formData, caller_phone: e.target.value})} required placeholder="(555) 123-4567" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={formData.source} onValueChange={val => setFormData({...formData, source: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={formData.duration_minutes} onChange={e => setFormData({...formData, duration_minutes: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Service Interest</Label>
                <Input value={formData.service_interest} onChange={e => setFormData({...formData, service_interest: e.target.value})} placeholder="e.g. Duct Cleaning" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Key details..." />
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg space-y-4 border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="converted-mode">Converted to Job?</Label>
                  <Switch id="converted-mode" checked={formData.converted} onCheckedChange={c => setFormData({...formData, converted: c})} />
                </div>
                {formData.converted && (
                  <div className="space-y-2">
                    <Label>Job Amount ($)</Label>
                    <Input type="number" value={formData.job_amount} onChange={e => setFormData({...formData, job_amount: e.target.value})} placeholder="0.00" />
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Log Call
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Call History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Call History</CardTitle>
              <Select value={filterSource} onValueChange={(val) => { setFilterSource(val); setTimeout(fetchLogs, 100); }}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Filter Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Sources</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No calls logged yet.</TableCell></TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, h:mm a')}</TableCell>
                      <TableCell>
                        <div className="font-medium">{log.caller_name}</div>
                        <div className="text-xs text-gray-500">{log.caller_phone}</div>
                      </TableCell>
                      <TableCell><span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{log.source}</span></TableCell>
                      <TableCell>{log.service_interest}</TableCell>
                      <TableCell>
                        {log.converted ? 
                          <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">Converted</span> : 
                          <span className="text-gray-500 text-xs">Not Booked</span>
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {log.job_amount > 0 ? `$${log.job_amount}` : '-'}
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

export default CallLog;