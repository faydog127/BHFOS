const asText = (value) => (value == null ? '' : String(value).trim());

const asTracking = (value) => asText(value).toUpperCase();

export const getWorkOrderDisplayId = (job) => {
  const workOrderNumber = asTracking(job?.work_order_number);
  if (workOrderNumber) return workOrderNumber;

  const legacyJobNumber = asTracking(job?.job_number);
  if (legacyJobNumber) return legacyJobNumber;

  const id = asText(job?.id);
  if (id) return `WO-LEGACY-${id.slice(0, 8).toUpperCase()}`;

  return 'WO-LEGACY-UNKNOWN';
};

