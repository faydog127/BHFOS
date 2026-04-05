import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId, tenantPath } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, FileText, Loader2, Check, X, Trash2, Edit2, Send, ExternalLink, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { resolveLeadDelivery } from '@/lib/documentDelivery';
import { sendQuoteDocument } from '@/services/documentDeliveryService';
import { openQuotePreview, openQuotePrintView } from '@/services/quotePreviewService';

const ProposalList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeTenantId } = useSupabaseAuth();

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteIds, setDeleteIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingQuoteId, setSendingQuoteId] = useState(null);

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const asTracking = (value) => (value == null ? '' : String(value).trim().toUpperCase());

  const resolvedTenantId = useMemo(() => activeTenantId || getTenantId(), [activeTenantId]);

  useEffect(() => {
    // If tenant is missing, stop and warn.
    if (!resolvedTenantId) {
      setLoading(false);
      toast({
        variant: 'destructive',
        title: 'Tenant missing',
        description: 'No tenant selected. Please refresh or reselect your tenant.'
      });
      return;
    }

    fetchQuotes(resolvedTenantId);
    setSelectedIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTenantId, statusFilter]);

  const fetchQuotes = async (tenantId) => {
    setLoading(true);
    try {
      console.log(`Fetching quotes for tenant=${tenantId}`);

      const statusForApi = statusFilter === 'accepted' ? 'approved' : statusFilter;

      const { data, error } = await supabase.functions.invoke('quotes-list', {
        body: {
          tenant_id: tenantId,
          status: statusForApi
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setQuotes(data?.quotes || []);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to load estimates.'
      });
    } finally {
      setLoading(false);
    }
  };

  const canSendEstimate = (status) => ['draft', 'sent', 'viewed', 'accepted', 'approved'].includes(String(status || '').toLowerCase());

  const handleSendEstimate = async (quote) => {
    const lead = quote?.leads || {};
    const deliveryPlan = resolveLeadDelivery({ lead });

    if (!deliveryPlan.channel) {
      toast({
        variant: 'destructive',
        title: 'Missing Contact',
        description: 'This customer needs a valid email address or a textable phone number before you can send the estimate.',
      });
      return;
    }

    setSendingQuoteId(String(quote.id));
    try {
      const result = await sendQuoteDocument({
        quoteId: quote.id,
        lead,
        deliveryChannel: deliveryPlan.channel,
        tenantId: resolvedTenantId,
      });

      const deliveryChannel = result?.delivery_channel || deliveryPlan.channel;
      const requestedChannel = result?.requested_delivery_channel || deliveryPlan.channel;
      const usedFallback = requestedChannel !== deliveryChannel;
      const resend = ['sent', 'viewed', 'accepted', 'approved'].includes(String(quote?.status || '').toLowerCase());

      toast({
        title: resend ? 'Quote Resent' : 'Quote Sent',
        description:
          deliveryChannel === 'sms'
            ? (result?.skipped
              ? 'SMS was already sent recently.'
              : usedFallback
                ? 'Email was unavailable, so the quote was texted instead.'
                : resend
                  ? 'Quote texted again successfully.'
                  : 'Quote texted successfully.')
            : (usedFallback
              ? 'SMS was unavailable, so the quote was emailed instead.'
              : resend
                ? 'Quote emailed again successfully.'
                : 'Quote emailed successfully.'),
      });

      await fetchQuotes(resolvedTenantId);
    } catch (error) {
      console.error('Estimate send error:', error);
      toast({
        variant: 'destructive',
        title: 'Send Failed',
        description: error?.message || 'Could not send the estimate.',
      });
    } finally {
      setSendingQuoteId(null);
    }
  };

  const handleUpdateStatus = async (id, newStatus, reason = null) => {
    const tenantForUpdate = resolvedTenantId || getTenantId();

    if (!tenantForUpdate) {
      toast({
        variant: 'destructive',
        title: 'Tenant missing',
        description: 'No tenant selected. Please refresh or reselect your tenant.'
      });
      return;
    }

    try {
      console.log(`Updating quote ${id} status to ${newStatus} for tenant=${tenantForUpdate}`);

      const { data, error } = await supabase.functions.invoke('quote-update-status', {
        body: {
          quote_id: id,
          tenant_id: tenantForUpdate,
          status: newStatus,
          rejection_reason: reason
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Status Updated',
        description: `Estimate marked as ${newStatus}.`
      });

      // IMPORTANT: refetch with tenantId (fixes the previous bug)
      await fetchQuotes(tenantForUpdate);

      if (newStatus === 'rejected') {
        setIsRejectModalOpen(false);
        setRejectionReason('');
        setSelectedQuoteId(null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to update estimate status.'
      });
    }
  };

  const handleOpenPreview = async (quoteId, print = false) => {
    try {
      if (print) {
        await openQuotePrintView({ quoteId, tenantId: resolvedTenantId });
      } else {
        await openQuotePreview({ quoteId, tenantId: resolvedTenantId });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: print ? 'Print unavailable' : 'Preview unavailable',
        description: error?.message || 'Could not open the estimate preview.',
      });
    }
  };

  const queueDelete = (ids) => {
    const nextIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean)));
    if (nextIds.length === 0) return;
    setDeleteIds(nextIds);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    const tenantForDelete = resolvedTenantId || getTenantId();
    if (!tenantForDelete) {
      toast({
        variant: 'destructive',
        title: 'Tenant missing',
        description: 'No tenant selected. Please refresh or reselect your tenant.'
      });
      return;
    }

    setDeleting(true);
    try {
      const result = await moneyLoopDeleteService.deleteRecords('quote', deleteIds, tenantForDelete);
      const deletedIds = new Set((result?.deleted_ids || deleteIds).map((value) => String(value)));

      setQuotes((prev) => prev.filter((quote) => !deletedIds.has(String(quote.id))));
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.has(String(id))));
      setDeleteDialogOpen(false);
      setDeleteIds([]);

      toast({
        title: 'Deleted',
        description: `${result?.deleted_count || deletedIds.size} estimate${(result?.deleted_count || deletedIds.size) === 1 ? '' : 's'} deleted successfully.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err?.message || 'Failed to delete estimate.'
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredQuotes = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return (quotes || []).filter((quote) => {
      const customerName = `${quote.leads?.first_name || ''} ${quote.leads?.last_name || ''}`.toLowerCase();
      const company = (quote.leads?.company || '').toLowerCase();
      const quoteNum = asTracking(quote.quote_number);

      return (
        customerName.includes(searchLower) ||
        company.includes(searchLower) ||
        quoteNum.includes(searchLower)
      );
    });
  }, [quotes, searchQuery]);

  const visibleQuoteIds = useMemo(
    () => filteredQuotes.map((quote) => String(quote.id)).filter(Boolean),
    [filteredQuotes],
  );
  const visibleSelectedCount = visibleQuoteIds.filter((id) => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleQuoteIds.length > 0 && visibleSelectedCount === visibleQuoteIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const toggleQuoteSelection = (quoteId, checked) => {
    const nextId = String(quoteId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(nextId);
      else next.delete(nextId);
      return Array.from(next);
    });
  };

  const toggleSelectAllVisible = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleQuoteIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'viewed':
        return 'bg-purple-100 text-purple-800';
      case 'accepted':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Helmet><title>Estimates | CRM</title></Helmet>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Estimates</h1>
          <p className="text-slate-500 mt-1">Manage customer estimates and approvals.</p>
        </div>
        <Button onClick={() => navigate(tenantPath('/crm/estimates/new', resolvedTenantId))} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> New Estimate
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>Actionable Estimates</CardTitle>
              {selectedIds.length > 0 && (
                <div className="hidden items-center gap-3 md:flex">
                  <span className="text-sm text-slate-500">
                    {selectedIds.length} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => queueDelete(selectedIds)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[20rem]">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search estimates..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex overflow-x-auto rounded-md bg-slate-100 p-1">
                {['all', 'draft', 'sent', 'accepted'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-sm capitalize transition-all ${
                      statusFilter === status
                        ? 'bg-white shadow-sm text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No estimates found matching your criteria.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredQuotes.map((quote) => (
                  <div key={quote.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-base font-semibold text-blue-700 underline-offset-2 hover:underline"
                          onClick={() => navigate(tenantPath(`/crm/estimates/${quote.id}`, resolvedTenantId))}
                        >
                          #{asTracking(quote.quote_number)}
                        </Button>
                        <div className="mt-1 font-medium text-slate-900">
                          {quote.leads ? `${quote.leads.first_name} ${quote.leads.last_name}` : 'Unknown'}
                        </div>
                        {quote.leads?.company && (
                          <div className="truncate text-xs text-slate-500">{quote.leads.company}</div>
                        )}
                      </div>
                      <Badge className={getStatusColor(quote.status)}>{quote.status}</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Date</div>
                        <div className="font-medium text-slate-900">{format(new Date(quote.created_at), 'MMM d, yyyy')}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Amount</div>
                        <div className="font-semibold text-slate-900">${Number(quote.total_amount).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[8rem]"
                        onClick={() => navigate(tenantPath(`/crm/estimates/${quote.id}`, resolvedTenantId))}
                      >
                        <Edit2 className="mr-2 h-4 w-4" /> Open
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[8rem]"
                        onClick={() => handleOpenPreview(quote.id)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" /> Preview
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[8rem]"
                        onClick={() => handleOpenPreview(quote.id, true)}
                      >
                        <Printer className="mr-2 h-4 w-4" /> PDF
                      </Button>

                      {canSendEstimate(quote.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-[8rem] border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => handleSendEstimate(quote)}
                          disabled={sendingQuoteId === String(quote.id)}
                        >
                          {sendingQuoteId === String(quote.id) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-4 w-4" />
                          )}
                          {['sent', 'viewed', 'accepted', 'approved'].includes(String(quote.status || '').toLowerCase()) ? 'Resend' : 'Send'}
                        </Button>
                      )}

                      {(quote.status === 'sent' || quote.status === 'viewed') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-[8rem] border-green-200 text-green-700 hover:bg-green-50"
                          onClick={() => handleUpdateStatus(quote.id, 'accepted')}
                        >
                          <Check className="mr-2 h-4 w-4" /> Accept
                        </Button>
                      )}

                      {(quote.status === 'sent' || quote.status === 'viewed') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-[8rem] border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSelectedQuoteId(quote.id);
                            setIsRejectModalOpen(true);
                          }}
                        >
                          <X className="mr-2 h-4 w-4" /> Reject
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-red-600"
                        onClick={() => queueDelete([String(quote.id)])}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                          onCheckedChange={(checked) => toggleSelectAllVisible(Boolean(checked))}
                          aria-label="Select all visible estimates"
                        />
                      </TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.map((quote) => (
                      <TableRow key={quote.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(String(quote.id))}
                            onCheckedChange={(checked) => toggleQuoteSelection(quote.id, Boolean(checked))}
                            aria-label={`Select estimate ${asTracking(quote.quote_number)}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 font-semibold text-blue-700 underline-offset-2 hover:underline"
                            onClick={() => navigate(tenantPath(`/crm/estimates/${quote.id}`, resolvedTenantId))}
                          >
                            #{asTracking(quote.quote_number)}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {quote.leads ? `${quote.leads.first_name} ${quote.leads.last_name}` : 'Unknown'}
                          </div>
                          {quote.leads?.company && (
                            <div className="text-xs text-slate-500">{quote.leads.company}</div>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(quote.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-bold text-slate-700">
                          ${Number(quote.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(quote.status)}>{quote.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenPreview(quote.id)}
                              title="Preview Estimate"
                            >
                              <ExternalLink className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenPreview(quote.id, true)}
                              title="Print / Save PDF"
                            >
                              <Printer className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(tenantPath(`/crm/estimates/${quote.id}`, resolvedTenantId))}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                            </Button>

                            {canSendEstimate(quote.status) && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => handleSendEstimate(quote)}
                                disabled={sendingQuoteId === String(quote.id)}
                                title={['sent', 'viewed', 'accepted', 'approved'].includes(String(quote.status || '').toLowerCase()) ? 'Resend Quote' : 'Send Quote'}
                              >
                                {sendingQuoteId === String(quote.id) ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </Button>
                            )}

                            {(quote.status === 'sent' || quote.status === 'viewed') && (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                                  onClick={() => handleUpdateStatus(quote.id, 'accepted')}
                                  title="Mark Accepted"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => {
                                    setSelectedQuoteId(quote.id);
                                    setIsRejectModalOpen(true);
                                  }}
                                  title="Mark Rejected"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-400 hover:text-red-600"
                              onClick={() => queueDelete([String(quote.id)])}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Estimate</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be logged for reporting.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              placeholder="Reason (e.g., Price too high, Competitor selected)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleUpdateStatus(selectedQuoteId, 'rejected', rejectionReason)}
              disabled={!rejectionReason.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteIds.length === 1 ? 'Estimate' : `${deleteIds.length} Estimates`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected estimate records, their line items, and linked CRM logs for those estimates. Any connected work orders or invoices will remain, but their estimate link will be detached.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProposalList;
