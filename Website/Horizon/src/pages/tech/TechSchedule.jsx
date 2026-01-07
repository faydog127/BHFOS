import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { MapPin, Clock, Calendar as CalendarIcon, Phone, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useTrainingMode } from '@/contexts/TrainingModeContext';

const TechSchedule = () => {
    const { user } = useSupabaseAuth();
    const { isTrainingMode } = useTrainingMode();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const fetchJobs = async () => {
            if (!user) return;
            setLoading(true);

            // Fetch tech profile first
            const { data: techData } = await supabase
                .from('technicians')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (!techData) {
                setLoading(false);
                return;
            }

            const start = startOfDay(selectedDate).toISOString();
            const end = endOfDay(selectedDate).toISOString();

            // Construct Query with Mode Filter
            let query = supabase
                .from('jobs')
                .select(`
                    *,
                    leads ( first_name, last_name, phone ),
                    properties ( address1, city, zip )
                `)
                .eq('technician_id', techData.id)
                .gte('scheduled_start', start)
                .lte('scheduled_start', end)
                .order('scheduled_start', { ascending: true });

            // MODE FILTER
            if (isTrainingMode) {
                query = query.eq('is_test_data', true);
            } else {
                query = query.or('is_test_data.is.false,is_test_data.is.null');
            }

            const { data, error } = await query;
            if (error) console.error(error);
            setJobs(data || []);
            setLoading(false);
        };

        fetchJobs();
    }, [user, selectedDate, isTrainingMode]);

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="px-4 py-3 flex justify-between items-center">
                    <h1 className="text-lg font-bold text-slate-900">My Schedule</h1>
                </div>
                
                {/* Date Scroller */}
                <div className="flex overflow-x-auto py-2 px-4 gap-2 border-t bg-slate-50/50">
                    {[-1, 0, 1, 2, 3].map(days => {
                        const date = addDays(new Date(), days);
                        const isSelected = date.toDateString() === selectedDate.toDateString();
                        return (
                            <button
                                key={days}
                                onClick={() => setSelectedDate(date)}
                                className={`flex flex-col items-center min-w-[4.5rem] p-2 rounded-lg border text-sm transition-all ${
                                    isSelected 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                        : 'bg-white text-slate-600 border-slate-200'
                                }`}
                            >
                                <span className="font-bold">{format(date, 'EEE')}</span>
                                <span className="text-xs opacity-90">{format(date, 'MMM d')}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Job List */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-slate-400">Loading schedule...</div>
                ) : jobs.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="bg-white p-6 rounded-full inline-block mb-4 shadow-sm">
                            <CalendarIcon className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-medium">No Jobs Scheduled</h3>
                        <p className="text-slate-500 text-sm mt-1">You're clear for {format(selectedDate, 'MMMM do')}.</p>
                        {isTrainingMode && <p className="text-amber-600 text-xs mt-2 font-medium">Tip: Switch to Live Mode to see real jobs.</p>}
                    </div>
                ) : (
                    jobs.map(job => (
                        <Card key={job.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center text-blue-700 font-bold">
                                        <Clock className="h-4 w-4 mr-1.5" />
                                        {format(new Date(job.scheduled_start), 'h:mm a')}
                                    </div>
                                    <Badge variant="outline" className="bg-slate-50">{job.status}</Badge>
                                </div>
                                
                                <h3 className="text-lg font-bold text-slate-900 mb-1">
                                    {job.leads?.first_name} {job.leads?.last_name}
                                </h3>
                                
                                <div className="space-y-2 text-sm text-slate-600 mb-4">
                                    <div className="flex items-start">
                                        <MapPin className="h-4 w-4 mr-2 mt-0.5 text-slate-400 shrink-0" />
                                        <span>
                                            {job.properties?.address1}<br/>
                                            {job.properties?.city}, {job.properties?.zip}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <Phone className="h-4 w-4 mr-2 text-slate-400" />
                                        <a href={`tel:${job.leads?.phone}`} className="underline decoration-slate-300">
                                            {job.leads?.phone}
                                        </a>
                                    </div>
                                </div>

                                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                                    View Details <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default TechSchedule;