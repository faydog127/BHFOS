import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, ExternalLink, Loader2, Mail, RefreshCcw } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/formUtils';

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const copyText = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      window.prompt('Copy link:', text);
      return true;
    } catch {
      return false;
    }
  }
};

const mailTo = ({ to, subject, body }) => {
  const url = new URL('mailto:');
  if (to) url.pathname = to;
  if (subject) url.searchParams.set('subject', subject);
  if (body) url.searchParams.set('body', body);
  return url.toString();
};

const MyMoney = () => {
  const { toast } = useToast();
  const { tenantId: tenantIdParam } = useParams();
  const tenantId = (tenantIdParam || 'tvg').toLowerCase();
  const { user, loading: authLoading } = useSupabaseAuth();

  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState(null);

  const [leads, setLeads] = useState([]);
  const [queue, setQueue] = useState([]);

  const [customer, setCustomer] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    service: ''
  });
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [quote, setQuote] = useState({ lead_id: '', description: '', quantity: 1, unit_price: 0 });
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [createdQuote, setCreatedQuote] = useState(null);

  const [invoice, setInvoice] = useState({ lead_id: '', description: '', quantity: 1, unit_price: 0 });
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState(null);

  const quoteLead = useMemo(() => leads.find((l) => l.id === quote.lead_id) || null, [leads, quote.lead_id]);
  const invoiceLead = useMemo(() => leads.find((l) => l.id === invoice.lead_id) || null, [leads, invoice.lead_id]);

  const quoteSubtotal = useMemo(() => {
    const qty = Math.max(1, safeNumber(quote.quantity, 1));
    const price = Math.max(0, safeNumber(quote.unit_price, 0));
    return qty * price;
  }, [quote.quantity, quote.unit_price]);

  const invoiceSubtotal = useMemo(() => {
    const qty = Math.max(1, safeNumber(invoice.quantity, 1));
    const price = Math.max(0, safeNumber(invoice.unit_price, 0));
    return qty * price;
  }, [invoice.quantity, invoice.unit_price]);

  useEffect(() => {
    try {
      localStorage.setItem('currentTenantId', tenantId);
    } catch {
      // ignore
    }
  }, [tenantId]);

  const loadLeads = async () => {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, company, email, phone, service, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('MoneyLoop: leads load failed', error);
      toast({ variant: 'destructive', title: 'Could not load customers', description: error.message });
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadQueue = async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const { data, error } = await supabase
        .from('now_queue')
        .select('priority, subpriority, item_type, entity_id, title, created_at, due_at')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true })
        .order('subpriority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      setQueue(data || []);
    } catch (error) {
      console.error('MoneyLoop: now_queue load failed', error);
      setQueueError(error);
      setQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  };

  const refresh = async () => {
    if (!user) return;
    await Promise.all([loadLeads(), loadQueue()]);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, user?.id]);

  const createCustomer = async () => {
    if (!customer.first_name || !customer.last_name) {
      toast({ variant: 'destructive', title: 'Missing name', description: 'First + last name required.' });
      return;
    }

    setCreatingCustomer(true);
    try {
      const payload = {
        tenant_id: tenantId,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email || null,
        phone: customer.phone || null,
        service: customer.service || null,
        status: 'new',
        stage: 'new'
      };

      const { data, error } = await supabase
        .from('leads')
        .insert([payload])
        .select('id, first_name, last_name, company, email, phone, service, created_at')
        .single();
      if (error) throw error;

      setLeads((prev) => [data, ...prev]);
      setQuote((p) => ({ ...p, lead_id: data.id }));
      setInvoice((p) => ({ ...p, lead_id: data.id }));
      setCustomer({ first_name: '', last_name: '', email: '', phone: '', service: '' });
      toast({ title: 'Customer added', description: `${data.first_name} ${data.last_name}` });
      await loadQueue();
    } catch (error) {
      console.error('MoneyLoop: create customer failed', error);
      toast({ variant: 'destructive', title: 'Could not create customer', description: error.message });
    } finally {
      setCreatingCustomer(false);
    }
  };

  const createQuote = async () => {
    if (!quote.lead_id) {
      toast({ variant: 'destructive', title: 'Pick a customer' });
      return;
    }
    if (!quote.description) {
      toast({ variant: 'destructive', title: 'Missing line item', description: 'Add a description.' });
      return;
    }

    setCreatingQuote(true);
    try {
      const qty = Math.max(1, safeNumber(quote.quantity, 1));
      const price = Math.max(0, safeNumber(quote.unit_price, 0));
      const subtotal = qty * price;

      const quotePayload = {
        tenant_id: tenantId,
        lead_id: quote.lead_id,
        status: 'sent',
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: subtotal,
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        header_text: 'Please review and approve to proceed.',
        footer_text: 'Thank you for your business.',
        sent_at: new Date().toISOString()
      };

      const { data: q, error: qErr } = await supabase
        .from('quotes')
        .insert([quotePayload])
        .select('id, public_token, quote_number, status, total_amount, created_at')
        .single();
      if (qErr) throw qErr;

      const { error: iErr } = await supabase.from('quote_items').insert([
        { quote_id: q.id, description: quote.description, quantity: qty, unit_price: price, total_price: subtotal }
      ]);
      if (iErr) throw iErr;

      setCreatedQuote(q);
      setQuote((p) => ({ ...p, description: '', quantity: 1, unit_price: 0 }));
      toast({ title: 'Quote created', description: 'Copy/share the link to send it.' });
      await loadQueue();
    } catch (error) {
      console.error('MoneyLoop: create quote failed', error);
      toast({ variant: 'destructive', title: 'Could not create quote', description: error.message });
    } finally {
      setCreatingQuote(false);
    }
  };

  const createInvoice = async () => {
    if (!invoice.lead_id) {
      toast({ variant: 'destructive', title: 'Pick a customer' });
      return;
    }
    if (!invoice.description) {
      toast({ variant: 'destructive', title: 'Missing line item', description: 'Add a description.' });
      return;
    }

    setCreatingInvoice(true);
    try {
      const qty = Math.max(1, safeNumber(invoice.quantity, 1));
      const price = Math.max(0, safeNumber(invoice.unit_price, 0));
      const subtotal = qty * price;
      const issueDate = new Date().toISOString().slice(0, 10);
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const invoicePayload = {
        tenant_id: tenantId,
        lead_id: invoice.lead_id,
        invoice_number: String(Math.floor(100000 + Math.random() * 900000)),
        status: 'sent',
        issue_date: issueDate,
        due_date: dueDate,
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: subtotal,
        amount_paid: 0,
        balance_due: subtotal,
        notes: 'Thank you for your business.',
        terms: 'Payment is due within 14 days.',
        sent_at: new Date().toISOString()
      };

      let inv = null;
      const attempt = await supabase
        .from('invoices')
        .insert([invoicePayload])
        .select('id, public_token, invoice_number, status, total_amount, created_at')
        .single();
      if (attempt.error) {
        const message = attempt.error?.message || '';
        if (message.toLowerCase().includes('balance_due')) {
          const { balance_due, ...payloadNoBalance } = invoicePayload;
          const retry = await supabase
            .from('invoices')
            .insert([payloadNoBalance])
            .select('id, public_token, invoice_number, status, total_amount, created_at')
            .single();
          if (retry.error) throw retry.error;
          inv = retry.data;
        } else {
          throw attempt.error;
        }
      } else {
        inv = attempt.data;
      }

      const { error: iErr } = await supabase.from('invoice_items').insert([
        { invoice_id: inv.id, description: invoice.description, quantity: qty, unit_price: price, total_price: subtotal }
      ]);
      if (iErr) throw iErr;

      setCreatedInvoice(inv);
      setInvoice((p) => ({ ...p, description: '', quantity: 1, unit_price: 0 }));
      toast({ title: 'Invoice created', description: 'Copy/share the payment link to send it.' });
      await loadQueue();
    } catch (error) {
      console.error('MoneyLoop: create invoice failed', error);
      toast({ variant: 'destructive', title: 'Could not create invoice', description: error.message });
    } finally {
      setCreatingInvoice(false);
    }
  };

  const quoteLink = createdQuote?.public_token ? `${window.location.origin}/quotes/${createdQuote.public_token}` : '';
  const payLink = createdInvoice?.public_token ? `${window.location.origin}/pay/${createdInvoice.public_token}` : '';
  const invoiceLink = createdInvoice?.public_token ? `${window.location.origin}/invoices/${createdInvoice.public_token}` : '';

  return (
    <>
      <Helmet>
        <title>Money Loop | {tenantId.toUpperCase()} CRM</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Money Loop</h1>
            <p className="text-slate-500">Operational PoC: add customer → quote → invoice.</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={!user || loadingLeads || loadingQueue}>
            {(loadingLeads || loadingQueue) ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {authLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : !user ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>Sign in to create customers, quotes, and invoices.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <a href={`/${tenantId}/login?next=/${tenantId}/crm/money`}>Go to login</a>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add customer</CardTitle>
                  <CardDescription>Creates a new lead (status/stage = new).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>First</Label>
                      <Input value={customer.first_name} onChange={(e) => setCustomer((p) => ({ ...p, first_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last</Label>
                      <Input value={customer.last_name} onChange={(e) => setCustomer((p) => ({ ...p, last_name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={customer.email} onChange={(e) => setCustomer((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={customer.phone}
                      onChange={(e) => setCustomer((p) => ({ ...p, phone: formatPhoneNumber(e.target.value) }))}
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Service (optional)</Label>
                    <Input value={customer.service} onChange={(e) => setCustomer((p) => ({ ...p, service: e.target.value }))} />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={createCustomer} disabled={creatingCustomer}>
                    {creatingCustomer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Create quote</CardTitle>
                  <CardDescription>Creates quote + 1 item (sent).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Customer</Label>
                    <Select value={quote.lead_id} onValueChange={(v) => setQuote((p) => ({ ...p, lead_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingLeads ? 'Loading...' : 'Select customer'} />
                      </SelectTrigger>
                      <SelectContent>
                        {leads.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.company || `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.email || l.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Line item</Label>
                    <Input value={quote.description} onChange={(e) => setQuote((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Qty</Label>
                      <Input type="number" min="1" value={quote.quantity} onChange={(e) => setQuote((p) => ({ ...p, quantity: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit</Label>
                      <Input type="number" min="0" step="0.01" value={quote.unit_price} onChange={(e) => setQuote((p) => ({ ...p, unit_price: e.target.value }))} />
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    Subtotal: <span className="font-semibold text-slate-900">${quoteSubtotal.toFixed(2)}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={createQuote} disabled={creatingQuote}>
                    {creatingQuote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Create invoice</CardTitle>
                  <CardDescription>Creates invoice + 1 item (sent).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Customer</Label>
                    <Select value={invoice.lead_id} onValueChange={(v) => setInvoice((p) => ({ ...p, lead_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingLeads ? 'Loading...' : 'Select customer'} />
                      </SelectTrigger>
                      <SelectContent>
                        {leads.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.company || `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.email || l.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Line item</Label>
                    <Input value={invoice.description} onChange={(e) => setInvoice((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Qty</Label>
                      <Input type="number" min="1" value={invoice.quantity} onChange={(e) => setInvoice((p) => ({ ...p, quantity: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit</Label>
                      <Input type="number" min="0" step="0.01" value={invoice.unit_price} onChange={(e) => setInvoice((p) => ({ ...p, unit_price: e.target.value }))} />
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    Subtotal: <span className="font-semibold text-slate-900">${invoiceSubtotal.toFixed(2)}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={createInvoice} disabled={creatingInvoice}>
                    {creatingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {(createdQuote || createdInvoice) && (
              <Card>
                <CardHeader>
                  <CardTitle>Share links</CardTitle>
                  <CardDescription>Copy/open/email the links below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {createdQuote && (
                    <div className="space-y-2">
                      <Label>Quote</Label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input readOnly value={quoteLink} />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={async () => {
                              const ok = await copyText(quoteLink);
                              if (ok) toast({ title: 'Copied', description: 'Quote link copied.' });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" disabled={!quoteLink} onClick={() => window.open(quoteLink, '_blank', 'noopener,noreferrer')}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" asChild disabled={!quoteLink || !quoteLead?.email}>
                            <a
                              href={mailTo({
                                to: quoteLead?.email,
                                subject: `Your quote from ${tenantId.toUpperCase()}`,
                                body: `Hi ${quoteLead?.first_name || ''},\n\nHere is your quote:\n${quoteLink}\n\nThank you,\n${tenantId.toUpperCase()}`
                              })}
                            >
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {createdInvoice && (
                    <div className="space-y-2">
                      <Label>Invoice payment link</Label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input readOnly value={payLink} />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={async () => {
                              const ok = await copyText(payLink);
                              if (ok) toast({ title: 'Copied', description: 'Payment link copied.' });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" disabled={!payLink} onClick={() => window.open(payLink, '_blank', 'noopener,noreferrer')}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" asChild disabled={!payLink || !invoiceLead?.email}>
                            <a
                              href={mailTo({
                                to: invoiceLead?.email,
                                subject: `Your invoice from ${tenantId.toUpperCase()}`,
                                body: `Hi ${invoiceLead?.first_name || ''},\n\nYou can view & pay your invoice here:\n${payLink}\n\nThank you,\n${tenantId.toUpperCase()}`
                              })}
                            >
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                      {invoiceLink ? (
                        <a className="text-xs text-blue-600 hover:underline" href={invoiceLink} target="_blank" rel="noreferrer">
                          View public invoice page
                        </a>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Now Queue</CardTitle>
                <CardDescription>Top items needing attention.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingQueue ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : queueError ? (
                  <div className="text-sm text-slate-600">{queueError.message || 'Queue unavailable.'}</div>
                ) : queue.length === 0 ? (
                  <div className="text-sm text-slate-500">No items in the queue.</div>
                ) : (
                  <ul className="space-y-2">
                    {queue.map((item) => (
                      <li key={`${item.item_type}:${item.entity_id}`} className="flex items-start justify-between gap-3 rounded border bg-white p-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-500 capitalize">
                            {item.item_type} • priority {item.priority}.{item.subpriority}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
};

export default MyMoney;
