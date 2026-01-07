
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calculator, CheckCircle, Home, Snowflake, Wind, AlertTriangle, 
  ArrowRight, Loader2, DollarSign, ShieldCheck, Mail
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { leadService } from '@/services/leadService';
import { formatPhoneNumber } from '@/lib/security';
import { formatPrice } from '@/lib/pricing';
import AddressAutocomplete from '@/components/AddressAutocomplete';

// --- Pricing Logic (Simplified for Frontend Estimator) ---
const BASE_PRICES = {
  'PKG-MIN': 149,   // Safety Clean
  'PKG-COMP': 299,  // Compliance
  'PKG-REST': 499   // Restoration
};

const ADDONS = {
  'DV-ROOF': 50,
  'DV-CRAWL': 50,
  'DV-ATTIC': 50,
  'DV-ADD-DRYER': 99,
  'SAN-FOG': 49
};

const EstimateWizard = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [leadId, setLeadId] = useState(null);
  
  // -- State --
  const [formData, setFormData] = useState({
    // Contact
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '', // Stores formatted string
    street: '', // Stores raw components if available
    city: '',
    state: '',
    zip: '',
    
    // Property
    homeType: 'single_story',
    ventLocation: 'side',
    
    // Service
    serviceType: 'dryer_vent',
    dryerCount: 1,
    issues: [],
    
    // Selection
    selectedPackage: null
  });

  const [estimate, setEstimate] = useState({ total: 0, breakdowns: [] });

  // -- Handlers --

  const updateField = (field, value) => {
    // 1. Phone Formatting Logic
    if (field === 'phone') {
        const formatted = formatPhoneNumber(value);
        setFormData(prev => ({ ...prev, [field]: formatted }));
        return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressSelect = (addressData) => {
    // 2. Address Autocomplete Logic
    setFormData(prev => ({
        ...prev,
        address: addressData.formatted_address,
        street: addressData.street,
        city: addressData.city,
        state: addressData.state,
        zip: addressData.zip
    }));
  };

  const toggleIssue = (issue) => {
    setFormData(prev => {
      const issues = prev.issues.includes(issue) 
        ? prev.issues.filter(i => i !== issue)
        : [...prev.issues, issue];
      return { ...prev, issues };
    });
  };

  // Recalculate Estimate
  useEffect(() => {
    let base = 0;
    let addons = 0;

    if (formData.selectedPackage === 'good') base = BASE_PRICES['PKG-MIN'];
    if (formData.selectedPackage === 'better') base = BASE_PRICES['PKG-COMP'];
    if (formData.selectedPackage === 'best') base = BASE_PRICES['PKG-REST'];
    
    if (formData.ventLocation === 'roof') addons += ADDONS['DV-ROOF'];
    if (formData.dryerCount > 1) {
      addons += (formData.dryerCount - 1) * ADDONS['DV-ADD-DRYER'];
    }

    setEstimate({
      total: base + addons,
      breakdowns: [
        { label: 'Base Package', amount: base },
        { label: 'Roof Access Fee', amount: formData.ventLocation === 'roof' ? ADDONS['DV-ROOF'] : 0 },
        { label: 'Additional Units', amount: formData.dryerCount > 1 ? (formData.dryerCount - 1) * ADDONS['DV-ADD-DRYER'] : 0 }
      ].filter(i => i.amount > 0)
    });

  }, [formData.selectedPackage, formData.ventLocation, formData.dryerCount]);

  // -- Submissions --

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        const result = await leadService.submitLead({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            // Pass components for cleaner DB storage
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            
            service_type: 'Estimate Request (Partial)',
            source_kind: 'estimate_wizard_partial',
            message: 'User started Instant Estimate Wizard'
        }, 'estimate_wizard_step1');

        if (!result.success) throw new Error(result.error);
        
        if (result.data?.lead_id) {
            setLeadId(result.data.lead_id);
        }

        setStep(2);
    } catch (err) {
        console.error("Wizard Step 1 Error:", err);
        toast({
            variant: "destructive",
            title: "Connection Error",
            description: err.message || "Could not start estimate. Please try again."
        });
    } finally {
        setLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!formData.selectedPackage) {
        toast({ title: "Select a Package", description: "Please choose a service level to proceed." });
        return;
    }
    
    setLoading(true);
    try {
        const result = await leadService.submitLead({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            
            service_type: `Dryer Vent - ${formData.selectedPackage.toUpperCase()}`,
            source_kind: 'estimate_wizard_final',
            message: `Selected Package: ${formData.selectedPackage}. Vent Location: ${formData.ventLocation}. Issues: ${formData.issues.join(', ')}`,
            
            hvac: {
                ventLocation: formData.ventLocation,
                dryerCount: formData.dryerCount,
                issues: formData.issues,
                estimatedTotal: estimate.total
            },
            
            lead_id: leadId 
        }, 'estimate_wizard_final', 'update');

        if (!result.success) throw new Error(result.error);

        setStep(4); // Success View
    } catch (err) {
        console.error("Wizard Final Submit Error:", err);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "Please call us directly at (321) 555-0123."
        });
    } finally {
        setLoading(false);
    }
  };


  // -- Render Steps --

  const renderStep1 = () => (
    <div className="space-y-4">
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Get Your Instant Quote</h2>
            <p className="text-slate-500">Enter your details to unlock pricing.</p>
        </div>
        
        <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input required value={formData.firstName} onChange={e => updateField('firstName', e.target.value)} placeholder="Jane" />
                </div>
                <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input required value={formData.lastName} onChange={e => updateField('lastName', e.target.value)} placeholder="Doe" />
                </div>
            </div>
            
            <div className="space-y-2">
                <Label>Email</Label>
                <Input required type="email" value={formData.email} onChange={e => updateField('email', e.target.value)} placeholder="jane@example.com" />
            </div>

             <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                    required 
                    type="tel" 
                    value={formData.phone} 
                    onChange={e => updateField('phone', e.target.value)} 
                    placeholder="(555) 123-4567" 
                    maxLength={14}
                />
            </div>

             <div className="space-y-2">
                <Label>Property Address</Label>
                <AddressAutocomplete 
                    value={formData.address} 
                    onChange={e => updateField('address', e.target.value)}
                    onAddressSelect={handleAddressSelect}
                    placeholder="123 Main St, Melbourne FL"
                />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-lg h-12">
                {loading ? <Loader2 className="animate-spin" /> : "See Pricing"}
            </Button>
            <p className="text-xs text-center text-slate-400">
                We respect your privacy. No spam, ever.
            </p>
        </form>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
         <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">Tell us about the job</h2>
            <p className="text-slate-500">Help us calculate an accurate price.</p>
        </div>

        <div className="space-y-4">
             <div className="space-y-2">
                <Label>Where does the dryer vent exit?</Label>
                <div className="grid grid-cols-2 gap-4">
                    <div 
                        onClick={() => updateField('ventLocation', 'side')}
                        className={`p-4 border-2 rounded-xl cursor-pointer flex flex-col items-center gap-2 transition-all ${formData.ventLocation === 'side' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-100 hover:border-slate-300'}`}
                    >
                        <Home className="w-8 h-8"/>
                        <span className="font-semibold">Side Wall</span>
                    </div>
                    <div 
                         onClick={() => updateField('ventLocation', 'roof')}
                         className={`p-4 border-2 rounded-xl cursor-pointer flex flex-col items-center gap-2 transition-all ${formData.ventLocation === 'roof' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-100 hover:border-slate-300'}`}
                    >
                        <ArrowRight className="w-8 h-8 -rotate-45"/>
                        <span className="font-semibold">Roof / Attic</span>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                 <Label>Are you experiencing any issues?</Label>
                 <div className="grid grid-cols-1 gap-2">
                    {['Clothes taking long to dry', 'Burning smell', 'Visible lint buildup', 'Routine maintenance'].map(issue => (
                        <div key={issue} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50">
                            <Checkbox id={issue} checked={formData.issues.includes(issue)} onCheckedChange={() => toggleIssue(issue)} />
                            <label htmlFor={issue} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full">
                                {issue}
                            </label>
                        </div>
                    ))}
                 </div>
            </div>
        </div>

        <div className="flex gap-4">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} className="flex-1 bg-blue-600 hover:bg-blue-700">View Packages</Button>
        </div>
    </div>
  );

  const renderStep3 = () => (
      <div className="space-y-6">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">Select Your Package</h2>
        </div>

        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {[
                { id: 'good', title: 'Safety Clean', price: BASE_PRICES['PKG-MIN'], features: ['Basic Lint Removal', 'Airflow Check', 'Visual Inspection'] },
                { id: 'better', title: 'Compliance Plus', price: BASE_PRICES['PKG-COMP'], features: ['Deep Rotary Brush Clean', 'Vent Hood Cleaning', 'Before/After Photos', 'Airflow Certification'], popular: true },
                { id: 'best', title: 'Total Restoration', price: BASE_PRICES['PKG-REST'], features: ['Everything in Compliance', 'Antibacterial Fogging', 'Bird Guard Check', 'Minor Repairs Included'] }
            ].map((pkg) => (
                <div 
                    key={pkg.id}
                    onClick={() => updateField('selectedPackage', pkg.id)}
                    className={`relative p-5 border-2 rounded-xl cursor-pointer transition-all ${formData.selectedPackage === pkg.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-blue-300'}`}
                >
                    {pkg.popular && <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs px-3 py-1 rounded-bl-xl font-bold">MOST POPULAR</div>}
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-lg text-slate-900">{pkg.title}</h3>
                            <ul className="text-sm text-slate-600 mt-2 space-y-1">
                                {pkg.features.map(f => <li key={f} className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500"/> {f}</li>)}
                            </ul>
                        </div>
                        <div className="text-right">
                             <span className="block text-2xl font-bold text-blue-900">{formatPrice(pkg.price)}</span>
                             {formData.ventLocation === 'roof' && <span className="text-xs text-orange-600 font-medium">+ Roof Fee</span>}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4 text-sm font-medium text-slate-900">
                <span>Estimated Total:</span>
                <span className="text-xl">{formatPrice(estimate.total)}</span>
            </div>
             <div className="flex gap-4">
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={handleFinalSubmit} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-lg h-12">
                    {loading ? <Loader2 className="animate-spin" /> : "Book This Price"}
                </Button>
            </div>
        </div>
      </div>
  );

  const renderSuccess = () => (
      <div className="text-center py-8 space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-in zoom-in">
              <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
              <h2 className="text-2xl font-bold text-slate-900">Request Received!</h2>
              <p className="text-slate-600 mt-2">
                  We've sent a confirmation to <strong>{formData.email}</strong>.
              </p>
              <p className="text-slate-600">
                  A technician will review your details and call you shortly to confirm availability.
              </p>
          </div>
          <Button onClick={() => onOpenChange(false)} variant="outline">Close</Button>
      </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="px-1"
            >
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderSuccess()}
            </motion.div>
          </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default EstimateWizard;
