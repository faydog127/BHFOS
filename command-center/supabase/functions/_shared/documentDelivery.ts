import { supabaseAdmin } from './supabaseAdmin.ts';
import { normalizePhone } from './sms.ts';

type DeliveryChannel = 'email' | 'sms';

type LeadDeliveryProfile = {
  leadId: string | null;
  tenantId: string | null;
  contactId: string | null;
  email: string | null;
  phone: string | null;
  preferredDocumentDelivery: 'auto' | DeliveryChannel | null;
  preferredContactMethod: string | null;
  smsConsent: boolean | null;
  smsOptOut: boolean;
};

type DeliveryResolutionReason =
  | 'requested_email'
  | 'requested_sms'
  | 'preferred_document_delivery'
  | 'preferred_contact_method'
  | 'email_only'
  | 'phone_only'
  | 'default_email'
  | 'requested_email_unavailable_fallback_sms'
  | 'requested_sms_unavailable_fallback_email'
  | 'sms_opt_out_fallback_email'
  | 'no_deliverable_channel';

type DeliveryResolution = {
  requestedChannel: DeliveryChannel | null;
  deliveryChannel: DeliveryChannel | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  canEmail: boolean;
  canSms: boolean;
  smsOptOut: boolean;
  preferredChannel: DeliveryChannel | null;
  preferredDocumentDelivery: 'auto' | DeliveryChannel | null;
  preferredContactMethod: string | null;
  resolutionReason: DeliveryResolutionReason;
  missingFields: string[];
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
};

const isValidEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(value));

const normalizeRequestedDeliveryChannel = (value: unknown): DeliveryChannel | null => {
  const normalized = asString(value).toLowerCase();
  if (!normalized) return null;
  if (['sms', 'text', 'txt'].includes(normalized)) return 'sms';
  if (['email', 'mail'].includes(normalized)) return 'email';
  return null;
};

const normalizePreferredDocumentDelivery = (value: unknown): 'auto' | DeliveryChannel | null => {
  const normalized = asString(value).toLowerCase();
  if (!normalized) return null;
  if (['auto', 'default'].includes(normalized)) return 'auto';
  if (['sms', 'text', 'txt'].includes(normalized)) return 'sms';
  if (['email', 'mail'].includes(normalized)) return 'email';
  return null;
};

const preferredContactMethodToChannel = (value: unknown): DeliveryChannel | null => {
  const normalized = asString(value).toLowerCase();
  if (normalized === 'phone') return 'sms';
  if (normalized === 'email') return 'email';
  return null;
};

const buildNoChannelResolution = (params: {
  requestedChannel: DeliveryChannel | null;
  canEmail: boolean;
  canSms: boolean;
  smsOptOut: boolean;
  preferredChannel: DeliveryChannel | null;
  preferredDocumentDelivery: 'auto' | DeliveryChannel | null;
  preferredContactMethod: string | null;
}): DeliveryResolution => {
  const missingFields: string[] = [];
  if (!params.canEmail) missingFields.push('lead_email');
  if (!params.canSms) missingFields.push(params.smsOptOut ? 'sms_opt_out' : 'lead_phone');

  return {
    requestedChannel: params.requestedChannel,
    deliveryChannel: null,
    recipientEmail: null,
    recipientPhone: null,
    canEmail: params.canEmail,
    canSms: params.canSms,
    smsOptOut: params.smsOptOut,
    preferredChannel: params.preferredChannel,
    preferredDocumentDelivery: params.preferredDocumentDelivery,
    preferredContactMethod: params.preferredContactMethod,
    resolutionReason: 'no_deliverable_channel',
    missingFields,
  };
};

const chooseResolution = (params: {
  requestedChannel: DeliveryChannel | null;
  deliveryChannel: DeliveryChannel;
  email: string | null;
  phone: string | null;
  canEmail: boolean;
  canSms: boolean;
  smsOptOut: boolean;
  preferredChannel: DeliveryChannel | null;
  preferredDocumentDelivery: 'auto' | DeliveryChannel | null;
  preferredContactMethod: string | null;
  resolutionReason: DeliveryResolutionReason;
}): DeliveryResolution => ({
  requestedChannel: params.requestedChannel,
  deliveryChannel: params.deliveryChannel,
  recipientEmail: params.deliveryChannel === 'email' ? params.email : null,
  recipientPhone: params.deliveryChannel === 'sms' ? params.phone : null,
  canEmail: params.canEmail,
  canSms: params.canSms,
  smsOptOut: params.smsOptOut,
  preferredChannel: params.preferredChannel,
  preferredDocumentDelivery: params.preferredDocumentDelivery,
  preferredContactMethod: params.preferredContactMethod,
  resolutionReason: params.resolutionReason,
  missingFields: [],
});

