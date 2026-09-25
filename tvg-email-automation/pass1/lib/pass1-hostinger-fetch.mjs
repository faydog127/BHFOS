/**
 * TVG Email Pass 1 — worker-only Hostinger message fetch.
 * GET metadata, text, and source. No other method. No other path.
 * Default base URL is disabled. The live host stays off until an explicit flag.
 * No token is stored here.
 */
import { buildOutcomeSql, computeIdentity, evaluateIntake, normalizeEmail, parseAuthResults, quoteLiteral } from './pass1-intake-logic.mjs';

export const HOSTINGER_LIVE_HOST = 'api.mail.hostinger.com';
export const DISABLED_BASE_URL = 'disabled';
export const STUCK_REAL_UID = '924150001';
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_BODY_BYTES = 262144;

export const MOCK_CASES = Object.freeze({
  910001: 'happy',
  910404: 'not_found',
  910500: 'upstream',
  910408: 'timeout',
  910601: 'missing_auth_results',
  910602: 'missing_message_id_and_date',
  910603: 'oversized',
});

const MESSAGE_PATH = /^\/api\/v1\/mailboxes\/([A-Za-z0-9_-]{1,128})\/folders\/([A-Za-z0-9._-]{1,128})\/messages\/(\d{1,18})(\/text|\/source)?$/;

function requireUuid(value) {
  const text = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error('expected uuid');
  }
  return text.toLowerCase();
}

function settingsArray(settings, key) {
  const value = settings?.[key];
  return Array.isArray(value) ? value : [];
}

function settingsString(settings, key, fallback) {
  const value = settings?.[key];
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return value.trim();
}

function settingsInt(settings, key, fallback, cap) {
  const n = Number(settings?.[key]);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), cap);
}

function utf8Bytes(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

const MAILBOX_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const FOLDER_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const UID_PATTERN = /^\d{1,18}$/;

function segmentTextOk(value, pattern) {
  const text = String(value ?? '');
  if (!pattern.test(text)) return false;
  if (text === '.' || text === '..' || text.includes('..')) return false;
  if (/[/?#%@:\\]/.test(text)) return false;
  return true;
}

function encodePathSegment(value, pattern) {
  const text = String(value ?? '');
  if (!segmentTextOk(text, pattern)) throw new TypeError('path segment rejected');
  return encodeURIComponent(text);
}

function invalidUrl() {
  return new TypeError('Invalid URL');
}

function parseHttpUrl(input) {
  const raw = String(input ?? '').trim();
  const match = /^(https?):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(raw);
  if (!match) throw invalidUrl();
  const protocol = `${match[1].toLowerCase()}:`;
  let authority = match[2];
  if (!authority) throw invalidUrl();
  let username = '';
  let pass = '';
  const at = authority.lastIndexOf('@');
  if (at !== -1) {
    const userinfo = authority.slice(0, at);
    authority = authority.slice(at + 1);
    const colon = userinfo.indexOf(':');
    if (colon === -1) username = userinfo;
    else {
      username = userinfo.slice(0, colon);
      pass = userinfo.slice(colon + 1);
    }
  }
  if (!authority || /[\s@]/.test(authority) || authority.startsWith('[')) throw invalidUrl();
  let hostname = authority;
  let port = '';
  const colon = hostname.lastIndexOf(':');
  if (colon !== -1) {
    port = hostname.slice(colon + 1);
    hostname = hostname.slice(0, colon);
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) throw invalidUrl();
  }
  hostname = hostname.toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname) && hostname !== 'localhost') {
    throw invalidUrl();
  }
  let pathname = match[3] || '/';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  const defaultPort = protocol === 'https:' ? '443' : '80';
  const portSuffix = port && port !== defaultPort ? `:${port}` : '';
  return {
    protocol,
    username,
    pass,
    hostname,
    port,
    pathname,
    search: match[4] || '',
    hash: match[5] || '',
    origin: `${protocol}//${hostname}${portSuffix}`,
  };
}

function composeHttpUrl(parts) {
  const defaultPort = parts.protocol === 'https:' ? '443' : '80';
  const portSuffix = parts.port && parts.port !== defaultPort ? `:${parts.port}` : '';
  const userinfo = parts.username
    ? `${parts.username}${parts.pass ? `:${parts.pass}` : ''}@`
    : (parts.pass ? `:${parts.pass}@` : '');
  let pathname = parts.pathname || '/';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  return `${parts.protocol}//${userinfo}${parts.hostname}${portSuffix}${pathname}`;
}

function urlBuildFailureDetail(error) {
  const name = String(error && error.name ? error.name : 'Error').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) || 'Error';
  const message = String(error && error.message ? error.message : 'url_build_failed')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/bearer\s+\S+/gi, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 160);
  return `url_build_failed:${name}:${message}`.slice(0, 220);
}

export function assertHostingerGetRequest({
  method,
  url,
  baseUrl,
  allowedHosts,
  liveFetchEnabled,
}) {
  if (String(method || '').toUpperCase() !== 'GET') {
    return { ok: false, reason: 'method_rejected' };
  }
  let parsed;
  let base;
  try {
    parsed = parseHttpUrl(url);
    base = parseHttpUrl(baseUrl);
  } catch {
    return { ok: false, reason: 'url_rejected' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'scheme_rejected' };
  const userinfo = parsed.username || parsed.pass;
  if (userinfo) return { ok: false, reason: 'url_rejected' };
  if (parsed.origin !== base.origin) return { ok: false, reason: 'host_rejected' };
  if (parsed.search || parsed.hash) return { ok: false, reason: 'query_rejected' };
  const basePath = base.pathname.replace(/\/+$/, '');
  if (!parsed.pathname.startsWith(`${basePath}/`)) return { ok: false, reason: 'path_rejected' };
  let relative;
  try {
    relative = decodeURIComponent(parsed.pathname.slice(basePath.length));
  } catch {
    return { ok: false, reason: 'path_rejected' };
  }
  if (relative.includes('..') || !MESSAGE_PATH.test(relative)) {
    return { ok: false, reason: 'path_rejected' };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = (allowedHosts || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(host)) return { ok: false, reason: 'host_rejected' };
  if (host === HOSTINGER_LIVE_HOST && liveFetchEnabled !== true) {
    return { ok: false, reason: 'live_fetch_disabled' };
  }
  return { ok: true, host, path: relative };
}

export function buildMessageUrl(baseUrl, pointer, suffix) {
  if (suffix !== '' && suffix !== 'text' && suffix !== 'source') {
    throw new TypeError('suffix rejected');
  }
  const base = parseHttpUrl(baseUrl);
  const id = encodePathSegment(pointer.mailbox_resource_id, MAILBOX_ID_PATTERN);
  const folder = encodePathSegment(pointer.folder, FOLDER_PATTERN);
  const uid = encodePathSegment(String(pointer.uid), UID_PATTERN);
  const tail = suffix ? `/${suffix}` : '';
  const prefix = base.pathname.replace(/\/+$/, '');
  const pathname = `${prefix}/api/v1/mailboxes/${id}/folders/${folder}/messages/${uid}${tail}`;
  const relative = pathname.slice(prefix.length);
  if (relative.includes('..') || !MESSAGE_PATH.test(relative)) {
    throw new TypeError('path segment rejected');
  }
  return composeHttpUrl({
    protocol: base.protocol,
    username: base.username,
    pass: base.pass,
    hostname: base.hostname,
    port: base.port,
    pathname,
  });
}

function resolveStoredPointer(queue) {
  const column = {
    mailbox_resource_id: queue.mailbox_resource_id,
    folder: queue.folder,
    uid: queue.uid == null ? '' : String(queue.uid),
    mailbox: queue.mailbox,
  };
  const pointers = queue.hostinger_pointers && typeof queue.hostinger_pointers === 'object'
    ? queue.hostinger_pointers
    : {};
  const mirrored = [
    ['mailbox_resource_id', pointers.mailbox_resource_id],
    ['folder', pointers.folder],
    ['uid', pointers.uid == null || pointers.uid === '' ? undefined : String(pointers.uid)],
  ];
  for (const [key, value] of mirrored) {
    if (value != null && value !== '' && String(value) !== String(column[key] ?? '')) {
      return { ok: false, detail: `pointer_mismatch:${key}` };
    }
  }
  if (!segmentTextOk(column.mailbox_resource_id, MAILBOX_ID_PATTERN)) {
    return { ok: false, detail: 'mailbox_resource_id_unresolved' };
  }
  if (!segmentTextOk(column.folder, FOLDER_PATTERN)) {
    return { ok: false, detail: 'folder_unresolved' };
  }
  if (!segmentTextOk(column.uid, UID_PATTERN)) return { ok: false, detail: 'uid_unresolved' };
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(column.mailbox || ''))) {
    return { ok: false, detail: 'mailbox_unresolved' };
  }
  return {
    ok: true,
    mailbox_resource_id: String(column.mailbox_resource_id),
    folder: String(column.folder),
    uid: column.uid,
    mailbox: String(column.mailbox).toLowerCase(),
  };
}

function holdPlan(common, fields) {
  return {
    ...common,
    route: 'hold',
    metadata_url: null,
    text_url: null,
    source_url: null,
    ...fields,
  };
}

export function planWorkerRoute({
  queueRow,
  settings = {},
  filterRows = [],
  formSenders = [],
  contacts = [],
  leads = [],
}) {
  const baseUrl = settingsString(settings, 'hostinger_mail_api_base_url', DISABLED_BASE_URL);
  const timeoutMs = settingsInt(settings, 'hostinger_fetch_timeout_ms', DEFAULT_TIMEOUT_MS, 20000);
  const maxBodyBytes = settingsInt(settings, 'hostinger_fetch_max_body_bytes', DEFAULT_MAX_BODY_BYTES, 1048576);
  const common = {
    queue_row: queueRow || null,
    filter_rows: filterRows || [],
    form_senders: formSenders || [],
    settings,
    contacts: contacts || [],
    leads: leads || [],
    fetch_base_url: baseUrl,
    timeout_ms: timeoutMs,
    max_body_bytes: maxBodyBytes,
    metadata_url: null,
    text_url: null,
    source_url: null,
    hold_reason: null,
    error_code: null,
    queue_status: null,
    detail: null,
  };
  if (!queueRow) return { ...common, route: 'skip' };
  const pointers = queueRow.hostinger_pointers || {};
  if (pointers.synthetic_message) return { ...common, route: 'synthetic' };
  const excluded = new Set([
    STUCK_REAL_UID,
    ...settingsArray(settings, 'hostinger_fetch_excluded_uids').map((value) => String(value)),
  ]);
  if (excluded.has(String(queueRow.uid))) {
    return holdPlan(common, {
      fetch_base_url: 'excluded',
      hold_reason: 'excluded_stuck_uid',
      error_code: 'excluded_stuck_uid',
      queue_status: 'held',
      detail: 'non-synthetic uid 924150001 is excluded from fetch',
    });
  }
  const pointer = resolveStoredPointer(queueRow);
  if (!pointer.ok) {
    return holdPlan(common, {
      hold_reason: 'pointer_unresolved',
      error_code: 'pointer_unresolved',
      queue_status: 'held',
      detail: pointer.detail,
    });
  }
  if (baseUrl === DISABLED_BASE_URL || baseUrl === 'off' || baseUrl === 'mock') {
    return holdPlan(common, {
      hold_reason: 'hostinger_fetch_disabled',
      error_code: 'hostinger_fetch_disabled',
      queue_status: 'held',
      detail: 'base URL is disabled; no request was made',
    });
  }
  let urls;
  try {
    urls = {
      metadata: buildMessageUrl(baseUrl, pointer, ''),
      text: buildMessageUrl(baseUrl, pointer, 'text'),
      source: buildMessageUrl(baseUrl, pointer, 'source'),
    };
  } catch (error) {
    return holdPlan(common, {
      hold_reason: 'pointer_unresolved',
      error_code: 'pointer_unresolved',
      queue_status: 'held',
      detail: urlBuildFailureDetail(error),
    });
  }
  const allowedHosts = settingsArray(settings, 'hostinger_mail_api_allowed_hosts');
  const liveFetchEnabled = settings.hostinger_live_fetch_enabled === true;
  for (const [name, url] of Object.entries(urls)) {
    const guard = assertHostingerGetRequest({
      method: 'GET',
      url,
      baseUrl,
      allowedHosts,
      liveFetchEnabled,
    });
    if (!guard.ok) {
      const reason = guard.reason === 'live_fetch_disabled'
        ? 'hostinger_live_fetch_disabled'
        : 'hostinger_request_rejected';
      return holdPlan(common, {
        hold_reason: reason,
        error_code: guard.reason,
        queue_status: 'held',
        detail: `${name}:${guard.reason}`,
      });
    }
  }
  return {
    ...common,
    route: 'fetch',
    metadata_url: urls.metadata,
    text_url: urls.text,
    source_url: urls.source,
  };
}

export function buildClosedHoldSql(input) {
  const queueId = requireUuid(input.queue_id);
  const queueStatus = input.queue_status === 'error' ? 'error' : 'held';
  const holdReason = String(input.hold_reason || 'pointer_unresolved').slice(0, 80);
  const errorCode = String(input.error_code || holdReason).slice(0, 80);
  const detail = String(input.detail || holdReason).slice(0, 400);
  const fetchBaseUrl = String(input.fetch_base_url || DISABLED_BASE_URL).slice(0, 300);
  const sql = `
WITH closed AS (
  UPDATE email_automation.intake_queue q
  SET status = ${quoteLiteral(queueStatus)}::email_automation.intake_queue_status,
      hold_reason = ${quoteLiteral(holdReason)},
      last_error = ${quoteLiteral(detail)},
      hostinger_pointers = COALESCE(q.hostinger_pointers, '{}'::jsonb) || jsonb_build_object(
        'fetch_base_url', ${quoteLiteral(fetchBaseUrl)}::text,
        'fetch_mode', 'closed'::text,
        'fetch_error_code', ${quoteLiteral(errorCode)}::text
      )
  WHERE q.id = ${quoteLiteral(queueId)}::uuid
    AND q.tenant_id = 'tvg'
  RETURNING q.id
)
INSERT INTO email_automation.automation_errors (
  tenant_id, intake_queue_id, stage, error_code, error_message, context_json, retryable
)
SELECT
  'tvg',
  closed.id,
  'worker_fetch',
  ${quoteLiteral(errorCode)},
  ${quoteLiteral(detail)},
  jsonb_build_object('fetch_base_url', ${quoteLiteral(fetchBaseUrl)}::text),
  FALSE
FROM closed
RETURNING intake_queue_id AS id,
  ${quoteLiteral(queueStatus)}::text AS status,
  NULL::uuid AS email_event_id,
  FALSE AS was_existing,
  NULL::timestamptz AS event_created_at;
`.trim();
  if (/email_responses|email_send_queue|developers\.hostinger|insert\s+into\s+public\./i.test(sql)) {
    throw new Error('refusing closed-hold SQL');
  }
  return sql;
}

export function recheckFetchPlan(plan) {
  if (!plan || plan.route !== 'fetch') return { ok: false, detail: 'not_fetch' };
  const allowedHosts = settingsArray(plan.settings, 'hostinger_mail_api_allowed_hosts');
  const liveFetchEnabled = plan.settings?.hostinger_live_fetch_enabled === true;
  const requests = [
    { method: 'GET', url: plan.metadata_url },
    { method: 'GET', url: plan.text_url },
    { method: 'GET', url: plan.source_url },
  ];
  for (const request of requests) {
    const guard = assertHostingerGetRequest({
      method: request.method,
      url: request.url,
      baseUrl: plan.fetch_base_url,
      allowedHosts,
      liveFetchEnabled,
    });
    if (!guard.ok) {
      return {
        ok: false,
        fetch_base_url: plan.fetch_base_url,
        hold_reason: 'hostinger_request_rejected',
        sql: buildClosedHoldSql({
          queue_id: plan.queue_row.id,
          queue_status: 'held',
          hold_reason: 'hostinger_request_rejected',
          error_code: guard.reason,
          detail: guard.reason,
          fetch_base_url: plan.fetch_base_url,
        }),
      };
    }
  }
  return { ok: true };
}

function unwrapHttp(item) {
  if (item == null) return { status: 0, body: null, timedOut: true, error: 'empty' };
  if (typeof item !== 'object') return { status: 200, body: item, timedOut: false, error: null };
  if (item.error) {
    const message = String(item.error.message || item.error.description || item.error);
    const timedOut = /timeout|timed out|etimedout|econnaborted|aborted/i.test(message);
    return {
      status: Number(item.error.status || item.error.httpCode || 0),
      body: null,
      timedOut,
      error: message.slice(0, 300),
    };
  }
  const status = Number(item.statusCode || item.status || 0);
  let body = Object.prototype.hasOwnProperty.call(item, 'body') ? item.body : item;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { body = JSON.parse(trimmed); } catch { /* raw text, including rfc822 that is not json */ }
    }
  }
  return { status: status || 200, body, timedOut: false, error: null };
}

export function parseRfc822(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const splitAt = text.indexOf('\n\n');
  const headerBlock = splitAt === -1 ? text : text.slice(0, splitAt);
  const body = splitAt === -1 ? '' : text.slice(splitAt + 2);
  const unfolded = headerBlock.replace(/\n[ \t]+/g, ' ');
  const headers = {};
  for (const line of unfolded.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!name) continue;
    headers[name] = headers[name] ? `${headers[name]}\n${value}` : value;
  }
  return { headers, body };
}

function sourceText(body) {
  if (typeof body === 'string') return body;
  if (!body || typeof body !== 'object') return '';
  if (typeof body.source === 'string') return body.source;
  if (typeof body.data === 'string') return body.data;
  return '';
}

function metadataObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : body;
  return data;
}

function textParts(body) {
  const data = metadataObject(body);
  return {
    text: data.text == null ? '' : String(data.text),
    html: data.html == null ? '' : String(data.html),
  };
}

function addressText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.address) {
    const name = value.name ? String(value.name).replace(/[<>]/g, '') : '';
    return name ? `${name} <${value.address}>` : String(value.address);
  }
  return '';
}

function addressList(value) {
  if (!Array.isArray(value)) return '';
  return value.map(addressText).filter(Boolean).join(', ');
}

function bareId(value) {
  return String(value || '').trim().replace(/^<|>$/g, '').toLowerCase();
}

function loose(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function attachmentMeta(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    filename: item?.filename ?? null,
    content_type: item?.contentType || item?.content_type || null,
    size_bytes: item?.sizeBytes ?? item?.size_bytes ?? null,
    attachment_id: item?.id || item?.attachment_id || null,
  }));
}

function retrievalFailure(meta, text, source) {
  const parts = [meta, text, source];
  if (parts.some((part) => part.timedOut)) {
    return { queue_status: 'error', hold_reason: 'hostinger_timeout', error_code: 'hostinger_timeout', detail: 'timeout' };
  }
  if (parts.some((part) => part.status >= 500)) {
    return { queue_status: 'error', hold_reason: 'hostinger_upstream_error', error_code: 'hostinger_upstream_error', detail: 'upstream' };
  }
  if (parts.some((part) => part.status === 404)) {
    return {
      queue_status: 'held',
      hold_reason: 'message_moved_uncertain',
      error_code: 'hostinger_not_found',
      detail: 'not_found_no_search',
    };
  }
  if (parts.some((part) => part.status === 401 || part.status === 403)) {
    return { queue_status: 'error', hold_reason: 'hostinger_auth_rejected', error_code: 'hostinger_auth_rejected', detail: 'auth' };
  }
  if (parts.some((part) => part.status < 200 || part.status >= 300)) {
    return { queue_status: 'held', hold_reason: 'hostinger_client_error', error_code: 'hostinger_client_error', detail: 'client_status' };
  }
  return null;
}

export function normalizeHostingerPayload({
  metadataBody,
  textBody,
  sourceBody,
  mailbox,
  maxBodyBytes,
}) {
  const rawSizes = [metadataBody, textBody, sourceBody].map(utf8Bytes);
  if (rawSizes.some((size) => size > maxBodyBytes)) {
    return { ok: false, code: 'hostinger_body_too_large', detail: 'body_too_large' };
  }
  const sourceRaw = sourceText(sourceBody);
  if (!sourceRaw.trim()) {
    return { ok: false, code: 'identity_uncertain', detail: 'missing_source', uncertain: true };
  }
  const parsed = parseRfc822(sourceRaw);
  const auth = parsed.headers['authentication-results'] || '';
  if (!String(auth).trim()) {
    return {
      ok: false,
      code: 'identity_uncertain',
      detail: 'missing_authentication_results',
      uncertain: true,
      partial: assembleMessage({ parsed, metadataBody, textBody, mailbox, auth: '' }),
    };
  }
  const message = assembleMessage({ parsed, metadataBody, textBody, mailbox, auth });
  if (message.conflict) {
    return { ok: false, code: 'identity_uncertain', detail: message.conflict, uncertain: true, partial: message };
  }
  return { ok: true, message };
}

function assembleMessage({ parsed, metadataBody, textBody, mailbox, auth }) {
  const meta = metadataObject(metadataBody);
  const parts = textParts(textBody);
  const headerFrom = parsed.headers.from || '';
  const metaFrom = addressText(meta.from);
  const headerId = parsed.headers['message-id'] || '';
  const metaId = meta.messageId || meta.message_id || '';
  const headerSubject = parsed.headers.subject || '';
  const metaSubject = meta.subject == null ? '' : String(meta.subject);
  let conflict = '';
  if (headerFrom && metaFrom && normalizeEmail(headerFrom) && normalizeEmail(metaFrom)
    && normalizeEmail(headerFrom) !== normalizeEmail(metaFrom)) {
    conflict = 'from_mismatch';
  }
  if (headerId && metaId && bareId(headerId) !== bareId(metaId)) conflict = conflict || 'message_id_mismatch';
  if (headerSubject && metaSubject && loose(headerSubject) !== loose(metaSubject)) conflict = conflict || 'subject_mismatch';
  const contentType = String(parsed.headers['content-type'] || '');
  let bodyText = parts.text;
  if (!bodyText && !parts.html && (contentType === '' || /^text\/plain/i.test(contentType))) {
    bodyText = parsed.body;
  }
  return {
    conflict,
    mailbox,
    from_raw: headerFrom || metaFrom,
    from_name: meta.from && typeof meta.from === 'object' ? (meta.from.name || '') : '',
    reply_to_raw: parsed.headers['reply-to'] || '',
    to_raw: parsed.headers.to || addressList(meta.to),
    cc_raw: parsed.headers.cc || addressList(meta.cc),
    subject: headerSubject || metaSubject,
    date_header: parsed.headers.date || '',
    bodyText,
    bodyHtml: parts.html,
    message_id: headerId || metaId || '',
    authentication_results: auth,
    in_reply_to: parsed.headers['in-reply-to'] || meta.inReplyTo || meta.in_reply_to || '',
    references: parsed.headers.references || '',
    auto_submitted: parsed.headers['auto-submitted'] || '',
    precedence_header: parsed.headers.precedence || '',
    list_id: parsed.headers['list-id'] || '',
    content_type: contentType,
    attachment_meta: attachmentMeta(meta.attachments),
  };
}

function displayFrom(message, decision) {
  return {
    senderName: message.from_name || '',
    senderEmail: decision.from_email || '',
    subject: message.subject || '',
    formFields: { service: '', city: '' },
  };
}

function outcomeFromDecision(decision, plan, message) {
  const sql = buildOutcomeSql({
    ...decision,
    queue_id: plan.queue_row.id,
    mailbox: plan.queue_row.mailbox,
    mailbox_resource_id: plan.queue_row.mailbox_resource_id,
    folder: plan.queue_row.folder,
    uid: String(plan.queue_row.uid),
    subject: message.subject || null,
    date_header: message.date_header || null,
    authentication_results: message.authentication_results || null,
    body_excerpt: decision.body_normalized || '',
    in_reply_to: message.in_reply_to || null,
    references: message.references || null,
    attachment_meta: message.attachment_meta || null,
    fetch_base_url: plan.fetch_base_url,
    fetch_mode: 'get',
  });
  return { sql, decision, display: displayFrom(message, decision), fetch_base_url: plan.fetch_base_url };
}

function forcedUncertain(plan, message) {
  const prepared = {
    ...message,
    from_email: normalizeEmail(message.from_raw),
    reply_to_email: normalizeEmail(message.reply_to_raw),
    to_email: normalizeEmail(message.to_raw),
    mailbox_email: normalizeEmail(message.mailbox),
  };
  const identity = computeIdentity(prepared);
  const auth = parseAuthResults(prepared.authentication_results);
  const canPersist = Boolean(identity.message_id)
    || Boolean(prepared.from_email && (prepared.bodyText || prepared.subject || prepared.date_header));
  if (!canPersist) {
    return {
      sql: buildClosedHoldSql({
        queue_id: plan.queue_row.id,
        queue_status: 'held',
        hold_reason: 'identity_uncertain',
        error_code: 'identity_uncertain',
        detail: 'identity_uncertain_no_event',
        fetch_base_url: plan.fetch_base_url,
      }),
      decision: { event_status: 'held', queue_status: 'held', hold_reason: 'identity_uncertain' },
      display: displayFrom(message, { from_email: prepared.from_email }),
      fetch_base_url: plan.fetch_base_url,
    };
  }
  return outcomeFromDecision({
    ...identity,
    from_email: prepared.from_email,
    reply_to_email: prepared.reply_to_email,
    spf_pass: auth.spf_pass,
    dkim_pass: auth.dkim_pass,
    dmarc_pass: auth.dmarc_pass,
    is_form_sender: false,
    contact_id: null,
    lead_id: null,
    resolved_recipient: null,
    recipient_resolution: null,
    hold_reason: 'identity_uncertain',
    filter_reason: null,
    event_status: 'held',
    queue_status: 'held',
  }, plan, message);
}

export function decideFetchedIntake({ plan, metadataItem, textItem, sourceItem }) {
  const meta = unwrapHttp(metadataItem);
  const text = unwrapHttp(textItem);
  const source = unwrapHttp(sourceItem);
  const failure = retrievalFailure(meta, text, source);
  if (failure) {
    return {
      sql: buildClosedHoldSql({
        queue_id: plan.queue_row.id,
        queue_status: failure.queue_status,
        hold_reason: failure.hold_reason,
        error_code: failure.error_code,
        detail: failure.detail,
        fetch_base_url: plan.fetch_base_url,
      }),
      decision: {
        event_status: failure.queue_status === 'error' ? 'error' : 'held',
        queue_status: failure.queue_status,
        hold_reason: failure.hold_reason,
      },
      display: {},
      fetch_base_url: plan.fetch_base_url,
    };
  }
  const normalized = normalizeHostingerPayload({
    metadataBody: meta.body,
    textBody: text.body,
    sourceBody: source.body,
    mailbox: plan.queue_row.mailbox,
    maxBodyBytes: plan.max_body_bytes || DEFAULT_MAX_BODY_BYTES,
  });
  if (!normalized.ok && normalized.code === 'hostinger_body_too_large') {
    return {
      sql: buildClosedHoldSql({
        queue_id: plan.queue_row.id,
        queue_status: 'held',
        hold_reason: 'hostinger_body_too_large',
        error_code: 'hostinger_body_too_large',
        detail: 'body_too_large',
        fetch_base_url: plan.fetch_base_url,
      }),
      decision: { event_status: 'held', queue_status: 'held', hold_reason: 'hostinger_body_too_large' },
      display: {},
      fetch_base_url: plan.fetch_base_url,
    };
  }
  if (!normalized.ok) {
    return forcedUncertain(plan, normalized.partial || {
      mailbox: plan.queue_row.mailbox,
      from_raw: '',
      subject: '',
      date_header: '',
      bodyText: '',
      message_id: '',
      authentication_results: '',
    });
  }
  const decision = evaluateIntake({
    message: normalized.message,
    filterRows: plan.filter_rows || [],
    formSenders: plan.form_senders || [],
    settings: plan.settings || {},
    contacts: plan.contacts || [],
    leads: plan.leads || [],
  });
  return outcomeFromDecision(decision, plan, normalized.message);
}

function happySource({ uid, subject, messageId, date, auth, from }) {
  const lines = [
    messageId ? `Message-ID: ${messageId}` : null,
    date ? `Date: ${date}` : null,
    `From: ${from}`,
    'Reply-To: Pat Customer <pat@example.com>',
    'To: TVG <info@vent-guys.com>',
    `Subject: ${subject}`,
    auth ? `Authentication-Results: ${auth}` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    `Hello from mock uid ${uid}.`,
  ].filter((line) => line != null);
  return lines.join('\r\n');
}

export function renderMockHostingerResponse({ uid, kind }) {
  const mode = MOCK_CASES[String(uid)] || 'not_found';
  if (mode === 'not_found') {
    return { http_status: 404, response_body: { error: 'not_found', uid: String(uid) }, timeout: false };
  }
  if (mode === 'upstream') {
    return { http_status: 500, response_body: { error: 'upstream', uid: String(uid) }, timeout: false };
  }
  if (mode === 'timeout') {
    return { http_status: 200, response_body: { error: 'delayed', uid: String(uid) }, timeout: true };
  }
  const omitAuth = mode === 'missing_auth_results';
  const omitId = mode === 'missing_message_id_and_date';
  const subject = 'Synthetic mock inquiry';
  const from = 'Pat Customer <pat@example.com>';
  const messageId = omitId ? '' : `<mock-${uid}@example.com>`;
  const date = omitId ? '' : 'Thu, 25 Sep 2026 14:00:00 +0000';
  const auth = omitAuth ? '' : 'mock.example; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com';
  if (kind === 'metadata') {
    return {
      http_status: 200,
      timeout: false,
      response_body: {
        data: {
          uid: Number(uid),
          path: 'INBOX',
          date: date || null,
          flags: [],
          unseen: true,
          size: 400,
          subject,
          from: { name: 'Pat Customer', address: 'pat@example.com' },
          to: [{ name: 'TVG', address: 'info@vent-guys.com' }],
          cc: [],
          bcc: [],
          messageId: messageId || null,
          inReplyTo: null,
          attachments: [],
        },
      },
    };
  }
  if (kind === 'text') {
    const text = mode === 'oversized' ? 'x'.repeat(300000) : `Hello from mock uid ${uid}.`;
    return { http_status: 200, timeout: false, response_body: { data: { text, html: '' } } };
  }
  return {
    http_status: 200,
    timeout: false,
    response_body: {
      data: happySource({ uid, subject, messageId, date, auth, from }),
    },
  };
}
