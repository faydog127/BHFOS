import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Search, User, FileText, DollarSign, Loader2, UserPlus, X, Tag, Ticket } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatPhoneNumber } from '@/lib/formUtils';

const EstimateEditorModal = ({ isOpen, onClose, onEstimateCreated }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Data Source State
  const [leads, setLeads] = useState([]);
  const [priceBook, setPriceBook] = useState([]);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingLeads, setIsSearchingLeads] = useState(false);

  // New Customer State
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    address: ''
  });

  // Discount State
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [isCheckingDiscount, setIsCheckingDiscount] = useState(false);

  // Form State
  const [selectedLead, setSelectedLead] = useState(null);
  const [lineItems, setLineItems] = useState([]);

  // Load Price Book on Mount
  useEffect(() => {
    const fetchPriceBook = async () => {
      const { data } = await supabase.from('price_book').select('*').eq('active', true);
      if (data) setPriceBook(data);
    };
    if (isOpen) fetchPriceBook();
  }, [isOpen]);

  // Lead Search Logic
  useEffect(() => {
    const searchLeads = async () => {
      if (!searchTerm || searchTerm.length < 2) {
        setLeads([]);
        return;
      }
      setIsSearchingLeads(true);
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, company, email, phone')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10);
      
      if (!error && data) setLeads(data);
      setIsSearchingLeads(false);
    };

    const timeoutId = setTimeout(searchLeads, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleLeadSelect = (lead) => {
    setSelectedLead(lead);
    setSearchTerm('');
    setLeads([]); 
    setIsCreatingNewCustomer(false);
  };

  const handleNewCustomerChange = (field, value) => {
    setNewCustomer(prev => ({ ...prev, [field]: value }));
  };

  const createCustomer = async () => {
    if (!newCustomer.firstName || !newCustomer.lastName) {
      toast({ variant: "destructive", title: "Missing Information", description: "First and Last Name are required." });
      return null;
    }

    try {
      const { data, error } = await supabase.from('leads').insert({
        first_name: newCustomer.firstName,
        last_name: newCustomer.lastName,
        email: newCustomer.email,
        phone: newCustomer.phone,
        company: newCustomer.company,
        status: 'new',
        pipeline_stage: 'new',
        source: 'manual_entry',
        created_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error creating customer", description: err.message });
      return null;
    }
  };

  const addItem = (item) => {
    setLineItems([...lineItems, { 
      ...item, 
      quantity: 1, 
      price: Number(item.base_price),
      total: Number(item.base_price) 
    }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    
    if (field === 'quantity') {
      item.quantity = Number(value);
      item.total = item.quantity * item.price;
    } else if (field === 'price') {
      item.price = Number(value);
      item.total = item.quantity * item.price;
    } else if (field === 'description') {
      item.name = value; 
    }

    setLineItems(newItems);
  };

  const removeItem = (index) => {
    const newItems = [...lineItems];
    newItems.splice(index, 1);
    setLineItems(newItems);
  };

  const handleApplyDiscount = async () => {
    if (!discountCode) return;
    setIsCheckingDiscount(true);
    try {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .ilike('code', discountCode)
        .eq('active', true)
        .single();
      
      if (error || !data) {
        toast({ variant: "destructive", title: "Invalid Code", description: "This discount code is invalid or expired." });
        setAppliedDiscount(null);
      } else {
        setAppliedDiscount(data);
        toast({ title: "Discount Applied", description: `Applied ${data.description}` });
        setDiscountCode(''); // Clear input on success
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Failed to verify discount code." });
    } finally {
      setIsCheckingDiscount(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
  };

  // Calculate Totals Memo
  const metrics = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
    let discountAmount = 0;
    
    if (appliedDiscount) {
      if (appliedDiscount.discount_type === 'percent') {
        discountAmount = subtotal * (Number(appliedDiscount.discount_value) / 100);
      } else {
        discountAmount = Number(appliedDiscount.discount_value);
      }
    }
    
    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);
    const total = Math.max(0, subtotal - discountAmount);

    return { subtotal, discountAmount, total };
  }, [lineItems, appliedDiscount]);

  const handleSave = async () => {
    // 1. Ensure we have a customer
    let leadId = selectedLead?.id;

    setSaveLoading(true);
    try {
      if (!leadId && isCreatingNewCustomer) {
         const newLead = await createCustomer();
         if (!newLead) {
             setSaveLoading(false);
             return; 
         }
         leadId = newLead.id;
      }

      if (!leadId) {
        toast({ variant: "destructive", title: "Missing Customer", description: "Please select or create a customer first." });
        setSaveLoading(false);
        return;
      }

      if (lineItems.length === 0) {
        toast({ variant: "destructive", title: "Empty Estimate", description: "Please add at least one line item." });
        setSaveLoading(false);
        return;
      }

      // 2. Generate Estimate Number
      const estNum = `EST-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2, '0')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`;

      // 3. Prepare Payload
      const payload = {
        lead_id: leadId,
        status: 'draft', 
        total_price: metrics.total,
        estimate_number: estNum,
        services: lineItems, 
        applied_discount_code: appliedDiscount?.code,
        applied_discount_amount: metrics.discountAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 4. Insert
      const { data, error } = await supabase.from('estimates').insert(payload).select().single();

      if (error) throw error;

      toast({ title: "Success", description: "Estimate created successfully." });
      if (onEstimateCreated) onEstimateCreated(data);
      onClose();
      
      // Reset State
      setStep(1);
      setSelectedLead(null);
      setLineItems([]);
      setSearchTerm('');
      setIsCreatingNewCustomer(false);
      setNewCustomer({ firstName: '', lastName: '', email: '', phone: '', company: '', address: '' });
      setAppliedDiscount(null);
      setDiscountCode('');

    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 border-b shrink-0 bg-white">
          <DialogTitle className="text-xl">Create New Estimate</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {/* STEP 1: CUSTOMER SELECTION */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2 mb-4">
                 <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</div>
                 <h3 className="font-semibold text-lg">Select Customer</h3>
              </div>
              
              {!isCreatingNewCustomer && !selectedLead && (
                <div className="space-y-4">
                  <div className="relative">
                    <Label>Search Leads</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Search by name, email, or company..." 
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)} 
                      />
                      {isSearchingLeads && <div className="absolute right-3 top-2.5"><Loader2 className="h-4 w-4 animate-spin text-blue-600"/></div>}
                    </div>

                    {leads.length > 0 && (
                       <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                          {leads.map(lead => (
                            <div 
                              key={lead.id} 
                              className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0"
                              onClick={() => handleLeadSelect(lead)}
                            >
                               <div className="font-medium">{lead.first_name} {lead.last_name}</div>
                               <div className="text-xs text-slate-500">{lead.company} • {lead.email}</div>
                            </div>
                          ))}
                       </div>
                    )}
                  </div>

                  <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-medium">Or</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full border-dashed border-2 py-6 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => setIsCreatingNewCustomer(true)}
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Create New Customer
                  </Button>
                </div>
              )}

              {isCreatingNewCustomer && (
                 <div className="bg-slate-50 border rounded-lg p-5 space-y-4 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-2">
                       <h4 className="font-semibold text-slate-800">New Customer Details</h4>
                       <Button variant="ghost" size="sm" onClick={() => setIsCreatingNewCustomer(false)} className="h-8 w-8 p-0">
                          <X className="w-4 h-4" />
                       </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label>First Name <span className="text-red-500">*</span></Label>
                          <Input value={newCustomer.firstName} onChange={(e) => handleNewCustomerChange('firstName', e.target.value)} placeholder="John" />
                       </div>
                       <div className="space-y-2">
                          <Label>Last Name <span className="text-red-500">*</span></Label>
                          <Input value={newCustomer.lastName} onChange={(e) => handleNewCustomerChange('lastName', e.target.value)} placeholder="Doe" />
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={newCustomer.email} onChange={(e) => handleNewCustomerChange('email', e.target.value)} placeholder="john@example.com" />
                       </div>
                       <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input value={newCustomer.phone} onChange={(e) => handleNewCustomerChange('phone', formatPhoneNumber(e.target.value))} placeholder="(555) 123-4567" />
                       </div>
                    </div>
                    
                    <div className="space-y-2">
                       <Label>Company (Optional)</Label>
                       <Input value={newCustomer.company} onChange={(e) => handleNewCustomerChange('company', e.target.value)} placeholder="Business Name LLC" />
                    </div>

                    <div className="space-y-2">
                       <Label>Address (Optional)</Label>
                       <Input value={newCustomer.address} onChange={(e) => handleNewCustomerChange('address', e.target.value)} placeholder="123 Main St, City, State" />
                    </div>
                 </div>
              )}

              {selectedLead && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 flex justify-between items-center animate-in fade-in">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700">
                         <User className="w-5 h-5"/>
                      </div>
                      <div>
                         <div className="font-bold text-slate-800">{selectedLead.first_name} {selectedLead.last_name}</div>
                         <div className="text-sm text-slate-600">{selectedLead.email}</div>
                         {selectedLead.company && <div className="text-xs text-slate-500 font-medium">{selectedLead.company}</div>}
                      </div>
                   </div>
                   <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)} className="text-red-600 hover:text-red-700 hover:bg-red-50">Change</Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: LINE ITEMS */}
          {step === 2 && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">2</div>
                       <h3 className="font-semibold text-lg">Build Estimate</h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Left Col: Item Picker */}
                   <div className="lg:col-span-1 border-r pr-6 space-y-4">
                      <Label>Add Services</Label>
                      <ScrollArea className="h-[300px] border rounded-md">
                         <div className="p-2 space-y-1">
                            {priceBook.map(item => (
                               <div 
                                 key={item.id} 
                                 className="p-2 text-sm hover:bg-slate-100 cursor-pointer rounded flex justify-between group"
                                 onClick={() => addItem(item)}
                               >
                                  <span className="font-medium truncate pr-2">{item.name}</span>
                                  <span className="text-slate-500 group-hover:text-blue-600 font-mono">${item.base_price}</span>
                               </div>
                            ))}
                         </div>
                      </ScrollArea>
                   </div>

                   {/* Right Col: Editor */}
                   <div className="lg:col-span-2 flex flex-col h-full">
                      <div className="flex-1 space-y-4">
                        <Label>Line Items ({lineItems.length})</Label>
                        {lineItems.length === 0 ? (
                            <div className="h-[200px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                            <FileText className="w-10 h-10 mb-2 opacity-50"/>
                            <p>No items added yet</p>
                            <p className="text-xs">Select services from the list</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[240px] pr-4">
                            <div className="space-y-3">
                                {lineItems.map((item, idx) => (
                                    <div key={idx} className="bg-white border rounded-lg p-3 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                        <Input 
                                            value={item.name} 
                                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                            className="h-8 font-medium border-transparent hover:border-slate-200 focus:border-blue-500 w-full mr-2 p-0 px-2"
                                        />
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => removeItem(idx)}>
                                            <Trash2 className="w-3.5 h-3.5"/>
                                        </Button>
                                        </div>
                                        <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <Label className="text-xs text-slate-500">Price</Label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1.5 text-xs text-slate-400">$</span>
                                                <Input 
                                                    type="number" 
                                                    value={item.price} 
                                                    onChange={(e) => updateItem(idx, 'price', e.target.value)}
                                                    className="h-8 pl-5 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="w-20">
                                            <Label className="text-xs text-slate-500">Qty</Label>
                                            <Input 
                                                type="number" 
                                                value={item.quantity} 
                                                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                className="h-8 text-sm"
                                                min="1"
                                            />
                                        </div>
                                        <div className="w-24 text-right">
                                            <Label className="text-xs text-slate-500">Total</Label>
                                            <div className="font-bold text-slate-700 py-1.5">${item.total.toFixed(2)}</div>
                                        </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            </ScrollArea>
                        )}
                      </div>

                      {/* Footer Totals Section */}
                      <div className="mt-6 border-t pt-4 space-y-4">
                          <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                                {/* Discount Input Area */}
                                <div className="w-full md:w-1/2">
                                    <Label className="text-xs text-slate-500 mb-1.5 block">Discount / Promo Code</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Tag className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                                            <Input 
                                                placeholder="Enter code" 
                                                className="pl-9 h-9" 
                                                value={discountCode}
                                                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                                                onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                                                disabled={!!appliedDiscount}
                                            />
                                        </div>
                                        {appliedDiscount ? (
                                            <Button variant="outline" size="sm" onClick={removeDiscount} className="text-red-500 hover:text-red-700 border-red-200 hover:bg-red-50">
                                                Remove
                                            </Button>
                                        ) : (
                                            <Button variant="secondary" size="sm" onClick={handleApplyDiscount} disabled={!discountCode || isCheckingDiscount}>
                                                {isCheckingDiscount ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Apply'}
                                            </Button>
                                        )}
                                    </div>
                                    {appliedDiscount && (
                                        <div className="mt-2 text-xs text-green-600 bg-green-50 border border-green-200 p-2 rounded flex items-start gap-2">
                                            <Ticket className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <div>
                                                <span className="font-bold">{appliedDiscount.code}</span>: {appliedDiscount.description}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Totals Display */}
                                <div className="w-full md:w-1/2 space-y-2 text-right">
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Subtotal</span>
                                        <span>${metrics.subtotal.toFixed(2)}</span>
                                    </div>
                                    {metrics.discountAmount > 0 && (
                                        <div className="flex justify-between text-sm text-green-600 font-medium">
                                            <span>Discount {appliedDiscount?.discount_type === 'percent' ? `(${appliedDiscount.discount_value}%)` : ''}</span>
                                            <span>-${metrics.discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xl font-bold text-slate-900 border-t pt-2">
                                        <span>Total</span>
                                        <span>${metrics.total.toFixed(2)}</span>
                                    </div>
                                </div>
                          </div>
                      </div>
                   </div>
                </div>
             </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50 shrink-0">
           {step === 2 && (
             <Button variant="outline" onClick={() => setStep(1)} disabled={saveLoading}>Back</Button>
           )}
           {step === 1 ? (
             <Button 
                onClick={() => setStep(2)} 
                disabled={(!selectedLead && !isCreatingNewCustomer) || (isCreatingNewCustomer && (!newCustomer.firstName || !newCustomer.lastName))}
             >
                {isCreatingNewCustomer ? 'Create Customer & Next' : 'Next: Add Items'}
             </Button>
           ) : (
             <Button onClick={handleSave} disabled={saveLoading} className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]">
               {saveLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <DollarSign className="w-4 h-4 mr-2"/>}
               Save Estimate
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EstimateEditorModal;