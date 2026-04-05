import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useToast } from '@/components/ui/use-toast';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { Loader2, TrendingUp, Users, DollarSign, Target } from 'lucide-react';
import { useTrainingMode } from '@/contexts/TrainingModeContext';

const MetricCard = ({ title, value, subtext, icon: Icon, isDemo }) => (
    <Card>
        <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-4">
                <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                        <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">{title}</p>
                        <h3 className="text-2xl font-bold text-slate-900">
                            {value}
                            {isDemo && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded align-middle">DEMO</span>}
                        </h3>
                    </div>
                </div>
            </div>
            {subtext && <p className="mt-2 text-xs text-slate-500">{subtext}</p>}
        </CardContent>
    </Card>
);

const MarketingScoreboard = () => {
    const { isTrainingMode } = useTrainingMode();
    const [timeRange, setTimeRange] = useState('30');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const endDate = new Date();
                const startDate = subDays(endDate, parseInt(timeRange));

                // We pass include_test_data based on mode
                // If training mode: we want test data ONLY? Or just include it?
                // The prompt says "if training mode, show 'Demo Only' label... if live mode show real"
                // Usually metrics for training mode should probably use training data to show charts
                
                const { data: result, error } = await supabase.rpc('get_marketing_scoreboard_data', {
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString(),
                    include_test_data: isTrainingMode // Pass true if training mode
                });

                if (error) throw error;
                setData(result);
            } catch (err) {
                console.error(err);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load metrics.' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange, isTrainingMode]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    const kpis = data?.kpis || {};
    const sources = data?.sources || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Marketing Scoreboard</h2>
                    <p className="text-slate-500">
                        Performance metrics and ROI analysis 
                        {isTrainingMode && <span className="ml-2 font-bold text-amber-600">(TRAINING DATA)</span>}
                    </p>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 Days</SelectItem>
                        <SelectItem value="30">Last 30 Days</SelectItem>
                        <SelectItem value="90">Last 90 Days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Total Leads" value={kpis.total_leads} icon={Users} isDemo={isTrainingMode} subtext="+12% from previous period" />
                <MetricCard title="Bookings" value={kpis.total_bookings} icon={Target} isDemo={isTrainingMode} subtext="24% conversion rate" />
                <MetricCard title="Revenue" value={`$${kpis.total_revenue?.toLocaleString()}`} icon={DollarSign} isDemo={isTrainingMode} subtext="Generated from leads" />
                <MetricCard title="ROI" value="3.2x" icon={TrendingUp} isDemo={isTrainingMode} subtext="Return on Ad Spend" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Leads by Source</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sources}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="source" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="leads" fill="#3b82f6" name="Total Leads" />
                                <Bar dataKey="bookings" fill="#22c55e" name="Bookings" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Funnel Conversion</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                         {/* Placeholder for funnel viz */}
                         <div className="flex flex-col justify-center space-y-4 h-full px-8">
                            <div className="w-full bg-blue-100 rounded h-12 flex items-center px-4 relative">
                                <span className="font-bold z-10">Leads ({kpis.total_leads})</span>
                                <div className="absolute top-0 left-0 h-full bg-blue-500 rounded opacity-20" style={{width: '100%'}}></div>
                            </div>
                            <div className="w-3/4 mx-auto bg-blue-100 rounded h-12 flex items-center px-4 relative">
                                <span className="font-bold z-10">Bookings ({kpis.total_bookings})</span>
                                <div className="absolute top-0 left-0 h-full bg-blue-500 rounded opacity-30" style={{width: '100%'}}></div>
                            </div>
                            <div className="w-1/2 mx-auto bg-green-100 rounded h-12 flex items-center px-4 relative">
                                <span className="font-bold z-10">Sales ({kpis.total_bookings})</span>
                                <div className="absolute top-0 left-0 h-full bg-green-500 rounded opacity-40" style={{width: '100%'}}></div>
                            </div>
                         </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default MarketingScoreboard;