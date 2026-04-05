
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
import { supabase } from '@/lib/supabaseClient';

// SKU-only config (pricing comes from price_book)
const SERVICE_CONFIG = {
  dryer_vent: {
    label: "Dryer Vent Cleaning",
    service_key: "DRYER_VENT_CLEANING",
    base_items: [{ sku: "DV-STD", qty: 1 }],
    questions: [
      { id: "roof_access", label: "Is the vent on the roof?", type: "boolean", adds: [{ sku: "ACC-ROOF", qty: 1 }] },
      { id: "bird_guard", label: "Add Bird/Rodent Guard?", type: "boolean", adds: [{ sku: "EXT-GUARD-STD", qty: 1 }] },
      { id: "transition", label: "Replace Transition?", type: "boolean", adds: [{ sku: "DV-TRANS-HD", qty: 1 }] },
    ],
    pqi: 40,
  },

  air_duct: {
    label: "Air Duct Cleaning",
    service_key: "AIR_DUCT_CLEANING",
    base_items: [{ sku: "DUCT-SYS1", qty: 1 }],
    questions: [
      { id: "system_count", label: "Number of HVAC Systems", type: "counter", min: 1, max: 5 },
      {
        id: "system_count_adders",
        type: "computed",
        depends_on: ["system_count"],
        compute: ({ system_count }) => {
          const extra = Math.max(0, (system_count || 1) - 1);
          return extra > 0 ? [{ sku: "DUCT-SYS-ADD", qty: extra }] : [];
        },
      },
      {
        id: "sanitization",
        label: "Add Botanical Fogging (Sanitization)?",
        type: "boolean",
        depends_on: ["system_count"],
        compute: ({ sanitization, system_count }) =>
          sanitization ? [{ sku: "DUCT-FOG", qty: Math.max(1, system_count || 1) }] : [],
      },
    ],
    pqi: 60,
  },

  combo: {
    label: "Whole Home Combo (Ducts + Vent)",
    service_key: "COMBO",
    compose: ["air_duct", "dryer_vent"],
    discount_items: [{ sku: "BUNDLE-DISCOUNT-50", qty: 1 }],
    pqi: 70,
  },
};

// Package maps for Good / Better / Best
const DRYER_PACKAGES = {
  good: { sku: 'PKG-MIN', title: 'Safety Clean', features: ['Core safety clean'], includes: [] },
  better: { sku: 'PKG-COMP', title: 'Compliance Plus', features: ['Metal transition', 'Bird/rodent guard'], includes: ['DV-TRANS-HD', 'EXT-GUARD-STD'], popular: true },
  best: { sku: 'PKG-REST', title: 'Total Restoration', features: ['All Compliance items', 'Cabinet deep clean'], includes: ['DV-TRANS-HD', 'EXT-GUARD-STD', 'DV-CABINET'] },
};

const DUCT_PACKAGES = {
  good: { title: 'Duct Clean', features: ['System 1 included', 'Add systems auto'], includeFog: false },
  better: { title: 'Clean + Fog', features: ['Add sanitization per system'], includeFog: true, popular: true },
  best: { title: 'Whole Home Ready', features: ['Clean + Fog (per system)'], includeFog: true },
};

const COMBO_PACKAGES = {
  good: { title: 'Whole Home (Base)', features: ['Duct clean + Dryer Safety'], dryer: 'good', duct: 'good', includeFog: false },
  better: { title: 'Whole Home (Plus)', features: ['Duct clean + fog', 'Compliance dryer'], dryer: 'better', duct: 'better', includeFog: true, popular: true },
  best: { title: 'Whole Home (Premium)', features: ['Duct clean + fog', 'Restoration dryer'], dryer: 'best', duct: 'better', includeFog: true },
};

// All SKUs we expect the estimator to use (for preload/validation)
const REQUIRED_SKUS = [
  'PKG-MIN', 'PKG-COMP', 'PKG-REST',
  'DV-STD', 'DV-TRANS-HD', 'EXT-GUARD-STD', 'ACC-ROOF', 'DV-CABINET',
  'DUCT-SYS1', 'DUCT-SYS-ADD', 'DUCT-FOG',
  'BUNDLE-DISCOUNT-50'
];

