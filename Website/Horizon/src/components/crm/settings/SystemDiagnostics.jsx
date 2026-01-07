
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
    Activity, 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    Play, 
    Loader2, 
    Database, 
    Server, 
    Globe, 
    Shield, 
    Terminal,
    ChevronRight,
    Settings,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const SystemDiagnostics = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    
    // State
    const [isRunning, setIsRunning] = useState(false);
    const [backendReport, setBackendReport] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    const runBackendDiagnostics = async () => {
        setIsRunning(true);
        setBackendReport(null);
        try {
            const { data, error } = await supabase.functions.invoke('diagnostic-backend-performance');
            if (error) throw error;
            setBackendReport(data);
            toast({ title: "Diagnostics Complete", description: "Backend performance metrics updated." });
        } catch (error) {
            console.error(error);
            toast({ title: "Diagnostics Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsRunning(false);
        }
    };

    // --- UI Helpers ---

    const StatusBadge = ({ status, latency }) => {
        const isHealthy = status === 'ok';
        const isSlow = latency > 2000; // 2s threshold for "Slow" warning visually
        
        let variant = "bg-green-100 text-green-700 border-green-200";
        let icon = <CheckCircle2 className="w-3 h-3 mr-1" />;
        let label = "Healthy";

        if (!isHealthy) {
            variant = "bg-red-100 text-red-700 border-red-200";
            icon = <XCircle className="w-3 h-3 mr-1" />;
            label = "Error";
        } else if (isSlow) {
            variant = "bg-amber-100 text-amber-700 border-amber-200";
            icon = <AlertTriangle className="w-3 h-3 mr-1" />;
            label = "Slow";
        }

        return (
            <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("px-2 py-0.5 h-6", variant)}>
                    {icon} {label}
                </Badge>
                {latency !== undefined && (
                    <span className={cn("text-xs font-mono", latency > 1000 ? "text-amber-600" : "text-slate-500")}>
                        {latency}ms
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen space-y-8 font-sans">
            <Helmet><title>System Diagnostics | Settings</title></Helmet>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <Activity className="w-8 h-8 text-blue-600" />
                        System Diagnostics
                    </h1>
                    <p className="text-slate-500 text-lg mt-1">Real-time infrastructure health check and validation.</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        size="lg" 
                        onClick={() => navigate('/crm/advanced-diagnostics')} 
                        variant="outline"
                        className="bg-white hover:bg-slate-50"
                    >
                         Advanced Diagnostics <ChevronRight className="ml-2 w-4 h-4"/>
                    </Button>
                    <Button 
                        size="lg" 
                        onClick={runBackendDiagnostics} 
                        disabled={isRunning}
                        className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
                    >
                        {isRunning ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Play className="mr-2 h-5 w-5 fill-current"/>}
                        Run Backend Scan
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left: Report Card */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-md border-slate-200 min-h-[400px]">
                        <CardHeader className="bg-slate-50/50 border-b pb-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                        <Server className="w-5 h-5 text-slate-500" /> 
                                        Backend Performance Report
                                    </CardTitle>
                                    <CardDescription>Latency and health of Edge Functions & External APIs.</CardDescription>
                                </div>
                                {backendReport && (
                                    <Badge variant={backendReport.overall_status === 'healthy' ? 'default' : 'destructive'} 
                                           className={backendReport.overall_status === 'healthy' ? 'bg-emerald-600' : ''}>
                                        Status: {backendReport.overall_status.toUpperCase()}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {!backendReport && !isRunning && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Zap className="w-12 h-12 mb-4 opacity-20" />
                                    <p>Ready to scan. Click "Run Backend Scan" to begin.</p>
                                </div>
                            )}

                            {isRunning && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                                    <p className="text-slate-600 font-medium">Probing Edge Network...</p>
                                    <p className="text-slate-400 text-sm mt-1">Checking OpenAI, Google Maps, and Email Services</p>
                                </div>
                            )}

                            {backendReport && (
                                <div className="divide-y divide-slate-100">
                                    {/* Services Section */}
                                    <div className="p-4 bg-slate-50/30">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">External Services</h3>
                                        <div className="space-y-2">
                                            {backendReport.services.map((svc, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <Globe className="w-4 h-4 text-slate-400" />
                                                        <span className="font-medium text-slate-700">{svc.name}</span>
                                                    </div>
                                                    <StatusBadge status={svc.status} latency={svc.duration} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Functions Section */}
                                    <div className="p-4">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">Edge Functions</h3>
                                        <div className="space-y-2">
                                            {backendReport.functions.map((fn, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <Terminal className="w-4 h-4 text-slate-400" />
                                                        <span className="font-medium text-slate-700 font-mono text-sm">{fn.name}</span>
                                                    </div>
                                                    <StatusBadge status={fn.status} latency={fn.duration} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Quick Stats or History */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Service Availability</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-slate-900">
                                    {backendReport ? '100%' : '--'}
                                </span>
                                <span className="text-sm text-green-600 font-medium">Operational</span>
                            </div>
                            <Progress value={100} className="h-2 mt-3 bg-slate-100" indicatorClassName="bg-green-500" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Avg. Function Latency</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-slate-900">
                                    {backendReport ? 
                                        Math.round(backendReport.functions.reduce((acc, curr) => acc + curr.duration, 0) / backendReport.functions.length) 
                                        : '--'}
                                    <span className="text-sm text-slate-400 font-normal ml-1">ms</span>
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Target: &lt; 500ms</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SystemDiagnostics;
