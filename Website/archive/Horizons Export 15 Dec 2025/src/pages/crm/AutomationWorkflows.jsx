import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/customSupabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Zap, Play, Plus, Trash2, Activity, CheckCircle, XCircle, Tag, Mail, MessageSquare, CheckSquare, Settings } from "lucide-react";
import { format } from 'date-fns';

const TRIGGER_TYPES = [
    { value: 'appointment_completed', label: 'Appointment Completed' },
    { value: 'lead_created', label: 'New Lead Created' },
    { value: 'review_received', label: 'Review Received' },
    { value: 'daily_check', label: 'Daily Recurring Check' }
];

const ACTION_TYPES = [
    { value: 'send_email', label: 'Send Email', icon: Mail },
    { value: 'send_sms', label: 'Send SMS', icon: MessageSquare },
    { value: 'create_task', label: 'Create Admin Task', icon: CheckSquare },
    { value: 'tag_customer', label: 'Tag Customer', icon: Tag }
];

const TEMPLATES = [
    {
        name: "Post-Job Review Request",
        trigger_type: "appointment_completed",
        actions_json: [
            { type: "send_email", config: { subject: "How did we do?", body: "Thanks for choosing TVG! Please leave us a review." } },
            { type: "tag_customer", config: { tag: "Needs Review" } }
        ]
    },
    {
        name: "High Value Client Tagging",
        trigger_type: "appointment_completed",
        trigger_condition: { "is_high_value": true }, 
        actions_json: [
            { type: "tag_customer", config: { tag: "VIP" } },
            { type: "create_task", config: { task_name: "Send VIP Welcome Gift" } }
        ]
    },
    {
        name: "Annual Maintenance Reminder",
        trigger_type: "daily_check",
        actions_json: [
            { type: "send_email", config: { subject: "It's been a year!", body: "Time to schedule your annual cleaning." } }
        ]
    }
];

