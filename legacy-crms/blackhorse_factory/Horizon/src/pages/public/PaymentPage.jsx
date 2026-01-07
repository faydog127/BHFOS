import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Lock, CreditCard, Banknote, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const PaymentPage = () => {
  const { token } = useParams();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardDetails, setCardDetails] = useState({ number: '', exp: '', cvc: '', name: '' });

  useEffect(() => {
    fetchInvoice();
  }, [token]);

  const fetchInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items (*),
          leads (first_name, last_name, company, email, phone)
        `)
        .eq('public_token', token)
        .single();

      if (error) throw error;
      setInvoice(data);
    } catch (error) {
      console.error('Invoice fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setPaying(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const { data, error } = await supabase.rpc('process_public_payment', {
        p_token: token,
        p_amount: invoice.balance_due,
        p_method: paymentMethod
      });

      if (error) throw error;
      
      setPaymentSuccess(true);
      toast({ title: "Payment Successful", description: "Thank you for your payment!", className: "bg-green-50 border-green-200" });

    } catch (error) {
      console.error("Payment error:", error);
      toast({ variant: "destructive", title: "Payment Failed", description: "Please try again or contact support." });
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!invoice) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-slate-500">Invoice not found or expired.</div>;

  if (paymentSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
         <Card className="w-full max-w-md text-center p-8 space-y-4 shadow-lg border-green-100">
             <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                 <CheckCircle className="w-10 h-10 text-green-600" />
             </div>
             <h2 className="text-2xl font-bold text-slate-900">Payment Successful!</h2>
             <p className="text-slate-600">
                You have successfully paid <strong>${Number(invoice.balance_due).toFixed(2)}</strong>.
             </p>
             <p className="text-sm text-slate-500">A receipt has been emailed to {invoice.leads?.email}.</p>
             <Button variant="outline" className="mt-4" onClick={() => window.print()}>Print Receipt</Button>
         </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      {/* 
         Mobile-First Layout: 
         - Flex column for mobile (Payment Form first via order-1, Summary second via order-2)
         - Grid for Desktop (Summary Left via order-1, Payment Form Right via order-2)
      */}
      <div className="max-w-4xl mx-auto flex flex-col md:grid md:grid-cols-2 gap-8">
        
        {/* Invoice Summary (Bottom on Mobile, Left on Desktop) */}
        <div className="space-y-6 order-2 md:order-1">
           <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                  <ShieldCheck className="text-white w-6 h-6" />
              </div>
              <div className="min-w-0">
                  <h1 className="text-xl font-bold text-slate-900 truncate">Black Horse CRM</h1>
                  <p className="text-xs text-slate-500 flex flex-wrap gap-x-2">
                     <span>Licensed & Insured</span>
                     <span>•</span>
                     <span>CAC1812345</span>
                  </p>
              </div>
           </div>

           <Card>
               <CardHeader className="pb-4">
                   <CardTitle className="flex justify-between items-start">
                       <span className="text-lg">Invoice #{invoice.invoice_number}</span>
                       <span className="text-sm font-normal text-slate-500">{format(new Date(invoice.issue_date), 'MMM d, yyyy')}</span>
                   </CardTitle>
                   <CardDescription className="mt-1">
                       Billed to: <span className="font-medium text-slate-900 block sm:inline">{invoice.leads?.first_name} {invoice.leads?.last_name}</span>
                   </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                   <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                       {invoice.invoice_items.map((item, i) => (
                           <div key={i} className="py-3 flex justify-between text-sm">
                               <div className="pr-4">
                                   <div className="font-medium text-slate-800">{item.description}</div>
                                   <div className="text-slate-500 text-xs">Qty: {item.quantity}</div>
                               </div>
                               <div className="font-medium whitespace-nowrap">${Number(item.total_price).toFixed(2)}</div>
                           </div>
                       ))}
                   </div>
                   <Separator />
                   <div className="space-y-2 pt-2 text-sm">
                       <div className="flex justify-between text-slate-500">
                           <span>Subtotal</span>
                           <span>${Number(invoice.subtotal).toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between text-slate-500">
                           <span>Tax</span>
                           <span>${Number(invoice.tax_amount).toFixed(2)}</span>
                       </div>
                       {invoice.amount_paid > 0 && (
                           <div className="flex justify-between text-green-600">
                               <span>Paid</span>
                               <span>-${Number(invoice.amount_paid).toFixed(2)}</span>
                           </div>
                       )}
                       <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t mt-2">
                           <span>Total Due</span>
                           <span>${Number(invoice.balance_due).toFixed(2)}</span>
                       </div>
                   </div>
               </CardContent>
           </Card>

           <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pb-8 md:pb-0">
               <Lock className="w-3 h-3" /> Secure SSL Payment Processing
           </div>
        </div>

        {/* Payment Form (Top on Mobile, Right on Desktop) */}
        <div className="order-1 md:order-2">
            <Card className="border-blue-100 shadow-md sticky top-6">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Payment Details</CardTitle>
                    <CardDescription>Select a payment method to proceed.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePayment} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div 
                                onClick={() => setPaymentMethod('card')}
                                className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'card' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}
                            >
                                <CreditCard className="w-6 h-6" />
                                <span className="text-sm font-medium">Card</span>
                            </div>
                            <div 
                                onClick={() => setPaymentMethod('ach')}
                                className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'ach' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}
                            >
                                <Banknote className="w-6 h-6" />
                                <span className="text-sm font-medium text-center">Bank / ACH</span>
                            </div>
                        </div>

                        {paymentMethod === 'card' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label>Cardholder Name</Label>
                                    <Input placeholder="John Doe" required value={cardDetails.name} onChange={e => setCardDetails({...cardDetails, name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Card Number</Label>
                                    <Input placeholder="0000 0000 0000 0000" type="tel" inputMode="numeric" required value={cardDetails.number} onChange={e => setCardDetails({...cardDetails, number: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Expiration</Label>
                                        <Input placeholder="MM/YY" type="tel" inputMode="numeric" required value={cardDetails.exp} onChange={e => setCardDetails({...cardDetails, exp: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>CVC</Label>
                                        <Input placeholder="123" type="tel" inputMode="numeric" required value={cardDetails.cvc} onChange={e => setCardDetails({...cardDetails, cvc: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {paymentMethod === 'ach' && (
                            <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-lg animate-in fade-in slide-in-from-top-2">
                                Bank ACH connection is currently in sandbox mode. Please use Card for immediate testing.
                            </div>
                        )}

                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold shadow-sm" disabled={paying || invoice.balance_due <= 0}>
                            {paying ? <Loader2 className="animate-spin w-5 h-5" /> : `Pay $${Number(invoice.balance_due).toFixed(2)}`}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t p-4 text-xs text-center text-slate-500">
                    By confirming this payment, you agree to our Terms of Service.
                </CardFooter>
            </Card>
        </div>

      </div>
    </div>
  );
};

export default PaymentPage;