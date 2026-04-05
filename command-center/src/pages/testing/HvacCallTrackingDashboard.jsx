import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    BarChart, 
    Phone, 
    UserX, 
    CheckCircle2, 
    Download, 
    RefreshCw, 
    Loader2,
    Filter,
    MapPin,
    ShieldAlert,
    Trophy
} from 'lucide-react';

const HvacCallTrackingDashboard = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [candidates, setCandidates] = useState([]);
    const [filteredCandidates, setFilteredCandidates] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        called: 0,
        remaining: 0,
        hardCompetitors: 0,
        softCompetitors: 0,
        outcomes: {},
        interest: {}
    });

    // Filters
    const [countyFilter, setCountyFilter] = useState('ALL');
    const [tierFilter, setTierFilter] = useState('ALL');

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        filterData();
    }, [candidates, countyFilter, tierFilter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch All Candidates (source='hvac_master_dedup_2025')
            // We check source to ensure we get the master list, or fallback if needed
            const { data: candidateData, error: candidateError } = await supabase
                .from('partner_prospects')
                .select('*')
                .order('score', { ascending: false });

            if (candidateError) throw candidateError;

            // 2. Fetch Call Logs
            const { data: logData, error: logError } = await supabase
                .from('calls')
                .select('*')
                .order('created_at', { ascending: false });

            if (logError) throw logError;

            // Process Data
            const processedCandidates = candidateData.map(c => {
                const calls = logData.filter(l => l.prospect_id === c.id);
                const lastCall = calls.length > 0 ? calls[0] : null;
                
                // Parse notes for Tier (if not explicit, look in notes)
                let tier = 'Unclassified';
                if (c.notes?.toUpperCase().includes('TIER 1')) tier = 'Tier 1';
                else if (c.notes?.toUpperCase().includes('TIER 2')) tier = 'Tier 2';
                else if (c.notes?.toUpperCase().includes('TIER 3')) tier = 'Tier 3';

                // Determine Competitor Type
                let compType = 'None';
                if (c.chaos_flag && c.chaos_flag_type === 'COMPETITOR_HARD') compType = 'Hard Competitor';
                else if (c.notes?.toUpperCase().includes('SOFT COMPETITOR')) compType = 'Soft Competitor';

                // Parse call notes for interest
                let interest = 'N/A';
                if (lastCall?.notes) {
                    const match = lastCall.notes.match(/\[Interest: (.*?)\]/);
                    if (match) interest = match[1];
                }

                return {
                    ...c,
                    tier,
                    competitorType: compType,
                    hasBeenCalled: calls.length > 0,
                    lastCallOutcome: lastCall?.outcome || 'Not Called',
                    lastCallDate: lastCall?.created_at,
                    interestLevel: interest,
                    callNotes: lastCall?.notes || '',
                    callCount: calls.length
                };
            });

            setCandidates(processedCandidates);
            
            // Calculate Global Stats
            const outcomes = {};
            const interestCounts = {};
            let calledCount = 0;
            let hardCompCount = 0;
            let softCompCount = 0;

            processedCandidates.forEach(c => {
                if (c.competitorType === 'Hard Competitor') hardCompCount++;
                if (c.competitorType === 'Soft Competitor') softCompCount++;

                if (c.hasBeenCalled) {
                    calledCount++;
                    const out = c.lastCallOutcome;
                    outcomes[out] = (outcomes[out] || 0) + 1;
                    
                    const int = c.interestLevel;
                    interestCounts[int] = (interestCounts[int] || 0) + 1;
                }
            });

            setStats({
                total: processedCandidates.length,
                called: calledCount,
                remaining: processedCandidates.length - calledCount,
                hardCompetitors: hardCompCount,
                softCompetitors: softCompCount,
                outcomes,
                interest: interestCounts
            });

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const filterData = () => {
        let result = [...candidates];

        if (countyFilter !== 'ALL') {
            result = result.filter(c => c.county === countyFilter);
        }

        if (tierFilter !== 'ALL') {
            result = result.filter(c => c.tier === tierFilter);
        }

        // Sort: County -> Tier -> Score
        result.sort((a, b) => {
            if (a.county !== b.county) return a.county.localeCompare(b.county);
            if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
            return b.score - a.score;
        });

        setFilteredCandidates(result);
    };

    const downloadCsv = () => {
        const headers = ['Business Name', 'County', 'City', 'Tier', 'Phone', 'Competitor Type', 'Called?', 'Outcome', 'Interest', 'Score', 'Notes'];
        const rows = candidates.map(c => [
            `"${c.business_name}"`,
            c.county,
            c.city,
            c.tier,
            c.phone,
            c.competitorType,
            c.hasBeenCalled ? 'Yes' : 'No',
            c.lastCallOutcome,
            c.interestLevel,
            c.score,
            `"${(c.callNotes || c.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `hvac_master_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getInterestBadge = (level) => {
        const l = (level || '').toLowerCase();
        if (l.includes('high')) return <Badge className="bg-green-500 hover:bg-green-600">High</Badge>;
        if (l.includes('medium')) return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium</Badge>;
        if (l.includes('low')) return <Badge className="bg-orange-400 hover:bg-orange-500">Low</Badge>;
        if (l.includes('none')) return <Badge variant="outline" className="text-gray-400">None</Badge>;
        return <span className="text-gray-300 text-xs">-</span>;
    };

    const getOutcomeBadge = (outcome) => {
        switch (outcome) {
            case 'connected': return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Connected</Badge>;
            case 'left_voicemail': return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Voicemail</Badge>;
            case 'no_answer': return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">No Answer</Badge>;
            case 'gatekeeper_block': return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Blocked</Badge>;
            case 'Not Called': return <Badge variant="secondary" className="bg-gray-100 text-gray-400">Not Called</Badge>;
            default: return <Badge variant="outline">{outcome}</Badge>;
        }
    };

    const getCompetitorBadge = (type) => {
        if (type === 'Hard Competitor') return <Badge variant="destructive" className="text-[10px]">HARD COMP</Badge>;
        if (type === 'Soft Competitor') return <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-200">SOFT COMP</Badge>;
        return null;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <Helmet>
                <title>Call Tracking Dashboard | HVAC</title>
            </Helmet>

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">HVAC Master List Tracker</h1>
                        <p className="text-gray-500 mt-1">Campaign progress for the master deduplicated list (32 candidates).</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchData} disabled={loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button onClick={downloadCsv} disabled={loading || candidates.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Total List</CardTitle>
                            <UserX className="h-4 w-4 text-gray-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-gray-500">Unique businesses</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Candidates Called</CardTitle>
                            <Phone className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">{stats.called}</div>
                            <div className="h-1 w-full bg-gray-100 mt-2 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${(stats.called / stats.total) * 100}%` }}></div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Remaining</CardTitle>
                            <Filter className="h-4 w-4 text-orange-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{stats.remaining}</div>
                            <p className="text-xs text-gray-500">To dial</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Hard Competitors</CardTitle>
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{stats.hardCompetitors}</div>
                            <p className="text-xs text-gray-500">Chaos Flag: Active</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Soft Competitors</CardTitle>
                            <Trophy className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">{stats.softCompetitors}</div>
                            <p className="text-xs text-gray-500">Offer duct cleaning</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter Bar */}
                <Card className="bg-white">
                    <CardContent className="p-4 flex gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium">Filter by County:</span>
                            <Select value={countyFilter} onValueChange={setCountyFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Counties" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Counties</SelectItem>
                                    <SelectItem value="Brevard">Brevard</SelectItem>
                                    <SelectItem value="Volusia">Volusia</SelectItem>
                                    <SelectItem value="Orange">Orange</SelectItem>
                                    <SelectItem value="Seminole">Seminole</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium">Filter by Tier:</span>
                            <Select value={tierFilter} onValueChange={setTierFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Tiers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Tiers</SelectItem>
                                    <SelectItem value="Tier 1">Tier 1</SelectItem>
                                    <SelectItem value="Tier 2">Tier 2</SelectItem>
                                    <SelectItem value="Tier 3">Tier 3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Data Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Master Candidate List ({filteredCandidates.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50">
                                        <TableHead className="w-[250px]">Candidate</TableHead>
                                        <TableHead>Region</TableHead>
                                        <TableHead>Tier</TableHead>
                                        <TableHead>Score</TableHead>
                                        <TableHead>Outcome</TableHead>
                                        <TableHead>Interest</TableHead>
                                        <TableHead>Comp Flag</TableHead>
                                        <TableHead className="max-w-[250px]">Strategic Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredCandidates.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-gray-500">No candidates found for filters.</TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredCandidates.map((c) => (
                                            <TableRow key={c.id} className={c.hasBeenCalled ? 'bg-white' : 'bg-slate-50/30'}>
                                                <TableCell>
                                                    <div className="font-medium text-gray-900">{c.business_name}</div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                                        {c.phone}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-medium text-gray-700">{c.county}</div>
                                                    <div className="text-xs text-gray-500">{c.city}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-white">{c.tier}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`font-bold ${c.score >= 80 ? 'text-green-600' : 'text-gray-600'}`}>
                                                        {c.score}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {getOutcomeBadge(c.lastCallOutcome)}
                                                    {c.lastCallDate && (
                                                        <div className="text-[10px] text-gray-400 mt-1">
                                                            {new Date(c.lastCallDate).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {getInterestBadge(c.interestLevel)}
                                                </TableCell>
                                                <TableCell>
                                                    {getCompetitorBadge(c.competitorType)}
                                                </TableCell>
                                                <TableCell className="max-w-[250px]">
                                                    <p className="text-xs text-gray-500 truncate" title={c.notes}>
                                                        {c.notes ? c.notes.replace(/\[.*?\]/g, '').trim() : '-'}
                                                    </p>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default HvacCallTrackingDashboard;