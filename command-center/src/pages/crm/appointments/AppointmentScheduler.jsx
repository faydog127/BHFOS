import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { Calendar as CalendarIcon, Check, ChevronsUpDown, Loader2, Plus, UserPlus, XCircle } from 'lucide-react';

import { appointmentService } from '@/services/appointmentService';
import { getTenantId } from '@/lib/tenantUtils';
import { formatPhoneNumber } from '@/lib/formUtils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

const SERVICE_CATEGORY_LABELS = {
  dryer_vent: 'Dryer Vent',
  air_duct: 'Air Duct',
  iaq: 'UV / IAQ',
  odor: 'Odor Control',
  sanitization: 'Sanitization',
  hvac_restoration: 'HVAC Restore',
  package: 'Packages',
  modifiers: 'Add-ons / Modifiers',
  admin: 'Admin / Fees',
  trip: 'Trip / Travel',
  discount: 'Discounts',
  membership: 'Membership',
  uncategorized: 'Other',
};

const normalizeCategoryKey = (rawCategory) => {
  const normalized = String(rawCategory || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) return 'uncategorized';
  if (normalized.includes('dryer')) return 'dryer_vent';
  if (normalized.includes('duct')) return 'air_duct';
  if (normalized.includes('iaq') || normalized.includes('uv')) return 'iaq';
  if (normalized.includes('odor')) return 'odor';
  if (normalized.includes('sanitize')) return 'sanitization';
  if (normalized.includes('hvac') || normalized.includes('restore')) return 'hvac_restoration';
  if (normalized.includes('package')) return 'package';
  if (normalized.includes('modifier') || normalized.includes('add_on') || normalized.includes('addon')) return 'modifiers';
  if (normalized.includes('admin') || normalized.includes('fee')) return 'admin';
  if (normalized.includes('trip') || normalized.includes('travel')) return 'trip';
  if (normalized.includes('discount')) return 'discount';
  if (normalized.includes('member')) return 'membership';
  return normalized;
};

const categoryLabel = (rawCategory) => {
  const key = normalizeCategoryKey(rawCategory);
  return (
    SERVICE_CATEGORY_LABELS[key] ||
    String(rawCategory || 'Other')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (part) => part.toUpperCase())
  );
};

const getAppointmentCustomerName = (appointment) =>
  [appointment?.leads?.first_name, appointment?.leads?.last_name].filter(Boolean).join(' ') ||
  appointment?.leads?.company ||
  'Unknown customer';

const getAppointmentServiceLabel = (appointment) =>
  appointment?.service_name || appointment?.pricing_snapshot?.name || 'Unknown service';

