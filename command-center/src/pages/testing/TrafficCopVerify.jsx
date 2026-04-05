import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

const TrafficCopVerify = () => {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [testResult, setTestResult] = useState(null);

    const checkDatabase = async () => {
        setLoading(true);
        const checks = {
            tables: {},
            extensions: {},
            functions: {},
            triggers: {},
            settings: {}
        };

        try {
            // 1. Check Tables & Columns
            // We can't query information_schema directly easily via standard client without rpc or high privs often.
            // Instead we'll try to select 1 from tables to verify existence.
            
            // Leads
            const { error: leadsErr } = await supabase.from('leads').select('id, customer_name, service_name, est_value, priority').limit(1);
            checks.tables.leads = !leadsErr;
            checks.tables.leads_details = leadsErr ? leadsErr.message : 'OK';

            // Estimates
            const { error: estErr } = await supabase.from('estimates').select('id, estimated_minutes, services').limit(1);
            checks.tables.estimates = !estErr;

            // Activity Log
            const { error: actErr } = await supabase.from('activity_log').select('id, lead_id').limit(1);
            checks.tables.activity_log = !actErr;

            // App Settings
            const { data: settings, error: setErr } = await supabase.from('app_settings').select('*').eq('key', 'mode');
            checks.settings.exists = !setErr;
            checks.settings.mode = settings?.[0]?.value || 'Not Set';

            // 2. Extensions (Indirect check via rpc usually needed, or assuming failure if fetch failed)
            // We'll trust the previous SQL migration enabled it.

            // 3. Test Trigger via Insert
            const testId = `test-${Date.now()}`;
            const { data: insertData, error: insertError } = await supabase.from('leads').insert({
                first_name: 'TrafficCop',
                last_name: 'Test',
                customer_name: 'TrafficCop Test',
                phone: '+15550001234',
                email: `test-${Date.now()}@example.com`,
                service_name: 'Dryer Vent Cleaning',
                service: 'Dryer Vent Cleaning',
                status: 'new',
                is_test_data: true
            }).select().single();

            if (insertError) {
                setTestResult({ success: false, message: `Insert failed: ${insertError.message}` });
            } else {
                // Poll for activity log (giving edge function time to run)
                // Wait 5 seconds
                await new Promise(r => setTimeout(r, 5000));
                
                const { data: logs } = await supabase
                    .from('activity_log')
                    .select('*')
                    .eq('lead_id', insertData.id);
                
                const { data: estimates } = await supabase
                    .from('estimates')
                    .select('*')
                    .eq('lead_id', insertData.id);

                setTestResult({
                    success: true,
                    lead_created: true,
                    lead_id: insertData.id,
                    logs_found: logs?.length || 0,
                    estimates_found: estimates?.length || 0,
                    logs: logs,
                    estimates: estimates
                });
            }

        } catch (e) {
            console.error(e);
        } finally {
            setReport(checks);
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Traffic Cop Diagnostics</h1>
                    <p className="text-slate-500">Verify database schema, triggers, and edge function connectivity.</p>
                </div>
                <Button onClick={checkDatabase} disabled={loading} size="lg">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Run Diagnostics
                </Button>
            </div>

            {report && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Schema Verification</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <CheckItem label="Leads Table (new columns)" status={report.tables.leads} details={report.tables.leads_details} />
                            <CheckItem label="Estimates Table" status={report.tables.estimates} />
                            <CheckItem label="Activity Log Table" status={report.tables.activity_log} />
                            <div className="p-3 bg-slate-50 rounded border flex justify-between items-center">
                                <span className="text-sm font-medium">App Mode</span>
                                <Badge variant={report.settings.mode === 'live' ? 'default' : 'secondary'}>
                                    {report.settings.mode.toUpperCase()}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Live Trigger Test</CardTitle>
                            <CardDescription>Inserts a test lead and waits for Edge Function response.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!testResult ? (
                                <div className="text-sm text-slate-500 italic">Run diagnostics to perform test...</div>
                            ) : (
                                <div className="space-y-4">
                                    <CheckItem label="Lead Inserted" status={testResult.lead_created} />
                                    
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">Estimate Auto-Created:</span>
                                            {testResult.estimates_found > 0 ? (
                                                <Badge className="bg-green-600">Yes ({testResult.estimates_found})</Badge>
                                            ) : (
                                                <Badge variant="destructive">No (Wait 2m or check logs)</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Note: Fast Lane logic has a 2-minute delay. If this is 0, check back in 2 mins.
                                        </p>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t">
                                        <span className="text-sm font-medium block">Activity Logs:</span>
                                        {testResult.logs && testResult.logs.length > 0 ? (
                                            <div className="bg-slate-950 text-slate-50 p-3 rounded text-xs font-mono max-h-40 overflow-auto">
                                                {testResult.logs.map((l, i) => (
                                                    <div key={i} className="mb-1 border-b border-slate-800 pb-1">
                                                        <span className="text-blue-400">[{l.type}]</span> {l.note}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500">No logs found yet.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
            
            <Card>
                <CardHeader><CardTitle>Manual SQL Verification</CardTitle></CardHeader>
                <CardContent>
                    <div className="bg-slate-100 p-4 rounded-md text-sm font-mono overflow-x-auto">
                        <p className="font-bold mb-2">If tests fail, run this SQL in Supabase Dashboard:</p>
                        <pre className="text-slate-600 whitespace-pre-wrap">
{`SELECT * FROM pg_extension WHERE extname = 'http';
SELECT * FROM information_schema.triggers WHERE event_object_table = 'leads';
SELECT * FROM pg_proc WHERE proname = 'notify_lead_intake';`}
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const CheckItem = ({ label, status, details }) => (
    <div className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
            {details && details !== 'OK' && <span className="text-xs text-red-500 max-w-[150px] truncate" title={details}>{details}</span>}
            {status ? <CheckCircle2 className="text-green-500 w-5 h-5" /> : <XCircle className="text-red-500 w-5 h-5" />}
        </div>
    </div>
);

export default TrafficCopVerify;