const buildDuctItems = (includeFog, systemCount) => {
  const count = Math.max(1, systemCount || 1);
  const items = [{ sku: 'DUCT-SYS1', qty: 1 }];
  const extra = Math.max(0, count - 1);
  if (extra > 0) items.push({ sku: 'DUCT-SYS-ADD', qty: extra });
  if (includeFog) items.push({ sku: 'DUCT-FOG', qty: count });
  return items;
};

const buildDryerPackageItems = (pkgId, formData) => {
  const pkg = DRYER_PACKAGES[pkgId] || DRYER_PACKAGES.good;
  const includes = pkg.includes || [];
  const items = [{ sku: pkg.sku, qty: 1 }];

  // Allowed adders (block double-charge if package already includes)
  if (formData.roof_access) items.push({ sku: 'ACC-ROOF', qty: 1 });
  if (formData.bird_guard && !includes.includes('EXT-GUARD-STD')) items.push({ sku: 'EXT-GUARD-STD', qty: 1 });
  if (formData.transition && !includes.includes('DV-TRANS-HD')) items.push({ sku: 'DV-TRANS-HD', qty: 1 });

  return items;
};

const buildDuctPackageItems = (pkgId, formData) => {
  const pkg = DUCT_PACKAGES[pkgId] || DUCT_PACKAGES.good;
  return buildDuctItems(pkg.includeFog, formData.system_count);
};

const buildComboPackageItems = (pkgId, formData) => {
  const combo = COMBO_PACKAGES[pkgId] || COMBO_PACKAGES.good;
  const items = [
    ...buildDuctItems(combo.includeFog, formData.system_count),
    ...buildDryerPackageItems(combo.dryer, formData),
  ];

  // Bundle discount applied once
  items.push({ sku: 'BUNDLE-DISCOUNT-50', qty: 1 });
  return items;
};

const getPackageOptions = (serviceKey) => {
  if (serviceKey === 'dryer_vent') {
    return [
      { id: 'good', ...DRYER_PACKAGES.good },
      { id: 'better', ...DRYER_PACKAGES.better },
      { id: 'best', ...DRYER_PACKAGES.best },
    ];
  }

  if (serviceKey === 'air_duct') {
    return [
      { id: 'good', ...DUCT_PACKAGES.good },
      { id: 'better', ...DUCT_PACKAGES.better },
      { id: 'best', ...DUCT_PACKAGES.best },
    ];
  }

  // Combo
  return [
    { id: 'good', ...COMBO_PACKAGES.good },
    { id: 'better', ...COMBO_PACKAGES.better },
    { id: 'best', ...COMBO_PACKAGES.best },
  ];
};

