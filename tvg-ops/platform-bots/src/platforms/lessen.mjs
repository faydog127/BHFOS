export const lessenContract = {
  bot: 'TVG-LESSEN-BOT-001',
  platform: 'LESSEN',
  recordType: 'WORK_ORDER',
  routing: ['DISPATCH', 'SERVICE', 'FINANCE', 'BUSINESS_DEVELOPMENT'],
  fields: {
    source_record_id: ['source_record_id', 'work_order_id', 'id'],
    source_as_of: ['source_as_of', 'updated_at', 'modified_at'],
    work_order_id: ['work_order_id', 'id'],
    property_id: ['property_id', 'location_id'],
    scope: ['scope', 'description', 'work_description'],
    nte: ['nte', 'not_to_exceed', 'max_amount'],
    scheduled_start: ['scheduled_start', 'appointment_start'],
    scheduled_end: ['scheduled_end', 'appointment_end'],
    due_at: ['due_at', 'deadline', 'due_date'],
    status: ['status', 'work_order_status'],
  },
};
