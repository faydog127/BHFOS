import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Escalations = () => {
    const [escalations, setEscalations] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchEscalations = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('escalations')
            .select('*, leads(id, first_name, last_name, pqi)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch escalations.' });
            console.error(error);
        } else {
            setEscalations(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEscalations();

        const channel = supabase.channel('realtime:escalations_page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, (payload) => {
                fetchEscalations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleResolve = async (id) => {
        const { error } = await supabase
            .from('escalations')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not resolve escalation.' });
        } else {
            toast({ title: 'Success', description: 'Escalation marked as resolved.' });
            fetchEscalations();
        }
    };
    
    const getPriorityBadge = (priority) => {
        switch(priority?.toLowerCase()){
            case 'high': return 'bg-red-500 text-white';
            case 'medium': return 'bg-yellow-400 text-yellow-900';
            case 'low': return 'bg-blue-400 text-blue-900';
            default: return 'bg-gray-400 text-white';
        }
    }

    return (
        <>
            <Helmet>
                <title>Escalations | CRM</title>
            </Helmet>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-red-600 flex items-center gap-3"><AlertTriangle /> Escalations</h1>
                    <p className="text-muted-foreground">High-priority items needing immediate attention.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Pending Escalations ({escalations.length})</CardTitle>
                        <CardDescription>These items have been flagged by the system for manual review.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Lead</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {escalations.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-48 text-muted-foreground">
                                                All clear! No pending escalations.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        escalations.map(esc => (
                                            <TableRow key={esc.id} className="hover:bg-red-50/50">
                                                <TableCell>
                                                    <Badge className={`${getPriorityBadge(esc.priority)}`}>
                                                        {esc.priority}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{esc.leads?.first_name || ''} {esc.leads?.last_name || 'N/A'}</div>
                                                    <div className="text-xs text-muted-foreground">PQI: {esc.leads?.pqi || 'N/A'}</div>
                                                </TableCell>
                                                <TableCell>{esc.reason}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(esc.created_at), { addSuffix: true })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => handleResolve(esc.id)}>
                                                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                                        Mark Resolved
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default Escalations;