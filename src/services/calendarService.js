
import { supabase } from '@/lib/customSupabaseClient';
import { addDays, isWeekend, isSameDay, startOfDay, endOfDay } from 'date-fns';

export const calendarService = {
  // Standard Operating Hours (M-F, 8am - 6pm)
  WORK_HOURS: {
    start: 8, // 8 AM
    end: 18,  // 6 PM
  },

  /**
   * Fetches holidays from the database for a specific tenant
   */
  async getHolidays(tenantId, year = new Date().getFullYear()) {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year + 1}-12-31`);

    if (error) {
      console.error('Error fetching holidays:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Fetches scheduled items (Jobs + Appointments) for a given date range
   */
  async getScheduledItems(tenantId, startDate, endDate) {
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    try {
      // 1. Fetch Jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id, 
          status, 
          scheduled_start, 
          scheduled_end, 
          service_address,
          lead:leads(first_name, last_name, company)
        `)
        .eq('tenant_id', tenantId)
        .gte('scheduled_start', startStr)
        .lte('scheduled_start', endStr)
        .neq('status', 'cancelled');

      if (jobsError) throw jobsError;

      // 2. Fetch Appointments
      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select(`
          id, 
          status, 
          scheduled_start, 
          scheduled_end,
          lead:leads(first_name, last_name, company)
        `)
        .eq('tenant_id', tenantId)
        .gte('scheduled_start', startStr)
        .lte('scheduled_start', endStr)
        .neq('status', 'cancelled');

      if (apptsError) throw apptsError;

      // Normalize Jobs
      const normalizedJobs = (jobs || []).map(j => ({
        id: j.id,
        type: 'job',
        title: `${j.lead?.first_name || ''} ${j.lead?.last_name || ''} - Job`,
        start: new Date(j.scheduled_start),
        end: j.scheduled_end ? new Date(j.scheduled_end) : addDays(new Date(j.scheduled_start), 0.1),
        status: j.status,
        address: j.service_address
      }));

      // Normalize Appointments
      const normalizedAppts = (appts || []).map(a => ({
        id: a.id,
        type: 'appointment',
        title: `${a.lead?.first_name || ''} ${a.lead?.last_name || ''} - Appt`,
        start: new Date(a.scheduled_start),
        end: a.scheduled_end ? new Date(a.scheduled_end) : addDays(new Date(a.scheduled_start), 0.05),
        status: a.status
      }));

      return [...normalizedJobs, ...normalizedAppts];

    } catch (err) {
      console.error("Calendar fetch error:", err);
      return [];
    }
  },

  /**
   * Determines if a date is a workday, weekend, or holiday
   * Used for visual indicators and surcharge logic
   */
  getDayType(date, holidays = []) {
    const holiday = holidays.find(h => isSameDay(new Date(h.date), date));
    if (holiday) return { type: 'holiday', name: holiday.name, isPremium: true };
    
    if (isWeekend(date)) return { type: 'weekend', name: 'Weekend', isPremium: true };
    
    return { type: 'workday', name: 'Work Day', isPremium: false };
  },

  /**
   * Checks if a specific time is outside standard hours (After Hours)
   */
  isAfterHours(date) {
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sun, 6 = Sat
    
    // Weekend is always after hours logic in this context
    if (day === 0 || day === 6) return true;

    return hour < this.WORK_HOURS.start || hour >= this.WORK_HOURS.end;
  }
};
