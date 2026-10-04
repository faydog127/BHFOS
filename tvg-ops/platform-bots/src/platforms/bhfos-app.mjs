export const bhfosAppContract = {
  bot: 'TVG-BHFOS-APP-BOT-001',
  platform: 'BHFOS_APP',
  recordType: 'CRM_OPERATIONAL_RECORD',
  routing: ['DISPATCH', 'CUSTOMER_CARE', 'SERVICE', 'FINANCE', 'BUSINESS_DEVELOPMENT'],
  fields: {
    source_record_id: ['source_record_id', 'record_id', 'id'],
    source_as_of: ['source_as_of', 'updated_at', 'modified_at'],
    module: ['module', 'surface', 'domain'],
    entity_type: ['entity_type', 'record_type', 'type'],
    entity_id: ['entity_id', 'record_id', 'id'],
    linked_job_id: ['linked_job_id', 'job_id'],
    status: ['status', 'state'],
    scheduled_start: ['scheduled_start', 'appointment_start', 'start_at'],
    scheduled_end: ['scheduled_end', 'appointment_end', 'end_at'],
    amount: ['amount', 'total_amount', 'invoice_total', 'quote_total'],
  },
};
