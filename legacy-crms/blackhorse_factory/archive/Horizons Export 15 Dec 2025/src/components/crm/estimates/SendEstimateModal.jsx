import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Send } from 'lucide-react';
import { sendEstimateEmail } from '@/services/emailService';

const SendEstimateModal = ({ open, onOpenChange, estimate, lead }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        to_email: '',
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
                subject: `Your Estimate from The Vent Guys - ${estNumber}`,
                message: `Hi ${customerName},\n\nIt was great speaking with you. Based on our conversation, I've put together an estimate for the requested services.\n\nPlease review the details below. If everything looks good, you can accept it directly through the link, and we'll get you on the schedule!\n\nBest regards,\nThe Vent Guys Team`
            });
        }
    }, [open, lead, estimate]);

    const handleSend = async () => {
        if (!formData.to_email) {
            toast({ variant: 'destructive', title: 'Error', description: 'Recipient email is required.' });
            return;
        }

        setLoading(true);
        try {
            const result = await sendEstimateEmail({
                estimate_id: estimate.id,
                lead_id: lead.id,
                to_email: formData.to_email,
                subject: formData.subject,
                message: formData.message.replace(/\n/g, '<br/>'), // Convert newlines to HTML breaks
                estimate_details: estimate, // Pass directly to avoid fetching if using mock data
                lead_details: lead
            });

            if (result.success) {
                toast({ 
                    title: 'Estimate Sent', 
                    description: `Successfully sent estimate to ${formData.to_email}. You can send to another email if needed.`,
                    className: "bg-green-50 border-green-200"
                });
                
                // IMPORTANT: We do NOT close the modal here anymore.
                // This allows the user to send multiple emails or verify the action without losing context.
                // onOpenChange(false); 
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
                    <DialogTitle>Send Estimate</DialogTitle>
                    <DialogDescription>
                        Email this estimate directly to the customer.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="to_email">Customer Email</Label>
                        <Input
                            id="to_email"
                            value={formData.to_email}
                            onChange={(e) => setFormData({ ...formData, to_email: e.target.value })}
                            placeholder="customer@example.com"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="subject">Subject Line</Label>
                        <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="message">Message Body</Label>
                        <Textarea
                            id="message"
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            rows={6}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Close
                    </Button>
                    <Button onClick={handleSend} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {loading ? 'Sending...' : 'Send Estimate'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SendEstimateModal;