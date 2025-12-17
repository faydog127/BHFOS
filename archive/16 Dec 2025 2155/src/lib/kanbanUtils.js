import { differenceInMinutes, differenceInDays } from 'date-fns';

// 1. Define Columns matching the SQL 'get_kanban_board_data' mapping
export const KANBAN_COLUMNS = [
  // LEADS STAGES
  { id: 'col_new', title: 'New Leads', color: 'border-l-blue-500', limit: 15 },
  { id: 'col_contacted', title: 'Contacted', color: 'border-l-yellow-500', limit: 20 },
  { id: 'col_quote_sent', title: 'Quote Sent', color: 'border-l-purple-500', limit: 10 },
  
  // JOB / WORKFLOW STAGES
  { id: 'col_ready_to_book', title: 'Ready to Book', color: 'border-l-indigo-400', limit: 10 },
  { id: 'col_visit_scheduled', title: 'Scheduled', color: 'border-l-indigo-600', limit: 10 },
  { id: 'col_in_progress', title: 'In Progress', color: 'border-l-pink-600', limit: 5 },
  
  // FINANCIAL STAGES
  { id: 'col_ready_to_invoice', title: 'Ready to Invoice', color: 'border-l-orange-400', limit: 10 },
  { id: 'col_awaiting_payment', title: 'Awaiting Payment', color: 'border-l-orange-600', limit: 30 },
  { id: 'col_paid_closed', title: 'Paid & Closed', color: 'border-l-emerald-600', limit: 50 },
  
  // HOLDING ZONES
  { id: 'col_dormant', title: 'Dormant / Snoozed', color: 'border-l-slate-400', limit: 50 },
];

export const distributeItemsToColumns = (columns, items) => {
    const boardData = {};
    columns.forEach(col => {
        boardData[col.id] = items.filter(i => i.stage_id === col.id);
    });
    return boardData;
};

// 3. Status Mapping Helper (Maps DB status to Kanban Column ID)
export const mapStatusToColumn = (status) => {
    const s = (status || '').toLowerCase();
    
    if (s === 'new') return 'col_new';
    if (s === 'contacted' || s === 'working' || s === 'attempted_contact') return 'col_contacted';
    if (s === 'quoted' || s === 'sent') return 'col_quote_sent';
    
    if (s === 'pending_schedule' || s === 'approved') return 'col_ready_to_book';
    if (s === 'scheduled') return 'col_visit_scheduled';
    if (s === 'in_progress' || s === 'started') return 'col_in_progress';
    
    if (s === 'pending_invoice' || s === 'ready_to_invoice' || s === 'completed') return 'col_ready_to_invoice';
    if (s === 'invoiced' || s === 'partial') return 'col_awaiting_payment';
    if (s === 'paid') return 'col_paid_closed';
    
    if (s === 'dormant') return 'col_dormant';
    
    return 'col_new'; // Fallback
};

export const getCardSlaStatus = (item, stageId) => {
  const now = new Date();
  const created = new Date(item.created_at);
  const updated = new Date(item.updated_at || item.created_at);
  
  let status = 'normal';
  let colorClass = 'bg-slate-200';
  let badgeText = null;

  // New Leads SLA
  if (stageId === 'col_new') {
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
  }
  // Invoice Aging SLA
  else if (stageId === 'col_awaiting_payment') {
    // Logic for unpaid invoices
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
  }
  // General Coloring
  else if (stageId === 'col_contacted') colorClass = 'bg-yellow-200';
  else if (stageId === 'col_quote_sent') colorClass = 'bg-purple-200';
  else if (stageId === 'col_ready_to_book') colorClass = 'bg-indigo-300';
  else if (stageId === 'col_visit_scheduled') colorClass = 'bg-indigo-500 text-white';
  else if (stageId === 'col_in_progress') colorClass = 'bg-pink-300';
  else if (stageId === 'col_ready_to_invoice') colorClass = 'bg-orange-300';
  else if (stageId === 'col_paid_closed') colorClass = 'bg-emerald-300';
  else if (stageId === 'col_dormant') colorClass = 'bg-slate-300';

  return { status, colorClass, badgeText };
};