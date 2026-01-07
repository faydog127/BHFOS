import React, { useState, useEffect } from 'react';
import { format, addDays, setHours, setMinutes, isBefore, startOfToday, addMinutes } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Calendar as CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/customSupabaseClient";
import { cn } from "@/lib/utils";

/**
 * AppointmentBooking Component
 * 
 * Allows users (or admins) to book an appointment.
 * - Fetches available services.
 * - Respects business settings (operating hours, lead time).
 * - Handles technician assignment (auto-assigns default primary).
 * - Allows selecting a referral partner (if user is admin)
 */
export default function AppointmentBooking({ leadId, onSuccess, className, isAdmin = false }) {
  const { toast } = useToast();
  
  // State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [partners, setPartners] = useState([]);

  // Form
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");

  // Computed availability
  const [availableSlots, setAvailableSlots] = useState([]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        // 1. Fetch Business Settings
        const { data: settingsData } = await supabase.from('business_settings').select('*').single();
        setSettings(settingsData);

        // 2. Fetch Services
        const { data: servicesData } = await supabase.from('services_catalog').select('*, service_pricing(*)').eq('is_active', true);
        setServices(servicesData || []);

        // 3. Fetch Technicians
        const { data: techsData } = await supabase.from('technicians').select('*').eq('is_active', true);
        setTechnicians(techsData || []);

        // 4. Fetch Partners (Only if admin)
        if (isAdmin) {
             const { data: partnersData } = await supabase.from('referral_partners').select('*').eq('status', 'active');
             setPartners(partnersData || []);
        }

      } catch (err) {
        console.error("Failed to load booking data", err);
        toast({ variant: "destructive", title: "Error", description: "Could not load booking configuration." });
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [toast, isAdmin]);

  // Generate slots when date or service changes
  useEffect(() => {
    if (!selectedDate || !settings || !selectedServiceId) {
      setAvailableSlots([]);
      return;
    }

    const dayName = format(selectedDate, 'eeee').toLowerCase();
    const hoursConfig = settings.operating_hours?.[dayName];

    if (!hoursConfig?.isOpen) {
      setAvailableSlots([]); // Closed this day
      return;
    }

    const slots = [];
    const service = services.find(s => s.id === selectedServiceId);
    const duration = service?.default_duration_minutes || 60;
    
    // Parse start/end times from "HH:mm" string
    const [startHour, startMinute] = hoursConfig.start.split(':').map(Number);
    const [endHour, endMinute] = hoursConfig.end.split(':').map(Number);
    
    let currentTime = setMinutes(setHours(selectedDate, startHour), startMinute);
    const endTime = setMinutes(setHours(selectedDate, endHour), endMinute);

    // Filter out past times if today
    const now = new Date();
    const leadTimeHours = settings.appointment_lead_time_hours || 24;
    const minBookingTime = addMinutes(now, leadTimeHours * 60);

    while (addMinutes(currentTime, duration) <= endTime) {
      if (isBefore(currentTime, minBookingTime)) {
         currentTime = addMinutes(currentTime, 30); // Skip past slots
         continue;
      }
      
      // Simple slot generation - in real world check existing appointments here
      // For now we assume infinite capacity or single track
      slots.push(new Date(currentTime));
      currentTime = addMinutes(currentTime, 60); // 1 hour intervals
    }

    setAvailableSlots(slots);
  }, [selectedDate, selectedServiceId, settings, services]);


  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedTimeSlot || !selectedServiceId) return;

    setSubmitting(true);
    try {
      const service = services.find(s => s.id === selectedServiceId);
      const pricing = service.service_pricing?.find(p => p.active) || { price: 0, name: 'Base' };
      const defaultTech = technicians.find(t => t.is_primary_default) || technicians[0];
      
      const startTime = new Date(selectedTimeSlot);
      const endTime = addMinutes(startTime, service.default_duration_minutes);

      // Arrival window: 1 hour window starting at scheduled time
      const arrivalStart = startTime;
      const arrivalEnd = addMinutes(startTime, 60);

      const payload = {
        lead_id: leadId, // Optional if public booking
        technician_id: defaultTech?.id,
        service_catalog_id: selectedServiceId,
        pricing_snapshot: { price: pricing.price, name: pricing.name },
        scheduled_start: startTime.toISOString(),
        scheduled_end: endTime.toISOString(),
        arrival_window_start: arrivalStart.toISOString(),
        arrival_window_end: arrivalEnd.toISOString(),
        status: 'pending',
        customer_notes: customerNotes,
        created_at: new Date().toISOString(),
        referral_partner_id: selectedPartnerId || null
      };

      const { data, error } = await supabase.from('appointments').insert([payload]).select().single();

      if (error) throw error;
      
      // If a partner was selected, trigger initial referral notification via edge function
      if (selectedPartnerId) {
           await supabase.functions.invoke('notify-escalation', {
              body: {
                  type: 'NEW_REFERRAL_BOOKED',
                  partnerId: selectedPartnerId,
                  appointmentId: data.id
              }
          });
      }

      // Notify Admin (Client-side trigger for now, could be Edge Function)
      // Ideally this calls an edge function to send SMS/Email
      await supabase.functions.invoke('notify-escalation', {
          body: {
              type: 'NEW_APPOINTMENT',
              appointmentId: data.id,
              customerNotes: customerNotes
          }
      });

      toast({
        title: "Appointment Requested!",
        description: "We have received your request and will confirm shortly.",
        className: "bg-green-50 border-green-200"
      });

      if (onSuccess) onSuccess(data);
      setStep(3); // Success view

    } catch (error) {
      console.error("Booking failed:", error);
      toast({ variant: "destructive", title: "Booking Failed", description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400"/></div>;
  }

  if (step === 3) {
    return (
        <Card className={cn("text-center p-8", className)}>
            <div className="flex justify-center mb-4"><CheckCircle2 className="h-16 w-16 text-green-500" /></div>
            <h3 className="text-2xl font-bold mb-2">Booking Requested!</h3>
            <p className="text-muted-foreground mb-6">Your appointment request has been submitted. You will receive a confirmation via email/SMS once approved.</p>
            <Button onClick={() => setStep(1)} variant="outline">Book Another</Button>
        </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Form */}
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
                            {services.map(svc => (
                                <SelectItem key={svc.id} value={svc.id}>
                                    {svc.name} ({svc.default_duration_minutes} min)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedServiceId && (
                        <p className="text-sm text-muted-foreground mt-2">
                            {services.find(s => s.id === selectedServiceId)?.description}
                        </p>
                    )}
                    
                    {/* Partner Selection (Admin Only) */}
                    {isAdmin && partners.length > 0 && (
                        <div className="pt-4 border-t">
                            <Label className="mb-2 block text-purple-600 font-semibold">Referral Attribution (Optional)</Label>
                            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                                <SelectTrigger className="border-purple-200 bg-purple-50">
                                    <SelectValue placeholder="Select Referral Partner" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- None --</SelectItem>
                                    {partners.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name} ({(p.commission_rate * 100).toFixed(0)}%)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
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

        {/* Right Column: Date & Time */}
        <Card className={!selectedServiceId ? "opacity-50 pointer-events-none" : ""}>
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

                {selectedDate && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <Label>Available Slots ({format(selectedDate, 'MMM do')})</Label>
                        {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {availableSlots.map((slot, i) => (
                                    <Button
                                        key={i}
                                        variant={selectedTimeSlot === slot.toISOString() ? "default" : "outline"}
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
                )}
            </CardContent>
            <CardFooter>
                 <Button 
                    className="w-full" 
                    disabled={!selectedTimeSlot || submitting} 
                    onClick={handleBookAppointment}
                 >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm Booking Request"}
                 </Button>
            </CardFooter>
        </Card>
      </div>
    </div>
  );
}