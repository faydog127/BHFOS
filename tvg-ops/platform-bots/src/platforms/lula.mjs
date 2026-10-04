export const lulaContract = {
  bot: 'TVG-LULA-BOT-001',
  platform: 'LULA',
  recordType: 'WORK_ORDER',
  routing: ['DISPATCH', 'SERVICE', 'FINANCE', 'BUSINESS_DEVELOPMENT'],
  fields: {
    source_record_id: ['source_record_id', 'work_order_id', 'job_id', 'id'],
    source_as_of: ['source_as_of', 'updated_at', 'modified_at'],
    work_order_id: ['work_order_id', 'job_id', 'id'],
    property_id: ['property_id', 'location_id'],
    scope: ['scope', 'description', 'work_description'],
    nte: ['nte', 'not_to_exceed', 'max_amount'],
    scheduled_start: ['scheduled_start', 'appointment_start'],
    scheduled_end: ['scheduled_end', 'appointment_end'],
    status: ['status', 'work_order_status'],
    go_back: ['go_back', 'warranty_return', 'is_warranty'],
  },
};
