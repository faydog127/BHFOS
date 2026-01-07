import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const Metrics = () => {
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        const { ok, data, error } = await invoke('metrics-template-week');
        if (ok) {
            setMetrics(data.metrics);
        } else {
            toast({ variant: 'destructive', title: 'Failed to load metrics', description: error });
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    const getRateColor = (rate) => {
        if (rate > 20) return 'text-green-600';
        if (rate > 10) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getRateIcon = (rate) => {
        if (rate > 20) return <TrendingUp className="h-5 w-5 text-green-500" />;
        if (rate > 10) return <Minus className="h-5 w-5 text-yellow-500" />;
        return <TrendingDown className="h-5 w-5 text-red-500" />;
    };

    if (loading) {
        return <div className="p-8 text-center">Loading metrics...</div>;
    }

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Template Performance</h1>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart />
                        Weekly Booked Rate by Template
                    </CardTitle>
                    <CardDescription>
                        Performance of automated templates over the last 7 days. This shows which openers are most effective at booking jobs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Template ID</TableHead>
                                <TableHead className="text-center">Total Sends</TableHead>
                                <TableHead className="text-center">Jobs Booked</TableHead>
                                <TableHead className="text-right">Booked Rate</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {metrics && metrics.length > 0 ? metrics.map((metric) => (
                                <TableRow key={metric.template_id}>
                                    <TableCell className="font-medium">{metric.template_id}</TableCell>
                                    <TableCell className="text-center">{metric.sends}</TableCell>
                                    <TableCell className="text-center">{metric.booked}</TableCell>
                                    <TableCell className={`text-right font-bold text-lg ${getRateColor(metric.booked_rate)}`}>
                                        <div className="flex items-center justify-end gap-2">
                                            {getRateIcon(metric.booked_rate)}
                                            {metric.booked_rate.toFixed(1)}%
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan="4" className="text-center h-24">
                                        No template data found for the last 7 days.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default Metrics;