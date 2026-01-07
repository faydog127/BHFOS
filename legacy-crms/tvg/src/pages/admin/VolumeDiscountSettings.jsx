import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, Trash2, Plus, ArrowLeft, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchVolumeTiers } from '@/lib/volumeDiscountUtils';

const VolumeDiscountSettings = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tiers, setTiers] = useState([]);

    useEffect(() => {
        loadTiers();
    }, []);

    const loadTiers = async () => {
        setLoading(true);
        const data = await fetchVolumeTiers();
        // Sort by threshold for display
        setTiers(data.sort((a, b) => a.threshold - b.threshold));
        setLoading(false);
    };

    const handleTierChange = (index, field, value) => {
        const newTiers = [...tiers];
        newTiers[index] = { ...newTiers[index], [field]: value };
        setTiers(newTiers);
    };

    const handleAddTier = () => {
        setTiers([...tiers, { threshold: 0, bonus_percent: 0, label: 'New Tier' }]);
    };

    const handleDeleteTier = (index) => {
        const newTiers = tiers.filter((_, i) => i !== index);
        setTiers(newTiers);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Validate
            const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
            
            const { error } = await supabase
                .from('global_config')
                .upsert({ 
                    key: 'volume_discount_tiers', 
                    value: sorted,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (error) throw error;

            toast({ title: 'Settings Saved', description: 'Volume discount tiers updated successfully.' });
            setTiers(sorted);
        } catch (error) {
            console.error('Save error:', error);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/crm/partner-volume')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp className="h-6 w-6 text-blue-600" />
                            Volume Discount Tiers
                        </h1>
                        <p className="text-slate-500">Configure automated bonus discounts based on monthly booking volume.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Tier Configuration</CardTitle>
                        <CardDescription>
                            Define thresholds for monthly bookings. Partners exceeding these counts (last 30 days) will automatically qualify for the bonus discount percentage on top of their base rate.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tier Name</TableHead>
                                    <TableHead>Min. Bookings (30d)</TableHead>
                                    <TableHead>Bonus Discount (%)</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tiers.map((tier, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <Input 
                                                value={tier.label} 
                                                onChange={(e) => handleTierChange(index, 'label', e.target.value)}
                                                placeholder="e.g. Gold Tier"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-500">&ge;</span>
                                                <Input 
                                                    type="number" 
                                                    value={tier.threshold} 
                                                    onChange={(e) => handleTierChange(index, 'threshold', parseInt(e.target.value))}
                                                    className="w-24"
                                                />
                                                <span className="text-sm text-slate-500">jobs</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-500">+</span>
                                                <Input 
                                                    type="number" 
                                                    value={tier.bonus_percent} 
                                                    onChange={(e) => handleTierChange(index, 'bonus_percent', parseFloat(e.target.value))}
                                                    className="w-24"
                                                />
                                                <span className="text-sm text-slate-500">%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-red-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDeleteTier(index)}
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
                        <Button variant="outline" onClick={handleAddTier} className="border-dashed">
                            <Plus className="h-4 w-4 mr-2" /> Add Tier
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Configuration
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

export default VolumeDiscountSettings;