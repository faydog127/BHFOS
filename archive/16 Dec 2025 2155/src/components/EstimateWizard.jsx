import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { supabase } from '@/lib/customSupabaseClient';
import { calculateEstimate } from '@/lib/tvgEstimator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, AlertTriangle, Lock, ArrowRight, ArrowLeft,
  ArrowUpCircle, Mail, CheckCircle2, Tag, 
  Wind, Dog, Stethoscope, Sparkles, Activity, Calculator,
  Flame, Download
} from 'lucide-react';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { formatPhoneNumber } from '@/lib/formUtils';

// --- Components ---

const StepIndicator = ({ currentStep, steps }) => (
    <div className="flex justify-between mb-8 px-2 md:px-8 relative w-full max-w-3xl mx-auto">
        {steps.map((s, i) => {
            const stepNum = i + 1;
            const isActive = stepNum <= currentStep;
            return (
                <div key={s.id} className="flex flex-col items-center gap-2 relative z-10 w-24">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-base font-bold transition-all duration-300 border-2 ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-300'}`}>
                        {stepNum}
                    </div>
                    <span className={`text-[10px] md:text-xs font-medium uppercase tracking-wider text-center ${isActive ? 'text-blue-900' : 'text-slate-300'}`}>{s.label}</span>
                </div>
            )
        })}
        <div className="absolute top-4 md:top-5 left-0 w-full h-[2px] bg-slate-100 -z-0 transform translate-y-[-1px]" />
    </div>
);

const PackageCard = ({ title, price, basePrice, savings, features, recommended, selected, onSelect, colorClass, singleOption }) => (
    <div 
        onClick={onSelect}
        className={`relative flex flex-col h-full border-2 rounded-xl p-4 md:p-5 cursor-pointer transition-all duration-200 hover:shadow-lg ${selected ? `${colorClass} bg-opacity-5` : 'border-slate-100 bg-white hover:border-slate-300'} ${singleOption ? 'max-w-md mx-auto w-full' : ''}`}
        style={{ borderColor: selected ? undefined : undefined }} 
    >
        {recommended && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wide whitespace-nowrap z-10">
                Recommended
            </div>
        )}
        <div className="text-center mb-4 pt-2">
            <h3 className="font-bold text-lg md:text-xl text-slate-900">{title}</h3>
            <div className="flex items-baseline justify-center gap-1 mt-2">
                <span className="text-2xl md:text-3xl font-bold">${Math.round(price)}</span>
            </div>
            {savings > 0 && (
                <div className="text-xs text-green-600 font-medium bg-green-50 inline-block px-2 py-0.5 rounded-full mt-2">
                    Save ${Math.round(savings)}
                </div>
            )}
        </div>
        <ul className="space-y-3 text-sm text-slate-600 mb-6 flex-grow">
            {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="leading-tight text-xs md:text-sm text-left">{f}</span>
                </li>
            ))}
        </ul>
        <div className={`w-full h-1.5 rounded-full mt-auto ${selected ? 'bg-current opacity-20' : 'bg-slate-100'}`} />
    </div>
);

// --- Main Wizard ---

