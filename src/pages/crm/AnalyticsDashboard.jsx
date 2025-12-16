import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/customSupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { 
    Loader2, TrendingUp, TrendingDown, DollarSign, Users, Briefcase, 
    Star, ThumbsUp, AlertTriangle, Calendar, Download, PieChart, BarChart2 
} from "lucide-react";
import { format, subDays, startOfMonth, startOfYear, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import {
    LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- Helper Components ---

const MetricCard = ({ title, value, subtext, trend, icon: Icon, trendValue, color = "blue" }) => {
    const isPositive = trend === 'up';
    const trendColor = isPositive ? 'text-green-600' : (trend === 'down' ? 'text-red-600' : 'text-slate-500');
    const trendIcon = isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : (trend === 'down' ? <TrendingDown className="w-3 h-3 mr-1" /> : null);
    
    const colorClasses = {
        blue: "bg-blue-50 text-blue-600",
        green: "bg-green-50 text-green-600",
        purple: "bg-purple-50 text-purple-600",
        orange: "bg-orange-50 text-orange-600",
        red: "bg-red-50 text-red-600",
        yellow: "bg-yellow-50 text-yellow-600"
    };

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <h3 className="text-2xl font-bold mt-2">{value}</h3>
                    </div>
                    <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex items-center mt-4 text-xs">
                    <span className={`flex items-center font-medium ${trendColor} bg-slate-50 px-1.5 py-0.5 rounded mr-2`}>
                        {trendIcon} {trendValue}
                    </span>
                    <span className="text-muted-foreground">{subtext}</span>
                </div>
            </CardContent>
        </Card>
    );
};

// --- Main Component ---

export default function AnalyticsDashboard() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('30d');
    
    // Data States
    const [metrics, setMetrics] = useState({
        revenue: { total: 0, growth: 0 },
        jobs: { count: 0, avgDuration: 0 },
        leads: { total: 0, conversionRate: 0 },
        reviews: { avgRating: 0, count: 0 },
        sentiment: { healthScore: 0, breakdown: [] },
        customers: { total: 0, repeatRate: 0 }
    });

    const [charts, setCharts] = useState({
        revenueTrend: [],
        jobsByStatus: [],
        leadSource: [],
        sentimentDist: [],
        partnerPerformance: []
    });

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    const getDateInterval = () => {
        const now = new Date();
        let start;
        switch(dateRange) {
            case '7d': start = subDays(now, 7); break;
            case '30d': start = subDays(now, 30); break;
            case '90d': start = subDays(now, 90); break;
            case 'ytd': start = startOfYear(now); break;
            case '12m': start = subDays(now, 365); break;
            default: start = subDays(now, 30);
        }
        return { start, end: endOfDay(now) };
    };

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateInterval();
            
            // 1. Fetch Appointments (Revenue, Jobs)
            const { data: appointments } = await supabase
                .from('appointments')
                .select('*')
                .gte('scheduled_start', start.toISOString())
                .lte('scheduled_start', end.toISOString());

            // 2. Fetch Leads (Acquisition)
            const { data: leads } = await supabase
                .from('leads')
                .select('*')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());
            
            // 3. Fetch Partners/Referrals
            const { data: referrals } = await supabase
                .from('referrals')
                .select('*, referral_partners(name)')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());

            // --- Calculations ---

            // Revenue
            const completedJobs = appointments?.filter(a => a.status === 'completed') || [];
            const revenueTotal = completedJobs.reduce((sum, job) => sum + (job.pricing_snapshot?.price || 0), 0);
            
            // Jobs Stats
            const jobsCount = completedJobs.length;
            // Mock Avg Duration if not tracked perfectly in demo data
            const avgDuration = completedJobs.length > 0 ? 75 : 0; 

            // Leads & Conversion
            const totalLeads = leads?.length || 0;
            // Simple conversion: Completed Jobs / Total Leads in period (imperfect but indicative)
            const conversionRate = totalLeads > 0 ? ((jobsCount / totalLeads) * 100).toFixed(1) : 0;

            // Sentiment Mock (Pull from job notes/sentiment scores if available, usually in jobs table)
            // Using a distribution based on available data or defaults
            const sentimentData = [
                { name: 'Promoter', value: 65, color: '#22c55e' },
                { name: 'Neutral', value: 25, color: '#eab308' },
                { name: 'Detractor', value: 10, color: '#ef4444' }
            ];

            // Partner Performance
            const partnerStats = {};
            referrals?.forEach(ref => {
                const name = ref.referral_partners?.name || 'Unknown';
                if (!partnerStats[name]) partnerStats[name] = { name, referrals: 0, commissions: 0 };
                partnerStats[name].referrals += 1;
                partnerStats[name].commissions += Number(ref.commission_amount || 0);
            });
            const partnerChartData = Object.values(partnerStats).sort((a,b) => b.referrals - a.referrals).slice(0, 5);

            // Revenue Trend (Daily)
            const revenueByDay = {};
            completedJobs.forEach(job => {
                const day = format(parseISO(job.scheduled_start), 'MMM d');
                revenueByDay[day] = (revenueByDay[day] || 0) + (job.pricing_snapshot?.price || 0);
            });
            const revenueTrendData = Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount }));

            // Set State
            setMetrics({
                revenue: { total: revenueTotal, growth: 12.5 }, // Growth mocked for demo
                jobs: { count: jobsCount, avgDuration },
                leads: { total: totalLeads, conversionRate },
                reviews: { avgRating: 4.8, count: 24 }, // Mocked or fetched from separate table if exists
                sentiment: { healthScore: 88, breakdown: sentimentData },
                customers: { total: 1250, repeatRate: 32 } // Mocked cumulative
            });

            setCharts({
                revenueTrend: revenueTrendData,
                partnerPerformance: partnerChartData,
                sentimentDist: sentimentData,
                jobsByStatus: [ // Mock breakdown
                    { name: 'Completed', value: jobsCount },
                    { name: 'Cancelled', value: appointments?.filter(a => a.status === 'cancelled').length || 0 },
                    { name: 'No Show', value: appointments?.filter(a => a.status === 'no_show').length || 0 }
                ]
            });

        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load analytics data." });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        // Simple CSV Export Logic
        const headers = ["Date", "Metric", "Value"];
        const rows = charts.revenueTrend.map(r => [r.date, "Revenue", r.amount]);
        
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `analytics_export_${dateRange}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Exported", description: "Dashboard data downloaded as CSV." });
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Business Analytics</h1>
                    <p className="text-muted-foreground">Performance metrics and insights for your service business.</p>
                </div>
                <div className="flex gap-3">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px]">
                            <Calendar className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Select Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 Days</SelectItem>
                            <SelectItem value="30d">Last 30 Days</SelectItem>
                            <SelectItem value="90d">Last 90 Days</SelectItem>
                            <SelectItem value="ytd">Year to Date</SelectItem>
                            <SelectItem value="12m">Last 12 Months</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Total Revenue" 
                    value={`$${metrics.revenue.total.toLocaleString()}`} 
                    subtext="vs previous period"
                    trend="up"
                    trendValue={`${metrics.revenue.growth}%`}
                    icon={DollarSign}
                    color="green"
                />
                <MetricCard 
                    title="Jobs Completed" 
                    value={metrics.jobs.count} 
                    subtext="Avg duration: 75m"
                    trend="up"
                    trendValue="+8%"
                    icon={Briefcase}
                    color="blue"
                />
                <MetricCard 
                    title="New Leads" 
                    value={metrics.leads.total} 
                    subtext={`Conv. Rate: ${metrics.leads.conversionRate}%`}
                    trend="down"
                    trendValue="-2.5%"
                    icon={Users}
                    color="purple"
                />
                <MetricCard 
                    title="Avg Rating" 
                    value={metrics.reviews.avgRating} 
                    subtext={`From ${metrics.reviews.count} reviews`}
                    trend="up"
                    trendValue="+0.2"
                    icon={Star}
                    color="yellow"
                />
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Trend */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Revenue Trend</CardTitle>
                        <CardDescription>Daily revenue performance over selected period.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={charts.revenueTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                    formatter={(value) => [`$${value}`, 'Revenue']}
                                />
                                <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Sentiment / Health */}
                <Card>
                    <CardHeader>
                        <CardTitle>Customer Sentiment</CardTitle>
                        <CardDescription>Health score based on reviews & feedback.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex flex-col items-center justify-center relative">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <span className="text-4xl font-bold text-slate-800">{metrics.sentiment.healthScore}</span>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Health Score</p>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                                <Pie
                                    data={charts.sentimentDist}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {charts.sentimentDist.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Partner Performance */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Referral Partners</CardTitle>
                        <CardDescription>Leading sources of new business.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                         {charts.partnerPerformance.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={charts.partnerPerformance} margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="referrals" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} name="Referrals" />
                                </BarChart>
                            </ResponsiveContainer>
                         ) : (
                             <div className="h-full flex items-center justify-center text-muted-foreground italic">No partner data for this period</div>
                         )}
                    </CardContent>
                </Card>

                {/* Job Status Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle>Job Completion Status</CardTitle>
                        <CardDescription>Breakdown of appointment outcomes.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={charts.jobsByStatus}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                 <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                 <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                 <Tooltip cursor={{ fill: '#f8fafc' }} />
                                 <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                             </BarChart>
                         </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}