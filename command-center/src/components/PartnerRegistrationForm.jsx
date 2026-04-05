import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Send, CheckCircle } from 'lucide-react';
import { sanitizeInput, validateEmail, validatePhone, formatPhoneNumber, checkRateLimit } from '@/lib/security';

const PartnerRegistrationForm = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    message: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    
    if (name === 'phone') {
        finalValue = formatPhoneNumber(value);
    }
    
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!checkRateLimit('partner_info', 5000)) {
         toast({ variant: "destructive", title: "Too Many Requests", description: "Please wait before sending another request." });
         return;
    }
    
    if (!formData.fullName || !validateEmail(formData.email)) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please check your name and email format.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const safeData = {
          fullName: sanitizeInput(formData.fullName),
          company: sanitizeInput(formData.company),
          message: sanitizeInput(formData.message),
          email: formData.email,
          phone: formData.phone
      };

      // Split name for database
      const nameParts = safeData.fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const payload = {
        first_name: firstName,
        last_name: lastName,
        email: safeData.email,
        phone: safeData.phone,
        company: safeData.company,
        message: safeData.message,
        intent: 'partner_registration',
        source: 'partner_page',
        status: 'new',
        application_details: {
           raw_name: safeData.fullName,
           company: safeData.company,
           message: safeData.message,
           form_type: 'request_information'
        },
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('leads').insert([payload]);

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Request Sent",
        description: "We'll be in touch with more information shortly.",
        className: "bg-green-600 text-white border-none"
      });

    } catch (error) {
      console.error('Submission error:', error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Please try again or email us directly.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-xl p-8 text-center shadow-sm h-full flex flex-col items-center justify-center">
        <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Information Requested!</h3>
        <p className="text-gray-600 mb-6">
          Thanks for your interest. One of our partner managers will reach out shortly.
        </p>
        <Button variant="outline" onClick={() => setSuccess(false)}>Send Another Request</Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-[#1B263B] px-6 py-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-white">Request Partner Info</h3>
        <p className="text-blue-200 text-sm">Not ready to apply? Get the program details first.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
          <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Jane Doe" required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="jane@company.com" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="(555) 123-4567" />
            </div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="company">Company / Organization</Label>
            <Input id="company" name="company" value={formData.company} onChange={handleChange} placeholder="Acme Realty" />
        </div>

        <div className="space-y-2">
            <Label htmlFor="message">Questions or Message</Label>
            <Textarea 
                id="message" 
                name="message" 
                value={formData.message} 
                onChange={handleChange} 
                placeholder="I'm interested in learning more about..." 
                className="h-24"
            />
        </div>

        <Button type="submit" className="w-full bg-[#D7263D] hover:bg-[#b01c2e] text-white font-bold h-12 text-lg" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="flex items-center justify-center gap-2">Send Request <Send className="w-4 h-4" /></span>}
        </Button>
      </form>
    </div>
  );
};

export default PartnerRegistrationForm;