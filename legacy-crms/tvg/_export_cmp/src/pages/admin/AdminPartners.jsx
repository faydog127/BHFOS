import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider'; // Need to create this if not exists or use input range
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, RefreshCw, ChevronDown, ChevronRight, Mail, Phone, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const AdminPartners = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const fetchPartners = async () => {
    setLoading(true);
    let query = supabase.from('partners').select('*').order('created_at', { ascending: false });
    
    if (filter !== 'All') {
        if (['A', 'B', 'C'].includes(filter)) query = query.eq('tier', filter);
        else query = query.eq('status', filter.toLowerCase());
    }

    if (search) {
        query = query.ilike('org_name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load partners." });
    } else {
        setPartners(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, [filter]); // Search triggered manually or by debounce usually, simplified here

  const handleScoreUpdate = async (id, field, value) => {
    // Optimistic update
    setPartners(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    
    // DB Update
    await supabase.from('partners').update({ [field]: value }).eq('id', id);
    // Re-fetch to get calculated total_score/tier
    fetchPartners();
  };

  const handleStatusUpdate = async (id, status) => {
      await supabase.from('partners').update({ status }).eq('id', id);
      fetchPartners();
      toast({ title: "Status Updated" });
  };
  
  const resendAction = async (id, actionType) => {
      toast({ title: "Action Queued", description: `Resending ${actionType}...` });
      // In real app, call edge function to trigger send
  };

  return (
    <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#1B263B]">Partner Management</h1>
            <div className="flex gap-2">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input 
                        placeholder="Search Org..." 
                        className="pl-8 w-64" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchPartners()}
                    />
                </div>
                <Button variant="outline" onClick={fetchPartners}><RefreshCw className="h-4 w-4" /></Button>
            </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
            {['All', 'A', 'B', 'C', 'New', 'Contacted', 'Qualified'].map(f => (
                <Button 
                    key={f} 
                    variant={filter === f ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setFilter(f)}
                    className={filter === f ? "bg-[#1B263B]" : ""}
                >
                    {f}
                </Button>
            ))}
        </div>

        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Org Name</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Vertical</TableHead>
                            <TableHead>Tier</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                        ) : partners.map(partner => (
                            <React.Fragment key={partner.id}>
                                <TableRow className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId === partner.id ? null : partner.id)}>
                                    <TableCell>{expandedId === partner.id ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</TableCell>
                                    <TableCell className="font-medium">{partner.org_name}</TableCell>
                                    <TableCell>
                                        <div className="text-sm">{partner.contact_name}</div>
                                        <div className="text-xs text-gray-500">{partner.phone}</div>
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{partner.vertical}</Badge></TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            partner.tier === 'A' ? 'bg-green-600' : partner.tier === 'B' ? 'bg-blue-600' : 'bg-gray-500'
                                        )}>{partner.tier}</Badge>
                                    </TableCell>
                                    <TableCell className="font-bold">{partner.total_score}</TableCell>
                                    <TableCell><Badge variant="secondary">{partner.status}</Badge></TableCell>
                                    <TableCell className="text-xs text-gray-500">{format(new Date(partner.created_at), 'MMM d')}</TableCell>
                                </TableRow>
                                {expandedId === partner.id && (
                                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                                        <TableCell colSpan={8} className="p-6">
                                            <div className="grid md:grid-cols-3 gap-8">
                                                {/* INFO */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-700 border-b pb-2">Details</h4>
                                                    <div className="grid grid-cols-2 text-sm gap-2">
                                                        <span className="text-gray-500">Email:</span> <span>{partner.email}</span>
                                                        <span className="text-gray-500">Area:</span> <span>{partner.service_area}</span>
                                                        <span className="text-gray-500">Doors:</span> <span>{partner.doors_units}</span>
                                                        <span className="text-gray-500">Volume:</span> <span>{partner.monthly_volume_estimate}</span>
                                                        <span className="text-gray-500">Urgency:</span> <span className="text-red-600 font-medium">{partner.urgency}</span>
                                                    </div>
                                                    <div className="bg-white p-2 rounded border text-sm text-gray-600 italic">
                                                        "{partner.notes}"
                                                    </div>
                                                </div>

                                                {/* SCORING */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-700 border-b pb-2">Scoring Factors (1-5)</h4>
                                                    {[
                                                        { k: 'score_revenue', label: 'Revenue Potential' },
                                                        { k: 'score_pain', label: 'Pain / Urgency' },
                                                        { k: 'score_velocity', label: 'Velocity' },
                                                        { k: 'score_ops', label: 'Ops Ease' },
                                                        { k: 'score_growth', label: 'Growth Strategic' },
                                                    ].map(factor => (
                                                        <div key={factor.k} className="flex items-center gap-2 text-sm">
                                                            <span className="w-32 text-gray-600">{factor.label}</span>
                                                            <input 
                                                                type="range" min="1" max="5" step="1"
                                                                value={partner[factor.k] || 1}
                                                                onChange={(e) => handleScoreUpdate(partner.id, factor.k, parseInt(e.target.value))}
                                                                className="w-full"
                                                            />
                                                            <span className="w-4 font-bold">{partner[factor.k]}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* ACTIONS & SEQUENCE */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-700 border-b pb-2">Actions</h4>
                                                    <div className="flex gap-2 mb-4">
                                                        <Button size="sm" variant="outline"><Phone className="w-3 h-3 mr-2"/> Call</Button>
                                                        <Button size="sm" variant="outline"><Mail className="w-3 h-3 mr-2"/> Email</Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {[
                                                            { k: 'welcome_email_sent', l: 'Welcome Email' },
                                                            { k: 'welcome_sms_sent', l: 'Welcome SMS' },
                                                            { k: 'one_pager_sent', l: 'One Pager' },
                                                            { k: 'onboarding_calendar_sent', l: 'Calendar Link' },
                                                        ].map(seq => (
                                                            <div key={seq.k} className="flex justify-between items-center text-sm border rounded p-2 bg-white">
                                                                <div className="flex items-center gap-2">
                                                                    <Checkbox checked={partner[seq.k]} disabled />
                                                                    <span>{seq.l}</span>
                                                                </div>
                                                                <Button variant="ghost" size="xs" className="h-6 text-xs" onClick={() => resendAction(partner.id, seq.l)}>Resend</Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="pt-4">
                                                        <span className="text-xs text-gray-400 block mb-1">Change Status</span>
                                                        <div className="flex gap-1">
                                                            {['Contacted', 'Qualified', 'Disqualified'].map(s => (
                                                                <Button key={s} size="sm" variant={partner.status === s.toLowerCase() ? 'default' : 'secondary'} onClick={() => handleStatusUpdate(partner.id, s.toLowerCase())} className="text-xs h-7">{s}</Button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
};

export default AdminPartners;