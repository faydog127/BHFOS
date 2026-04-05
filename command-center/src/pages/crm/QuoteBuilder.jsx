import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Save, Send, Loader2, ArrowLeft } from 'lucide-react';
import { addDays, format } from 'date-fns';
import {
    getQuoteRevisionMode,
    getQuoteRevisionNotice,
    isReleasedQuoteStatus,
    requiresSupersedeBeforeRevision,
} from '@/lib/documentSystem/releaseControl';
import { clearBuilderDraft, loadBuilderDraft, saveBuilderDraft } from '@/lib/builderDrafts';

const generateQuoteNumber = () =>
    Number(`${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`);
const QUOTE_BUILDER_DRAFT_KEY = 'quote_builder';

const hasMeaningfulQuoteDraft = ({ leadId, validUntil, headerText, footerText, items, customerName, customerEmail, customerPhone }) =>
    Boolean(
        String(leadId || '').trim() ||
        String(validUntil || '').trim() ||
        String(customerName || '').trim() ||
        String(customerEmail || '').trim() ||
        String(customerPhone || '').trim() ||
        String(headerText || '').trim() ||
        String(footerText || '').trim() ||
        (Array.isArray(items) && items.some((item) =>
            String(item?.description || '').trim() ||
            Number(item?.unit_price || 0) > 0 ||
            Number(item?.total_price || 0) > 0 ||
            Number(item?.quantity || 1) !== 1
        ))
    );

const QuoteBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [leads, setLeads] = useState([]);
    const [services, setServices] = useState([]);
    const [settings, setSettings] = useState(null);
    const [quoteStatus, setQuoteStatus] = useState('draft');
    const [quoteNumber, setQuoteNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const restoredDraftRef = useRef(false);
    const draftReadyRef = useRef(false);
    const tenantId = getTenantId();

    // Form State
    const [leadId, setLeadId] = useState('');
    const [validUntil, setValidUntil] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    const [headerText, setHeaderText] = useState('Thank you for your business. Please review the quote below.');
    const [footerText, setFooterText] = useState('Payment is due upon completion of service.');
    const [items, setItems] = useState([
        { description: 'Service Item', quantity: 1, unit_price: 0, total_price: 0 }
    ]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                // Fetch Settings (Global/Tenant) - assuming business_settings is shared or updated with RLS (not strictly modified in this turn but good practice)
                const { data: settingsData } = await supabase.from('business_settings').select('*').single();
                setSettings(settingsData);
                
                // Fetch Leads
                const { data: leadsData } = await supabase.from('leads').select('id, first_name, last_name, email').eq('tenant_id', tenantId).order('created_at', { ascending: false });
                setLeads(leadsData || []);

                // Fetch Services
                const { data: servicesData } = await supabase
                    .from('price_book')
                    .select('*')
                    .eq('active', true)
                    .in('tenant_id', [tenantId || 'default', 'default']);

                if (servicesData) {
                    const sorted = [...servicesData].sort((a, b) => {
                        const aRank = a.tenant_id === tenantId ? 0 : 1;
                        const bRank = b.tenant_id === tenantId ? 0 : 1;
                        if (aRank !== bRank) return aRank - bRank;
                        return (a.name || '').localeCompare(b.name || '');
                    });

                    const deduped = [];
                    const seenCodes = new Set();
                    for (const row of sorted) {
                        const key = row.code || row.id;
                        if (seenCodes.has(key)) continue;
                        seenCodes.add(key);
                        deduped.push(row);
                    }
                    setServices(deduped);
                } else {
                    setServices([]);
                }

                // If Editing, Load Quote
                if (id) {
                    const { data: quote, error } = await supabase
                        .from('quotes')
                        .select(`*, quote_items(*)`)
                        .eq('id', id)
                        .eq('tenant_id', tenantId)
                        .maybeSingle();
                    if (error) throw error;
                    if (!quote) {
                        toast({ variant: 'destructive', title: 'Not Found', description: 'Quote not found.' });
                        return;
                    }
                    
                    setLeadId(quote.lead_id);
                    setQuoteStatus(String(quote.status || 'draft').toLowerCase());
                    setQuoteNumber(String(quote.quote_number || ''));
                    setCustomerName(quote.customer_name || '');
                    setCustomerEmail(quote.customer_email || '');
                    setCustomerPhone(quote.customer_phone || '');
                    setValidUntil(quote.valid_until);
                    setHeaderText(quote.header_text || '');
                    setFooterText(quote.footer_text || '');
                    setItems((quote.quote_items || []).map(i => ({
                        description: i.description,
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                        total_price: i.total_price
                    })));
                }

            } catch (err) {
                console.error(err);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load builder data.' });
            } finally {
                draftReadyRef.current = true;
                setLoading(false);
            }
        };
        init();
    }, [id]);

    useEffect(() => {
        restoredDraftRef.current = false;
        draftReadyRef.current = false;
    }, [id, tenantId]);

    useEffect(() => {
        if (!draftReadyRef.current || loading || !tenantId || restoredDraftRef.current) return;

        const storedDraft = loadBuilderDraft(QUOTE_BUILDER_DRAFT_KEY, tenantId, id || 'new');
        if (!storedDraft) {
            restoredDraftRef.current = true;
            return;
        }

        restoredDraftRef.current = true;
        setLeadId(storedDraft.leadId || '');
        setQuoteStatus(storedDraft.quoteStatus || 'draft');
        setQuoteNumber(storedDraft.quoteNumber || '');
        setCustomerName(storedDraft.customerName || '');
        setCustomerEmail(storedDraft.customerEmail || '');
        setCustomerPhone(storedDraft.customerPhone || '');
        setValidUntil(storedDraft.validUntil || format(addDays(new Date(), 30), 'yyyy-MM-dd'));
        setHeaderText(storedDraft.headerText || '');
        setFooterText(storedDraft.footerText || '');
        setItems(Array.isArray(storedDraft.items) && storedDraft.items.length > 0
            ? storedDraft.items
            : [{ description: 'Service Item', quantity: 1, unit_price: 0, total_price: 0 }]);

        toast({
            title: 'Draft restored',
            description: 'Your in-progress quote was restored after leaving the page.',
        });
    }, [id, loading, tenantId, toast]);

    useEffect(() => {
        if (!draftReadyRef.current || loading || !tenantId) return;

        const draftPayload = {
            leadId,
            quoteStatus,
            quoteNumber,
            customerName,
            customerEmail,
            customerPhone,
            validUntil,
            headerText,
            footerText,
            items,
        };

        if (!hasMeaningfulQuoteDraft(draftPayload)) {
            clearBuilderDraft(QUOTE_BUILDER_DRAFT_KEY, tenantId, id || 'new');
            return;
        }

        saveBuilderDraft(QUOTE_BUILDER_DRAFT_KEY, tenantId, id || 'new', draftPayload);
    }, [
        customerEmail,
        customerName,
        customerPhone,
        footerText,
        headerText,
        id,
        items,
        leadId,
        loading,
        quoteNumber,
        quoteStatus,
        tenantId,
        validUntil,
    ]);

    useEffect(() => {
        if (!hasMeaningfulQuoteDraft({ leadId, validUntil, headerText, footerText, items, customerName, customerEmail, customerPhone })) {
            return undefined;
        }

        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [customerEmail, customerName, customerPhone, footerText, headerText, items, leadId, validUntil]);

    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
    const taxRate = 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        
        if (field === 'quantity' || field === 'unit_price') {
            const qty = parseFloat(newItems[index].quantity) || 0;
            const price = parseFloat(newItems[index].unit_price) || 0;
            newItems[index].total_price = qty * price;
        }
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const addServiceItem = (serviceId) => {
        const service = services.find(s => s.id === serviceId);
        if (!service) return;
        
        const price = parseFloat(service.base_price) || 0;
        setItems([...items, {
            description: service.name,
            quantity: 1,
            unit_price: price,
            total_price: price
        }]);
    };

    const handleSave = async (status = 'draft') => {
        if (!leadId) {
            toast({ variant: 'destructive', title: 'Missing Lead', description: 'Please select a customer.' });
            return;
        }

        setLoading(true);
        try {
            const normalizedQuoteStatus = String(quoteStatus || 'draft').toLowerCase();
            const isReleasedEdit = Boolean(id) && isReleasedQuoteStatus(normalizedQuoteStatus);
            const nextQuoteNumber = isReleasedEdit ? String(generateQuoteNumber()) : (quoteNumber || String(generateQuoteNumber()));
            const quoteData = {
                lead_id: leadId,
                status: status === 'sent' ? 'draft' : status,
                customer_name: customerName || null,
                customer_email: customerEmail || null,
                customer_phone: customerPhone || null,
                subtotal,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                total_amount: total,
                valid_until: validUntil,
                header_text: headerText,
                footer_text: footerText,
                quote_number: nextQuoteNumber,
                tenant_id: tenantId // Explicit insert
            };

            let quoteId = id;

            if (id && !isReleasedEdit) {
                const { error } = await supabase.from('quotes').update(quoteData).eq('id', id);
                if (error) throw error;
                await supabase.from('quote_items').delete().eq('quote_id', id);
            } else {
                if (id && requiresSupersedeBeforeRevision(normalizedQuoteStatus)) {
                    const { error: supersedeError } = await supabase
                        .from('quotes')
                        .update({ status: 'superseded', updated_at: new Date().toISOString() })
                        .eq('id', id);
                    if (supersedeError) throw supersedeError;
                }
                const { data, error } = await supabase.from('quotes').insert([quoteData]).select().single();
                if (error) throw error;
                quoteId = data.id;
            }

            const itemsPayload = items.map(item => ({
                quote_id: quoteId,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price
            }));
            
            if (itemsPayload.length > 0) {
                const { error: itemsError } = await supabase.from('quote_items').insert(itemsPayload);
                if (itemsError) throw itemsError;
            }

            if (isReleasedEdit) {
                toast({
                    title: 'Revision Draft Created',
                    description: 'The released quote was preserved and your changes were saved as a new draft revision.',
                });
            }

            toast({
                title: 'Quote Saved',
                description: status === 'sent'
                    ? 'Quote draft is ready for customer delivery.'
                    : 'Quote has been saved.',
            });
            clearBuilderDraft(QUOTE_BUILDER_DRAFT_KEY, tenantId, id || 'new');
            navigate('/bhf/crm/estimates'); // Redirect to Estimates list (Quotes view)

        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/bhf/crm/estimates')}>
                    <ArrowLeft className="w-5 h-5"/>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">{id ? 'Edit Quote' : 'New Quote'}</h1>
                    <p className="text-muted-foreground">Configure items and pricing.</p>
                </div>
            </div>

            {id && getQuoteRevisionMode(quoteStatus) === 'create_revision' ? (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-4 text-sm text-amber-900">
                        <p className="font-medium">Released quote protection is active.</p>
                        <p className="mt-1 text-amber-800">{getQuoteRevisionNotice(quoteStatus)}</p>
                    </CardContent>
                </Card>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader><CardTitle>Customer & Terms</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Customer</Label>
                                <Select value={leadId} onValueChange={setLeadId}>
                                    <SelectTrigger><SelectValue placeholder="Select Lead" /></SelectTrigger>
                                    <SelectContent>
                                        {leads.map(lead => (
                                            <SelectItem key={lead.id} value={lead.id}>
                                                {lead.first_name} {lead.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Valid Until</Label>
                                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Header Message</Label>
                            <Textarea 
                                value={headerText} 
                                onChange={e => setHeaderText(e.target.value)} 
                                placeholder="Intro text..."
                                className="h-20"
                            />
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                            <div>
                                <Label className="text-sm font-semibold text-slate-900">Responsible Party / Bill To</Label>
                                <p className="text-xs text-slate-500 mt-1">
                                    Optional override when the scheduling contact is not the actual homeowner or payor.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        placeholder="Homeowner or responsible party"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        value={customerEmail}
                                        onChange={e => setCustomerEmail(e.target.value)}
                                        placeholder="billing@example.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    placeholder="(321) 555-1234"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Quick Add</CardTitle></CardHeader>
                    <CardContent>
                        <Label className="mb-2 block">From Price Book</Label>
                        <Select onValueChange={addServiceItem}>
                            <SelectTrigger><SelectValue placeholder="Add Service..." /></SelectTrigger>
                            <SelectContent>
                                {services.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name} (${s.base_price})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-2">Selecting adds item immediately.</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Description</TableHead>
                                <TableHead className="w-[15%]">Qty</TableHead>
                                <TableHead className="w-[20%]">Unit Price</TableHead>
                                <TableHead className="w-[20%]">Total</TableHead>
                                <TableHead className="w-[5%]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <Input 
                                            value={item.description} 
                                            onChange={e => handleItemChange(idx, 'description', e.target.value)} 
                                            placeholder="Item description"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={e => handleItemChange(idx, 'quantity', e.target.value)} 
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="relative">
                                            <span className="absolute left-2 top-2.5 text-gray-500">$</span>
                                            <Input 
                                                type="number" 
                                                className="pl-6"
                                                value={item.unit_price} 
                                                onChange={e => handleItemChange(idx, 'unit_price', e.target.value)} 
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-right">
                                        ${item.total_price?.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <div className="mt-4">
                        <Button variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-2"/> Add Custom Item</Button>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50 flex flex-col items-end gap-2 p-6">
                    <div className="flex justify-between w-64 text-sm">
                        <span>Subtotal:</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {taxAmount > 0 ? (
                        <div className="flex justify-between w-64 text-sm">
                            <span>Tax:</span>
                            <span>${taxAmount.toFixed(2)}</span>
                        </div>
                    ) : null}
                    <div className="flex justify-between w-64 font-bold text-lg border-t pt-2 mt-2">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                </CardFooter>
            </Card>

            <Card>
                <CardContent className="pt-6 space-y-2">
                    <Label>Footer / Terms</Label>
                    <Textarea 
                        value={footerText} 
                        onChange={e => setFooterText(e.target.value)} 
                        className="h-24"
                    />
                </CardContent>
                <CardFooter className="justify-end gap-3 bg-slate-50 border-t p-4">
                    <Button variant="outline" onClick={() => navigate('/bhf/crm/estimates')}>Cancel</Button>
                    <Button variant="secondary" onClick={() => handleSave('draft')} disabled={loading}>
                         <Save className="w-4 h-4 mr-2" /> Save Draft
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave('sent')} disabled={loading}>
                         {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} 
                         Save & Send
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default QuoteBuilder;
