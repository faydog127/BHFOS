/**
 * Pass 1 notification recipient model.
 * One Founder destination until the Founder authorizes more.
 * No quiet hours, urgency detection, draft review, or reply voice.
 */
export const PASS1_FOUNDER_DESTINATION = 'founder_mobile_ref';

export const PASS1_RECIPIENT = Object.freeze({
  recipientKey: 'founder',
  channel: 'internal_sms',
  destinationRef: PASS1_FOUNDER_DESTINATION,
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
  if (destinationRef !== PASS1_FOUNDER_DESTINATION) {
    throw new Error('Pass 1 has a single Founder destination');
  }
  if (row?.urgency != null || row?.urgencyClass != null || row?.urgencyKeywords != null) {
    throw new Error('urgency detection is outside Pass 1');
  }
  if (row?.replyVoice != null || row?.draftReview != null) {
    throw new Error('reply voice and draft review are outside Pass 1');
  }
  return {
    recipientKey,
    channel,
    destinationRef,
    enabled: row?.enabled === true,
    escalationAfter: null,
  };
}

/**
 * After-hours acknowledgement stays off. That does not turn on auto-send.
 * Quiet hours, urgency keywords, draft review, and reply voice stay out of Pass 1.
 */
export function assertPass1SendBoundary(settings = {}) {
  if (settings.autoSendEnabled === true) throw new Error('auto send is outside Pass 1');
  if (settings.afterHoursAckEnabled === true) throw new Error('after-hours acknowledgement is disabled');
  if (settings.quietHours != null) throw new Error('quiet hours are outside Pass 1');
  if (settings.urgencyKeywords != null) throw new Error('urgency keyword rules are outside Pass 1');
  if (settings.replyVoice != null || settings.draftReview != null) {
    throw new Error('reply voice and draft review are outside Pass 1');
  }
  return {
    autoSendEnabled: false,
    afterHoursAckEnabled: false,
    quietHours: null,
    urgencyKeywords: null,
    replyVoice: null,
    draftReview: null,
  };
}

export function resolvePass1Recipients(rows) {
  const source = Array.isArray(rows) && rows.length > 0 ? rows : [PASS1_RECIPIENT];
  return source.map((row) => assertPass1Recipient(row));
}