const getLeadDisplayName = (lead) =>
  [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || lead?.company || lead?.email || 'Unnamed customer';

const getLeadSecondaryLine = (lead) =>
  [lead?.company, lead?.email, formatPhoneNumber(lead?.phone)].filter(Boolean).join(' • ') || 'No contact details yet';

const sortCustomers = (rows) =>
  [...rows].sort((left, right) => getLeadDisplayName(left).localeCompare(getLeadDisplayName(right)));

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const AppointmentScheduler = () => {
  const tenantId = getTenantId();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
  });
  const [formData, setFormData] = useState({
    lead_id: '',
    scheduled_start: '',
    price_book_id: '',
    duration_minutes: '120',
    technician_id: 'unassigned',
    service_address: '',
    notes: '',
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, index) => addDays(startOfWeek(new Date()), index)),
    [],
  );

  const selectedCustomer = customers.find((lead) => lead.id === formData.lead_id) || null;
  const selectedService = services.find((service) => service.id === formData.price_book_id) || null;
  const prefilledLeadId = searchParams.get('leadId') || '';
  const pendingAppointments = useMemo(
    () => appointments.filter((appointment) => String(appointment?.status || '').toLowerCase() === 'pending'),
    [appointments],
  );
  const scheduledAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        ['confirmed', 'rescheduled'].includes(String(appointment?.status || '').toLowerCase()),
      ),
    [appointments],
  );

  const groupedServices = useMemo(() => {
    const grouped = services.reduce((accumulator, service) => {
      const key = normalizeCategoryKey(service?.category);
      if (!accumulator[key]) {
        accumulator[key] = {
          key,
          label: categoryLabel(service?.category),
          items: [],
        };
      }
      accumulator[key].items.push(service);
      return accumulator;
    }, {});

    return Object.values(grouped).sort((left, right) => left.label.localeCompare(right.label));
  }, [services]);

  const fetchData = async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      const [appointmentsData, servicesData, techniciansData, settingsData, customersData] = await Promise.all([
        appointmentService.fetchAppointments(tenantId),
        appointmentService.fetchServices(tenantId),
        appointmentService.fetchTechnicians(),
        appointmentService.fetchBusinessSettings(tenantId),
        appointmentService.fetchCustomers(tenantId),
      ]);

      setAppointments(appointmentsData || []);
      setServices(servicesData || []);
      setTechnicians(techniciansData || []);
      setSettings(settingsData || null);
      setCustomers(sortCustomers(customersData || []));

      if (!formData.duration_minutes || formData.duration_minutes === '120') {
        setFormData((prev) => ({
          ...prev,
          duration_minutes: String(settingsData?.appointment_slot_duration || 120),
        }));
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Scheduler load failed',
        description: error?.message || 'Could not load appointment scheduler.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // tenant-scoped bootstrap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (!prefilledLeadId || !customers.some((lead) => lead.id === prefilledLeadId)) return;

    setFormData((prev) => (
      prev.lead_id === prefilledLeadId
        ? prev
        : {
            ...prev,
            lead_id: prefilledLeadId,
          }
    ));
  }, [customers, prefilledLeadId]);

  const handleCreateCustomer = async () => {
    if (!newCustomer.first_name.trim() && !newCustomer.last_name.trim() && !newCustomer.company.trim()) {
      toast({
        variant: 'destructive',
        title: 'Customer name required',
        description: 'Add at least a first name, last name, or company before saving.',
      });
      return;
    }

    setCreatingCustomer(true);
    try {
      const created = await appointmentService.createCustomer(
        {
          ...newCustomer,
          phone: formatPhoneNumber(newCustomer.phone),
          source: 'appointment_scheduler',
        },
        tenantId,
      );

      setCustomers((prev) => sortCustomers([created, ...prev.filter((entry) => entry.id !== created.id)]));
      setFormData((prev) => ({ ...prev, lead_id: created.id }));
      setCustomerDialogOpen(false);
      setCustomerPickerOpen(false);
      setNewCustomer({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
      });

      toast({
        title: 'Customer added',
        description: `${getLeadDisplayName(created)} is now available for scheduling.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Customer create failed',
        description: error?.message || 'Could not create the customer record.',
      });
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleSchedule = async (event) => {
    event.preventDefault();
    if (!formData.lead_id || !formData.scheduled_start || !formData.price_book_id) return;

    setSubmitting(true);
    try {
      const result = await appointmentService.createAppointment(
        {
          lead_id: formData.lead_id,
          scheduled_start: new Date(formData.scheduled_start).toISOString(),
          price_book_id: formData.price_book_id,
          service_name: selectedService?.name,
          service_category: selectedService?.category,
          duration_minutes: Number(formData.duration_minutes || settings?.appointment_slot_duration || 120),
          technician_id: formData.technician_id === 'unassigned' ? null : formData.technician_id,
          service_address: formData.service_address.trim() || null,
          admin_notes: formData.notes.trim() || null,
          status: 'confirmed',
        },
        tenantId,
      );

      const queuedCount = Number(result?.reminder_result?.queued || 0);
      toast({
        title: 'Appointment scheduled',
        description:
          queuedCount > 0
            ? `Appointment created and ${queuedCount} reminder task${queuedCount === 1 ? '' : 's'} queued.`
            : 'Appointment created successfully.',
      });

      setFormData({
        lead_id: '',
        scheduled_start: '',
        price_book_id: '',
        duration_minutes: String(settings?.appointment_slot_duration || 120),
        technician_id: 'unassigned',
        service_address: '',
        notes: '',
      });
      await fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Schedule failed',
        description: error?.message || 'Could not create the appointment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppointmentStatusChange = async (appointment, nextStatus) => {
    if (!appointment?.id) return;

    setProcessingId(appointment.id);
    try {
      const result = await appointmentService.updateAppointmentStatus(
        appointment.id,
        { status: nextStatus },
        tenantId,
      );

      const queuedCount = Number(result?.reminder_result?.queued || 0);
      const description =
        nextStatus === 'confirmed' && queuedCount > 0
          ? `Visit confirmed. ${queuedCount} reminder task${queuedCount === 1 ? '' : 's'} queued.`
          : `Appointment marked as ${nextStatus}.`;

      toast({
        title: 'Calendar updated',
        description,
      });
      await fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Calendar update failed',
        description: error?.message || 'Could not update the appointment.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Helmet><title>Calendar | CRM</title></Helmet>

      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          <CalendarIcon className="h-3.5 w-3.5" />
          Booking Source Of Truth
        </div>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-500">
          Commit bookings here, then hand booked work to Dispatch. Other screens can initiate scheduling, but they should land here.
        </p>
      </div>

      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-customer-first-name">First Name</Label>
                <Input
                  id="new-customer-first-name"
                  value={newCustomer.first_name}
                  onChange={(event) => setNewCustomer((prev) => ({ ...prev, first_name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-last-name">Last Name</Label>
                <Input
                  id="new-customer-last-name"
                  value={newCustomer.last_name}
                  onChange={(event) => setNewCustomer((prev) => ({ ...prev, last_name: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-customer-company">Company</Label>
              <Input
                id="new-customer-company"
                value={newCustomer.company}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, company: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-customer-email">Email</Label>
                <Input
                  id="new-customer-email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(event) => setNewCustomer((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-phone">Phone</Label>
                <Input
                  id="new-customer-phone"
                  value={newCustomer.phone}
                  onChange={(event) =>
                    setNewCustomer((prev) => ({ ...prev, phone: formatPhoneNumber(event.target.value) }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(false)} disabled={creatingCustomer}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateCustomer} disabled={creatingCustomer}>
              {creatingCustomer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Save Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Book Visit</CardTitle>
            <CardDescription>Confirmed bookings queue reminder tasks automatically and become the committed calendar record.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="customer-picker">Customer</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCustomerDialogOpen(true)} disabled={loading}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Customer
                  </Button>
                </div>
                <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="customer-picker"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-label="Customer"
                      aria-expanded={customerPickerOpen}
                      className="w-full justify-between font-normal"
                      disabled={loading}
                    >
                      <span className={cn('truncate', !selectedCustomer && 'text-slate-500')}>
                        {loading ? 'Loading customers...' : selectedCustomer ? getLeadDisplayName(selectedCustomer) : 'Select customer'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search customers..." />
                      <CommandList className="max-h-[320px]">
                        <CommandEmpty>No matching customers. Use Add Customer.</CommandEmpty>
                        <CommandGroup heading={`Customers (${customers.length})`}>
                          {customers.map((lead) => (
                            <CommandItem
                              key={lead.id}
                              value={`${getLeadDisplayName(lead)} ${getLeadSecondaryLine(lead)}`}
                              onSelect={() => {
                                setFormData((prev) => ({ ...prev, lead_id: lead.id }));
                                setCustomerPickerOpen(false);
                              }}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, lead_id: lead.id }));
                                setCustomerPickerOpen(false);
                              }}
                              className="items-start py-2"
                            >
                              <Check className={cn('mr-2 mt-0.5 h-4 w-4', formData.lead_id === lead.id ? 'opacity-100' : 'opacity-0')} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{getLeadDisplayName(lead)}</div>
                                <div className="truncate text-xs text-slate-500">{getLeadSecondaryLine(lead)}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-slate-500">
                  Search current customer records or create one inline.
                  {selectedCustomer && prefilledLeadId === selectedCustomer.id ? ' Prefilled from another workflow.' : ''}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-picker">Service</Label>
                <Popover open={servicePickerOpen} onOpenChange={setServicePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="service-picker"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-label="Service"
                      aria-expanded={servicePickerOpen}
                      className="w-full justify-between font-normal"
                      disabled={loading}
                    >
                      <span className={cn('truncate', !selectedService && 'text-slate-500')}>
                        {loading ? 'Loading services...' : selectedService ? `${selectedService.name} • ${formatCurrency(selectedService.base_price)}` : 'Select service'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by service name, code, or category..." />
                      <CommandList className="max-h-[360px]">
                        <CommandEmpty>No services match the current search.</CommandEmpty>
                        {groupedServices.map((group) => (
                          <CommandGroup key={group.key} heading={`${group.label} (${group.items.length})`}>
                            {group.items.map((service) => (
                              <CommandItem
                                key={service.id}
                                value={`${service.code || ''} ${service.name} ${service.category || ''} ${service.description || ''}`}
                                onSelect={() => {
                                  setFormData((prev) => ({ ...prev, price_book_id: service.id }));
                                  setServicePickerOpen(false);
                                }}
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, price_book_id: service.id }));
                                  setServicePickerOpen(false);
                                }}
                                className="items-start py-2"
                              >
                                <Check
                                  className={cn(
                                    'mr-2 mt-0.5 h-4 w-4',
                                    formData.price_book_id === service.id ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{service.name}</div>
                                  <div className="truncate text-xs text-slate-500">
                                    {service.code ? `${service.code} • ` : ''}
                                    {group.label}
                                  </div>
                                </div>
                                <CommandShortcut>{formatCurrency(service.base_price)}</CommandShortcut>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-slate-500">Services are grouped by price-book category for faster scanning.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-start">Date & Time</Label>
                <Input
                  id="appointment-start"
                  aria-label="Appointment Date Time"
                  type="datetime-local"
                  value={formData.scheduled_start}
                  onChange={(event) => setFormData((prev) => ({ ...prev, scheduled_start: event.target.value }))}
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointment-duration">Duration (minutes)</Label>
                  <Input
                    id="appointment-duration"
                    aria-label="Appointment Duration Minutes"
                    type="number"
                    min="15"
                    step="15"
                    value={formData.duration_minutes}
                    onChange={(event) => setFormData((prev) => ({ ...prev, duration_minutes: event.target.value }))}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointment-technician">Technician</Label>
                  <Select
                    value={formData.technician_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, technician_id: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger id="appointment-technician" aria-label="Appointment Technician">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-address">Service Address</Label>
                <Input
                  id="appointment-address"
                  value={formData.service_address}
                  onChange={(event) => setFormData((prev) => ({ ...prev, service_address: event.target.value }))}
                  placeholder="123 Main St, Titusville, FL 32780"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-notes">Notes</Label>
                <Input
                  id="appointment-notes"
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Gate code, parking notes, or prep reminders"
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full bg-blue-600" disabled={submitting || loading}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Book Visit
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>Approve or reject calendar requests here so Dispatch only inherits committed work.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : pendingAppointments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No pending booking requests right now.
                </div>
              ) : (
                pendingAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{getAppointmentCustomerName(appointment)}</div>
                        <div className="text-sm text-slate-600">{getAppointmentServiceLabel(appointment)}</div>
                        <div className="text-xs text-slate-500">{format(new Date(appointment.scheduled_start), 'PPp')}</div>
                        {appointment.customer_notes ? (
                          <div className="text-xs text-slate-500">{appointment.customer_notes}</div>
                        ) : null}
                      </div>
                      <div className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium capitalize text-amber-700">
                        {appointment.status}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAppointmentStatusChange(appointment, 'confirmed')}
                        disabled={processingId === appointment.id}
                      >
                        {processingId === appointment.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAppointmentStatusChange(appointment, 'cancelled')}
                        disabled={processingId === appointment.id}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Calendar</CardTitle>
              <CardDescription>
                {settings?.time_zone ? `Business time zone: ${settings.time_zone}` : 'Business hours defaults are active.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                {weekDays.map((day) => (
                  <div key={day.toString()} className="p-2 border rounded bg-slate-50">
                    <div className="text-xs font-bold text-slate-500">{format(day, 'EEE')}</div>
                    <div className="text-lg font-bold">{format(day, 'd')}</div>
                    <div className="mt-2 space-y-1">
                      {scheduledAppointments
                        .filter((appointment) => isSameDay(new Date(appointment.scheduled_start), day))
                        .map((appointment) => (
                          <div key={appointment.id} className="text-[10px] bg-blue-100 text-blue-800 p-1 rounded truncate text-left">
                            {format(new Date(appointment.scheduled_start), 'h:mm a')}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm text-gray-500">Upcoming Visits</h4>
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : scheduledAppointments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No booked visits yet.
                  </div>
                ) : (
                  scheduledAppointments.slice(0, 5).map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-3 bg-white border rounded shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded text-blue-600">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium">{getAppointmentCustomerName(appointment)}</div>
                          <div className="text-xs text-gray-500">{getAppointmentServiceLabel(appointment)}</div>
                          <div className="text-xs text-gray-500">{format(new Date(appointment.scheduled_start), 'PPp')}</div>
                        </div>
                      </div>
                      <div className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full capitalize">
                        {appointment.status}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AppointmentScheduler;
