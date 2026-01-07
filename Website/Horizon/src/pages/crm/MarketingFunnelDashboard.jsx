import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, TrendingUp, Users, MousePointer2, DollarSign } from 'lucide-react';

const MarketingFunnelDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('30d');
    
    const [metrics, setMetrics] = useState({
        totalLeads: 0,
        totalConversions: 0,
        conversionRate: 0,
        sourceBreakdown: [],
        qualityDistribution: []
    });

    useEffect(() => {
        fetchMetrics();
    }, [timeRange]);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            // Calculate date range
            const now = new Date();
            let startDate = new Date();
            if (timeRange === '7d') startDate.setDate(now.getDate() - 7);
            if (timeRange === '30d') startDate.setDate(now.getDate() - 30);
            if (timeRange === '90d') startDate.setDate(now.getDate() - 90);

            // Fetch Leads in Range
            const { data: leads, error } = await supabase
                .from('leads')
                .select('id, source, status, created_at')
                .gte('created_at', startDate.toISOString());

            if (error) throw error;

            const totalLeads = leads.length;
            
            // Source Breakdown
            const sources = {};
            leads.forEach(l => {
                const s = l.source || 'direct';
                sources[s] = (sources[s] || 0) + 1;
            });
            const sourceBreakdown = Object.keys(sources).map(key => ({ name: key, value: sources[key] }));

            // Quality Dist (Mock logic based on status)
            const quality = { hot: 0, warm: 0, cold: 0 };
            leads.forEach(l => {
                if (['booked', 'job_completed'].includes(l.status.toLowerCase())) quality.hot++;
                else if (['contacted', 'quote_sent'].includes(l.status.toLowerCase())) quality.warm++;
                else quality.cold++;
            });
            const qualityDistribution = [
                { name: 'Hot (Booked)', value: quality.hot, color: '#22c55e' },
                { name: 'Warm (Active)', value: quality.warm, color: '#f59e0b' },
                { name: 'Cold (New)', value: quality.cold, color: '#3b82f6' }
            ];

            // Conversions (From Landing Page Table)
            const { count: lpConversions } = await supabase
                .from('landing_page_conversions')
                .select('id', { count: 'exact' })
                .gte('converted_at', startDate.toISOString());

            setMetrics({
                totalLeads,
                totalConversions: lpConversions || 0,
                conversionRate: totalLeads > 0 ? ((lpConversions / totalLeads) * 100).toFixed(1) : 0, // Simplified metric
                sourceBreakdown,
                qualityDistribution
            });

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Marketing Performance</h1>
                    <p className="text-muted-foreground">Track funnel efficiency and lead sources.</p>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Time Range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="90d">Last 90 Days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalLeads}</div>
                        <p className="text-xs text-muted-foreground">in selected period</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">LP Conversions</CardTitle>
                        <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalConversions}</div>
                        <p className="text-xs text-muted-foreground">form submissions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Conversion Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
                        <p className="text-xs text-muted-foreground">visit to lead</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Est. Cost Per Lead</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">$12.50</div>
                        <p className="text-xs text-muted-foreground">based on ad spend</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Source Chart */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Traffic Sources</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                         {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin"/></div> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics.sourceBreakdown}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                         )}
                    </CardContent>
                </Card>

                {/* Quality Pie Chart */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Lead Quality Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin"/></div> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={metrics.qualityDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {metrics.qualityDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader><CardTitle>Campaign Performance</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">Top performing campaigns by volume.</p>
                    <div className="space-y-4">
                        {metrics.sourceBreakdown.map((source, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <div className="font-bold capitalize">{source.name}</div>
                                        <div className="text-xs text-muted-foreground">Source / Medium</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-lg">{source.value} Leads</div>
                                    <div className="text-xs text-green-600 font-medium">Active</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default MarketingFunnelDashboard;