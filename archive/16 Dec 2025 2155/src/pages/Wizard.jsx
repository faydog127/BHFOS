import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Home, ArrowDownToLine, Stethoscope, MapPin, CheckCircle2, User, 
  Loader2, AlertCircle, Building, Warehouse, ThermometerSun, Snowflake, 
  Wind, AlertTriangle, Clock, Droplets, PawPrint, BadgeAlert, Heart, Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { formatPhoneNumber } from '@/lib/security';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// --- Components ---

const StepHeader = ({ title, subtitle }) => (
  <div className="mb-6">
    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{title}</h1>
    <p className="text-slate-500">{subtitle}</p>
  </div>
);

const OptionCard = ({ icon: Icon, title, selected, onClick, className }) => (
  <div 
    onClick={onClick}
    className={`
      cursor-pointer rounded-xl border-2 p-5 flex flex-col items-center justify-center text-center gap-3 transition-all duration-200
      ${selected 
        ? 'border-blue-600 bg-blue-50/50 shadow-md ring-1 ring-blue-600' 
        : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm'}
      ${className}
    `}
  >
    <div className={`p-3 rounded-full ${selected ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-500'}`}>
       <Icon className="w-6 h-6 md:w-8 md:h-8" />
    </div>
    <span className={`font-semibold ${selected ? 'text-blue-900' : 'text-slate-700'}`}>{title}</span>
    {selected && <div className="absolute top-3 right-3 text-blue-600"><CheckCircle2 className="w-5 h-5"/></div>}
  </div>
);

// --- Wizard Page ---

const Wizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // URL Params
  const queryParams = new URLSearchParams(location.search);
  const ref = queryParams.get('ref');
  const utmSource = queryParams.get('utm_source');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leadId, setLeadId] = useState(null);

  // Form Data
  const [data, setData] = useState({
    // Contact (Step 1)
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: 'FL',
    zip: '',
    bestTime: '', // morning, afternoon, evening
    
    // House (Step 2)
    houseType: '', // single, two, multi
    
    // HVAC (Step 3)
    hvacSystem: '', // central, heatpump, furnace, other
    hvacYear: '',
    
    // Vents (Step 4)
    ventCount: 12,
    returnCount: 1, // Default set to 1
    ventConfidence: 'high', // high or low (estimated)
    
    // Access (Step 5)
    accessPoint: '', // attic, crawlspace, basement, other
    
    // Health (Step 6) - Categorized
    healthRisks: {
       health: {
           allergies: false,
           asthma: false,
           respiratory: false,
           other: false
       },
       duct: {
           dust: false,
           musty: false,
           water_damage: false,
           pet_odors: false,
           other: false
       },
       dryer: {
           burning_smell: false,
           long_dry_time: false,
           lint_visible: false,
           other: false
       }
    },
  });

  // --- Handlers ---

  const validateStep1 = () => {
       if (!data.firstName || !data.lastName || !data.email || !data.phone) {
           toast({ variant: "destructive", title: "Missing Info", description: "Please complete all contact fields." });
           return false;
       }
       if (!data.address || !data.city || !data.zip) {
           toast({ variant: "destructive", title: "Address Required", description: "Please complete property address." });
           return false;
       }
       // State Validation
       if (!data.state || !US_STATES.includes(data.state.toUpperCase())) {
           toast({ variant: "destructive", title: "Invalid State", description: "Please enter a valid 2-letter US state code (e.g. FL)." });
           return false;
       }
       // Zip Validation
       if (!/^\d{5}$/.test(data.zip)) {
           toast({ variant: "destructive", title: "Invalid Zip Code", description: "Zip code must be exactly 5 digits." });
           return false;
       }
       if (!data.bestTime) {
           toast({ variant: "destructive", title: "Preference Required", description: "Please select a best time to contact." });
           return false;
       }
       return true;
  };

  const handleNext = async () => {
    // Validation
    if (step === 1) {
       if (!validateStep1()) return;
       // Submit Partial (Now includes address!)
       await submitPartial();
    }
    
    // Step 7 is now the Review/Submit step
    if (step === 7) {
        await submitFull();
        return;
    }

    window.scrollTo(0, 0);
    setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const handlePhoneChange = (e) => {
      const formatted = formatPhoneNumber(e.target.value);
      setData(prev => ({ ...prev, phone: formatted }));
  };

  const submitPartial = async () => {
      setLoading(true);
      try {
          const { data: res, error } = await supabase.functions.invoke('web-wizard-processor', {
              body: { 
                  action: 'partial',
                  contact: { 
                      firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, bestTime: data.bestTime
                  },
                  property: {
                      address: data.address, city: data.city, state: data.state.toUpperCase(), zip: data.zip
                  },
                  source_details: { ref, utmSource }
              }
          });
          
          if (error) throw error;
          if (res?.leadId) setLeadId(res.leadId);
          
      } catch (err) {
          console.error("Partial Submit Error", err);
          // Don't block user flow for partial failure
      } finally {
          setLoading(false);
      }
  };

  const submitFull = async () => {
      setSubmitting(true);
      try {
          const payload = {
              action: 'full',
              contact: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, bestTime: data.bestTime },
              property: { 
                  address: data.address, city: data.city, state: data.state.toUpperCase(), zip: data.zip, 
                  houseType: data.houseType, ventCount: data.ventCount, accessPoint: data.accessPoint,
                  confidence: data.ventConfidence
              },
              hvac: { system: data.hvacSystem, year: data.hvacYear },
              health: data.healthRisks, // Sends structured object
              source_details: { ref, utmSource }
          };

          const { data: res, error } = await supabase.functions.invoke('web-wizard-processor', { body: payload });
          
          if (error) throw error;
          // Check for logical error from edge function even if 200 OK
          if (res && res.error) throw new Error(res.error);

          // Success Screen
          setStep(8); // Success State

      } catch (err) {
          toast({ variant: "destructive", title: "Submission Failed", description: err.message || "Please try again." });
      } finally {
          setSubmitting(false);
      }
  };

  const handleAddressSelect = (place) => {
      // Parse Google Places components
      let streetAddress = place.formatted_address ? place.formatted_address.split(',')[0] : '';
      let city = '';
      let state = '';
      let zip = '';

      if (place.address_components) {
          const components = place.address_components;
          
          const streetNumber = components.find(c => c.types.includes('street_number'))?.long_name || '';
          const route = components.find(c => c.types.includes('route'))?.long_name || '';
          
          if (streetNumber && route) {
              streetAddress = `${streetNumber} ${route}`;
          }

          city = components.find(c => c.types.includes('locality'))?.long_name || 
                 components.find(c => c.types.includes('sublocality'))?.long_name || '';
          
          state = components.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '';
          
          zip = components.find(c => c.types.includes('postal_code'))?.long_name || '';
      }

      setData(prev => ({ 
          ...prev, 
          address: streetAddress,
          city: city,
          state: state.toUpperCase().slice(0, 2), // Ensure 2-letter uppercase
          zip: zip
      }));
  };

  // Helper to toggle nested health risks
  const toggleRisk = (category, key) => {
      setData(prev => ({
          ...prev,
          healthRisks: {
              ...prev.healthRisks,
              [category]: {
                  ...prev.healthRisks[category],
                  [key]: !prev.healthRisks[category][key]
              }
          }
      }));
  };

  // --- Step Renders ---

  const renderStep = () => {
    switch(step) {
        case 1: // Contact & Location (Combined)
           return (
             <div className="space-y-6">
                <StepHeader title="Let's Start Your File" subtitle="We need a few details to get started." />
                
                {/* Contact Info Section */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900 border-b pb-2">Contact Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>First Name</Label>
                            <Input value={data.firstName} onChange={e => setData({...data, firstName: e.target.value})} placeholder="Jane" className="h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label>Last Name</Label>
                            <Input value={data.lastName} onChange={e => setData({...data, lastName: e.target.value})} placeholder="Doe" className="h-11" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Email Address</Label>
                            <Input type="email" value={data.email} onChange={e => setData({...data, email: e.target.value})} placeholder="jane@example.com" className="h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input type="tel" value={data.phone} onChange={handlePhoneChange} placeholder="(555) 123-4567" className="h-11" />
                        </div>
                    </div>
                    
                     <div className="space-y-2">
                         <Label>Best Time to Contact</Label>
                         <Select onValueChange={v => setData({...data, bestTime: v})} value={data.bestTime}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Select preference" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="morning">Morning (8am - 12pm)</SelectItem>
                                <SelectItem value="afternoon">Afternoon (12pm - 4pm)</SelectItem>
                                <SelectItem value="evening">Evening (4pm - 6pm)</SelectItem>
                            </SelectContent>
                         </Select>
                    </div>
                </div>

                {/* Property Info Section */}
                <div className="space-y-4 pt-2">
                    <h3 className="font-semibold text-slate-900 border-b pb-2">Property Address</h3>
                    <div className="space-y-2">
                        <Label>Street Address</Label>
                        <AddressAutocomplete 
                            value={data.address} 
                            onChange={e => setData({...data, address: e.target.value})}
                            onAddressSelect={handleAddressSelect}
                            className="h-11"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label>City</Label>
                             <Input value={data.city} onChange={e => setData({...data, city: e.target.value})} className="h-11"/>
                        </div>
                        <div className="space-y-2">
                             <Label>State / Zip</Label>
                             <div className="flex gap-2">
                                <Input 
                                    value={data.state} 
                                    onChange={e => setData({...data, state: e.target.value.toUpperCase()})} 
                                    className="w-20 h-11" 
                                    maxLength={2}
                                    placeholder="FL"
                                />
                                <Input 
                                    value={data.zip} 
                                    onChange={e => setData({...data, zip: e.target.value.replace(/\D/g,'').slice(0,5)})} 
                                    placeholder="Zip Code" 
                                    className="flex-1 h-11"
                                    maxLength={5}
                                />
                             </div>
                        </div>
                    </div>
                </div>
             </div>
           );

        case 2: // House Type
           return (
             <div className="space-y-6">
                <StepHeader title="Property Details" subtitle="What type of home is this?" />
                <div className="grid grid-cols-2 gap-4">
                    <OptionCard 
                        icon={Home} title="Single Story" 
                        selected={data.houseType === 'single'} 
                        onClick={() => setData({...data, houseType: 'single'})} 
                        className="h-32"
                    />
                    <OptionCard 
                        icon={Building} title="Two Story" 
                        selected={data.houseType === 'two'} 
                        onClick={() => setData({...data, houseType: 'two'})} 
                        className="h-32"
                    />
                    <OptionCard 
                        icon={Warehouse} title="Multi-Story / Condo" 
                        selected={data.houseType === 'multi'} 
                        onClick={() => setData({...data, houseType: 'multi'})} 
                        className="h-32"
                    />
                     <OptionCard 
                        icon={Home} title="Multi-Family / Duplex" 
                        selected={data.houseType === 'duplex'} 
                        onClick={() => setData({...data, houseType: 'duplex'})} 
                        className="h-32"
                    />
                </div>
             </div>
           );

        case 3: // HVAC
           return (
             <div className="space-y-6">
                <StepHeader title="HVAC System" subtitle="Help us understand your equipment." />
                <div className="grid grid-cols-2 gap-4">
                    <OptionCard icon={Snowflake} title="Central AC" selected={data.hvacSystem === 'central'} onClick={() => setData({...data, hvacSystem: 'central'})} />
                    <OptionCard icon={ThermometerSun} title="Heat Pump" selected={data.hvacSystem === 'heatpump'} onClick={() => setData({...data, hvacSystem: 'heatpump'})} />
                    <OptionCard icon={Wind} title="Furnace" selected={data.hvacSystem === 'furnace'} onClick={() => setData({...data, hvacSystem: 'furnace'})} />
                    <OptionCard icon={AlertCircle} title="Other / Unsure" selected={data.hvacSystem === 'other'} onClick={() => setData({...data, hvacSystem: 'other'})} />
                </div>
                <div className="space-y-2 pt-2">
                    <Label>Approximate Year Built / Installed (Optional)</Label>
                    <Input type="number" placeholder="e.g. 2015" value={data.hvacYear} onChange={e => setData({...data, hvacYear: e.target.value})} className="h-12" />
                </div>
             </div>
           );

        case 4: // Vent Count
           return (
             <div className="space-y-6">
                <StepHeader title="Vent Count" subtitle="Roughly how many vents do you have?" />
                
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-base font-semibold">Supply Vents</Label>
                            <p className="text-xs text-slate-500">Usually smaller, blowing air out.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" onClick={() => setData({...data, ventCount: Math.max(1, data.ventCount - 1)})}>-</Button>
                            <span className="text-xl font-bold w-8 text-center">{data.ventCount}</span>
                            <Button variant="outline" size="icon" onClick={() => setData({...data, ventCount: data.ventCount + 1})}>+</Button>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-slate-200 pt-6">
                        <div>
                            <Label className="text-base font-semibold">Return Grills</Label>
                            <p className="text-xs text-slate-500">Usually larger, sucking air in.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" onClick={() => setData({...data, returnCount: Math.max(0, data.returnCount - 1)})}>-</Button>
                            <span className="text-xl font-bold w-8 text-center">{data.returnCount}</span>
                            <Button variant="outline" size="icon" onClick={() => setData({...data, returnCount: data.returnCount + 1})}>+</Button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Checkbox 
                        id="unsure" 
                        checked={data.ventConfidence === 'low'} 
                        onCheckedChange={(c) => setData({...data, ventConfidence: c ? 'low' : 'high'})} 
                    />
                    <div className="grid gap-1.5 leading-none">
                        <label htmlFor="unsure" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                            I'm not sure, estimate for me.
                        </label>
                        <p className="text-xs text-muted-foreground">We'll verify onsite.</p>
                    </div>
                </div>
             </div>
           );

        case 5: // Access Point
           return (
             <div className="space-y-6">
                <StepHeader title="Unit Access" subtitle="Where is the main HVAC unit located?" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <OptionCard icon={ArrowDownToLine} title="Attic Pull-Down" selected={data.accessPoint === 'attic'} onClick={() => setData({...data, accessPoint: 'attic'})} />
                    <OptionCard icon={Warehouse} title="Garage / Closet" selected={data.accessPoint === 'closet'} onClick={() => setData({...data, accessPoint: 'closet'})} />
                    <OptionCard icon={Building} title="Crawlspace" selected={data.accessPoint === 'crawlspace'} onClick={() => setData({...data, accessPoint: 'crawlspace'})} />
                    <OptionCard icon={AlertCircle} title="Other" selected={data.accessPoint === 'other'} onClick={() => setData({...data, accessPoint: 'other'})} />
                </div>
             </div>
           );

        case 6: // Health (Restructured)
           return (
             <div className="space-y-6">
                <StepHeader title="Health & Safety" subtitle="Select all that apply:" />
                
                {/* Category 1: Health */}
                <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 border-b pb-2">
                        <Heart className="w-4 h-4 text-rose-500" /> Health Concerns
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { id: 'allergies', label: 'Allergies' },
                            { id: 'asthma', label: 'Asthma' },
                            { id: 'respiratory', label: 'Respiratory Issues' },
                            { id: 'other', label: 'Other Health Issues' },
                        ].map(item => (
                            <div 
                                key={item.id}
                                className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${data.healthRisks.health[item.id] ? 'bg-blue-50 border-blue-500' : 'bg-white hover:border-blue-200'}`}
                                onClick={() => toggleRisk('health', item.id)}
                            >
                                <Checkbox checked={data.healthRisks.health[item.id]} className="mr-3" />
                                <span className={`text-sm font-medium ${data.healthRisks.health[item.id] ? 'text-blue-900' : 'text-slate-700'}`}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category 2: Duct */}
                <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 border-b pb-2">
                        <Wind className="w-4 h-4 text-blue-500" /> Air Duct Concerns
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { id: 'dust', label: 'Dusty Air / Buildup' },
                            { id: 'musty', label: 'Musty Smell' },
                            { id: 'water_damage', label: 'Recent Water Damage' },
                            { id: 'pet_odors', label: 'Pet Odors' },
                            { id: 'other', label: 'Other Duct Issues' },
                        ].map(item => (
                            <div 
                                key={item.id}
                                className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${data.healthRisks.duct[item.id] ? 'bg-blue-50 border-blue-500' : 'bg-white hover:border-blue-200'}`}
                                onClick={() => toggleRisk('duct', item.id)}
                            >
                                <Checkbox checked={data.healthRisks.duct[item.id]} className="mr-3" />
                                <span className={`text-sm font-medium ${data.healthRisks.duct[item.id] ? 'text-blue-900' : 'text-slate-700'}`}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                 {/* Category 3: Dryer */}
                 <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 border-b pb-2">
                        <Flame className="w-4 h-4 text-orange-500" /> Dryer Vent Safety
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { id: 'burning_smell', label: 'Smell Something Burning' },
                            { id: 'long_dry_time', label: 'Dryer Takes Forever' },
                            { id: 'lint_visible', label: 'Lint Buildup Visible' },
                            { id: 'other', label: 'Other Dryer Issues' },
                        ].map(item => (
                            <div 
                                key={item.id}
                                className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${data.healthRisks.dryer[item.id] ? 'bg-blue-50 border-blue-500' : 'bg-white hover:border-blue-200'}`}
                                onClick={() => toggleRisk('dryer', item.id)}
                            >
                                <Checkbox checked={data.healthRisks.dryer[item.id]} className="mr-3" />
                                <span className={`text-sm font-medium ${data.healthRisks.dryer[item.id] ? 'text-blue-900' : 'text-slate-700'}`}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
           );

        case 7: // Review (Previously Address)
           return (
             <div className="space-y-6">
                <StepHeader title="Review Details" subtitle="Please verify your information." />
                
                <div className="bg-white border rounded-lg divide-y">
                     <div className="p-4 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <User className="w-5 h-5 text-slate-400" />
                             <div>
                                 <p className="font-medium text-slate-900">{data.firstName} {data.lastName}</p>
                                 <p className="text-sm text-slate-500">{data.email} • {data.phone}</p>
                             </div>
                         </div>
                         <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Edit</Button>
                     </div>
                     <div className="p-4 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <MapPin className="w-5 h-5 text-slate-400" />
                             <div>
                                 <p className="font-medium text-slate-900">{data.address}</p>
                                 <p className="text-sm text-slate-500">{data.city}, {data.state} {data.zip}</p>
                             </div>
                         </div>
                         <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Edit</Button>
                     </div>
                     <div className="p-4 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <Home className="w-5 h-5 text-slate-400" />
                             <div>
                                 <p className="font-medium text-slate-900">{data.houseType || 'Not specified'}</p>
                                 <p className="text-sm text-slate-500">HVAC: {data.hvacSystem || 'Unknown'}</p>
                             </div>
                         </div>
                         <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Edit</Button>
                     </div>
                     <div className="p-4 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <AlertTriangle className="w-5 h-5 text-slate-400" />
                             <div>
                                 <p className="font-medium text-slate-900">Health & Safety</p>
                                 <div className="text-sm text-slate-500 flex gap-2">
                                     <span className="flex items-center gap-1"><Heart className="w-3 h-3"/> {Object.values(data.healthRisks.health).filter(v=>v).length}</span>
                                     <span className="flex items-center gap-1"><Wind className="w-3 h-3"/> {Object.values(data.healthRisks.duct).filter(v=>v).length}</span>
                                     <span className="flex items-center gap-1"><Flame className="w-3 h-3"/> {Object.values(data.healthRisks.dryer).filter(v=>v).length}</span>
                                 </div>
                             </div>
                         </div>
                         <Button variant="ghost" size="sm" onClick={() => setStep(6)}>Edit</Button>
                     </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
                     By clicking Complete File, you agree to receive text messages at the number provided. Reply STOP to opt-out.
                </div>
             </div>
           );

        case 8: // Success
            return (
                <div className="text-center py-10 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">File Created Successfully</h2>
                    <p className="text-xl text-slate-600 mb-8 max-w-md mx-auto">
                        Your Digital Dossier is being prepared. You'll receive it via email shortly.
                    </p>
                    <div className="p-4 bg-blue-50 text-blue-800 rounded-lg max-w-sm mx-auto text-sm mb-8">
                        Technician assignment pending. We will contact you during your preferred window ({data.bestTime || 'soon'}).
                    </div>
                    <Button onClick={() => navigate('/')} variant="outline">Return Home</Button>
                </div>
            );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Helmet><title>Project Wizard | The Vent Guys</title></Helmet>
      
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="font-bold text-lg text-blue-900 flex items-center gap-2">
                 <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">V</div>
                 Files
              </div>
              <div className="text-sm font-medium text-slate-500">
                 {step < 8 ? `Step ${step} of 7` : 'Complete'}
              </div>
          </div>
          {step < 8 && <Progress value={(step / 7) * 100} className="h-1 rounded-none bg-slate-100" />}
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col items-center justify-start pt-8 pb-24 px-4">
         <motion.div 
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8"
         >
             {renderStep()}
         </motion.div>
      </div>

      {/* Footer Navigation */}
      {step < 8 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-8 z-50">
              <div className="max-w-xl mx-auto flex gap-4">
                  <Button 
                    variant="ghost" 
                    onClick={handleBack} 
                    disabled={step === 1 || submitting}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleNext} 
                    disabled={loading || submitting}
                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-lg h-12 shadow-lg shadow-blue-900/10"
                  >
                    {loading || submitting ? <Loader2 className="animate-spin" /> : (step === 7 ? 'Complete File' : 'Next Step')}
                  </Button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Wizard;