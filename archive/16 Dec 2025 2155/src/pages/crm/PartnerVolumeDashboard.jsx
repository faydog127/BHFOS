import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    Loader2, 
    Settings, 
    Building, 
    Target,
    Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchVolumeTiers, calculateVolumeDiscount } from '@/lib/volumeDiscountUtils';

const PartnerVolumeDashboard = ({ embedded = false }) => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState([]);
    const [tiers, setTiers] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const tiersData = await fetchVolumeTiers();
            setTiers(tiersData);

            const { data: partnersData, error: partnersError } = await supabase
                .from('partner_prospects')
                .select('id, business_name, contact_name, email, portfolio_size, partner_status')
                .eq('onboarding_completed', true)
                .neq('partner_status', 'DORMANT')
                .order('business_name');

            if (partnersError) throw partnersError;

            const { data: leadsWithCodes } = await supabase
                .from('leads')
                .select('email, partner_referral_code')
                .in('email', partnersData.map(p => p.email))
                .eq('is_partner', true)
                .not('partner_referral_code', 'is', null);

            const codeMap = {};
            leadsWithCodes?.forEach(l => {
                if (l.email) codeMap[l.email] = l.partner_referral_code;
            });

            const codes = Object.values(codeMap);
            let bookingsMap = {};

            if (codes.length > 0) {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                const { data: referralLeads } = await supabase
                    .from('leads')
                    .select('partner_referral_code, id')
                    .in('partner_referral_code', codes)
                    .gte('created_at', thirtyDaysAgo.toISOString());

                if (referralLeads && referralLeads.length > 0) {
                    const leadIds = referralLeads.map(l => l.id);
                    const { data: jobs } = await supabase
                        .from('jobs')
                        .select('lead_id')
                        .in('lead_id', leadIds)
                        .not('status', 'in', '("cancelled")');
                    
                    jobs?.forEach(job => {
                        const lead = referralLeads.find(l => l.id === job.lead_id);
                        if (lead && lead.partner_referral_code) {
                            bookingsMap[lead.partner_referral_code] = (bookingsMap[lead.partner_referral_code] || 0) + 1;
                        }
                    });
                }
            }

            const enriched = partnersData.map(p => {
                const code = codeMap[p.email];
                const bookingCount = code ? (bookingsMap[code] || 0) : 0;
                const { bonusPercent, currentLabel, nextTier, bookingsToNext } = calculateVolumeDiscount(bookingCount, tiersData);

                return {
                    ...p,
                    referralCode: code,
                    bookingCount,
                    bonusPercent,
                    currentLabel,
                    nextTier,
                    bookingsToNext
                };
            });

            setPartners(enriched);

        } catch (error) {
            console.error("Dashboard Load Error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load volume data.' });
        } finally {
            setLoading(false);
        }
    };

    const handlePortfolioUpdate = async (id, newValue) => {
        const val = parseInt(newValue);
        if (isNaN(val)) return;

        try {
            const { error } = await supabase
                .from('partner_prospects')
                .update({ portfolio_size: val })
                .eq('id', id);

            if (error) throw error;
            
            setPartners(partners.map(p => p.id === id ? { ...p, portfolio_size: val } : p));
            setEditingId(null);
            toast({ title: "Updated", description: "Portfolio size updated." });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update portfolio.' });
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12 bg-slate-50">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    );

    return (
        <div className="space-y-6">
            {!embedded && (
                <div className="flex justify-end">
                     <Button variant="outline" onClick={() => navigate('/crm/partner-volume/settings')}>
                        <Settings className="h-4 w-4 mr-2" /> Configure Tiers
                    </Button>
                </div>
            )}

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Total Managed Units</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{partners.reduce((acc, p) => acc + (p.portfolio_size || 0), 0).toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Active Partners</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{partners.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Volume Bonus Qualifiers</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{partners.filter(p => p.bonusPercent > 0).length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Partner Performance (Last 30 Days)</CardTitle>
                    {embedded && (
                        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/partner-volume/settings')}>
                            <Settings className="h-4 w-4 mr-2" /> Tier Settings
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">Partner</TableHead>
                                <TableHead>Portfolio Size</TableHead>
                                <TableHead>Monthly Bookings</TableHead>
                                <TableHead>Volume Tier</TableHead>
                                <TableHead>Bonus</TableHead>
                                <TableHead className="w-[200px]">Next Tier Progress</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {partners.map((partner) => (
                                <TableRow key={partner.id}>
                                    <TableCell>
                                        <div className="font-semibold text-slate-900">{partner.business_name}</div>
                                        <div className="text-xs text-slate-500">{partner.contact_name}</div>
                                    </TableCell>
                                    <TableCell>
                                        {editingId === partner.id ? (
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    type="number" 
                                                    value={editValue} 
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-20 h-8"
                                                    autoFocus
                                                />
                                                <Button size="icon" className="h-8 w-8" onClick={() => handlePortfolioUpdate(partner.id, editValue)}>
                                                    <Save className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div 
                                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors group"
                                                onClick={() => { setEditingId(partner.id); setEditValue(partner.portfolio_size || 0); }}
                                            >
                                                <Building className="h-4 w-4 text-slate-400" />
                                                <span>{partner.portfolio_size || 0} units</span>
                                                <Settings className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Target className="h-4 w-4 text-blue-500" />
                                            <span className="font-medium">{partner.bookingCount}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`
                                            ${partner.bonusPercent > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600'}
                                        `}>
                                            {partner.currentLabel}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`font-bold ${partner.bonusPercent > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                            +{partner.bonusPercent}%
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {partner.nextTier ? (
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] text-slate-500 uppercase">
                                                    <span>{partner.bookingsToNext} to {partner.nextTier.label}</span>
                                                    <span>{partner.bookingCount}/{partner.nextTier.threshold}</span>
                                                </div>
                                                <Progress value={(partner.bookingCount / partner.nextTier.threshold) * 100} className="h-1.5" />
                                            </div>
                                        ) : (
                                            <span className="text-xs text-green-600 font-medium">Max Tier Reached! 🏆</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default PartnerVolumeDashboard;