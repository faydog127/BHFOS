import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Wrench, CheckCircle, Play, FileText, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TechDashboard = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [user, setUser] = useState(null);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) fetchJobs(user.id);
        };
        init();
    }, []);

    const fetchJobs = async (userId) => {
        setLoading(true);
        // In a real scenario, filter by technician_id = userId and date = today
        // For demo, we fetch all scheduled/in_progress jobs
        const { data, error } = await supabase
            .from('jobs')
            .select(`
                *,
                leads (first_name, last_name, phone, health_risk_flags),
                properties (address1, city, zip, gate_code)
            `)
            .in('status', ['scheduled', 'in_progress'])
            .order('scheduled_start', { ascending: true });

        if (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } else {
            setJobs(data || []);
        }
        setLoading(false);
    };

    const updateJobStatus = async (jobId, newStatus) => {
        try {
            const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId);
            if (error) throw error;
            
            toast({ title: 'Status Updated', description: `Job marked as ${newStatus.replace('_', ' ')}` });
            if (user) fetchJobs(user.id);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
        }
    };

    return (
        <>
            <Helmet><title>Tech Portal | TVG</title></Helmet>
            <div className="min-h-screen bg-gray-100 pb-20">
                <header className="bg-blue-900 text-white p-4 sticky top-0 z-10 shadow-md">
                    <h1 className="text-lg font-bold flex items-center">
                        <Wrench className="mr-2 h-5 w-5" /> Today's Jobs
                    </h1>
                    <p className="text-xs text-blue-200">{new Date().toLocaleDateString()} • {jobs.length} Assignments</p>
                </header>

                <main className="p-4 space-y-4">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Loading assignments...</div>
                    ) : jobs.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-lg shadow">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                            <h3 className="text-lg font-medium">All Caught Up!</h3>
                            <p className="text-gray-500">No active jobs assigned for today.</p>
                        </div>
                    ) : (
                        jobs.map(job => (
                            <Card key={job.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm">
                                <CardHeader className="p-4 pb-2 bg-white">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg font-bold text-gray-900">
                                                {job.leads?.first_name} {job.leads?.last_name}
                                            </CardTitle>
                                            <div className="flex items-center text-sm text-gray-500 mt-1">
                                                <Clock className="h-3 w-3 mr-1" />
                                                {new Date(job.scheduled_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                                {new Date(job.scheduled_end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                        <Badge variant={job.status === 'in_progress' ? 'default' : 'secondary'}>
                                            {job.status === 'in_progress' ? 'Active' : 'Scheduled'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-2">
                                    <div className="space-y-3">
                                        <div className="flex items-start text-sm">
                                            <MapPin className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                                            <div>
                                                <p className="text-gray-800">{job.properties?.address1}</p>
                                                <p className="text-gray-500">{job.properties?.city}, {job.properties?.zip}</p>
                                                {job.properties?.gate_code && (
                                                    <p className="text-xs font-mono bg-gray-100 inline-block px-1 rounded mt-1">Gate: {job.properties.gate_code}</p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {job.leads?.health_risk_flags && Object.keys(job.leads.health_risk_flags).length > 0 && (
                                            <div className="bg-red-50 p-2 rounded border border-red-100 flex items-center text-xs text-red-700">
                                                <AlertTriangle className="h-3 w-3 mr-2" />
                                                <span>Health Risk Alert: Proceed with caution.</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="p-3 bg-gray-50 grid grid-cols-2 gap-2">
                                    {job.status === 'scheduled' ? (
                                        <Button className="w-full col-span-2 bg-blue-600 hover:bg-blue-700" onClick={() => updateJobStatus(job.id, 'in_progress')}>
                                            <Play className="h-4 w-4 mr-2" /> Start Job
                                        </Button>
                                    ) : (
                                        <>
                                            <Button variant="outline" className="w-full" size="sm">
                                                <FileText className="h-3 w-3 mr-1" /> View Quote
                                            </Button>
                                            <Button className="w-full bg-green-600 hover:bg-green-700" size="sm" onClick={() => updateJobStatus(job.id, 'completed')}>
                                                <CheckCircle className="h-3 w-3 mr-1" /> Complete
                                            </Button>
                                        </>
                                    )}
                                </CardFooter>
                            </Card>
                        ))
                    )}
                </main>
            </div>
        </>
    );
};

export default TechDashboard;