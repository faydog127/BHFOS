import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Search, 
    Filter, 
    MoreHorizontal, 
    UserPlus, 
    Star, 
    AlertTriangle, 
    Moon, 
    Clock, 
    Tag,
    Zap,
    Shield,
    Settings,
    TrendingUp,
    Users
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PartnerStatusDashboard from '@/components/crm/hvac/PartnerStatusDashboard';
import PartnerVolumeDashboard from '@/pages/crm/PartnerVolumeDashboard';

const TIER_CONFIG = {
    ACTIVE: {
        label: 'Active Partner',
        badgeColor: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200',
        icon: Star,
        sla: 48,
        benefits: ['Priority Scheduling', 'Full Commission', 'Dedicated Manager'],
        description: 'Top tier service with fastest response times.',
        serviceLevel: 'Priority'
    },
    AT_RISK: {
        label: 'At Risk',
        badgeColor: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200',
        icon: AlertTriangle,
        sla: 48,
        benefits: ['Standard Service', 'Standard Commission'],
        description: 'Engagement dropping. Risk of losing priority status.',
        serviceLevel: 'Standard'
    },
    DORMANT: {
        label: 'Dormant',
        badgeColor: 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200',
        icon: Moon,
        sla: 72,
        benefits: ['Basic Service', 'Reduced Commission'],
        description: 'Inactive for >90 days. Re-engagement required.',
        serviceLevel: 'Basic'
    }
};

