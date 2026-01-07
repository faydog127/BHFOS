import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { PlusCircle, Building2 } from 'lucide-react';
import { getAttribution } from '@/lib/tracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const B2BLeadCaptureForm = ({ onLeadAdded }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const LEAD_INTAKE_API_KEY = "sk_l34dv3r1fy_q23rTz_s3cure_k3y_f0r_tvg";
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const form = e.target;
        const formData = new FormData(form);
        const formValues = Object.fromEntries(formData.entries());

        const dmPhone = formValues.dm_phone ? `+1${formValues.dm_phone.replace(/\D/g, '')}` : '';

        const payload = {
            lead: {
                first_name: formValues.dm_name.split(' ')[0] || formValues.contact_name.split(' ')[0] || '',
                last_name: formValues.dm_name.split(' ').slice(1).join(' ') || formValues.contact_name.split(' ').slice(1).join(' ') || '',
                email: formValues.dm_email.toLowerCase().trim() || '',
                phone: dmPhone,
                persona: formValues.persona,
                company: formValues.company_name,
                property_name: formValues.company_name,
                city: formValues.city,
                zip: formValues.zip,
                message: `Initial Contact: ${formValues.contact_name} (${formValues.contact_role}).\nNotes: ${formValues.notes}`,
            },
            meta: {
                page: '/crm/console',
                ...getAttribution(),
                timestamp: new Date().toISOString(),
                source_system: 'manual_crm_entry',
            }
        };

        try {
            const { data, error } = await supabase.functions.invoke('lead-intake', {
                headers: {
                    'Content-Type': 'application/json',
                    'X-TVG-SECRET': LEAD_INTAKE_API_KEY,
                },
                body: JSON.stringify(payload),
            });

            if (error || (data && !data.ok)) {
                throw new Error(data?.error || 'An unknown error occurred.');
            }
            
            toast({
                title: "B2B Lead Added! 🚀",
                description: `${formValues.company_name} is now in your pipeline.`,
            });
            form.reset();
            if(onLeadAdded) onLeadAdded(data.lead_id); 
        } catch (error) {
            toast({
                variant: 'destructive',
                title: "Submission Failed",
                description: `There was a problem: ${error.message}`,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="w-full h-full flex flex-col bg-white border-0 shadow-none rounded-none">
            <CardContent className="flex-1 overflow-y-auto p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="company_name">Company Name</Label>
                            <Input id="company_name" name="company_name" required disabled={isSubmitting} size="sm"/>
                        </div>
                        <div>
                           <Label htmlFor="persona">Persona</Label>
                            <Select name="persona" defaultValue="hvac_partner" required>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hvac_partner">HVAC Partner</SelectItem>
                                    <SelectItem value="property_manager">Property Manager</SelectItem>
                                    <SelectItem value="facility">Facility Manager</SelectItem>
                                    <SelectItem value="homeowner">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div>
                            <Label htmlFor="city">City</Label>
                            <Input id="city" name="city" required disabled={isSubmitting} size="sm"/>
                        </div>
                        <div>
                            <Label htmlFor="zip">ZIP Code</Label>
                            <Input id="zip" name="zip" required disabled={isSubmitting} size="sm"/>
                        </div>
                    </div>

                    <div className="p-3 bg-gray-100 rounded-lg border">
                        <h4 className="font-semibold text-gray-700 text-sm mb-2">Initial Contact (Gatekeeper)</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="contact_name">Name</Label>
                                <Input id="contact_name" name="contact_name" disabled={isSubmitting} size="sm"/>
                            </div>
                            <div>
                                <Label htmlFor="contact_role">Role</Label>
                                <Input id="contact_role" name="contact_role" placeholder="e.g., Office Mgr" disabled={isSubmitting} size="sm"/>
                            </div>
                        </div>
                    </div>

                     <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-800 text-sm mb-2">Decision Maker (DM)</h4>
                        <div className="grid grid-cols-2 gap-3">
                             <div>
                                <Label htmlFor="dm_name">Full Name</Label>
                                <Input id="dm_name" name="dm_name" disabled={isSubmitting} size="sm"/>
                            </div>
                             <div>
                                <Label htmlFor="dm_phone">Phone</Label>
                                <Input id="dm_phone" name="dm_phone" type="tel" disabled={isSubmitting} size="sm"/>
                            </div>
                             <div className="col-span-2">
                                <Label htmlFor="dm_email">Email</Label>
                                <Input id="dm_email" name="dm_email" type="email" disabled={isSubmitting} size="sm"/>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="notes">Initial Notes</Label>
                        <Textarea id="notes" name="notes" placeholder="e.g., Called about partnership. Spoke to Jane..." disabled={isSubmitting} className="min-h-[60px]" />
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {isSubmitting ? 'Adding...' : 'Add Lead'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};

export default B2BLeadCaptureForm;