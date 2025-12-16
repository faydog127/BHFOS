import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Phone, ShieldAlert, MapPin, Trophy, Check, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HvacVerticalTestRunner = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [candidates, setCandidates] = useState([]);
    const [groupedCandidates, setGroupedCandidates] = useState({});

    useEffect(() => {
        fetchCandidates();
    }, []);

    const fetchCandidates = async () => {
        setLoading(true);
        try {
            // Fetch all deduplicated candidates
            const { data, error } = await supabase
                .from('partner_prospects')
                .select('*')
                .eq('source', 'hvac_master_dedup_2025') // Explicitly filter for the verified list
                .order('score', { ascending: false });

            if (error) throw error;

            // Process & Group
            const processed = data.map(c => {
                // Tier extraction logic
                let tier = 'Unclassified';
                if (c.notes?.includes('TIER 1')) tier = 'Tier 1';
                else if (c.notes?.includes('TIER 2')) tier = 'Tier 2';
                else if (c.notes?.includes('TIER 3')) tier = 'Tier 3';

                // Competitor Flag
                let isHardComp = c.chaos_flag && c.chaos_flag_type === 'COMPETITOR_HARD';
                let isSoftComp = c.notes?.includes('SOFT COMPETITOR');

                return { ...c, tier, isHardComp, isSoftComp };
            });

            setCandidates(processed);

            // Group by County -> Tier
            const grouped = processed.reduce((acc, curr) => {
                const county = curr.county || 'Unknown';
                if (!acc[county]) acc[county] = {};
                if (!acc[county][curr.tier]) acc[county][curr.tier] = [];
                acc[county][curr.tier].push(curr);
                return acc;
            }, {});

            setGroupedCandidates(grouped);

        } catch (err) {
            console.error('Error loading candidates:', err);
            toast({ variant: 'destructive', title: 'Failed to load candidates', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const startCallWorkflow = (id) => {
        navigate(`/testing/hvac-live-workflow?candidateId=${id}`);
    };

    // Helper to render a single candidate card
    const CandidateCard = ({ candidate }) => (
        <Card className={`hover:shadow-md transition-all border-l-4 ${
            candidate.isHardComp ? 'border-l-red-500 bg-red-50/30' : 
            candidate.isSoftComp ? 'border-l-yellow-400 bg-yellow-50/30' : 
            'border-l-blue-500'
        }`}>
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h4 className="font-bold text-gray-900">{candidate.business_name}</h4>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {candidate.city}
                        </div>
                    </div>
                    <Badge variant={candidate.score >= 80 ? 'default' : 'secondary'} className="text-xs">
                        Score: {candidate.score}
                    </Badge>
                </div>
                
                <div className="flex flex-wrap gap-1 mb-3">
                    {candidate.isHardComp && <Badge variant="destructive" className="text-[10px] px-1 py-0">HARD COMP</Badge>}
                    {candidate.isSoftComp && <Badge variant="outline" className="text-[10px] px-1 py-0 bg-yellow-100 text-yellow-800 border-yellow-300">SOFT COMP</Badge>}
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{candidate.service_type}</Badge>
                </div>

                <p className="text-xs text-gray-500 line-clamp-2 mb-4 italic bg-slate-50 p-2 rounded border border-slate-100">
                    "{candidate.notes?.replace(/\[.*?\]/g, '').trim()}"
                </p>

                <Button size="sm" className="w-full text-xs h-8" onClick={() => startCallWorkflow(candidate.id)}>
                    <Phone className="w-3 h-3 mr-2" />
                    Start Call
                </Button>
            </CardContent>
        </Card>
    );

    // Order counties specifically for logical flow
    const countyOrder = ['Brevard', 'Volusia', 'Seminole', 'Orange', 'Unknown'];
    const tierOrder = ['Tier 1', 'Tier 2', 'Tier 3', 'Unclassified'];

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <Helmet>
                <title>HVAC Data Runner | Testing</title>
            </Helmet>

            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Master Candidate Runner</h1>
                        <p className="text-gray-500">Interactive view of all {candidates.length} deduplicated prospects.</p>
                    </div>
                    <div className="flex gap-2">
                         <Button variant="outline" onClick={fetchCandidates}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button onClick={() => navigate('/testing/hvac-call-tracking')}>
                            View Dashboard Stats
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {countyOrder.filter(county => groupedCandidates[county]).map(county => (
                            <div key={county} className="space-y-4">
                                <div className="flex items-center gap-2 border-b pb-2 border-gray-200">
                                    <MapPin className="w-5 h-5 text-gray-400" />
                                    <h2 className="text-2xl font-bold text-gray-800">{county} County</h2>
                                    <Badge variant="secondary" className="ml-2">{
                                        Object.values(groupedCandidates[county] || {}).reduce((acc, arr) => acc + arr.length, 0)
                                    } Candidates</Badge>
                                </div>

                                {tierOrder.filter(tier => groupedCandidates[county][tier]).map(tier => (
                                    <div key={`${county}-${tier}`} className="pl-4">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Trophy className="w-3 h-3" /> {tier}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {groupedCandidates[county][tier].map(candidate => (
                                                <CandidateCard key={candidate.id} candidate={candidate} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HvacVerticalTestRunner;