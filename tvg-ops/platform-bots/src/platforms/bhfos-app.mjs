export const bhfosAppContract = {
  version: 'TVG-BHFOS-APP-CONTRACT-001-v0.2',
  bot: 'TVG-BHFOS-APP-BOT-001', platform: 'BHFOS_APP', recordType: 'CRM_OPERATIONAL_RECORD',
  routing: ['DISPATCH', 'CUSTOMER_CARE', 'SERVICE', 'FINANCE', 'BUSINESS_DEVELOPMENT'],
  sourceAuthority: 'UNVERIFIED_VS_HCP', requiredIdentityFields: ['entity_id'],
  identityFields: ['source_record_id', 'entity_id', 'linked_job_id', 'external_reference'],
  dateFields: ['source_as_of', 'scheduled_start', 'scheduled_end'],
  verifyBeforeActing: ['source_record_id', 'entity_id', 'linked_job_id', 'status', 'scheduled_start', 'scheduled_end', 'amount'],
  fieldAuthority: { status: 'UNVERIFIED_VS_HCP', scheduled_start: 'UNVERIFIED_VS_HCP', scheduled_end: 'UNVERIFIED_VS_HCP', amount: 'UNVERIFIED_VS_HCP' },
  fields: {
    source_record_id: ['source_record_id', 'record_id'], source_as_of: ['source_as_of', 'updated_at', 'modified_at'],
    module: ['module', 'surface', 'domain'], entity_type: ['entity_type', 'record_type', 'type'], entity_id: ['entity_id', 'record_id'],
    external_reference: ['external_reference'], linked_job_id: ['linked_job_id', 'job_id'], status: ['status', 'state'],
    scheduled_start: ['scheduled_start', 'appointment_start', 'start_at'], scheduled_end: ['scheduled_end', 'appointment_end', 'end_at'],
    amount: ['amount', 'total_amount', 'invoice_total', 'quote_total'],
  },
};
