import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Send } from 'lucide-react';
import { sendEstimateDocument } from '@/services/documentDeliveryService';
import { resolveLeadDelivery } from '@/lib/documentDelivery';

const SendEstimateModal = ({ open, onOpenChange, estimate, lead }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [sendChannel, setSendChannel] = useState('email');
    const [formData, setFormData] = useState({
        to_email: '',
        to_phone: '',
        subject: '',
        message: ''
    });

    // Reset/Pre-fill form when modal opens
    useEffect(() => {
        if (open && lead && estimate) {
            // Handle different lead name structures (DB vs Mock)
            const customerName = lead.customer_name 
                ? lead.customer_name 
                : (lead.first_name ? `${lead.first_name} ${lead.last_name || ''}` : 'Customer');
            
            const estNumber = estimate.estimate_number || 'New Estimate';
            
            setFormData({
                to_email: lead.email || '',
                to_phone: lead.phone || '',
                subject: `Your Quote from The Vent Guys - ${estNumber}`,
                message: `Hi ${customerName},\n\nIt was great speaking with you. I've prepared your quote for the requested services.\n\nPlease review the scope and pricing in the link below. If everything looks good, you can approve it directly and we will move it into scheduling.\n\nBest regards,\nThe Vent Guys Team`
            });
            const preferredDelivery = resolveLeadDelivery({ lead });
            if (preferredDelivery.channel) {
              setSendChannel(preferredDelivery.channel);
            }
        }
    }, [open, lead, estimate]);

    const handleSend = async () => {
        const deliveryLead = {
          ...lead,
          email: formData.to_email,
          phone: formData.to_phone,
        };
        const deliveryPlan = resolveLeadDelivery({ lead: deliveryLead, requestedChannel: sendChannel });

        if (!deliveryPlan.channel) {
            toast({ variant: 'destructive', title: 'Error', description: 'A valid email address or textable phone number is required.' });
            return;
        }

        setLoading(true);
        try {
            const result = await sendEstimateDocument({
                estimateId: estimate.id,
                lead,
                deliveryChannel: sendChannel,
                recipientEmail: formData.to_email,
                recipientPhone: formData.to_phone,
                customSubject: sendChannel === 'email' ? formData.subject : undefined,
                customBodyHtml: sendChannel === 'email' ? formData.message.replace(/\n/g, '<br/>') : undefined,
            });
            const deliveryChannel = result?.delivery_channel || sendChannel;
            const requestedChannel = result?.requested_delivery_channel || sendChannel;
            const usedFallback = requestedChannel !== deliveryChannel;

            if (result) {
                toast({ 
                    title: 'Quote Sent',
                    description:
                      deliveryChannel === 'sms'
                        ? (usedFallback
                          ? 'Email was unavailable, so the quote was texted to the customer.'
                          : 'Quote texted to the customer successfully.')
                        : (usedFallback
                          ? 'SMS was unavailable, so the quote was emailed to the customer.'
                          : `Successfully sent quote to ${formData.to_email}.`),
                    className: "bg-green-50 border-green-200"
                });
            } else {
                toast({ 
                    variant: 'destructive', 
                    title: 'Sending Failed', 
                    description: result.error || 'Unknown error occurred.' 
                });
            }
        } catch (error) {
            toast({ 
                variant: 'destructive', 
                title: 'Error', 
                description: error.message 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Send Quote</DialogTitle>
                    <DialogDescription>
                        Send the released quote directly to the customer.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="send_channel">Send Via</Label>
                        <Select value={sendChannel} onValueChange={setSendChannel}>
                            <SelectTrigger id="send_channel">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="to_email">{sendChannel === 'sms' ? 'Customer Email Fallback' : 'Customer Email'}</Label>
                        <Input
                            id="to_email"
                            value={formData.to_email}
                            onChange={(e) => setFormData({ ...formData, to_email: e.target.value })}
                            placeholder="customer@example.com"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="to_phone">{sendChannel === 'email' ? 'Customer Phone Fallback' : 'Customer Phone'}</Label>
                        <Input
                            id="to_phone"
                            value={formData.to_phone}
                            onChange={(e) => setFormData({ ...formData, to_phone: e.target.value })}
                            placeholder="(555) 123-4567"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="subject">Subject Line</Label>
                        <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            disabled={sendChannel === 'sms'}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="message">Message Body</Label>
                        <Textarea
                            id="message"
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            rows={6}
                            disabled={sendChannel === 'sms'}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Close
                    </Button>
                    <Button onClick={handleSend} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {loading ? 'Sending...' : 'Send Quote'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SendEstimateModal;