const EstimateWizard = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [leadId, setLeadId] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceBook, setPriceBook] = useState(new Map());
  const [priceWarning, setPriceWarning] = useState(null);
  
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
    serviceKey: 'dryer_vent',
    dryerCount: 1,
    system_count: 1,
    sanitization: false,
    roof_access: false,
    bird_guard: false,
    transition: false,
    issues: [],
    
    // Consents
    consentToPricing: false,
    consentTimestamp: null,
    
    // Selection
    selectedPackage: null
  });

  const [estimate, setEstimate] = useState({ total: 0, breakdowns: [], items: [] });

  // -- Handlers --

  useEffect(() => {
    setSubmissionId(crypto.randomUUID());
  }, []);

  // Preload price_book rows the estimator depends on (single fetch)
  useEffect(() => {
    async function testPrices() {
      const { data, error } = await supabase
        .from('price_book')
        .select('code, base_price, active')
        .in('code', REQUIRED_SKUS)
        .eq('active', true);

      if (error) {
        console.log('[PRICE BOOK]', { data, error });
        setPriceWarning('Pricing unavailable. Please call us to complete your quote.');
        return;
      }

      const map = new Map((data || []).map(row => [row.code, row.base_price ?? 0]));
      const missing = REQUIRED_SKUS.filter(c => !map.has(c));
      if (missing.length) {
        setPriceWarning(`Missing pricing for: ${missing.join(', ')}`);
      } else {
        setPriceWarning(null);
      }
      setPriceBook(map);
    }
    testPrices();
  }, []);

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

  const toggleConsent = (checked) => {
    setFormData(prev => ({
      ...prev,
      consentToPricing: checked,
      consentTimestamp: checked ? new Date().toISOString() : null
    }));
  };

  const buildItems = (serviceKey) => {
    if (!formData.selectedPackage) return [];

    if (serviceKey === 'dryer_vent') {
      return buildDryerPackageItems(formData.selectedPackage, formData);
    }

    if (serviceKey === 'air_duct') {
      return buildDuctPackageItems(formData.selectedPackage, formData);
    }

    if (serviceKey === 'combo') {
      return buildComboPackageItems(formData.selectedPackage, formData);
    }

    // Fallback to base config if something unexpected occurs
    const cfg = SERVICE_CONFIG[serviceKey];
    if (!cfg) return [];
    return cfg.base_items || [];
  };

  const recalcEstimate = async () => {
    if (!formData.selectedPackage) return;
    setPriceLoading(true);
    try {
      const items = buildItems(formData.serviceKey);
      const codes = [...new Set(items.map(i => i.sku))];
      if (codes.length === 0) {
        setEstimate({ total: 0, breakdowns: [], items: [] });
        return;
      }

      // Use preloaded prices when available; otherwise fetch
      let priceMap = priceBook;
      if (!priceBook || priceBook.size === 0) {
        const { data, error } = await supabase
          .from('price_book')
          .select('code, base_price')
          .in('code', codes)
          .eq('active', true);
        if (error) throw error;
        priceMap = new Map((data || []).map(row => [row.code, row.base_price ?? 0]));
      }

      const missing = codes.filter(c => !priceMap.has(c));
      if (missing.length) {
        toast({
          variant: 'destructive',
          title: 'Pricing temporarily unavailable',
          description: 'Please call us to complete your quote.'
        });
        setEstimate({ total: 0, breakdowns: [], items: [] });
        return;
      }

      const breakdowns = items.map(i => ({
        label: `${i.sku}${i.qty && i.qty > 1 ? ` x${i.qty}` : ''}`,
        amount: (priceMap.get(i.sku) || 0) * (i.qty || 1)
      }));
      const total = breakdowns.reduce((sum, b) => sum + b.amount, 0);

      setEstimate({ total, breakdowns, items });
    } catch (err) {
      console.error('Estimate calc error', err);
      toast({ variant: 'destructive', title: 'Pricing error', description: 'Unable to calculate pricing. Please call.' });
      setEstimate({ total: 0, breakdowns: [], items: [] });
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    if (formData.selectedPackage) {
      recalcEstimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.selectedPackage, formData.serviceKey, formData.ventLocation, formData.bird_guard, formData.transition, formData.roof_access, formData.system_count, formData.sanitization]);

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
    if (!estimate.items.length) {
        toast({ variant: 'destructive', title: 'Pricing unavailable', description: 'Please call us to finish your quote.' });
        return;
    }
    if (!formData.consentToPricing) {
        toast({ variant: 'destructive', title: 'Consent required', description: 'Please confirm communication consent before submitting.' });
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
            
            service_type: SERVICE_CONFIG[formData.serviceKey]?.service_key || 'DRYER_VENT_CLEANING',
            source_kind: 'website_estimator',
            message: `Estimator: ${formData.serviceKey} | Package: ${formData.selectedPackage} | Est total: ${formatPrice(estimate.total)}`,
            
            metadata: {
                inputs: {
                    vent_location: formData.ventLocation,
                    bird_guard: formData.bird_guard,
                    transition: formData.transition,
                    roof_access: formData.roof_access,
                    system_count: formData.system_count,
                    sanitization: formData.sanitization,
                    issues: formData.issues,
                    consent_to_pricing: formData.consentToPricing,
                    consent_timestamp: formData.consentTimestamp
                },
                items: estimate.items,
                total: estimate.total,
                currency: 'USD'
            },
            
            lead_id: leadId,
            submission_id: submissionId,
            customer_type: 'RESIDENTIAL'
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
            <p className="text-slate-500">Pick a service and answer a few quick questions.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Service</Label>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(SERVICE_CONFIG).map(([key, cfg]) => (
                <div
                  key={key}
                  onClick={() => { updateField('serviceKey', key); updateField('selectedPackage', null); }}
                  className={`p-4 border-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${formData.serviceKey === key ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div>
                    <div className="font-semibold text-slate-900">{cfg.label}</div>
                    <div className="text-xs text-slate-500">PQI: {cfg.pqi}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Dryer vent questions */}
          {(formData.serviceKey === 'dryer_vent' || formData.serviceKey === 'combo') && (
            <div className="space-y-4">
              <Label>Dryer Vent Details</Label>
              <div className="grid grid-cols-2 gap-4">
                  <div 
                      onClick={() => updateField('ventLocation', 'side')}
                      className={`p-4 border-2 rounded-xl cursor-pointer flex flex-col items-center gap-2 transition-all ${formData.ventLocation === 'side' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-100 hover:border-slate-300'}`}
                  >
                      <Home className="w-8 h-8"/>
                      <span className="font-semibold">Side Wall</span>
                  </div>
                  <div 
                       onClick={() => { updateField('ventLocation', 'roof'); updateField('roof_access', true); }}
                       className={`p-4 border-2 rounded-xl cursor-pointer flex flex-col items-center gap-2 transition-all ${formData.ventLocation === 'roof' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-100 hover:border-slate-300'}`}
                  >
                      <ArrowRight className="w-8 h-8 -rotate-45"/>
                      <span className="font-semibold">Roof / Attic</span>
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50">
                  <Checkbox id="roof_access" checked={formData.roof_access} onCheckedChange={() => updateField('roof_access', !formData.roof_access)} />
                  <label htmlFor="roof_access" className="text-sm font-medium cursor-pointer">Roof access needed?</label>
                </div>
                <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50">
                  <Checkbox id="bird_guard" checked={formData.bird_guard} onCheckedChange={() => updateField('bird_guard', !formData.bird_guard)} />
                  <label htmlFor="bird_guard" className="text-sm font-medium cursor-pointer">Add Bird/Rodent Guard?</label>
                </div>
                <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50">
                  <Checkbox id="transition" checked={formData.transition} onCheckedChange={() => updateField('transition', !formData.transition)} />
                  <label htmlFor="transition" className="text-sm font-medium cursor-pointer">Replace Transition?</label>
                </div>
              </div>

              <div className="space-y-2">
                   <Label>Are you experiencing any issues?</Label>
                   <div className="grid grid-cols-1 gap-2">
                      {['Clothes taking long to dry', 'Burning smell', 'Visible lint buildup', 'Routine maintenance'].map(issue => (
                          <div key={issue} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50">
                              <Checkbox id={issue} checked={formData.issues.includes(issue)} onCheckedChange={() => toggleIssue(issue)} />
                              <label htmlFor={issue} className="text-sm font-medium leading-none cursor-pointer w-full">
                                  {issue}
                              </label>
                          </div>
                      ))}
                   </div>
              </div>
            </div>
          )}

          {/* Air duct questions */}
          {(formData.serviceKey === 'air_duct' || formData.serviceKey === 'combo') && (
            <div className="space-y-4">
              <Label>Air Duct Details</Label>
              <div className="space-y-2">
                <Label>Number of HVAC Systems</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={() => updateField('system_count', Math.max(1, (formData.system_count || 1) - 1))}>-</Button>
                  <div className="font-bold text-lg w-10 text-center">{formData.system_count || 1}</div>
                  <Button type="button" variant="outline" onClick={() => updateField('system_count', Math.min(5, (formData.system_count || 1) + 1))}>+</Button>
                </div>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50">
                <Checkbox id="sanitization" checked={formData.sanitization} onCheckedChange={() => updateField('sanitization', !formData.sanitization)} />
                <label htmlFor="sanitization" className="text-sm font-medium cursor-pointer">Add Botanical Fogging (Sanitization)?</label>
              </div>
            </div>
          )}

          {/* Consent */}
          <div className="space-y-2">
            <Label>Consent</Label>
            <div className="flex items-start space-x-2 border p-3 rounded-lg hover:bg-slate-50">
              <Checkbox
                id="consentToPricing"
                checked={formData.consentToPricing}
                onCheckedChange={(val) => toggleConsent(Boolean(val))}
              />
              <label htmlFor="consentToPricing" className="text-sm leading-snug cursor-pointer">
                I agree to receive communications (email/SMS) about my estimate and related services.
                I understand I can opt out at any time.
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button
              onClick={() => {
                if (!formData.consentToPricing) {
                  toast({
                    variant: "destructive",
                    title: "Consent required",
                    description: "Please confirm communication consent to view pricing."
                  });
                  return;
                }
                setStep(3);
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              View Packages
            </Button>
        </div>
    </div>
  );

  const renderStep3 = () => (
      <div className="space-y-6">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">Select Your Package</h2>
        </div>

        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {getPackageOptions(formData.serviceKey).map((pkg) => (
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
                        <div className="text-right text-sm text-slate-500">
                          {(() => {
                            // Base preview: package-only items (no optional adders)
                            const previewItems = (() => {
                              if (formData.serviceKey === 'dryer_vent') return [{ sku: pkg.sku, qty: 1 }];
                              if (formData.serviceKey === 'air_duct') {
                                const count = Math.max(1, formData.system_count || 1);
                                const base = [{ sku: 'DUCT-SYS1', qty: 1 }];
                                const extra = Math.max(0, count - 1);
                                if (extra > 0) base.push({ sku: 'DUCT-SYS-ADD', qty: extra });
                                if (pkg.includeFog) base.push({ sku: 'DUCT-FOG', qty: count });
                                return base;
                              }
                              if (formData.serviceKey === 'combo') {
                                const count = Math.max(1, formData.system_count || 1);
                                const base = [{ sku: 'DUCT-SYS1', qty: 1 }];
                                const extra = Math.max(0, count - 1);
                                if (extra > 0) base.push({ sku: 'DUCT-SYS-ADD', qty: extra });
                                if (pkg.includeFog) base.push({ sku: 'DUCT-FOG', qty: count });
                                base.push({ sku: DRYER_PACKAGES[pkg.dryer]?.sku || 'PKG-MIN', qty: 1 });
                                base.push({ sku: 'BUNDLE-DISCOUNT-50', qty: 1 });
                                return base;
                              }
                              return [];
                            })();

                            const priceMap = priceBook || new Map();
                            const missing = previewItems.some(i => !priceMap.has(i.sku));
                            if (missing || previewItems.length === 0) return 'Select to calculate price';
                            const est = previewItems.reduce((sum, i) => sum + (priceMap.get(i.sku) || 0) * (i.qty || 1), 0);
                            return formatPrice(est);
                          })()}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4 text-sm font-medium text-slate-900">
                <span>Estimated Total:</span>
                <span className="text-xl">{priceLoading ? 'Calculating...' : formatPrice(estimate.total || 0)}</span>
            </div>
            {!priceLoading && estimate.breakdowns.length > 0 && (
              <div className="bg-slate-50 border rounded-lg p-3 text-sm space-y-1">
                {estimate.breakdowns.map((b, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="font-mono text-xs">{b.label}</span>
                    <span>{formatPrice(b.amount)}</span>
                  </div>
                ))}
              </div>
            )}
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
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
