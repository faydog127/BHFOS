import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Phone, 
    ArrowLeft, 
    ArrowRight, 
    Save, 
    ShieldAlert, 
    MapPin, 
    Building, 
    Trophy, 
    Filter,
    Loader2,
    SkipForward,
    SkipBack,
    AlertOctagon,
    CheckCircle2
} from 'lucide-react';

const HvacLiveTestWorkflow = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const initialCandidateId = searchParams.get('candidateId');

    // Data State
    const [allCandidates, setAllCandidates] = useState([]);
    const [filteredCandidates, setFilteredCandidates] = useState([]);
    const [currentCandidate, setCurrentCandidate] = useState(null);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [countyFilter, setCountyFilter] = useState('ALL');
    const [tierFilter, setTierFilter] = useState('ALL');
    const [compFilter, setCompFilter] = useState('ALL');

    // Form State
    const [callNotes, setCallNotes] = useState('');
    const [callOutcome, setCallOutcome] = useState('connected');
    const [interestLevel, setInterestLevel] = useState('Medium');
    const [chaosFlagTriggered, setChaosFlagTriggered] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchCandidates();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [allCandidates, countyFilter, tierFilter, compFilter]);

    useEffect(() => {
        if (filteredCandidates.length > 0) {
            // If we have an initial ID and it exists in our filtered list, select it
            // Otherwise select the first one in the filtered list
            if (initialCandidateId) {
                const found = filteredCandidates.find(c => c.id === initialCandidateId);
                if (found) {
                    setCurrentCandidate(found);
                    return;
                }
            }
            // If no current candidate or current one is filtered out, select first valid one
            if (!currentCandidate || !filteredCandidates.find(c => c.id === currentCandidate.id)) {
                setCurrentCandidate(filteredCandidates[0]);
            }
        } else {
            setCurrentCandidate(null);
        }
    }, [filteredCandidates, initialCandidateId]);

    // Reset form when candidate changes
    useEffect(() => {
        if (currentCandidate) {
            setCallNotes('');
            setCallOutcome('connected');
            setInterestLevel('Medium');
            setChaosFlagTriggered(false);
        }
    }, [currentCandidate]);

    const fetchCandidates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('partner_prospects')
                .select('*')
                .order('score', { ascending: false });

            if (error) throw error;

            // Pre-process tags
            const processed = data.map(c => {
                // Helper: Determine Tier
                let tier = 'Unclassified';
                if (c.notes?.includes('TIER 1')) tier = 'Tier 1';
                else if (c.notes?.includes('TIER 2')) tier = 'Tier 2';
                else if (c.notes?.includes('TIER 3')) tier = 'Tier 3';

                // Helper: Determine Competitor Status
                let compStatus = 'Clean';
                if (c.chaos_flag && c.chaos_flag_type === 'COMPETITOR_HARD') compStatus = 'Hard';
                else if (c.notes?.includes('SOFT COMPETITOR')) compStatus = 'Soft';

                return { ...c, tier, compStatus };
            });

            setAllCandidates(processed);
        } catch (err) {
            console.error("Error fetching candidates:", err);
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = [...allCandidates];

        // 1. County Filter
        if (countyFilter !== 'ALL') {
            result = result.filter(c => c.county === countyFilter);
        }

        // 2. Tier Filter
        if (tierFilter !== 'ALL') {
            result = result.filter(c => c.tier === tierFilter);
        }

        // 3. Competitor Filter
        if (compFilter === 'Hard') {
            result = result.filter(c => c.compStatus === 'Hard');
        } else if (compFilter === 'Soft') {
            result = result.filter(c => c.compStatus === 'Soft');
        } else if (compFilter === 'Clean') {
            result = result.filter(c => c.compStatus === 'Clean');
        }

        setFilteredCandidates(result);
    };

    // Navigation Logic
    const currentIndex = currentCandidate ? filteredCandidates.findIndex(c => c.id === currentCandidate.id) : -1;
    const totalFiltered = filteredCandidates.length;

    const handleNext = () => {
        if (currentIndex < totalFiltered - 1) {
            setCurrentCandidate(filteredCandidates[currentIndex + 1]);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentCandidate(filteredCandidates[currentIndex - 1]);
        }
    };

    const handleJumpTo = (id) => {
        const target = filteredCandidates.find(c => c.id === id);
        if (target) setCurrentCandidate(target);
    };

    const saveCallLog = async () => {
        if (!currentCandidate) return;
        setIsSaving(true);

        try {
            // 1. Log Call
            const { error: callError } = await supabase.from('calls').insert({
                prospect_id: currentCandidate.id,
                outcome: callOutcome,
                notes: `[Interest: ${interestLevel}] ${callNotes}`,
                call_duration: 0, // placeholder
                created_at: new Date().toISOString()
            });

            if (callError) throw callError;

            // 2. Update Prospect Status if chaos flag triggered manually
            if (chaosFlagTriggered && !currentCandidate.chaos_flag) {
                await supabase.from('partner_prospects').update({
                    chaos_flag: true,
                    chaos_flag_type: 'MANUAL_DURING_CALL',
                    notes: `${currentCandidate.notes} [CHAOS FLAGGED: ${new Date().toISOString()}]`
                }).eq('id', currentCandidate.id);
                
                // Optimistically update local state
                currentCandidate.chaos_flag = true;
                toast({ title: "Chaos Flag Set", description: "Partner marked as high risk." });
            }

            toast({ title: "Call Logged", description: "Results saved successfully." });
            
            // Move to next automatically
            if (currentIndex < totalFiltered - 1) {
                handleNext();
            }

        } catch (err) {
            console.error('Error saving call:', err);
            toast({ variant: 'destructive', title: 'Failed to save', description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const getScript = () => {
        if (!currentCandidate) return null;

        if (currentCandidate.compStatus === 'Hard') {
            return (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                    <div className="flex items-center gap-2 font-bold mb-2">
                        <AlertOctagon className="w-5 h-5" />
                        STOP: HARD COMPETITOR
                    </div>
                    <p className="text-sm">
                        This prospect is a direct competitor or private equity aggregator. 
                        <strong> Do NOT proceed with standard partnership pitch.</strong>
                    </p>
                    <p className="text-sm mt-2">
                        <strong>Protocol:</strong> Be polite, ask if they handle sub-contracting for overflow work, and end call. 
                        Do not reveal sensitive pricing or partnership details.
                    </p>
                </div>
            );
        }

        if (currentCandidate.compStatus === 'Soft') {
            return (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                    <div className="flex items-center gap-2 font-bold mb-2">
                        <ShieldAlert className="w-5 h-5" />
                        CAUTION: OFFERS DUCT CLEANING
                    </div>
                    <p className="text-sm">
                        This prospect lists duct cleaning on their website. They may view us as competition unless positioned correctly.
                    </p>
                    <div className="mt-3 text-sm bg-white p-3 rounded border border-yellow-100">
                        <strong>Script Adjustment:</strong><br/>
                        "I noticed you offer duct cleaning. We specialize in the complex remediation jobs—mold, fire damage, and inaccessible ducts—that most HVAC crews hate doing because it ties up their techs for too long. Do you guys handle full remediation in-house, or would you prefer to sub those headaches out?"
                    </div>
                </div>
            );
        }

        // Clean / Default
        return (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                <div className="flex items-center gap-2 font-bold mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Standard Partnership Pitch
                </div>
                <div className="space-y-3 text-sm">
                    <p><strong>Opener:</strong> "Hi, this is [Name] with The Vents Group. We're the guys who handle the nasty ductwork jobs so your techs can stick to changing out units. Are you the right person to speak with about sub-contracting?"</p>
                    <p><strong>Value Prop:</strong> "We don't do AC repairs. We don't sell units. We strictly fix the air distribution side. You keep the customer, we fix the ducts, and you get a referral fee."</p>
                    <p><strong>The Ask:</strong> "Do you have any jobs right now where the ducts are a disaster but you don't have the manpower to tear them out?"</p>
                </div>
            </div>
        );
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-gray-400" /></div>;

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 pb-32">
            <Helmet>
                <title>Live Call Workflow | Testing</title>
            </Helmet>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT COLUMN: Controls & List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/testing/hvac-runner')}>
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Runner
                        </Button>
                    </div>

                    {/* Filters Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Filter List
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">County</label>
                                <Select value={countyFilter} onValueChange={setCountyFilter}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Counties</SelectItem>
                                        <SelectItem value="Brevard">Brevard</SelectItem>
                                        <SelectItem value="Volusia">Volusia</SelectItem>
                                        <SelectItem value="Seminole">Seminole</SelectItem>
                                        <SelectItem value="Orange">Orange</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Tier</label>
                                <Select value={tierFilter} onValueChange={setTierFilter}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Tiers</SelectItem>
                                        <SelectItem value="Tier 1">Tier 1</SelectItem>
                                        <SelectItem value="Tier 2">Tier 2</SelectItem>
                                        <SelectItem value="Tier 3">Tier 3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Competitor Status</label>
                                <Select value={compFilter} onValueChange={setCompFilter}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All</SelectItem>
                                        <SelectItem value="Clean">Clean Prospects Only</SelectItem>
                                        <SelectItem value="Soft">Soft Competitors Only</SelectItem>
                                        <SelectItem value="Hard">Hard Competitors Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Progress & Navigation */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center mb-4">
                                <div className="text-2xl font-bold text-slate-700">
                                    {totalFiltered === 0 ? 0 : currentIndex + 1} <span className="text-lg text-slate-400">/ {totalFiltered}</span>
                                </div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">Candidates Queued</p>
                            </div>

                            <div className="flex justify-between items-center gap-2 mb-4">
                                <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentIndex <= 0}>
                                    <SkipBack className="w-4 h-4 mr-1" /> Prev
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleNext} disabled={currentIndex >= totalFiltered - 1}>
                                    Next <SkipForward className="w-4 h-4 ml-1" />
                                </Button>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Jump to Candidate:</label>
                                <Select 
                                    value={currentCandidate?.id || ''} 
                                    onValueChange={handleJumpTo}
                                    disabled={totalFiltered === 0}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                        {filteredCandidates.map((c, idx) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {idx + 1}. {c.business_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN: Active Call Interface */}
                <div className="lg:col-span-2">
                    {!currentCandidate ? (
                        <Card className="h-full flex items-center justify-center min-h-[400px]">
                            <div className="text-center text-gray-500">
                                <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <h3 className="text-lg font-semibold">No Candidates Found</h3>
                                <p>Try adjusting your filters to see results.</p>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {/* Header Card */}
                            <Card className={`border-t-4 ${
                                currentCandidate.compStatus === 'Hard' ? 'border-t-red-500' : 
                                currentCandidate.compStatus === 'Soft' ? 'border-t-yellow-500' : 
                                'border-t-blue-500'
                            }`}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-2xl">{currentCandidate.business_name}</CardTitle>
                                            <CardDescription className="flex items-center gap-4 mt-2">
                                                <span className="flex items-center"><MapPin className="w-3 h-3 mr-1"/> {currentCandidate.city}, {currentCandidate.county}</span>
                                                <span className="flex items-center"><Building className="w-3 h-3 mr-1"/> {currentCandidate.service_type}</span>
                                            </CardDescription>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge variant="outline" className="text-lg px-3 py-1 font-mono">{currentCandidate.phone}</Badge>
                                            <div className="flex gap-2">
                                                <Badge variant="secondary">{currentCandidate.tier}</Badge>
                                                <Badge variant={currentCandidate.score >= 80 ? "default" : "secondary"}>Score: {currentCandidate.score}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="bg-slate-50 py-3 border-y border-slate-100">
                                    <p className="text-sm text-slate-600 italic">
                                        <span className="font-semibold text-slate-700">Strategic Note:</span> {currentCandidate.notes?.replace(/\[.*?\]/g, '').trim() || "No notes available."}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Scripting Card */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Recommended Script</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {getScript()}
                                </CardContent>
                            </Card>

                            {/* Action Card */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Log Interaction</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Outcome</label>
                                            <Select value={callOutcome} onValueChange={setCallOutcome}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="connected">Connected</SelectItem>
                                                    <SelectItem value="left_voicemail">Left Voicemail</SelectItem>
                                                    <SelectItem value="no_answer">No Answer</SelectItem>
                                                    <SelectItem value="gatekeeper_block">Gatekeeper Blocked</SelectItem>
                                                    <SelectItem value="callback_scheduled">Callback Scheduled</SelectItem>
                                                    <SelectItem value="not_interested">Not Interested</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Interest Level</label>
                                            <Select value={interestLevel} onValueChange={setInterestLevel}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="High">High (Qualified)</SelectItem>
                                                    <SelectItem value="Medium">Medium (Warm)</SelectItem>
                                                    <SelectItem value="Low">Low (Cool)</SelectItem>
                                                    <SelectItem value="None">None</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Call Notes</label>
                                        <Textarea 
                                            placeholder="Key details, objections, or next steps..."
                                            value={callNotes}
                                            onChange={(e) => setCallNotes(e.target.value)}
                                            className="min-h-[100px]"
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2 pt-2">
                                        <Checkbox 
                                            id="chaos" 
                                            checked={chaosFlagTriggered}
                                            onCheckedChange={setChaosFlagTriggered}
                                            disabled={currentCandidate.compStatus === 'Hard'} // Already flagged
                                        />
                                        <label htmlFor="chaos" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-red-600 flex items-center gap-1">
                                            <ShieldAlert className="w-4 h-4" />
                                            Flag as Hard Competitor / Risk (Chaos Protocol)
                                        </label>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-slate-50 flex justify-between">
                                    <span className="text-xs text-gray-500">
                                        Saving automatically advances to next prospect.
                                    </span>
                                    <Button onClick={saveCallLog} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save & Next Candidate
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HvacLiveTestWorkflow;