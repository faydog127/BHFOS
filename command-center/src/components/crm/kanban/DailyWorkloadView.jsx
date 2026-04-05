import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, parseISO } from 'date-fns';
import { Calendar, Clock, AlertTriangle, User, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DailyWorkloadView = ({ selectedDate = new Date(), onDateChange }) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchDailyJobs = async () => {
            if (!selectedDate) return;
            setLoading(true);
            
            // Query range: start of day to end of day
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);

            try {
                const { data, error } = await supabase
                    .from('jobs')
                    .select(`
                        id, 
                        scheduled_start, 
                        scheduled_end, 
                        estimated_minutes, 
                        status,
                        leads ( first_name, last_name, company ),
                        technicians ( full_name )
                    `)
                    .gte('scheduled_start', start.toISOString())
                    .lte('scheduled_start', end.toISOString())
                    .neq('status', 'cancelled');

                if (error) throw error;
                setJobs(data || []);
            } catch (err) {
                console.error("Error fetching daily workload:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDailyJobs();
    }, [selectedDate]);

    const totalMinutes = jobs.reduce((sum, job) => sum + (job.estimated_minutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // Color Logic: 🟢 <360 (6h), 🟡 360-450 (6-7.5h), 🔴 450-480 (7.5-8h), 🔵 >480 (8h+)
    let indicatorColor = "bg-green-500";
    let statusText = "Light Load";
    let isOverbooked = false;

    if (totalMinutes > 480) {
        indicatorColor = "bg-blue-600";
        statusText = "Overbooked";
        isOverbooked = true;
    } else if (totalMinutes >= 450) {
        indicatorColor = "bg-red-500";
        statusText = "Heavy Load (Max)";
    } else if (totalMinutes >= 360) {
        indicatorColor = "bg-yellow-500";
        statusText = "Moderate Load";
    }

    return (
        <Card className="h-full border-none shadow-none">
            <CardHeader className="pb-2 px-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-500" />
                        Daily Workload
                    </CardTitle>
                    <Input 
                        type="date" 
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => onDateChange(e.target.valueAsDate)}
                        className="w-40 h-8 text-xs"
                    />
                </div>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
                {/* Meter */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-medium text-slate-700">Total: {hours}h {minutes}m</span>
                        <Badge className={cn("text-white border-0", indicatorColor)}>
                            {statusText}
                        </Badge>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className={cn("h-full transition-all duration-500", indicatorColor)} 
                            style={{ width: `${Math.min((totalMinutes / 480) * 100, 100)}%` }}
                        />
                    </div>
                    {isOverbooked && (
                        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-100 animate-pulse">
                            <AlertTriangle className="w-4 h-4" />
                            <span>You are overbooked by {totalMinutes - 480} mins. Consider rescheduling.</span>
                        </div>
                    )}
                </div>

                {/* Job List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {loading ? (
                        <div className="text-center py-4 text-xs text-muted-foreground">Calculating...</div>
                    ) : jobs.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground bg-slate-50 rounded border border-dashed">No jobs scheduled for this day.</div>
                    ) : (
                        jobs.map(job => (
                            <div key={job.id} className="p-3 border rounded-lg bg-white shadow-sm flex flex-col gap-1 text-sm">
                                <div className="flex justify-between font-semibold text-slate-800">
                                    <span className="truncate max-w-[120px]">
                                        {job.leads?.first_name} {job.leads?.last_name || job.leads?.company || 'Unknown'}
                                    </span>
                                    <span className="flex items-center gap-1 text-slate-500 font-normal">
                                        <Clock className="w-3 h-3" /> {job.estimated_minutes}m
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>{format(parseISO(job.scheduled_start), 'h:mm a')}</span>
                                    <span>{job.technicians?.full_name || 'Unassigned'}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default DailyWorkloadView;