const Partners = () => {
    const [partners, setPartners] = useState([]);
    const [enrichmentData, setEnrichmentData] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchPartnersAndDetails();
    }, []);

    const fetchPartnersAndDetails = async () => {
        setLoading(true);
        try {
            const { data: partnersData, error: partnersError } = await supabase
                .from('partner_prospects')
                .select('*')
                .eq('onboarding_completed', true)
                .order('created_at', { ascending: false });

            if (partnersError) throw partnersError;

            const emails = partnersData.map(p => p.email).filter(Boolean);
            
            if (emails.length > 0) {
                const { data: leadsData } = await supabase
                    .from('leads')
                    .select('email, partner_referral_code')
                    .in('email', emails)
                    .eq('is_partner', true);

                const enrichmentMap = {};
                const codesToFetch = [];

                leadsData?.forEach(l => {
                    if (l.partner_referral_code) {
                        enrichmentMap[l.email] = { code: l.partner_referral_code };
                        codesToFetch.push(l.partner_referral_code);
                    }
                });

                if (codesToFetch.length > 0) {
                    const { data: codeDetails } = await supabase
                        .from('referral_codes')
                        .select('code, discount_value, discount_type, sla_hours')
                        .in('code', codesToFetch);

                    codeDetails?.forEach(cd => {
                        Object.keys(enrichmentMap).forEach(email => {
                            if (enrichmentMap[email].code === cd.code) {
                                enrichmentMap[email] = { ...enrichmentMap[email], ...cd };
                            }
                        });
                    });
                }
                setEnrichmentData(enrichmentMap);
            }

            setPartners(partnersData || []);
        } catch (error) {
            console.error('Error fetching partners:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load partners' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddPartner = () => {
        navigate('/crm/leads?persona=realtor&intent=new_partner');
        toast({
            title: "Start Onboarding",
            description: "Add the new partner as a Lead first. They will appear here once onboarding is complete."
        });
    };

    const filteredPartners = partners.filter(p => 
        p.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusConfig = (status) => {
        const key = status?.toUpperCase() || 'PROSPECT';
        return TIER_CONFIG[key] || TIER_CONFIG['DORMANT'];
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50/50 min-h-screen">
            <Helmet>
                <title>Partners | CRM</title>
            </Helmet>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Partner Network</h1>
                    <p className="text-slate-500 mt-1">Manage active partnerships, service levels, and benefits.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="shadow-sm bg-white" onClick={() => navigate('/crm/partner-manager')}>
                        <Settings className="mr-2 h-4 w-4" /> Manage Types
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={handleAddPartner}>
                        <UserPlus className="mr-2 h-4 w-4" /> Add Partner
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="list" className="w-full">
                <TabsList className="bg-white p-1 mb-6 border border-slate-200">
                    <TabsTrigger value="list" className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                        <Users className="h-4 w-4 mr-2" />
                        Partner List
                    </TabsTrigger>
                    <TabsTrigger value="volume" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Volume & Performance
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-6">
                    {/* Status Dashboard */}
                    <PartnerStatusDashboard />

                    {/* Main Partners List */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3 border-b border-slate-100 bg-white rounded-t-xl">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    Active Partners 
                                    <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600">{filteredPartners.length}</Badge>
                                </CardTitle>
                                <div className="flex items-center gap-2 w-full sm:w-auto sm:max-w-sm">
                                    <div className="relative flex-1 sm:w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input 
                                            placeholder="Search partners..." 
                                            className="pl-9 bg-slate-50 border-slate-200"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Button variant="outline" size="icon" className="shrink-0"><Filter className="h-4 w-4 text-slate-500" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="w-[250px] font-semibold">Partner</TableHead>
                                        <TableHead className="font-semibold">Status & Service Level</TableHead>
                                        <TableHead className="font-semibold">Benefits & SLA</TableHead>
                                        <TableHead className="font-semibold">Referral Code</TableHead>
                                        <TableHead className="font-semibold text-right">Performance</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12">
                                                <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                    <p>Loading active partners...</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredPartners.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-16 text-slate-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <UserPlus className="h-10 w-10 text-slate-200" />
                                                    <p className="font-medium">No active partners found</p>
                                                    <p className="text-sm max-w-sm mx-auto">
                                                        Partners currently in onboarding can be found in the <span className="text-blue-600 cursor-pointer underline hover:text-blue-700" onClick={() => navigate('/crm/leads')}>Leads</span> tab.
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredPartners.map((partner) => {
                                            const statusConfig = getStatusConfig(partner.partner_status);
                                            const StatusIcon = statusConfig.icon;
                                            const enrichment = enrichmentData[partner.email] || {};
                                            const actualSla = enrichment.sla_hours || statusConfig.sla;

                                            return (
                                                <TableRow key={partner.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                                {partner.business_name}
                                                                {partner.chaos_flag && (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger>
                                                                                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p className="text-xs">Chaos Flag Active: Requires Attention</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-slate-500">{partner.contact_name}</div>
                                                            <div className="text-xs text-slate-400">{partner.email}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col items-start gap-1.5">
                                                            <Badge variant="outline" className={`${statusConfig.badgeColor} border font-medium flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5`}>
                                                                <StatusIcon className="h-3.5 w-3.5" />
                                                                {statusConfig.label}
                                                            </Badge>
                                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                                <Shield className="h-3 w-3" />
                                                                {statusConfig.serviceLevel} Service
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                                                <Clock className="h-3.5 w-3.5 text-blue-500" />
                                                                {actualSla}h SLA Guarantee
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {statusConfig.benefits.slice(0, 2).map((benefit, i) => (
                                                                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                                        {benefit}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {enrichment.code ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                                                                        {enrichment.code}
                                                                    </code>
                                                                    <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-slate-100 rounded-full" onClick={() => {
                                                                        navigator.clipboard.writeText(enrichment.code);
                                                                        toast({ title: "Copied", description: "Referral code copied to clipboard" });
                                                                    }}>
                                                                        <Tag className="h-3 w-3 text-slate-400" />
                                                                    </Button>
                                                                </div>
                                                                {enrichment.discount_value && (
                                                                    <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                                        <Zap className="h-3 w-3" />
                                                                        {enrichment.discount_value}{enrichment.discount_type === 'percent' ? '%' : '$'} Off
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">No code assigned</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <div className="text-sm font-semibold text-slate-900">
                                                                {partner.total_validated_referrals || 0}
                                                                <span className="text-xs font-normal text-slate-500 ml-1">referrals</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                Last: {partner.last_referral_at ? new Date(partner.last_referral_at).toLocaleDateString() : 'Never'}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="volume">
                    <PartnerVolumeDashboard embedded={true} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Partners;