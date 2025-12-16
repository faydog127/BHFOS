import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import { trackLeadSubmission } from '@/lib/tracking';

const LeadCaptureForm = ({ 
    landingPageId, 
    onSuccess, 
    buttonText = "Get Free Quote",
    buttonColor = "bg-blue-600 hover:bg-blue-700",
    className 
}) => {
    const { toast } = useToast();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    
    // UTM Parameters
    const utmSource = searchParams.get('utm_source') || 'direct';
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        service_interest: 'duct_cleaning'
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (value) => {
        setFormData(prev => ({ ...prev, service_interest: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Create Lead
            const leadData = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                name: `${formData.first_name} ${formData.last_name}`,
                email: formData.email,
                phone: formData.phone,
                service: formData.service_interest,
                status: 'New',
                pqi: 10, // Default lead score
                source: utmSource,
                source_kind: 'landing_page',
                source_detail: landingPageId ? `LP: ${landingPageId}` : 'Website Lead Form',
                utm_source: utmSource,
                utm_medium: utmMedium,
                utm_campaign: utmCampaign,
                consent_marketing: true,
                needs_ai_action: true // Triggers automation
            };

            const { data: lead, error: leadError } = await supabase
                .from('leads')
                .insert([leadData])
                .select()
                .single();

            if (leadError) throw leadError;

            // 2. Track Tracking Event (Google Analytics / Pixel wrapper)
            trackLeadSubmission({ ...leadData, id: lead.id });

            // 3. Record Conversion specific to Landing Page
            if (landingPageId) {
                await supabase.from('landing_page_conversions').insert({
                    landing_page_id: landingPageId,
                    lead_id: lead.id,
                    source: utmSource,
                    utm_source: utmSource,
                    utm_medium: utmMedium,
                    utm_campaign: utmCampaign
                });
            }

            // 4. Trigger Welcome Automation (Mock / Database Trigger handles this via needs_ai_action)
            // But we can show immediate feedback
            toast({
                title: "Request Received!",
                description: "We'll be in touch shortly with your quote.",
                className: "bg-green-50 border-green-200"
            });

            if (onSuccess) onSuccess();
            
            // Reset form
            setFormData({
                first_name: '',
                last_name: '',
                email: '',
                phone: '',
                service_interest: 'duct_cleaning'
            });

        } catch (error) {
            console.error('Lead Capture Error:', error);
            toast({
                variant: "destructive",
                title: "Something went wrong",
                description: "Please try again or call us directly."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input 
                        id="first_name" 
                        name="first_name" 
                        value={formData.first_name} 
                        onChange={handleChange} 
                        required 
                        placeholder="John"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input 
                        id="last_name" 
                        name="last_name" 
                        value={formData.last_name} 
                        onChange={handleChange} 
                        required 
                        placeholder="Doe"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    required 
                    placeholder="john@example.com"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                    id="phone" 
                    name="phone" 
                    type="tel" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    required 
                    placeholder="(555) 123-4567"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="service">Interested In</Label>
                <Select value={formData.service_interest} onValueChange={handleSelectChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Service" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="duct_cleaning">Air Duct Cleaning</SelectItem>
                        <SelectItem value="dryer_vent">Dryer Vent Cleaning</SelectItem>
                        <SelectItem value="iaq_test">Indoor Air Quality Test</SelectItem>
                        <SelectItem value="combo_pack">Whole Home Bundle</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button 
                type="submit" 
                className={`w-full h-12 text-lg font-bold shadow-lg mt-2 ${buttonColor}`}
                disabled={loading}
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <span className="flex items-center justify-center gap-2">
                        {buttonText} <ArrowRight className="w-5 h-5" />
                    </span>
                )}
            </Button>
            
            <p className="text-xs text-center text-slate-500 mt-4">
                By submitting, you agree to receive SMS/Email updates about your inquiry. Msg & data rates may apply.
            </p>
        </form>
    );
};

export default LeadCaptureForm;