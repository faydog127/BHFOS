import React, { useEffect, useState } from 'react';
import { addMinutes, format, isBefore, startOfToday } from 'date-fns';
import { Calendar as CalendarIcon, CheckCircle2, Clock, Loader2 } from 'lucide-react';

import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getTenantId } from '@/lib/tenantUtils';
import { appointmentService } from '@/services/appointmentService';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function AppointmentBooking({ leadId, onSuccess, className }) {
  const tenantId = getTenantId();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [technicians, setTechnicians] = useState([]);

  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [settingsData, servicesData, techniciansData] = await Promise.all([
          appointmentService.fetchBusinessSettings(tenantId),
          appointmentService.fetchServices(tenantId),
          appointmentService.fetchTechnicians(),
        ]);

        setSettings(settingsData);
        setServices(servicesData || []);
        setTechnicians(techniciansData || []);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.message || 'Could not load booking configuration.',
        });
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [tenantId, toast]);

  useEffect(() => {
    if (!selectedDate || !settings || !selectedServiceId) {
      setAvailableSlots([]);
      return;
    }

    const dayName = format(selectedDate, 'eeee').toLowerCase();
    const hoursConfig = settings.operating_hours?.[dayName];
    if (!hoursConfig?.isOpen) {
      setAvailableSlots([]);
      return;
    }

    const [startHour, startMinute] = String(hoursConfig.start || '09:00').split(':').map(Number);
    const [endHour, endMinute] = String(hoursConfig.end || '17:00').split(':').map(Number);
    const duration = Number(settings.appointment_slot_duration || 60);
    const slotStep = Math.max(30, Number(settings.appointment_buffer_time || 15));

    const now = new Date();
    const minBookingTime = addMinutes(now, Number(settings.appointment_lead_time_hours || 24) * 60);
    const endTime = new Date(selectedDate);
    endTime.setHours(endHour, endMinute, 0, 0);

    let cursor = new Date(selectedDate);
    cursor.setHours(startHour, startMinute, 0, 0);

    const slots = [];
    while (addMinutes(cursor, duration) <= endTime) {
      if (!isBefore(cursor, minBookingTime)) {
        slots.push(new Date(cursor));
      }
      cursor = addMinutes(cursor, slotStep);
    }

    setAvailableSlots(slots);
  }, [selectedDate, selectedServiceId, settings]);

  const handleBookAppointment = async () => {
    if (!leadId || !selectedDate || !selectedTimeSlot || !selectedServiceId) return;

    setSubmitting(true);
    try {
      const service = services.find((entry) => entry.id === selectedServiceId);
      const defaultTech = technicians.find((tech) => tech.is_primary_default) || technicians[0] || null;
      const startTime = new Date(selectedTimeSlot);

      const result = await appointmentService.createAppointment(
        {
          lead_id: leadId,
          price_book_id: selectedServiceId,
          service_name: service?.name,
          service_category: service?.category,
          scheduled_start: startTime.toISOString(),
          duration_minutes: Number(settings?.appointment_slot_duration || 60),
          technician_id: defaultTech?.id || null,
          customer_notes: customerNotes.trim() || null,
          status: 'pending',
        },
        tenantId,
      );

      toast({
        title: 'Appointment Requested',
        description: 'Your request is saved. Reminders begin after confirmation.',
        className: 'bg-green-50 border-green-200',
      });

      if (onSuccess) onSuccess(result?.appointment || result);
      setStep(3);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: error?.message || 'Could not submit the appointment request.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (step === 3) {
    return (
      <Card className={cn('text-center p-8', className)}>
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Booking Requested</h3>
        <p className="text-muted-foreground mb-6">
          Your appointment request has been submitted. The office will confirm it and queue reminders.
        </p>
        <Button onClick={() => setStep(1)} variant="outline">
          Book Another
        </Button>
      </Card>
    );
  }

  const selectedService = services.find((service) => service.id === selectedServiceId);

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a service..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({formatCurrency(service.base_price)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedService ? (
                <p className="text-sm text-muted-foreground mt-2">{selectedService.description}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="mb-2 block">Special Instructions or Access Details</Label>
              <Textarea
                placeholder="Gate code is 1234, watch out for the dog..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <Card className={!selectedServiceId ? 'opacity-50 pointer-events-none' : ''}>
          <CardHeader>
            <CardTitle>Date & Time</CardTitle>
            <CardDescription>Select your preferred arrival window.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => isBefore(date, startOfToday())}
              className="rounded-md border mx-auto"
            />

            {selectedDate ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <Label>Available Slots ({format(selectedDate, 'MMM do')})</Label>
                {availableSlots.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot.toISOString()}
                        variant={selectedTimeSlot === slot.toISOString() ? 'default' : 'outline'}
                        className="w-full justify-start text-left"
                        onClick={() => setSelectedTimeSlot(slot.toISOString())}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {format(slot, 'h:mm a')}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
                    No slots available on this date. Please try another day.
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleBookAppointment}
              disabled={submitting || !selectedTimeSlot || !selectedServiceId}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
              Request Appointment
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
