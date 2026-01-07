import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Home, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { sanitizeInput, checkRateLimit } from '@/lib/security';
import { formatPhoneNumber, validateEmail, validatePhone } from '@/lib/formUtils';

const RealtorPartner = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: '', title: '', email: '', mobile_phone: '', sms_consent: false,
    office_phone: '', address: '', counties_served: '', brokerage_name: '',
    license_number: '', years_in_business: '', transactions_per_year: '',
    primary_focus: 'Residential', price_range: '', program_use: {}, lead_gen_preference: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name.includes('phone')) finalValue = formatPhoneNumber(value);
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSelect = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
  
  const handleCheckbox = (name, checked) => {
      if (name.startsWith('use_')) {
          const key = name.replace('use_', '');
          setFormData(prev => ({ ...prev, program_use: { ...prev.program_use, [key]: checked } }));
      } else {
          setFormData(prev => ({ ...prev, [name]: checked }));
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if(!checkRateLimit('realtor_app')) return toast({variant:"destructive", title:"Too fast"});

    if (!validateEmail(formData.email)) return toast({ title: "Invalid Email", variant: "destructive" });
    if (!validatePhone(formData.mobile_phone)) return toast({ title: "Invalid Phone", variant: "destructive" });

    setLoading(true);

    const dbData = {
        partner_type: 'realtor',
        organization_name: sanitizeInput(formData.brokerage_name),
        contact_name: sanitizeInput(formData.contact_name),
        title: sanitizeInput(formData.title),
        email: formData.email,
        mobile_phone: formData.mobile_phone,
        sms_consent: formData.sms_consent,
        office_phone: formData.office_phone,
        address: sanitizeInput(formData.address),
        counties_served: sanitizeInput(formData.counties_served),
        
        brokerage_name: sanitizeInput(formData.brokerage_name),
        license_number: sanitizeInput(formData.license_number),
        years_in_business: formData.years_in_business,
        transactions_per_year: formData.transactions_per_year,
        primary_focus: formData.primary_focus,
        price_range: sanitizeInput(formData.price_range),
        program_use: formData.program_use
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
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Registration Complete!</h2>
            <Button onClick={() => window.location.href='/'} className="mt-6">Return Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Helmet><title>Realtor Partner Registration</title></Helmet>
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-[#1B263B] py-8 px-8">
            <h1 className="text-2xl font-bold text-white font-oswald">Realtor Partner Registration</h1>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Contact</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Full Name *</Label><Input name="contact_name" value={formData.contact_name} onChange={handleChange} required /></div>
                    <div className="space-y-2"><Label>Email *</Label><Input name="email" type="email" value={formData.email} onChange={handleChange} required /></div>
                    <div className="space-y-2">
                        <Label>Mobile Phone *</Label>
                        <Input name="mobile_phone" type="tel" value={formData.mobile_phone} onChange={handleChange} required maxLength={14} placeholder="(XXX) XXX-XXXX"/>
                    </div>
                     <div className="space-y-2">
                        <Label>Office Phone</Label>
                        <Input name="office_phone" type="tel" value={formData.office_phone} onChange={handleChange} maxLength={14} placeholder="(XXX) XXX-XXXX"/>
                    </div>
                </div>
                <div className="flex items-center space-x-2"><Checkbox id="sms" checked={formData.sms_consent} onCheckedChange={(c) => handleCheckbox('sms_consent', c)} /><Label htmlFor="sms">I agree to receive text messages.</Label></div>
            </section>

            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Brokerage</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Brokerage Name *</Label><Input name="brokerage_name" value={formData.brokerage_name} onChange={handleChange} required /></div>
                    <div className="space-y-2"><Label>License #</Label><Input name="license_number" value={formData.license_number} onChange={handleChange} /></div>
                </div>
            </section>

            <Button type="submit" className="w-full h-12 bg-[#D7263D]" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Submit"}</Button>
          </form>
      </div>
    </div>
  );
};

export default RealtorPartner;