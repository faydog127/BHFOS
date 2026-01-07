import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Download, Printer, CreditCard, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { paymentService } from '@/services/paymentService'; // Uses explicit FKs internally

const InvoiceView = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      // We can use the paymentService here or direct query. 
      // Direct query to demonstrate explicit FK usage again for robustness.
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          items:invoice_items(*),
          lead:leads!fk_invoices_lead(*),
          property:properties!fk_invoices_property(*),
          account:accounts!fk_invoices_account(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setInvoice(data);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast({
        title: 'Invoice not found',
        description: 'Could not load the requested invoice.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Invoice Not Found</h1>
        <p className="text-gray-500">The invoice you are looking for does not exist or has been deleted.</p>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid' || invoice.balance_due <= 0;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center print:hidden">
          <Button variant="outline" onClick={() => window.history.back()}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            {!isPaid && (
              <Button onClick={() => window.location.href = `/pay/${invoice.public_token || ''}`}>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay Now
              </Button>
            )}
          </div>
        </div>

        {/* Invoice Card */}
        <Card className="bg-white shadow-lg print:shadow-none print:border-none">
          <CardHeader className="flex flex-row justify-between items-start border-b pb-8">
            <div className="flex flex-col gap-1">
               {/* Logo Placeholder */}
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                 <span className="text-white font-bold text-xl">TVG</span>
              </div>
              <h1 className="text-2xl font-bold">INVOICE</h1>
              <p className="text-gray-500">#{invoice.invoice_number}</p>
              {isPaid && (
                <Badge className="w-fit mt-2 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                  <CheckCircle className="w-3 h-3 mr-1" /> PAID
                </Badge>
              )}
            </div>
            <div className="text-right">
              <h3 className="font-semibold text-lg">The Vent Guys</h3>
              <p className="text-sm text-gray-500">123 Clean Air Way</p>
              <p className="text-sm text-gray-500">Melbourne, FL 32935</p>
              <p className="text-sm text-gray-500">billing@theventguys.com</p>
            </div>
          </CardHeader>
          
          <CardContent className="pt-8 space-y-8">
            {/* Bill To / Ship To */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill To</h3>
                <p className="font-medium text-gray-900">
                  {invoice.lead?.company || `${invoice.lead?.first_name || ''} ${invoice.lead?.last_name || ''}`}
                </p>
                <p className="text-gray-600 text-sm whitespace-pre-line">
                  {invoice.lead?.phone}<br/>
                  {invoice.lead?.email}
                </p>
                {invoice.account && (
                   <p className="text-xs text-gray-400 mt-1">Account: {invoice.account.name}</p>
                )}
              </div>
              <div className="text-right">
                <div className="space-y-1">
                  <div className="flex justify-between md:justify-end gap-8">
                    <span className="text-gray-500">Issue Date:</span>
                    <span className="font-medium">{invoice.issue_date || new Date(invoice.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between md:justify-end gap-8">
                    <span className="text-gray-500">Due Date:</span>
                    <span className="font-medium">{invoice.due_date || 'Upon Receipt'}</span>
                  </div>
                  {invoice.property && (
                    <div className="mt-4 text-right">
                       <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Service Location</h3>
                       <p className="text-sm text-gray-700">{invoice.property.address1}</p>
                       <p className="text-sm text-gray-700">{invoice.property.city}, {invoice.property.state} {invoice.property.zip}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="mt-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm">
                    <th className="text-left py-3 font-semibold text-gray-500">Description</th>
                    <th className="text-right py-3 font-semibold text-gray-500">Qty</th>
                    <th className="text-right py-3 font-semibold text-gray-500">Price</th>
                    <th className="text-right py-3 font-semibold text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-4 text-gray-900">{item.description}</td>
                      <td className="py-4 text-right text-gray-600">{item.quantity}</td>
                      <td className="py-4 text-right text-gray-600">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-4 text-right font-medium text-gray-900">${Number(item.total_price).toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!invoice.items || invoice.items.length === 0) && (
                     <tr><td colSpan={4} className="py-4 text-center text-gray-400 italic">No items listed</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end pt-4">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${Number(invoice.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({invoice.tax_rate || 0}%)</span>
                  <span>${Number(invoice.tax_amount || 0).toFixed(2)}</span>
                </div>
                {Number(invoice.discount_amount) > 0 && (
                   <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-${Number(invoice.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>${Number(invoice.total_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Amount Paid</span>
                  <span>${Number(invoice.amount_paid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-primary bg-gray-50 p-2 rounded">
                  <span>Balance Due</span>
                  <span>${Number(invoice.balance_due || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {(invoice.notes || invoice.terms) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t">
                {invoice.notes && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900 mb-1">Notes</h4>
                    <p className="text-sm text-gray-600">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900 mb-1">Terms & Conditions</h4>
                    <p className="text-sm text-gray-600">{invoice.terms}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          
          <CardFooter className="bg-gray-50 text-center py-6 border-t rounded-b-lg">
            <p className="w-full text-sm text-gray-500">
              Thank you for your business! If you have any questions, please contact us at 555-0123.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default InvoiceView;