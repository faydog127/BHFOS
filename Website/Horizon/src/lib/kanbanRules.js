export const USER_ROLES = {
  CSR: 'csr',
  DISPATCHER: 'dispatcher',
  TECH: 'technician',
  ADMIN: 'admin'
};

// Simplified role check - in production this would check auth context/claims
export const checkPermission = (userRole, allowedRoles) => {
  if (!allowedRoles) return true; // Default allow if not restricted
  if (userRole === 'admin') return true; // Admin override
  return allowedRoles.includes(userRole);
};

// MODIFIED FOR FLEXIBILITY:
// Rules now primarily define *required interactions* (modals) or *explicit blocks*.
// If a transition is NOT listed here, it is considered ALLOWED by default (direct move).
export const TRANSITION_RULES = {
  'col_new': {
    'col_contacted': { 
      type: 'modal', 
      modal: 'log_interaction', 
      label: 'Log Interaction'
    },
    'archive_zone': {
      type: 'modal',
      modal: 'cancellation',
      label: 'Archive Lead'
    }
  },
  'col_contacted': {
    'col_visit_scheduled': { 
      type: 'modal', 
      modal: 'booking', 
      label: 'Book Visit'
    },
    'archive_zone': {
      type: 'modal',
      modal: 'cancellation',
      label: 'Archive Lead'
    }
  },
  'col_visit_scheduled': {
    'archive_zone': {
      type: 'modal',
      modal: 'cancellation',
      label: 'Cancel Visit'
    },
    // We remove the explicit block to Quote Sent to allow "Any Column" drag, 
    // unless strictly required by business logic. 
    // If strictness is needed, re-enable 'blocked'.
    // 'col_quote_sent': { type: 'blocked', reason: '...' } 
  },
  'col_quote_sent': {
    'col_ready_to_book': { 
      type: 'modal', 
      modal: 'approval', 
      label: 'Record Approval'
    },
    'archive_zone': {
      type: 'modal',
      modal: 'cancellation',
      label: 'Archive Quote'
    }
  },
  'col_ready_to_book': {
    'col_scheduled_jobs': { 
      type: 'modal', 
      modal: 'scheduling', 
      label: 'Dispatch Job'
    },
    'archive_zone': {
      type: 'modal',
      modal: 'cancellation',
      label: 'Cancel Job'
    }
  },
  'col_scheduled_jobs': {
    'col_ready_to_book': { 
      type: 'modal', 
      modal: 'reschedule', 
      label: 'Clear Schedule'
    },
    'archive_zone': {
      type: 'modal',
      modal: 'cancellation',
      label: 'Cancel Job'
    }
  },
  'col_ready_to_invoice': {
    'col_awaiting_payment': { 
      type: 'modal', 
      modal: 'invoice', 
      label: 'Send Invoice'
    }
  },
  'col_awaiting_payment': {
    'col_paid_closed': { 
      type: 'modal', 
      modal: 'payment', 
      label: 'Record Payment'
    }
  }
};