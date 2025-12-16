import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/customSupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Users, DollarSign, BarChart2, CheckCircle, Clock } from "lucide-react";
import { format } from 'date-fns';

export default function ReferralPartners() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    commission_rate: 0.10,
    status: 'active'
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Partners
      const { data: partnersData, error: partnersError } = await supabase
        .from('referral_partners')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (partnersError) throw partnersError;
      setPartners(partnersData || []);

      // 2. Fetch Referrals with joins
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
            *,
            referral_partners ( name ),
            appointments ( scheduled_start, pricing_snapshot )
        `)
        .order('created_at', { ascending: false });
        
      if (referralsError) throw referralsError;
      setReferrals(referralsData || []);

    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Load Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase.from('referral_partners').update(formData).eq('id', editingId);
        if (error) throw error;
        toast({ title: "Updated", description: "Partner updated successfully" });
      } else {
        const { error } = await supabase.from('referral_partners').insert([formData]);
        if (error) throw error;
        toast({ title: "Created", description: "Partner created successfully" });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleMarkPaid = async (referralId) => {
      try {
          const { error } = await supabase
            .from('referrals')
            .update({ 
                status: 'paid', 
                paid_at: new Date().toISOString(),
                payment_method: 'Manual Check' // Hardcoded for simplicity now
            })
            .eq('id', referralId);
            
          if(error) throw error;
          
          toast({ title: "Marked Paid", description: "Commission marked as paid." });
          fetchData(); // Refresh list

      } catch (err) {
          toast({ variant: "destructive", title: "Error", description: err.message });
      }
  };

  const resetForm = () => {
      setFormData({
        name: '',
        email: '',
        phone: '',
        commission_rate: 0.10,
        status: 'active'
      });
      setEditingId(null);
  };

  const startEdit = (p) => {
      setFormData(p);
      setEditingId(p.id);
      setIsDialogOpen(true);
  };

  // Metrics Calculation
  const totalCommission = referrals.reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0);
  const paidCommission = referrals.filter(r => r.status === 'paid').reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0);
  const pendingCommission = totalCommission - paidCommission;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Referral Program</h1>
          <p className="text-muted-foreground">Manage partners, track referrals, and handle payouts.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" /> Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Partner' : 'New Referral Partner'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Partner Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Acme Realty" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contact@acme.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(555) 123-4567" />
                  </div>
              </div>
              <div className="space-y-2">
                <Label>Commission Rate (Decimal)</Label>
                <Input type="number" step="0.01" value={formData.commission_rate} onChange={e => setFormData({...formData, commission_rate: parseFloat(e.target.value)})} placeholder="0.10" />
                <p className="text-xs text-muted-foreground">0.10 = 10% commission</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                  <Switch checked={formData.status === 'active'} onCheckedChange={(c) => setFormData({...formData, status: c ? 'active' : 'inactive'})} />
                  <Label>Active Partner</Label>
              </div>
              <Button type="submit" className="w-full mt-4">{editingId ? 'Save Changes' : 'Create Partner'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{referrals.length}</div>
                <p className="text-xs text-muted-foreground">Lifetime referrals sent</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commissions Earned</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalCommission.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Total value generated</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-amber-600">${pendingCommission.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Due for payment</p>
            </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="partners">
        <TabsList>
            <TabsTrigger value="partners">Partner Management</TabsTrigger>
            <TabsTrigger value="referrals">Referral History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="partners" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Active Partners</CardTitle>
                    <CardDescription>Manage your referral network.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Partner Name</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Commission</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                            ) : partners.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No partners found.</TableCell></TableRow>
                            ) : (
                                partners.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">{p.email}</div>
                                            <div className="text-xs text-muted-foreground">{p.phone}</div>
                                        </TableCell>
                                        <TableCell>{(p.commission_rate * 100).toFixed(0)}%</TableCell>
                                        <TableCell>
                                            <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="referrals" className="mt-6">
             <Card>
                <CardHeader>
                    <CardTitle>Commission Tracking</CardTitle>
                    <CardDescription>Monitor referrals and process payments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Partner</TableHead>
                                <TableHead>Job Value</TableHead>
                                <TableHead>Commission</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                            ) : referrals.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No referrals recorded yet.</TableCell></TableRow>
                            ) : (
                                referrals.map(r => (
                                    <TableRow key={r.id}>
                                        <TableCell>{format(new Date(r.created_at), 'MMM d, yyyy')}</TableCell>
                                        <TableCell className="font-medium">{r.referral_partners?.name}</TableCell>
                                        <TableCell>${r.appointments?.pricing_snapshot?.price || 0}</TableCell>
                                        <TableCell className="font-bold text-green-600">${r.commission_amount}</TableCell>
                                        <TableCell>
                                            <Badge variant={r.status === 'paid' ? 'outline' : (r.status === 'earned' ? 'default' : 'secondary')}>
                                                {r.status}
                                            </Badge>
                                            {r.paid_at && <div className="text-xs text-muted-foreground mt-1">Paid {format(new Date(r.paid_at), 'MMM d')}</div>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {r.status === 'earned' && (
                                                <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700" onClick={() => handleMarkPaid(r.id)}>
                                                    <CheckCircle className="w-3 h-3 mr-1" /> Mark Paid
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}