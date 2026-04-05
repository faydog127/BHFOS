import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/formUtils';

const PartnerApplicationForm = ({ preSelectInterest }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    org_name: '',
    contact_name: '',
    email: '',
    phone: '',
    vertical: '',
    service_area: 'Brevard County',
    doors_units: '',
    monthly_volume_estimate: '',
    urgency: 'now',
    notes: preSelectInterest ? 'Interested in pricing.' : ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
        setFormData(prev => ({ ...prev, [name]: formatPhoneNumber(value) }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelect = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('partner-register', {
        body: {
            ...formData,
            utm_source: new URLSearchParams(window.location.search).get('utm_source'),
            session_id: localStorage.getItem('klaire_session_id') || null
        }
      });

      if (error) throw error;
      
      if (data?.success) {
         navigate('/partners/welcome', { state: { discountCode: data.discount_code, partnerId: data.partner_id }});
      } else {
         throw new Error(data?.error || 'Submission failed');
      }

    } catch (error) {
      console.error('Submission error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not process application. Please try again or call (321) 360-9704."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-[#D7263D] px-6 py-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
           <ShieldCheck className="w-5 h-5" /> Partner Application
        </h3>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="space-y-2">
          <Label>Organization Name *</Label>
          <Input name="org_name" value={formData.org_name} onChange={handleChange} required placeholder="Company / HOA Name" />
        </div>

        <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Contact Name *</Label>
                <Input name="contact_name" value={formData.contact_name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
                <Label>Industry Vertical *</Label>
                <Select onValueChange={(v) => handleSelect('vertical', v)} required>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="realtor">Realtor / Team</SelectItem>
                        <SelectItem value="property_manager">Property Manager</SelectItem>
                        <SelectItem value="hvac_contractor">HVAC Contractor</SelectItem>
                        <SelectItem value="builder_gc">Builder / GC</SelectItem>
                        <SelectItem value="hoa">HOA Board</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Email *</Label>
                <Input name="email" type="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
                <Label>Phone *</Label>
                <Input name="phone" value={formData.phone} onChange={handleChange} required maxLength={14} placeholder="(555) 123-4567" />
            </div>
        </div>

        <div className="space-y-2">
            <Label>Service Area</Label>
            <Input name="service_area" value={formData.service_area} onChange={handleChange} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Units / Doors</Label>
                <Input name="doors_units" type="number" value={formData.doors_units} onChange={handleChange} placeholder="Approx. #" />
            </div>
            <div className="space-y-2">
                <Label>Monthly Volume</Label>
                <Select onValueChange={(v) => handleSelect('monthly_volume_estimate', v)}>
                    <SelectTrigger><SelectValue placeholder="Jobs/Mo" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1-5">1-5</SelectItem>
                        <SelectItem value="5-10">5-10</SelectItem>
                        <SelectItem value="10-25">10-25</SelectItem>
                        <SelectItem value="25-50">25-50</SelectItem>
                        <SelectItem value="50+">50+</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="space-y-2">
            <Label>Urgency *</Label>
            <Select onValueChange={(v) => handleSelect('urgency', v)} defaultValue="now">
                <SelectTrigger><SelectValue placeholder="When do you need this?" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="now">Immediate (Active Job)</SelectItem>
                    <SelectItem value="30d">Next 30 Days</SelectItem>
                    <SelectItem value="60-90d">Planning Phase (60-90d)</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Tell us about your specific needs..." />
        </div>

        <Button type="submit" className="w-full bg-[#1B263B] hover:bg-[#2a3f5f] text-white font-bold h-12" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2">Apply to Partner <ArrowRight className="w-4 h-4"/></span>}
        </Button>
        
        <p className="text-xs text-center text-gray-500">
            By applying, you agree to our partner terms. Data is secure.
        </p>
      </form>
    </div>
  );
};

export default PartnerApplicationForm;