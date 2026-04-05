import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { 
  Plus, Search, Filter, MoreHorizontal, Clock, AlertCircle, DollarSign, Send, CheckCircle2, Loader2, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import QuickBooksIndicator from '@/components/crm/invoices/QuickBooksIndicator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { moneyLoopDeleteService } from '@/services/moneyLoopDeleteService';
import { openInvoicePreview } from '@/services/invoicePreviewService';

const Invoices = () => {
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [processingId, setProcessingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteIds, setDeleteIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useSupabaseAuth();
  const tenantId = getTenantId();
  const asTracking = (value) => (value == null ? '' : String(value).trim().toUpperCase());

  const mapStatusForApi = (status) => {
    if (status === 'unpaid') return ['sent', 'partial', 'overdue', 'accepted', 'approved'];
    if (status === 'all') return 'all';
    return status;
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchInvoices();
    setSelectedIds([]);
  }, [statusFilter, authLoading, user]);

  const fetchInvoices = async () => {
    const statusForApi = mapStatusForApi(statusFilter);
    setLoading(true);
    try {
      // Use direct table query to avoid edge-function auth churn while keeping CRM operational.
      let query = supabase
        .from('invoices')
        .select(`
          id,
          tenant_id,
          status,
          invoice_number,
          issue_date,
          due_date,
          total_amount,
          amount_paid,
          balance_due,
          public_token,
          quickbooks_id,
          quickbooks_sync_status,
          lead_id,
          job_id,
          quote_id,
          created_at,
          updated_at,
          lead:leads(first_name,last_name,company,email)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (Array.isArray(statusForApi) && statusForApi.length > 0) {
        query = query.in('status', statusForApi);
      } else if (statusForApi !== 'all') {
        query = query.eq('status', statusForApi);
      }

      const { data, error } = await query;
      if (error) throw error;

      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error fetching invoices',
        description: error?.message,
        variant: 'destructive',
      });
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPublicInvoice = async (invoice, event) => {
    event?.stopPropagation?.();

    try {
      await openInvoicePreview({
        invoiceId: invoice.id,
        tenantId,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not open public invoice',
        description: error.message || 'The invoice preview link could not be generated.',
      });
    }
  };

  const handleStatusUpdate = async (id, status, event) => {
      event.stopPropagation();
      setProcessingId(id);
      const originalInvoices = [...invoices];
      
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));

      try {
          const { data, error } = await supabase.functions.invoke('invoice-update-status', {
            body: {
              invoice_id: id,
              tenant_id: tenantId,
              status
            }
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          const msg = `Invoice marked as ${status}.`;
          toast({ title: "Updated", description: msg });

      } catch (e) {
          setInvoices(originalInvoices);
          toast({ variant: "destructive", title: "Error", description: e.message });
      } finally {
          setProcessingId(null);
      }
  };

  const handleSendInvoice = async (invoiceId, event) => {
    event.stopPropagation();
    setProcessingId(invoiceId);

    try {
      const { data, error } = await supabase.functions.invoke('send-invoice', {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;

      if (data?.stripe_error) {
        toast({
          variant: 'destructive',
          title: 'Invoice Sent With Fallback Link',
          description: `Stripe hosted invoice was unavailable: ${data.stripe_error}`,
        });
      } else {
        toast({
          title: 'Invoice Sent',
          description: 'Customer has been emailed with a working payment link.',
        });
      }

      await fetchInvoices();
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast({
        title: 'Invoice send failed',
        description: error?.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const queueDelete = (ids) => {
    const nextIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids]).map((value) => String(value || '')).filter(Boolean)));
    if (nextIds.length === 0) return;
    setDeleteIds(nextIds);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!tenantId || deleteIds.length === 0) return;

    setDeleting(true);
    try {
      const result = await moneyLoopDeleteService.deleteRecords('invoice', deleteIds, tenantId);
      const deletedIds = new Set((result?.deleted_ids || deleteIds).map((value) => String(value)));

      setInvoices((prev) => prev.filter((invoice) => !deletedIds.has(String(invoice.id))));
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.has(String(id))));
      setDeleteDialogOpen(false);
      setDeleteIds([]);

      toast({
        title: 'Deleted',
        description: `${result?.deleted_count || deletedIds.size} invoice${(result?.deleted_count || deletedIds.size) === 1 ? '' : 's'} deleted successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error?.message || 'Could not delete invoice.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
      case 'partial': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Partial</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800 border-red-200">Overdue</Badge>;
      case 'sent': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Sent</Badge>;
      case 'approved':
      case 'accepted':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Accepted</Badge>;
      default: return <Badge variant="outline" className="capitalize">{status || 'Draft'}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const searchString = searchTerm.toLowerCase();
    const invoiceNum = asTracking(invoice.invoice_number);
    const customerName = invoice.lead 
      ? (invoice.lead.company || `${invoice.lead.first_name} ${invoice.lead.last_name}`)
      : '';
    
    return (
      invoiceNum.includes(searchString) ||
      customerName.toLowerCase().includes(searchString) ||
      (invoice.status || '').toLowerCase().includes(searchString)
    );
  });

  const visibleInvoiceIds = filteredInvoices.map((invoice) => String(invoice.id)).filter(Boolean);
  const visibleSelectedCount = visibleInvoiceIds.filter((id) => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleInvoiceIds.length > 0 && visibleSelectedCount === visibleInvoiceIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const toggleInvoiceSelection = (invoiceId, checked) => {
    const nextId = String(invoiceId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(nextId);
      else next.delete(nextId);
      return Array.from(next);
    });
  };

  const toggleSelectAllVisibleInvoices = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleInvoiceIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
  };

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
    
  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid' && i.status !== 'void')
    .reduce((sum, i) => sum + (Number(i.balance_due) || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage billing, payments, and revenue.</p>
          {selectedIds.length > 0 ? (
            <div className="mt-3 hidden items-center gap-3 md:flex">
              <span className="text-sm text-slate-500">{selectedIds.length} selected</span>
              <Button variant="destructive" size="sm" onClick={() => queueDelete(selectedIds)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
           <Button variant="outline" onClick={() => fetchInvoices()} className="w-full sm:w-auto">
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate(`/${tenantId}/crm/invoices/new`)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalOutstanding.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Unpaid invoices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices, customers, or amounts..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center gap-2 md:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start md:w-auto md:justify-center">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter: {statusFilter === 'all' ? 'All Statuses' : statusFilter === 'unpaid' ? 'Unpaid & Overdue' : statusFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setStatusFilter('all')}>All Statuses</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter('unpaid')}>Unpaid & Overdue</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('draft')}>Draft</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('sent')}>Sent</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('accepted')}>Accepted</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('paid')}>Paid</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('overdue')}>Overdue</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('void')}>Void</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {loading ? (
              <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-slate-500">
                Loading invoices...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-muted-foreground">
                No invoices found.
              </div>
            ) : (
              filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-left text-base font-semibold text-slate-900 underline-offset-4 hover:underline"
                        onClick={() => navigate(`/${tenantId}/crm/invoices/${invoice.id}`)}
                      >
                        {invoice.invoice_number ? `#${asTracking(invoice.invoice_number)}` : 'DRAFT'}
                      </button>
                      <div className="mt-1 text-sm font-medium text-slate-700">
                        {invoice.lead?.company ||
                          (invoice.lead ? `${invoice.lead.first_name} ${invoice.lead.last_name}` : 'Unknown')}
                      </div>
                      {invoice.lead?.email ? (
                        <div className="truncate text-xs text-slate-500">{invoice.lead.email}</div>
                      ) : null}
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Issue Date</div>
                      <div className="mt-1 font-medium text-slate-700">{invoice.issue_date || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Amount</div>
                      <div className="mt-1 font-medium text-slate-700">${Number(invoice.total_amount).toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">QuickBooks</div>
                    <QuickBooksIndicator
                      invoiceId={invoice.id}
                      status={invoice.quickbooks_sync_status}
                      qbId={invoice.quickbooks_id}
                      onSyncComplete={fetchInvoices}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/${tenantId}/crm/invoices/${invoice.id}`)} className="flex-1 min-w-[7.5rem]">
                      Edit
                    </Button>
                    {invoice.status === 'draft' ? (
                      <Button size="sm" variant="outline" onClick={(e) => handleSendInvoice(invoice.id, e)} disabled={processingId === invoice.id} className="flex-1 min-w-[7.5rem]">
                        {processingId === invoice.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        {processingId === invoice.id ? 'Sending...' : 'Send'}
                      </Button>
                    ) : null}
                    {(invoice.status === 'sent' || invoice.status === 'partial') ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[7.5rem] border-green-200 hover:bg-green-50"
                        onClick={() => navigate(`/${tenantId}/crm/invoices/${invoice.id}?record_payment=1`)}
                        disabled={processingId === invoice.id}
                      >
                        {processingId === invoice.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2 text-green-600" />}
                        Record Payment
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={(e) => handleOpenPublicInvoice(invoice, e)} className="flex-1 min-w-[7.5rem]">
                      View
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => queueDelete([String(invoice.id)])} className="flex-1 min-w-[7.5rem]">
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={(checked) => toggleSelectAllVisibleInvoices(Boolean(checked))}
                      aria-label="Select all visible invoices"
                    />
                  </TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>QB Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(String(invoice.id))}
                          onCheckedChange={(checked) => toggleInvoiceSelection(invoice.id, Boolean(checked))}
                          aria-label={`Select invoice ${asTracking(invoice.invoice_number) || 'draft'}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {invoice.invoice_number ? `#${asTracking(invoice.invoice_number)}` : 'DRAFT'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {invoice.lead?.company || 
                             (invoice.lead ? `${invoice.lead.first_name} ${invoice.lead.last_name}` : 'Unknown')}
                          </span>
                          <span className="text-xs text-gray-500">{invoice.lead?.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{invoice.issue_date || '-'}</TableCell>
                      <TableCell>${Number(invoice.total_amount).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                          <QuickBooksIndicator 
                              invoiceId={invoice.id} 
                              status={invoice.quickbooks_sync_status} 
                              qbId={invoice.quickbooks_id}
                              onSyncComplete={fetchInvoices}
                          />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 items-center">
                            {processingId === invoice.id ? (
                                <Button size="sm" variant="ghost" disabled><Loader2 className="w-4 h-4 animate-spin"/></Button>
                            ) : (
                                <>
                                    {invoice.status === 'draft' && (
                                        <Button size="sm" variant="outline" onClick={(e) => handleSendInvoice(invoice.id, e)} title="Send Invoice">
                                            <Send className="w-4 h-4 text-blue-600"/>
                                        </Button>
                                    )}
                                     {(invoice.status === 'sent' || invoice.status === 'partial') && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-green-200 hover:bg-green-50"
                                          onClick={() => navigate(`/${tenantId}/crm/invoices/${invoice.id}?record_payment=1`)}
                                          title="Record Payment"
                                        >
                                            <DollarSign className="w-4 h-4 text-green-600"/>
                                        </Button>
                                     )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => navigate(`/${tenantId}/crm/invoices/${invoice.id}`)}>
                                            Edit Invoice
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => handleOpenPublicInvoice(invoice, e)}>
                                            View Public Page
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              className="text-red-600 focus:text-red-700"
                                              onClick={() => queueDelete([String(invoice.id)])}
                                            >
                                              Delete Invoice
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteIds.length === 1 ? 'Invoice' : `${deleteIds.length} Invoices`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected invoices, invoice items, payment transactions, Stripe webhook rows, and linked CRM logs for those invoices. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invoices;
