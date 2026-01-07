import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { logAndSendAction } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Mail, MessageSquare, Send, Zap } from 'lucide-react';

const AutomatedActionsModal = ({ isOpen, onOpenChange, lead, finalOutcome, suggestions, isLoadingSuggestions }) => {
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (suggestions && suggestions.length > 0) {
            setSelectedTemplate(suggestions[0]);
        } else {
            setSelectedTemplate(null);
        }
    }, [suggestions]);

    const handleSend = async () => {
        if (!selectedTemplate || !lead) return;
        setIsSending(true);
        
        const payload = {
            lead_id: lead.id,
            final_outcome: finalOutcome,
            template_id: selectedTemplate.template_id,
            channels: selectedTemplate.channels,
            merge_data: { // This should be dynamically generated or passed in
                first_name: lead.first_name || lead.company || "Customer",
                address: lead.address || "Their Location",
                appt_date: "Tomorrow",
                appt_time: "10:00 AM",
                prep_tips_url: "https://yoursite.com/prep",
                rep_name: "Your Rep"
            },
            suggestion_source: selectedTemplate.source_rule_id,
            ab_variant: selectedTemplate.ab_variant || 'A',
        };

        try {
            const { ok, data, error } = await logAndSendAction(payload);
            if (!ok) throw new Error(data?.error || error || 'Unknown error');

            toast({
                title: 'Action Sent!',
                description: `Template "${selectedTemplate.template_id}" sent via ${selectedTemplate.channels.join(', ')}.`,
            });
            onOpenChange(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Send Failed',
                description: error.message,
            });
        } finally {
            setIsSending(false);
        }
    };

    const ChannelIcons = ({ channels }) => (
        <div className="flex items-center gap-2">
            {channels.includes('email') && <Mail className="h-4 w-4 text-gray-500" />}
            {channels.includes('sms') && <MessageSquare className="h-4 w-4 text-gray-500" />}
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-gray-50">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Zap className="text-yellow-500" /> SmartDocs Automation
                    </DialogTitle>
                    <DialogDescription>
                        AI suggests these actions based on the call outcome: <span className="font-bold text-blue-600">{finalOutcome}</span>
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                    {isLoadingSuggestions ? (
                        <div className="text-center p-8">Loading suggestions...</div>
                    ) : suggestions && suggestions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {suggestions.map((s, i) => (
                                <Card 
                                    key={i} 
                                    className={`cursor-pointer transition-all ${selectedTemplate?.template_id === s.template_id ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'}`}
                                    onClick={() => setSelectedTemplate(s)}
                                >
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-base font-semibold">{s.template_id}</CardTitle>
                                        {selectedTemplate?.template_id === s.template_id && <CheckCircle className="h-5 w-5 text-blue-500" />}
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-gray-600 mb-2">{s.reason}</p>
                                        <ChannelIcons channels={s.channels} />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-white rounded-lg">No suggestions found for this outcome.</div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={!selectedTemplate || isSending || isLoadingSuggestions}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isSending ? 'Sending...' : <><Send className="h-4 w-4 mr-2" /> Send Action</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AutomatedActionsModal;