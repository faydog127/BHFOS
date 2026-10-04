export const hcpContract = {
  bot: 'TVG-HCP-BOT-001',
  platform: 'HOUSECALL_PRO',
  recordType: 'JOB_APPOINTMENT',
  routing: ['DISPATCH', 'CUSTOMER_CARE', 'SERVICE', 'FINANCE'],
  fields: {
    source_record_id: ['source_record_id', 'job_id', 'id'],
    source_as_of: ['source_as_of', 'updated_at', 'modified_at'],
    customer_id: ['customer_id', 'customer.id'],
    job_id: ['job_id', 'id'],
    appointment_id: ['appointment_id'],
    scheduled_start: ['scheduled_start', 'start_at', 'appointment_start'],
    scheduled_end: ['scheduled_end', 'end_at', 'appointment_end'],
    status: ['status', 'job_status'],
    total_amount: ['total_amount', 'amount', 'invoice_total'],
    job_type: ['job_type', 'service_type', 'work_type'],
  },
};
