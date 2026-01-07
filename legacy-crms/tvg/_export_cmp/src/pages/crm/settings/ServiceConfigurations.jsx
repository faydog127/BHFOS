import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
    Server, ShieldCheck, CreditCard, Mail, MessageSquare, Plus, Settings, 
    Activity, Loader2, Trash2, Eye, EyeOff, Lock, Network, Zap, 
    AlertTriangle, CheckCircle2, RotateCw, ExternalLink, Globe, Key, FileText
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import BulkOperations from '@/components/BulkOperations';

const ServiceConfigurations = () => {
    const { toast } = useToast();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('integrations');
    const [role, setRole] = useState('admin'); // Mocked role: 'admin' or 'manager'

    useEffect(() => {
        fetchServices();
        // Mock checking role
        checkUserRole();
    }, []);

    const checkUserRole = async () => {
        // In real app, fetch from app_user_roles or context
        setRole('admin'); 
    };

    const fetchServices = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('service_configurations')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load services.' });
        } else {
            setServices(data || []);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
                        <Server className="w-6 h-6 text-blue-600" /> Platform Integrations
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage external services, API keys, and system connectivity.</p>
                </div>
                {activeTab === 'integrations' && (
                    <div className="flex gap-2">
                        <BulkOperations tableName="service_configurations" label="Configs" onImportSuccess={fetchServices} />
                        <Button variant="default" size="sm" className="bg-blue-600">
                             <Plus className="w-4 h-4 mr-2" /> Add Service
                        </Button>
                    </div>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-white p-1 border">
                    <TabsTrigger value="integrations" className="data-[state=active]:bg-slate-100"><Network className="w-4 h-4 mr-2"/> Connected Services</TabsTrigger>
                    <TabsTrigger value="usage" className="data-[state=active]:bg-slate-100"><Activity className="w-4 h-4 mr-2"/> Usage & Limits</TabsTrigger>
                    <TabsTrigger value="environment" className="data-[state=active]:bg-slate-100"><Globe className="w-4 h-4 mr-2"/> Environment</TabsTrigger>
                    <TabsTrigger value="webhooks" className="data-[state=active]:bg-slate-100"><Zap className="w-4 h-4 mr-2"/> Webhooks</TabsTrigger>
                </TabsList>

                <TabsContent value="integrations">
                    <IntegrationsList services={services} refresh={fetchServices} role={role} />
                </TabsContent>

                <TabsContent value="usage">
                    <UsageDashboard services={services} />
                </TabsContent>

                <TabsContent value="environment">
                    <EnvironmentAudit services={services} />
                </TabsContent>

                <TabsContent value="webhooks">
                    <WebhooksManager services={services} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

// --- Sub-Components ---

const IntegrationsList = ({ services, refresh, role }) => {
    const { toast } = useToast();
    const [testingId, setTestingId] = useState(null);

    const handleTestConnection = async (service) => {
        setTestingId(service.id);
        
        // Mock API Test Latency
        await new Promise(r => setTimeout(r, 1500));
        
        // Basic check if keys exist
        const hasKeys = service.credentials && Object.values(service.credentials).some(v => v && v.length > 5);
        
        if (hasKeys) {
            toast({ title: "Connection Verified", description: `Successfully connected to ${service.service_name}.` });
            // Update last tested
            await supabase.from('service_configurations').update({
                config: { ...service.config, last_tested: new Date().toISOString(), status: 'healthy' }
            }).eq('id', service.id);
            refresh();
        } else {
             toast({ variant: "destructive", title: "Connection Failed", description: "Invalid or missing credentials." });
             await supabase.from('service_configurations').update({
                config: { ...service.config, last_tested: new Date().toISOString(), status: 'error' }
            }).eq('id', service.id);
            refresh();
        }
        setTestingId(null);
    };

    const isExpiring = (dateStr) => {
        if (!dateStr) return false;
        return differenceInDays(new Date(), new Date(dateStr)) > 90;
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {services.map(service => {
                const isHealthy = service.config?.status === 'healthy';
                const lastTested = service.config?.last_tested;
                const needsRotation = isExpiring(service.updated_at);
                
                return (
                    <Card key={service.id} className="border-t-4 border-t-slate-200 data-[active=true]:border-t-green-500" data-active={service.is_active}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-slate-100 rounded-lg">
                                        {service.service_key.includes('twilio') ? <MessageSquare className="w-5 h-5 text-blue-500"/> :
                                         service.service_key.includes('stripe') ? <CreditCard className="w-5 h-5 text-indigo-500"/> :
                                         service.service_key.includes('sendgrid') ? <Mail className="w-5 h-5 text-orange-500"/> :
                                         <Server className="w-5 h-5 text-slate-500"/>}
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">{service.service_name}</CardTitle>
                                        <CardDescription className="text-xs font-mono">{service.service_key}</CardDescription>
                                    </div>
                                </div>
                                <Switch checked={service.is_active} disabled={role !== 'admin'} />
                            </div>
                        </CardHeader>
                        <CardContent className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 bg-slate-50 rounded border">
                                    <span className="text-muted-foreground block">Status</span>
                                    <span className={`font-bold flex items-center gap-1 ${isHealthy ? 'text-green-600' : 'text-slate-500'}`}>
                                        {isHealthy ? <CheckCircle2 className="w-3 h-3"/> : <AlertTriangle className="w-3 h-3"/>}
                                        {isHealthy ? 'Operational' : 'Unknown'}
                                    </span>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border">
                                    <span className="text-muted-foreground block">Last Checked</span>
                                    <span className="font-medium">
                                        {lastTested ? format(new Date(lastTested), 'MMM d, h:mm a') : 'Never'}
                                    </span>
                                </div>
                            </div>

                            {needsRotation && (
                                <div className="flex items-center gap-2 p-2 bg-yellow-50 text-yellow-800 rounded text-xs border border-yellow-200">
                                    <RotateCw className="w-3 h-3" />
                                    <span>Credentials age > 90 days. Rotate recommended.</span>
                                </div>
                            )}

                            {/* Dependencies Map (Mocked) */}
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground font-medium">Powering Features:</span>
                                <div className="flex flex-wrap gap-1">
                                    {service.service_key === 'twilio' && <Badge variant="secondary" className="text-[10px]">SMS Campaigns</Badge>}
                                    {service.service_key === 'twilio' && <Badge variant="secondary" className="text-[10px]">2FA</Badge>}
                                    {service.service_key === 'sendgrid' && <Badge variant="secondary" className="text-[10px]">Email Blasts</Badge>}
                                    {service.service_key === 'stripe' && <Badge variant="secondary" className="text-[10px]">Invoicing</Badge>}
                                    {(!['twilio','stripe','sendgrid'].includes(service.service_key)) && <Badge variant="secondary" className="text-[10px] text-gray-400">Custom Integration</Badge>}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0 flex gap-2">
                             <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => handleTestConnection(service)} disabled={testingId === service.id}>
                                {testingId === service.id ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Activity className="w-3 h-3 mr-1"/>}
                                Test Connection
                             </Button>
                             {role === 'admin' && (
                                <Button variant="secondary" size="sm" className="w-full text-xs">
                                    <Settings className="w-3 h-3 mr-1"/> Config
                                </Button>
                             )}
                        </CardFooter>
                    </Card>
                )
            })}
        </div>
    );
};

const UsageDashboard = ({ services }) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {services.map(s => (
                    <Card key={s.id}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">{s.service_name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-muted-foreground">API Calls (This Month)</span>
                                    <span className="font-bold">1,240 / 10,000</span>
                                </div>
                                <Progress value={12} className="h-2" />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-muted-foreground">Rate Limit (Req/Min)</span>
                                    <span className="font-bold">45 / 60</span>
                                </div>
                                <Progress value={75} className="h-2 bg-slate-100" indicatorClassName={75 > 80 ? "bg-red-500" : "bg-blue-500"} />
                            </div>
                            <div className="pt-2 border-t flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Est. Cost</span>
                                <span className="text-sm font-bold text-green-600">$12.50</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Rate Limiting Configuration</CardTitle>
                    <CardDescription>Set client-side throttling to prevent overage charges.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {services.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Server className="w-4 h-4 text-slate-400" />
                                    <span className="font-medium text-sm">{s.service_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input className="w-20 h-8 text-right" defaultValue={60} />
                                    <span className="text-xs text-muted-foreground">req/min</span>
                                    <Button variant="ghost" size="sm" className="h-8">Save</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const EnvironmentAudit = ({ services }) => {
    // Check known env vars
    const requiredVars = [
        { key: 'VITE_SUPABASE_URL', label: 'Supabase URL', exists: !!import.meta.env.VITE_SUPABASE_URL },
        { key: 'VITE_SUPABASE_ANON_KEY', label: 'Supabase Anon Key', exists: !!import.meta.env.VITE_SUPABASE_ANON_KEY },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Environment Variables</CardTitle>
                    <CardDescription>Client-side configuration check.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {requiredVars.map((v, i) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded border">
                                <code className="text-xs font-mono text-slate-700">{v.key}</code>
                                {v.exists ? 
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Present</Badge> : 
                                    <Badge variant="destructive">Missing</Badge>
                                }
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Documentation Library</CardTitle>
                    <CardDescription>Quick links to service provider docs.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <a href="https://www.twilio.com/docs/sms" target="_blank" className="flex items-center justify-between p-3 hover:bg-slate-50 rounded border transition-colors">
                            <span className="text-sm font-medium">Twilio SMS API</span>
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                        <a href="https://stripe.com/docs/api" target="_blank" className="flex items-center justify-between p-3 hover:bg-slate-50 rounded border transition-colors">
                            <span className="text-sm font-medium">Stripe API Reference</span>
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                        <a href="https://sendgrid.com/docs/API_Reference/index.html" target="_blank" className="flex items-center justify-between p-3 hover:bg-slate-50 rounded border transition-colors">
                            <span className="text-sm font-medium">SendGrid V3 API</span>
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const WebhooksManager = ({ services }) => {
    const { toast } = useToast();
    
    const copyWebhook = (service) => {
        // Generate a mock unique webhook URL
        const url = `https://api.theventguys.com/webhooks/v1/${service.service_key}/${service.id.slice(0,8)}`;
        navigator.clipboard.writeText(url);
        toast({ title: "Copied!", description: "Webhook URL copied to clipboard." });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Inbound Webhooks</CardTitle>
                <CardDescription>Unique endpoints for receiving service events.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {services.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-full">
                                    <Zap className="w-4 h-4 text-yellow-600" />
                                </div>
                                <div>
                                    <div className="font-medium text-sm">{s.service_name} Hook</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Lock className="w-3 h-3" /> Secret: ••••••••
                                    </div>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => copyWebhook(s)}>
                                <FileText className="w-3 h-3 mr-2" /> Copy URL
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default ServiceConfigurations;