import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Users, DollarSign, Award, Link as LinkIcon, Copy, Plus, 
  TrendingUp, CheckCircle2, UserPlus, Trophy
} from 'lucide-react';
import { format } from 'date-fns';

const ReferralDashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalReferrals: 0,
    activeReferrals: 0,
    totalRevenue: 0,
    paidCommissions: 0
  });
  const [referrals, setReferrals] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      // Fetch Referrals with join on leads (referrer and referee)
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referrer:partner_id (name, email),
          lead:lead_id (first_name, last_name, status, total_value:jobs(total_amount))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process Stats
      const totalRef = data.length;
      const activeRef = data.filter(r => r.status === 'pending' || r.status === 'approved').length;
      const paidComm = data.reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0);
      
      // Calculate revenue from jobs linked to these referrals (approximate via leads)
      // Note: In real app, we'd sum confirmed job value.
      const revenue = data.reduce((sum, r) => {
         const jobValue = r.lead?.total_value?.[0]?.total_amount || 0;
         return sum + Number(jobValue);
      }, 0);

      setStats({
        totalReferrals: totalRef,
        activeReferrals: activeRef,
        totalRevenue: revenue,
        paidCommissions: paidComm
      });
      setReferrals(data);

      // Leaderboard Processing
      const board = {};
      data.forEach(r => {
        const name = r.referrer?.name || 'Unknown';
        if (!board[name]) board[name] = { name, count: 0, revenue: 0 };
        board[name].count++;
        // board[name].revenue += ... (if we tracked revenue per referrer)
      });
      setLeaderboard(Object.values(board).sort((a, b) => b.count - a.count).slice(0, 5));

    } catch (error) {
      console.error('Error:', error);
      toast({ variant: 'destructive', title: 'Data Load Failed', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if(!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
  };

  const generateLink = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('customerId') || 'generic';
    const link = `${window.location.origin}/ref/${id}-${Math.floor(Math.random()*1000)}`;
    setGeneratedLink(link);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-slate-900">Referral Program</h1>
           <p className="text-slate-500 mt-1">Track referrals, commissions, and top partners.</p>
        </div>
        <div className="flex gap-3">
             <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><LinkIcon className="w-4 h-4" /> Generate Link</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Referral Link</DialogTitle>
                </DialogHeader>
                <form onSubmit={generateLink} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Customer ID / Name (Optional)</Label>
                    <Input name="customerId" placeholder="e.g. john-doe" />
                  </div>
                  <Button type="submit" className="w-full">Create Unique Link</Button>
                  {generatedLink && (
                    <div className="mt-4 p-3 bg-slate-100 rounded-md flex items-center justify-between">
                       <code className="text-xs text-slate-700 truncate mr-2">{generatedLink}</code>
                       <Button size="sm" variant="ghost" type="button" onClick={handleCopyLink}><Copy className="w-4 h-4" /></Button>
                    </div>
                  )}
                </form>
              </DialogContent>
             </Dialog>
             <Button className="bg-blue-600 gap-2"><Plus className="w-4 h-4" /> Log Referral</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Referrals</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats.totalReferrals}</h3>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
               <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Pipeline</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats.activeReferrals}</h3>
            </div>
            <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
               <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Referral Revenue</p>
              <h3 className="text-2xl font-bold text-slate-900">${stats.totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
               <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Commissions Paid</p>
              <h3 className="text-2xl font-bold text-slate-900">${stats.paidCommissions.toLocaleString()}</h3>
            </div>
            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
               <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Referrals</CardTitle>
              <CardDescription>Latest referral activity and status tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referred Lead</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">No referrals logged yet.</TableCell>
                    </TableRow>
                  ) : referrals.map(ref => (
                    <TableRow key={ref.id}>
                      <TableCell>
                         <div className="font-medium text-slate-900">{ref.lead?.first_name} {ref.lead?.last_name}</div>
                         <div className="text-xs text-slate-500">{ref.lead?.status || 'Unknown'}</div>
                      </TableCell>
                      <TableCell>{ref.referrer?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant={ref.status === 'paid' ? 'success' : 'secondary'} className={
                          ref.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }>
                          {ref.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(ref.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>${ref.commission_amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar / Leaderboard */}
        <div className="space-y-6">
           <Card className="bg-gradient-to-br from-blue-900 to-slate-900 text-white border-none shadow-xl">
             <CardHeader>
               <div className="flex items-center gap-2">
                 <Trophy className="w-5 h-5 text-yellow-400" />
                 <CardTitle className="text-white">Top Referrers</CardTitle>
               </div>
               <CardDescription className="text-blue-200">Partners bringing in the most business.</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 {leaderboard.length === 0 ? (
                    <div className="text-sm text-blue-300">No data available.</div>
                 ) : leaderboard.map((l, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-lg w-6 text-center text-blue-300">#{i+1}</div>
                        <div>
                           <div className="font-medium text-sm">{l.name}</div>
                           <div className="text-xs text-blue-200">{l.count} Referrals</div>
                        </div>
                      </div>
                      {i === 0 && <Award className="w-5 h-5 text-yellow-400" />}
                   </div>
                 ))}
               </div>
             </CardContent>
           </Card>

           <Card>
             <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
             <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start"><UserPlus className="w-4 h-4 mr-2" /> Invite Partner</Button>
                <Button variant="outline" className="w-full justify-start"><CheckCircle2 className="w-4 h-4 mr-2" /> Approve Pending Commissions</Button>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default ReferralDashboard;