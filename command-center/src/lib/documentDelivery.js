const asString = (value) => (typeof value === 'string' ? value.trim() : '');

export const normalizeDeliveryChannel = (value) => {
  const normalized = asString(value).toLowerCase();
  if (['sms', 'text', 'txt'].includes(normalized)) return 'sms';
  if (['email', 'mail'].includes(normalized)) return 'email';
  return null;
};

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(value));

export const normalizePhoneForDelivery = (value) => {
  const raw = asString(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (raw.startsWith('+')) {
    if (digits.length < 10 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return `+${digits}`;
  return null;
};

const preferredContactMethodToChannel = (value) => {
  const normalized = asString(value).toLowerCase();
  if (normalized === 'phone') return 'sms';
  if (normalized === 'email') return 'email';
  return null;
};

const normalizePreferredDocumentDelivery = (value) => {
  const normalized = asString(value).toLowerCase();
  if (!normalized) return null;
  if (['auto', 'default'].includes(normalized)) return 'auto';
  if (['email', 'mail'].includes(normalized)) return 'email';
  if (['sms', 'text', 'txt'].includes(normalized)) return 'sms';
  return null;
};

export const getLeadDeliveryProfile = (lead) => {
  const preferredDocumentDelivery = normalizePreferredDocumentDelivery(
    lead?.preferred_document_delivery,
  );
  const preferredContactMethod = asString(
    lead?.contact?.preferred_contact_method || lead?.preferred_contact_method,
  ) || null;
  const email = isValidEmail(lead?.email) ? asString(lead?.email) : null;
  const phone = normalizePhoneForDelivery(lead?.phone);
  const smsOptOut = lead?.sms_opt_out === true;
  const canEmail = Boolean(email);
  const canSms = Boolean(phone) && !smsOptOut;
  const preferredChannel =
    (preferredDocumentDelivery && preferredDocumentDelivery !== 'auto'
      ? preferredDocumentDelivery
      : null) || preferredContactMethodToChannel(preferredContactMethod);

  return {
    email,
    phone,
    canEmail,
    canSms,
    smsOptOut,
    preferredDocumentDelivery,
    preferredContactMethod,
    preferredChannel,
  };
};

export const resolveLeadDelivery = ({ lead, requestedChannel } = {}) => {
  const profile = getLeadDeliveryProfile(lead);
  const requested = normalizeDeliveryChannel(requestedChannel);

  if (requested === 'sms') {
    if (profile.canSms) {
      return { ...profile, requestedChannel: requested, channel: 'sms', reason: 'requested_sms' };
    }
    if (profile.canEmail) {
      return {
        ...profile,
        requestedChannel: requested,
        channel: 'email',
        reason: profile.smsOptOut ? 'sms_opt_out_fallback_email' : 'requested_sms_unavailable_fallback_email',
      };
    }
  }

  if (requested === 'email') {
    if (profile.canEmail) {
      return { ...profile, requestedChannel: requested, channel: 'email', reason: 'requested_email' };
    }
    if (profile.canSms) {
      return {
        ...profile,
        requestedChannel: requested,
        channel: 'sms',
        reason: 'requested_email_unavailable_fallback_sms',
      };
    }
  }

  if (profile.preferredChannel === 'sms' && profile.canSms) {
    return {
      ...profile,
      requestedChannel: requested,
      channel: 'sms',
      reason:
        profile.preferredDocumentDelivery === 'sms'
          ? 'preferred_document_delivery'
          : 'preferred_contact_method',
    };
  }

  if (profile.preferredChannel === 'email' && profile.canEmail) {
    return {
      ...profile,
      requestedChannel: requested,
      channel: 'email',
      reason:
        profile.preferredDocumentDelivery === 'email'
          ? 'preferred_document_delivery'
          : 'preferred_contact_method',
    };
  }

  if (profile.canEmail && !profile.canSms) {
    return { ...profile, requestedChannel: requested, channel: 'email', reason: 'email_only' };
  }

  if (profile.canSms && !profile.canEmail) {
    return { ...profile, requestedChannel: requested, channel: 'sms', reason: 'phone_only' };
  }

  if (profile.canEmail) {
    return { ...profile, requestedChannel: requested, channel: 'email', reason: 'default_email' };
  }

  if (profile.canSms) {
    return { ...profile, requestedChannel: requested, channel: 'sms', reason: 'phone_only' };
  }

  return { ...profile, requestedChannel: requested, channel: null, reason: 'no_deliverable_channel' };
};

export const getDeliveryPreferenceLabel = (lead) => {
  const profile = getLeadDeliveryProfile(lead);
  if (profile.preferredDocumentDelivery === 'sms') return 'SMS preferred';
  if (profile.preferredDocumentDelivery === 'email') return 'Email preferred';
  if (profile.preferredContactMethod === 'phone') return 'Phone preferred';
  if (profile.preferredContactMethod === 'email') return 'Email preferred';
  if (!profile.canEmail && profile.canSms) return 'Phone only';
  if (profile.canEmail && !profile.canSms) return 'Email only';
  if (profile.smsOptOut) return 'SMS opted out';
  return 'Auto';
};
