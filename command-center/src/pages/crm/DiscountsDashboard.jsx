import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Ticket, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const DiscountsDashboard = () => {
    const [discounts, setDiscounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        redeemed: 0,
        rate: 0
    });

    useEffect(() => {
        fetchDiscounts();
    }, []);

    const fetchDiscounts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_discounts')
                .select(`
                    *,
                    leads ( first_name, last_name, email )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setDiscounts(data || []);

            // Calculate Stats
            const total = data?.length || 0;
            const redeemed = data?.filter(d => d.status === 'redeemed').length || 0;
            const rate = total > 0 ? ((redeemed / total) * 100).toFixed(1) : 0;

            setStats({ total, redeemed, rate });

        } catch (error) {
            console.error('Error fetching discounts:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Loyalty Codes</h1>
                    <p className="text-slate-500">Track discount codes issued after job completion.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Codes Issued</CardDescription>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <Ticket className="w-5 h-5 text-blue-500" />
                            {stats.total}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Redeemed</CardDescription>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            {stats.redeemed}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Redemption Rate</CardDescription>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-orange-500" />
                            {stats.rate}%
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Discount Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Active & Redeemed Codes</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Discount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Expires</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {discounts.map((discount) => (
                                    <TableRow key={discount.id}>
                                        <TableCell className="font-mono font-bold text-slate-700">
                                            {discount.code}
                                        </TableCell>
                                        <TableCell>
                                            {discount.leads?.first_name} {discount.leads?.last_name}
                                            <div className="text-xs text-slate-400">{discount.leads?.email}</div>
                                        </TableCell>
                                        <TableCell>{discount.discount_percentage}%</TableCell>
                                        <TableCell>
                                            <Badge variant={discount.status === 'redeemed' ? 'default' : discount.status === 'expired' ? 'destructive' : 'secondary'}
                                                className={discount.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}
                                            >
                                                {discount.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{format(new Date(discount.created_at), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{format(new Date(discount.expiration_date), 'MMM d, yyyy')}</TableCell>
                                    </TableRow>
                                ))}
                                {discounts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-slate-500 h-24">
                                            No discount codes found. Complete a job to generate one.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DiscountsDashboard;