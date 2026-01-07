
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Loader2, ChevronRight, ChevronLeft, CheckCircle2, DollarSign, 
  Home, ShieldCheck, Calculator, Tag, User, AlertTriangle, Package, Info
} from 'lucide-react';
import TechTalkTrack from '@/components/TechTalkTrack';

const STEPS = [
  { id: 1, title: "Findings", icon: CheckCircle2 },
  { id: 2, title: "Build Options", icon: Package },
  { id: 3, title: "Review", icon: DollarSign },
  { id: 4, title: "Customer", icon: User }
];

const EstimateWizard = () => {
  // Removed auth hook
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [estimateId, setEstimateId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Pricing Data from DB
  const [priceBook, setPriceBook] = useState([]);
  
  // Input State
  const [property, setProperty] = useState({
    sqFt: '',
    numVents: '',
    numReturns: '1', // Default to 1 return
    numSystems: '1', // Default to 1 system
    ductType: 'flexible'
  });

  const [findings, setFindings] = useState({
    moldDetected: false,
    excessiveLint: false,
    odorIssues: false
  });

  const [selectedPackage, setSelectedPackage] = useState('better'); // good, better, best

  // Contact Info
  const [contactInfo, setContactInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  // Calculated Pricing Display
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [oversizeAdjustment, setOversizeAdjustment] = useState(0);

  // Load Price Book
  useEffect(() => {
    const loadPrices = async () => {
      const { data, error } = await supabase.from('price_book').select('*').eq('active', true);
      if (!error) setPriceBook(data);
      setLoading(false);
    };
    loadPrices();
  }, []);

  // Package Logic & Calculation
  useEffect(() => {
    if (findings.moldDetected && selectedPackage === 'good') {
      setSelectedPackage('better'); // Force upgrade if mold
    }
    calculateTotal();
  }, [selectedPackage, findings, property, priceBook]);

  const getPrice = (code) => {
    const item = priceBook.find(i => i.code === code);
    return item ? Number(item.base_price) : 0;
  };

  const calculateTotal = () => {
    let total = 0;
    let adjustment = 0;
    const sqFt = parseInt(property.sqFt) || 0;
    const numVents = parseInt(property.numVents) || 0;
    const numReturns = parseInt(property.numReturns) || 1;
    const numSystems = parseInt(property.numSystems) || 1;

    // Base Duct Cleaning Logic (Standard 12 Rule)
    let sys1Price = 149; 
    const sys1Item = priceBook.find(i => i.code === 'DUCT-SYS1');
    if (sys1Item) {
         sys1Price = Number(sys1Item.base_price);
    }
    total += sys1Price;

    const includedVents = 12 * numSystems;
    const includedReturns = 1 * numSystems;

    // Calculate Oversages
    const extraVents = Math.max(0, numVents - includedVents);
    const extraReturns = Math.max(0, numReturns - includedReturns);

    const ventOverageCost = extraVents * getPrice('DUCT-VENT');
    const returnOverageCost = extraReturns * getPrice('DUCT-RET');
    
    adjustment = ventOverageCost + returnOverageCost;
    total += adjustment;

    // Package Add-ons
    total += getPrice('DV-STD');
    total += getPrice('SANITIZER-BASIC');

    if (selectedPackage === 'better' || selectedPackage === 'best') {
        total += getPrice('DUCT-BLOW');
        total += getPrice('HDW-UV-010');
        total += getPrice('DV-ADDONS');
    }

    if (selectedPackage === 'best') {
        total -= getPrice('HDW-UV-010'); // Remove Basic UV
        total += getPrice('HDW-PCO-010'); // Add PCO
        total -= getPrice('DUCT-BLOW'); // Remove Basic Blower Cleaning
        total += getPrice('BLOWER-RESTORE'); // Add Restoration
    }

    setOversizeAdjustment(adjustment);
    setCalculatedTotal(total);
  };

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
     toast({ title: "Proposal Sent", description: "The customer has received the package details." });
     setIsSubmitted(true);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet><title>Estimator Pro | The Vent Guys</title></Helmet>
      
      <div className="flex flex-col lg:flex-row h-screen">
        
        {/* LEFT PANEL: WIZARD STEPS */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="p-6 max-w-3xl mx-auto w-full">
             <div className="mb-8">
               <h1 className="text-2xl font-bold text-slate-900">Proposal Builder</h1>
               <Progress value={(currentStep / 4) * 100} className="h-2 mt-4" />
             </div>

             {/* STEP 1: FINDINGS */}
             {currentStep === 1 && (
               <Card>
                 <CardHeader>
                    <CardTitle>Site Inspection Findings</CardTitle>
                    <div className="mt-2 flex items-start gap-3 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
                        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p>
                            Our standard cleaning package includes up to 12 supply vents per system, which covers the average Florida home. 
                            Larger systems with more vents or extra return grills may have a small adjustment automatically applied to reflect the extra work.
                        </p>
                    </div>
                 </CardHeader>
                 <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label>Home Size (Sq Ft)</Label>
                          <Input type="number" value={property.sqFt} onChange={(e) => setProperty({...property, sqFt: e.target.value})} placeholder="2000" />
                       </div>
                       <div className="space-y-2">
                          <Label>Total Supply Vents</Label>
                          <Input type="number" value={property.numVents} onChange={(e) => setProperty({...property, numVents: e.target.value})} placeholder="12" />
                       </div>
                       <div className="space-y-2">
                          <Label>Total Return Grills</Label>
                          <Input type="number" value={property.numReturns} onChange={(e) => setProperty({...property, numReturns: e.target.value})} placeholder="1" />
                       </div>
                       <div className="space-y-2">
                          <Label>Number of Systems</Label>
                          <Input type="number" value={property.numSystems} onChange={(e) => setProperty({...property, numSystems: e.target.value})} placeholder="1" />
                       </div>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                        <Label className="text-base">Critical Findings</Label>
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                           <div className="flex items-center gap-3">
                               <AlertTriangle className={`w-5 h-5 ${findings.moldDetected ? 'text-red-500' : 'text-slate-400'}`} />
                               <span className="font-medium">Organic Growth / Mold Detected?</span>
                           </div>
                           <Switch checked={findings.moldDetected} onCheckedChange={(c) => setFindings({...findings, moldDetected: c})} />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                           <span className="font-medium">Excessive Lint / Fire Hazard?</span>
                           <Switch checked={findings.excessiveLint} onCheckedChange={(c) => setFindings({...findings, excessiveLint: c})} />
                        </div>
                    </div>
                 </CardContent>
                 <CardFooter>
                    <Button className="w-full" onClick={handleNext}>Continue to Options</Button>
                 </CardFooter>
               </Card>
             )}

             {/* STEP 2: PACKAGES */}
             {currentStep === 2 && (
                <div className="space-y-6">
                   <Tabs value={selectedPackage} onValueChange={setSelectedPackage} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 h-14">
                         <TabsTrigger value="good" disabled={findings.moldDetected} className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                            GOOD {findings.moldDetected && "(N/A)"}
                         </TabsTrigger>
                         <TabsTrigger value="better" className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-800">
                            BETTER {findings.moldDetected && "(Required)"}
                         </TabsTrigger>
                         <TabsTrigger value="best" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800">
                            BEST
                         </TabsTrigger>
                      </TabsList>

                      <div className="mt-6">
                         <Card className="border-2 border-blue-600 overflow-hidden">
                            <CardHeader className="bg-slate-100 border-b">
                               <div className="flex justify-between items-center">
                                  <CardTitle>Package Configuration</CardTitle>
                                  <span className="text-2xl font-bold text-green-600">${calculatedTotal.toFixed(2)}</span>
                               </div>
                               <p className="text-xs text-slate-500 mt-2">
                                  Package pricing shown assumes a standard system (up to 12 supply vents and 1 return). Larger systems may require a small adjustment.
                               </p>
                            </CardHeader>
                            <CardContent className="p-0">
                               <ul className="divide-y divide-slate-100">
                                  <li className="p-4 flex justify-between bg-slate-50">
                                     <span>Air Duct Cleaning (Base System)</span>
                                     <span className="font-medium">Included</span>
                                  </li>
                                  
                                  {oversizeAdjustment > 0 && (
                                    <li className="p-4 flex justify-between bg-amber-50 text-amber-900">
                                        <span className="flex items-center gap-2">
                                            <Info className="w-4 h-4" /> Oversized System Adjustment
                                        </span>
                                        <span className="font-medium text-amber-700">+${oversizeAdjustment.toFixed(2)}</span>
                                    </li>
                                  )}

                                  <li className="p-4 flex justify-between bg-slate-50">
                                     <span>Dryer Vent Cleaning</span>
                                     <span className="font-medium">Included</span>
                                  </li>
                                  <li className="p-4 flex justify-between bg-slate-50">
                                     <span>System Sanitizer</span>
                                     <span className="font-medium">Included</span>
                                  </li>
                                  
                                  {(selectedPackage === 'better' || selectedPackage === 'best') && (
                                    <>
                                      <li className="p-4 flex justify-between bg-indigo-50/50">
                                        <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600"/> UV-C Light System</span>
                                        <span className="font-medium">Included</span>
                                      </li>
                                      <li className="p-4 flex justify-between bg-indigo-50/50">
                                        <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600"/> Blower Cleaning</span>
                                        <span className="font-medium">Included</span>
                                      </li>
                                    </>
                                  )}

                                  {selectedPackage === 'best' && (
                                    <>
                                      <li className="p-4 flex justify-between bg-purple-50/50">
                                        <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600"/> PCO Upgrade (Whole Home)</span>
                                        <span className="font-medium">Included</span>
                                      </li>
                                      <li className="p-4 flex justify-between bg-purple-50/50">
                                        <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600"/> Blower Restoration Upgrade</span>
                                        <span className="font-medium">Included</span>
                                      </li>
                                      <li className="p-4 flex justify-between bg-purple-50/50">
                                        <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600"/> 1-Year Maintenance</span>
                                        <span className="font-medium">FREE</span>
                                      </li>
                                    </>
                                  )}
                               </ul>
                            </CardContent>
                         </Card>
                      </div>
                   </Tabs>
                   <div className="flex gap-4">
                       <Button variant="outline" className="w-1/2" onClick={handlePrev}>Back</Button>
                       <Button className="w-1/2" onClick={handleNext}>Review Proposal</Button>
                   </div>
                </div>
             )}

             {/* STEP 3 & 4 Placeholder logic */}
             {(currentStep === 3 || currentStep === 4) && (
                <div className="text-center py-10">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold">Review & Send</h2>
                        <p className="text-slate-600">Total Investment: ${calculatedTotal.toFixed(2)}</p>
                    </div>
                    <div className="grid gap-4 max-w-md mx-auto mb-8">
                        <Input placeholder="Customer Email" value={contactInfo.email} onChange={e => setContactInfo({...contactInfo, email: e.target.value})} />
                    </div>
                    <div className="flex gap-4 justify-center">
                       <Button variant="outline" onClick={handlePrev}>Back</Button>
                       <Button onClick={handleSubmit} disabled={isSubmitted}>
                          {isSubmitted ? 'Sent!' : 'Send Proposal'}
                       </Button>
                    </div>
                </div>
             )}
          </div>
        </div>

        {/* RIGHT PANEL: TECH TALK TRACK */}
        {/* Only show if user is logged in (Technician Mode) - Removed check since auth is removed */}
        <div className="w-full lg:w-1/3 bg-slate-50 h-screen hidden lg:block shadow-inner z-10">
           <TechTalkTrack 
              scenario={findings.moldDetected ? 'mold' : 'normal'} 
              packageLevel={selectedPackage} 
           />
        </div>
      </div>
    </div>
  );
};

export default EstimateWizard;
