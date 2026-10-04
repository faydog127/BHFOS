export const zrsContract = {
  version: 'TVG-ZRS-CONTRACT-001-v0.2',
  bot: 'TVG-ZRS-BOT-001', platform: 'ZRS', recordType: 'PROPERTY_SERVICE_RECORD',
  routing: ['DISPATCH', 'SERVICE', 'FINANCE', 'BUSINESS_DEVELOPMENT'],
  sourceAuthority: 'ZRS_SOURCE_RECORD_UNVERIFIED_SURFACE', requiredIdentityFields: ['work_order_id'],
  identityFields: ['source_record_id', 'work_order_id', 'property_id', 'unit_id', 'external_reference'],
  dateFields: ['source_as_of', 'scheduled_start', 'scheduled_end', 'due_at'], untrustedTextFields: ['property_name', 'scope'],
  verifyBeforeActing: ['source_record_id', 'work_order_id', 'nte', 'scheduled_start', 'scheduled_end', 'due_at'],
  fields: {
    source_record_id: ['source_record_id', 'work_order_id', 'service_request_id'], source_as_of: ['source_as_of', 'updated_at', 'modified_at'],
    work_order_id: ['work_order_id', 'service_request_id'], external_reference: ['external_reference', 'po_number'],
    property_id: ['property_id', 'community_id'], property_name: ['property_name', 'community_name'], unit_id: ['unit_id', 'unit'],
    scope: ['scope', 'description', 'work_description'], nte: ['nte', 'not_to_exceed', 'max_amount'],
    scheduled_start: ['scheduled_start', 'appointment_start'], scheduled_end: ['scheduled_end', 'appointment_end'],
    due_at: ['due_at', 'deadline', 'due_date'], status: ['status', 'work_order_status', 'request_status'],
  },
};
