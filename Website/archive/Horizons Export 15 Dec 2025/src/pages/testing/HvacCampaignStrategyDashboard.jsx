import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    BarChart, 
    MapPin, 
    ShieldAlert, 
    Trophy, 
    TrendingUp, 
    Users, 
    Phone, 
    Target,
    Activity,
    PieChart,
    ArrowRight,
    Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';

const HvacCampaignStrategyDashboard = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCandidates: 0,
        totalCalls: 0,
        conversionRate: 0,
        avgInterest: 'N/A',
        healthScore: 0,
        healthStatus: 'Neutral'
    });
    const [countyStats, setCountyStats] = useState({});
    const [tierStats, setTierStats] = useState({});
    const [competitorStats, setCompetitorStats] = useState({});
    const [topProspects, setTopProspects] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Candidates
            const { data: candidates, error: candidateError } = await supabase
                .from('partner_prospects')
                .select('*')
                .order('score', { ascending: false });

            if (candidateError) throw candidateError;

            // 2. Fetch Call Logs
            const { data: calls, error: callError } = await supabase
                .from('calls')
                .select('*')
                .order('created_at', { ascending: false });

            if (callError) throw callError;

            processData(candidates, calls);

        } catch (err) {
            console.error('Error fetching strategy data:', err);
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const processData = (candidates, calls) => {
        const candidateMap = new Map(candidates.map(c => [c.id, c]));
        
        // Helper to check if called
        const getCallStatus = (candidateId) => {
            const candidateCalls = calls.filter(call => call.prospect_id === candidateId);
            const isCalled = candidateCalls.length > 0;
            const lastCall = candidateCalls[0];
            const interest = lastCall?.notes?.match(/\[Interest: (.*?)\]/)?.[1] || 'None';
            const isSuccess = ['High', 'Medium'].includes(interest);
            return { isCalled, interest, isSuccess };
        };

        // 1. County Stats
        const counties = ['Brevard', 'Volusia', 'Seminole', 'Orange'];
        const cStats = {};

        counties.forEach(county => {
            const countyCandidates = candidates.filter(c => c.county === county);
            let calledCount = 0;
            let successCount = 0;

            countyCandidates.forEach(c => {
                const { isCalled, isSuccess } = getCallStatus(c.id);
                if (isCalled) calledCount++;
                if (isSuccess) successCount++;
            });

            cStats[county] = {
                total: countyCandidates.length,
                called: calledCount,
                success: successCount,
                successRate: calledCount > 0 ? Math.round((successCount / calledCount) * 100) : 0
            };
        });
        setCountyStats(cStats);

        // 2. Tier Stats
        const tStats = { 'Tier 1': { total: 0, called: 0 }, 'Tier 2': { total: 0, called: 0 }, 'Tier 3': { total: 0, called: 0 } };
        
        candidates.forEach(c => {
            let tier = 'Unclassified';
            if (c.notes?.includes('TIER 1')) tier = 'Tier 1';
            else if (c.notes?.includes('TIER 2')) tier = 'Tier 2';
            else if (c.notes?.includes('TIER 3')) tier = 'Tier 3';

            if (tStats[tier]) {
                tStats[tier].total++;
                if (getCallStatus(c.id).isCalled) tStats[tier].called++;
            }
        });
        setTierStats(tStats);

        // 3. Competitor Stats
        let hardCount = 0;
        let softCount = 0;
        let cleanCount = 0;

        candidates.forEach(c => {
            if (c.chaos_flag && c.chaos_flag_type === 'COMPETITOR_HARD') hardCount++;
            else if (c.notes?.includes('SOFT COMPETITOR')) softCount++;
            else cleanCount++;
        });
        setCompetitorStats({ hard: hardCount, soft: softCount, clean: cleanCount });

        // 4. Top Prospects (Not called yet)
        const uncontacted = candidates.filter(c => !getCallStatus(c.id).isCalled);
        setTopProspects(uncontacted.slice(0, 5));

        // 5. Quick Stats & Health
        const totalCandidates = candidates.length;
        const totalCalled = new Set(calls.map(c => c.prospect_id)).size; // Unique candidates called
        
        let successfulCalls = 0;
        calls.forEach(c => {
             const interest = c.notes?.match(/\[Interest: (.*?)\]/)?.[1] || 'None';
             if (['High', 'Medium'].includes(interest)) successfulCalls++;
        });

        const conversionRate = totalCalled > 0 ? Math.round((successfulCalls / totalCalled) * 100) : 0;
        
        // Health Logic
        let healthScore = 0;
        // +20 points for calling > 10% of list
        if (totalCalled / totalCandidates > 0.1) healthScore += 20;
        if (totalCalled / totalCandidates > 0.3) healthScore += 20;
        // +30 points for conversion rate > 10%
        if (conversionRate > 10) healthScore += 30;
        // +30 points for having > 5 successful calls total
        if (successfulCalls > 5) healthScore += 30;

        let healthStatus = 'Neutral';
        if (healthScore >= 70) healthStatus = 'Excellent';
        else if (healthScore >= 40) healthStatus = 'Good';
        else if (healthScore >= 10) healthStatus = 'Fair';
        else healthStatus = 'Poor';

        setStats({
            totalCandidates,
            totalCalls: calls.length, // Raw call volume
            conversionRate,
            avgInterest: 'N/A', // Simplified for now
            healthScore,
            healthStatus
        });
    };

    const getHealthColor = (status) => {
        switch (status) {
            case 'Excellent': return 'text-green-600 bg-green-50 border-green-200';
            case 'Good': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'Fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'Poor': return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-gray-400" /></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <Helmet>
                <title>Campaign Strategy | HVAC</title>
            </Helmet>

            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Activity className="w-8 h-8 text-blue-600" />
                            Campaign Strategy Center
                        </h1>
                        <p className="text-gray-500 mt-1">Strategic oversight for the Central Florida HVAC partnership drive.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link to="/testing/hvac-call-tracking">View Detailed Logs</Link>
                        </Button>
                        <Button asChild className="bg-blue-600 hover:bg-blue-700">
                            <Link to="/testing/hvac-live-workflow">
                                <Phone className="w-4 h-4 mr-2" />
                                Start Calling
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Quick Stats & Health */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className={`${getHealthColor(stats.healthStatus)} border-l-4`}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-80">Campaign Health</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.healthStatus}</div>
                            <p className="text-xs opacity-70 mt-1">Score: {stats.healthScore}/100</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-gray-500">Total Volume</CardTitle>
                            <Phone className="h-4 w-4 text-gray-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalCalls}</div>
                            <p className="text-xs text-gray-500">Calls Logged</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-gray-500">Conversion Rate</CardTitle>
                            <Target className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                            <p className="text-xs text-gray-500">Interested / Contacted</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-gray-500">List Penetration</CardTitle>
                            <PieChart className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {Math.round(((stats.totalCandidates - topProspects.length) / stats.totalCandidates) * 100) || 0}%
                            </div>
                            <p className="text-xs text-gray-500">Candidates Contacted</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Col: County Breakdown */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-gray-500" />
                                Regional Performance
                            </CardTitle>
                            <CardDescription>Candidate density and success rates by county.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(countyStats).map(([county, data]) => (
                                    <div key={county} className="p-4 rounded-lg border bg-white hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg text-gray-800">{county}</h3>
                                            <Badge variant={data.successRate > 20 ? 'success' : 'secondary'}>
                                                {data.successRate}% Success
                                            </Badge>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm text-gray-500">
                                                <span>Progress</span>
                                                <span>{data.called} / {data.total} Called</span>
                                            </div>
                                            <Progress value={(data.called / data.total) * 100} className="h-2" />
                                            <div className="flex gap-2 mt-2">
                                                <Badge variant="outline" className="text-xs font-normal bg-gray-50">
                                                    {data.success} Interested
                                                </Badge>
                                                <Badge variant="outline" className="text-xs font-normal bg-gray-50">
                                                    {data.total - data.called} Remaining
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right Col: Tier Performance */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-500" />
                                Tier Penetration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {Object.entries(tierStats).map(([tier, data]) => (
                                <div key={tier}>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium text-gray-700">{tier}</span>
                                        <span className="text-sm text-gray-500">{data.called}/{data.total}</span>
                                    </div>
                                    <Progress 
                                        value={data.total > 0 ? (data.called / data.total) * 100 : 0} 
                                        className={`h-2 ${tier === 'Tier 1' ? 'bg-yellow-100' : 'bg-gray-100'}`} 
                                        indicatorClassName={tier === 'Tier 1' ? 'bg-yellow-500' : tier === 'Tier 2' ? 'bg-blue-500' : 'bg-gray-400'}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        {data.total - data.called} candidates remaining
                                    </p>
                                </div>
                            ))}

                            <div className="pt-4 border-t">
                                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-red-500" />
                                    Competitor Landscape
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Hard Competitors</span>
                                        <Badge variant="destructive">{competitorStats.hard}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Soft Competitors (Ducts)</span>
                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">{competitorStats.soft}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Clean Prospects</span>
                                        <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">{competitorStats.clean}</Badge>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom: Top Prospects */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            Top Priority Prospects (Uncalled)
                        </CardTitle>
                        <CardDescription>Highest scoring candidates that haven't been contacted yet.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {topProspects.length > 0 ? (
                                topProspects.map(c => (
                                    <div key={c.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge variant="outline" className="bg-slate-50">{c.score} pts</Badge>
                                            {c.notes?.includes('TIER 1') && <Trophy className="w-3 h-3 text-yellow-500" />}
                                        </div>
                                        <h3 className="font-bold text-gray-900 truncate" title={c.business_name}>{c.business_name}</h3>
                                        <p className="text-xs text-gray-500 mb-3">{c.city}, {c.county}</p>
                                        <Button size="sm" variant="secondary" className="w-full text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors" asChild>
                                            <Link to={`/testing/hvac-live-workflow?candidateId=${c.id}`}>
                                                Call Now <ArrowRight className="w-3 h-3 ml-1" />
                                            </Link>
                                        </Button>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full text-center py-8 text-gray-500">
                                    All high-priority prospects have been called! Great job!
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
};

export default HvacCampaignStrategyDashboard;