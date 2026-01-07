import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Plus, Save, Send, ArrowLeft, Loader2, Calculator, Link as LinkIcon, DollarSign, Ban, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const InvoiceBuilder = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const quoteIdParam = searchParams.get('quote_id');
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [priceBook, setPriceBook] = useState([]);
  
  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(''); 
  const [paymentNote, setPaymentNote] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Void Confirmation Dialog State
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);

  // Invoice State
  const [invoice, setInvoice] = useState({
    lead_id: '',
    status: 'draft',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    notes: 'Thank you for your business. Please contact us if you have any questions.',
    terms: 'Payment is due within 14 days.',
    items: [],
    invoice_number: '',
    public_token: '',
    discount_amount: 0,
    amount_paid: 0,
    quote_id: null
  });

  useEffect(() => {
    fetchInitialData();
  }, [id, quoteIdParam]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [leadsRes, priceBookRes] = await Promise.all([
          supabase.from('leads').select('id, first_name, last_name, company').order('created_at', { ascending: false }),
          supabase.from('price_book').select('*').eq('active', true).order('name')
      ]);
      
      if (leadsRes.data) setLeads(leadsRes.data);
      if (priceBookRes.data) setPriceBook(priceBookRes.data);

      if (id) {
          const { data: inv, error } = await supabase
              .from('invoices')
              .select('*, invoice_items(*)')
              .eq('id', id)
              .single();
              
          if (inv && !error) {
            setInvoice({
              ...inv,
              items: inv.invoice_items || []
            });
          }
      } else if (quoteIdParam) {
          const { data: quote, error: quoteError } = await supabase
              .from('quotes')
              .select('*, quote_items(*)')
              .eq('id', quoteIdParam)
              .single();

          if (quote && !quoteError) {
             const randomNum = Math.floor(100000 + Math.random() * 900000);
             setInvoice({
                 ...invoice,
                 lead_id: quote.lead_id,
                 quote_id: quote.id,
                 invoice_number: randomNum,
                 items: quote.quote_items.map(item => ({
                     description: item.description,
                     quantity: item.quantity,
                     unit_price: item.unit_price,
                     total_price: item.total_price,
                     service_id: null,
                     is_taxable: true
                 })),
                 discount_amount: 0,
                 notes: `Generated from Quote #${quote.quote_number}`
             });
             toast({ title: "Data Loaded", description: `Invoice pre-filled from Quote #${quote.quote_number}` });
          }
      } else {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        setInvoice(prev => ({ ...prev, invoice_number: randomNum }));
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setInvoice(prev => ({
        ...prev,
        items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total_price: 0, service_id: null, is_taxable: true }]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...invoice.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? value : newItems[index].quantity;
        const p = field === 'unit_price' ? value : newItems[index].unit_price;
        newItems[index].total_price = Number(q) * Number(p);
    }
    setInvoice(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    const newItems = invoice.items.filter((_, i) => i !== index);
    setInvoice(prev => ({ ...prev, items: newItems }));
  };

  const handlePriceBookSelect = (index, code) => {
      const item = priceBook.find(p => p.code === code);
      if (item) {
          const newItems = [...invoice.items];
          newItems[index] = {
              ...newItems[index],
              description: item.name,
              unit_price: item.base_price,
              service_id: item.id,
              total_price: Number(newItems[index].quantity) * Number(item.base_price)
          };
          setInvoice(prev => ({ ...prev, items: newItems }));
      }
  };

  const calculateTotals = () => {
    const subtotal = invoice.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const taxableSubtotal = invoice.items.filter(i => i.is_taxable).reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const taxRate = 0.07;
    const taxAmount = taxableSubtotal * taxRate;
    const discount = Number(invoice.discount_amount) || 0;
    const total = subtotal + taxAmount - discount;
    const balance = total - (Number(invoice.amount_paid) || 0);
    return { subtotal, taxAmount, total, balance };
  };

  const handleSave = async (newStatus = null) => {
    if (!invoice.lead_id) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a customer.' });
        return;
    }

    setLoading(true);
    const { subtotal, taxAmount, total, balance } = calculateTotals();
    const statusToSave = newStatus || invoice.status;

    let publicToken = invoice.public_token;
    if (!publicToken) {
       const array = new Uint8Array(16);
       crypto.getRandomValues(array);
       publicToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    const invoiceData = {
        lead_id: invoice.lead_id,
        quote_id: invoice.quote_id,
        status: statusToSave,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        notes: invoice.notes,
        terms: invoice.terms,
        subtotal,
        tax_rate: 0.07,
        tax_amount: taxAmount,
        discount_amount: invoice.discount_amount,
        total_amount: total,
        amount_paid: invoice.amount_paid || 0,
        balance_due: balance,
        invoice_number: invoice.invoice_number,
        public_token: publicToken,
        sent_at: statusToSave === 'sent' && invoice.status !== 'sent' ? new Date() : invoice.sent_at
    };

    try {
        let invoiceId = id;
        
        if (id) {
            await supabase.from('invoices').update(invoiceData).eq('id', id);
        } else {
            const { data, error } = await supabase.from('invoices').insert([invoiceData]).select().single();
            if (error) throw error;
            invoiceId = data.id;
        }

        if (id) {
            await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
        }
        
        const itemsToInsert = invoice.items.map(item => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            service_id: item.service_id,
            is_taxable: item.is_taxable
        }));
        
        if (itemsToInsert.length > 0) {
            await supabase.from('invoice_items').insert(itemsToInsert);
        }

        // --- SEND EMAIL LOGIC (New in Audit) ---
        if (statusToSave === 'sent') {
            toast({ title: "Sending...", description: "Dispatching invoice to customer." });
            const { data: sendData, error: sendError } = await supabase.functions.invoke('send-invoice', {
                body: { invoice_id: invoiceId }
            });

            if (sendError) {
                console.error("Send Invoice Error:", sendError);
                toast({ variant: "destructive", title: "Email Failed", description: sendError.message });
            } else {
                toast({ title: "Invoice Sent", description: "Customer has been emailed." });
            }
        } else {
            toast({ title: 'Success', description: 'Invoice saved successfully.' });
        }

        if (!id) navigate(`/crm/invoices/${invoiceId}/edit`);
        else setInvoice(prev => ({ ...prev, ...invoiceData, public_token: publicToken }));

    } catch (error) {
        console.error('Save error:', error);
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
      if (!paymentAmount || Number(paymentAmount) <= 0) {
          toast({ variant: "destructive", title: "Invalid Amount", description: "Payment amount must be greater than zero." });
          return;
      }
      
      if (!paymentMethod) {
          toast({ variant: "destructive", title: "Method Required", description: "Please select a payment method to proceed." });
          return;
      }

      setProcessingPayment(true);
      try {
          const { error: txError } = await supabase.from('transactions').insert({
              invoice_id: id,
              amount: paymentAmount,
              type: 'payment',
              method: paymentMethod,
              status: 'completed',
              created_by: user?.id
          });
          if (txError) throw txError;

          const newPaidAmount = (Number(invoice.amount_paid) || 0) + Number(paymentAmount);
          const { total } = calculateTotals();
          const newBalance = total - newPaidAmount;
          const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';

          const { error: invError } = await supabase.from('invoices').update({
              amount_paid: newPaidAmount,
              balance_due: newBalance > 0 ? newBalance : 0,
              status: newStatus,
              paid_at: newStatus === 'paid' ? new Date() : invoice.paid_at
          }).eq('id', id);

          if (invError) throw invError;

          setInvoice(prev => ({
              ...prev,
              amount_paid: newPaidAmount,
              status: newStatus
          }));
          
          setIsPayModalOpen(false);
          setPaymentAmount('');
          setPaymentMethod('');
          toast({ title: "Payment Recorded", description: `Successfully recorded payment of $${paymentAmount} via ${paymentMethod}` });

      } catch (err) {
          toast({ variant: "destructive", title: "Error", description: err.message });
      } finally {
          setProcessingPayment(false);
      }
  };

  const handleVoid = async () => {
      try {
          await supabase.from('invoices').update({ status: 'void', balance_due: 0 }).eq('id', id);
          setInvoice(prev => ({ ...prev, status: 'void', balance_due: 0 }));
          setIsVoidDialogOpen(false);
          toast({ title: "Invoice Voided" });
      } catch (err) {
          toast({ variant: "destructive", title: "Error", description: err.message });
      }
  };

  const copyPaymentLink = () => {
    if (!invoice.public_token) {
        toast({ title: "Save First", description: "Please save the invoice to generate a link." });
        return;
    }
    const url = `${window.location.origin}/pay/${invoice.public_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Payment link copied to clipboard." });
  };

  const { subtotal, taxAmount, total, balance } = calculateTotals();

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
         <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/crm/invoices')}><ArrowLeft className="w-5 h-5" /></Button>
            <div>
                <div className="flex items-center gap-3">
                   <h1 className="text-3xl font-bold text-slate-900">{id ? `Invoice #${invoice.invoice_number}` : 'New Invoice'}</h1>
                   <Badge variant={invoice.status === 'paid' ? 'default' : (invoice.status === 'void' ? 'destructive' : 'secondary')} className="capitalize px-3">
                       {invoice.status}
                   </Badge>
                </div>
            </div>
         </div>
         <div className="flex flex-wrap gap-2">
            {id && invoice.status !== 'paid' && invoice.status !== 'void' && (
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={() => { setPaymentAmount(balance.toFixed(2)); setIsPayModalOpen(true); }}>
                    <DollarSign className="w-4 h-4 mr-2" /> Record Payment
                </Button>
            )}
            {id && invoice.status !== 'void' && invoice.status !== 'paid' && (
                <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setIsVoidDialogOpen(true)}>
                    <Ban className="w-4 h-4 mr-2" /> Void
                </Button>
            )}
            {invoice.public_token && invoice.status !== 'void' && (
               <Button variant="outline" onClick={copyPaymentLink}>
                   <LinkIcon className="w-4 h-4 mr-2" /> Pay Link
               </Button>
            )}
            <Button variant="outline" onClick={() => handleSave()} disabled={loading || invoice.status === 'void'}>
                <Save className="w-4 h-4 mr-2" /> Save Draft
            </Button>
            <Button className="bg-blue-600" onClick={() => handleSave('sent')} disabled={loading || invoice.status === 'void' || invoice.status === 'paid'}>
                <Send className="w-4 h-4 mr-2" /> Save & Send
            </Button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Customer</Label>
                        <Select value={invoice.lead_id} onValueChange={v => setInvoice({...invoice, lead_id: v})} disabled={!!quoteIdParam}>
                            <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                            <SelectContent>
                                {leads.map(l => (
                                    <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name} {l.company ? `(${l.company})` : ''}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {quoteIdParam && <p className="text-xs text-slate-500">Locked to Quote Customer</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Issue Date</Label>
                          <Input type="date" value={invoice.issue_date} onChange={e => setInvoice({...invoice, issue_date: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input type="date" value={invoice.due_date} onChange={e => setInvoice({...invoice, due_date: e.target.value})} />
                      </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Items</CardTitle>
                    <Button size="sm" variant="outline" onClick={addItem} disabled={invoice.status === 'paid' || invoice.status === 'void'}><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Service</TableHead>
                                <TableHead className="w-[15%]">Qty</TableHead>
                                <TableHead className="w-[20%]">Price ($)</TableHead>
                                <TableHead className="w-[20%]">Total ($)</TableHead>
                                <TableHead className="w-[5%]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoice.items.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <Select 
                                              onValueChange={(val) => handlePriceBookSelect(idx, val)}
                                              disabled={invoice.status === 'paid' || invoice.status === 'void'}
                                            >
                                               <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                                   <SelectValue placeholder="Select from Price Book" />
                                               </SelectTrigger>
                                               <SelectContent>
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
                                                disabled={invoice.status === 'paid' || invoice.status === 'void'}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} disabled={invoice.status === 'paid' || invoice.status === 'void'} />
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Input type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} disabled={invoice.status === 'paid' || invoice.status === 'void'} />
                                    </TableCell>
                                    <TableCell className="align-top pt-6">
                                        <div className="pl-3 font-medium">${Number(item.total_price).toFixed(2)}</div>
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700" disabled={invoice.status === 'paid' || invoice.status === 'void'}>
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
                        <Label>Customer Notes</Label>
                        <Textarea value={invoice.notes} onChange={e => setInvoice({...invoice, notes: e.target.value})} disabled={invoice.status === 'paid' || invoice.status === 'void'} />
                    </div>
                    <div className="space-y-2">
                        <Label>Terms & Conditions</Label>
                        <Textarea value={invoice.terms} onChange={e => setInvoice({...invoice, terms: e.target.value})} disabled={invoice.status === 'paid' || invoice.status === 'void'} />
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
                    <div className="flex justify-between text-slate-300 items-center">
                        <span>Discount</span>
                        <Input 
                            type="number" 
                            className="w-24 h-8 bg-slate-800 border-slate-700 text-white text-right"
                            value={invoice.discount_amount}
                            onChange={(e) => setInvoice({...invoice, discount_amount: e.target.value})}
                            disabled={invoice.status === 'paid' || invoice.status === 'void'}
                        />
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between text-lg font-bold text-white">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                     <div className="flex justify-between text-slate-400 text-sm">
                        <span>Amount Paid</span>
                        <span className="text-green-400">-${(Number(invoice.amount_paid) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-blue-400 pt-2 border-t border-slate-700">
                        <span>Balance Due</span>
                        <span>${balance.toFixed(2)}</span>
                    </div>
                    {invoice.status === 'paid' && (
                        <div className="mt-4 bg-green-900/30 border border-green-800 text-green-400 p-3 rounded flex items-center gap-2 justify-center">
                            <CheckCircle className="w-5 h-5" /> Paid in Full
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
         <DialogContent>
             <DialogHeader>
                 <DialogTitle>Record Payment</DialogTitle>
             </DialogHeader>
             <div className="space-y-4 py-4">
                 <div className="space-y-2">
                     <Label>Amount ($)</Label>
                     <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                 </div>
                 <div className="space-y-2">
                     <Label className="text-slate-800 font-semibold">Payment Method <span className="text-red-500">*</span></Label>
                     <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                         <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select Method..." /></SelectTrigger>
                         <SelectContent>
                             <SelectItem value="card">Credit Card (External)</SelectItem>
                             <SelectItem value="cash">Cash</SelectItem>
                             <SelectItem value="check">Check</SelectItem>
                             <SelectItem value="ach">Bank Transfer</SelectItem>
                             <SelectItem value="financing">Financing</SelectItem>
                             <SelectItem value="zelle">Zelle / Venmo</SelectItem>
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="space-y-2">
                     <Label>Notes / Reference #</Label>
                     <Input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="e.g. Check #1234" />
                 </div>
             </div>
             <DialogFooter>
                 <Button variant="ghost" onClick={() => setIsPayModalOpen(false)}>Cancel</Button>
                 <Button onClick={handleRecordPayment} disabled={processingPayment || !paymentMethod}>
                     {processingPayment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Record Payment
                 </Button>
             </DialogFooter>
         </DialogContent>
      </Dialog>

      <AlertDialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
         <AlertDialogContent>
             <AlertDialogHeader>
                 <AlertDialogTitle>Void Invoice?</AlertDialogTitle>
                 <AlertDialogDescription>
                     Are you sure you want to void this invoice? This action cannot be undone.
                 </AlertDialogDescription>
             </AlertDialogHeader>
             <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                 Invoice #{invoice.invoice_number} will be marked as void and removed from active billing.
             </div>
             <div className="flex justify-end gap-3">
                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                 <AlertDialogAction onClick={handleVoid} className="bg-red-600 hover:bg-red-700">
                     Void Invoice
                 </AlertDialogAction>
             </div>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InvoiceBuilder;