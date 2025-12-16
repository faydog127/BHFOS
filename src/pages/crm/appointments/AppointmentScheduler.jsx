import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, Plus, Loader2 } from 'lucide-react';
import { format, addHours, startOfWeek, addDays, isSameDay } from 'date-fns';

const AppointmentScheduler = () => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    lead_id: '',
    scheduled_start: '',
    service_type: 'General Service',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [appRes, leadRes] = await Promise.all([
      supabase.from('appointments').select('*, leads(first_name, last_name)').order('scheduled_start', { ascending: true }).gte('scheduled_start', new Date().toISOString()),
      supabase.from('leads').select('id, first_name, last_name').limit(100)
    ]);

    if (appRes.error) toast({ variant: 'destructive', title: 'Error', description: appRes.error.message });
    else setAppointments(appRes.data || []);

    if (leadRes.data) setLeads(leadRes.data);
    
    setLoading(false);
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!formData.lead_id || !formData.scheduled_start) return;

    const startDate = new Date(formData.scheduled_start);
    const endDate = addHours(startDate, 2); // Default 2 hour slot

    // 1. Create Appointment
    const { data: appt, error } = await supabase.from('appointments').insert([{
      lead_id: formData.lead_id,
      scheduled_start: startDate.toISOString(),
      scheduled_end: endDate.toISOString(),
      status: 'Scheduled',
      admin_notes: formData.notes
    }]).select().single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }

    // 2. Trigger SMS Confirmation (Mock Insert to Queue)
    await supabase.from('sms_messages').insert([{
      lead_id: formData.lead_id,
      direction: 'outbound',
      body: `Hi! Your appointment is confirmed for ${format(startDate, 'MMM d @ h:mm a')}. Reply C to confirm.`,
      status: 'queued'
    }]);

    // 3. Schedule Reminders (Mock)
    const reminders = [
      { type: 'sms', body: 'Reminder: Appointment tomorrow!', scheduled_at: new Date(startDate.getTime() - 24 * 60 * 60 * 1000) },
      { type: 'sms', body: 'Technician arriving in 2 hours.', scheduled_at: new Date(startDate.getTime() - 2 * 60 * 60 * 1000) }
    ];

    await supabase.from('scheduled_notifications').insert(
      reminders.map(r => ({ ...r, lead_id: formData.lead_id, status: 'pending' }))
    );

    toast({ title: 'Scheduled', description: 'Appointment created & confirmation sent.' });
    setFormData({ lead_id: '', scheduled_start: '', service_type: 'General Service', notes: '' });
    fetchData();
  };

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(new Date()), i));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scheduler</h1>
          <p className="text-gray-500">Manage bookings and automated reminders.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>New Appointment</CardTitle>
            <CardDescription>Auto-sends SMS confirmation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={formData.lead_id} onValueChange={val => setFormData({...formData, lead_id: val})}>
                  <SelectTrigger><SelectValue placeholder="Select Lead" /></SelectTrigger>
                  <SelectContent>
                    {leads.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date & Time</Label>
                <Input 
                  type="datetime-local" 
                  value={formData.scheduled_start} 
                  onChange={e => setFormData({...formData, scheduled_start: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Input value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              <Button type="submit" className="w-full bg-blue-600">
                <Plus className="w-4 h-4 mr-2" /> Schedule
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Upcoming Schedule</CardTitle></CardHeader>
          <CardContent>
            {/* Simple Week View */}
            <div className="grid grid-cols-7 gap-2 mb-4 text-center">
              {weekDays.map(d => (
                <div key={d.toString()} className="p-2 border rounded bg-slate-50">
                  <div className="text-xs font-bold text-slate-500">{format(d, 'EEE')}</div>
                  <div className="text-lg font-bold">{format(d, 'd')}</div>
                  <div className="mt-2 space-y-1">
                    {appointments.filter(a => isSameDay(new Date(a.scheduled_start), d)).map(a => (
                      <div key={a.id} className="text-[10px] bg-blue-100 text-blue-800 p-1 rounded truncate text-left">
                        {format(new Date(a.scheduled_start), 'h:mm a')}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-500">Next Appointments</h4>
              {loading ? <Loader2 className="animate-spin" /> : appointments.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-white border rounded shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded text-blue-600"><CalendarIcon className="w-4 h-4" /></div>
                    <div>
                      <div className="font-medium">{a.leads?.first_name} {a.leads?.last_name}</div>
                      <div className="text-xs text-gray-500">{format(new Date(a.scheduled_start), 'PPp')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Confirmed</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppointmentScheduler;