import { addDays, setHours, setMinutes, setSeconds, isAfter, isBefore, startOfDay, endOfDay, differenceInMinutes, isWeekend } from 'date-fns';

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17; // 5 PM

/**
 * Calculates the number of business minutes between two dates.
 * Business hours are 8:00 AM to 5:00 PM.
 * Returns 0 if start is after end.
 */
export function getBusinessMinutes(start, end) {
  let startDate = new Date(start);
  let endDate = new Date(end);

  if (isAfter(startDate, endDate)) return 0;

  let totalMinutes = 0;
  let current = new Date(startDate);

  while (isBefore(current, endDate)) {
    // If current day is weekend, skip to Monday
    // (Optional: standard business days often exclude weekends)
    // For this specific requirement "Night Mode... resumes 8am next day", 
    // it doesn't explicitly exclude weekends, but standard CRM SLA usually does.
    // We will stick to the 8am-5pm rule strictly for now.

    const workStart = setSeconds(setMinutes(setHours(new Date(current), WORK_START_HOUR), 0), 0);
    const workEnd = setSeconds(setMinutes(setHours(new Date(current), WORK_END_HOUR), 0), 0);

    // If strictly strictly night mode (after 5pm), jump to next day 8am
    if (isAfter(current, workEnd)) {
      current = addDays(startOfDay(current), 1);
      current = setHours(current, WORK_START_HOUR);
      continue;
    }

    // Determine the overlapping interval for today
    // The effective start for today is MAX(current, workStart)
    // The effective end for today is MIN(endDate, workEnd)
    
    let intervalStart = isBefore(current, workStart) ? workStart : current;
    let intervalEnd = isBefore(endDate, workEnd) ? endDate : workEnd;

    if (isBefore(intervalStart, intervalEnd)) {
      totalMinutes += differenceInMinutes(intervalEnd, intervalStart);
    }

    // Move current to next day start if we haven't reached endDate
    if (isBefore(intervalEnd, endDate)) {
       current = addDays(startOfDay(current), 1);
       current = setHours(current, WORK_START_HOUR);
    } else {
       // Reached end of calculation
       break;
    }
  }

  return totalMinutes;
}

/**
 * Returns the SLA status object for a lead
 * @param {string} createdAt ISO string
 */
export function getSlaStatus(createdAt) {
  const now = new Date();
  const minutes = getBusinessMinutes(createdAt, now);
  
  let color = 'bg-emerald-500'; // Green
  let label = 'Fresh';
  
  if (minutes > 60) {
    color = 'bg-red-600'; // Red
    label = 'Critical';
  } else if (minutes > 15) {
    color = 'bg-amber-500'; // Yellow
    label = 'Warning';
  }

  // Check if currently paused (Night Mode)
  const currentHour = now.getHours();
  const isPaused = currentHour < WORK_START_HOUR || currentHour >= WORK_END_HOUR;

  return {
    minutes,
    color,
    label,
    isPaused
  };
}