import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, CheckCircle, Clock, Loader2, MapPin, User, XCircle } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { appointmentService } from '@/services/appointmentService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const BookingVerification = () => {
  const tenantId = getTenantId();
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchRequests = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          leads (id, first_name, last_name, email, phone)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to load booking requests.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // tenant keyed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const verifyBooking = async (appointment, approved) => {
    setProcessingId(appointment.id);
    try {
      const nextStatus = approved ? 'confirmed' : 'cancelled';
      const result = await appointmentService.updateAppointmentStatus(
        appointment.id,
        { status: nextStatus },
        tenantId,
      );

      const queued = Number(result?.reminder_result?.queued || 0);
      toast({
        title: approved ? 'Booking Verified' : 'Booking Declined',
        description: approved
          ? `Appointment confirmed${queued ? ` and ${queued} reminder task${queued === 1 ? '' : 's'} queued` : ''}.`
          : 'Appointment request cancelled.',
      });

      await fetchRequests();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to update booking.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Booking Requests</h2>
          <p className="text-slate-500">Verify online booking requests so reminder automation can begin.</p>
        </div>
        <Badge variant="outline" className="text-base px-4 py-1">
          {requests.length} Pending
        </Badge>
      </div>

      {requests.length === 0 ? (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">All Caught Up</h3>
            <p className="text-slate-500">No pending booking requests at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="overflow-hidden border-l-4 border-l-orange-400">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                        {String(request.status || 'pending').toUpperCase()}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        Requested {format(new Date(request.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                          <User className="w-4 h-4" />
                          {request.leads?.first_name} {request.leads?.last_name}
                        </div>
                        <div className="text-sm text-slate-500 pl-6">
                          {request.leads?.email} • {request.leads?.phone}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                          <MapPin className="w-4 h-4" />
                          Service Location
                        </div>
                        <div className="text-sm text-slate-500 pl-6">
                          {request.service_address || 'Address pending'}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm font-medium text-slate-800">
                      {request.service_name || request.pricing_snapshot?.name || 'General Service'}
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-md border border-slate-100">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Calendar className="w-4 h-4" />
                        <span className="font-semibold">{format(new Date(request.scheduled_start), 'EEEE, MMMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4" />
                        <span>
                          {format(new Date(request.scheduled_start), 'h:mm a')} - {format(new Date(request.scheduled_end), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full lg:w-auto">
                    <Button
                      variant="outline"
                      className="flex-1 lg:flex-none border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => verifyBooking(request, false)}
                      disabled={processingId === request.id}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Decline
                    </Button>
                    <Button
                      className="flex-1 lg:flex-none bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => verifyBooking(request, true)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Verify & Confirm
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingVerification;
