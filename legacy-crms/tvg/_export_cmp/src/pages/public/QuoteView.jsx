import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, XCircle, FileText, Calendar, ArrowRight, Loader2, Clock, MapPin, User, Info } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function QuoteView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quote, setQuote] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  
  // 'same_visit' or 'schedule_later'
  const [fulfillmentMode, setFulfillmentMode] = useState('same_visit');

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const fetchQuote = async () => {
    // Basic UUID validation to prevent DB errors
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

    if (!isUUID) {
        if (id === '1') {
            // Serve Mock Data for Testing if ID is '1'
            setQuote({
                id: '1',
                quote_number: 'TEST-001',
                status: 'pending',
                leads: {
                    first_name: 'Test',
                    last_name: 'Customer',
                    email: 'test@example.com',
                    phone: '(555) 123-4567',
                    address: { address1: '123 Mock Lane', city: 'Test City', state: 'FL', zip: '32000' }
                },
                valid_until: new Date(Date.now() + 86400000 * 7).toISOString(),
                tax_rate: 0.07,
                fulfillment_mode: 'same_visit'
            });
            setItems([
                { description: 'Mock Service Item 1', quantity: 1, unit_price: 100, total_price: 100 },
                { description: 'Mock Service Item 2', quantity: 2, unit_price: 25, total_price: 50 }
            ]);
            setLoading(false);
            return;
        }

        // Invalid ID and not mock
        toast({ variant: "destructive", title: "Invalid Link", description: "The proposal link appears to be invalid." });
        setLoading(false);
        return;
    }

    try {
      const { data: quoteData, error } = await supabase
        .from('quotes')
        .select(`
            *,
            leads (first_name, last_name, email, phone, address:property_id(address1, city, state, zip))
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;

      const { data: itemsData } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', id);

      setQuote(quoteData);
      setItems(itemsData || []);
      
      // Default fulfillment mode based on context if possible, or fallback to database default
      if (quoteData.fulfillment_mode) {
          setFulfillmentMode(quoteData.fulfillment_mode);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Could not load proposal." });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    setApproving(true);
    try {
      // Mock handling for demo ID
      if (quote.id === '1') {
          setQuote(prev => ({ 
              ...prev, 
              status: action === 'approve' ? 'approved' : 'declined',
              accepted_at: action === 'approve' ? new Date().toISOString() : null,
              fulfillment_mode: fulfillmentMode
          }));
          toast({ title: action === 'approve' ? "Demo Proposal Accepted" : "Demo Proposal Declined", description: "This is a simulation." });
          setApprovalModalOpen(false);
          setApproving(false);
          return;
      }

      if (action === 'approve') {
          // 1. Update the quote status and fulfillment mode
          const { error } = await supabase
            .from('quotes')
            .update({ 
                status: 'approved', 
                accepted_at: new Date().toISOString(),
                fulfillment_mode: fulfillmentMode // Save the choice
            })
            .eq('id', id);

          if (error) throw error;
          
          toast({ 
              title: "Proposal Accepted!", 
              description: fulfillmentMode === 'same_visit' 
                ? "Work authorized. Technician notified to start." 
                : "Thank you. Our team will contact you to schedule.",
              className: "bg-green-50 border-green-200"
          });
          
          setApprovalModalOpen(false);
          fetchQuote(); // Refresh state

      } else if (action === 'decline') {
          const { error } = await supabase
            .from('quotes')
            .update({ 
                status: 'declined', 
                rejected_at: new Date().toISOString() 
            })
            .eq('id', id);
            
          if (error) throw error;
          toast({ title: "Proposal Declined", description: "We've recorded your response." });
          fetchQuote();
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setApproving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>;
  if (!quote) return <div className="min-h-screen flex items-center justify-center text-slate-500">Proposal not found or link expired.</div>;

  const isFinal = ['approved', 'declined', 'expired'].includes(quote.status);
  
  // Calculate total if not stored
  const calculatedSubtotal = items.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
  const tax = quote.tax_amount || (calculatedSubtotal * (quote.tax_rate || 0));
  const total = quote.total_amount || (calculatedSubtotal + tax);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-900/20">
                    VG
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">The Vent Guys</h1>
                    <p className="text-slate-500 text-sm">Proposal #{quote.quote_number || id.slice(0,6).toUpperCase()}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Badge variant={
                    quote.status === 'approved' ? 'success' : 
                    quote.status === 'declined' ? 'destructive' : 
                    'outline'
                } className={`text-base px-3 py-1 uppercase tracking-wider ${
                    quote.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                    quote.status === 'declined' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                    {quote.status.replace('_', ' ')}
                </Badge>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
                <Card className="shadow-md border-slate-200 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 pb-4">
                        <CardTitle className="text-xl">Service Proposal</CardTitle>
                        <CardDescription>Prepared for {quote.leads?.first_name} {quote.leads?.last_name}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Quote Header Text */}
                        {quote.header_text && (
                            <div className="p-6 text-slate-600 text-sm border-b border-slate-100 italic">
                                "{quote.header_text}"
                            </div>
                        )}

                        {/* Line Items */}
                        <div className="divide-y divide-slate-100">
                            {items.map((item, idx) => (
                                <div key={idx} className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-slate-900">{item.description}</div>
                                        <div className="text-xs text-slate-500">Qty: {item.quantity} × ${item.unit_price?.toFixed(2)}</div>
                                    </div>
                                    <div className="font-bold text-slate-900 font-mono">
                                        ${item.total_price?.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50 flex flex-col gap-3 p-6 border-t border-slate-200">
                         <div className="flex justify-between w-full text-sm text-slate-500">
                             <span>Subtotal</span>
                             <span>${calculatedSubtotal.toFixed(2)}</span>
                         </div>
                         <div className="flex justify-between w-full text-sm text-slate-500">
                             <span>Tax</span>
                             <span>${tax.toFixed(2)}</span>
                         </div>
                         <Separator />
                         <div className="flex justify-between w-full text-xl font-bold text-slate-900">
                             <span>Total</span>
                             <span>${total.toFixed(2)}</span>
                         </div>
                    </CardFooter>
                </Card>
                
                {quote.footer_text && (
                    <div className="text-xs text-slate-400 px-2">
                        {quote.footer_text}
                    </div>
                )}
            </div>

            {/* Sidebar / Actions */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Customer Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex items-start gap-3">
                            <User className="w-4 h-4 text-slate-400 mt-0.5" />
                            <div>
                                <div className="font-medium text-slate-900">{quote.leads?.first_name} {quote.leads?.last_name}</div>
                                <div className="text-slate-500">{quote.leads?.email}</div>
                                <div className="text-slate-500">{quote.leads?.phone}</div>
                            </div>
                        </div>
                        {quote.leads?.address && (
                            <div className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                                <div className="text-slate-500">
                                    {quote.leads?.address.address1}<br/>
                                    {quote.leads?.address.city}, {quote.leads?.address.state} {quote.leads?.address.zip}
                                </div>
                            </div>
                        )}
                        <Separator />
                        <div className="flex items-center gap-3 text-slate-500">
                            <Calendar className="w-4 h-4" />
                            <span>Valid until: {quote.valid_until ? format(new Date(quote.valid_until), 'MMM d, yyyy') : 'N/A'}</span>
                        </div>
                    </CardContent>
                </Card>

                {!isFinal && (
                    <Card className="border-blue-200 shadow-lg bg-blue-50/50">
                        <CardContent className="pt-6 space-y-4">
                            <div className="text-center space-y-2">
                                <h3 className="font-bold text-lg text-slate-900">Ready to proceed?</h3>
                                <p className="text-sm text-slate-600">Please review the details and approve to move forward.</p>
                            </div>
                            <div className="grid gap-3">
                                <Button 
                                    size="lg" 
                                    className="w-full bg-green-600 hover:bg-green-700 shadow-md transition-all font-bold text-base h-12"
                                    onClick={() => setApprovalModalOpen(true)}
                                    disabled={approving}
                                >
                                    {approving ? <Loader2 className="animate-spin mr-2"/> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                                    Approve Proposal
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                    onClick={() => handleAction('decline')}
                                    disabled={approving}
                                >
                                    <XCircle className="w-4 h-4 mr-2" /> Decline
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {quote.status === 'approved' && (
                    <Card className="bg-green-50 border-green-200">
                        <CardContent className="pt-6 flex flex-col items-center text-center space-y-3">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-green-800">Approved</h3>
                                <p className="text-sm text-green-700 mt-1">
                                    Approved on {format(new Date(quote.accepted_at), 'MMM d, yyyy')}
                                </p>
                                <p className="text-xs text-green-600 mt-2 font-medium bg-green-100 px-2 py-1 rounded inline-block">
                                    Action: {quote.fulfillment_mode === 'same_visit' ? 'Start Work Now' : 'Schedule Later'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
      </div>

      {/* Approval Modal */}
      <Dialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Authorize Work</DialogTitle>
                <DialogDescription>How would you like to proceed?</DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
                <RadioGroup value={fulfillmentMode} onValueChange={setFulfillmentMode} className="gap-4">
                    <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${fulfillmentMode === 'same_visit' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <RadioGroupItem value="same_visit" id="r1" className="mt-1" />
                        <div className="grid gap-1.5 cursor-pointer" onClick={() => setFulfillmentMode('same_visit')}>
                            <Label htmlFor="r1" className="font-bold text-slate-900 cursor-pointer">Approve & Start Now</Label>
                            <p className="text-sm text-slate-500">I am ready for the technician to begin this work immediately during the current visit.</p>
                        </div>
                    </div>
                    
                    <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${fulfillmentMode === 'schedule_later' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <RadioGroupItem value="schedule_later" id="r2" className="mt-1" />
                        <div className="grid gap-1.5 cursor-pointer" onClick={() => setFulfillmentMode('schedule_later')}>
                            <Label htmlFor="r2" className="font-bold text-slate-900 cursor-pointer">Approve for Later</Label>
                            <p className="text-sm text-slate-500">I accept the price, but let's schedule the service for a different day.</p>
                        </div>
                    </div>
                </RadioGroup>

                <div className="mt-6 p-3 bg-slate-50 text-xs text-slate-500 rounded flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    By clicking confirm, you authorize The Vent Guys to perform the services listed above according to the selected timeline.
                </div>
            </div>

            <DialogFooter className="sm:justify-between gap-2">
                <Button variant="ghost" onClick={() => setApprovalModalOpen(false)}>Cancel</Button>
                <Button onClick={() => handleAction('approve')} disabled={approving} className="bg-blue-600 hover:bg-blue-700">
                    {approving ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : null} Confirm Authorization
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}