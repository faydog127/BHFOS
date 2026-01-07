import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle, ShieldCheck, ArrowRight } from 'lucide-react';

const PartnerLeadForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: '',
    email: '',
    phone: '',
    units: '',
    headache: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelect = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Insert into Database with 'pending' status
    // REMOVED: status: 'new' (column does not exist in partner_registrations)
    const dbData = {
      partner_type: 'inquiry_home_form',
      contact_name: formData.name,
      organization_name: formData.company,
      title: formData.role,
      email: formData.email,
      mobile_phone: formData.phone,
      num_units: formData.units,
      biggest_headache: formData.headache,
      interest_reasons: { headache_description: formData.headache },
      welcome_email_status: 'pending'
    };

    try {
      const { data: insertedData, error } = await supabase
          .from('partner_registrations')
          .insert([dbData])
          .select();

      if (error) throw error;
      
      const recordId = insertedData?.[0]?.id;

      // 2. Trigger Automated Email via Edge Function
      const { error: functionError } = await supabase.functions.invoke('send-partner-email', {
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          headache: formData.headache,
          company: formData.company
        })
      });

      if (functionError) {
        console.error('Email trigger failed:', functionError);
        // Update to failed if we have the record ID
        if(recordId) {
             await supabase.from('partner_registrations')
                .update({ welcome_email_status: 'failed' })
                .eq('id', recordId);
        }
      } else {
        // Update to sent
        if(recordId) {
             await supabase.from('partner_registrations')
                .update({ 
                    welcome_email_status: 'sent',
                    welcome_email_sent_at: new Date().toISOString()
                })
                .eq('id', recordId);
        }
      }

      setSubmitted(true);
      toast({
        title: "Inquiry Received",
        description: "Check your email for the Partner Info Pack.",
        className: "bg-green-50 border-green-200 text-green-900"
      });

    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: "Please try again or contact us directly.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl shadow-xl border border-green-100 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-[#1B263B] mb-4">Thanks, {formData.name.split(' ')[0]}.</h3>
        <p className="text-lg text-gray-600 mb-6">
          We've received your partner inquiry. One of our account specialists will review your portfolio details and reach out within 24 hours.
        </p>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 max-w-md mx-auto">
          <p className="text-blue-800 text-sm font-medium">
             We just sent a confirmation email to <strong>{formData.email}</strong> with your Partner Info Pack download link.
          </p>
        </div>
        <Button 
            onClick={() => window.open('https://calendly.com/vent-guys/partner-intro', '_blank')}
            className="mt-6 bg-[#D7263D] hover:bg-[#b51f31] text-white"
        >
            Book Your 15-Min Intro Call Now
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-[#1B263B] px-8 py-6 border-b border-gray-100">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          Let's See If We're a Fit
        </h3>
        <p className="text-blue-200 text-sm mt-1">Tell us about your portfolio needs.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company / Community</Label>
            <Input id="company" name="company" value={formData.company} onChange={handleChange} required placeholder="Premier Mgmt" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select onValueChange={(v) => handleSelect('role', v)}>
                <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Property Manager">Property Manager</SelectItem>
                    <SelectItem value="Realtor/Broker">Realtor / Broker</SelectItem>
                    <SelectItem value="HOA Board Member">HOA Board Member</SelectItem>
                    <SelectItem value="Facility Director">Facility Director</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <Label htmlFor="units"># Units / Properties</Label>
            <Input id="units" name="units" value={formData.units} onChange={handleChange} placeholder="e.g. 150 doors" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="jane@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="(555) 123-4567" />
          </div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="headache">What's your biggest headache right now?</Label>
            <Textarea 
                id="headache" 
                name="headache" 
                value={formData.headache} 
                onChange={handleChange} 
                placeholder="e.g. High turnover costs, mold complaints, dryer fire risks..." 
                className="min-h-[80px]"
            />
        </div>

        <Button type="submit" size="lg" className="w-full bg-[#D7263D] hover:bg-[#b51f31] text-white h-12 font-bold text-lg shadow-md" disabled={loading}>
          {loading ? <Loader2 className="animate-spin mr-2" /> : <span className="flex items-center">Request Partner Strategy Call <ArrowRight className="ml-2 w-5 h-5"/></span>}
        </Button>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-4">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            We respect your inbox. No spam, just solutions.
        </div>
      </form>
    </div>
  );
};

export default PartnerLeadForm;