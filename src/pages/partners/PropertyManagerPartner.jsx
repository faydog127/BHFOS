import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Building2, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatPhoneNumber, validateEmail, validatePhone } from '@/lib/formUtils';

const PropertyManagerPartner = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: '',
    title: '',
    email: '',
    mobile_phone: '',
    sms_consent: false,
    office_phone: '',
    address: '',
    counties_served: '',
    
    management_company: '',
    portfolio_type: 'Long Term Rental',
    doors_managed: '',
    monthly_turnovers: '',
    work_order_system: '',
    approval_threshold: '',
    response_time: '',
    program_use: {
        turnovers: false,
        maintenance: false,
        dryerVents: false
    },
    billing_preference: 'Per Job'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('phone')) {
      const formatted = formatPhoneNumber(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelect = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
  
  const handleCheckbox = (name, checked) => {
      if (name.startsWith('use_')) {
          const key = name.replace('use_', '');
          setFormData(prev => ({
              ...prev,
              program_use: { ...prev.program_use, [key]: checked }
          }));
      } else {
          setFormData(prev => ({ ...prev, [name]: checked }));
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateEmail(formData.email) || !validatePhone(formData.mobile_phone)) {
      toast({ title: "Validation Error", description: "Check email and phone format.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const dbData = {
        partner_type: 'property_manager',
        organization_name: formData.management_company,
        contact_name: formData.contact_name,
        title: formData.title,
        email: formData.email,
        mobile_phone: formData.mobile_phone,
        sms_consent: formData.sms_consent,
        office_phone: formData.office_phone,
        address: formData.address,
        counties_served: formData.counties_served,
        
        portfolio_type: formData.portfolio_type,
        doors_managed: formData.doors_managed,
        monthly_turnovers: formData.monthly_turnovers,
        work_order_system: formData.work_order_system,
        approval_threshold: formData.approval_threshold,
        response_time: formData.response_time,
        program_use: formData.program_use,
        billing_preference: formData.billing_preference
    };

    const { error } = await supabase.from('partner_registrations').insert([dbData]);

    if (error) {
      console.error('Supabase error:', error);
      
      let title = "Submission Failed";
      let description = error.message || "An unexpected error occurred. Please try again.";

      // Check for duplicate email (Postgres unique_violation code 23505)
      if (error.code === '23505') {
        title = "Email Already Registered";
        description = "This email is already registered. Please use a different email or contact support.";
      }

      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    } else {
      setSubmitted(true);
      window.scrollTo(0, 0);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-lg">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Request Received</h2>
            <p className="text-gray-600 mb-6">Thanks for applying. Our PM support team will review your portfolio details and contact you within 24 hours.</p>
            <Button onClick={() => window.location.href='/'} className="mt-6">Return Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Helmet><title>Property Manager Registration | The Vent Guys</title></Helmet>
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[#1B263B] py-8 px-8">
            <div className="flex items-center gap-4 mb-2">
                <div className="bg-white/10 p-2 rounded-lg">
                    <Building2 className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white font-oswald tracking-wide">Property Manager Registration</h1>
            </div>
            <p className="text-blue-100 ml-14">Streamlined turnovers and volume pricing for management portfolios.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <section className="space-y-4">
                <h3 className="font-bold text-gray-900 border-b pb-2">Manager Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Company Name *</Label><Input name="management_company" value={formData.management_company} onChange={handleChange} required /></div>
                    <div className="space-y-2"><Label>Contact Name *</Label><Input name="contact_name" value={formData.contact_name} onChange={handleChange} required /></div>
                    <div className="space-y-2"><Label>Email *</Label><Input name="email" value={formData.email} onChange={handleChange} required /></div>
                    <div className="space-y-2">
                        <Label>Mobile Phone *</Label>
                        <Input name="mobile_phone" type="tel" value={formData.mobile_phone} onChange={handleChange} required maxLength={14} placeholder="(XXX) XXX-XXXX" />
                    </div>
                     <div className="space-y-2">
                        <Label>Office Phone</Label>
                        <Input name="office_phone" type="tel" value={formData.office_phone} onChange={handleChange} maxLength={14} placeholder="(XXX) XXX-XXXX" />
                    </div>
                    <div className="space-y-2"><Label>Work Order System</Label><Input name="work_order_system" value={formData.work_order_system} onChange={handleChange} placeholder="AppFolio, Buildium, etc." /></div>
                    <div className="space-y-2"><Label>Office Address</Label><Input name="address" value={formData.address} onChange={handleChange} /></div>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="sms" checked={formData.sms_consent} onCheckedChange={(c) => handleCheckbox('sms_consent', c)} />
                    <Label htmlFor="sms" className="text-sm text-gray-500 font-normal">Consent to SMS updates.</Label>
                </div>
            </section>

            <section className="space-y-4">
                <h3 className="font-bold text-gray-900 border-b pb-2">Portfolio Profile</h3>
                <div className="grid md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Portfolio Type</Label>
                        <Select onValueChange={(v) => handleSelect('portfolio_type', v)}>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Long Term Rental">Long Term Rental</SelectItem>
                                <SelectItem value="Short Term / Vacation">Short Term / Vacation</SelectItem>
                                <SelectItem value="Multi-Family">Multi-Family</SelectItem>
                                <SelectItem value="HOA Management">HOA Management</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label>Total Doors Managed</Label><Input name="doors_managed" value={formData.doors_managed} onChange={handleChange} placeholder="e.g. 150" /></div>
                    <div className="space-y-2"><Label>Est. Monthly Turnovers</Label><Input name="monthly_turnovers" value={formData.monthly_turnovers} onChange={handleChange} /></div>
                    <div className="space-y-2"><Label>Maintenance Approval Limit ($)</Label><Input name="approval_threshold" value={formData.approval_threshold} onChange={handleChange} placeholder="$250" /></div>
                </div>
                
                <div className="space-y-2">
                    <Label>Billing Preference</Label>
                    <Select onValueChange={(v) => handleSelect('billing_preference', v)}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Per Job (Credit Card)">Per Job (Credit Card)</SelectItem>
                            <SelectItem value="Net 30">Net 30 Invoice</SelectItem>
                            <SelectItem value="Owner Direct">Bill Owner Directly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                 <div className="space-y-3">
                    <Label>Service Needs:</Label>
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Checkbox id="use_turnovers" onCheckedChange={(c) => handleCheckbox('use_turnovers', c)} />
                            <Label htmlFor="use_turnovers">Tenant Turnovers</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="use_dryerVents" onCheckedChange={(c) => handleCheckbox('use_dryerVents', c)} />
                            <Label htmlFor="use_dryerVents">Dryer Vent Cleaning</Label>
                        </div>
                    </div>
                </div>
            </section>

            <Button type="submit" className="w-full h-12 bg-[#1B263B]" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : "Submit Application"}
            </Button>
        </form>
      </div>
    </div>
  );
};
export default PropertyManagerPartner;