export default function AutomationWorkflows() {
    const { toast } = useToast();
    const [workflows, setWorkflows] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    // Editor State
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        trigger_type: "appointment_completed",
        trigger_condition: "{}",
        actions: [],
        enabled: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: wfData } = await supabase.from('automation_workflows').select('*').order('created_at', { ascending: false });
            setWorkflows(wfData || []);

            const { data: logData } = await supabase.from('automation_logs')
                .select('*, automation_workflows(name)')
                .order('executed_at', { ascending: false })
                .limit(50);
            setLogs(logData || []);
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Error", description: "Failed to load automation data." });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            let conditionParsed = {};
            try {
                conditionParsed = JSON.parse(formData.trigger_condition);
            } catch (e) {
                toast({ variant: "destructive", title: "Invalid Condition JSON", description: "Please check the JSON syntax." });
                return;
            }

            const payload = {
                name: formData.name,
                trigger_type: formData.trigger_type,
                trigger_condition: conditionParsed,
                actions_json: formData.actions,
                enabled: formData.enabled
            };

            if (editingId) {
                const { error } = await supabase.from('automation_workflows').update(payload).eq('id', editingId);
                if (error) throw error;
                toast({ title: "Updated", description: "Workflow updated successfully." });
            } else {
                const { error } = await supabase.from('automation_workflows').insert([payload]);
                if (error) throw error;
                toast({ title: "Created", description: "Workflow created successfully." });
            }
            
            setIsDialogOpen(false);
            fetchData();
        } catch (err) {
            toast({ variant: "destructive", title: "Save Failed", description: err.message });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this workflow?")) return;
        try {
            await supabase.from('automation_workflows').delete().eq('id', id);
            toast({ title: "Deleted", description: "Workflow removed." });
            fetchData();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    };

    const loadTemplate = (template) => {
        setFormData({
            name: template.name,
            trigger_type: template.trigger_type,
            trigger_condition: JSON.stringify(template.trigger_condition || {}, null, 2),
            actions: template.actions_json,
            enabled: true
        });
    };

    const startEdit = (wf) => {
        setEditingId(wf.id);
        setFormData({
            name: wf.name,
            trigger_type: wf.trigger_type,
            trigger_condition: JSON.stringify(wf.trigger_condition || {}, null, 2),
            actions: wf.actions_json || [],
            enabled: wf.enabled
        });
        setIsDialogOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            name: "",
            trigger_type: "appointment_completed",
            trigger_condition: "{}",
            actions: [],
            enabled: true
        });
    };

    const addAction = (type) => {
        const newAction = { type, config: {} };
        if (type === 'send_email') newAction.config = { subject: "Subject Line", body: "Message body..." };
        if (type === 'send_sms') newAction.config = { message: "SMS Content..." };
        if (type === 'create_task') newAction.config = { task_name: "Follow up task" };
        if (type === 'tag_customer') newAction.config = { tag: "New Tag" };
        
        setFormData(prev => ({ ...prev, actions: [...prev.actions, newAction] }));
    };

    const updateActionConfig = (index, key, value) => {
        const newActions = [...formData.actions];
        newActions[index].config[key] = value;
        setFormData(prev => ({ ...prev, actions: newActions }));
    };

    const removeAction = (index) => {
        setFormData(prev => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }));
    };

    const testWorkflow = async (wf) => {
        toast({ title: "Testing...", description: "Simulating execution for a sample lead." });
        try {
             // Mock context
             const context = {
                 lead_id: 'sample-lead-id',
                 lead_name: 'Test User',
                 email: 'test@example.com',
                 phone: '555-000-0000',
                 service_category: 'Dryer Vent' // Sample data
             };
             
             await supabase.functions.invoke('evaluate-workflows', {
                 body: { trigger_type: wf.trigger_type, context }
             });
             
             toast({ title: "Test Complete", description: "Check logs for results." });
             fetchData(); // Refresh logs
        } catch (err) {
            toast({ variant: "destructive", title: "Test Failed", description: err.message });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Marketing Automations</h1>
                    <p className="text-muted-foreground">Manage lifecycle campaigns, triggers, and automated actions.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2" /> New Workflow
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Edit Workflow' : 'Create Automation Workflow'}</DialogTitle>
                        </DialogHeader>
                        
                        {!editingId && (
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                {TEMPLATES.map((t, i) => (
                                    <Button key={i} variant="outline" size="sm" onClick={() => loadTemplate(t)} className="whitespace-nowrap">
                                        <Zap className="w-3 h-3 mr-1 text-yellow-500" /> {t.name}
                                    </Button>
                                ))}
                            </div>
                        )}

                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Workflow Name</Label>
                                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Post-Appointment Follow-up" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Trigger Event</Label>
                                    <Select value={formData.trigger_type} onValueChange={v => setFormData({...formData, trigger_type: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Trigger Conditions (JSON)</Label>
                                <div className="bg-slate-900 rounded-md p-2">
                                    <textarea 
                                        className="w-full bg-transparent text-slate-100 font-mono text-sm resize-y outline-none h-20"
                                        value={formData.trigger_condition}
                                        onChange={e => setFormData({...formData, trigger_condition: e.target.value})}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Optional. E.g. {"{ \"service_category\": \"Dryer Vent\" }"}</p>
                            </div>

                            <div className="space-y-4 border-t pt-4">
                                <div className="flex justify-between items-center">
                                    <Label className="text-lg">Actions Queue</Label>
                                    <div className="flex gap-2">
                                        {ACTION_TYPES.map(type => (
                                            <Button key={type.value} variant="outline" size="sm" onClick={() => addAction(type.value)}>
                                                <type.icon className="w-3 h-3 mr-1" /> {type.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                
                                {formData.actions.length === 0 && (
                                    <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground text-sm">
                                        No actions defined. Add one above.
                                    </div>
                                )}

                                {formData.actions.map((action, idx) => (
                                    <Card key={idx} className="relative">
                                        <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-red-400" onClick={() => removeAction(idx)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                        <CardContent className="p-4 space-y-3">
                                            <div className="flex items-center gap-2 font-medium text-sm">
                                                <span className="bg-slate-100 p-1 rounded">{idx + 1}</span>
                                                <span className="uppercase text-slate-500 text-xs">{action.type.replace('_', ' ')}</span>
                                            </div>
                                            
                                            {action.type === 'send_email' && (
                                                <>
                                                    <Input placeholder="Subject" value={action.config.subject} onChange={e => updateActionConfig(idx, 'subject', e.target.value)} />
                                                    <Input placeholder="Body Text" value={action.config.body} onChange={e => updateActionConfig(idx, 'body', e.target.value)} />
                                                </>
                                            )}
                                            {action.type === 'send_sms' && (
                                                <Input placeholder="SMS Message" value={action.config.message} onChange={e => updateActionConfig(idx, 'message', e.target.value)} />
                                            )}
                                            {action.type === 'create_task' && (
                                                <Input placeholder="Task Name" value={action.config.task_name} onChange={e => updateActionConfig(idx, 'task_name', e.target.value)} />
                                            )}
                                            {action.type === 'tag_customer' && (
                                                <Input placeholder="Tag Name" value={action.config.tag} onChange={e => updateActionConfig(idx, 'tag', e.target.value)} />
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="flex items-center space-x-2 pt-4 border-t">
                                <Switch checked={formData.enabled} onCheckedChange={c => setFormData({...formData, enabled: c})} />
                                <Label>Workflow Enabled</Label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                             <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                             <Button onClick={handleSave}>Save Definition</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="workflows">
                <TabsList>
                    <TabsTrigger value="workflows">Active Workflows</TabsTrigger>
                    <TabsTrigger value="logs">Execution Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="workflows" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? <div className="col-span-3 text-center py-10"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div> : 
                         workflows.map(wf => (
                             <Card key={wf.id} className={!wf.enabled ? 'opacity-60' : ''}>
                                 <CardHeader className="pb-3">
                                     <div className="flex justify-between items-start">
                                         <Badge variant={wf.enabled ? 'default' : 'secondary'}>{wf.enabled ? 'Active' : 'Disabled'}</Badge>
                                         <div className="flex gap-1">
                                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => testWorkflow(wf)}><Play className="w-3 h-3 text-green-600"/></Button>
                                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(wf)}><Settings className="w-3 h-3"/></Button>
                                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(wf.id)}><Trash2 className="w-3 h-3 text-red-500"/></Button>
                                         </div>
                                     </div>
                                     <CardTitle className="text-lg mt-2">{wf.name}</CardTitle>
                                     <CardDescription className="flex items-center gap-1">
                                         <Zap className="w-3 h-3" /> Trigger: {wf.trigger_type}
                                     </CardDescription>
                                 </CardHeader>
                                 <CardContent>
                                     <div className="text-sm text-slate-500">
                                         <div className="font-medium mb-1 text-slate-700">Actions:</div>
                                         <ul className="list-disc list-inside space-y-1">
                                             {(wf.actions_json || []).map((a, i) => (
                                                 <li key={i}>{a.type.replace('_', ' ')}</li>
                                             ))}
                                         </ul>
                                     </div>
                                 </CardContent>
                             </Card>
                         ))
                        }
                    </div>
                </TabsContent>

                <TabsContent value="logs" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Executions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Workflow</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {format(new Date(log.executed_at), 'MMM d, HH:mm')}
                                            </TableCell>
                                            <TableCell className="font-medium">{log.automation_workflows?.name || 'Unknown'}</TableCell>
                                            <TableCell className="capitalize">{log.action_type.replace('_', ' ')}</TableCell>
                                            <TableCell>
                                                {log.status === 'success' ? 
                                                    <span className="flex items-center text-green-600 text-xs"><CheckCircle className="w-3 h-3 mr-1"/> Success</span> : 
                                                    <span className="flex items-center text-red-600 text-xs"><XCircle className="w-3 h-3 mr-1"/> Failed</span>
                                                }
                                            </TableCell>
                                            <TableCell className="text-xs max-w-xs truncate font-mono text-slate-500">
                                                {JSON.stringify(log.details)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No logs found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}