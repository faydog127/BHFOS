/**
 * Pass 1 notification recipient model.
 * Founder-only internal SMS. No escalation cadence. No free-text urgency class.
 */
const LABEL = /^[a-z][a-z0-9_]{0,63}$/;

export const PASS1_RECIPIENT = Object.freeze({
  recipientKey: 'founder',
  channel: 'internal_sms',
  destinationRef: 'founder_mobile_ref',
  enabled: false,
  escalationAfter: null,
});

export function assertPass1Recipient(row) {
  const recipientKey = String(row?.recipientKey || '');
  const channel = String(row?.channel || '');
  if (recipientKey !== 'founder') throw new Error('Pass 1 recipient is Founder only');
  if (channel !== 'internal_sms') throw new Error('Pass 1 channel is internal SMS only');
  if (row?.escalationAfter != null) throw new Error('Pass 1 does not set an escalation cadence');
  const destinationRef = String(row?.destinationRef || '');
  if (!LABEL.test(destinationRef)) throw new Error('destination ref must be the Founder-approved settings label');
  if (row?.urgency != null || row?.urgencyClass != null) {
    throw new Error('free-text urgency classification is outside Pass 1');
  }
  return {
    recipientKey,
    channel,
    destinationRef,
    enabled: row?.enabled === true,
    escalationAfter: null,
  };
}

export function resolvePass1Recipients(rows) {
  const source = Array.isArray(rows) && rows.length > 0 ? rows : [PASS1_RECIPIENT];
  return source.map((row) => assertPass1Recipient(row));
}
