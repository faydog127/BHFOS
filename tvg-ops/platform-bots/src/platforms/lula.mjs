export const lulaContract = {
  version: 'TVG-LULA-CONTRACT-001-v0.2',
  bot: 'TVG-LULA-BOT-001', platform: 'LULA', recordType: 'WORK_ORDER',
  routing: ['DISPATCH', 'CUSTOMER_CARE', 'SERVICE', 'FINANCE', 'BUSINESS_DEVELOPMENT'],
  sourceAuthority: 'LULA_SOURCE_RECORD', requiredIdentityFields: ['work_order_id'],
  identityFields: ['source_record_id', 'work_order_id', 'property_id', 'parent_work_order_id', 'external_reference'],
  dateFields: ['source_as_of', 'scheduled_start', 'scheduled_end', 'due_at', 'original_completed_at'],
  booleanFields: ['go_back', 'warranty'], untrustedTextFields: ['scope', 'go_back_reason'],
  verifyBeforeActing: ['source_record_id', 'work_order_id', 'nte', 'scheduled_start', 'scheduled_end', 'due_at', 'go_back', 'warranty'],
  fields: {
    source_record_id: ['source_record_id', 'work_order_id', 'job_id'], source_as_of: ['source_as_of', 'updated_at', 'modified_at'],
    work_order_id: ['work_order_id', 'job_id'], external_reference: ['external_reference', 'po_number'], property_id: ['property_id', 'location_id'],
    parent_work_order_id: ['parent_work_order_id', 'original_work_order_id'], original_completed_at: ['original_completed_at'],
    scope: ['scope', 'description', 'work_description'], nte: ['nte', 'not_to_exceed', 'max_amount'],
    scheduled_start: ['scheduled_start', 'appointment_start'], scheduled_end: ['scheduled_end', 'appointment_end'],
    due_at: ['due_at', 'deadline', 'due_date'], status: ['status', 'work_order_status'],
    go_back: ['go_back', 'warranty_return'], warranty: ['is_warranty', 'warranty'], go_back_reason: ['go_back_reason', 'return_reason'],
  },
};
