import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Download, Printer, CreditCard, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { fetchPublicInvoiceByToken, fetchPublicInvoicePdfByToken } from '@/lib/publicDocumentApi';

const InvoiceView = () => {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoice();
  }, [token]);

  const fetchInvoice = async () => {
    try {
      const data = await fetchPublicInvoiceByToken(token);
      const lead = Array.isArray(data?.leads) ? data.leads[0] : data?.leads || data?.lead || null;
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.invoice_items) ? data.invoice_items : [];

      setInvoice({
        ...data,
        lead,
        items,
      });
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

  const downloadFromBase64 = (payload, fallbackName) => {
    const raw = String(payload?.content_base64 || payload?.content || '').trim();
    if (!raw) throw new Error('PDF was not returned.');

    // Normalize URL-safe base64 variants and ensure padding.
    let base64 = raw.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const blob = new Blob([bytes], { type: payload?.content_type || payload?.contentType || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = payload?.filename || fallbackName || 'invoice.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser time to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const handleDownloadPdf = async () => {
    try {
      const payload = await fetchPublicInvoicePdfByToken(token, { pdf_renderer: 'html' });
      if (payload?.error) throw new Error(payload.error);
      if (!payload?.pdf) throw new Error('PDF response was empty.');
      downloadFromBase64(payload.pdf, `invoice-${invoice?.invoice_number || token}.pdf`);
    } catch (error) {
      console.error('Invoice PDF download failed:', error);
      toast({
        title: 'Download failed',
        description: error?.message || 'Could not download invoice PDF.',
        variant: 'destructive',
      });
    }
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
  const serviceLocation = invoice.service_address || '';
  const billToName =
    invoice.customer_name ||
    invoice.lead?.company ||
    `${invoice.lead?.first_name || ''} ${invoice.lead?.last_name || ''}`.trim() ||
    'Customer';
  const billToEmail = invoice.customer_email || invoice.lead?.email || '';
  const billToPhone = invoice.customer_phone || invoice.lead?.phone || '';

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 sm:px-6 print:min-h-0 print:bg-white print:py-0 print:px-0">
      <style>{'@page { size: Letter; margin: 0.45in; }'}</style>
      <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:mx-0 print:space-y-0">
        
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
            <Button variant="outline" onClick={handleDownloadPdf}>
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
        <Card className="bg-white shadow-lg print:shadow-none print:border-none print:rounded-none">
          <CardHeader className="flex flex-row justify-between items-start border-b pb-8 print:pb-4 print:pt-4">
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
              <p className="text-sm text-gray-500">2987 Finsterwald Dr</p>
              <p className="text-sm text-gray-500">Titusville, FL 32780</p>
              <p className="text-sm text-gray-500">admin@vent-guys.com</p>
              <p className="text-sm text-gray-500">(321) 360-9704</p>
            </div>
          </CardHeader>
          
          <CardContent className="pt-8 space-y-8 print:pt-4 print:space-y-4">
            {/* Bill To / Ship To */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill To</h3>
                <p className="font-medium text-gray-900">{billToName}</p>
                <p className="text-gray-600 text-sm whitespace-pre-line">
                  {billToPhone}<br/>
                  {billToEmail}
                </p>
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
                  {serviceLocation && (
                     <div className="mt-4 text-right">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Service Location</h3>
                        <p className="text-sm text-gray-700">{serviceLocation}</p>
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
                {Number(invoice.tax_amount || 0) > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax ({invoice.tax_rate || 0}%)</span>
                    <span>${Number(invoice.tax_amount || 0).toFixed(2)}</span>
                  </div>
                )}
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
          
          <CardFooter className="bg-gray-50 text-center py-6 border-t rounded-b-lg print:py-3 print:bg-white">
            <p className="w-full text-sm text-gray-500">
              Thank you for your business. Questions: admin@vent-guys.com | (321) 360-9704
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default InvoiceView;
