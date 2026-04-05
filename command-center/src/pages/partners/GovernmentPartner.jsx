import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Building, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatPhoneNumber, validateEmail, validatePhone } from '@/lib/formUtils';

const GovernmentPartner = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: '', title: '', email: '', mobile_phone: '', sms_consent: false,
    agency_name: '', department: '', facility_types: '', num_facilities: '',
    procurement_contact: '', contracting_requirements: '', sdvosb_status: 'No'
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
      if(!validateEmail(formData.email)) return toast({title:"Invalid Email", variant:"destructive"});
      
      setLoading(true);
      const dbData = {
          partner_type: 'government',
          organization_name: formData.agency_name,
          contact_name: formData.contact_name,
          title: formData.title,
          email: formData.email,
          mobile_phone: formData.mobile_phone,
          sms_consent: formData.sms_consent,
          
          agency_name: formData.agency_name,
          department: formData.department,
          facility_types: formData.facility_types,
          num_facilities: formData.num_facilities,
          procurement_contact: formData.procurement_contact,
          contracting_requirements: formData.contracting_requirements,
          sdvosb_status: formData.sdvosb_status
      };
      
      const { error } = await supabase.from('partner_registrations').insert([dbData]);
      if(error) { console.error(error); toast({title: "Error", variant:"destructive"}); }
      else { setSubmitted(true); window.scrollTo(0,0); }
      setLoading(false);
  };

  if(submitted) return (<div className="min-h-screen flex items-center justify-center p-4"><div className="bg-white p-8 rounded-xl shadow text-center"><CheckCircle className="w-12 h-12 text-green-500 mx-auto"/><h2>Inquiry Sent</h2><p className="mb-4">Our government contracting officer will respond shortly.</p><Button onClick={()=>window.location.href='/'}>Home</Button></div></div>);

  return (
     <div className="min-h-screen bg-gray-50 py-12 px-4">
         <Helmet><title>Government & Municipal Contracting</title></Helmet>
         <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
             <div className="bg-[#1B263B] py-8 px-8">
                 <div className="flex items-center gap-4 mb-2">
                     <Building className="w-6 h-6 text-white" />
                     <h1 className="text-2xl font-bold text-white font-oswald">Government Contracting</h1>
                 </div>
                 <p className="text-blue-100 ml-10">SDVOSB Certified Air Systems Hygiene for Municipal & Federal Facilities.</p>
             </div>
             
             <form onSubmit={handleSubmit} className="p-8 space-y-8">
                 <section className="space-y-4">
                     <h3 className="font-bold border-b pb-2">Agency Details</h3>
                     <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label>Agency Name *</Label><Input name="agency_name" value={formData.agency_name} onChange={handleChange} required /></div>
                         <div className="space-y-2"><Label>Department</Label><Input name="department" value={formData.department} onChange={handleChange} /></div>
                         <div className="space-y-2"><Label>Facility Types</Label><Input name="facility_types" value={formData.facility_types} onChange={handleChange} placeholder="Offices, Barracks, etc." /></div>
                         <div className="space-y-2"><Label># of Facilities</Label><Input name="num_facilities" value={formData.num_facilities} onChange={handleChange} /></div>
                     </div>
                 </section>
                 
                 <section className="space-y-4">
                     <h3 className="font-bold border-b pb-2">Contact / Procurement</h3>
                     <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label>POC Name *</Label><Input name="contact_name" value={formData.contact_name} onChange={handleChange} required /></div>
                         <div className="space-y-2"><Label>Title</Label><Input name="title" value={formData.title} onChange={handleChange} /></div>
                         <div className="space-y-2"><Label>Email *</Label><Input name="email" value={formData.email} onChange={handleChange} required /></div>
                         <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input name="mobile_phone" type="tel" value={formData.mobile_phone} onChange={handleChange} maxLength={14} placeholder="(XXX) XXX-XXXX"/>
                         </div>
                     </div>
                     <div className="flex items-center space-x-2"><Checkbox id="sdvosb" checked={formData.sdvosb_status === 'Yes'} onCheckedChange={c => setFormData(p=>({...p, sdvosb_status: c ? 'Yes' : 'No'}))} /><Label htmlFor="sdvosb">Are you specifically seeking SDVOSB participation?</Label></div>
                 </section>

                 <Button type="submit" className="w-full h-12 bg-[#1B263B]" disabled={loading}>{loading?<Loader2 className="animate-spin" />:"Submit Capability Request"}</Button>
             </form>
         </div>
     </div>
  );
};
export default GovernmentPartner;