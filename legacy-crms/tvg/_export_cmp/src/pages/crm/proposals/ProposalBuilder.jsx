import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Trash2, Plus, Save, Send, ArrowLeft, Loader2, Calculator, 
  AlertCircle, Search, UserPlus, Phone, Mail, Thermometer, Check, FileText 
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const ProposalBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  // 1. Get activeTenantId from context
  const { user, activeTenantId } = useSupabaseAuth();
  
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [priceBook, setPriceBook] = useState([]);
  const [pricesUpdated, setPricesUpdated] = useState(false);
  
  // Customer Selection State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerView, setCustomerView] = useState('search'); 
  const [createLoading, setCreateLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    service: 'Duct Cleaning',
    temperature: 'Warm'
  });

  // Proposal State
  const [proposal, setProposal] = useState({
    lead_id: '',
    status: 'Draft',
    valid_until: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    header_text: 'Thank you for considering our services. We are pleased to submit this proposal for your review.',
    footer_text: 'Please sign below to accept this proposal. Work will begin upon receipt of signed document.',
    items: []
  });

  useEffect(() => {
    if (activeTenantId) {
      fetchInitialData();
    }
  }, [id, activeTenantId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      console.log(`Fetching leads for activeTenantId=${activeTenantId}`);
      console.log(`Fetching price_book for activeTenantId=${activeTenantId}`);

      const [leadsRes, priceBookRes] = await Promise.all([
          supabase.from('leads')
            .select('*')
            .eq('tenant_id', activeTenantId) // Added tenant filter
            .order('created_at', { ascending: false }),
          supabase.from('price_book')
            .select('*')
            .eq('active', true)
            .eq('tenant_id', activeTenantId) // Added tenant filter
            .order('name')
      ]);
      
      if (leadsRes.data) setLeads(leadsRes.data);
      if (priceBookRes.data) setPriceBook(priceBookRes.data);

      if (id) {
          console.log(`Fetching quotes for activeTenantId=${activeTenantId}`);
          const { data: prop, error } = await supabase
              .from('quotes')
              .select('*, quote_items(*)')
              .eq('id', id)
              .eq('tenant_id', activeTenantId) // Added tenant filter
              .single();
              
          if (prop && !error) {
              let items = prop.quote_items || [];
              let updated = false;

              if (['Draft', 'pending_review'].includes(prop.status)) {
                  items = items.map(item => {
                      if (item.price_book_code) {
                          const currentPriceItem = priceBookRes.data?.find(pb => pb.code === item.price_book_code);
                          if (currentPriceItem && Number(currentPriceItem.base_price) !== Number(item.unit_price)) {
                              updated = true;
                              return {
                                  ...item,
                                  unit_price: currentPriceItem.base_price,
                                  total_price: Number(item.quantity) * Number(currentPriceItem.base_price)
                              };
                          }
                      }
                      return item;
                  });
              }

              if (updated) {
                  setPricesUpdated(true);
                  toast({
                    title: "Prices Updated",
                    description: "Line item prices have been updated to match the current Pricing Guide.",
                    className: "bg-blue-50 border-blue-200"
                  });
              }

              setProposal({ ...prop, items });
          }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(l => {
     const search = customerSearch.toLowerCase();
     return (
        (l.first_name || '').toLowerCase().includes(search) ||
        (l.last_name || '').toLowerCase().includes(search) ||
        (l.phone || '').includes(search) ||
        (l.company || '').toLowerCase().includes(search)
     );
  });

  const handleCreateCustomer = async () => {
      if (!newCustomer.firstName || !newCustomer.phone) {
          toast({ variant: 'destructive', title: 'Required Fields', description: 'Name and Phone are required.' });
          return;
      }
      
      setCreateLoading(true);
      try {
          const { data, error } = await supabase.from('leads').insert({
              first_name: newCustomer.firstName,
              last_name: newCustomer.lastName,
              email: newCustomer.email,
              phone: newCustomer.phone,
              service: newCustomer.service,
              status: 'New',
              source: 'proposal_builder',
              notes: `Lead Temperature: ${newCustomer.temperature}`,
              tenant_id: activeTenantId // Ensuring insert has tenant_id
          }).select().single();

          if (error) throw error;

          setLeads([data, ...leads]);
          setProposal(prev => ({ ...prev, lead_id: data.id }));
          setIsCustomerModalOpen(false);
          setCustomerView('search');
          toast({ title: "Success", description: "Customer created and selected." });
      } catch (err) {
          toast({ variant: "destructive", title: "Error", description: err.message });
      } finally {
          setCreateLoading(false);
      }
  };

  const addItem = () => {
    setProposal(prev => ({
        ...prev,
        items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total_price: 0, price_book_code: null }]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...proposal.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? value : newItems[index].quantity;
        const p = field === 'unit_price' ? value : newItems[index].unit_price;
        newItems[index].total_price = Number(q) * Number(p);
    }
    setProposal(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    const newItems = proposal.items.filter((_, i) => i !== index);
    setProposal(prev => ({ ...prev, items: newItems }));
  };

  const handlePriceBookSelect = (index, code) => {
      const item = priceBook.find(p => p.code === code);
      if (item) {
          const newItems = [...proposal.items];
          newItems[index] = {
              ...newItems[index],
              description: item.name,
              unit_price: item.base_price,
              price_book_code: item.code,
              total_price: Number(newItems[index].quantity) * Number(item.base_price)
          };
          setProposal(prev => ({ ...prev, items: newItems }));
      }
  };

  const calculateTotals = () => {
    const subtotal = proposal.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const taxRate = 0.07;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSave = async (newStatus = null) => {
    if (!proposal.lead_id) {
        toast({ variant: 'destructive', title: 'Missing Customer', description: 'Please select a customer.' });
        return;
    }

    const selectedLead = leads.find(l => l.id === proposal.lead_id);
    
    // Validate email before sending
    if (newStatus === 'sent') {
      if (!selectedLead || !selectedLead.email) {
          toast({ 
              variant: 'destructive', 
              title: 'Cannot Send', 
              description: 'Please select a lead with an email address.' 
          });
          return;
      }
    }

    setLoading(true);
    const { subtotal, taxAmount, total } = calculateTotals();
    const statusToSave = newStatus || proposal.status;
    
    // 3. Use activeTenantId from context
    console.log(`Saving proposal with activeTenantId=${activeTenantId}`);

    const baseQuoteData = {
        lead_id: proposal.lead_id,
        user_id: user?.id,
        status: statusToSave,
        valid_until: proposal.valid_until,
        header_text: proposal.header_text,
        footer_text: proposal.footer_text,
        subtotal,
        tax_rate: 0.07,
        tax_amount: taxAmount,
        total_amount: total,
        quote_number: proposal.quote_number || Math.floor(100000 + Math.random() * 900000)
    };

    // 4. Include tenant_id: activeTenantId in payload
    const quoteDataWithTenant = { ...baseQuoteData, tenant_id: activeTenantId };

    try {
        let quoteId = id;
        
        // Helper to execute DB operation with fallback for tenant_id column missing
        const executeDbOp = async () => {
            if (id) {
                // UPDATE OPERATION
                try {
                    const { error } = await supabase
                        .from('quotes')
                        .update(quoteDataWithTenant)
                        .eq('id', id)
                        .eq('tenant_id', activeTenantId); // Added safety filter
                    if (error) throw error;
                    return { id };
                } catch (err) {
                    // Check for column missing error
                    if (err.message?.includes('column') || err.message?.includes('does not exist') || err.code === '42703' || err.code === 'PGRST204') {
                         console.warn("quotes table missing tenant_id; skipping tenant_id in payload");
                         const { error: retryError } = await supabase
                            .from('quotes')
                            .update(baseQuoteData)
                            .eq('id', id);
                         if (retryError) throw retryError;
                         return { id };
                    }
                    throw err;
                }
            } else {
                // INSERT OPERATION
                try {
                     const { data, error } = await supabase
                        .from('quotes')
                        .insert([quoteDataWithTenant])
                        .select()
                        .single();
                     if (error) throw error;
                     return data;
                } catch (err) {
                     if (err.message?.includes('column') || err.message?.includes('does not exist') || err.code === '42703' || err.code === 'PGRST204') {
                         console.warn("quotes table missing tenant_id; skipping tenant_id in payload");
                         const { data: retryData, error: retryError } = await supabase
                            .from('quotes')
                            .insert([baseQuoteData])
                            .select()
                            .single();
                         if (retryError) throw retryError;
                         return retryData;
                     }
                     throw err;
                }
            }
        };

        const result = await executeDbOp();
        quoteId = result.id;

        // Replace Items
        if (id) {
            console.log(`Fetching quote_items for activeTenantId=${activeTenantId}`);
            // Note: quote_items does not have a tenant_id directly. RLS on quote_items ensures proper access.
            // Filtering by quote_id is sufficient here, as quote_id itself is tenant-isolated by the quotes table.
            await supabase.from('quote_items').delete().eq('quote_id', quoteId); 
        }
        
        console.log(`Fetching quote_items for activeTenantId=${activeTenantId}`);
        const itemsToInsert = proposal.items.map(item => ({
            quote_id: quoteId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            price_book_code: item.price_book_code
        }));
        
        if (itemsToInsert.length > 0) {
            // Note: quote_items does not have a tenant_id directly. RLS on quote_items ensures proper access.
            await supabase.from('quote_items').insert(itemsToInsert);
        }

        if (statusToSave === 'sent') {
             try {
                 // 5. Trigger Send Estimate Edge Function with activeTenantId in payload and headers
                 const edgeFunctionPayload = { 
                    quote_id: quoteId,
                    email: selectedLead.email,
                    lead_id: selectedLead.id,
                    tenant_id: activeTenantId
                 };
                 
                 console.log(`Invoking edge function with activeTenantId=${activeTenantId}, payload keys=${Object.keys(edgeFunctionPayload).join(', ')}`);
                 
                 const { data, error: sendError } = await supabase.functions.invoke('send-estimate', {
                     body: edgeFunctionPayload,
                     headers: {
                        'x-tenant-id': activeTenantId || ''
                     }
                 });

                 // Edge function error (caught by supabase client)
                 if (sendError) throw sendError;
                 
                 // Edge function internal error (returned as 400 with { error: "msg" })
                 if (data && data.error) throw new Error(data.error);

                 toast({ title: 'Sent', description: 'Proposal emailed to client successfully.' });
                 
                 // Update lead status
                 await supabase.from('leads').update({
                     last_contact_at: new Date().toISOString(),
                     status: 'Proposal Sent'
                 }).eq('id', proposal.lead_id);
                 
             } catch (err) {
                 console.error("Email Sending Failed:", err);
                 // Extract clean error message
                 const errMsg = err.message || JSON.stringify(err);
                 toast({ 
                     variant: 'destructive', 
                     title: 'Email Failed', 
                     description: `Proposal saved, but email failed: ${errMsg}` 
                 });
             }
        } else {
             toast({ title: 'Success', description: 'Proposal saved successfully.' });
        }

        if (!id) navigate(`/crm/proposals/${quoteId}`);
        else setProposal(prev => ({ ...prev, status: statusToSave }));
        setPricesUpdated(false);

    } catch (error) {
        console.error('Save error:', error);
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(false);
    }
  };
  
  const handleConvertToInvoice = () => {
      navigate(`/crm/invoices/new?quote_id=${id}`);
  };

  const { subtotal, taxAmount, total } = calculateTotals();
  const selectedLead = leads.find(l => l.id === proposal.lead_id);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/crm/proposals')}><ArrowLeft className="w-5 h-5" /></Button>
            <div>
                <div className="flex items-center gap-3">
                   <h1 className="text-3xl font-bold text-slate-900">{id ? `Edit Proposal #${proposal.quote_number}` : 'New Proposal'}</h1>
                   <Badge variant={proposal.status === 'sent' ? 'default' : 'secondary'}>{proposal.status}</Badge>
                   {pricesUpdated && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Prices Synced</Badge>}
                </div>
            </div>
         </div>
         <div className="flex gap-2">
            {id && (proposal.status === 'sent' || proposal.status === 'accepted') && (
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={handleConvertToInvoice}>
                    <FileText className="w-4 h-4 mr-2" /> Convert to Invoice
                </Button>
            )}
            <Button variant="outline" onClick={() => handleSave(proposal.status)} disabled={loading}>
                <Save className="w-4 h-4 mr-2" /> Save
            </Button>
            <Button className="bg-blue-600" onClick={() => handleSave('sent')} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Save & Send
            </Button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Customer Information</span>
                        <Button variant="outline" size="sm" onClick={() => setIsCustomerModalOpen(true)}>
                            {proposal.lead_id ? 'Change Customer' : 'Select Customer'}
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!selectedLead ? (
                        <div className="text-center py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsCustomerModalOpen(true)}>
                            <UserPlus className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <p className="text-slate-500 font-medium">No Customer Selected</p>
                            <p className="text-xs text-slate-400">Click to select or create a new customer</p>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">{selectedLead.first_name} {selectedLead.last_name}</h3>
                                {selectedLead.company && <p className="text-sm text-slate-600 font-medium">{selectedLead.company}</p>}
                                <div className="mt-3 space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Mail className="w-3.5 h-3.5" /> {selectedLead.email || 'No email'}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Phone className="w-3.5 h-3.5" /> {selectedLead.phone || 'No phone'}
                                    </div>
                                </div>
                            </div>
                            <div className="sm:border-l sm:pl-4 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Service:</span>
                                    <Badge variant="outline" className="bg-white">{selectedLead.service || 'N/A'}</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm pt-2">
                                     <span className="text-slate-500">Proposal Date:</span>
                                     <span className="font-medium">{format(new Date(), 'MMM d, yyyy')}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-4">
                         <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1.5 block">Proposal Valid Until</Label>
                         <Input type="date" value={proposal.valid_until} onChange={e => setProposal({...proposal, valid_until: e.target.value})} className="max-w-[200px]" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Line Items</CardTitle>
                    <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Service / Product</TableHead>
                                <TableHead className="w-[15%]">Qty</TableHead>
                                <TableHead className="w-[20%]">Price ($)</TableHead>
                                <TableHead className="w-[20%]">Total ($)</TableHead>
                                <TableHead className="w-[5%]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {proposal.items.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <Select 
                                              value={item.price_book_code || "custom"} 
                                              onValueChange={(val) => val === "custom" ? null : handlePriceBookSelect(idx, val)}
                                            >
                                               <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                                   <SelectValue placeholder="Select from Price Book" />
                                               </SelectTrigger>
                                               <SelectContent>
                                                  <SelectItem value="custom">-- Custom Item --</SelectItem>
                                                  {priceBook.map(pb => (
                                                      <SelectItem key={pb.id} value={pb.code}>
                                                          {pb.name} (${Number(pb.base_price).toFixed(2)})
                                                      </SelectItem>
                                                  ))}
                                               </SelectContent>
                                            </Select>
                                            <Input 
                                                value={item.description} 
                                                onChange={e => updateItem(idx, 'description', e.target.value)} 
                                                placeholder="Description" 
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Input type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                                    </TableCell>
                                    <TableCell className="align-top pt-6">
                                        <div className="pl-3 font-medium">${Number(item.total_price).toFixed(2)}</div>
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Terms & Notes</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Introduction / Header</Label>
                        <Textarea value={proposal.header_text} onChange={e => setProposal({...proposal, header_text: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Footer / Terms</Label>
                        <Textarea value={proposal.footer_text} onChange={e => setProposal({...proposal, footer_text: e.target.value})} />
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="bg-slate-900 text-white border-none shadow-xl sticky top-24">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-400" /> Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between text-slate-300">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                        <span>Tax (7%)</span>
                        <span>${taxAmount.toFixed(2)}</span>
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between text-xl font-bold text-white">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={isCustomerModalOpen} onOpenChange={(open) => { setIsCustomerModalOpen(open); if(open) setCustomerView('search'); }}>
         <DialogContent className="sm:max-w-[600px] h-[80vh] sm:h-auto flex flex-col">
             <DialogHeader>
                 <DialogTitle>{customerView === 'search' ? 'Select Customer' : 'Create New Customer'}</DialogTitle>
             </DialogHeader>

             {customerView === 'search' ? (
                 <div className="space-y-4 flex-1 overflow-y-auto p-1">
                     <div className="flex gap-2">
                         <div className="relative flex-1">
                             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                             <Input 
                                placeholder="Search by name, phone, or company..." 
                                className="pl-9"
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                             />
                         </div>
                         <Button onClick={() => setCustomerView('create')}>
                             <UserPlus className="w-4 h-4 mr-2" /> New
                         </Button>
                     </div>
                     <div className="space-y-2 mt-4">
                         {filteredLeads.map(lead => (
                             <div 
                                key={lead.id} 
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => {
                                    setProposal(prev => ({ ...prev, lead_id: lead.id }));
                                    setIsCustomerModalOpen(false);
                                }}
                             >
                                 <div>
                                     <div className="font-bold text-slate-900">{lead.first_name} {lead.last_name}</div>
                                     <div className="text-xs text-slate-500 flex gap-3">
                                         <span>{lead.email}</span>
                                         {lead.phone && <span>• {lead.phone}</span>}
                                     </div>
                                 </div>
                                 {lead.id === proposal.lead_id && <Check className="w-5 h-5 text-blue-600" />}
                             </div>
                         ))}
                     </div>
                 </div>
             ) : (
                 <div className="space-y-4 py-2">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                             <Label>First Name</Label>
                             <Input 
                                value={newCustomer.firstName} 
                                onChange={e => setNewCustomer({...newCustomer, firstName: e.target.value})}
                                placeholder="Jane"
                             />
                         </div>
                         <div className="space-y-2">
                             <Label>Last Name</Label>
                             <Input 
                                value={newCustomer.lastName} 
                                onChange={e => setNewCustomer({...newCustomer, lastName: e.target.value})}
                                placeholder="Doe"
                             />
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                             <Label>Email</Label>
                             <Input 
                                value={newCustomer.email} 
                                onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                                placeholder="email@example.com"
                             />
                         </div>
                         <div className="space-y-2">
                             <Label>Phone</Label>
                             <Input 
                                value={newCustomer.phone} 
                                onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                                placeholder="(555) 123-4567"
                             />
                         </div>
                     </div>
                     
                     <div className="space-y-2">
                         <Label>Service Interest</Label>
                         <Select value={newCustomer.service} onValueChange={v => setNewCustomer({...newCustomer, service: v})}>
                             <SelectTrigger>
                                 <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                                 <SelectItem value="Duct Cleaning">Duct Cleaning</SelectItem>
                                 <SelectItem value="Dryer Vent Cleaning">Dryer Vent Cleaning</SelectItem>
                                 <SelectItem value="HVAC Repair">HVAC Repair</SelectItem>
                                 <SelectItem value="New Install">New Install</SelectItem>
                             </SelectContent>
                         </Select>
                     </div>

                     <div className="space-y-2">
                         <Label>Lead Temperature</Label>
                         <div className="grid grid-cols-3 gap-2">
                             {['Cold', 'Warm', 'Hot'].map(temp => (
                                 <div 
                                    key={temp}
                                    className={`
                                        cursor-pointer text-center p-2 rounded-md border text-sm font-medium transition-colors
                                        ${newCustomer.temperature === temp 
                                            ? 'bg-blue-50 border-blue-500 text-blue-700' 
                                            : 'hover:bg-slate-50 border-slate-200 text-slate-600'
                                        }
                                    `}
                                    onClick={() => setNewCustomer({...newCustomer, temperature: temp})}
                                 >
                                     {temp}
                                 </div>
                             ))}
                         </div>
                     </div>

                     <DialogFooter className="mt-6">
                         <Button variant="ghost" onClick={() => setCustomerView('search')}>Back to Search</Button>
                         <Button onClick={handleCreateCustomer} disabled={createLoading}>
                             {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                             Create Customer
                         </Button>
                     </DialogFooter>
                 </div>
             )}
         </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProposalBuilder;