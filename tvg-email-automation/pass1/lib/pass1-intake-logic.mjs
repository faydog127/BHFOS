/**
 * TVG Email Pass 1 intake decisions (staging build).
 * Design source: pass1-v5 docs 04, 06, 07, plus the challenge supplement:
 * form path is known_form_senders allowlist only, and that From is judged
 * for form_auth_failure before any email_filter_lists deny can mark it filtered.
 *
 * No send path. No email_responses. No email_send_queue. No Hostinger calls.
 */

export const PSL_SUBSET_ID = 'tvg-email-pass1-psl-subset-2026-09-24';

/** Not the Mozilla public suffix list. Pre-webhook must pin a full PSL package. */
export const PSL_SUBSET = Object.freeze([
  'com',
  'net',
  'org',
  'uk',
  'co.uk',
  'org.uk',
  'com.au',
  'co.nz',
  'com.br',
]);

const EVENT_STATUSES = new Set([
  'filtered',
  'system_lessen',
  'held',
  'awaiting_pass2',
  'duplicate_ignored',
  'error',
]);

const QUEUE_STATUSES = new Set(['done', 'duplicate', 'held', 'error']);

const HOLD_REASONS = new Set([
  'form_auth_failure',
  'phone_conflict',
  'reply_to_domain_mismatch',
  'ambiguous_recipient',
  'ambiguous_contact',
  'message_moved_uncertain',
  'stale_processing',
  'cross_tenant_match',
]);

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

function sha256HexFromBytes(bytes) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  const padLen = (56 - (withOne % 64) + 64) % 64;
  const total = bytes.length + 1 + padLen + 8;
  const buf = new Uint8Array(total);
  buf.set(bytes, 0);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(bitLen / 2 ** 32));
  view.setUint32(total - 4, bitLen >>> 0);
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(i + t * 4);
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];
    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
}

export function sha256Hex(text) {
  return sha256HexFromBytes(new TextEncoder().encode(String(text)));
}

export function quoteLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite number');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const text = String(value);
  if (text.includes('\u0000')) throw new Error('NUL not allowed');
  return `'${text.replace(/'/g, "''")}'`;
}

function requireUuid(value) {
  const text = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error('expected uuid');
  }
  return text.toLowerCase();
}

export function normalizeEmail(raw) {
  if (raw == null) return '';
  let text = String(raw).trim();
  const angle = text.match(/<([^<>]+)>/);
  if (angle) text = angle[1].trim();
  text = text.toLowerCase();
  if (!text || /\s/.test(text) || !text.includes('@')) return '';
  const parts = text.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return '';
  return text;
}

export function normalizeSubject(raw) {
  if (raw == null) return '';
  return String(raw)
    .normalize('NFC')
    .replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '')
    .replace(/[\t\n\r\f\v\u00a0 ]+/g, ' ')
    .toLowerCase();
}

export function normalizeDateHeader(raw) {
  if (raw == null || String(raw).trim() === '') return '';
  return String(raw)
    .normalize('NFC')
    .replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '')
    .replace(/[\t\n\r\f\v\u00a0 ]+/g, ' ');
}

function decodeHtmlEntities(text) {
  const named = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
  };
  let out = text;
  for (const [from, to] of Object.entries(named)) out = out.split(from).join(to);
  out = out.replace(/&#x([0-9a-f]+);/gi, (_m, hex) => codePointToChar(parseInt(hex, 16)));
  out = out.replace(/&#(\d+);/g, (_m, dec) => codePointToChar(parseInt(dec, 10)));
  return out;
}

function codePointToChar(n) {
  if (!Number.isFinite(n)) return '';
  const allowed = n === 0x09 || n === 0x0a || n === 0x0d || (n >= 0x20 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff));
  if (!allowed) return '';
  return String.fromCodePoint(n);
}

