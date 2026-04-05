import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, CheckCircle2, Ruler, Building, Info, Tag, Users, RefreshCw } from 'lucide-react';
import { sanitizeInput, validateEmail, validatePhone, formatPhoneNumber, checkRateLimit } from '@/lib/security';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { leadService } from '@/services/leadService';

const Booking = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Conflict State
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictType, setConflictType] = useState(null); // 'same_person' | 'different_person'

  const [partnerCode, setPartnerCode] = useState('');
  const [partnerData, setPartnerData] = useState(null); 
  const [validatingCode, setValidatingCode] = useState(false);

  const [formData, setFormData] = useState({
    serviceType: '',
    propertyType: '',
    sqFootage: '',
    preferredDate: '',
    fullName: '',
    phone: '',
    email: '',
    notes: '',
    address: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'phone') finalValue = formatPhoneNumber(value);
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const checkPartnerCode = async () => {
      const safeCode = sanitizeInput(partnerCode.toUpperCase().trim());
      if (!safeCode || safeCode.length < 3) return;
      if (!checkRateLimit('code_check', 1000)) return; 

      setValidatingCode(true);
      setPartnerData(null);
      
      try {
          const { data } = await supabase
              .from('referral_codes') 
              .select('*')
              .eq('code', safeCode)
              .eq('active', true)
              .maybeSingle();

          if (data) {
              if (data.valid_until && new Date(data.valid_until) < new Date()) {
                  toast({ variant: "destructive", title: "Code Expired", description: "This partner code has expired." });
                  return;
              }
              setPartnerData(data);
              toast({ title: "Discount Applied!", description: `Code ${data.code} applied.`, className: "bg-green-600 text-white border-none" });
          } else {
              toast({ variant: "destructive", title: "Invalid Code", description: "Code not found." });
          }
      } catch (e) {
          console.error(e);
          toast({ variant: "destructive", title: "Error", description: "Could not validate code." });
      } finally {
          setValidatingCode(false);
      }
  };

  // Pre-check for conflicts before opening modal or submitting
  const initiateSubmit = async (e) => {
      e.preventDefault();
      if (!validateEmail(formData.email) || !validatePhone(formData.phone)) {
          toast({ variant: "destructive", title: "Invalid Contact Info", description: "Please check email and phone format." });
          return;
      }
      if (!formData.address || formData.address.trim().length < 5) {
          toast({ variant: "destructive", title: "Address Required", description: "Please enter a valid service address." });
          return;
      }

      setIsSubmitting(true);
      
      // Check for conflicts
      const result = await leadService.checkConflict(formData.address, formData.email);
      
      if (result.conflict) {
          setConflictType(result.conflict);
          setConflictOpen(true);
          setIsSubmitting(false); // Pause here
      } else {
          // No conflict, proceed to standard submit
          doSubmit(null);
      }
  };

  const doSubmit = async (resolution) => {
      setIsSubmitting(true);
      setConflictOpen(false);

      try {
        const safeNotes = sanitizeInput(formData.notes);
        let discountInfo = "None";
        if (partnerData) {
            discountInfo = `${partnerData.discount_value || 'Std'} ${partnerData.discount_type || ''} (Code: ${partnerData.code})`;
        }

        const detailedMessage = `
--- BOOKING REQUEST ---
Property: ${sanitizeInput(formData.address)}
Type: ${formData.propertyType}
SqFt: ${sanitizeInput(formData.sqFootage)}
Date Requested: ${formData.preferredDate}

--- PARTNER INFO ---
Code: ${partnerData ? partnerData.code : 'N/A'}
Discount: ${discountInfo}

--- USER NOTES ---
${safeNotes}
        `.trim();

        // Submit via Lead Service
        const result = await leadService.submitLead({
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            message: detailedMessage,
            service_type: formData.serviceType || 'General Service',
            source_kind: 'WEBSITE',
            source_detail: 'Booking Page Form',
            persona: 'HOMEOWNER_PREBOOK',
            pqi: 60, 
            consent_marketing: true,
            partner_referral_code: partnerData ? partnerData.code : null
        }, 'booking_submit', resolution);

        if (!result.success) throw new Error(result.error);

        setIsSuccess(true);
        toast({ title: "Request Received!", description: "We'll be in touch shortly.", className: "bg-green-50 border-green-200" });
        setTimeout(() => { navigate('/'); }, 3000);

      } catch (error) {
        console.error('Error:', error);
        toast({ variant: "destructive", title: "Submission Error", description: error.message });
      } finally {
        setIsSubmitting(false);
      }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-6">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Sent!</h2>
          <p className="text-slate-600 mb-6">Your booking request has been securely received by our team.</p>
          <Button onClick={() => navigate('/')} className="w-full">Return Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <Helmet><title>Book Online | The Vent Guys</title></Helmet>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Schedule Your Service</h1>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-white border-b border-slate-100 pb-6">
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={initiateSubmit} className="space-y-8">
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500 uppercase flex items-center gap-2"><Info className="w-4 h-4" /> Service Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="serviceType">Service Type *</Label>
                    <Select onValueChange={(val) => handleSelectChange('serviceType', val)} required>
                      <SelectTrigger id="serviceType"><SelectValue placeholder="Select Service" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dryer Vent Cleaning">Dryer Vent Cleaning</SelectItem>
                        <SelectItem value="NADCA Duct Cleaning">NADCA Duct Cleaning</SelectItem>
                        <SelectItem value="Both Services">Both Services</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.serviceType === 'Dryer Vent Cleaning' && (
                        <div className="mt-2 text-sm text-green-700 font-medium flex items-center gap-2 bg-green-50 p-3 rounded border border-green-200 animate-in fade-in slide-in-from-top-1">
                            <Tag className="w-4 h-4 shrink-0" />
                            Special pricing of $129 applies when booked online (normally $150)
                        </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="propertyType">Property Type *</Label>
                    <Select onValueChange={(val) => handleSelectChange('propertyType', val)} required>
                      <SelectTrigger id="propertyType"><SelectValue placeholder="Select Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single-family">Single-family Home</SelectItem>
                        <SelectItem value="Condo">Condo / Apartment</SelectItem>
                        <SelectItem value="Commercial">Commercial Property</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Service Address *</Label>
                    <AddressAutocomplete 
                      id="address" 
                      name="address" 
                      value={formData.address} 
                      onChange={handleInputChange} 
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sqFootage">Approx. Sq. Footage</Label>
                    <div className="relative"><Ruler className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input id="sqFootage" name="sqFootage" className="pl-9" value={formData.sqFootage} onChange={handleInputChange} /></div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredDate">Preferred Date</Label>
                    <Input id="preferredDate" name="preferredDate" type="date" min={new Date().toISOString().split('T')[0]} value={formData.preferredDate} onChange={handleInputChange} />
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div className={`p-4 rounded-lg border ${partnerData ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
                  <div className="flex items-start gap-4">
                      <div className="flex-1">
                          <Label htmlFor="partnerCode" className="font-bold text-blue-900">{partnerData ? 'Partner Discount Applied!' : 'Partner Discount Code'}</Label>
                          <div className="flex gap-2 mt-2">
                              <Input id="partnerCode" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value)} placeholder="CODE" className="uppercase font-mono" disabled={!!partnerData} />
                              {!partnerData ? (
                                  <Button type="button" onClick={checkPartnerCode} disabled={validatingCode || !partnerCode} variant="secondary">
                                      {validatingCode ? <Loader2 className="animate-spin" /> : "Apply"}
                                  </Button>
                              ) : (
                                  <Button type="button" onClick={() => { setPartnerData(null); setPartnerCode(''); }} variant="ghost" className="text-red-500">Remove</Button>
                              )}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500 uppercase flex items-center gap-2"><Building className="w-4 h-4" /> Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Full Name *</Label><Input name="fullName" value={formData.fullName} onChange={handleInputChange} required /></div>
                  <div className="space-y-2"><Label>Phone *</Label><Input name="phone" value={formData.phone} onChange={handleInputChange} required placeholder="(555) 555-5555" /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Email *</Label><Input name="email" type="email" value={formData.email} onChange={handleInputChange} required /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Notes</Label><Textarea name="notes" value={formData.notes} onChange={handleInputChange} /></div>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : 'Book Appointment'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-600">
                   <Info className="h-5 w-5" /> 
                   {conflictType === 'same_person' ? 'Active Request Found' : 'Property Has Active Request'}
                </DialogTitle>
                <DialogDescription className="pt-2">
                    {conflictType === 'same_person' 
                        ? "You already have an open request for this address. Would you like to update your existing request with these new details?"
                        : "There is already an active service request for this property address under a different name. How would you like to proceed?"
                    }
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="bg-slate-50 p-3 rounded-md border text-sm text-slate-600">
                    <p><strong>Address:</strong> {formData.address}</p>
                    <p><strong>Contact:</strong> {formData.fullName} ({formData.email})</p>
                </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setConflictOpen(false)}>Cancel</Button>
                {conflictType === 'different_person' && (
                    <Button 
                        variant="secondary" 
                        onClick={() => doSubmit('add_contact')}
                        className="flex items-center gap-2"
                    >
                        <Users className="h-4 w-4" /> I am an Alternate Contact
                    </Button>
                )}
                <Button 
                    onClick={() => doSubmit('update')}
                    className="flex items-center gap-2"
                >
                    <RefreshCw className="h-4 w-4" /> Update Request
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Booking;