import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle2, AlertOctagon, Terminal, Settings, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SendEmailTest = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState(null);
    
    // Form State
    const [formData, setFormData] = useState({
        to_email: '',
        subject: 'Test Email from Traffic Cop',
        estimate_id: '',
        from_email: '' // Optional override
    });

    const [responseLog, setResponseLog] = useState(null);

    useEffect(() => {
        fetchCurrentConfig();
    }, []);

    const fetchCurrentConfig = async () => {
        try {
            const { data } = await supabase.from('global_config').select('value').eq('key', 'EMAIL_SENDER_ADDRESS').single();
            setConfig(data?.value || 'Not Configured (Will use fallback)');
            if (data?.value) {
                setFormData(prev => ({ ...prev, from_email: data.value }));
            }
        } catch (e) {
            console.error("Config fetch error:", e);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResponseLog(null);

        if (!formData.to_email) {
            toast({ variant: "destructive", title: "Error", description: "Recipient email is required" });
            setLoading(false);
            return;
        }

        try {
            const startTime = Date.now();
            
            const fromAddr = formData.from_email || undefined; 

            // Payload
            const payload = {
                to: formData.to_email,
                subject: formData.subject,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #4f46e5; margin-top:0;">Test Message</h2>
                        <p>This is a verification email sent from the <strong>Traffic Cop Debugger</strong>.</p>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                        <p><strong>Estimate ID:</strong> ${formData.estimate_id || 'N/A'}</p>
                        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                    </div>
                `,
                from: fromAddr,
                text: `Test Message via Traffic Cop.\nTimestamp: ${new Date().toISOString()}`
            };

            // Call Edge Function
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: payload
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Handle Supabase Client Errors (Network, etc)
            if (error) {
                setResponseLog({
                    status: 'crash',
                    message: error.message,
                    duration,
                    raw: error
                });
                return;
            }

            // Handle Logical Errors returned by Function (success: false)
            if (data && data.success === false) {
                 setResponseLog({
                    status: 'failure',
                    message: data.error || 'Unknown Failure',
                    details: data.details,
                    duration,
                    raw: data
                });
            } else {
                // Success
                setResponseLog({
                    status: 'success',
                    message: 'Email accepted by Resend',
                    id: data?.id,
                    duration,
                    raw: data
                });
                toast({ title: "Success", description: "Email sent successfully!" });
            }

        } catch (err) {
            setResponseLog({
                status: 'crash',
                message: err.message,
                raw: err
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Email System Debugger</h1>
                <p className="text-slate-500">Test the Edge Function connectivity and Resend API status directly.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* LEFT COLUMN: FORM */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Send Test Email</CardTitle>
                            <CardDescription>
                                This form bypasses the UI service layer and hits the Edge Function directly.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSend} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>To Email <span className="text-red-500">*</span></Label>
                                    <Input 
                                        placeholder="e.g. your.name@gmail.com" 
                                        value={formData.to_email}
                                        onChange={e => setFormData({...formData, to_email: e.target.value})}
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Subject</Label>
                                    <Input 
                                        value={formData.subject}
                                        onChange={e => setFormData({...formData, subject: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>From Address (Optional)</Label>
                                    <Input 
                                        placeholder="e.g. office@vent-guys.com" 
                                        value={formData.from_email}
                                        onChange={e => setFormData({...formData, from_email: e.target.value})}
                                    />
                                    <Alert className="mt-2 bg-amber-50 border-amber-200">
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                        <AlertTitle className="text-amber-800">Sender Requirement</AlertTitle>
                                        <AlertDescription className="text-xs text-amber-700">
                                            You <strong>CANNOT</strong> send from @gmail.com or @yahoo.com.<br/>
                                            You MUST use your verified domain (e.g., <strong>office@vent-guys.com</strong>) OR <strong>onboarding@resend.dev</strong> (only works if sending to yourself).
                                        </AlertDescription>
                                    </Alert>
                                </div>

                                <div className="pt-4">
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Sending...</> : <><Send className="mr-2 h-4 w-4"/> Send Test Payload</>}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* CONFIG STATUS */}
                    <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 flex items-start gap-3">
                        <Settings className="w-5 h-5 text-slate-500 mt-0.5" />
                        <div className="text-sm">
                            <span className="font-semibold block text-slate-900">Current Database Configuration</span>
                            <span className="text-slate-600">EMAIL_SENDER_ADDRESS: </span>
                            <span className="font-mono bg-white px-1 rounded border">{config || 'Loading...'}</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: LOGS */}
                <div className="md:col-span-1">
                    <Card className="h-full border-slate-200 shadow-none bg-slate-50">
                        <CardHeader>
                            <CardTitle className="text-sm uppercase text-slate-500 font-bold tracking-wider">Live Log Output</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!responseLog ? (
                                <div className="text-center text-slate-400 py-12 text-sm">
                                    <Terminal className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    Waiting for test execution...
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className={`p-3 rounded-md border flex items-center gap-3 ${
                                        responseLog.status === 'success' ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-100 border-red-200 text-red-800'
                                    }`}>
                                        {responseLog.status === 'success' ? <CheckCircle2 className="w-5 h-5"/> : <AlertOctagon className="w-5 h-5"/>}
                                        <div className="font-bold text-sm">
                                            {responseLog.status === 'success' ? 'SUCCESS' : 'FAILED'}
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-500 flex justify-between">
                                        <span>Duration:</span>
                                        <span className="font-mono">{responseLog.duration}ms</span>
                                    </div>

                                    {responseLog.message && (
                                        <div className="text-sm font-medium text-slate-800 bg-white p-2 rounded border break-words">
                                            {responseLog.message}
                                        </div>
                                    )}

                                    {responseLog.details && (
                                        <div className="text-xs bg-red-50 p-2 rounded border border-red-100 text-red-600 font-mono break-all max-h-40 overflow-auto">
                                            DETAILS: {JSON.stringify(responseLog.details)}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-400">Raw JSON Response</Label>
                                        <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded-md overflow-x-auto font-mono leading-tight">
                                            {JSON.stringify(responseLog.raw, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SendEmailTest;