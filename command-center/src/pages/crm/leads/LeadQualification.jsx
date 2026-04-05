import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Flame, Snowflake, ThermometerSun, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LeadQualification = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hot: 0, warm: 0, cold: 0 });
  const [selectedLead, setSelectedLead] = useState(null);
  const [qualificationForm, setQualificationForm] = useState({ status: '', reason: '' });

  useEffect(() => {
    fetchLeads();
  }, []);

  const calculateScore = (lead) => {
    let score = 0;
    // Simple mock logic for score calculation based on creation time and source
    const hoursSinceCreation = (new Date() - new Date(lead.created_at)) / (1000 * 60 * 60);
    
    if (hoursSinceCreation < 2) score += 50; // Hot if new
    else if (hoursSinceCreation < 24) score += 30; // Warm
    else score += 10; // Cold

    if (lead.marketing_channel === 'Google Ads') score += 20;
    if (['hvac', 'full_install'].includes(lead.service?.toLowerCase())) score += 30; // High ticket

    return score;
  };

  const getTemperature = (score) => {
    if (score >= 70) return { label: 'Hot', color: 'text-red-500 bg-red-50', icon: Flame };
    if (score >= 40) return { label: 'Warm', color: 'text-orange-500 bg-orange-50', icon: ThermometerSun };
    return { label: 'Cold', color: 'text-blue-500 bg-blue-50', icon: Snowflake };
  };

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      // Process leads to add calculated temp if not stored
      const processed = (data || []).map(lead => {
        const score = calculateScore(lead);
        const temp = getTemperature(score);
        return { ...lead, score, temp };
      });

      setLeads(processed);
      
      const s = { hot: 0, warm: 0, cold: 0 };
      processed.forEach(l => {
        if (l.temp.label === 'Hot') s.hot++;
        else if (l.temp.label === 'Warm') s.warm++;
        else s.cold++;
      });
      setStats(s);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedLead || !qualificationForm.status) return;

    const { error } = await supabase
      .from('leads')
      .update({ 
        qualification_status: qualificationForm.status,
        qualification_reason: qualificationForm.reason
      })
      .eq('id', selectedLead.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Updated', description: 'Lead qualification status updated.' });
      fetchLeads();
      setSelectedLead(null);
    }
  };

  const chartData = [
    { name: 'Hot', count: stats.hot, fill: '#ef4444' },
    { name: 'Warm', count: stats.warm, fill: '#f97316' },
    { name: 'Cold', count: stats.cold, fill: '#3b82f6' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Qualification</h1>
          <p className="text-gray-500">Score and qualify inbound leads based on engagement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-3">
          <CardHeader><CardTitle>Leads Pipeline</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> : 
                leads.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="font-medium">{lead.first_name} {lead.last_name || 'Lead'}</div>
                      <div className="text-xs text-gray-400">{lead.service || 'General Inquiry'}</div>
                    </TableCell>
                    <TableCell>{lead.marketing_channel || lead.source || 'Direct'}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(lead.created_at))} ago
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${lead.temp.color} border-0 flex w-fit items-center gap-1`}>
                        <lead.temp.icon className="w-3 h-3" /> {lead.temp.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lead.qualification_status === 'Qualified' ? 
                        <span className="text-green-600 flex items-center gap-1 text-xs font-bold"><CheckCircle className="w-3 h-3"/> Qualified</span> : 
                      lead.qualification_status === 'Disqualified' ? 
                        <span className="text-red-500 flex items-center gap-1 text-xs font-bold"><XCircle className="w-3 h-3"/> Disqualified</span> :
                        <span className="text-gray-400 text-xs">Pending</span>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedLead(lead); setQualificationForm({ status: lead.qualification_status || '', reason: lead.qualification_reason || '' }); }}>
                        Qualify
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qualify Lead: {selectedLead?.first_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Qualification Status</Label>
              <Select value={qualificationForm.status} onValueChange={(val) => setQualificationForm({...qualificationForm, status: val})}>
                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                  <SelectItem value="Disqualified">Disqualified</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Input 
                value={qualificationForm.reason} 
                onChange={e => setQualificationForm({...qualificationForm, reason: e.target.value})} 
                placeholder="e.g. Budget too low, Out of service area..." 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLead(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadQualification;