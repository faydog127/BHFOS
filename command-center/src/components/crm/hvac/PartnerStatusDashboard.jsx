import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, AlertTriangle, Clock, Loader2 } from 'lucide-react';

const PartnerStatusDashboard = () => {
    const [stats, setStats] = useState({
        prospect: 0,
        active: 0,
        atRisk: 0,
        dormant: 0,
        total: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        
        // Optional: Subscribe to changes if needed, but simple fetch is usually fine for dashboard
    }, []);

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase
                .from('partner_prospects')
                .select('partner_status');

            if (error) throw error;

            const counts = {
                prospect: 0,
                active: 0,
                atRisk: 0,
                dormant: 0,
                total: 0
            };

            data.forEach(row => {
                const status = (row.partner_status || 'PROSPECT').toUpperCase();
                if (status === 'ACTIVE') counts.active++;
                else if (status === 'AT_RISK') counts.atRisk++;
                else if (status === 'DORMANT') counts.dormant++;
                else counts.prospect++; // Default/Fallback
                counts.total++;
            });

            setStats(counts);
        } catch (err) {
            console.error('Error fetching partner stats:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full h-32 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Active Partners</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
                    <p className="text-xs text-gray-500">
                        Generating referrals
                    </p>
                    <div className="mt-3 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${(stats.active / stats.total) * 100}%` }} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">At Risk</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{stats.atRisk}</div>
                    <p className="text-xs text-gray-500">
                        Needs "Wake Up" protocol
                    </p>
                    <div className="mt-3 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500" style={{ width: `${(stats.atRisk / stats.total) * 100}%` }} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Dormant</CardTitle>
                    <Clock className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{stats.dormant}</div>
                    <p className="text-xs text-gray-500">
                        Inactive {'>'} 90 days
                    </p>
                    <div className="mt-3 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400" style={{ width: `${(stats.dormant / stats.total) * 100}%` }} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Prospects</CardTitle>
                    <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{stats.prospect}</div>
                    <p className="text-xs text-gray-500">
                        In pipeline
                    </p>
                    <div className="mt-3 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${(stats.prospect / stats.total) * 100}%` }} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PartnerStatusDashboard;