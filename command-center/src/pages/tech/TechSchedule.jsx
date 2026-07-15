import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { MapPin, Clock, Calendar as CalendarIcon, Phone, ArrowRight } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId, tenantPath } from '@/lib/tenantUtils';
import { resolveLoggedInTechnicianRosterId } from '@/lib/technicianIdentity';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useTrainingMode } from '@/contexts/TrainingModeContext';

/**
 * Read-only multi-day schedule for field techs (R3 / B-005).
 * Office Calendar remains the place to change appointment times.
 */
const TechSchedule = () => {
  const tenantId = getTenantId();
  const { user } = useSupabaseAuth();
  const { isTrainingMode } = useTrainingMode();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [technicianId, setTechnicianId] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      if (!user?.id) return;
      setLoading(true);

      const { data: techRows, error: techError } = await supabase
        .from('technicians')
        .select('id, user_id, full_name, is_active')
        .eq('user_id', user.id);

      if (techError) {
        console.error(techError);
        setJobs([]);
        setTechnicianId(null);
        setLoading(false);
        return;
      }

      const rosterId = resolveLoggedInTechnicianRosterId({
        technicians: techRows || [],
        authUserId: user.id,
      });
      setTechnicianId(rosterId);

      if (!rosterId) {
        setJobs([]);
        setLoading(false);
        return;
      }

      const start = startOfDay(selectedDate).toISOString();
      const end = endOfDay(selectedDate).toISOString();

      let query = supabase
        .from('jobs')
        .select(
          `
          id,
          tenant_id,
          status,
          scheduled_start,
          scheduled_end,
          service_address,
          work_order_number,
          leads ( first_name, last_name, company, phone, address, property_formatted_address )
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('technician_id', rosterId)
        .gte('scheduled_start', start)
        .lte('scheduled_start', end)
        .order('scheduled_start', { ascending: true });

      if (isTrainingMode) {
        query = query.eq('is_test_data', true);
      } else {
        query = query.or('is_test_data.is.false,is_test_data.is.null');
      }

      const { data, error } = await query;
      if (error) console.error(error);
      setJobs(data || []);
      setLoading(false);
    };

    fetchJobs();
  }, [user, selectedDate, isTrainingMode, tenantId]);

  const customerName = (job) => {
    const lead = job?.leads;
    return (
      [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim() ||
      lead?.company ||
      'Customer'
    );
  };

  return (
    <div className="pb-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 flex justify-between items-center border-b">
          <div>
            <h1 className="text-lg font-bold text-slate-900">My Schedule</h1>
            <p className="text-xs text-slate-500">Read-only. Office changes times on Calendar.</p>
          </div>
        </div>

        <div className="flex overflow-x-auto py-2 px-4 gap-2 bg-slate-50/50">
          {[-1, 0, 1, 2, 3].map((days) => {
            const date = addDays(new Date(), days);
            const isSelected = date.toDateString() === selectedDate.toDateString();
            return (
              <button
                key={days}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center min-w-[4.5rem] min-h-11 p-2 rounded-lg border text-sm transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <span className="font-bold">{format(date, 'EEE')}</span>
                <span className="text-xs opacity-90">{format(date, 'MMM d')}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {!technicianId && !loading ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No technician profile is linked to this login. Ask the office to connect your account.
          </div>
        ) : null}

        {loading ? (
          <div className="text-center py-10 text-slate-400">Loading schedule...</div>
        ) : jobs.length === 0 && technicianId ? (
          <div className="text-center py-10">
            <div className="bg-white p-6 rounded-full inline-block mb-4 shadow-sm border">
              <CalendarIcon className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900 font-medium">No Work Orders Scheduled</h3>
            <p className="text-slate-500 text-sm mt-1">
              You&apos;re clear for {format(selectedDate, 'MMMM do')}.
            </p>
            {isTrainingMode ? (
              <p className="text-amber-600 text-xs mt-2 font-medium">
                Tip: Switch to Live Mode to see real work orders.
              </p>
            ) : null}
          </div>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center text-blue-700 font-bold">
                    <Clock className="h-4 w-4 mr-1.5" />
                    {job.scheduled_start
                      ? format(new Date(job.scheduled_start), 'h:mm a')
                      : 'Unscheduled'}
                  </div>
                  <Badge variant="outline" className="bg-slate-50">
                    {job.status}
                  </Badge>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">{customerName(job)}</h3>
                {job.work_order_number ? (
                  <p className="text-xs text-slate-500 mb-2">WO {job.work_order_number}</p>
                ) : null}

                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 mr-2 mt-0.5 text-slate-400 shrink-0" />
                    <span>
                      {job.service_address ||
                        job.leads?.property_formatted_address ||
                        job.leads?.address ||
                        'No address on file'}
                    </span>
                  </div>
                  {job.leads?.phone ? (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-slate-400" />
                      <a href={`tel:${job.leads.phone}`} className="underline decoration-slate-300">
                        {job.leads.phone}
                      </a>
                    </div>
                  ) : null}
                </div>

                <Button asChild className="w-full min-h-11 bg-blue-600 hover:bg-blue-700">
                  <Link to={tenantPath(`/tech/jobs/${job.id}`, tenantId)}>
                    View Details <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TechSchedule;
