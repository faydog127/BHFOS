import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Search, Loader2, DollarSign, Wrench, CheckCircle2 } from 'lucide-react';

const JobManager = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        const { data, error } = await supabase
            .from('jobs')
            .select(`
                *,
                leads (first_name, last_name, email),
                properties (address1, city)
            `)
            .order('scheduled_start', { ascending: false });
        
        if (!error) setJobs(data);
        setLoading(false);
    };

    const getStatusBadge = (status) => {
        const styles = {
            scheduled: 'bg-blue-100 text-blue-800',
            in_progress: 'bg-amber-100 text-amber-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800'
        };
        return <Badge variant="outline" className={`${styles[status] || 'bg-slate-100'} border-0 uppercase text-xs font-bold`}>{status}</Badge>;
    };

    const getPaymentBadge = (status) => {
        const styles = {
            paid: 'bg-green-100 text-green-800',
            partial: 'bg-yellow-100 text-yellow-800',
            pending: 'bg-slate-100 text-slate-800'
        };
        return <Badge variant="outline" className={`${styles[status] || 'bg-slate-100'} border-0 gap-1`}>
            <DollarSign className="w-3 h-3" /> {status}
        </Badge>;
    };

    const filteredJobs = jobs.filter(j => 
        j.leads?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.leads?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.job_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600"/></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Active Jobs</h2>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input 
                        placeholder="Search jobs..." 
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mb-6">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Scheduled Jobs</CardTitle>
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{jobs.filter(j => j.status === 'scheduled').length}</div>
                    </CardContent>
                 </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed (This Month)</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{jobs.filter(j => j.status === 'completed').length}</div>
                    </CardContent>
                 </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unpaid Balance</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                             ${jobs.filter(j => j.payment_status !== 'paid').reduce((acc, j) => acc + (Number(j.total_amount) || 0), 0).toFixed(0)}
                        </div>
                    </CardContent>
                 </Card>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Job #</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Scheduled Date</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Job Status</TableHead>
                                <TableHead>Payment</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredJobs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No jobs found.</TableCell>
                                </TableRow>
                            ) : (
                                filteredJobs.map((job) => (
                                    <TableRow key={job.id}>
                                        <TableCell className="font-mono">{job.job_number || '---'}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{job.leads?.first_name} {job.leads?.last_name}</div>
                                            <div className="text-xs text-muted-foreground">{job.leads?.email}</div>
                                        </TableCell>
                                        <TableCell>{job.scheduled_start ? format(new Date(job.scheduled_start), 'MMM d, h:mm a') : 'Unscheduled'}</TableCell>
                                        <TableCell>{job.properties?.address1}</TableCell>
                                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                                        <TableCell>{getPaymentBadge(job.payment_status)}</TableCell>
                                        <TableCell className="text-right font-medium">${job.total_amount?.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default JobManager;