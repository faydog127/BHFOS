import React, { useState, useEffect, useCallback } from 'react';
import { 
    MapPin, 
    Home, 
    ScanSearch, 
    CheckCircle, 
    AlertCircle, 
    Loader2, 
    Save,
    Clock,
    ImageOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const PropertyInspectionPanel = ({ lead, cachedImageUrl, isLoadingImage }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [address, setAddress] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    
    const [inspectionData, setInspectionData] = useState({
        isTwoStory: false,
        isRoofExhaust: false,
        hasScreen: false,
        aiConfidence: 0,
        notes: ''
    });
    const [saved, setSaved] = useState(true);

    // Helper to check if ID is a valid UUID (for real DB calls)
    const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const fetchInspectionData = useCallback(async () => {
        if (!lead || !lead.id) return;
        
        // Skip DB fetch for mock data
        if (!isValidUUID(lead.id)) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('property_inspections')
                .select('*')
                .eq('lead_id', lead.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setInspectionData({
                    isTwoStory: data.is_two_story || false,
                    isRoofExhaust: data.dryer_vent_on_roof || false,
                    hasScreen: data.has_screen || false,
                    aiConfidence: data.ai_confidence_score || 0,
                    notes: data.inspection_notes || ''
                });
                setLastUpdated(data.updated_at);
                setSaved(true);
            } else {
                setInspectionData({
                    isTwoStory: false,
                    isRoofExhaust: false,
                    hasScreen: false,
                    aiConfidence: 0,
                    notes: ''
                });
                setLastUpdated(null);
            }
        } catch (err) {
            console.error('Error fetching inspection:', err);
        } finally {
            setLoading(false);
        }
    }, [lead]);

    useEffect(() => {
        if (lead) {
            setAddress(lead.address || lead.property_name || '');
            fetchInspectionData();
        }
    }, [lead, fetchInspectionData]);

    const handleAnalyze = async () => {
        if (!cachedImageUrl) return;
        
        setAnalyzing(true);
        setSaved(false);
        
        // Simulate Claude Vision API Analysis
        setTimeout(async () => {
            // Mock AI logic
            const mockIsTwoStory = Math.random() > 0.5;
            const mockIsRoofExhaust = Math.random() > 0.3;
            const confidence = Math.floor(Math.random() * (98 - 85) + 85);
            
            const newData = {
                ...inspectionData,
                isTwoStory: mockIsTwoStory,
                isRoofExhaust: mockIsRoofExhaust,
                hasScreen: false, 
                aiConfidence: confidence
            };

            setInspectionData(newData);
            setAnalyzing(false);
            
            toast({
                title: "AI Analysis Complete",
                description: `Detected ${mockIsTwoStory ? '2-Story' : '1-Story'} building with ${mockIsRoofExhaust ? 'roof' : 'wall'} exhaust.`,
            });

            if (isValidUUID(lead.id)) {
                await saveToSupabase(newData);
            }
        }, 2500);
    };

    const saveToSupabase = async (dataToSave) => {
        if (!lead || !isValidUUID(lead.id)) {
            if (!isValidUUID(lead.id)) {
                toast({
                    title: "Demo Mode",
                    description: "Data changes are local only for mock leads.",
                    variant: "default"
                });
                setSaved(true);
            }
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            const payload = {
                lead_id: lead.id,
                address: address,
                street_view_url: cachedImageUrl,
                is_two_story: dataToSave.isTwoStory,
                dryer_vent_on_roof: dataToSave.isRoofExhaust,
                has_screen: dataToSave.hasScreen,
                ai_confidence_score: dataToSave.aiConfidence,
                inspection_notes: dataToSave.notes,
                inspected_by: user?.id,
                updated_at: new Date().toISOString()
            };

            const { data: existing } = await supabase
                .from('property_inspections')
                .select('id')
                .eq('lead_id', lead.id)
                .maybeSingle();

            let result;
            if (existing) {
                 result = await supabase
                    .from('property_inspections')
                    .update(payload)
                    .eq('id', existing.id);
            } else {
                 result = await supabase
                    .from('property_inspections')
                    .insert([payload]);
            }

            if (result.error) throw result.error;

            setSaved(true);
            setLastUpdated(new Date().toISOString());
            
            toast({
                title: "Inspection Saved",
                description: "Property details updated in database.",
                className: "bg-green-600 text-white border-none"
            });
        } catch (error) {
            console.error("Save error:", error);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: error.message || "Could not update property record."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleManualUpdate = (key, value) => {
        setInspectionData(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    if (!lead) return <div className="p-4 text-center text-slate-500">No lead selected</div>;

    return (
        <div className="h-full flex flex-col bg-white relative overflow-hidden">
            {/* Street View / Image Display Card */}
            <div className="relative h-48 bg-slate-100 w-full overflow-hidden group shrink-0 border-b border-slate-100">
                {isLoadingImage ? (
                    <div className="w-full h-full p-4">
                        <Skeleton className="w-full h-full rounded bg-slate-200" />
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                            Fetching Property View...
                        </div>
                    </div>
                ) : cachedImageUrl ? (
                    <>
                        <img 
                            src={cachedImageUrl} 
                            alt={`Property view of ${address}`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {analyzing && (
                            <div className="absolute inset-0 bg-indigo-900/20 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
                                <div className="relative">
                                    <ScanSearch className="h-12 w-12 text-white animate-pulse" />
                                    <div className="absolute inset-0 border-2 border-white/50 rounded-lg animate-ping" />
                                </div>
                                <span className="text-white font-mono text-xs mt-2 bg-black/50 px-2 py-1 rounded">Analyzing Structure...</span>
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <p className="text-white text-xs font-medium truncate flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-red-400" /> {address}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full flex-col text-slate-400 gap-2 bg-slate-50">
                        <ImageOff className="h-8 w-8 text-slate-300" />
                        <span className="text-xs">No image available</span>
                    </div>
                )}
            </div>

            {/* Inspection Controls */}
            <div className="flex-1 p-4 space-y-5 overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                        <Home className="h-4 w-4 text-indigo-500" />
                        Property Details
                    </h3>
                    <div className="flex items-center gap-2">
                        {lastUpdated && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1" title={new Date(lastUpdated).toLocaleString()}>
                                <Clock className="h-3 w-3" /> 
                                {new Date(lastUpdated).toLocaleDateString()}
                            </span>
                        )}
                        {inspectionData.aiConfidence > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                AI: {inspectionData.aiConfidence}%
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors">
                        <Checkbox 
                            id="isTwoStory" 
                            checked={inspectionData.isTwoStory} 
                            onCheckedChange={(c) => handleManualUpdate('isTwoStory', c)}
                        />
                        <div className="grid gap-1 leading-none">
                            <label htmlFor="isTwoStory" className="text-sm font-medium text-slate-900 cursor-pointer flex items-center justify-between">
                                2-Story Building
                                {analyzing && <span className="text-[10px] text-indigo-500 animate-pulse">Checking...</span>}
                            </label>
                            <p className="text-xs text-slate-500">Requires 30ft ladder access.</p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors">
                        <Checkbox 
                            id="isRoofExhaust" 
                            checked={inspectionData.isRoofExhaust} 
                            onCheckedChange={(c) => handleManualUpdate('isRoofExhaust', c)}
                        />
                        <div className="grid gap-1 leading-none">
                            <label htmlFor="isRoofExhaust" className="text-sm font-medium text-slate-900 cursor-pointer flex items-center justify-between">
                                Roof Exhaust
                                {analyzing && <span className="text-[10px] text-indigo-500 animate-pulse">Scanning...</span>}
                            </label>
                            <p className="text-xs text-slate-500">Vent terminates on roof line.</p>
                        </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors">
                        <Checkbox 
                            id="hasScreen" 
                            checked={inspectionData.hasScreen} 
                            onCheckedChange={(c) => handleManualUpdate('hasScreen', c)}
                        />
                        <div className="grid gap-1 leading-none">
                            <label htmlFor="hasScreen" className="text-sm font-medium text-slate-900 cursor-pointer flex items-center justify-between">
                                Vent Screen Present
                            </label>
                            <p className="text-xs text-slate-500 text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Non-compliant in FL
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 mt-2">
                        <Label className="text-xs text-slate-600">Inspection Notes</Label>
                        <Textarea 
                            placeholder="Add observations about access or hazards..."
                            value={inspectionData.notes}
                            onChange={(e) => handleManualUpdate('notes', e.target.value)}
                            className="h-20 resize-none text-xs"
                        />
                    </div>
                </div>

                <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-2">
                    <Button 
                        variant="outline" 
                        className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50" 
                        onClick={handleAnalyze}
                        disabled={analyzing || !cachedImageUrl}
                    >
                        {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}
                        {analyzing ? 'Analyzing...' : 'AI Analyze'}
                    </Button>
                    
                    <Button 
                        className={`flex-1 ${saved ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-green-600 hover:bg-green-700 text-white shadow-md'}`}
                        onClick={() => saveToSupabase(inspectionData)}
                        disabled={loading || analyzing || !cachedImageUrl || saved}
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (saved ? <CheckCircle className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />)}
                        {saved ? 'Saved' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PropertyInspectionPanel;