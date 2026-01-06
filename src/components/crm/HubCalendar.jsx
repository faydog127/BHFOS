
import React, { useState, useEffect } from 'react';
import { addDays, format, startOfToday, isSameDay } from 'date-fns';
import { calendarService } from '@/services/calendarService';
import { getTenantId } from '@/lib/tenantUtils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const HubCalendar = () => {
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [startDate, setStartDate] = useState(startOfToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tenantId = getTenantId();
  const navigate = useNavigate();

  // Show 3 weeks (21 days)
  const daysToShow = 21;
  const endDate = addDays(startDate, daysToShow - 1);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Parallel fetch for better performance with error handling per request
        const [fetchedHolidays, fetchedEvents] = await Promise.all([
            calendarService.getHolidays(tenantId).catch(err => {
                console.warn("Failed to fetch holidays:", err);
                return []; // Fallback to empty holidays on failure
            }),
            calendarService.getScheduledItems(tenantId, startDate, endDate).catch(err => {
                console.error("Failed to fetch scheduled items:", err);
                throw err; // Re-throw critical error to show error state
            })
        ]);

        if (mounted) {
          setHolidays(fetchedHolidays);
          setEvents(fetchedEvents);
        }
      } catch (err) {
        if (mounted) {
             console.error("Calendar Data Error:", err);
             setError("Failed to load schedule data.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [tenantId, startDate]);

  const handleDayClick = (date) => {
    navigate(`/${tenantId}/crm/schedule?date=${format(date, 'yyyy-MM-dd')}`);
  };

  const handleEventClick = (e, event) => {
    e.stopPropagation();
    if (event.type === 'job') {
      navigate(`/${tenantId}/crm/jobs?id=${event.id}`);
    } else {
      navigate(`/${tenantId}/crm/schedule?id=${event.id}`);
    }
  };

  const shiftDate = (amount) => {
    setStartDate(prev => addDays(prev, amount));
  };
  
  const getStatusStyles = (status) => {
    const s = status?.toLowerCase() || '';
    if (['completed', 'paid'].includes(s)) return 'bg-green-50 text-green-700 border-green-100';
    if (['in_progress', 'started', 'en_route'].includes(s)) return 'bg-purple-50 text-purple-700 border-purple-100';
    if (['scheduled', 'confirmed'].includes(s)) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (['on_hold', 'pending'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const getStatusDotColor = (status) => {
    const s = status?.toLowerCase() || '';
    if (['completed', 'paid'].includes(s)) return 'bg-green-500';
    if (['in_progress', 'started', 'en_route'].includes(s)) return 'bg-purple-500';
    if (['scheduled', 'confirmed'].includes(s)) return 'bg-blue-500';
    if (['on_hold', 'pending'].includes(s)) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  const renderDays = () => {
    const days = [];
    let current = startDate;

    for (let i = 0; i < daysToShow; i++) {
        // Safe access to service
        let dayStatus = { type: 'workday', name: 'Work Day', isPremium: false };
        try {
            dayStatus = calendarService.getDayType(current, holidays);
        } catch (e) {
            console.warn("Error getting day type", e);
        }

      const isToday = isSameDay(current, new Date());
      const dayEvents = events.filter(e => isSameDay(e.start, current));
      const isPremiumDay = dayStatus.isPremium;

      days.push(
        <div 
          key={i} 
          onClick={() => handleDayClick(current)}
          className={cn(
            "min-h-[120px] p-2 border border-slate-100 rounded-lg relative cursor-pointer transition-colors hover:border-blue-300 hover:shadow-sm flex flex-col gap-1 group",
            isToday ? "bg-blue-50/50 border-blue-200" : "bg-white",
            isPremiumDay ? "bg-slate-50/50" : ""
          )}
        >
          <div className="flex justify-between items-start mb-1">
            <div className="flex flex-col">
              <span className={cn("text-xs font-semibold uppercase", isToday ? "text-blue-600" : "text-slate-500")}>
                {format(current, 'EEE')}
              </span>
              <span className={cn("text-lg font-bold leading-none", isToday ? "text-blue-700" : "text-slate-700")}>
                {format(current, 'd')}
              </span>
            </div>
            {isPremiumDay && (
               <TooltipProvider>
                 <Tooltip>
                   <TooltipTrigger>
                     <Badge variant="outline" className="text-[10px] h-5 px-1 bg-amber-50 text-amber-700 border-amber-200 cursor-help">
                       {dayStatus.type === 'holiday' ? 'HOL' : '$$$'}
                     </Badge>
                   </TooltipTrigger>
                   <TooltipContent>
                     <p>{dayStatus.name} - Surcharges apply</p>
                   </TooltipContent>
                 </Tooltip>
               </TooltipProvider>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-1 overflow-hidden">
            {dayEvents.slice(0, 3).map((evt) => (
              <div 
                key={evt.id}
                onClick={(e) => handleEventClick(e, evt)}
                className={cn(
                  "text-[10px] px-1.5 py-1 rounded truncate border cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1",
                  getStatusStyles(evt.status)
                )}
                title={evt.title}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusDotColor(evt.status))} />
                <span className="truncate font-medium">{format(evt.start, 'h:mm a')}</span>
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-[10px] text-slate-400 pl-1">
                +{dayEvents.length - 3} more
              </div>
            )}
          </div>
           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-colors pointer-events-none" />
        </div>
      );
      current = addDays(current, 1);
    }
    return days;
  };

  if (error) {
      return (
          <Card className="w-full border-red-200 bg-red-50">
              <CardContent className="p-6 flex items-center gap-4 text-red-700">
                  <AlertTriangle className="h-6 w-6" />
                  <div>
                      <p className="font-semibold">Unable to load calendar</p>
                      <p className="text-sm">{error}</p>
                      <Button variant="outline" size="sm" className="mt-2 bg-white" onClick={() => window.location.reload()}>Retry</Button>
                  </div>
              </CardContent>
          </Card>
      );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-slate-500" />
            <CardTitle className="text-lg">Upcoming Schedule</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDate(-7)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStartDate(startOfToday())}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDate(7)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-slate-400">Loading schedule...</div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {renderDays()}
          </div>
        )}
        <div className="mt-4 flex gap-4 text-xs text-slate-500 items-center border-t pt-3 flex-wrap">
           <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" /> Scheduled
           </div>
           <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" /> In Progress
           </div>
           <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" /> Completed
           </div>
           <div className="ml-auto flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">$$$</Badge>
              <span>Weekend/Holiday Surcharges</span>
           </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HubCalendar;
