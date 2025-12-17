import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle2, XCircle, AlertTriangle, Terminal } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const EmailDiagnostics = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [configCheck, setConfigCheck] = useState({ loading: true, senderEmail: null, senderEmailStatus: 'unknown' });
    
    // Test Form State
    const [testTo, setTestTo] = useState('');
    const [testFrom, setTestFrom] = useState('');
    const [testSubject, setTestSubject] = useState('Traffic Cop Diagnostic Test');
    const [testResult, setTestResult] = useState(null);

    // 1. Load Configuration
    useEffect(() => {
        checkConfiguration();
    }, []);

    const checkConfiguration = async () => {
        setConfigCheck(prev => ({ ...prev, loading: true }));
        try {
            const { data, error } = await supabase
                .from('global_config')
                .select('value')
                .eq('key', 'EMAIL_SENDER_ADDRESS')
                .single();
            
            setConfigCheck({
                loading: false,
                senderEmail: data?.value || null,
                senderEmailStatus: data?.value ? 'configured' : 'missing'
            });
            
            if (data?.value) setTestFrom(data.value);

        } catch (e) {
            console.error(e);
            setConfigCheck({ loading: false, senderEmail: null, senderEmailStatus: 'error' });
        }
    };

    // 2. Run Test
    const runTest = async () => {
        if (!testTo) {
            toast({ variant: "destructive", title: "Missing Recipient", description: "Please enter a 'To' email address." });
            return;
        }

        setLoading(true);
        setTestResult(null);

        try {
            const payload = {
                to: testTo,
                subject: testSubject,
                html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                        <h2 style="color: #4f46e5;">Diagnostic Test Email</h2>
                        <p>This is a test email sent from the Traffic Cop Diagnostic Tool.</p>
                        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                        <p><strong>Sent To:</strong> ${testTo}</p>
                       </div>`,
                text: `Diagnostic Test Email\nTimestamp: ${new Date().toISOString()}`,
                from: testFrom || undefined // If empty, let function use default
            };

            const startTime = Date.now();
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: payload
            });
            const duration = Date.now() - startTime;

            if (error) {
                setTestResult({
                    success: false,
                    duration,
                    error: error.message,
                    raw: error
                });
            } else if (data && data.success === false) {
                 setTestResult({
                    success: false,
                    duration,
                    error: data.error,
                    details: data.details,
                    raw: data
                });
            } else {
                setTestResult({
                    success: true,
                    duration,
                    id: data?.id || 'Unknown ID',
                    raw: data
                });
            }

        } catch (e) {
            setTestResult({
                success: false,
                error: e.message,
                raw: e
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                    <Mail className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Email Diagnostics</h1>
                    <p className="text-slate-500">Test and verify the Resend email integration.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CONFIGURATION STATUS */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Configuration Check</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Sender Address (DB):</span>
                            {configCheck.loading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            ) : configCheck.senderEmailStatus === 'configured' ? (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Configured
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                                    <AlertTriangle className="w-3 h-3 mr-1" /> Missing
                                </Badge>
                            )}
                        </div>
                        {configCheck.senderEmail && (
                            <div className="text-xs font-mono bg-slate-100 p-2 rounded break-all">
                                {configCheck.senderEmail}
                            </div>
                        )}
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Resend Restriction</AlertTitle>
                            <AlertDescription className="text-xs">
                                If you haven't verified a custom domain (e.g., vent-guys.com), you can <strong>ONLY</strong> send emails to the address you signed up with.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                {/* TEST RUNNER */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Live Test</CardTitle>
                        <CardDescription>Send a real email to verify connectivity.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>From Address (Optional)</Label>
                                <Input 
                                    placeholder="onboarding@resend.dev" 
                                    value={testFrom} 
                                    onChange={e => setTestFrom(e.target.value)} 
                                />
                                <p className="text-xs text-slate-500">Leave empty to use default.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>To Address <span className="text-red-500">*</span></Label>
                                <Input 
                                    placeholder="your-email@example.com" 
                                    value={testTo} 
                                    onChange={e => setTestTo(e.target.value)} 
                                />
                            </div>
                        </div>

                        <Button onClick={runTest} disabled={loading} className="w-full">
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Test Email'}
                        </Button>

                        {/* RESULTS CONSOLE */}
                        {testResult && (
                            <div className={`mt-6 p-4 rounded-md border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {testResult.success ? (
                                        <CheckCircle2 className="text-green-600 w-5 h-5" />
                                    ) : (
                                        <XCircle className="text-red-600 w-5 h-5" />
                                    )}
                                    <span className={`font-bold ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                        {testResult.success ? 'Email Sent Successfully' : 'Sending Failed'}
                                    </span>
                                    <span className="text-xs text-slate-500 ml-auto">{testResult.duration}ms</span>
                                </div>
                                
                                {!testResult.success && (
                                    <div className="text-sm text-red-700 mb-2 font-medium">
                                        Error: {testResult.error}
                                    </div>
                                )}
                                
                                <div className="mt-2">
                                    <Label className="text-xs text-slate-500 mb-1 block">Raw API Response:</Label>
                                    <div className="bg-slate-900 text-slate-50 p-3 rounded text-xs font-mono overflow-auto max-h-40">
                                        <Terminal className="w-3 h-3 mb-2 text-slate-400" />
                                        <pre>{JSON.stringify(testResult.raw, null, 2)}</pre>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader><CardTitle>Troubleshooting Guide</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Error: "Domain not found" or "403 Forbidden"</h4>
                            <p className="mb-2">This usually means you are trying to send FROM a custom domain (e.g., <code>hello@vent-guys.com</code>) that hasn't been verified in Resend yet.</p>
                            <p><strong>Fix:</strong> Go to Resend Dashboard &gt; Domains and verify your domain records (DNS).</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Error: "Validation error" (on free plan)</h4>
                            <p className="mb-2">On the free plan using <code>onboarding@resend.dev</code>, you can ONLY send emails TO the email address you registered with.</p>
                            <p><strong>Fix:</strong> Verify a custom domain to remove this restriction.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default EmailDiagnostics;