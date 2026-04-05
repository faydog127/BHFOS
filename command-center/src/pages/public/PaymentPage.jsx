import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { fetchPublicInvoiceByToken, getPublicTenantContext } from '@/lib/publicDocumentApi';

const GOOGLE_REVIEW_URL = import.meta.env.VITE_GOOGLE_REVIEW_URL || 'https://g.page/r/CQLGsjITxWS6EBM/review';
const COMPANY_NAME = 'The Vent Guys';
const COMPANY_LICENSE = 'CAC1812345';

const PaymentPage = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const autoRedirectStartedRef = useRef(false);
  const checkoutState = searchParams.get('checkout');

  const isInvoicePaid = (invoiceRow) =>
    String(invoiceRow?.status || '').toLowerCase() === 'paid' ||
    Number(invoiceRow?.amount_paid || 0) > 0 ||
    Number(invoiceRow?.balance_due ?? Number.POSITIVE_INFINITY) <= 0;

  const getReceiptAmount = (invoiceRow) =>
    Number(invoiceRow?.amount_paid || invoiceRow?.total_amount || invoiceRow?.balance_due || 0);

  const fetchInvoice = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const publicInvoice = await fetchPublicInvoiceByToken(token);
      setInvoice(publicInvoice);
      setPaymentSuccess(isInvoicePaid(publicInvoice));
      setPaymentError('');
      return publicInvoice;
    } catch (error) {
      console.error('Invoice fetch error:', error);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const startCheckout = async ({ suppressRedirectToast = false } = {}) => {
    if (!invoice || paying) return;

    setPaying(true);
    setPaymentError('');

    try {
      const { supabaseUrl, anonKey } = getPublicTenantContext();

      const res = await fetch(`${supabaseUrl}/functions/v1/public-pay`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          amount: invoice.balance_due,
          method: 'card',
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        if (payload?.blocked) {
          const message = payload.error || 'Payment is temporarily unavailable.';
          setPaymentError(message);
          toast({ variant: 'destructive', title: 'Payment Blocked', description: message });
          return;
        }
        throw new Error(payload?.error || 'Unable to start secure checkout.');
      }

      if (payload?.already_paid) {
        await fetchInvoice({ silent: true });
        return;
      }

      if (payload?.checkout_url) {
        if (!suppressRedirectToast) {
          toast({ title: 'Redirecting to Stripe', description: 'Opening secure checkout...' });
        }
        window.location.assign(payload.checkout_url);
        return;
      }

      throw new Error('Checkout URL unavailable.');
    } catch (error) {
      console.error('Payment error:', error);
      const message = error instanceof Error ? error.message : 'Unable to start secure checkout.';
      setPaymentError(message);
      toast({ variant: 'destructive', title: 'Payment Failed', description: message });
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    autoRedirectStartedRef.current = false;
    void fetchInvoice();
  }, [token, checkoutState]);

  useEffect(() => {
    if (loading || !invoice || paymentSuccess || checkoutState || autoRedirectStartedRef.current) {
      return;
    }

    autoRedirectStartedRef.current = true;
    void startCheckout({ suppressRedirectToast: true });
  }, [checkoutState, invoice, loading, paymentSuccess]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Invoice not found or expired.
      </div>
    );
  }

  if (paymentSuccess) {
    const receiptEmail = invoice.customer_email || invoice.leads?.email || 'your inbox';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center p-8 space-y-4 shadow-lg border-green-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Payment Successful!</h2>
          <p className="text-slate-600">
            You have successfully paid <strong>${getReceiptAmount(invoice).toFixed(2)}</strong>.
          </p>
          <p className="text-sm text-slate-500">
            A receipt has been emailed to {receiptEmail}.
          </p>
          <p className="text-sm text-slate-600">
            If we took good care of you, we would appreciate a quick Google review.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={() => window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer')}>
              Leave a Review
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              Print Receipt
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const amountDue = Number(invoice.balance_due || 0).toFixed(2);
  const invoiceItems = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : [];
  const billToName =
    invoice.customer_name ||
    invoice.leads?.company ||
    `${invoice.leads?.first_name || ''} ${invoice.leads?.last_name || ''}`.trim() ||
    'Customer';
  const showCancelledState = checkoutState === 'cancelled';
  const showPendingState = checkoutState === 'success' && !paymentSuccess;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto flex flex-col md:grid md:grid-cols-2 gap-8">
        <div className="space-y-6 order-2 md:order-1">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">{COMPANY_NAME}</h1>
              <p className="text-xs text-slate-500 flex flex-wrap gap-x-2">
                <span>Licensed &amp; Insured</span>
                <span>•</span>
                <span>{COMPANY_LICENSE}</span>
              </p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex justify-between items-start">
                <span className="text-lg">Invoice #{invoice.invoice_number}</span>
                <span className="text-sm font-normal text-slate-500">
                  {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                </span>
              </CardTitle>
              <CardDescription className="mt-1">
                Billed to:{' '}
                <span className="font-medium text-slate-900 block sm:inline">
                  {billToName}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                {invoiceItems.map((item, index) => (
                  <div key={index} className="py-3 flex justify-between text-sm">
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
                {Number(invoice.tax_amount || 0) > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Tax</span>
                    <span>${Number(invoice.tax_amount).toFixed(2)}</span>
                  </div>
                )}
                {Number(invoice.amount_paid) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Paid</span>
                    <span>-${Number(invoice.amount_paid).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t mt-2">
                  <span>Total Due</span>
                  <span>${amountDue}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pb-8 md:pb-0">
            <Lock className="w-3 h-3" /> Secure SSL Payment Processing
          </div>
        </div>

        <div className="order-1 md:order-2">
          <Card className="border-blue-100 shadow-md sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Secure Checkout</CardTitle>
              <CardDescription>
                {showCancelledState
                  ? 'Your previous checkout was canceled. Use the button below to return to secure payment.'
                  : showPendingState
                    ? 'We are waiting for payment confirmation from Stripe.'
                    : 'Use the button below and we will take you directly to The Vent Guys secure Stripe checkout.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {showCancelledState && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>Your payment was not completed. You can resume checkout below.</div>
                </div>
              )}

              {showPendingState && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 flex gap-3">
                  <Loader2 className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
                  <div>
                    Stripe reported a successful checkout redirect. If this page does not update within a few seconds,
                    refresh the payment status.
                  </div>
                </div>
              )}

              {paymentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {paymentError}
                </div>
              )}

              {showPendingState ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base font-semibold"
                  onClick={() => void fetchInvoice({ silent: true })}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Payment Status
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base font-bold shadow-sm"
                  onClick={() => void startCheckout()}
                  disabled={paying || Number(invoice.balance_due) <= 0}
                >
                  {paying ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5 mr-2" />
                      Redirecting to Secure Checkout...
                    </>
                  ) : (
                    <>
                      Pay ${amountDue}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </CardContent>
            <CardFooter className="bg-slate-50 border-t p-4 text-xs text-center text-slate-500">
              Card payments are processed securely by Stripe for {COMPANY_NAME}.
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
