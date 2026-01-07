import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { validateEmail, validatePhone, formatPhoneNumber } from '@/lib/security';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { leadService } from '@/services/leadService';

export default function LeadCaptureForm({
  formType = 'free-air-check',
  onSuccess = () => {}
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address: '',
    message: '',
    consent_marketing: false,
  });
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();

  const formTypeConfig = {
    'free-air-check': {
      service_type: 'IAQ Check',
      source_kind: 'WEBSITE',
      source_detail: 'Free Air Check Form',
      customer_type: 'RESIDENTIAL',
      persona: 'HOMEOWNER_PREBOOK',
      pqi: 40 // Decent intent
    },
    'contact': {
      service_type: 'General Inquiry',
      source_kind: 'WEBSITE',
      source_detail: 'Contact Form',
      customer_type: 'RESIDENTIAL',
      persona: 'HOMEOWNER_INQUIRY',
      pqi: 20 // General intent
    },
  };

  const config = formTypeConfig[formType] || formTypeConfig['free-air-check'];

  const validateForm = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required.';
    if (!validatePhone(formData.phone)) newErrors.phone = 'Valid US phone number is required.';
    if (formData.email && !validateEmail(formData.email)) newErrors.email = 'Valid email is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;
    if (name === 'phone') finalValue = formatPhoneNumber(value);
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
    if (errors[name]) setErrors(prev => ({...prev, [name]: ''}));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    setStatus(null);

    const result = await leadService.submitLead({
        ...formData,
        ...config
    }, formType);

    setLoading(false);

    if (result.success) {
      setStatus('success');
      setMessage('✓ Thank you! We received your request and will contact you shortly.');
      setFormData({ first_name: '', last_name: '', phone: '', email: '', address: '', message: '', consent_marketing: false });
      onSuccess();
      setTimeout(() => navigate('/thank-you'), 1000);
    } else {
      setStatus('error');
      setMessage(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="John" disabled={loading} />
          {errors.first_name && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.first_name}</p>}
        </div>
        <div>
          <Label htmlFor="last_name">Last Name</Label>
          <Input id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Doe" disabled={loading} />
        </div>
      </div>
      <div>
        <Label htmlFor="phone">Phone *</Label>
        <Input id="phone" type="tel" name="phone" inputMode="numeric" value={formData.phone} onChange={handleChange} required placeholder="(321) 555-1234" disabled={loading} maxLength="14" />
        {errors.phone && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.phone}</p>}
      </div>
       <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" disabled={loading} />
        {errors.email && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.email}</p>}
      </div>
      <div>
        <Label htmlFor="address">Property Address</Label>
        <AddressAutocomplete id="address" name="address" value={formData.address} onChange={handleChange} disabled={loading} />
      </div>
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" value={formData.message} onChange={handleChange} rows={3} placeholder="Tell us about your air quality concerns..." disabled={loading} />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="consent_marketing" name="consent_marketing" checked={formData.consent_marketing} onCheckedChange={(checked) => setFormData(p => ({...p, consent_marketing: checked}))} disabled={loading} />
        <Label htmlFor="consent_marketing" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            I consent to marketing communications
        </Label>
      </div>

      {status && (
        <div className={`mt-4 p-3 rounded-md text-sm font-medium ${ status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>
          {message}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full bg-[#D7263D] hover:bg-[#b51f31] text-white mt-4" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending...</> : <><Send className="mr-2 h-5 w-5" /> Request My Free Check</>}
      </Button>
    </form>
  );
}