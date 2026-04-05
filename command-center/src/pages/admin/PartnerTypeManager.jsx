import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Save, Trash2, RefreshCw, Users, AlertTriangle, Settings, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_TYPES = [
    { id: 'realtor', label: 'Realtor', discount_type: 'percent', discount_value: 10, sla_hours: 48 },
    { id: 'property_manager', label: 'Property Manager', discount_type: 'percent', discount_value: 15, sla_hours: 24 },
    { id: 'hvac_contractor', label: 'HVAC Contractor', discount_type: 'percent', discount_value: 20, sla_hours: 24 },
    { id: 'hoa', label: 'HOA / Board', discount_type: 'fixed', discount_value: 50, sla_hours: 72 },
    { id: 'inspector', label: 'Home Inspector', discount_type: 'percent', discount_value: 10, sla_hours: 48 },
];

const PartnerTypeManager = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [types, setTypes] = useState([]);
    const [stats, setStats] = useState({});
    const [updateExisting, setUpdateExisting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Config
            const { data: configData, error: configError } = await supabase
                .from('global_config')
                .select('value')
                .eq('key', 'partner_types')
                .single();

            let currentTypes = [];
            if (configError && configError.code !== 'PGRST116') {
                console.error('Config fetch error:', configError);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load configurations.' });
            } else if (configData?.value) {
                currentTypes = configData.value;
            } else {
                currentTypes = [...DEFAULT_TYPES];
            }
            setTypes(currentTypes);

            // 2. Fetch Usage Stats (Count partners by persona)
            const { data: partnersData, error: partnersError } = await supabase
                .from('partner_prospects')
                .select('persona');
            
            if (partnersError) throw partnersError;

            const counts = {};
            partnersData.forEach(p => {
                const key = p.persona || 'other';
                counts[key] = (counts[key] || 0) + 1;
            });
            setStats(counts);

        } catch (error) {
            console.error('Error loading data:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to initialize data.' });
        } finally {
            setLoading(false);
        }
    };

    const handleTypeChange = (index, field, value) => {
        const newTypes = [...types];
        newTypes[index] = { ...newTypes[index], [field]: value };
        setTypes(newTypes);
    };

    const handleAddType = () => {
        const newId = `custom_${Date.now()}`;
        setTypes([...types, { id: newId, label: 'New Partner Type', discount_type: 'percent', discount_value: 0, sla_hours: 48 }]);
    };

    const handleDeleteType = (index) => {
        const typeToRemove = types[index];
        if (stats[typeToRemove.id] > 0) {
            toast({ 
                variant: 'destructive', 
                title: 'Cannot Delete', 
                description: `There are ${stats[typeToRemove.id]} active partners using this type. Reassign them first.` 
            });
            return;
        }
        const newTypes = types.filter((_, i) => i !== index);
        setTypes(newTypes);
    };

    const handleSave = async () => {
        setConfirmOpen(false);
        setSaving(true);
        try {
            // 1. Save Config to Global Config
            const { error: configError } = await supabase
                .from('global_config')
                .upsert({ 
                    key: 'partner_types', 
                    value: types,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (configError) throw configError;

            // 2. Optional: Update existing referral codes
            let updateCount = 0;
            if (updateExisting) {
                // Determine which codes need updates based on persona mapping
                // This is a simplified bulk update. In a real scenario, this might need more robust batching.
                
                // Fetch all active partners with referral codes
                const { data: leads, error: leadsError } = await supabase
                    .from('leads')
                    .select('id, persona, partner_referral_code')
                    .eq('is_partner', true)
                    .not('partner_referral_code', 'is', null);

                if (leadsError) throw leadsError;

                // For each lead, find the matching config and update their code
                const updates = leads.map(async (lead) => {
                    const config = types.find(t => t.id === lead.persona);
                    if (config && lead.partner_referral_code) {
                        return supabase
                            .from('referral_codes')
                            .update({
                                discount_type: config.discount_type,
                                discount_value: config.discount_value,
                                sla_hours: config.sla_hours
                            })
                            .eq('code', lead.partner_referral_code);
                    }
                    return null;
                });

                const results = await Promise.all(updates.filter(Boolean));
                updateCount = results.length;
            }

            toast({ 
                title: 'Configuration Saved', 
                description: updateExisting 
                    ? `Updated config and synced ${updateCount} active referral codes.` 
                    : 'Configuration updated for future partners.' 
            });

        } catch (error) {
            console.error('Save error:', error);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-slate-50">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-slate-500">Loading partner configurations...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/crm/partners')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Settings className="h-6 w-6 text-blue-600" />
                                Partner Types & Benefits
                            </h1>
                            <p className="text-slate-500">Manage personas, discount structures, and service level agreements.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <Button variant="outline" onClick={fetchData} disabled={saving}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Reset
                        </Button>
                        <Button onClick={() => setConfirmOpen(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Changes
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <Card>
                    <CardHeader>
                        <CardTitle>Partner Configurations</CardTitle>
                        <CardDescription>
                            Define the default benefits for each partner persona. 
                            These defaults are applied when a new partner is onboarded.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Partner Type / Persona</TableHead>
                                    <TableHead>Discount Value</TableHead>
                                    <TableHead>Discount Type</TableHead>
                                    <TableHead>SLA Guarantee</TableHead>
                                    <TableHead className="text-center">Active Partners</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {types.map((type, index) => (
                                    <TableRow key={type.id || index}>
                                        <TableCell>
                                            <Input 
                                                value={type.label} 
                                                onChange={(e) => handleTypeChange(index, 'label', e.target.value)}
                                                className="font-medium"
                                            />
                                            <div className="text-xs text-slate-400 mt-1 font-mono">ID: {type.id}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="relative">
                                                <Input 
                                                    type="number" 
                                                    value={type.discount_value} 
                                                    onChange={(e) => handleTypeChange(index, 'discount_value', parseFloat(e.target.value))}
                                                    className="w-24 pl-8"
                                                />
                                                <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">
                                                    {type.discount_type === 'percent' ? '%' : '$'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select 
                                                value={type.discount_type} 
                                                onValueChange={(val) => handleTypeChange(index, 'discount_type', val)}
                                            >
                                                <SelectTrigger className="w-[140px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="percent">Percentage (%)</SelectItem>
                                                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    type="number" 
                                                    value={type.sla_hours} 
                                                    onChange={(e) => handleTypeChange(index, 'sla_hours', parseFloat(e.target.value))}
                                                    className="w-20"
                                                />
                                                <span className="text-sm text-slate-500">Hours</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                                                <Users className="h-3 w-3 mr-1" />
                                                {stats[type.id] || 0}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-red-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDeleteType(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="flex justify-between bg-slate-50/50 p-4">
                        <Button variant="outline" onClick={handleAddType} className="border-dashed border-slate-300">
                            <Plus className="h-4 w-4 mr-2" /> Add New Partner Type
                        </Button>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3" />
                            Deleting a type used by active partners is restricted.
                        </div>
                    </CardFooter>
                </Card>

                {/* Save Confirmation Dialog */}
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Save Configuration Changes?</AlertDialogTitle>
                            <AlertDialogDescription>
                                You are about to update the partner type definitions. 
                                This will affect the defaults for all NEW partners.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        
                        <div className="py-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                            <div className="flex items-start space-x-3">
                                <Switch 
                                    id="update-existing" 
                                    checked={updateExisting} 
                                    onCheckedChange={setUpdateExisting}
                                />
                                <div className="space-y-1">
                                    <Label htmlFor="update-existing" className="font-semibold text-yellow-900 cursor-pointer">
                                        Update active partners too?
                                    </Label>
                                    <p className="text-xs text-yellow-700">
                                        If enabled, we will overwrite the discount and SLA settings 
                                        for ALL existing partners ({Object.values(stats).reduce((a,b)=>a+b,0)} total) to match these new defaults.
                                        <strong> Use caution.</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                                Confirm & Save
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </div>
    );
};

export default PartnerTypeManager;