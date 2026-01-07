import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { detectBrandFromUrl, validateUrl } from '@/lib/brandDetection';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, ChevronRight, ChevronLeft, Globe, Building, CreditCard, Palette, Settings, CheckCircle2, AlertCircle, Upload, Wand as MagicWand } from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Discovery', icon: Globe },
  { id: 2, title: 'Company', icon: Building },
  { id: 3, title: 'Billing', icon: CreditCard },
  { id: 4, title: 'Branding', icon: Palette },
  { id: 5, title: 'Features', icon: Settings },
  { id: 6, title: 'Review', icon: CheckCircle2 },
];

const AVAILABLE_FEATURES = [
  { id: 'enableLeads', label: 'Leads Management', description: 'Track and qualify incoming prospects.' },
  { id: 'enablePipeline', label: 'Deal Pipeline', description: 'Visual kanban board for sales tracking.' },
  { id: 'enableJobs', label: 'Jobs & Projects', description: 'Manage active work orders and assignments.' },
  { id: 'enableInvoicing', label: 'Invoicing & Payments', description: 'Generate invoices and process payments.' },
  { id: 'enableReporting', label: 'Analytics Engine', description: 'Deep dive into business performance metrics.' },
  { id: 'enableMarketing', label: 'Marketing Suite', description: 'Automated campaigns and communication.' },
];

const TenantOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Discovery
    website_url: '',
    
    // Step 2: Company
    company_name: '',
    description: '',
    industry: '',
    company_size: '',
    poc_name: '',
    poc_email: '',
    poc_phone: '',
    address: { street: '', city: '', state: '', zip: '', country: 'USA' },

    // Step 3: Billing
    billing_contact_name: '',
    billing_email: '',
    billing_same_as_company: true,
    payment_method: 'credit_card',
    billing_cycle: 'monthly',
    plan: 'professional',
    tax_id: '',
    billing_address: { street: '', city: '', state: '', zip: '', country: 'USA' },

    // Step 4: Branding
    logo_url: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    
    // Step 5: Features
    feature_flags: AVAILABLE_FEATURES.reduce((acc, f) => ({ ...acc, [f.id]: true }), {})
  });

  // Detection Logic
  const handleAutoDetect = async () => {
    if (!formData.website_url) return;
    
    // Add protocol if missing for validation
    let urlToTest = formData.website_url;
    if (!/^https?:\/\//i.test(urlToTest)) {
        urlToTest = 'https://' + urlToTest;
    }

    if (!validateUrl(urlToTest)) {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter a valid website address.' });
      return;
    }

    setIsDetecting(true);
    try {
      const result = await detectBrandFromUrl(urlToTest);
      setFormData(prev => ({
        ...prev,
        ...result,
        website_url: urlToTest // Normalize URL
      }));
      toast({ 
        title: 'Brand Detected', 
        description: `Successfully extracted details for ${result.company_name}.`,
        className: "bg-emerald-50 border-emerald-200 text-emerald-800"
      });
      // Auto-advance after successful detection
      setTimeout(() => setCurrentStep(2), 800);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Detection Failed', description: 'Could not extract brand data. Please enter manually.' });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) setCurrentStep(curr => curr + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(curr => curr - 1);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      // Generate a temporary ID for the folder until we actually create the tenant row
      const tempId = `temp_${Date.now()}`; 
      const filePath = `tenant-logos/${tempId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tenant-logos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));
      toast({ title: 'Logo Uploaded', description: 'Custom logo has been staged.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    }
  };

  const handleFinalSubmit = async () => {
    setIsSaving(true);
    
    try {
      // 1. Generate ID slug
      const tenantId = formData.company_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || `tenant-${Date.now()}`;

      // 2. Prepare Payload
      const payload = {
        id: tenantId,
        name: formData.company_name,
        logo_url: formData.logo_url,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        website_url: formData.website_url,
        description: formData.description,
        feature_flags: formData.feature_flags,
        poc_name: formData.poc_name,
        poc_email: formData.poc_email,
        poc_phone: formData.poc_phone,
        company_size: formData.company_size,
        industry: formData.industry,
        address: formData.address,
        billing_contact_name: formData.billing_contact_name,
        billing_email: formData.billing_email,
        billing_address: formData.billing_same_as_company ? formData.address : formData.billing_address,
        payment_method: formData.payment_method,
        billing_cycle: formData.billing_cycle,
        plan: formData.plan,
        tax_id: formData.tax_id,
        status: 'active'
      };

      // 3. Insert to DB
      const { error } = await supabase.from('tenants').insert(payload);

      if (error) throw error;

      // 4. Success & Redirect
      toast({
        title: 'Onboarding Complete',
        description: `${formData.company_name} has been successfully provisioned.`,
        className: "bg-green-50 border-green-200"
      });
      
      navigate('/bhf/tenant-management');

    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Provisioning Failed', 
        description: error.message 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-[#fbbf24]/10 rounded-lg border border-[#fbbf24]/20">
               <Building className="w-5 h-5 text-[#fbbf24]" />
            </div>
            <div>
               <h1 className="text-white font-bold text-lg tracking-tight">Factory OS <span className="text-slate-500 font-normal">| Tenant Onboarding</span></h1>
            </div>
         </div>
         <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => navigate('/bhf/tenant-management')}>
            Cancel & Exit
         </Button>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-8">
        
        {/* Progress Stepper */}
        <div className="mb-12">
           <div className="flex justify-between relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-0"></div>
              <div className="absolute top-1/2 left-0 h-0.5 bg-slate-900 -z-0 transition-all duration-500" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>
              
              {STEPS.map((step) => {
                 const isActive = step.id === currentStep;
                 const isCompleted = step.id < currentStep;
                 
                 return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'bg-slate-900 border-slate-900 text-[#fbbf24] shadow-lg scale-110' : isCompleted ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-400'}`}>
                          {isCompleted ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                       </div>
                       <span className={`text-xs font-semibold uppercase tracking-wider ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{step.title}</span>
                    </div>
                 );
              })}
           </div>
        </div>

        {/* Wizard Content */}
        <Card className="border-0 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
           <div className="flex-1 relative">
             <AnimatePresence mode="wait">
               <motion.div
                 key={currentStep}
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 transition={{ duration: 0.3 }}
                 className="p-8 h-full"
               >
                 {/* STEP 1: DISCOVERY */}
                 {currentStep === 1 && (
                    <div className="max-w-xl mx-auto flex flex-col items-center justify-center h-full text-center space-y-8 py-12">
                       <div className="p-6 bg-blue-50 rounded-full">
                          <Globe className="w-12 h-12 text-blue-600" />
                       </div>
                       <div className="space-y-2">
                          <h2 className="text-3xl font-bold text-slate-900">Let's start with their website</h2>
                          <p className="text-slate-500 text-lg">We'll use our AI engine to auto-detect branding and company details.</p>
                       </div>
                       <div className="w-full space-y-4">
                          <div className="relative">
                             <Input 
                                placeholder="example.com" 
                                className="h-14 text-lg pl-6 shadow-sm border-slate-300"
                                value={formData.website_url}
                                onChange={(e) => setFormData({...formData, website_url: e.target.value})}
                                onKeyDown={(e) => e.key === 'Enter' && handleAutoDetect()}
                             />
                          </div>
                          <Button size="lg" className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800" onClick={handleAutoDetect} disabled={isDetecting}>
                             {isDetecting ? (
                                <>
                                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing Site...
                                </>
                             ) : (
                                <>
                                  <MagicWand className="w-5 h-5 mr-2 text-[#fbbf24]" /> Auto-Detect Brand
                                </>
                             )}
                          </Button>
                          <button onClick={handleNext} className="text-sm text-slate-400 hover:text-slate-600 underline">
                             Skip detection and enter manually
                          </button>
                       </div>
                    </div>
                 )}

                 {/* STEP 2: COMPANY INFO */}
                 {currentStep === 2 && (
                    <div className="space-y-6">
                       <div className="border-b pb-4 mb-6">
                          <h2 className="text-2xl font-bold text-slate-900">Company Information</h2>
                          <p className="text-slate-500">Basic details about the organization.</p>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <Label>Company Name</Label>
                             <Input value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                             <Label>Industry / Category</Label>
                             <Select onValueChange={val => setFormData({...formData, industry: val})} defaultValue={formData.industry}>
                                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="Technology">Technology</SelectItem>
                                   <SelectItem value="Service">Service</SelectItem>
                                   <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                                   <SelectItem value="Retail">Retail</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="col-span-2 space-y-2">
                             <Label>Description</Label>
                             <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                          </div>
                       </div>

                       <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                          <h3 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4" /> Point of Contact</h3>
                          <div className="grid grid-cols-3 gap-4">
                             <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input value={formData.poc_name} onChange={e => setFormData({...formData, poc_name: e.target.value})} />
                             </div>
                             <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={formData.poc_email} onChange={e => setFormData({...formData, poc_email: e.target.value})} />
                             </div>
                             <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input value={formData.poc_phone} onChange={e => setFormData({...formData, poc_phone: e.target.value})} />
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

                 {/* STEP 3: BILLING */}
                 {currentStep === 3 && (
                    <div className="space-y-6">
                       <div className="border-b pb-4 mb-6">
                          <h2 className="text-2xl font-bold text-slate-900">Billing & Plan</h2>
                          <p className="text-slate-500">Subscription configuration and payment details.</p>
                       </div>

                       <div className="grid grid-cols-3 gap-6">
                          {['starter', 'professional', 'enterprise'].map((plan) => (
                             <div 
                                key={plan}
                                onClick={() => setFormData({...formData, plan})}
                                className={`cursor-pointer border-2 rounded-xl p-6 text-center transition-all ${formData.plan === plan ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900 ring-offset-2' : 'border-slate-200 hover:border-slate-300'}`}
                             >
                                <div className="uppercase tracking-widest text-xs font-bold text-slate-500 mb-2">{plan}</div>
                                <div className="text-xl font-bold capitalize">{plan} Plan</div>
                             </div>
                          ))}
                       </div>

                       <div className="grid grid-cols-2 gap-6 mt-6">
                          <div className="space-y-2">
                             <Label>Billing Contact</Label>
                             <Input value={formData.billing_contact_name} onChange={e => setFormData({...formData, billing_contact_name: e.target.value})} placeholder="Full Name" />
                          </div>
                          <div className="space-y-2">
                             <Label>Billing Email</Label>
                             <Input value={formData.billing_email} onChange={e => setFormData({...formData, billing_email: e.target.value})} placeholder="billing@company.com" />
                          </div>
                          <div className="space-y-2">
                             <Label>Payment Method</Label>
                             <Select onValueChange={val => setFormData({...formData, payment_method: val})} defaultValue={formData.payment_method}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="credit_card">Credit Card</SelectItem>
                                   <SelectItem value="ach">ACH Transfer</SelectItem>
                                   <SelectItem value="invoice">Invoice (Net 30)</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-2">
                             <Label>Tax ID / VAT</Label>
                             <Input value={formData.tax_id} onChange={e => setFormData({...formData, tax_id: e.target.value})} />
                          </div>
                       </div>
                    </div>
                 )}

                 {/* STEP 4: BRANDING */}
                 {currentStep === 4 && (
                    <div className="space-y-6">
                       <div className="border-b pb-4 mb-6">
                          <h2 className="text-2xl font-bold text-slate-900">Branding Verification</h2>
                          <p className="text-slate-500">Review auto-detected assets and customize the look.</p>
                       </div>

                       <div className="flex gap-8">
                          <div className="w-1/2 space-y-6">
                             <div className="space-y-2">
                                <Label>Logo Upload</Label>
                                <div className="flex items-center gap-4">
                                   <div className="w-20 h-20 border rounded-lg flex items-center justify-center bg-slate-50 p-2 overflow-hidden">
                                      {formData.logo_url ? (
                                         <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                      ) : (
                                         <Building className="text-slate-300" />
                                      )}
                                   </div>
                                   <div className="flex-1">
                                      <Input type="file" onChange={handleLogoUpload} accept="image/*" />
                                      <p className="text-xs text-slate-500 mt-1">Recommended: PNG or SVG, at least 200px wide.</p>
                                   </div>
                                </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                   <Label>Primary Color</Label>
                                   <div className="flex gap-2">
                                      <input type="color" className="h-10 w-10 cursor-pointer rounded border" value={formData.primary_color} onChange={e => setFormData({...formData, primary_color: e.target.value})} />
                                      <Input value={formData.primary_color} onChange={e => setFormData({...formData, primary_color: e.target.value})} className="font-mono" />
                                   </div>
                                </div>
                                <div className="space-y-2">
                                   <Label>Secondary Color</Label>
                                   <div className="flex gap-2">
                                      <input type="color" className="h-10 w-10 cursor-pointer rounded border" value={formData.secondary_color} onChange={e => setFormData({...formData, secondary_color: e.target.value})} />
                                      <Input value={formData.secondary_color} onChange={e => setFormData({...formData, secondary_color: e.target.value})} className="font-mono" />
                                   </div>
                                </div>
                             </div>
                          </div>

                          <div className="w-1/2">
                              <Label className="mb-2 block">Theme Preview</Label>
                              <div className="border rounded-xl overflow-hidden shadow-lg bg-white h-64 flex flex-col">
                                 <div className="h-12 flex items-center px-4 justify-between border-b" style={{ borderTop: `4px solid ${formData.primary_color}` }}>
                                    <div className="font-bold flex items-center gap-2">
                                        {formData.logo_url && <img src={formData.logo_url} className="h-6 w-auto" alt="" />}
                                        {!formData.logo_url && <span style={{ color: formData.primary_color }}>{formData.company_name || 'Brand'}</span>}
                                    </div>
                                    <div className="flex gap-2">
                                       <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                       <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                    </div>
                                 </div>
                                 <div className="p-6 flex-1 bg-slate-50 flex items-center justify-center">
                                     <div className="bg-white p-4 rounded shadow-sm w-3/4 space-y-3">
                                         <div className="h-2 w-1/2 bg-slate-100 rounded"></div>
                                         <div className="h-2 w-full bg-slate-100 rounded"></div>
                                         <div className="pt-2">
                                            <button className="px-3 py-1.5 text-xs text-white rounded font-medium" style={{ backgroundColor: formData.primary_color }}>
                                               Primary Action
                                            </button>
                                         </div>
                                     </div>
                                 </div>
                              </div>
                          </div>
                       </div>
                    </div>
                 )}

                 {/* STEP 5: FEATURES */}
                 {currentStep === 5 && (
                    <div className="space-y-6">
                       <div className="border-b pb-4 mb-6">
                          <h2 className="text-2xl font-bold text-slate-900">Feature Selection</h2>
                          <p className="text-slate-500">Enable modules available for this tenant environment.</p>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                          {AVAILABLE_FEATURES.map(feature => (
                             <div key={feature.id} className="flex items-start space-x-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                                <Switch 
                                   checked={formData.feature_flags[feature.id]}
                                   onCheckedChange={(checked) => setFormData(prev => ({
                                      ...prev,
                                      feature_flags: { ...prev.feature_flags, [feature.id]: checked }
                                   }))}
                                />
                                <div className="space-y-1">
                                   <Label className="text-base font-medium">{feature.label}</Label>
                                   <p className="text-sm text-slate-500">{feature.description}</p>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}

                 {/* STEP 6: REVIEW */}
                 {currentStep === 6 && (
                    <div className="space-y-8">
                       <div className="text-center space-y-2">
                          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                             <CheckCircle2 className="w-8 h-8" />
                          </div>
                          <h2 className="text-3xl font-bold text-slate-900">Ready to Launch?</h2>
                          <p className="text-slate-500 text-lg">Review configuration for <strong>{formData.company_name}</strong> before provisioning.</p>
                       </div>

                       <div className="bg-white border rounded-xl overflow-hidden divide-y">
                          <div className="p-4 flex justify-between items-center bg-slate-50/50">
                             <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Summary</h4>
                          </div>
                          <div className="p-6 grid grid-cols-2 gap-8">
                             <div>
                                <h5 className="font-medium text-slate-900 mb-2">Company</h5>
                                <div className="space-y-1 text-sm text-slate-600">
                                   <p>{formData.company_name}</p>
                                   <p>{formData.website_url}</p>
                                   <p>{formData.industry} • {formData.company_size}</p>
                                </div>
                             </div>
                             <div>
                                <h5 className="font-medium text-slate-900 mb-2">Billing</h5>
                                <div className="space-y-1 text-sm text-slate-600">
                                   <p className="capitalize">{formData.plan} Plan ({formData.billing_cycle})</p>
                                   <p>{formData.billing_email}</p>
                                   <p className="capitalize">Method: {formData.payment_method.replace('_', ' ')}</p>
                                </div>
                             </div>
                             <div>
                                <h5 className="font-medium text-slate-900 mb-2">Branding</h5>
                                <div className="flex items-center gap-3">
                                   {formData.logo_url && <img src={formData.logo_url} className="h-8 w-8 object-contain rounded border p-0.5" />}
                                   <div className="flex gap-1">
                                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: formData.primary_color }} title={formData.primary_color}></div>
                                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: formData.secondary_color }} title={formData.secondary_color}></div>
                                   </div>
                                </div>
                             </div>
                             <div>
                                <h5 className="font-medium text-slate-900 mb-2">Modules</h5>
                                <div className="flex flex-wrap gap-2">
                                   {Object.entries(formData.feature_flags).filter(([_, v]) => v).map(([key]) => (
                                      <span key={key} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                                         {AVAILABLE_FEATURES.find(f => f.id === key)?.label || key}
                                      </span>
                                   ))}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

               </motion.div>
             </AnimatePresence>
           </div>

           {/* Footer Navigation */}
           <div className="p-8 border-t bg-slate-50 flex justify-between items-center">
              <Button 
                variant="outline" 
                onClick={handleBack} 
                disabled={currentStep === 1 || isSaving}
                className="w-32"
              >
                 <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              
              {currentStep < STEPS.length ? (
                 <Button 
                    onClick={handleNext} 
                    className="w-32 bg-slate-900 hover:bg-slate-800"
                    disabled={currentStep === 1 && !formData.website_url} // Prevent skipping step 1 input
                 >
                    Next <ChevronRight className="w-4 h-4 ml-2" />
                 </Button>
              ) : (
                 <Button 
                    onClick={handleFinalSubmit} 
                    className="w-48 bg-[#fbbf24] hover:bg-[#d97706] text-black font-semibold"
                    disabled={isSaving}
                 >
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Provision Tenant
                 </Button>
              )}
           </div>
        </Card>
      </main>
    </div>
  );
};

export default TenantOnboarding;