const resolveDocumentDelivery = (params: {
  requestedChannel?: DeliveryChannel | null;
  email?: string | null;
  phone?: string | null;
  preferredDocumentDelivery?: 'auto' | DeliveryChannel | null;
  preferredContactMethod?: string | null;
  smsOptOut?: boolean | null;
}): DeliveryResolution => {
  const email = isValidEmail(params.email) ? asString(params.email) : null;
  const normalizedPhone = normalizePhone(params.phone ?? null);
  const smsOptOut = params.smsOptOut === true;
  const canEmail = Boolean(email);
  const canSms = Boolean(normalizedPhone) && !smsOptOut;
  const requestedChannel = params.requestedChannel ?? null;
  const preferredDocumentDelivery = params.preferredDocumentDelivery ?? null;
  const preferredContactMethod = asString(params.preferredContactMethod) || null;
  const preferredChannel =
    (preferredDocumentDelivery && preferredDocumentDelivery !== 'auto'
      ? preferredDocumentDelivery
      : null) || preferredContactMethodToChannel(preferredContactMethod);

  if (requestedChannel === 'email') {
    if (canEmail) {
      return chooseResolution({
        requestedChannel,
        deliveryChannel: 'email',
        email,
        phone: normalizedPhone,
        canEmail,
        canSms,
        smsOptOut,
        preferredChannel,
        preferredDocumentDelivery,
        preferredContactMethod,
        resolutionReason: 'requested_email',
      });
    }
    if (canSms) {
      return chooseResolution({
        requestedChannel,
        deliveryChannel: 'sms',
        email,
        phone: normalizedPhone,
        canEmail,
        canSms,
        smsOptOut,
        preferredChannel,
        preferredDocumentDelivery,
        preferredContactMethod,
        resolutionReason: 'requested_email_unavailable_fallback_sms',
      });
    }
    return buildNoChannelResolution({
      requestedChannel,
      canEmail,
      canSms,
      smsOptOut,
      preferredChannel,
      preferredDocumentDelivery,
      preferredContactMethod,
    });
  }

  if (requestedChannel === 'sms') {
    if (canSms) {
      return chooseResolution({
        requestedChannel,
        deliveryChannel: 'sms',
        email,
        phone: normalizedPhone,
        canEmail,
        canSms,
        smsOptOut,
        preferredChannel,
        preferredDocumentDelivery,
        preferredContactMethod,
        resolutionReason: 'requested_sms',
      });
    }
    if (canEmail) {
      return chooseResolution({
        requestedChannel,
        deliveryChannel: 'email',
        email,
        phone: normalizedPhone,
        canEmail,
        canSms,
        smsOptOut,
        preferredChannel,
        preferredDocumentDelivery,
        preferredContactMethod,
        resolutionReason: smsOptOut ? 'sms_opt_out_fallback_email' : 'requested_sms_unavailable_fallback_email',
      });
    }
    return buildNoChannelResolution({
      requestedChannel,
      canEmail,
      canSms,
      smsOptOut,
      preferredChannel,
      preferredDocumentDelivery,
      preferredContactMethod,
    });
  }

  if (preferredChannel === 'sms' && canSms) {
    return chooseResolution({
      requestedChannel,
      deliveryChannel: 'sms',
      email,
      phone: normalizedPhone,
      canEmail,
      canSms,
      smsOptOut,
      preferredChannel,
      preferredDocumentDelivery,
      preferredContactMethod,
      resolutionReason: preferredDocumentDelivery === 'sms' ? 'preferred_document_delivery' : 'preferred_contact_method',
    });
  }

  if (preferredChannel === 'email' && canEmail) {
    return chooseResolution({
      requestedChannel,
      deliveryChannel: 'email',
      email,
      phone: normalizedPhone,
      canEmail,
      canSms,
      smsOptOut,
      preferredChannel,
      preferredDocumentDelivery,
      preferredContactMethod,
      resolutionReason: preferredDocumentDelivery === 'email' ? 'preferred_document_delivery' : 'preferred_contact_method',
    });
  }

  if (canEmail && !canSms) {
    return chooseResolution({
      requestedChannel,
      deliveryChannel: 'email',
      email,
      phone: normalizedPhone,
      canEmail,
      canSms,
      smsOptOut,
      preferredChannel,
      preferredDocumentDelivery,
      preferredContactMethod,
      resolutionReason: 'email_only',
    });
  }

  if (canSms && !canEmail) {
    return chooseResolution({
      requestedChannel,
      deliveryChannel: 'sms',
      email,
      phone: normalizedPhone,
      canEmail,
      canSms,
      smsOptOut,
      preferredChannel,
      preferredDocumentDelivery,
      preferredContactMethod,
      resolutionReason: 'phone_only',
    });
  }

  if (canEmail) {
    return chooseResolution({
      requestedChannel,
      deliveryChannel: 'email',
      email,
      phone: normalizedPhone,
      canEmail,
      canSms,
      smsOptOut,
      preferredChannel,
      preferredDocumentDelivery,
      preferredContactMethod,
      resolutionReason: 'default_email',
    });
  }

  if (canSms) {
    return chooseResolution({
      requestedChannel,
      deliveryChannel: 'sms',
      email,
      phone: normalizedPhone,
      canEmail,
      canSms,
      smsOptOut,
      preferredChannel,
      preferredDocumentDelivery,
      preferredContactMethod,
      resolutionReason: 'phone_only',
    });
  }

  return buildNoChannelResolution({
    requestedChannel,
    canEmail,
    canSms,
    smsOptOut,
    preferredChannel,
    preferredDocumentDelivery,
    preferredContactMethod,
  });
};

