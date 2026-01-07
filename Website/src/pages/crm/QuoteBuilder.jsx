
import React, { useState, useEffect } from 'react';
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

const QuoteBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [leads, setLeads] = useState([]);
    const [services, setServices] = useState([]);
    const [settings, setSettings] = useState(null);
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
                const { data: servicesData } = await supabase.from('price_book').select('*').eq('active', true).eq('tenant_id', tenantId);
                setServices(servicesData || []);

                // If Editing, Load Quote
                if (id) {
                    const { data: quote, error } = await supabase.from('quotes').select(`*, quote_items(*)`).eq('id', id).eq('tenant_id', tenantId).single();
                    if (error) throw error;
                    
                    setLeadId(quote.lead_id);
                    setValidUntil(quote.valid_until);
                    setHeaderText(quote.header_text || '');
                    setFooterText(quote.footer_text || '');
                    setItems(quote.quote_items.map(i => ({
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
                setLoading(false);
            }
        };
        init();
    }, [id]);

    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
    const taxRate = settings?.default_tax_rate || 0;
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
            const quoteData = {
                lead_id: leadId,
                status: status,
                subtotal,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                total_amount: total,
                valid_until: validUntil,
                header_text: headerText,
                footer_text: footerText,
                tenant_id: tenantId // Explicit insert
            };

            let quoteId = id;

            if (id) {
                const { error } = await supabase.from('quotes').update(quoteData).eq('id', id);
                if (error) throw error;
                await supabase.from('quote_items').delete().eq('quote_id', id);
            } else {
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

            toast({ title: 'Quote Saved', description: `Quote has been ${status === 'sent' ? 'sent' : 'saved'}.` });
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
                    <div className="flex justify-between w-64 text-sm">
                        <span>Tax ({taxRate}%):</span>
                        <span>${taxAmount.toFixed(2)}</span>
                    </div>
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
