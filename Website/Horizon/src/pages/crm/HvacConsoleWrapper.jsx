import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Phone, Search, User, Building2, MapPin, History, Play } from 'lucide-react';
import HvacCallConsoleState from '@/components/crm/hvac/HvacCallConsoleState';
import FlagChaosModal from '@/components/crm/hvac/FlagChaosModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const HvacConsoleWrapper = () => {
    const [searchParams] = useSearchParams();
    const [partnerId, setPartnerId] = useState(searchParams.get('id') || '');
    const [partner, setPartner] = useState(null);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (searchParams.get('id')) {
            fetchPartner(searchParams.get('id'));
        } else if (searchParams.get('demo')) {
            // Fetch a random partner for demo
            fetchRandomPartner();
        }
    }, [searchParams]);

    const fetchPartner = async (id) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('partner_prospects')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            setPartner(data);
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load partner.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchRandomPartner = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('partner_prospects')
                .select('*')
                .limit(1);
            
            if (data && data.length > 0) {
                setPartner(data[0]);
                setPartnerId(data[0].id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if(partnerId) fetchPartner(partnerId);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
             <Helmet>
                <title>Call Console | HVAC</title>
            </Helmet>

            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header / Search */}
                <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <Phone className="w-5 h-5 text-blue-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">Call Console</h1>
                    </div>
                    <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
                        <Input 
                            placeholder="Partner ID or UUID..." 
                            value={partnerId}
                            onChange={(e) => setPartnerId(e.target.value)}
                            className="w-full md:w-80"
                        />
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Loading...' : <Search className="w-4 h-4" />}
                        </Button>
                    </form>
                </div>

                {/* State Banner - The Core Component */}
                <HvacCallConsoleState partner={partner} loading={loading} />

                {/* Main Content Area */}
                {partner && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left Column: Partner Info */}
                        <div className="md:col-span-2 space-y-6">
                            <Card>
                                <CardHeader className="bg-gray-50/50 border-b">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{partner.business_name}</CardTitle>
                                            <div className="flex gap-2 mt-2">
                                                <Badge variant="outline">{partner.service_type}</Badge>
                                                <Badge variant="secondary">{partner.persona}</Badge>
                                                <Badge className={partner.partner_status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-500'}>{partner.partner_status}</Badge>
                                            </div>
                                        </div>
                                        <Button variant="destructive" size="sm" onClick={() => setModalOpen(true)}>
                                            Flag Chaos
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <User className="w-4 h-4" />
                                            <span className="font-medium text-gray-900">{partner.contact_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Phone className="w-4 h-4" />
                                            <span>{partner.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Building2 className="w-4 h-4" />
                                            <span>{partner.city}, {partner.county}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <MapPin className="w-4 h-4" />
                                            <a href={partner.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                                                {partner.website || 'No website'}
                                            </a>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                             <Card>
                                <CardHeader><CardTitle className="text-base">Recent Interaction History</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="text-sm text-gray-500 italic text-center py-4">
                                        No recent calls logged in this demo view.
                                    </div>
                                </CardContent>
                             </Card>
                        </div>

                        {/* Right Column: Scripts & Tools */}
                        <div className="space-y-6">
                            <Card className="bg-slate-50 border-slate-200">
                                <CardHeader><CardTitle className="text-base">Quick Scripts</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="p-3 bg-white rounded border text-sm">
                                        <strong className="block text-xs uppercase text-gray-500 mb-1">Opening</strong>
                                        "Hi {partner.contact_name}, this is [Name] from The Vent Guys. Calling about the recent referral..."
                                    </div>
                                    <div className="p-3 bg-white rounded border text-sm">
                                        <strong className="block text-xs uppercase text-gray-500 mb-1">Voicemail</strong>
                                        "Hi {partner.contact_name}, just checking in on the status of [Job Address]. Please give us a call back..."
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle className="text-base">System Data</CardTitle></CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span>Score:</span> <strong>{partner.score || 0}</strong></div>
                                    <div className="flex justify-between"><span>Invoices Due:</span> <strong>{partner.invoice_overdue_days} days</strong></div>
                                    <div className="flex justify-between"><span>Referrals:</span> <strong>{partner.total_validated_referrals || 0}</strong></div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {!partner && !loading && (
                    <div className="text-center py-12 text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Search for a partner ID to load the console.</p>
                        <Button variant="link" onClick={fetchRandomPartner}>Load Random Partner</Button>
                    </div>
                )}
            </div>

            <FlagChaosModal 
                isOpen={modalOpen} 
                onClose={() => setModalOpen(false)} 
                partnerId={partner?.id}
                partnerName={partner?.business_name}
                onFlagSuccess={() => fetchPartner(partner.id)}
            />
        </div>
    );
};

export default HvacConsoleWrapper;