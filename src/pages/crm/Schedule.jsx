
import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/customSupabaseClient";
import { getTenantId } from '@/lib/tenantUtils';
import { format, parseISO, isSameDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Calendar as CalIcon, Check, X, Clock, User, AlertCircle } from "lucide-react";
import AppointmentBooking from "@/components/appointments/AppointmentBooking";

export default function Schedule() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const tenantId = getTenantId();

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
            *,
            technicians ( full_name ),
            services_catalog ( name ),
            referral_partners ( name ),
            leads ( id, name, email, phone )
        `)
        .eq('tenant_id', tenantId) // TENANT FILTER
        .order('scheduled_start', { ascending: true });
        
      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      toast({ variant: "destructive", title: "Load Failed", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleStatusChange = async (appointment, newStatus) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id)
        .eq('tenant_id', tenantId);
        
      if (error) throw error;

      // Optimistic update
      setAppointments(prev => prev.map(appt => appt.id === appointment.id ? { ...appt, status: newStatus } : appt));
      
      toast({ title: "Updated", description: `Appointment marked as ${newStatus}` });
      
      // If confirmed, trigger notification
      if (newStatus === 'confirmed') {
          await supabase.functions.invoke('notify-escalation', {
              body: { type: 'APPOINTMENT_CONFIRMED', appointmentId: appointment.id }
          });
      }

      // If completed, trigger commission calculation AND automation workflows
      if (newStatus === 'completed') {
         // 1. Calculate Commission
         await supabase.functions.invoke('calculate-commission', {
             body: { appointment_id: appointment.id }
         });
         
         // 2. Trigger Automation Workflows
         await supabase.functions.invoke('evaluate-workflows', {
             body: { 
                 trigger_type: 'appointment_completed',
                 context: {
                     appointment_id: appointment.id,
                     lead_id: appointment.lead_id,
                     lead_name: appointment.leads?.name,
                     email: appointment.leads?.email,
                     phone: appointment.leads?.phone,
                     service_category: appointment.services_catalog?.category || 'General',
                     price: appointment.pricing_snapshot?.price || 0
                 }
             }
         });
         
         toast({ title: "Processing", description: "Commissions and marketing automations initiated." });
      }

    } catch (err) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    }
  };

  const filteredAppointments = appointments.filter(a => {
      if (activeTab === 'all') return true;
      if (activeTab === 'pending') return a.status === 'pending';
      if (activeTab === 'upcoming') return ['confirmed', 'rescheduled'].includes(a.status);
      if (activeTab === 'history') return ['completed', 'cancelled', 'no_show'].includes(a.status);
      return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Schedule & Dispatch</h1>
            <p className="text-muted-foreground">Manage appointments and technician availability.</p>
        </div>
        <Button onClick={fetchAppointments} variant="outline" size="sm">
            <CalIcon className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="pending">Pending Requests</TabsTrigger>
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
                
                <TabsContent value={activeTab} className="space-y-4 mt-4">
                    {loading ? (
                        <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" /></div>
                    ) : filteredAppointments.length === 0 ? (
                        <div className="text-center p-12 border rounded-lg bg-slate-50 text-slate-500">
                            No appointments found in this view.
                        </div>
                    ) : (
                        filteredAppointments.map(appt => (
                            <Card key={appt.id} className="overflow-hidden">
                                <div className="flex flex-col sm:flex-row border-l-4 border-blue-500">
                                    <div className="p-4 flex-1 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-semibold text-lg">{appt.services_catalog?.name || 'Unknown Service'}</h3>
                                                <div className="flex items-center text-sm text-slate-500 gap-4 mt-1">
                                                    <span className="flex items-center"><CalIcon className="w-3 h-3 mr-1"/> {format(parseISO(appt.scheduled_start), 'MMM d, yyyy')}</span>
                                                    <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {format(parseISO(appt.scheduled_start), 'h:mm a')} - {format(parseISO(appt.scheduled_end), 'h:mm a')}</span>
                                                </div>
                                            </div>
                                            <StatusBadge status={appt.status} />
                                        </div>
                                        
                                        <div className="bg-slate-50 p-3 rounded text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <p className="flex items-center gap-2 text-slate-700">
                                                    <User className="w-4 h-4 text-slate-400"/> 
                                                    Tech: <span className="font-medium">{appt.technicians?.full_name || 'Unassigned'}</span>
                                                </p>
                                                {appt.referral_partners && (
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                                                        Ref: {appt.referral_partners.name}
                                                    </span>
                                                )}
                                            </div>
                                            {appt.customer_notes && (
                                                <p className="italic text-slate-600 border-t pt-1 mt-1">
                                                    " {appt.customer_notes} "
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    {appt.status === 'pending' && (
                                        <div className="bg-slate-50 p-4 flex sm:flex-col gap-2 justify-center border-t sm:border-t-0 sm:border-l">
                                            <Button 
                                                size="sm" 
                                                className="bg-green-600 hover:bg-green-700 text-white w-full"
                                                onClick={() => handleStatusChange(appt, 'confirmed')}
                                            >
                                                <Check className="w-4 h-4 mr-1" /> Approve
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="text-red-600 hover:bg-red-50 w-full"
                                                onClick={() => handleStatusChange(appt, 'cancelled')}
                                            >
                                                <X className="w-4 h-4 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    )}
                                    {appt.status === 'confirmed' && (
                                         <div className="bg-slate-50 p-4 flex sm:flex-col gap-2 justify-center border-t sm:border-t-0 sm:border-l">
                                            <Button size="sm" variant="outline" onClick={() => handleStatusChange(appt, 'completed')}>
                                                Complete
                                            </Button>
                                             <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleStatusChange(appt, 'cancelled')}>
                                                Cancel
                                            </Button>
                                         </div>
                                    )}
                                </div>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>

        {/* Sidebar: New Booking */}
        <div className="space-y-6">
            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="bg-indigo-50/50">
                    <CardTitle className="text-indigo-900">Quick Book</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <AppointmentBooking onSuccess={fetchAppointments} isAdmin={true} />
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

const StatusBadge = ({ status }) => {
    const styles = {
        pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
        confirmed: "bg-blue-100 text-blue-800 border-blue-200",
        in_progress: "bg-purple-100 text-purple-800 border-purple-200",
        completed: "bg-green-100 text-green-800 border-green-200",
        cancelled: "bg-red-100 text-red-800 border-red-200",
        no_show: "bg-slate-100 text-slate-800 border-slate-200",
        rescheduled: "bg-orange-100 text-orange-800 border-orange-200",
    };
    
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium border uppercase tracking-wider ${styles[status] || styles.pending}`}>
            {status.replace('_', ' ')}
        </span>
    );
};