export function htmlToTextV1(html) {
  let text = String(html ?? '').normalize('NFC');
  let prev;
  do {
    prev = text;
    text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  } while (text !== prev);
  text = text.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>|<\/li>|<\/h[1-6]>|<\/table>|<\/blockquote>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(text);
}

export function normalizeBodyV1({ bodyText, bodyHtml }) {
  let source = '';
  if (bodyText != null && String(bodyText).trim() !== '') source = String(bodyText);
  else if (bodyHtml != null && String(bodyHtml).trim() !== '') source = htmlToTextV1(bodyHtml);
  let text = source.normalize('NFC').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t\v\f\u00a0]+$/g, ''))
    .join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  return text;
}

export function registrableDomain(host, suffixes = PSL_SUBSET) {
  const normalized = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!normalized || normalized.includes(' ') || !normalized.includes('.')) return '';
  const labels = normalized.split('.');
  const set = new Set(suffixes.map((s) => s.toLowerCase()));
  let best = '';
  for (let i = 0; i < labels.length; i += 1) {
    const candidate = labels.slice(i).join('.');
    if (set.has(candidate) && candidate.length > best.length) best = candidate;
  }
  if (!best) return labels.slice(-2).join('.');
  const suffixLen = best.split('.').length;
  if (labels.length <= suffixLen) return normalized;
  return labels.slice(-(suffixLen + 1)).join('.');
}

export function parseAuthResults(header) {
  const text = String(header || '');
  const grab = (name) => {
    const match = text.match(new RegExp(`\\b${name}\\s*=\\s*(pass|fail|softfail|neutral|none|temperror|permerror)\\b`, 'i'));
    return match ? match[1].toLowerCase() : '';
  };
  const spf = grab('spf');
  const dkim = grab('dkim');
  const dmarc = grab('dmarc');
  return {
    spf,
    dkim,
    dmarc,
    spf_pass: spf === 'pass',
    dkim_pass: dkim === 'pass',
    dmarc_pass: dmarc === 'pass',
    all_pass: spf === 'pass' && dkim === 'pass' && dmarc === 'pass',
  };
}

const POINTER_RULES = {
  mailbox_resource_id: /^[A-Za-z0-9_-]{1,128}$/,
  folder: /^[A-Za-z0-9._-]{1,128}$/,
  mailbox: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  event_type: /^[A-Za-z0-9._:-]{1,80}$/,
};

function firstPresent(candidates) {
  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

export function normalizeWebhookPointer(body) {
  const source = body && typeof body === 'object' ? body : {};
  const data = source.data && typeof source.data === 'object' ? source.data : {};
  const mailboxResourceId = firstPresent([
    source.mailboxResourceId,
    source.mailbox_resource_id,
    data.mailboxResourceId,
    data.mailbox_resource_id,
  ]);
  const folder = firstPresent([source.folder, data.folder]);
  const uidRaw = firstPresent([source.uid, data.uid]);
  const mailbox = firstPresent([source.mailbox, source.mailboxAddress, data.mailbox, data.mailboxAddress]);
  const eventType = firstPresent([source.event, source.event_type, source.type, data.event, data.event_type]);
  const uidText = uidRaw == null ? '' : String(uidRaw);
  if (!POINTER_RULES.mailbox_resource_id.test(String(mailboxResourceId || ''))) {
    return { ok: false, reason: 'pointer_incomplete' };
  }
  if (!POINTER_RULES.folder.test(String(folder || ''))) return { ok: false, reason: 'pointer_incomplete' };
  if (!/^\d{1,18}$/.test(uidText)) return { ok: false, reason: 'pointer_incomplete' };
  if (!POINTER_RULES.mailbox.test(String(mailbox || ''))) return { ok: false, reason: 'pointer_incomplete' };
  if (eventType != null && eventType !== '' && !POINTER_RULES.event_type.test(String(eventType))) {
    return { ok: false, reason: 'pointer_incomplete' };
  }
  return {
    ok: true,
    tenant_id: 'tvg',
    mailbox_resource_id: String(mailboxResourceId),
    folder: String(folder),
    uid: uidText,
    mailbox: String(mailbox).toLowerCase(),
    event_type: eventType ? String(eventType) : null,
  };
}

function settingValue(settings, key) {
  if (!settings || typeof settings !== 'object') return undefined;
  return settings[key];
}

function isEnabledFormSender(row, fromEmail) {
  if (!row || row.enabled === false) return false;
  return normalizeEmail(row.from_email) === fromEmail && fromEmail !== '';
}

function filterField(row, message) {
  const fromEmail = message.from_email || '';
  const local = fromEmail.split('@')[0] || '';
  const domain = fromEmail.split('@')[1] || '';
  const registrable = message.from_registrable || '';
  switch (row.kind) {
    case 'sender_deny':
    case 'sender_allow':
      return fromEmail;
    case 'domain_deny':
    case 'domain_allow':
    case 'vendor':
      return row.match_mode === 'domain' ? domain : registrable;
    case 'noreply_pattern':
      return local;
    case 'list_pattern':
      return `${message.list_id || ''} ${message.precedence_header || ''}`.toLowerCase();
    default:
      return '';
  }
}

function rowMatches(row, message) {
  if (!row || row.enabled === false) return false;
  const field = filterField(row, message);
  const pattern = String(row.pattern || '');
  const mode = row.match_mode || 'exact';
  if (mode === 'exact') return field.toLowerCase() === pattern.toLowerCase();
  if (mode === 'domain') {
    const domain = (message.from_email || '').split('@')[1] || '';
    const needle = pattern.toLowerCase();
    return domain.toLowerCase() === needle || (message.from_registrable || '') === needle;
  }
  if (mode === 'contains') return field.toLowerCase().includes(pattern.toLowerCase());
  if (mode === 'regex') {
    try {
      return new RegExp(pattern, 'i').test(field);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Filter-kind field map used by this staging build.
 * Command Center item 1 is still OPEN; this is the implement default, not a signed lock.
 */
export const FILTER_FIELD_MAP = Object.freeze({
  sender_deny: 'normalized From addr-spec',
  sender_allow: 'normalized From addr-spec',
  domain_deny: 'From domain (match_mode=domain compares domain or registrable domain)',
  domain_allow: 'From domain (same as domain_deny)',
  vendor: 'From domain',
  noreply_pattern: 'From local-part',
  list_pattern: 'List-Id header plus Precedence header',
  form_path: 'known_form_senders.from_email exact match on normalized From only',
});

export function applyFilterLists(message, filterRows, { skipDeny = false } = {}) {
  const matches = (filterRows || []).filter((row) => rowMatches(row, message));
  const lessen = matches.find((row) => row.action === 'system_lessen' || row.kind === 'vendor');
  if (lessen && lessen.action === 'system_lessen') {
    return { outcome: 'system_lessen', reason: lessen.reason_code || 'vendor_lessen' };
  }
  if (!skipDeny) {
    const deny = matches.find((row) => row.action === 'deny');
    if (deny) return { outcome: 'filtered', reason: deny.reason_code || 'deny' };
  }
  return { outcome: 'none', reason: null };
}

function headerFilter(message) {
  if (message.is_dsn) return { outcome: 'filtered', reason: 'dsn' };
  const auto = String(message.auto_submitted || '').trim().toLowerCase();
  if (auto && auto !== 'no') return { outcome: 'filtered', reason: 'auto_submitted' };
  const precedence = String(message.precedence_header || '').trim().toLowerCase();
  if (['bulk', 'list', 'junk'].includes(precedence)) return { outcome: 'filtered', reason: 'precedence' };
  if (message.list_id) return { outcome: 'filtered', reason: 'list_id' };
  if (message.from_email && message.mailbox_email && message.from_email === message.mailbox_email) {
    return { outcome: 'filtered', reason: 'self_mail' };
  }
  return null;
}

function digits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function computeIdentity(message) {
  const body = normalizeBodyV1(message);
  const bodyHash = sha256Hex(body);
  const rawId = message.message_id == null ? '' : String(message.message_id).trim();
  const messageId = rawId ? rawId.replace(/^<|>$/g, '') : '';
  let fallbackHash = null;
  if (!messageId) {
    const canonical = [
      message.mailbox_email || '',
      message.from_email || '',
      message.to_email || '',
      normalizeSubject(message.subject),
      normalizeDateHeader(message.date_header),
      bodyHash,
    ].join('\u001f');
    fallbackHash = `v2:${sha256Hex(canonical)}`;
  }
  return {
    message_id: messageId || null,
    fallback_hash: fallbackHash,
    body_hash: bodyHash,
    body_normalized: body,
  };
}

function prepareMessage(message, suffixes) {
  const fromEmail = normalizeEmail(message.from_raw ?? message.from_email);
  const replyTo = normalizeEmail(message.reply_to_raw ?? message.reply_to_email);
  const toEmail = normalizeEmail(message.to_raw ?? message.to_email);
  const mailboxEmail = normalizeEmail(message.mailbox);
  const domain = fromEmail.split('@')[1] || '';
  return {
    ...message,
    from_email: fromEmail,
    reply_to_email: replyTo,
    to_email: toEmail,
    mailbox_email: mailboxEmail,
    from_registrable: registrableDomain(domain, suffixes),
    reply_to_registrable: registrableDomain((replyTo.split('@')[1] || ''), suffixes),
  };
}

function resolveRecipient(message, { isForm, authPass, formSender }) {
  if (isForm && !authPass) {
    return { hold_reason: 'form_auth_failure', resolved_recipient: null, recipient_resolution: null };
  }
  if (isForm && authPass && formSender && formSender.trust_reply_to !== false && message.reply_to_email) {
    const self = message.reply_to_email === message.mailbox_email;
    if (!self) {
      return {
        hold_reason: null,
        resolved_recipient: message.reply_to_email,
        recipient_resolution: 'reply_to_trusted_form',
      };
    }
  }
  if (isForm && authPass) {
    const formEmail = normalizeEmail(message.form_field_email);
    if (formEmail) {
      return { hold_reason: null, resolved_recipient: formEmail, recipient_resolution: 'form_field' };
    }
  }
  if (!isForm && message.reply_to_email && message.reply_to_registrable && message.from_registrable
    && message.reply_to_registrable !== message.from_registrable) {
    return { hold_reason: 'reply_to_domain_mismatch', resolved_recipient: null, recipient_resolution: null };
  }
  if (message.from_email && message.from_email !== message.mailbox_email) {
    return { hold_reason: null, resolved_recipient: message.from_email, recipient_resolution: 'from' };
  }
  return { hold_reason: 'ambiguous_recipient', resolved_recipient: null, recipient_resolution: null };
}

function matchCrm(message, contacts, leads, settings, resolvedRecipient) {
  const rows = Array.isArray(contacts) ? contacts : [];
  const nonTvg = rows.filter((row) => row.tenant_id && row.tenant_id !== 'tvg'
    && normalizeEmail(row.email) === resolvedRecipient);
  if (nonTvg.length) {
    return { hold_reason: 'cross_tenant_match', contact_id: null, lead_id: null };
  }
  const emailHits = rows.filter((row) => (row.tenant_id == null || row.tenant_id === 'tvg')
    && normalizeEmail(row.email) === resolvedRecipient);
  if (emailHits.length > 1) {
    return { hold_reason: 'ambiguous_contact', contact_id: null, lead_id: null };
  }
  const contact = emailHits[0] || null;
  const phone = digits(message.phone);
  if (phone.length >= 7) {
    const phoneHits = rows.filter((row) => digits(row.phone) === phone);
    const foreign = phoneHits.filter((row) => row.tenant_id && row.tenant_id !== 'tvg');
    if (foreign.length) return { hold_reason: 'cross_tenant_match', contact_id: null, lead_id: null };
    const tvgHits = phoneHits.filter((row) => !row.tenant_id || row.tenant_id === 'tvg');
    const conflict = tvgHits.filter((row) => normalizeEmail(row.email) !== resolvedRecipient);
    if (tvgHits.length > 1 || conflict.length) {
      return { hold_reason: 'phone_conflict', contact_id: null, lead_id: null };
    }
  }
  let leadId = null;
  if (contact) {
    const allow = settingValue(settings, 'open_lead_statuses');
    if (!Array.isArray(allow) || allow.length === 0) throw new Error('open_lead_statuses missing');
    const allowSet = new Set(allow.map((status) => String(status).toLowerCase()));
    const open = (leads || []).filter((lead) => lead.contact_id === contact.id
      && (!lead.tenant_id || lead.tenant_id === 'tvg')
      && allowSet.has(String(lead.status || '').toLowerCase()));
    if (open.length === 1) leadId = open[0].id;
  }
  return { hold_reason: null, contact_id: contact ? contact.id : null, lead_id: leadId };
}

export function evaluateIntake({
  message,
  filterRows = [],
  formSenders = [],
  settings = {},
  contacts = [],
  leads = [],
  pslSuffixes = PSL_SUBSET,
}) {
  if (settingValue(settings, 'hold_on_form_auth_failure') !== true) {
    throw new Error('hold_on_form_auth_failure_must_be_true');
  }
  const prepared = prepareMessage(message, pslSuffixes);
  const identity = computeIdentity(prepared);
  const auth = parseAuthResults(prepared.authentication_results);
  const formSender = (formSenders || []).find((row) => isEnabledFormSender(row, prepared.from_email)) || null;
  const isForm = Boolean(formSender);
  const base = {
    ...identity,
    from_email: prepared.from_email,
    reply_to_email: prepared.reply_to_email,
    spf_pass: auth.spf_pass,
    dkim_pass: auth.dkim_pass,
    dmarc_pass: auth.dmarc_pass,
    is_form_sender: isForm,
    contact_id: null,
    lead_id: null,
    resolved_recipient: null,
    recipient_resolution: null,
    hold_reason: null,
    filter_reason: null,
  };

  if (isForm && !auth.all_pass) {
    return {
      ...base,
      event_status: 'held',
      queue_status: 'held',
      hold_reason: 'form_auth_failure',
    };
  }

  const filtered = isForm
    ? applyFilterLists(prepared, filterRows, { skipDeny: true })
    : (headerFilter(prepared) || applyFilterLists(prepared, filterRows));
  if (filtered.outcome === 'filtered' || filtered.outcome === 'system_lessen') {
    return {
      ...base,
      event_status: filtered.outcome,
      queue_status: 'done',
      filter_reason: filtered.reason,
    };
  }

  const recipient = resolveRecipient(prepared, { isForm, authPass: auth.all_pass, formSender });
  if (recipient.hold_reason) {
    return {
      ...base,
      event_status: 'held',
      queue_status: 'held',
      hold_reason: recipient.hold_reason,
    };
  }

  const crm = matchCrm(prepared, contacts, leads, settings, recipient.resolved_recipient);
  if (crm.hold_reason) {
    return {
      ...base,
      event_status: 'held',
      queue_status: 'held',
      hold_reason: crm.hold_reason,
      resolved_recipient: recipient.resolved_recipient,
      recipient_resolution: recipient.recipient_resolution,
    };
  }

  return {
    ...base,
    event_status: 'awaiting_pass2',
    queue_status: 'done',
    resolved_recipient: recipient.resolved_recipient,
    recipient_resolution: recipient.recipient_resolution,
    contact_id: crm.contact_id,
    lead_id: crm.lead_id,
  };
}

export function buildOutcomeSql(input) {
  const queueId = requireUuid(input.queue_id);
  if (!EVENT_STATUSES.has(input.event_status)) throw new Error('bad event status');
  if (!QUEUE_STATUSES.has(input.queue_status)) throw new Error('bad queue status');
  if (input.hold_reason != null && !HOLD_REASONS.has(input.hold_reason)) throw new Error('bad hold reason');
  if (!input.message_id && !input.fallback_hash) throw new Error('identity required');
  const contactSql = input.contact_id == null ? 'NULL' : `${quoteLiteral(requireUuid(input.contact_id))}::uuid`;
  const leadSql = input.lead_id == null ? 'NULL' : `${quoteLiteral(requireUuid(input.lead_id))}::uuid`;
  const conflict = input.message_id
    ? 'ON CONFLICT (tenant_id, mailbox, message_id) WHERE message_id IS NOT NULL DO NOTHING'
    : 'ON CONFLICT (tenant_id, mailbox, fallback_hash) WHERE fallback_hash IS NOT NULL DO NOTHING';
  const identityWhere = input.message_id
    ? `message_id = ${quoteLiteral(input.message_id)}`
    : `fallback_hash = ${quoteLiteral(input.fallback_hash)}`;
  const excerpt = String(input.body_excerpt || '').slice(0, 500);
  return `
WITH inserted AS (
  INSERT INTO email_automation.email_events (
    tenant_id, mailbox, mailbox_resource_id, message_id, fallback_hash, folder, uid,
    status, filter_reason, hold_reason, from_email, reply_to_email, subject,
    message_date_header, body_hash, resolved_recipient, recipient_resolution,
    authentication_results, spf_pass, dkim_pass, dmarc_pass, body_text_excerpt,
    contact_id, lead_id, fetched_at
  ) VALUES (
    'tvg',
    ${quoteLiteral(input.mailbox)},
    ${quoteLiteral(input.mailbox_resource_id)},
    ${input.message_id ? quoteLiteral(input.message_id) : 'NULL'},
    ${input.fallback_hash ? quoteLiteral(input.fallback_hash) : 'NULL'},
    ${quoteLiteral(input.folder)},
    ${quoteLiteral(input.uid)}::bigint,
    ${quoteLiteral(input.event_status)}::email_automation.email_event_status,
    ${input.filter_reason ? quoteLiteral(input.filter_reason) : 'NULL'},
    ${input.hold_reason ? quoteLiteral(input.hold_reason) : 'NULL'},
    ${input.from_email ? quoteLiteral(input.from_email) : 'NULL'},
    ${input.reply_to_email ? quoteLiteral(input.reply_to_email) : 'NULL'},
    ${input.subject ? quoteLiteral(input.subject) : 'NULL'},
    ${input.date_header ? quoteLiteral(input.date_header) : 'NULL'},
    ${quoteLiteral(input.body_hash)},
    ${input.resolved_recipient ? quoteLiteral(input.resolved_recipient) : 'NULL'},
    ${input.recipient_resolution ? quoteLiteral(input.recipient_resolution) : 'NULL'},
    ${input.authentication_results ? quoteLiteral(input.authentication_results) : 'NULL'},
    ${input.spf_pass ? 'TRUE' : 'FALSE'},
    ${input.dkim_pass ? 'TRUE' : 'FALSE'},
    ${input.dmarc_pass ? 'TRUE' : 'FALSE'},
    ${excerpt ? quoteLiteral(excerpt) : 'NULL'},
    ${contactSql},
    ${leadSql},
    now()
  )
  ${conflict}
  RETURNING id
),
existing AS (
  SELECT id FROM email_automation.email_events
  WHERE tenant_id = 'tvg' AND mailbox = ${quoteLiteral(input.mailbox)} AND ${identityWhere}
),
chosen AS (
  SELECT id, FALSE AS was_existing FROM inserted
  UNION ALL
  SELECT id, TRUE AS was_existing FROM existing
  WHERE NOT EXISTS (SELECT 1 FROM inserted)
  LIMIT 1
)
UPDATE email_automation.intake_queue q
SET email_event_id = chosen.id,
    message_id = ${input.message_id ? quoteLiteral(input.message_id) : 'NULL'},
    fallback_hash = ${input.fallback_hash ? quoteLiteral(input.fallback_hash) : 'NULL'},
    status = CASE
      WHEN chosen.was_existing THEN 'duplicate'::email_automation.intake_queue_status
      ELSE ${quoteLiteral(input.queue_status)}::email_automation.intake_queue_status
    END,
    hold_reason = ${input.hold_reason ? quoteLiteral(input.hold_reason) : 'NULL'}
FROM chosen
WHERE q.id = ${quoteLiteral(queueId)}::uuid
  AND q.tenant_id = 'tvg'
RETURNING q.id, q.status, q.email_event_id, chosen.was_existing;
`.trim();
}

export function buildFastPathInsertSql(pointer, { killSwitchEnabled }) {
  if (!pointer?.ok) throw new Error('pointer required');
  const status = killSwitchEnabled ? 'pending' : 'deferred_kill_switch';
  return `
INSERT INTO email_automation.intake_queue (
  tenant_id, mailbox, mailbox_resource_id, folder, uid, event_type, status, hostinger_pointers
) VALUES (
  'tvg',
  ${quoteLiteral(pointer.mailbox)},
  ${quoteLiteral(pointer.mailbox_resource_id)},
  ${quoteLiteral(pointer.folder)},
  ${quoteLiteral(pointer.uid)}::bigint,
  ${pointer.event_type ? quoteLiteral(pointer.event_type) : 'NULL'},
  ${quoteLiteral(status)}::email_automation.intake_queue_status,
  ${quoteLiteral(JSON.stringify({
    mailbox_resource_id: pointer.mailbox_resource_id,
    folder: pointer.folder,
    uid: pointer.uid,
    source: 'fast_ack_normalized',
  }))}::jsonb
)
ON CONFLICT (tenant_id, mailbox_resource_id, folder, uid) DO NOTHING
RETURNING id, status;
`.trim();
}

export function buildGapFillSql(messages) {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('synthetic inbox required');
  const values = messages.map((message) => {
    const pointer = normalizeWebhookPointer(message);
    if (!pointer.ok) throw new Error('gap-fill pointer incomplete');
    return `(${quoteLiteral(pointer.mailbox)}, ${quoteLiteral(pointer.mailbox_resource_id)}, ${quoteLiteral(pointer.folder)}, ${quoteLiteral(pointer.uid)}::bigint)`;
  }).join(',\n');
  return `
INSERT INTO email_automation.intake_queue (
  tenant_id, mailbox, mailbox_resource_id, folder, uid, status, hostinger_pointers
)
SELECT 'tvg', v.mailbox, v.mailbox_resource_id, v.folder, v.uid,
       'pending'::email_automation.intake_queue_status,
       jsonb_build_object('source', 'synthetic_inbox_gap_fill', 'folder', v.folder, 'uid', v.uid)
FROM (VALUES
${values}
) AS v(mailbox, mailbox_resource_id, folder, uid)
ON CONFLICT (tenant_id, mailbox_resource_id, folder, uid) DO NOTHING
RETURNING id;
`.trim();
}

export function assertStagingTarget({ projectRef, databaseUrl }) {
  if (projectRef !== 'glkrykpksbsqmmilmjhs') {
    throw new Error('refusing: project ref is not staging glkrykpksbsqmmilmjhs');
  }
  const url = String(databaseUrl || '');
  if (/wwyxohjnyqnegzbxtuxs/i.test(url)) {
    throw new Error('refusing: production project ref present in database url');
  }
  if (!url.includes('glkrykpksbsqmmilmjhs')) {
    throw new Error('refusing: database url does not contain staging project ref');
  }
}
