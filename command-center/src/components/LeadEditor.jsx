import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { formatPhoneNumber } from '@/lib/formUtils';

const LeadEditor = ({ open, onClose, lead, onSave }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        status: '',
        pipeline_stage: '',
        service: ''
    });

    useEffect(() => {
        if (lead) {
            setFormData({
                first_name: lead.first_name || '',
                last_name: lead.last_name || '',
                email: lead.email || '',
                phone: lead.phone ? formatPhoneNumber(lead.phone) : '',
                status: lead.status || 'New',
                pipeline_stage: lead.pipeline_stage || 'new',
                service: lead.service || ''
            });
        }
    }, [lead]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('leads')
                .update({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    phone: formData.phone, // Assuming phone should be stored raw or formatted depending on backend preference
                    status: formData.status,
                    pipeline_stage: formData.pipeline_stage,
                    service: formData.service
                })
                .eq('id', lead.id);

            if (error) throw error;

            toast({ title: "Lead Updated", description: "Changes saved successfully." });
            if (onSave) onSave();
            onClose();
        } catch (error) {
            console.error("Error updating lead:", error);
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Lead</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>First Name</Label>
                            <Input 
                                value={formData.first_name} 
                                onChange={(e) => setFormData({...formData, first_name: e.target.value})} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Last Name</Label>
                            <Input 
                                value={formData.last_name} 
                                onChange={(e) => setFormData({...formData, last_name: e.target.value})} 
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input 
                            value={formData.email} 
                            onChange={(e) => setFormData({...formData, email: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input 
                            value={formData.phone} 
                            onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Service</Label>
                        <Select value={formData.service} onValueChange={(val) => setFormData({...formData, service: val})}>
                            <SelectTrigger><SelectValue placeholder="Select Service" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Dryer Vent Cleaning">Dryer Vent Cleaning</SelectItem>
                                <SelectItem value="Duct Cleaning">Duct Cleaning</SelectItem>
                                <SelectItem value="Indoor Air Audit">Indoor Air Audit</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LeadEditor;