const loadLeadDeliveryProfile = async (params: {
  leadId?: string | null;
  tenantId?: string | null;
}): Promise<LeadDeliveryProfile | null> => {
  const leadId = asString(params.leadId);
  if (!leadId) return null;

  let leadQuery = supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId);

  if (params.tenantId) {
    leadQuery = leadQuery.eq('tenant_id', params.tenantId);
  }

  const { data: leadRow, error: leadError } = await leadQuery.maybeSingle();
  if (leadError || !leadRow) {
    if (leadError) {
      console.warn('loadLeadDeliveryProfile lead lookup failed:', leadError.message || leadError);
    }
    return null;
  }

  const contactId = asString((leadRow as Record<string, unknown>).contact_id) || null;
  let preferredContactMethod: string | null = null;

  if (contactId) {
    const { data: contactRow, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('preferred_contact_method')
      .eq('id', contactId)
      .maybeSingle();

    if (!contactError && contactRow) {
      preferredContactMethod = asString((contactRow as Record<string, unknown>).preferred_contact_method) || null;
    }
  }

  return {
    leadId,
    tenantId: asString((leadRow as Record<string, unknown>).tenant_id) || params.tenantId || null,
    contactId,
    email: asString((leadRow as Record<string, unknown>).email) || null,
    phone: asString((leadRow as Record<string, unknown>).phone) || null,
    preferredDocumentDelivery:
      normalizePreferredDocumentDelivery((leadRow as Record<string, unknown>).preferred_document_delivery),
    preferredContactMethod,
    smsConsent:
      typeof (leadRow as Record<string, unknown>).sms_consent === 'boolean'
        ? Boolean((leadRow as Record<string, unknown>).sms_consent)
        : null,
    smsOptOut: (leadRow as Record<string, unknown>).sms_opt_out === true,
  };
};

const persistDocumentDeliveryPreference = async (params: {
  leadId?: string | null;
  tenantId?: string | null;
  deliveryChannel: DeliveryChannel;
}) => {
  const leadId = asString(params.leadId);
  if (!leadId) return;

  const nowIso = new Date().toISOString();
  let contactId: string | null = null;

  let leadQuery = supabaseAdmin
    .from('leads')
    .select('contact_id')
    .eq('id', leadId);

  if (params.tenantId) {
    leadQuery = leadQuery.eq('tenant_id', params.tenantId);
  }

  const { data: leadRow } = await leadQuery.maybeSingle();
  contactId = asString((leadRow as Record<string, unknown> | null)?.contact_id) || null;

  let updateLeadQuery = supabaseAdmin
    .from('leads')
    .update({
      preferred_document_delivery: params.deliveryChannel,
      updated_at: nowIso,
    })
    .eq('id', leadId);

  if (params.tenantId) {
    updateLeadQuery = updateLeadQuery.eq('tenant_id', params.tenantId);
  }

  const { error: leadUpdateError } = await updateLeadQuery;
  if (leadUpdateError && !isMissingColumnError(leadUpdateError)) {
    console.warn('persistDocumentDeliveryPreference lead update failed:', leadUpdateError.message || leadUpdateError);
  }

  if (!contactId) return;

  const { error: contactUpdateError } = await supabaseAdmin
    .from('contacts')
    .update({
      preferred_contact_method: params.deliveryChannel === 'sms' ? 'phone' : 'email',
      updated_at: nowIso,
    })
    .eq('id', contactId);

  if (contactUpdateError && !isMissingColumnError(contactUpdateError)) {
    console.warn('persistDocumentDeliveryPreference contact update failed:', contactUpdateError.message || contactUpdateError);
  }
};

export {
  isValidEmail,
  loadLeadDeliveryProfile,
  normalizeRequestedDeliveryChannel,
  persistDocumentDeliveryPreference,
  preferredContactMethodToChannel,
  resolveDocumentDelivery,
};

export type {
  DeliveryChannel,
  DeliveryResolution,
  LeadDeliveryProfile,
};
