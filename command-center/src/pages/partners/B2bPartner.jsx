import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Hammer, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatPhoneNumber, validateEmail, validatePhone } from '@/lib/formUtils';

const B2bPartner = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: '', title: '', email: '', mobile_phone: '', sms_consent: false,
    organization_name: '',
    trade_type: 'HVAC',
    license_number: '',
    jobs_per_month: '',
    current_subcontractor: '',
    partnership_model: 'Referral Fee',
    branding_preference: 'Vent Guys Branded'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('phone')) {
        const formatted = formatPhoneNumber(value);
        setFormData(prev => ({...prev, [name]: formatted}));
    } else {
        setFormData(prev => ({...prev, [name]: value}));
    }
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if(!validateEmail(formData.email) || !validatePhone(formData.mobile_phone)) return toast({title:"Invalid contact info", variant:"destructive"});
      
      setLoading(true);
      const dbData = {
          partner_type: 'b2b',
          organization_name: formData.organization_name,
          contact_name: formData.contact_name,
          title: formData.title,
          email: formData.email,
          mobile_phone: formData.mobile_phone,
          sms_consent: formData.sms_consent,
          
          trade_type: formData.trade_type,
          license_number: formData.license_number,
          jobs_per_month: formData.jobs_per_month,
          current_subcontractor: formData.current_subcontractor,
          partnership_model: formData.partnership_model,
          branding_preference: formData.branding_preference
      };
      
      const { error } = await supabase.from('partner_registrations').insert([dbData]);
      if(error) { console.error(error); toast({title: "Error", variant:"destructive"}); }
      else { setSubmitted(true); window.scrollTo(0,0); }
      setLoading(false);
  };

  if (submitted) return (<div className="min-h-screen flex items-center justify-center p-4"><div className="bg-white p-8 rounded-xl shadow text-center"><CheckCircle className="w-12 h-12 text-green-500 mx-auto"/><h2>Submitted!</h2><Button className="mt-4" onClick={()=>window.location.href='/'}>Home</Button></div></div>);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
        <Helmet><title>B2B Contractor Partnership</title></Helmet>
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
             <div className="bg-[#1B263B] py-8 px-8">
                 <div className="flex items-center gap-4 mb-2">
                     <Hammer className="w-6 h-6 text-white" />
                     <h1 className="text-2xl font-bold text-white font-oswald">Contractor & B2B Partnership</h1>
                 </div>
                 <p className="text-blue-100 ml-10">HVAC, Roofers, and Pest Control - Let's handle the ductwork.</p>
             </div>
             
             <form onSubmit={handleSubmit} className="p-8 space-y-8">
                 <section className="space-y-4">
                     <h3 className="font-bold border-b pb-2">Company Info</h3>
                     <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label>Company Name *</Label><Input name="organization_name" value={formData.organization_name} onChange={handleChange} required /></div>
                         <div className="space-y-2">
                            <Label>Trade Type</Label>
                            <Select onValueChange={v => setFormData(p=>({...p, trade_type: v}))}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="HVAC">HVAC</SelectItem>
                                    <SelectItem value="Roofing">Roofing</SelectItem>
                                    <SelectItem value="Pest Control">Pest Control</SelectItem>
                                    <SelectItem value="Restoration">Restoration</SelectItem>
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2"><Label>License #</Label><Input name="license_number" value={formData.license_number} onChange={handleChange} /></div>
                         <div className="space-y-2"><Label>Monthly Job Volume</Label><Input name="jobs_per_month" value={formData.jobs_per_month} onChange={handleChange} /></div>
                     </div>
                 </section>

                 <section className="space-y-4">
                     <h3 className="font-bold border-b pb-2">Contact Info</h3>
                     <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label>Contact Name *</Label><Input name="contact_name" value={formData.contact_name} onChange={handleChange} required /></div>
                         <div className="space-y-2"><Label>Email *</Label><Input name="email" value={formData.email} onChange={handleChange} required /></div>
                         <div className="space-y-2">
                            <Label>Phone *</Label>
                            <Input name="mobile_phone" type="tel" value={formData.mobile_phone} onChange={handleChange} required maxLength={14} placeholder="(XXX) XXX-XXXX"/>
                         </div>
                     </div>
                     <div className="flex items-center space-x-2"><Checkbox id="sms" checked={formData.sms_consent} onCheckedChange={c=>setFormData(p=>({...p, sms_consent:c}))} /><Label htmlFor="sms">Consent to SMS</Label></div>
                 </section>

                 <section className="space-y-4">
                     <h3 className="font-bold border-b pb-2">Partnership Preferences</h3>
                     <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                             <Label>Preferred Model</Label>
                             <Select onValueChange={v => setFormData(p=>({...p, partnership_model: v}))}>
                                 <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                 <SelectContent>
                                     <SelectItem value="Referral Fee">Referral Fee (We pay you)</SelectItem>
                                     <SelectItem value="White Label">White Label (We act as you)</SelectItem>
                                     <SelectItem value="Subcontract">Subcontract</SelectItem>
                                 </SelectContent>
                             </Select>
                         </div>
                         <div className="space-y-2"><Label>Current Subcontractor?</Label><Input name="current_subcontractor" value={formData.current_subcontractor} onChange={handleChange} placeholder="Who do you use now?" /></div>
                     </div>
                 </section>

                 <Button type="submit" className="w-full h-12 bg-[#D7263D]" disabled={loading}>{loading?<Loader2 className="animate-spin" />:"Register as Partner"}</Button>
             </form>
        </div>
    </div>
  );
};
export default B2bPartner;