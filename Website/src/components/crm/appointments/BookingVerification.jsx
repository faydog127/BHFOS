import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, Calendar, Clock, MapPin, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const BookingVerification = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      // Fetch appointments that need verification (pending or requested)
      const { data, error } = await supabase
        .from('appointments')
        .select(`
            *,
            leads (id, first_name, last_name, email, phone),
            properties (address1, city, zip)
        `)
        .in('status', ['pending', 'requested'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load booking requests." });
    } finally {
      setLoading(false);
    }
  };

  const verifyBooking = async (id, approved) => {
    try {
      const newStatus = approved ? 'scheduled' : 'cancelled';
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({ 
        title: approved ? "Booking Verified" : "Booking Declined", 
        description: approved ? "Confirmation email sent to customer." : "Customer has been notified."
      });
      
      // Refresh list
      fetchRequests();

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update booking." });
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Booking Requests</h2>
                <p className="text-slate-500">Verify online booking requests to auto-send confirmations.</p>
            </div>
            <Badge variant="outline" className="text-base px-4 py-1">
                {requests.length} Pending
            </Badge>
        </div>

        {requests.length === 0 ? (
            <Card className="bg-slate-50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">All Caught Up!</h3>
                    <p className="text-slate-500">No pending booking requests at this time.</p>
                </CardContent>
            </Card>
        ) : (
            <div className="grid gap-4">
                {requests.map((req) => (
                    <Card key={req.id} className="overflow-hidden border-l-4 border-l-orange-400">
                        <CardContent className="p-6">
                            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                                            {req.status.toUpperCase()}
                                        </Badge>
                                        <span className="text-sm text-slate-500">
                                            Requested {format(new Date(req.created_at), 'MMM d, h:mm a')}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <User className="w-4 h-4" />
                                                {req.leads?.first_name} {req.leads?.last_name}
                                            </div>
                                            <div className="text-sm text-slate-500 pl-6">
                                                {req.leads?.email} • {req.leads?.phone}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <MapPin className="w-4 h-4" />
                                                Service Location
                                            </div>
                                            <div className="text-sm text-slate-500 pl-6">
                                                {req.properties?.address1}, {req.properties?.city}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-md border border-slate-100">
                                        <div className="flex items-center gap-2 text-blue-700">
                                            <Calendar className="w-4 h-4" />
                                            <span className="font-semibold">{format(new Date(req.scheduled_start), 'EEEE, MMMM d, yyyy')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Clock className="w-4 h-4" />
                                            <span>
                                                {format(new Date(req.scheduled_start), 'h:mm a')} - {format(new Date(req.scheduled_end), 'h:mm a')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 w-full lg:w-auto">
                                    <Button 
                                        variant="outline" 
                                        className="flex-1 lg:flex-none border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                        onClick={() => verifyBooking(req.id, false)}
                                    >
                                        <XCircle className="w-4 h-4 mr-2" /> Decline
                                    </Button>
                                    <Button 
                                        className="flex-1 lg:flex-none bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => verifyBooking(req.id, true)}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" /> Verify & Confirm
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