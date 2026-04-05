import { differenceInMinutes, differenceInDays } from 'date-fns';

// Canonical columns for the server-authoritative kanban board.
export const KANBAN_COLUMNS = [
  { id: 'lead_new', title: 'New Leads', color: 'border-l-blue-500', limit: 15 },
  { id: 'lead_contacted', title: 'Contacted', color: 'border-l-yellow-500', limit: 20 },
  { id: 'lead_qualified', title: 'Qualified', color: 'border-l-amber-500', limit: 20 },

  { id: 'quote_draft', title: 'Quote Draft', color: 'border-l-purple-400', limit: 20 },
  { id: 'quote_sent', title: 'Quote Sent', color: 'border-l-purple-600', limit: 20 },
  { id: 'quote_viewed', title: 'Quote Viewed', color: 'border-l-indigo-500', limit: 20 },
  { id: 'quote_accepted', title: 'Quote Accepted', color: 'border-l-indigo-700', limit: 20 },

  { id: 'job_scheduled', title: 'Work Order Scheduled', color: 'border-l-emerald-500', limit: 20 },
  { id: 'job_completed', title: 'Work Order Completed', color: 'border-l-emerald-700', limit: 20 },

  { id: 'invoice_open', title: 'Invoice Open', color: 'border-l-orange-400', limit: 30 },
  { id: 'invoice_paid', title: 'Invoice Paid', color: 'border-l-orange-600', limit: 50 },
];

export const distributeItemsToColumns = (columns, items) => {
  const boardData = {};

  columns.forEach((col) => {
    const columnItems = items
      .filter((item) => item.column_key === col.id)
      .sort((a, b) => new Date(b.sort_ts).getTime() - new Date(a.sort_ts).getTime());

    boardData[col.id] = columnItems;
  });

  return boardData;
};

export const getCardSlaStatus = (item, stageId) => {
  const now = new Date();
  const created = new Date(item.created_at);
  const updated = new Date(item.updated_at || item.created_at);

  let status = 'normal';
  let colorClass = 'bg-slate-200';
  let badgeText = null;

  // New Leads SLA
  if (stageId === 'lead_new') {
    const mins = differenceInMinutes(now, created);
    const hour = now.getHours();
    const isAfterHours = hour < 8 || hour >= 18;

    if (isAfterHours) {
      status = 'after_hours';
      colorClass = 'bg-blue-500';
      badgeText = 'Night Mode';
    } else if (mins < 15) {
      status = 'fresh';
      colorClass = 'bg-emerald-500';
      badgeText = '< 15m';
    } else if (mins < 60) {
      status = 'warning';
      colorClass = 'bg-yellow-500';
      badgeText = '15-60m';
    } else {
      status = 'critical';
      colorClass = 'bg-red-500';
      badgeText = '> 60m';
    }
  } else if (stageId === 'invoice_open') {
    const days = differenceInDays(now, updated);
    if (days > 14) {
      colorClass = 'bg-red-500';
      badgeText = '> 14 days';
    } else if (days > 7) {
      colorClass = 'bg-yellow-500';
      badgeText = '> 7 days';
    } else {
      colorClass = 'bg-orange-400';
    }
  } else if (stageId === 'lead_contacted') {
    colorClass = 'bg-yellow-200';
  } else if (stageId === 'lead_qualified') {
    colorClass = 'bg-amber-200';
  } else if (stageId === 'quote_draft') {
    colorClass = 'bg-purple-100';
  } else if (stageId === 'quote_sent') {
    colorClass = 'bg-purple-200';
  } else if (stageId === 'quote_viewed') {
    colorClass = 'bg-indigo-200';
  } else if (stageId === 'quote_accepted') {
    colorClass = 'bg-indigo-300';
  } else if (stageId === 'job_scheduled') {
    colorClass = 'bg-emerald-200';
  } else if (stageId === 'job_completed') {
    colorClass = 'bg-emerald-300';
  } else if (stageId === 'invoice_paid') {
    colorClass = 'bg-orange-200';
  }

  return { status, colorClass, badgeText };
};