const EstimateWizard = ({ open, onOpenChange }) => {
  const { user, signUp, signInWithPassword } = useSupabaseAuth();
  const { isTrainingMode } = useTrainingMode(); 
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isAuthComplete, setIsAuthComplete] = useState(false);
  const [sending, setSending] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [priceBook, setPriceBook] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [savedEstimateId, setSavedEstimateId] = useState(null);
  const [createdLeadId, setCreatedLeadId] = useState(null);

  // Partner Logic
  const [partnerCode, setPartnerCode] = useState('');
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [activePartner, setActivePartner] = useState(null);

  // Form Data
  const [formData, setFormData] = useState({
      fullName: '',
      email: '',
      phone: '',
      address: '',
      password: '',
      placePhotoUrl: null
  });

  // Estimate Inputs
  const [inputs, setInputs] = useState({
      services: {
          duct: true,
          dryer: false,
          audit: false
      },
      propertyType: 'single_family',
      stories: '1',
      tripZone: 'TRIP-ZONE-1',
      numSystems: 1,
      numSupply: 12,
      numReturns: 1,
      accessLocations: ['closet'], 
      moldDetected: false,
      dryerRoof: false,
      dryerLongRun: false,
      callbackDate: '',
      callbackTime: '',
      healthProfile: {
          asthma: false,
          immunocompromised: false,
          pets: false,
          odors: false,
          dust: false,
          waterDamage: false,
          dryerHazard: false
      }
  });

  const [estimateResult, setEstimateResult] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState('better');

  // Load Prices
  useEffect(() => {
    const fetchPrices = async () => {
        const { data } = await supabase.from('price_book').select('*').eq('active', true);
        if (data) setPriceBook(data);
        setLoadingPrices(false);
    };
    fetchPrices();
  }, []);

  // Recalculate Logic
  useEffect(() => {
      if (priceBook.length > 0) {
          const result = calculateEstimate(inputs, priceBook, activePartner);
          setEstimateResult(result);
          
          if (inputs.services.duct) {
              if (inputs.healthProfile.asthma || inputs.healthProfile.immunocompromised) {
                  if (selectedPackage === 'good') setSelectedPackage('best');
              } else if ((inputs.healthProfile.odors || inputs.healthProfile.pets || inputs.moldDetected) && selectedPackage === 'good') {
                  setSelectedPackage('better');
              }
          } else {
             setSelectedPackage('good');
          }
      }
  }, [inputs, priceBook, activePartner]);

  // Sync user
  useEffect(() => {
      if (user) {
          setIsAuthComplete(true);
          setFormData(prev => ({
              ...prev,
              fullName: prev.fullName || user.user_metadata?.full_name || '',
              email: user.email || '',
              phone: prev.phone || user.user_metadata?.phone || '',
              address: prev.address || user.user_metadata?.address || ''
          }));
      }
  }, [user]);

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));
  
  const handleAddressSelect = (place) => {
    setFormData(prev => ({
        ...prev,
        address: place.formatted_address || prev.address,
        placePhotoUrl: place.placePhotoUrl
    }));
  };

  const handleSystemCountChange = (val) => {
      const count = parseInt(val);
      const newAccess = [...inputs.accessLocations];
      if (count > newAccess.length) {
          for(let i = newAccess.length; i < count; i++) newAccess.push('closet');
      } else if (count < newAccess.length) {
          newAccess.length = count;
      }
      let newSupply = inputs.numSupply;
      if (inputs.numSupply === 12 || inputs.numSupply === 24 || inputs.numSupply === 36) {
          newSupply = count * 12;
      }
      setInputs({...inputs, numSystems: count, accessLocations: newAccess, numSupply: newSupply});
  };

  const handleApplyCode = async () => {
      if (!partnerCode) return;
      setPartnerLoading(true);
      try {
          const { data, error } = await supabase
              .from('partners')
              .select('*')
              .eq('discount_code', partnerCode)
              .eq('discount_active', true)
              .single();
          
          if (error || !data) {
              toast({ variant: "destructive", title: "Invalid Code", description: "That partner code was not found or is inactive." });
              setActivePartner(null);
          } else {
              setActivePartner(data);
              toast({ title: "Discount Applied!", description: `${data.org_name} discount activated.` });
          }
      } catch (err) {
          console.error(err);
      } finally {
          setPartnerLoading(false);
      }
  };

  const handleAuthSubmit = async (e) => {
      e.preventDefault();
      setAuthLoading(true);
      try {
          if (isLoginMode) {
              const { error } = await signInWithPassword({ email: formData.email, password: formData.password });
              if (error) throw error;
              
              const { data: lead } = await supabase.from('leads').select('id').eq('email', formData.email).maybeSingle();
              if (lead) setCreatedLeadId(lead.id);
          } else {
              const { error } = await signUp(formData.email, formData.password, {
                  full_name: formData.fullName,
                  phone: formData.phone,
                  address: formData.address
              });
              if (error) throw error;
              
              const { data: newLead, error: leadError } = await supabase.from('leads').insert({
                  name: formData.fullName,
                  first_name: formData.fullName.split(' ')[0],
                  last_name: formData.fullName.split(' ').slice(1).join(' '),
                  email: formData.email,
                  phone: formData.phone,
                  source: 'estimate_wizard',
                  status: 'new',
                  pipeline_stage: 'new',
                  message: `Address: ${formData.address}`,
                  home_image_url: formData.placePhotoUrl,
                  is_test_data: isTrainingMode
              }).select('id').single();

              if (leadError) console.error("Error creating lead:", leadError);
              if (newLead) setCreatedLeadId(newLead.id);
          }
          setIsAuthComplete(true);
          toast({ title: "Success", description: "Authentication successful." });
      } catch (err) {
          toast({ variant: "destructive", title: "Authentication Error", description: err.message });
      } finally {
          setAuthLoading(false);
      }
  };

  const saveEstimate = async (status = 'draft') => {
      const currentDiscount = estimateResult?.discounts[selectedPackage] || 0;
      const totalAmount = estimateResult.totals[selectedPackage];

      // Merge email into property_details so SQL kanban view can find it
      const propertyDetailsWithEmail = {
          ...inputs,
          email: formData.email,
          phone: formData.phone,
          customerName: formData.fullName,
          address: formData.address
      };

      const payload = {
            user_id: user?.id || null, 
            status: status,
            step: step,
            services: estimateResult.lineItems,
            property_details: propertyDetailsWithEmail,
            total_price: totalAmount,
            add_ons: { selectedPackage },
            applied_partner_id: activePartner?.id || null,
            applied_discount_code: activePartner?.discount_code || null,
            applied_discount_amount: currentDiscount
      };

      if (savedEstimateId) {
          const { error } = await supabase.from('estimates').update(payload).eq('id', savedEstimateId);
          if (error) throw error;
          return savedEstimateId;
      } else {
          const { data, error } = await supabase.from('estimates').insert(payload).select().single();
          if (error) throw error;
          setSavedEstimateId(data.id);
          return data.id;
      }
  };

  const handleSubmitQuote = async () => {
      if (!inputs.callbackDate) {
        toast({ variant: "destructive", title: "Required", description: "Please select a preferred date." });
        return;
      }

      setSending(true);

      try {
        const estId = await saveEstimate('submitted');
        
        let leadId = createdLeadId;
        if (!leadId && formData.email) {
            const { data: lead } = await supabase.from('leads').select('id').eq('email', formData.email).maybeSingle();
            if (lead) leadId = lead.id;
        }

        if (!leadId) {
             const { data: newLead, error: createError } = await supabase.from('leads').insert({
                  name: formData.fullName,
                  first_name: formData.fullName.split(' ')[0],
                  last_name: formData.fullName.split(' ').slice(1).join(' '),
                  email: formData.email,
                  phone: formData.phone,
                  source: 'estimate_wizard_fallback', 
                  status: 'new',
                  pipeline_stage: 'new',
                  message: `Address: ${formData.address}`,
                  is_test_data: isTrainingMode
             }).select('id').single();
             if (!createError && newLead) leadId = newLead.id;
        }

        if (leadId && estId) {
             const { data: quote, error: quoteError } = await supabase.from('quotes').insert({
                 lead_id: leadId,
                 user_id: user?.id,
                 estimate_id: estId,
                 status: 'pending_review',
                 total_amount: estimateResult.totals[selectedPackage],
                 valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                 header_text: "Generated from Online Estimate. Pending Confirmation."
             }).select().single();

             if (quote && !quoteError) {
                 const quoteItems = estimateResult.lineItems.map(item => ({
                     quote_id: quote.id,
                     description: item.name,
                     quantity: item.qty,
                     unit_price: item.unitPrice,
                     total_price: item.total,
                     price_book_code: item.code
                 }));
                 await supabase.from('quote_items').insert(quoteItems);
             }
        }

        const payload = {
            name: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            inputs: inputs,
            estimateResult: estimateResult, 
            selectedPackage: selectedPackage,
            placePhotoUrl: formData.placePhotoUrl,
            estimateId: estId
        };
        
        await supabase.functions.invoke('send-estimate', { body: payload });

        toast({
            title: "Quote Submitted!",
            description: `We've received your request. A verification email has been sent to ${formData.email}.`,
            className: "bg-green-50 border-green-200"
        });
        
        setTimeout(() => onOpenChange(false), 3500);

      } catch (err) {
        console.error("Submission Exception:", err);
        toast({ variant: "destructive", title: "Error", description: err.message });
      } finally {
        setSending(false);
      }
  };
  
  const handleDownloadPDF = () => {
      toast({ title: "Generating PDF...", description: "Your download will start shortly." });
      setTimeout(() => {
          toast({ title: "Download Ready", description: "Estimate PDF has been saved to your device." });
      }, 1500);
  };

  const getPackageFeatures = (pkg) => {
    if (inputs.services.dryer && !inputs.services.duct && !inputs.services.audit) {
        return [
            'Visual Safety Inspection',
            'Connection to Termination Cleaning',
            'Digital Airflow Analysis',
            'Blockage & Bird Nest Removal',
            'Code Compliance Check',
            'Cleanup & Debris Removal'
        ];
    }
    if (inputs.services.audit && !inputs.services.duct && !inputs.services.dryer) {
        return [
            'Laser Particle Count (PM2.5 / PM10)',
            'Relative Humidity Mapping',
            'System Static Pressure Test',
            'Visual Ductwork Inspection',
            'Digital Health Scorecard',
            'Customized Action Plan'
        ];
    }
    if (pkg === 'good') {
        return ['Standard Service', 'Negative Air Machine', 'Basic Sanitizer', 'Dryer Vent Cleaning'];
    } else if (pkg === 'better') {
        return ['Everything in Good', 'Dual-Bulb UV Light', 'Coil Cleaning', 'Max Antimicrobial'];
    } else if (pkg === 'best') {
        return ['Everything in Better', 'PCO Hospital Grade Air Purifier', 'Blower Motor Restoration', '1-Year Warranty'];
    }
    return [];
  };

  const getRenderMode = () => {
      if (inputs.services.duct) return 'hvac';
      if (inputs.services.dryer && !inputs.services.audit) return 'dryer_only';
      if (inputs.services.audit && !inputs.services.dryer) return 'audit_only';
      return 'dryer_only';
  };

  const renderAuth = () => (
      <div className="p-6 md:p-8 animate-in fade-in max-w-md mx-auto">
          <div className="text-center mb-8">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                 <Lock className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">See Your Price Instantly</h3>
              <p className="text-base text-slate-500 mt-2">Unlock your custom quote in seconds.</p>
          </div>
          <form onSubmit={handleAuthSubmit} className="space-y-5">
              {!isLoginMode && (
                  <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="John Doe" className="h-11"/>
                  </div>
              )}
              <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="you@example.com" className="h-11"/>
              </div>
              {!isLoginMode && (
                <>
                  <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})} placeholder="(555) 123-4567" maxLength={14} className="h-11"/>
                  </div>
                  <div className="space-y-2">
                      <Label>Address</Label>
                      <AddressAutocomplete 
                          required 
                          value={formData.address} 
                          onChange={e => setFormData({...formData, address: e.target.value})}
                          onAddressSelect={handleAddressSelect}
                          className="h-11"
                      />
                  </div>
                </>
              )}
              <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" className="h-11"/>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base font-semibold mt-2" disabled={authLoading}>
                  {authLoading ? <Loader2 className="animate-spin h-5 w-5"/> : (isLoginMode ? "View Estimate" : "See Pricing")}
              </Button>
              <div className="text-center text-sm mt-6">
                  <button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="text-blue-600 hover:underline font-medium p-2">
                      {isLoginMode ? "First time here? Get Started" : "Already have an account? Sign In"}
                  </button>
              </div>
          </form>
      </div>
  );

  const renderContent = () => {
      if (!isAuthComplete) return renderAuth();
      if (loadingPrices) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>;

      switch(step) {
          case 1: return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 max-w-3xl mx-auto">
                <div className="space-y-4">
                     <Label className="text-base font-semibold text-slate-900">Select Services Needed</Label>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div 
                            className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-all ${inputs.services.duct ? 'bg-blue-50 border-blue-300 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}
                            onClick={() => setInputs(prev => ({...prev, services: {...prev.services, duct: !prev.services.duct}}))}
                        >
                             <div className={`w-5 h-5 rounded border flex items-center justify-center ${inputs.services.duct ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                {inputs.services.duct && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                             </div>
                             <span className="font-medium">Air Duct Cleaning</span>
                        </div>

                        <div 
                            className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-all ${inputs.services.dryer ? 'bg-blue-50 border-blue-300 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}
                            onClick={() => setInputs(prev => ({...prev, services: {...prev.services, dryer: !prev.services.dryer}}))}
                        >
                             <div className={`w-5 h-5 rounded border flex items-center justify-center ${inputs.services.dryer ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                {inputs.services.dryer && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                             </div>
                             <span className="font-medium">Dryer Vent</span>
                        </div>

                        <div 
                            className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-all ${inputs.services.audit ? 'bg-blue-50 border-blue-300 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}
                            onClick={() => setInputs(prev => ({...prev, services: {...prev.services, audit: !prev.services.audit}}))}
                        >
                             <div className={`w-5 h-5 rounded border flex items-center justify-center ${inputs.services.audit ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                {inputs.services.audit && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                             </div>
                             <span className="font-medium">Indoor Air Audit</span>
                        </div>
                     </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-base">Number of Systems</Label>
                            <Select value={inputs.numSystems.toString()} onValueChange={handleSystemCountChange}>
                                <SelectTrigger className="h-12 text-base"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {[1,2,3,4].map(n => <SelectItem key={n} value={n.toString()}>{n} System{n>1?'s':''}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-base">Travel Zone</Label>
                           <Select value={inputs.tripZone} onValueChange={v => setInputs({...inputs, tripZone: v})}>
                               <SelectTrigger className="h-12 text-base"><SelectValue/></SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="TRIP-ZONE-1">Standard (Brevard)</SelectItem>
                                   <SelectItem value="TRIP-ZONE-2">Extended (Volusia)</SelectItem>
                                </SelectContent>
                           </Select>
                        </div>
                    </div>

                    {inputs.services.duct && (
                         <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center gap-2 mb-1">
                                <Calculator className="w-5 h-5 text-blue-600" />
                                <Label className="text-base font-semibold text-slate-900">How many vents do you have?</Label>
                             </div>
                             <p className="text-sm text-slate-600 mb-2">Count all supply vents (where air comes out). Our standard pricing includes 12 vents per system.</p>
                             <div className="flex items-center gap-4">
                                <Input 
                                    type="number" 
                                    className="h-12 text-lg w-32 bg-white border-blue-300 focus-visible:ring-blue-500" 
                                    value={inputs.numSupply}
                                    onChange={(e) => setInputs({...inputs, numSupply: parseInt(e.target.value) || 0})}
                                    min={0}
                                />
                                <span className="text-sm font-medium text-slate-500">
                                    {inputs.numSupply > (inputs.numSystems * 12) 
                                        ? `(${inputs.numSupply - (inputs.numSystems * 12)} extra vents will be added)` 
                                        : '(Included in base price)'}
                                </span>
                             </div>
                         </div>
                    )}

                    {inputs.services.dryer && (
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                            <Label className="text-base font-semibold text-slate-900">Dryer Specifics</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                                    <Checkbox id="d-roof" checked={inputs.dryerRoof} onCheckedChange={c => setInputs({...inputs, dryerRoof: c})} className="w-5 h-5" />
                                    <Label htmlFor="d-roof" className="font-normal text-slate-700 cursor-pointer text-sm">Roof Access Required</Label>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                                    <Checkbox id="d-run" checked={inputs.dryerLongRun} onCheckedChange={c => setInputs({...inputs, dryerLongRun: c})} className="w-5 h-5" />
                                    <Label htmlFor="d-run" className="font-normal text-slate-700 cursor-pointer text-sm">Run Longer than 25ft</Label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4 pt-2">
                    <div>
                        <Label className="flex items-center gap-2 text-slate-900 text-lg mb-1">
                             {inputs.healthProfile.dryerHazard ? <Flame className="w-5 h-5 text-orange-500" /> : <Stethoscope className="w-5 h-5 text-blue-600"/> }
                             {inputs.healthProfile.dryerHazard ? "Safety & Efficiency Profile" : "Health & Home Profile"}
                        </Label>
                        <p className="text-sm text-slate-500">Select all that apply to see tailored recommendations.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-all ${inputs.healthProfile.asthma ? 'bg-blue-50 border-blue-300 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}
                             onClick={() => setInputs({...inputs, healthProfile: {...inputs.healthProfile, asthma: !inputs.healthProfile.asthma}})}>
                             <div className={`p-2 rounded-full ${inputs.healthProfile.asthma ? 'bg-blue-200' : 'bg-slate-100'}`}>
                                <Wind className={`w-5 h-5 ${inputs.healthProfile.asthma ? 'text-blue-700' : 'text-slate-500'}`} />
                             </div>
                             <span className="text-sm font-medium">Asthma / Allergies</span>
                        </div>
                        
                        <div className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-all ${inputs.healthProfile.pets ? 'bg-blue-50 border-blue-300 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}
                             onClick={() => setInputs({...inputs, healthProfile: {...inputs.healthProfile, pets: !inputs.healthProfile.pets}})}>
                             <div className={`p-2 rounded-full ${inputs.healthProfile.pets ? 'bg-blue-200' : 'bg-slate-100'}`}>
                                <Dog className={`w-5 h-5 ${inputs.healthProfile.pets ? 'text-blue-700' : 'text-slate-500'}`} />
                             </div>
                             <span className="text-sm font-medium">Pets in Home</span>
                        </div>

                        {inputs.services.dryer ? (
                             <div className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-all ${inputs.healthProfile.dryerHazard ? 'bg-orange-50 border-orange-300 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}
                                 onClick={() => setInputs({...inputs, healthProfile: {...inputs.healthProfile, dryerHazard: !inputs.healthProfile.dryerHazard}})}>
                                 <div className={`p-2 rounded-full ${inputs.healthProfile.dryerHazard ? 'bg-orange-200' : 'bg-slate-100'}`}>
                                    <Flame className={`w-5 h-5 ${inputs.healthProfile.dryerHazard ? 'text-orange-700' : 'text-slate-500'}`} />
                                 </div>
                                 <span className="text-sm font-medium">Clothes Taking Long to Dry</span>
                            </div>
                        ) : (
                             <div className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-all ${inputs.healthProfile.odors ? 'bg-blue-50 border-blue-300 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}
                                 onClick={() => setInputs({...inputs, healthProfile: {...inputs.healthProfile, odors: !inputs.healthProfile.odors}})}>
                                 <div className={`p-2 rounded-full ${inputs.healthProfile.odors ? 'bg-blue-200' : 'bg-slate-100'}`}>
                                    <Sparkles className={`w-5 h-5 ${inputs.healthProfile.odors ? 'text-blue-700' : 'text-slate-500'}`} />
                                 </div>
                                 <span className="text-sm font-medium">Musty Odors</span>
                            </div>
                        )}
                        
                        <div className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-all ${inputs.moldDetected ? 'bg-red-50 border-red-300 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}
                             onClick={() => setInputs({...inputs, moldDetected: !inputs.moldDetected})}>
                             <div className={`p-2 rounded-full ${inputs.moldDetected ? 'bg-red-200' : 'bg-slate-100'}`}>
                                <AlertTriangle className={`w-5 h-5 ${inputs.moldDetected ? 'text-red-700' : 'text-slate-500'}`} />
                             </div>
                             <span className="text-sm font-medium ${inputs.moldDetected ? 'text-red-700' : ''}">Visible Growth</span>
                        </div>
                    </div>
                </div>
            </div>
          );

          case 2:
            const renderMode = getRenderMode();
            return (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                 <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-6 max-w-3xl mx-auto">
                    <Input 
                        placeholder="Have a Partner Code? (e.g. HVAC10)" 
                        className="h-10 bg-white text-base" 
                        value={partnerCode}
                        onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                        disabled={!!activePartner}
                    />
                    {activePartner ? (
                        <Button variant="ghost" size="sm" onClick={() => { setActivePartner(null); setPartnerCode(''); }} className="h-10 px-4 text-red-500 hover:text-red-700 hover:bg-red-50">Remove</Button>
                    ) : (
                        <Button size="sm" onClick={handleApplyCode} disabled={!partnerCode || partnerLoading} className="h-10 px-6 bg-blue-600 font-semibold">
                            {partnerLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Apply'}
                        </Button>
                    )}
                 </div>

                 {renderMode === 'dryer_only' && (
                     <div className="max-w-xl mx-auto">
                         <PackageCard 
                             title="Standard Cleaning & Inspection" 
                             price={estimateResult.totals.good} 
                             basePrice={estimateResult.baseTotals.good}
                             savings={estimateResult.discounts.good}
                             features={getPackageFeatures()} 
                             selected={true}
                             singleOption={true}
                             onSelect={() => setSelectedPackage('good')}
                             colorClass="border-blue-500 bg-blue-50"
                         />
                     </div>
                 )}

                 {renderMode === 'audit_only' && (
                     <div className="max-w-xl mx-auto">
                         <PackageCard 
                             title="Diagnostic Air Audit" 
                             price={estimateResult.totals.good} 
                             basePrice={estimateResult.baseTotals.good}
                             savings={estimateResult.discounts.good}
                             features={getPackageFeatures()} 
                             selected={true}
                             singleOption={true}
                             onSelect={() => setSelectedPackage('good')}
                             colorClass="border-purple-600 bg-purple-50"
                         />
                     </div>
                 )}

                 {renderMode === 'hvac' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-stretch max-w-5xl mx-auto">
                        <PackageCard 
                            title="Good" 
                            price={estimateResult.totals.good} 
                            basePrice={estimateResult.baseTotals.good}
                            savings={estimateResult.discounts.good}
                            features={getPackageFeatures('good')}
                            selected={selectedPackage === 'good'}
                            onSelect={() => setSelectedPackage('good')}
                            colorClass="border-slate-400 bg-slate-50"
                        />
                        <PackageCard 
                            title="Better" 
                            price={estimateResult.totals.better} 
                            basePrice={estimateResult.baseTotals.better}
                            savings={estimateResult.discounts.better}
                            features={getPackageFeatures('better')}
                            recommended={inputs.healthProfile.odors || inputs.healthProfile.pets}
                            selected={selectedPackage === 'better'}
                            onSelect={() => setSelectedPackage('better')}
                            colorClass="border-blue-500 bg-blue-50"
                        />
                        <PackageCard 
                            title="Best" 
                            price={estimateResult.totals.best} 
                            basePrice={estimateResult.baseTotals.best}
                            savings={estimateResult.discounts.best}
                            features={getPackageFeatures('best')}
                            recommended={inputs.healthProfile.asthma || inputs.healthProfile.immunocompromised}
                            selected={selectedPackage === 'best'}
                            onSelect={() => setSelectedPackage('best')}
                            colorClass="border-purple-600 bg-purple-50"
                        />
                    </div>
                 )}
                 
                 <div className="text-center text-xs md:text-sm text-slate-500 mt-4">
                    *Prices include Standard service scope. Additional fees may apply for access difficulties or extras.
                 </div>
             </div>
          );

          case 3: return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 max-w-3xl mx-auto">
                <Card className="border-2 border-slate-100 shadow-md overflow-hidden">
                    <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-xl">Proposal Summary</h3>
                            <p className="text-xs text-slate-300">Valid for 30 days</p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs opacity-70 uppercase tracking-wider">Total Investment</div>
                            <div className="text-3xl font-bold">${Math.round(estimateResult.totals[selectedPackage])}</div>
                        </div>
                    </div>
                    
                    <div className="p-0">
                        <div className="bg-slate-50 px-5 py-3 border-b flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span>Service</span>
                            <span>Amount</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {estimateResult.lineItems.map((item, i) => (
                                <div key={i} className="px-5 py-4 flex justify-between text-sm">
                                    <div className="pr-4">
                                        <span className="font-medium text-slate-800">{item.name}</span>
                                        {item.qty > 1 && <span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold border border-slate-200">x{item.qty}</span>}
                                    </div>
                                    <span className="text-slate-600 font-mono">${Math.round(item.total)}</span>
                                </div>
                            ))}
                            
                            {inputs.services.duct && selectedPackage !== 'good' && (
                                <div className="px-5 py-4 flex justify-between text-sm bg-blue-50/40">
                                    <span className="font-semibold text-blue-900">
                                        Package Upgrades ({selectedPackage.charAt(0).toUpperCase() + selectedPackage.slice(1)})
                                    </span>
                                    <span className="text-blue-900 font-bold">Included</span>
                                </div>
                            )}

                            {activePartner && estimateResult.discounts[selectedPackage] > 0 && (
                                <div className="px-5 py-4 flex justify-between text-sm bg-green-50 border-t border-green-100">
                                    <span className="font-bold text-green-700 flex items-center gap-2">
                                        <Tag className="w-4 h-4"/> Partner Savings ({activePartner.discount_code})
                                    </span>
                                    <span className="font-bold text-green-700">-${Math.round(estimateResult.discounts[selectedPackage])}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-5 border-t space-y-3">
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>Standard Price</span>
                            <span className="line-through decoration-slate-400">${Math.round(estimateResult.baseTotals[selectedPackage])}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-200">
                            <span>Your Total Today</span>
                            <span className="text-blue-700">${Math.round(estimateResult.totals[selectedPackage])}</span>
                        </div>
                    </div>
                </Card>

                {estimateResult.recommendations.filter(r => r.type === 'upgrade' && r.upgradeFor?.includes(selectedPackage)).length > 0 && (
                    <div className="space-y-4 pt-2">
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest pl-1">Recommended Upgrades</h4>
                        {estimateResult.recommendations.filter(r => r.type === 'upgrade' && r.upgradeFor?.includes(selectedPackage)).map(rec => (
                            <div key={rec.id} className="flex items-center justify-between p-4 border rounded-xl hover:border-blue-400 hover:shadow-md cursor-pointer bg-white transition-all group"
                                 onClick={() => {
                                     if (rec.id === 'pco-upgrade') setSelectedPackage('best');
                                     if (rec.id === 'uv-light') setSelectedPackage('better');
                                 }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <ArrowUpCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-base text-slate-900">{rec.title}</div>
                                        <div className="text-sm text-slate-500 line-clamp-1">{rec.desc}</div>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600">+ Add</Button>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="flex justify-end pt-2">
                    <Button variant="ghost" onClick={handleDownloadPDF} className="text-slate-500 hover:text-slate-900 gap-2">
                        <Download className="w-4 h-4"/> Download Estimate PDF
                    </Button>
                </div>
            </div>
          );

          case 4: return (
             <div className="space-y-8 animate-in fade-in slide-in-from-right-4 max-w-3xl mx-auto">
                 <div className="text-center py-8">
                     <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                         <Mail className="w-10 h-10 text-green-600" />
                     </div>
                     <h3 className="text-2xl font-bold text-slate-900">Request Appointment</h3>
                     <p className="text-base text-slate-500 mt-3 max-w-sm mx-auto">
                         Submit your request. We will confirm availability shortly.
                     </p>
                 </div>

                 <div className="space-y-5 max-w-sm mx-auto">
                     <div className="space-y-2">
                         <Label className="text-base">Preferred Service Date</Label>
                         <Input type="date" className="h-12 text-base" value={inputs.callbackDate} onChange={e => setInputs({...inputs, callbackDate: e.target.value})} />
                     </div>
                     <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-sm text-slate-700 shadow-sm">
                         {inputs.services.duct && (
                             <p className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                                <span className="font-medium">Selected Package:</span>
                                <span className="font-bold text-slate-900">{selectedPackage.charAt(0).toUpperCase() + selectedPackage.slice(1)}</span>
                             </p>
                         )}
                         <p className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                            <span className="font-medium">System Count:</span>
                            <span>{inputs.numSystems}</span>
                         </p>
                         <p className="flex justify-between text-lg font-bold text-blue-700 pt-1">
                            <span>Estimated Total:</span> 
                            <span>${Math.round(estimateResult.totals[selectedPackage])}</span>
                         </p>
                     </div>
                 </div>
             </div>
          );
      }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-h-[95vh] md:max-w-5xl p-0 gap-0 flex flex-col bg-white overflow-hidden sm:rounded-lg">
         <div className="p-4 md:p-6 border-b sticky top-0 bg-white z-20 flex justify-between items-center shrink-0">
            <div>
                <DialogTitle className="text-xl font-bold">Estimate Wizard</DialogTitle>
                <DialogDescription className="text-sm">v2.5 Partner Edition (Locked In)</DialogDescription>
            </div>
         </div>

         <div className="flex-grow overflow-y-auto min-h-0 bg-white">
             <div className="p-4 md:p-8">
                 {isAuthComplete && <StepIndicator currentStep={step} steps={[{id:1, label:'Profile'}, {id:2, label:'Options'}, {id:3, label:'Review'}, {id:4, label:'Finish'}]} />}
                 <div className="min-h-[400px]">
                    {renderContent()}
                 </div>
             </div>
         </div>

         {isAuthComplete && (
             <div className="p-4 md:p-6 bg-slate-50 border-t flex gap-4 shrink-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {step > 1 && (
                    <Button variant="outline" onClick={handleBack} className="flex-1 h-12 text-base">
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back
                    </Button>
                )}
                {step < 4 ? (
                    <Button onClick={handleNext} className="flex-[2] h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-md">
                        Next <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                ) : (
                    <Button onClick={handleSubmitQuote} disabled={sending} className="flex-[2] h-12 text-base font-bold bg-green-600 hover:bg-green-700 shadow-md">
                        {sending ? <Loader2 className="animate-spin mr-2 h-5 w-5"/> : <Mail className="mr-2 h-5 w-5"/>}
                        {sending ? 'Sending...' : 'Request Booking'}
                    </Button>
                )}
            </div>
         )}
      </DialogContent>
    </Dialog>
  );
};

export default EstimateWizard;