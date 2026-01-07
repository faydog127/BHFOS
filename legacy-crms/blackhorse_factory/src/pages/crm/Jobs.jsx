import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
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
  MapPin, User, FileText, Loader2, ArrowRight,
  ThumbsUp, ThumbsDown, AlertTriangle, Send
} from 'lucide-react';

const Jobs = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, completed, unpaid
  
  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Debug/Test Reply Modal
  const [testReplyOpen, setTestReplyOpen] = useState(false);
  const [replyScore, setReplyScore] = useState('');
  const [testJobId, setTestJobId] = useState(null);
  const [simulationLog, setSimulationLog] = useState([]);

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
        .order('scheduled_start', { ascending: false });

      if (filter === 'active') {
        query = query.in('status', ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS']);
      } else if (filter === 'completed') {
        query = query.eq('status', 'COMPLETED');
      } else if (filter === 'unpaid') {
        query = query.eq('payment_status', 'UNPAID');
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
    try {
        if (newStatus === 'COMPLETED') {
            const result = await jobService.completeJob(jobId, 'Manual completion via dashboard');
            if(!result.success) throw new Error(result.error);
             toast({ 
                title: 'Job Completed', 
                description: 'Sentiment Gate triggered. SMS request queued in Marketing Engine.',
                className: 'bg-green-50 border-green-200'
            });
        } else {
             const { error } = await supabase
                .from('jobs')
                .update({ status: newStatus })
                .eq('id', jobId);
             if (error) throw error;
             toast({ title: 'Status Updated', description: `Job moved to ${newStatus}` });
        }
      
      fetchJobs();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedJob || !paymentAmount) return;
    
    const result = await jobService.recordPayment(selectedJob.id, parseFloat(paymentAmount), 'MANUAL');
    
    if (result.success) {
      toast({ 
        title: 'Payment Recorded', 
        description: 'Job marked as paid. Lead updated to WON.',
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
  
  // Simulation for testing the sentiment reply webhook
  const handleSimulateReply = async () => {
      setSimulationLog([]);
      try {
          const { data, error } = await supabase.functions.invoke('sentiment-gate', {
              body: {
                  action: 'PROCESS_REPLY',
                  jobId: testJobId,
                  messageBody: replyScore.toString(),
                  fromNumber: '+15555555555' // Simulated
              }
          });
          
          if(error) throw new Error(error.message);
          if(data && data.error) throw new Error(data.error);
          
          setSimulationLog(data.actions_taken || []);
          toast({ title: "Webhook Processed", description: `Score ${data.score} recorded.` });
          fetchJobs(); // Refresh to show new score
      } catch(e) {
          toast({ variant: "destructive", title: "Simulation Failed", description: e.message });
      }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800 animate-pulse';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
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
        <Button onClick={fetchJobs}>Refresh Board</Button>
      </div>

      <Tabs defaultValue="active" onValueChange={setFilter} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="active">Active Jobs</TabsTrigger>
          <TabsTrigger value="unpaid">Collections</TabsTrigger>
          <TabsTrigger value="completed">History</TabsTrigger>
        </TabsList>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              {filter === 'active' ? 'Upcoming Schedule' : filter === 'unpaid' ? 'Pending Payments' : 'Job History'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Schedule / Location</TableHead>
                  <TableHead>Status</TableHead>
                  {filter === 'completed' && <TableHead>Sentiment</TableHead>}
                  <TableHead>Financials</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No jobs found in this view.</TableCell></TableRow>
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
                          <MapPin className="w-3 h-3" /> {job.service_address}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      
                      {filter === 'completed' && (
                        <TableCell>
                            {job.sentiment_score ? (
                                <Badge variant="outline" className={job.sentiment_score >= 8 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                    {job.sentiment_score >= 8 ? <ThumbsUp className="w-3 h-3 mr-1"/> : <AlertTriangle className="w-3 h-3 mr-1"/>}
                                    Score: {job.sentiment_score}
                                </Badge>
                            ) : (
                                <span className="text-xs text-slate-400 italic">Pending Rating...</span>
                            )}
                        </TableCell>
                      )}

                      <TableCell>
                        <div className="font-mono text-sm">
                          ${job.total_amount?.toLocaleString()}
                        </div>
                        <Badge variant="outline" className={`text-[10px] mt-1 ${job.payment_status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {job.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {job.status === 'SCHEDULED' && (
                            <Button size="sm" variant="outline" onClick={() => handleStatusChange(job.id, 'IN_PROGRESS')}>
                              Start Job
                            </Button>
                          )}
                          {job.status === 'IN_PROGRESS' && (
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleStatusChange(job.id, 'COMPLETED')}>
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                            </Button>
                          )}
                          {job.status === 'COMPLETED' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50" 
                                onClick={() => { setTestJobId(job.id); setSimulationLog([]); setTestReplyOpen(true); }}
                              >
                                  Test Reply
                              </Button>
                          )}
                          {job.status === 'COMPLETED' && job.payment_status !== 'PAID' && (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openPaymentModal(job)}>
                              <DollarSign className="w-4 h-4 mr-1" /> Collect
                            </Button>
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
      
      {/* Test SMS Reply Modal - For Development Testing */}
      <Dialog open={testReplyOpen} onOpenChange={setTestReplyOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Simulate Incoming SMS</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 border border-blue-200">
                    This simulates a real webhook from Twilio. Sending "10" triggers the promoter flow. "1-7" triggers the Red Flag flow.
                </div>
                <div className="space-y-2">
                    <Label>Customer Reply Message</Label>
                    <div className="flex gap-2">
                        <Input placeholder="e.g. 10" value={replyScore} onChange={e => setReplyScore(e.target.value)} />
                        <Button onClick={handleSimulateReply}><Send className="w-4 h-4 mr-2" /> Send</Button>
                    </div>
                </div>

                {simulationLog.length > 0 && (
                    <div className="mt-4 border rounded-md p-3 bg-slate-50">
                        <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">System Actions Triggered:</h4>
                        <ul className="space-y-1">
                            {simulationLog.map((log, idx) => (
                                <li key={idx} className="text-xs flex items-center gap-2 text-slate-600">
                                    <CheckCircle2 className="w-3 h-3 text-green-500" /> {log}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Jobs;