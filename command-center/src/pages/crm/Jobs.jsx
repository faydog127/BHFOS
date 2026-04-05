import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import {
  normalizeJobStatus,
  normalizePaymentStatus,
} from '@/lib/jobStatus';
import { jobService } from '@/services/jobService';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { 
  Calendar, CheckCircle2, DollarSign, Clock, 
  MapPin, User, Loader2, PlayCircle, Lock, Trash2, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { formatPhoneNumber } from '@/lib/formUtils';
import { resolveLeadDelivery } from '@/lib/documentDelivery';
import {
  PAYMENT_TERM_OPTIONS,
  formatOperationalStageLabel,
  formatPaymentTermsLabel,
  normalizeWorkOrderPaymentTerms,
} from '@/lib/workOrderOperational';
import { sendReceiptDocument } from '@/services/documentDeliveryService';
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
import { workOrderBoardService } from '@/services/workOrderBoardService';

const Jobs = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(searchParams.get('status') || 'all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [processingId, setProcessingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteIds, setDeleteIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordJob, setRecordJob] = useState(null);
  
  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('check');
  const [sendReceiptNow, setSendReceiptNow] = useState(true);
  
  // Scheduling Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleJob, setScheduleJob] = useState(null);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState('120');
  const [scheduleAddress, setScheduleAddress] = useState('');
  const [scheduleTechnicianId, setScheduleTechnicianId] = useState('unassigned');
  const [technicians, setTechnicians] = useState([]);
  const [recordStart, setRecordStart] = useState('');
  const [recordTechnicianId, setRecordTechnicianId] = useState('unassigned');
  const [recordServiceAddress, setRecordServiceAddress] = useState('');
  const [recordPaymentTerms, setRecordPaymentTerms] = useState('NET_7');

  const tenantId = getTenantId();
  const asText = (value) => (typeof value === 'string' ? value.trim() : '');
  const asTracking = (value) => asText(value).toUpperCase();
  const formatPhoneDisplay = (value) => {
    const formatted = formatPhoneNumber(asText(value));
    return formatted || 'No phone on file';
  };
  const formatSelectedAddress = (addressData) => {
    if (!addressData || typeof addressData !== 'object') return '';
    const street = asText(addressData.street);
    const city = asText(addressData.city);
    const state = asText(addressData.state);
    const zip = asText(addressData.zip);
    const composed = [street, [city, state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return asText(composed || addressData.formatted_address);
  };
  const statusOptions = ['unscheduled', 'pending_schedule', 'scheduled', 'en_route', 'in_progress', 'on_hold', 'completed', 'cancelled'];
  const getOperationalStage = (job) => job?.operational_stage || normalizeStatus(job?.status);
  const collectionStages = ['invoice_draft', 'invoiced'];

  const formatStatusLabel = (status) =>
    normalizeStatus(status)
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const statusOptionsForJob = (status) => {
    const normalized = normalizeStatus(status);
    if (!normalized || statusOptions.includes(normalized)) return statusOptions;
    return [normalized, ...statusOptions];
  };

  useEffect(() => {
    fetchJobs();
    setSelectedIds([]);
  }, [filter]);

  useEffect(() => {
    fetchTechnicians();
  }, [tenantId]);

  const normalizeStatus = (status) => normalizeJobStatus(status);
  const resolveStatusForWrite = (nextStatus) => normalizeJobStatus(nextStatus);
  const activeStatuses = ['scheduled', 'in_progress', 'en_route', 'pending_schedule', 'on_hold'];
  const assignableTechnicians = technicians.filter((tech) => tech.user_id);

  const matchesFilter = (jobRow, filterValue) => {
    const status = normalizeStatus(jobRow?.status);
    const payment = normalizePaymentStatus(jobRow?.payment_status);
    const stage = getOperationalStage(jobRow);
    if (filterValue === 'all') return true;
    if (filterValue === 'active') return activeStatuses.includes(status);
    if (filterValue === 'completed') return status === 'completed' && payment === 'paid';
    if (filterValue === 'unpaid') return collectionStages.includes(stage) || (status === 'completed' && payment !== 'paid');
    return status === normalizeStatus(filterValue);
  };

  const tabForStatus = (status, paymentStatus) => {
    const normalized = normalizeStatus(status);
    const stage = getOperationalStage({ status, payment_status: paymentStatus });
    if (collectionStages.includes(stage)) return 'unpaid';
    if (normalized === 'completed') {
      return normalizePaymentStatus(paymentStatus) === 'paid' ? 'completed' : 'unpaid';
    }
    if (activeStatuses.includes(normalized)) return 'active';
    return 'all';
  };

  const getTechnicianName = (technicianId) => {
    if (!technicianId) return 'Unassigned';
    const technician = technicians.find((t) => t.user_id === technicianId || t.id === technicianId);
    return technician?.full_name || 'Unassigned';
  };

  const resolveTechnicianSelection = (technicianId) => {
    if (!technicianId) return 'unassigned';
    const technician = technicians.find((t) => t.user_id === technicianId || t.id === technicianId);
    return technician?.user_id || 'unassigned';
  };

  const toDatetimeLocal = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getWorkOrderLabel = (job) => {
    const wo = asTracking(job?.work_order_number);
    if (wo) return wo;
    const legacy = asTracking(job?.job_number);
    if (legacy) return legacy;
    return `WO-LEGACY-${String(job?.id || '').slice(0, 8).toUpperCase()}`;
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const rows = await workOrderBoardService.fetchWorkOrders(tenantId);
      const filteredRows = rows.filter((row) => matchesFilter(row, filter));
      setJobs(filteredRows);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load jobs.' });
    } finally {
      setLoading(false);
    }
  };

  const visibleJobs = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();
    if (!query) return jobs;

    return jobs.filter((job) => {
      const haystack = [
        `${job.leads?.first_name || ''} ${job.leads?.last_name || ''}`,
        job.leads?.email,
        job.leads?.phone,
        job.service_address,
        job.quote_number,
        job.work_order_number,
        job.job_number,
        job.latest_invoice_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [jobs, searchQuery]);

  useEffect(() => {
    const requestedJobId = searchParams.get('jobId');
    if (!requestedJobId || !visibleJobs.length) return;

    const matchingJob = visibleJobs.find((job) => String(job.id) === String(requestedJobId));
    if (matchingJob) {
      openRecordModal(matchingJob);
    }
  }, [searchParams, visibleJobs]);

  const visibleJobIds = visibleJobs.map((job) => String(job.id)).filter(Boolean);
  const visibleSelectedCount = visibleJobIds.filter((id) => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleJobIds.length > 0 && visibleSelectedCount === visibleJobIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const toggleJobSelection = (jobId, checked) => {
    const nextId = String(jobId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(nextId);
      else next.delete(nextId);
      return Array.from(next);
    });
  };

  const toggleSelectAllVisibleJobs = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleJobIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
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
      const result = await moneyLoopDeleteService.deleteRecords('job', deleteIds, tenantId);
      const deletedIds = new Set((result?.deleted_ids || deleteIds).map((value) => String(value)));

      setJobs((prev) => prev.filter((job) => !deletedIds.has(String(job.id))));
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.has(String(id))));
      if (recordJob?.id && deletedIds.has(String(recordJob.id))) {
        setRecordJob(null);
        setRecordModalOpen(false);
      }
      setDeleteDialogOpen(false);
      setDeleteIds([]);

      toast({
        title: 'Deleted',
        description: `${result?.deleted_count || deletedIds.size} work order${(result?.deleted_count || deletedIds.size) === 1 ? '' : 's'} deleted successfully.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error?.message || 'Could not delete work order.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, user_id, full_name')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.warn('Technician list unavailable:', error?.message || error);
      setTechnicians([]);
    }
  };

  const handleStatusChange = async (job, newStatus) => {
    const jobId = job?.id;
    if (!jobId) return;
    const statusForWrite = resolveStatusForWrite(newStatus, job?.status);
    setProcessingId(jobId);
    
    const previousJobs = [...jobs];
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: statusForWrite } : j));

    try {
        const result = await jobService.updateWorkOrder(
          jobId,
          { status: statusForWrite, updated_at: new Date().toISOString() },
          tenantId
        );
        if (!result.success) throw new Error(result.error);

        const refreshedJob = result.job;
        if (normalizeStatus(refreshedJob.status) !== normalizeStatus(statusForWrite)) {
          throw new Error(`Status did not change (current=${refreshedJob.status}, requested=${statusForWrite}).`);
        }

        setJobs((prev) =>
          prev.map((row) => (row.id === refreshedJob.id ? { ...row, ...refreshedJob } : row))
        );
        setRecordJob((prev) => (prev?.id === refreshedJob.id ? { ...prev, ...refreshedJob } : prev));

        let desc = `Work order moved to ${normalizeStatus(statusForWrite)}`;
        if (normalizeStatus(statusForWrite) === 'completed') {
            if (result?.invoiceResult?.invoice?.id) {
              const invoiceNumber = result?.invoice?.invoice_number ? `Invoice #${result.invoice.invoice_number}` : 'Draft invoice';
              desc = `Work order completed. ${invoiceNumber} was prepared and is ready to send.`;
            } else if (result?.invoiceResult?.error) {
              desc = `Work order completed. Invoice flow failed: ${result.invoiceResult.error}`;
            } else {
              desc = 'Work order completed. Draft invoice generation queued.';
            }
        }

        toast({ title: 'Status Updated', description: desc, className: newStatus === 'completed' ? 'bg-green-50 border-green-200' : '' });

        if (filter !== 'all' && !matchesFilter(refreshedJob, filter)) {
          const nextTab = tabForStatus(refreshedJob.status, refreshedJob.payment_status);
          if (nextTab && nextTab !== filter) {
            setFilter(nextTab);
          }
        }
        
        if (normalizeStatus(statusForWrite) === 'completed') {
             setTimeout(fetchJobs, 1000); 
        }

    } catch (err) {
      setJobs(previousJobs);
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedJob) return;

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: 'Enter a payment amount greater than 0.' });
      return;
    }

    setProcessingId(selectedJob.id);
    const result = await jobService.recordPayment(
      selectedJob.id,
      selectedJob.latest_invoice_id,
      amount,
      paymentMethod,
    );

    if (!result.success) {
      setProcessingId(null);
      toast({ variant: 'destructive', title: 'Payment Failed', description: result.error });
      return;
    }

    let receiptDescription = '';
    if (sendReceiptNow) {
      const deliveryPlan = resolveLeadDelivery({ lead: selectedJob.leads });
      if (deliveryPlan.channel) {
        try {
          const sendData = await sendReceiptDocument({
            invoiceId: result.invoice?.id || selectedJob.latest_invoice_id || undefined,
            jobId: selectedJob.id,
            lead: selectedJob.leads,
            deliveryChannel: deliveryPlan.channel,
            tenantId,
          });
          const deliveryChannel = sendData?.delivery_channel || deliveryPlan.channel;
          receiptDescription =
            deliveryChannel === 'sms'
              ? ' Receipt texted to the customer.'
              : ' Receipt emailed to the customer.';
        } catch (receiptError) {
          receiptDescription = ` Payment recorded, but receipt failed: ${receiptError.message || 'Unknown error.'}`;
        }
      } else {
        receiptDescription = ' Payment recorded, but no deliverable customer contact was available for the receipt.';
      }
    }

    const normalizedPaymentStatus = normalizePaymentStatus(result.data?.payment_status);
    const title = normalizedPaymentStatus === 'paid' ? 'Payment Recorded' : 'Partial Payment Recorded';
    const description =
      normalizedPaymentStatus === 'paid'
        ? `Work order marked as paid.${receiptDescription}`
        : `Invoice balance remains open after this payment.${receiptDescription}`;

    toast({
      title,
      description,
      className: normalizedPaymentStatus === 'paid' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200',
    });
    setPaymentModalOpen(false);
    setProcessingId(null);
    fetchJobs();
  };

  const handleSendReceipt = async (job) => {
    if (!job?.id) return;

    const deliveryPlan = resolveLeadDelivery({ lead: job.leads });
    if (!deliveryPlan.channel) {
      toast({
        variant: 'destructive',
        title: 'Deliverable contact required',
        description: 'This customer needs either a valid email address or a textable phone number before you can send a receipt.',
      });
      return;
    }

    setProcessingId(job.id);
    try {
      const sendData = await sendReceiptDocument({
        invoiceId: job.latest_invoice_id || undefined,
        jobId: job.id,
        lead: job.leads,
        deliveryChannel: deliveryPlan.channel,
        tenantId,
      });
      const deliveryChannel = sendData?.delivery_channel || deliveryPlan.channel;
      toast({
        title: 'Receipt Sent',
        description:
          deliveryChannel === 'sms'
            ? 'Receipt texted to the customer successfully.'
            : 'Receipt emailed to the customer successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Receipt Failed',
        description: error.message || 'Could not send the receipt.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openPaymentModal = (job) => {
    setRecordModalOpen(false);
    if (!job?.latest_invoice_id) {
      toast({
        variant: 'destructive',
        title: 'Invoice required',
        description: 'Create/open the invoice before recording payment. Payment is recorded on the invoice to keep reporting accurate.',
      });
      navigate(`/${tenantId}/crm/invoices/new?job_id=${encodeURIComponent(String(job?.id || ''))}`);
      return;
    }
    setSelectedJob(job);
    setPaymentAmount(job.total_amount || '');
    setPaymentMethod('check');
    setSendReceiptNow(true);
    setPaymentModalOpen(true);
  };

  const openRecordModal = (job) => {
    setRecordJob(job);
    setRecordStart(toDatetimeLocal(job?.scheduled_start));
    setRecordTechnicianId(resolveTechnicianSelection(job?.technician_id));
    setRecordServiceAddress(job?.service_address || '');
    setRecordPaymentTerms(
      normalizeWorkOrderPaymentTerms(job?.payment_terms) || 'NET_7',
    );
    setRecordModalOpen(true);
  };

  const getScheduledDurationMinutes = (job) => {
    if (!job?.scheduled_start || !job?.scheduled_end) return 120;
    const startMs = new Date(job.scheduled_start).getTime();
    const endMs = new Date(job.scheduled_end).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 120;
    return Math.max(30, Math.round((endMs - startMs) / 60000));
  };

  const handleRecordSave = async () => {
    if (!recordJob?.id) return;

    const trimmedAddress = recordServiceAddress.trim();
    const payload = {
      service_address: trimmedAddress || null,
      technician_id: recordTechnicianId === 'unassigned' ? null : recordTechnicianId,
      payment_terms: recordPaymentTerms,
      updated_at: new Date().toISOString(),
    };

    if (recordStart) {
      const start = new Date(recordStart);
      if (Number.isNaN(start.getTime())) {
        toast({ variant: 'destructive', title: 'Invalid date', description: 'Please enter a valid scheduled start.' });
        return;
      }
      const durationMinutes = getScheduledDurationMinutes(recordJob);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      payload.scheduled_start = start.toISOString();
      payload.scheduled_end = end.toISOString();

      const currentStatus = normalizeStatus(recordJob.status);
      if (currentStatus === 'unscheduled' || currentStatus === 'pending_schedule') {
        payload.status = resolveStatusForWrite('scheduled', recordJob?.status);
      }
    }

    setProcessingId(recordJob.id);
    try {
      const result = await jobService.updateWorkOrder(recordJob.id, payload, tenantId);
      if (!result.success) throw new Error(result.error);

      const refreshedJob = result.job;

      setJobs((prev) =>
        prev.map((row) => (row.id === refreshedJob.id ? { ...row, ...refreshedJob } : row))
      );
      setRecordJob((prev) => (prev?.id === refreshedJob.id ? { ...prev, ...refreshedJob } : prev));
      setRecordStart(toDatetimeLocal(refreshedJob.scheduled_start));
      setRecordTechnicianId(resolveTechnicianSelection(refreshedJob.technician_id));
      setRecordServiceAddress(refreshedJob.service_address || '');
      setRecordPaymentTerms(normalizeWorkOrderPaymentTerms(refreshedJob.payment_terms) || 'NET_7');

      if (filter !== 'all' && !matchesFilter(refreshedJob, filter)) {
        const nextTab = tabForStatus(refreshedJob.status, refreshedJob.payment_status);
        if (nextTab && nextTab !== filter) {
          setFilter(nextTab);
        }
      }

      toast({ title: 'Record Saved', description: 'Scheduled start, technician, and address were updated.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'Could not update work order record.' });
    } finally {
      setProcessingId(null);
    }
  };

  const openScheduleModal = (job) => {
    setRecordModalOpen(false);
    setScheduleJob(job);
    setScheduleStart(toDatetimeLocal(job.scheduled_start));
    if (job.scheduled_start && job.scheduled_end) {
      const start = new Date(job.scheduled_start).getTime();
      const end = new Date(job.scheduled_end).getTime();
      const duration = Math.max(30, Math.round((end - start) / 60000));
      setScheduleDuration(String(duration));
    } else {
      setScheduleDuration('120');
    }
    setScheduleAddress(job.service_address || '');
    setScheduleTechnicianId(resolveTechnicianSelection(job.technician_id));
    setScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleJob || !scheduleStart) {
      toast({ variant: 'destructive', title: 'Missing schedule', description: 'Start date/time is required.' });
      return;
    }

    const start = new Date(scheduleStart);
    if (Number.isNaN(start.getTime())) {
      toast({ variant: 'destructive', title: 'Invalid date', description: 'Please provide a valid start date/time.' });
      return;
    }

    const durationMinutes = Number(scheduleDuration);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      toast({ variant: 'destructive', title: 'Invalid duration', description: 'Duration must be greater than 0 minutes.' });
      return;
    }

    const normalizedAddress = scheduleAddress?.trim() || scheduleJob?.service_address?.trim() || '';
    if (!normalizedAddress) {
      toast({ variant: 'destructive', title: 'Address required', description: 'Service address is required before scheduling.' });
      return;
    }

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const scheduledStatus = resolveStatusForWrite('scheduled', scheduleJob?.status);
    const payload = {
      status: scheduledStatus,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      service_address: normalizedAddress,
      updated_at: new Date().toISOString(),
    };

    if (scheduleTechnicianId && scheduleTechnicianId !== 'unassigned') {
      payload.technician_id = scheduleTechnicianId;
    }

    setProcessingId(scheduleJob.id);
    try {
      const result = await jobService.updateWorkOrder(scheduleJob.id, payload, tenantId);
      if (!result.success) throw new Error(result.error);

      const refreshedJob = result.job;

      setJobs((prev) =>
        prev.map((job) => (job.id === refreshedJob.id ? { ...job, ...refreshedJob } : job))
      );
      setRecordJob((prev) => (prev?.id === refreshedJob.id ? { ...prev, ...refreshedJob } : prev));
      if (normalizeStatus(refreshedJob.status) !== 'scheduled') {
        throw new Error(`Schedule saved but status remained "${refreshedJob.status}". Please retry.`);
      }

      toast({ title: 'Work Order Scheduled', description: 'Work order is now scheduled and ready for dispatch.' });
      setScheduleModalOpen(false);
      setScheduleJob(null);
      await fetchJobs();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Schedule Failed', description: error.message || 'Could not schedule work order.' });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (job) => {
    const s = getOperationalStage(job);
    switch (s) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800 animate-pulse';
      case 'invoice_draft': return 'bg-amber-100 text-amber-800';
      case 'invoiced': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-emerald-100 text-emerald-800';
      case 'pending_schedule': return 'bg-yellow-100 text-yellow-800';
      case 'on_hold': return 'bg-orange-100 text-orange-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <Helmet><title>Work Orders | CRM</title></Helmet>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Work Orders</h1>
          <p className="text-slate-500">Manage work orders, scheduling, progress, and collections.</p>
          {selectedIds.length > 0 ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-slate-500">{selectedIds.length} selected</span>
              <Button variant="destructive" size="sm" onClick={() => queueDelete(selectedIds)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
            <div className="relative min-w-[16rem]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search work orders..."
                  className="pl-9"
                />
            </div>
            <Button variant="outline" asChild>
                <Link to={`/${tenantId}/crm/dispatch`}>
                    <Calendar className="mr-2 h-4 w-4" /> Open Dispatch
                </Link>
            </Button>
            <Button variant="outline" onClick={fetchJobs}>Refresh Board</Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={filter === 'active' ? 'active' : filter} onValueChange={setFilter} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="active">Active Work Orders</TabsTrigger>
          <TabsTrigger value="unpaid">Collections</TabsTrigger>
          <TabsTrigger value="completed">History</TabsTrigger>
          <TabsTrigger value="all">All Work Orders</TabsTrigger>
        </TabsList>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              {filter === 'active' ? 'Upcoming & In Progress' : filter === 'unpaid' ? 'Pending Payments' : filter === 'completed' ? 'Work Order History' : 'All Work Orders'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={(checked) => toggleSelectAllVisibleJobs(Boolean(checked))}
                      aria-label="Select all visible work orders"
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Schedule / Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Financials</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                ) : visibleJobs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No work orders found in this view.</TableCell></TableRow>
                ) : (
                  visibleJobs.map(job => (
                    <TableRow key={job.id} className="group">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(String(job.id))}
                          onCheckedChange={(checked) => toggleJobSelection(job.id, Boolean(checked))}
                          aria-label={`Select ${getWorkOrderLabel(job)}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => openRecordModal(job)}
                          className="font-bold text-slate-900 hover:text-blue-700 hover:underline underline-offset-2 text-left"
                        >
                          {job.leads?.first_name} {job.leads?.last_name}
                        </button>
                        <div className="text-xs text-slate-500">{getWorkOrderLabel(job)}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {formatPhoneDisplay(job.leads?.phone)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {job.scheduled_start ? format(new Date(job.scheduled_start), 'MMM d, h:mm a') : 'Unscheduled'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.service_address || 'No Address'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge variant="outline" className={getStatusColor(job)}>
                            {formatOperationalStageLabel(getOperationalStage(job))}
                          </Badge>
                          {job.is_overdue ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              {job.overdue_reason || 'Overdue'}
                            </Badge>
                          ) : null}
                          {job.due_at ? (
                            <div className="text-[11px] text-slate-500">
                              Due by {format(new Date(job.due_at), 'MMM d, h:mm a')}
                            </div>
                          ) : null}
                          <Select
                            value={normalizeStatus(job.status) || 'unscheduled'}
                            onValueChange={(nextStatus) => handleStatusChange(job, nextStatus)}
                            disabled={processingId === job.id}
                          >
                            <SelectTrigger className="h-8 w-[170px] text-xs">
                              <SelectValue placeholder="Change status" />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptionsForJob(job.status).map((statusValue) => (
                                <SelectItem key={statusValue} value={statusValue}>
                                  {formatStatusLabel(statusValue)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-mono text-sm">
                          ${job.total_amount?.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Terms: {formatPaymentTermsLabel(job.payment_terms)}
                        </div>
                        <Badge variant="outline" className={`text-[10px] mt-1 ${normalizePaymentStatus(job.payment_status) === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {job.payment_status || 'unpaid'}
                        </Badge>
                        {job.latest_invoice_id ? (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Invoice {job.latest_invoice_number || 'Draft'}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {processingId === job.id ? (
                            <Button size="sm" disabled variant="ghost"><Loader2 className="w-4 h-4 animate-spin"/></Button>
                          ) : (
                            (() => {
                              const status = normalizeStatus(job.status);
                              const stage = getOperationalStage(job);
                              return (
                                <>
                                  {(status === 'unscheduled' || status === 'pending_schedule') && (
                                    <Button size="sm" variant="outline" onClick={() => openScheduleModal(job)}>
                                      <Calendar className="w-4 h-4 mr-2" /> Schedule
                                    </Button>
                                  )}
                                  {(status === 'scheduled' || status === 'pending_schedule' || status === 'on_hold') && (
                                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(job, 'in_progress')}>
                                      <PlayCircle className="w-4 h-4 mr-2" /> Start
                                    </Button>
                                  )}
                                  {status === 'in_progress' && (
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleStatusChange(job, 'completed')}>
                                      <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                                    </Button>
                                  )}
                                  {stage === 'invoice_draft' && job.latest_invoice_id ? (
                                    <Button size="sm" variant="outline" asChild>
                                      <Link to={`/${tenantId}/crm/invoices/${job.latest_invoice_id}`}>
                                        <DollarSign className="w-4 h-4 mr-1" /> Send Invoice
                                      </Link>
                                    </Button>
                                  ) : null}
                                  {stage === 'invoiced' && job.latest_invoice_id ? (
                                    <Button size="sm" variant="outline" asChild>
                                      <Link to={`/${tenantId}/crm/invoices/${job.latest_invoice_id}`}>
                                        <DollarSign className="w-4 h-4 mr-1" /> Open Invoice
                                      </Link>
                                    </Button>
                                  ) : null}
                                  {status === 'completed' && normalizePaymentStatus(job.payment_status) !== 'paid' && (
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openPaymentModal(job)}>
                                      <DollarSign className="w-4 h-4 mr-1" /> Collect
                                    </Button>
                                  )}
                                  {normalizePaymentStatus(job.payment_status) === 'paid' && (
                                    <Button size="sm" variant="outline" onClick={() => handleSendReceipt(job)}>
                                      <DollarSign className="w-4 h-4 mr-1" /> Send Receipt
                                    </Button>
                                  )}
                                  {(stage === 'paid' || (status === 'completed' && normalizePaymentStatus(job.payment_status) === 'paid')) && (
                                    <Button size="sm" variant="ghost" disabled className="text-green-700 opacity-50">
                                      <Lock className="w-3 h-3 mr-1" /> Closed
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => openRecordModal(job)}>
                                    Record
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={() => queueDelete([String(job.id)])}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              );
                            })()
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>

      {/* Record Modal */}
      <Dialog open={recordModalOpen} onOpenChange={setRecordModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Work Order Record</DialogTitle>
          </DialogHeader>
          {recordJob ? (
            <div className="space-y-4 py-2">
              <div className="rounded-md border bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Work Order</div>
                <div className="font-semibold text-slate-900">{getWorkOrderLabel(recordJob)}</div>
                <div className="text-sm text-slate-600">
                  {recordJob.leads?.first_name} {recordJob.leads?.last_name}
                </div>
                <div className="text-xs text-slate-500">
                  {formatPhoneDisplay(recordJob.leads?.phone)}{recordJob.leads?.email ? ` | ${recordJob.leads.email}` : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Work Order Status</Label>
                  <Select
                    value={normalizeStatus(recordJob.status) || 'unscheduled'}
                    onValueChange={(nextStatus) => handleStatusChange(recordJob, nextStatus)}
                    disabled={processingId === recordJob.id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptionsForJob(recordJob.status).map((statusValue) => (
                        <SelectItem key={statusValue} value={statusValue}>
                          {formatStatusLabel(statusValue)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payment Status</Label>
                  <div className="rounded-md border bg-white px-3 py-2 text-sm">
                    {recordJob.payment_status || 'unpaid'}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select
                    value={recordPaymentTerms}
                    onValueChange={setRecordPaymentTerms}
                    disabled={processingId === recordJob.id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERM_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Customer Type</Label>
                  <div className="rounded-md border bg-white px-3 py-2 text-sm capitalize">
                    {(recordJob.customer_type_snapshot || 'residential').replaceAll('_', ' ')}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Scheduled Start</Label>
                  <Input
                    type="datetime-local"
                    value={recordStart}
                    onChange={(e) => setRecordStart(e.target.value)}
                    disabled={processingId === recordJob.id}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Technician</Label>
                  <Select
                    value={recordTechnicianId}
                    onValueChange={setRecordTechnicianId}
                    disabled={processingId === recordJob.id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {assignableTechnicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.user_id}>
                          {tech.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Service Address</Label>
                  <AddressAutocomplete
                    name="record_service_address"
                    value={recordServiceAddress}
                    onChange={(e) => setRecordServiceAddress(e.target.value)}
                    onAddressSelect={(addressData) => setRecordServiceAddress(formatSelectedAddress(addressData))}
                    placeholder="Street, City, State ZIP"
                    disabled={processingId === recordJob.id}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <div className="rounded-md border bg-white px-3 py-2 text-sm font-mono">
                    ${recordJob.total_amount?.toLocaleString() || 0}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Work Order ID</Label>
                  <div className="rounded-md border bg-white px-3 py-2 text-xs break-all">
                    {recordJob.id}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordModalOpen(false)}>
              Close
            </Button>
            {recordJob && (
              <>
                <Button onClick={handleRecordSave} disabled={processingId === recordJob.id}>
                  {processingId === recordJob.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => openScheduleModal(recordJob)}>
                  Schedule
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => queueDelete([String(recordJob.id)])}
                  disabled={deleting}
                >
                  Delete
                </Button>
                {normalizeStatus(recordJob.status) === 'completed' && normalizePaymentStatus(recordJob.payment_status) !== 'paid' ? (
                  <Button onClick={() => openPaymentModal(recordJob)}>
                    Collect Payment
                  </Button>
                ) : null}
                {normalizePaymentStatus(recordJob.payment_status) === 'paid' ? (
                  <Button variant="outline" onClick={() => handleSendReceipt(recordJob)}>
                    Send Receipt
                  </Button>
                ) : null}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="bg-slate-50 p-4 rounded-lg border">
                <div className="text-sm text-slate-500">Work Order Total</div>
                <div className="text-2xl font-bold text-slate-900">${selectedJob?.total_amount}</div>
                <div className="text-xs text-slate-400 mt-1">{selectedJob?.service_address}</div>
             </div>
             <div className="space-y-2">
                <Label>Payment Amount</Label>
                <Input 
                  type="number" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                />
             </div>
             <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
               <span>Send receipt after payment</span>
               <Checkbox
                 checked={sendReceiptNow}
                 onCheckedChange={(checked) => setSendReceiptNow(Boolean(checked))}
                 aria-label="Send receipt after payment"
               />
             </label>
          </div>
          <DialogFooter>
            <Button onClick={handlePaymentSubmit} disabled={processingId === selectedJob?.id}>
              {processingId === selectedJob?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scheduling Modal */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Work Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-900">{getWorkOrderLabel(scheduleJob || {})}</div>
              <div className="text-slate-600">{scheduleJob?.leads?.first_name} {scheduleJob?.leads?.last_name}</div>
              <div className="text-slate-500">{formatPhoneDisplay(scheduleJob?.leads?.phone)}</div>
            </div>
            <div className="space-y-2">
              <Label>Start Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated Duration (minutes)</Label>
              <Input
                type="number"
                min="30"
                step="15"
                value={scheduleDuration}
                onChange={(e) => setScheduleDuration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Technician (optional)</Label>
                  <Select value={scheduleTechnicianId} onValueChange={setScheduleTechnicianId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignableTechnicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.user_id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service Address *</Label>
              <AddressAutocomplete
                name="schedule_service_address"
                value={scheduleAddress}
                onChange={(e) => setScheduleAddress(e.target.value)}
                onAddressSelect={(addressData) => setScheduleAddress(formatSelectedAddress(addressData))}
                placeholder="Street, City, State ZIP"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleSubmit} disabled={!scheduleStart || processingId === scheduleJob?.id}>
              {processingId === scheduleJob?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteIds.length === 1 ? 'Work Order' : `${deleteIds.length} Work Orders`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected work orders, their linked invoices, surveys, payment records, and related CRM logs for those work orders. This cannot be undone.
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

export default Jobs;
