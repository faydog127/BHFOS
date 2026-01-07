import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { jobService } from '@/services/jobService';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { 
  Calendar, CheckCircle2, DollarSign, Clock, 
  MapPin, User, Loader2, PlayCircle, Lock
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Jobs = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(searchParams.get('status') || 'all');
  const [processingId, setProcessingId] = useState(null);
  
  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const tenantId = getTenantId();

  useEffect(() => {
    fetchJobs();
  }, [filter]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          leads (first_name, last_name, phone)
        `)
        .eq('tenant_id', tenantId)
        .order('scheduled_start', { ascending: false });

      // Improved Filtering Logic
      if (filter === 'active') {
        // Active includes all non-terminal states
        query = query.in('status', ['scheduled', 'in_progress', 'en_route', 'pending_schedule', 'on_hold']);
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed');
      } else if (filter === 'unpaid') {
        query = query.eq('payment_status', 'unpaid').eq('status', 'completed');
      } else if (filter !== 'all') {
        // Direct status match or handle CSV
        if (filter.includes(',')) {
            query = query.in('status', filter.split(','));
        } else {
            query = query.eq('status', filter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load jobs.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (jobId, newStatus) => {
    setProcessingId(jobId);
    
    const previousJobs = [...jobs];
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));

    try {
        const { error } = await supabase
            .from('jobs')
            .update({ status: newStatus })
            .eq('id', jobId)
            .eq('tenant_id', tenantId);

        if (error) throw error;

        let desc = `Job moved to ${newStatus}`;
        if (newStatus === 'completed') {
            desc = "Job completed. Invoice generation queued.";
        }

        toast({ title: 'Status Updated', description: desc, className: newStatus === 'completed' ? 'bg-green-50 border-green-200' : '' });
        
        if (newStatus === 'completed') {
             setTimeout(fetchJobs, 1000); 
        }

    } catch (err) {
      setJobs(previousJobs);
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedJob || !paymentAmount) return;
    
    const result = await jobService.recordPayment(selectedJob.id, parseFloat(paymentAmount), 'MANUAL');
    
    if (result.success) {
      toast({ 
        title: 'Payment Recorded', 
        description: 'Job marked as paid. Review request queued.',
        className: 'bg-green-50 border-green-200'
      });
      setPaymentModalOpen(false);
      fetchJobs();
    } else {
      toast({ variant: 'destructive', title: 'Payment Failed', description: result.error });
    }
  };

  const openPaymentModal = (job) => {
    setSelectedJob(job);
    setPaymentAmount(job.total_amount || '');
    setPaymentModalOpen(true);
  };

  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800 animate-pulse';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending_schedule': return 'bg-yellow-100 text-yellow-800';
      case 'on_hold': return 'bg-orange-100 text-orange-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <Helmet><title>Job Management | CRM</title></Helmet>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Job Operations</h1>
          <p className="text-slate-500">Manage schedules, track progress, and collect payments.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild>
                <Link to={`/${tenantId}/crm/schedule`}>
                    <Calendar className="mr-2 h-4 w-4" /> View Schedule
                </Link>
            </Button>
            <Button variant="outline" onClick={fetchJobs}>Refresh Board</Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={filter === 'active' ? 'active' : filter} onValueChange={setFilter} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="active">Active Jobs</TabsTrigger>
          <TabsTrigger value="unpaid">Collections</TabsTrigger>
          <TabsTrigger value="completed">History</TabsTrigger>
          <TabsTrigger value="all">All Jobs</TabsTrigger>
        </TabsList>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              {filter === 'active' ? 'Upcoming & In Progress' : filter === 'unpaid' ? 'Pending Payments' : filter === 'completed' ? 'Job History' : 'All Jobs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Schedule / Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Financials</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No jobs found in this view.</TableCell></TableRow>
                ) : (
                  jobs.map(job => (
                    <TableRow key={job.id} className="group">
                      <TableCell>
                        <div className="font-bold text-slate-900">
                          {job.leads?.first_name} {job.leads?.last_name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {job.leads?.phone || 'No Phone'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {job.scheduled_start ? format(new Date(job.scheduled_start), 'MMM d, h:mm a') : 'Unscheduled'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.service_address || 'No Address'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-mono text-sm">
                          ${job.total_amount?.toLocaleString()}
                        </div>
                        <Badge variant="outline" className={`text-[10px] mt-1 ${job.payment_status?.toLowerCase() === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {job.payment_status || 'unpaid'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {processingId === job.id ? (
                              <Button size="sm" disabled variant="ghost"><Loader2 className="w-4 h-4 animate-spin"/></Button>
                          ) : (
                              <>
                                {(job.status === 'scheduled' || job.status === 'pending_schedule' || job.status === 'on_hold') && (
                                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(job.id, 'in_progress')}>
                                    <PlayCircle className="w-4 h-4 mr-2" /> Start
                                    </Button>
                                )}
                                {job.status === 'in_progress' && (
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleStatusChange(job.id, 'completed')}>
                                    <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                                    </Button>
                                )}
                                {job.status === 'completed' && job.payment_status !== 'paid' && (
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openPaymentModal(job)}>
                                    <DollarSign className="w-4 h-4 mr-1" /> Collect
                                    </Button>
                                )}
                                {job.status === 'completed' && job.payment_status === 'paid' && (
                                    <Button size="sm" variant="ghost" disabled className="text-green-700 opacity-50">
                                        <Lock className="w-3 h-3 mr-1" /> Closed
                                    </Button>
                                )}
                              </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="bg-slate-50 p-4 rounded-lg border">
                <div className="text-sm text-slate-500">Job Total</div>
                <div className="text-2xl font-bold text-slate-900">${selectedJob?.total_amount}</div>
                <div className="text-xs text-slate-400 mt-1">{selectedJob?.service_address}</div>
             </div>
             <div className="space-y-2">
                <Label>Payment Amount</Label>
                <Input 
                  type="number" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                />
             </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePaymentSubmit}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Jobs;