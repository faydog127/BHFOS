import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Users, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatPhoneNumber, validateEmail, validatePhone } from '@/lib/formUtils';

const HoaPartner = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: '', title: '', email: '', mobile_phone: '', sms_consent: false,
    
    community_name: '',
    community_type: 'Condo',
    num_units: '',
    num_buildings: '',
    year_built: '',
    management_company_info: '',
    board_frequency: 'Monthly',
    current_vendor_info: '',
    
    interest_reasons: { bulkDiscount: false, safetyAudit: false, compliance: false }
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
  
  const handleCheckbox = (name, checked) => {
      if (name.startsWith('int_')) {
         const key = name.replace('int_', '');
         setFormData(prev => ({...prev, interest_reasons: {...prev.interest_reasons, [key]: checked}}));
      } else {
         setFormData(prev => ({...prev, [name]: checked}));
      }
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if(!validateEmail(formData.email) || !validatePhone(formData.mobile_phone)) {
          toast({title: "Invalid contact info", variant: "destructive"}); return;
      }
      setLoading(true);
      
      const dbData = {
          partner_type: 'hoa',
          organization_name: formData.community_name,
          contact_name: formData.contact_name,
          title: formData.title,
          email: formData.email,
          mobile_phone: formData.mobile_phone,
          sms_consent: formData.sms_consent,
          
          community_name: formData.community_name,
          community_type: formData.community_type,
          num_units: formData.num_units,
          num_buildings: formData.num_buildings,
          year_built: formData.year_built,
          management_company_info: formData.management_company_info,
          board_frequency: formData.board_frequency,
          current_vendor_info: formData.current_vendor_info,
          interest_reasons: formData.interest_reasons
      };
      
      const { error } = await supabase.from('partner_registrations').insert([dbData]);
      if(error) {
          console.error(error); toast({title: "Error submitting", variant: "destructive"});
      } else {
          setSubmitted(true); window.scrollTo(0,0);
      }
      setLoading(false);
  };

  if (submitted) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-lg">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Community Registered</h2>
              <p className="text-gray-600 mb-6">We will prepare a custom proposal for your board's review.</p>
              <Button onClick={() => window.location.href='/'}>Return Home</Button>
          </div>
      </div>
  );

  return (
     <div className="min-h-screen bg-gray-50 py-12 px-4">
         <Helmet><title>HOA / Condo Association Registration</title></Helmet>
         <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
             <div className="bg-[#1B263B] py-8 px-8">
                 <div className="flex items-center gap-4 mb-2">
                     <Users className="w-6 h-6 text-white" />
                     <h1 className="text-2xl font-bold text-white font-oswald">HOA & Community Registration</h1>
                 </div>
                 <p className="text-blue-100 ml-10">Bulk dryer vent cleaning solutions for safer communities.</p>
             </div>
             
             <form onSubmit={handleSubmit} className="p-8 space-y-8">
                 <section className="space-y-4">
                     <h3 className="font-bold border-b pb-2">Contact Info</h3>
                     <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label>Your Name *</Label><Input name="contact_name" value={formData.contact_name} onChange={handleChange} required /></div>
                         <div className="space-y-2"><Label>Role on Board/Mgmt *</Label><Input name="title" value={formData.title} onChange={handleChange} required /></div>
                         <div className="space-y-2"><Label>Email *</Label><Input name="email" value={formData.email} onChange={handleChange} required /></div>
                         <div className="space-y-2">
                            <Label>Phone *</Label>
                            <Input name="mobile_phone" type="tel" value={formData.mobile_phone} onChange={handleChange} required maxLength={14} placeholder="(XXX) XXX-XXXX"/>
                         </div>
                     </div>
                     <div className="flex items-center space-x-2"><Checkbox id="sms" checked={formData.sms_consent} onCheckedChange={c => handleCheckbox('sms_consent', c)} /><Label htmlFor="sms">Consent to SMS</Label></div>
                 </section>

                 <section className="space-y-4">
                     <h3 className="font-bold border-b pb-2">Community Details</h3>
                     <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label>Community Name *</Label><Input name="community_name" value={formData.community_name} onChange={handleChange} required /></div>
                         <div className="space-y-2">
                             <Label>Type</Label>
                             <Select onValueChange={v => setFormData(p => ({...p, community_type: v}))}>
                                 <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                 <SelectContent>
                                     <SelectItem value="Condo">Condo</SelectItem>
                                     <SelectItem value="HOA">HOA (Single Family)</SelectItem>
                                     <SelectItem value="Co-op">Co-op</SelectItem>
                                 </SelectContent>
                             </Select>
                         </div>
                         <div className="space-y-2"><Label>Total Units</Label><Input name="num_units" value={formData.num_units} onChange={handleChange} /></div>
                         <div className="space-y-2"><Label>Year Built</Label><Input name="year_built" value={formData.year_built} onChange={handleChange} /></div>
                         <div className="space-y-2"><Label>Management Co. (if any)</Label><Input name="management_company_info" value={formData.management_company_info} onChange={handleChange} /></div>
                         <div className="space-y-2"><Label>Current Vendor</Label><Input name="current_vendor_info" value={formData.current_vendor_info} onChange={handleChange} /></div>
                     </div>
                     
                     <div className="space-y-3">
                         <Label>Primary Interest:</Label>
                         <div className="flex gap-4">
                             <div className="flex items-center gap-2"><Checkbox id="int_bulkDiscount" onCheckedChange={c => handleCheckbox('int_bulkDiscount', c)} /><Label htmlFor="int_bulkDiscount">Bulk Pricing</Label></div>
                             <div className="flex items-center gap-2"><Checkbox id="int_compliance" onCheckedChange={c => handleCheckbox('int_compliance', c)} /><Label htmlFor="int_compliance">Insurance Compliance</Label></div>
                         </div>
                     </div>
                 </section>
                 
                 <Button type="submit" className="w-full h-12 bg-[#D7263D]" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Submit Inquiry"}</Button>
             </form>
         </div>
     </div>
  );
};
export default HoaPartner;