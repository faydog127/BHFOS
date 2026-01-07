import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format, addDays } from 'date-fns';

const SMSTemplateModal = ({ open, onOpenChange, lead, onSent }) => {
    const { toast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (open && lead) {
            fetchTemplates();
        }
    }, [open, lead]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            // Fetch templates matching lane_type OR general
            const { data, error } = await supabase
                .from('sms_templates')
                .select('*')
                .or(`lane_type.eq.${lead.lane_type},lane_type.eq.general`)
                .order('name');

            if (error) throw error;
            setTemplates(data || []);
            
            // Auto-select first relevant template
            if (data && data.length > 0) {
                // Prefer lane-specific over general
                const preferred = data.find(t => t.lane_type === lead.lane_type) || data[0];
                handleTemplateSelect(preferred.id, preferred, data);
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load templates.' });
        } finally {
            setLoading(false);
        }
    };

    const handleTemplateSelect = (templateId, templateObj = null, allTemplates = templates) => {
        setSelectedTemplateId(templateId);
        const template = templateObj || allTemplates.find(t => t.id === templateId);
        
        if (template) {
            // Hydrate variables
            let text = template.template_text;
            
            const replacements = {
                '{customer_name}': lead.title?.split(' ')[0] || 'Customer',
                '{service_type}': lead.service_type || 'service',
                '{price}': lead.value ? `${lead.value}` : '150',
                '{date}': format(addDays(new Date(), 1), 'EEEE'),
                '{time}': '10:00 AM',
                '{date1}': format(addDays(new Date(), 1), 'EEEE'),
                '{time1}': '2:00 PM',
                '{date2}': format(addDays(new Date(), 2), 'Thursday'),
                '{time2}': '10:00 AM'
            };

            Object.keys(replacements).forEach(key => {
                text = text.replaceAll(key, replacements[key]);
            });

            setMessageText(text);
        }
    };

    const handleSend = async () => {
        if (!messageText) return;
        setSending(true);
        try {
            // 1. Log to SMS history (using existing sms_messages or similar)
            const { error: msgError } = await supabase.from('sms_messages').insert({
                lead_id: lead.id,
                direction: 'outbound',
                body: messageText,
                status: 'sent'
            });
            if (msgError) throw msgError;

            // 2. Mock sending via provider (Edge Function placeholder)
            // await supabase.functions.invoke('send-sms', { body: { ... } });

            // 3. Auto-update stage based on lane logic
            let nextStage = null;
            if (lead.lane_type === 'fast_lane') {
                // Fast lane moves to Quote Sent immediately upon SMS
                nextStage = 'quoted';
            } else {
                // Consultative moves to Contacted
                nextStage = 'working';
            }

            // Only update if not already further along
            if (lead.stage_id === 'col_new') {
                await supabase.from('leads').update({ pipeline_stage: nextStage }).eq('id', lead.id);
                toast({ title: "Lead Advanced", description: `Moved to ${nextStage === 'quoted' ? 'Quote Sent' : 'Contacted'}` });
            }

            toast({ title: "SMS Sent", description: "Message queued successfully." });
            if (onSent) onSent();
            onOpenChange(false);

        } catch (error) {
            console.error('Error sending SMS:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        Send SMS to {lead?.title}
                    </DialogTitle>
                    <DialogDescription>
                        Select a template to quickly message this {lead?.lane_type?.replace('_', ' ')} lead.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Template</Label>
                        <Select 
                            value={selectedTemplateId} 
                            onValueChange={(val) => handleTemplateSelect(val)}
                            disabled={loading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a template..." />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.lane_type === 'fast_lane' ? '⚡ ' : t.lane_type === 'consultative' ? '🎯 ' : '📝 '}
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Message Preview <span className="text-xs text-slate-400 font-normal">(Editable)</span></Label>
                        <Textarea 
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            className="h-[150px] font-mono text-sm bg-slate-50"
                            placeholder="Select a template or type your message..."
                        />
                        <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>{messageText.length} characters</span>
                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                {lead?.lane_type === 'fast_lane' ? 'Fast Lane Protocol Active' : 'Consultative Protocol Active'}
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSend} disabled={sending || !messageText} className="bg-blue-600 hover:bg-blue-700">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        Send SMS
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SMSTemplateModal;