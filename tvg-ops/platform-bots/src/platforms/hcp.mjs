export const hcpContract = {
  version: 'TVG-HCP-CONTRACT-001-v0.2',
  bot: 'TVG-HCP-BOT-001', platform: 'HOUSECALL_PRO', recordType: 'JOB_APPOINTMENT',
  routing: ['DISPATCH', 'CUSTOMER_CARE', 'SERVICE', 'FINANCE'],
  sourceAuthority: 'HOUSECALL_PRO_OPERATIONAL_SOURCE',
  requiredIdentityFields: ['job_id'], identityFields: ['source_record_id', 'customer_id', 'job_id', 'appointment_id', 'external_reference'],
  dateFields: ['source_as_of', 'scheduled_start', 'scheduled_end'],
  untrustedTextFields: ['job_type'],
  verifyBeforeActing: ['source_record_id', 'job_id', 'scheduled_start', 'scheduled_end', 'total_amount'],
  fieldAuthority: { status: 'HOUSECALL_PRO', scheduled_start: 'HOUSECALL_PRO', scheduled_end: 'HOUSECALL_PRO', total_amount: 'HOUSECALL_PRO' },
  fields: {
    source_record_id: ['source_record_id', 'job_id'], source_as_of: ['source_as_of', 'updated_at', 'modified_at'],
    customer_id: ['customer_id', 'customer.id'], job_id: ['job_id'], appointment_id: ['appointment_id'],
    external_reference: ['external_reference', 'po_number', 'work_order_number'],
    linked_job_id: ['job_id'], scheduled_start: ['scheduled_start', 'start_at', 'appointment_start'],
    scheduled_end: ['scheduled_end', 'end_at', 'appointment_end'], status: ['status', 'job_status'],
    total_amount: ['total_amount', 'amount', 'invoice_total'], job_type: ['job_type', 'service_type', 'work_type'],
  },
};
