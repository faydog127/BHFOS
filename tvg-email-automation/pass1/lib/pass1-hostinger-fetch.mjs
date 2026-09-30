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

function rawRequestUrlProblem(url) {
  const raw = String(url ?? '');
  if (raw !== raw.trim()) return 'url_rejected';
  const noQuery = raw.split('?')[0].split('#')[0];
  const scheme = noQuery.indexOf('://');
  const rest = scheme === -1 ? noQuery : noQuery.slice(scheme + 3);
  const slash = rest.indexOf('/');
  const pathname = slash === -1 ? '/' : rest.slice(slash);
  if (pathname.includes('%') || /\s/.test(pathname)) return 'path_rejected';
  return null;
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
  const rawProblem = rawRequestUrlProblem(url);
  if (rawProblem) return { ok: false, reason: rawProblem };
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

/** Normalized Message-ID match key. Case-insensitive. Angle brackets are not part of the key. */
export function midKey(value) {
  if (value == null) return null;
  let text = String(value).trim();
  if (text.startsWith('<') && text.endsWith('>') && text.length >= 2) text = text.slice(1, -1).trim();
  text = text.toLowerCase();
  if (text === '' || !text.includes('@') || /[\s<>]/.test(text) || text.length > 998) return null;
  return text;
}

function unresolvedPointerPlan(queueRow, settings, common) {
  if (queueRow.resolution_status !== 'unresolved') return null;
  const raw = queueRow.webhook_message_id;
  if (raw == null || String(raw).trim() === '') {
    return holdPlan(common, {
      hold_reason: 'message_id_missing',
      error_code: 'message_id_missing',
      queue_status: 'held',
      detail: 'webhook had no usable Message-ID; held by Worker; no Hostinger call made',
    });
  }
  if (!midKey(raw)) {
    return holdPlan(common, {
      hold_reason: 'message_id_invalid',
      error_code: 'message_id_invalid',
      queue_status: 'held',
      detail: 'webhook Message-ID failed the match key; held by Worker; no Hostinger call made',
    });
  }
  const map = settings?.hostinger_mailbox_map;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    const mapped = map[String(queueRow.mailbox || '').toLowerCase()];
    if (mapped == null || String(mapped) !== String(queueRow.mailbox_resource_id || '')) {
      return holdPlan(common, {
        hold_reason: 'mailbox_map_changed',
        error_code: 'mailbox_map_changed',
        queue_status: 'held',
        detail: 'mailbox map no longer matches the stored resource id',
      });
    }
  }
  return {
    ...common,
    route: 'resolve',
    metadata_url: null,
    text_url: null,
    source_url: null,
    hold_reason: null,
    error_code: null,
    queue_status: null,
    detail: null,
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
  const unresolved = unresolvedPointerPlan(queueRow, settings, common);
  if (unresolved) return unresolved;
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
      locked_at = NULL,
      locked_by = NULL,
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

function responsePayload(item) {
  if (item == null || typeof item !== 'object' || Array.isArray(item)) return item;
  if (Object.prototype.hasOwnProperty.call(item, 'body')) return item.body;
  if (Object.prototype.hasOwnProperty.call(item, 'data')) return item.data;
  return item;
}

function parseJsonEnvelope(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'non_object' };
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };
  if (trimmed === 'null') return { ok: false, reason: 'null' };
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  if (parsed === null) return { ok: false, reason: 'null' };
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'non_object' };
  const inner = parsed.data;
  if (inner == null || typeof inner !== 'object' || Array.isArray(inner)) {
    return { ok: false, reason: 'missing_envelope' };
  }
  return { ok: true, value: inner };
}

function sourceRawString(raw) {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.data === 'string') {
          return parsed.data;
        }
      } catch {
        /* rfc822 that is not an envelope stays the original string */
      }
    }
    return raw;
  }
  if (raw && typeof raw === 'object' && typeof raw.data === 'string') return raw.data;
  return '';
}

function unwrapHttp(item, endpoint) {
  if (item == null) return { status: 0, body: null, timedOut: true, error: 'empty', parseError: null };
  if (typeof item !== 'object') {
    return { status: 200, body: item, timedOut: false, error: null, parseError: null };
  }
  if (item.error) {
    const message = String(item.error.message || item.error.description || item.error);
    const timedOut = /timeout|timed out|etimedout|econnaborted|aborted/i.test(message);
    return {
      status: Number(item.error.status || item.error.httpCode || 0),
      body: null,
      timedOut,
      error: message.slice(0, 300),
      parseError: null,
    };
  }
  const status = Number(item.statusCode || item.status || 0) || 200;
  const raw = responsePayload(item);
  if (endpoint === 'source') {
    return { status, body: sourceRawString(raw), timedOut: false, error: null, parseError: null };
  }
  if (status < 200 || status >= 300) {
    return { status, body: raw, timedOut: false, error: null, parseError: null };
  }
  const parsed = parseJsonEnvelope(raw);
  if (!parsed.ok) {
    return { status, body: null, timedOut: false, error: null, parseError: parsed.reason };
  }
  return { status, body: parsed.value, timedOut: false, error: null, parseError: null };
}

function parseHold(endpoint, reason) {
  return {
    queue_status: 'held',
    hold_reason: 'parse_failed',
    error_code: `parse_failed:${endpoint}`,
    detail: String(reason || 'parse_failed'),
  };
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
  const meta = unwrapHttp(metadataItem, 'metadata');
  const text = unwrapHttp(textItem, 'text');
  const source = unwrapHttp(sourceItem, 'source');
  const failure = retrievalFailure(meta, text, source)
    || (meta.parseError ? parseHold('metadata', meta.parseError) : null)
    || (text.parseError ? parseHold('text', text.parseError) : null);
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
    const uncertain = forcedUncertain(plan, normalized.partial || {
      mailbox: plan.queue_row.mailbox,
      from_raw: '',
      subject: '',
      date_header: '',
      bodyText: '',
      message_id: '',
      authentication_results: '',
    });
    if (normalized.detail === 'message_id_mismatch') {
      uncertain.decision = {
        ...uncertain.decision,
        error_code: 'message_id_mismatch',
        detail: 'message_id_mismatch',
      };
    }
    return uncertain;
  }
  const webhookKey = midKey(plan.queue_row?.webhook_message_id);
  if (webhookKey) {
    const metaRecord = metadataObject(meta.body);
    const metaKey = midKey(metaRecord.messageId || metaRecord.message_id || '');
    const sourceKey = midKey(normalized.message.message_id);
    if ((metaKey && metaKey !== webhookKey) || (sourceKey && sourceKey !== webhookKey)) {
      const uncertain = forcedUncertain(plan, { ...normalized.message, conflict: 'message_id_mismatch' });
      uncertain.decision = { ...uncertain.decision, error_code: 'message_id_mismatch', detail: 'message_id_mismatch' };
      return uncertain;
    }
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

const LIST_RELATIVE = /^\/api\/v1\/mailboxes\/[A-Za-z0-9_-]{1,128}\/folders\/INBOX\/messages$/;
const RESOLVE_BACKOFF_DEFAULT = Object.freeze([1, 2, 5, 10, 20]);
const RESOLVE_ERROR_CODES = new Set([
  'pointer_not_found',
  'pointer_ambiguous',
  'pointer_excluded_uid',
  'hostinger_rate_limited',
  'resolve_response_malformed',
  'hostinger_timeout',
  'hostinger_upstream_error',
  'hostinger_auth_rejected',
]);

export function assertHostingerListRequest({
  method,
  url,
  baseUrl,
  allowedHosts,
  liveFetchEnabled,
}) {
  if (method !== 'GET') return { ok: false, reason: 'method_rejected' };
  const rawProblem = rawRequestUrlProblem(url);
  if (rawProblem) return { ok: false, reason: rawProblem };
  let parsed;
  let base;
  try {
    parsed = parseHttpUrl(url);
    base = parseHttpUrl(baseUrl);
  } catch {
    return { ok: false, reason: 'url_rejected' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'scheme_rejected' };
  if (parsed.username || parsed.pass) return { ok: false, reason: 'url_rejected' };
  if (parsed.origin !== base.origin) return { ok: false, reason: 'host_rejected' };
  if (parsed.hash) return { ok: false, reason: 'query_rejected' };
  const rawPath = String(url || '').split('?')[0].split('#')[0];
  if (rawPath.includes('..') || /%2e/i.test(rawPath)) return { ok: false, reason: 'path_rejected' };
  const basePath = base.pathname.replace(/\/+$/, '');
  if (!parsed.pathname.startsWith(`${basePath}/`)) return { ok: false, reason: 'path_rejected' };
  let relative;
  try {
    relative = decodeURIComponent(parsed.pathname.slice(basePath.length));
  } catch {
    return { ok: false, reason: 'path_rejected' };
  }
  if (relative.includes('..') || !LIST_RELATIVE.test(relative)) return { ok: false, reason: 'path_rejected' };
  if (!/^page=[1-5]&perPage=100$/.test(String(parsed.search || '').replace(/^\?/, ''))) {
    return { ok: false, reason: 'query_rejected' };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = (allowedHosts || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(host)) return { ok: false, reason: 'host_rejected' };
  if (host === HOSTINGER_LIVE_HOST && liveFetchEnabled !== true) {
    return { ok: false, reason: 'live_fetch_disabled' };
  }
  return { ok: true, host, path: relative };
}

export function buildListMessagesUrl(baseUrl, mailboxResourceId, page) {
  const pageNum = Number(page);
  if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > 5) throw new TypeError('page rejected');
  const base = parseHttpUrl(baseUrl);
  const id = encodePathSegment(mailboxResourceId, MAILBOX_ID_PATTERN);
  const prefix = base.pathname.replace(/\/+$/, '');
  const pathname = `${prefix}/api/v1/mailboxes/${id}/folders/INBOX/messages`;
  const relative = pathname.slice(prefix.length);
  if (relative.includes('..') || !LIST_RELATIVE.test(relative)) throw new TypeError('path segment rejected');
  return `${composeHttpUrl({
    protocol: base.protocol,
    username: '',
    pass: '',
    hostname: base.hostname,
    port: base.port,
    pathname,
  })}?page=${pageNum}&perPage=100`;
}

function resolveBackoff(settings) {
  const raw = settings?.resolve_backoff_minutes;
  if (!Array.isArray(raw) || raw.length !== 5) return RESOLVE_BACKOFF_DEFAULT;
  const minutes = raw.map((value) => Number(value));
  if (minutes.some((value) => !Number.isInteger(value) || value <= 0 || value > 24 * 60)) {
    return RESOLVE_BACKOFF_DEFAULT;
  }
  return minutes;
}

export function resolveScheduleLimit(settings) {
  const backoff = resolveBackoff(settings);
  const configured = Number(settings?.resolve_max_attempts);
  const fromSetting = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : backoff.length;
  return Math.max(backoff.length, fromSetting);
}

function clampedResolvePages(settings) {
  const configured = Number(settings?.resolve_max_pages);
  const chosen = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 3;
  return Math.min(Math.max(chosen, 1), 5);
}

function clampedLookbackHours(settings) {
  const configured = Number(settings?.resolve_lookback_hours);
  const chosen = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 48;
  return Math.min(Math.max(chosen, 1), 168);
}

export function buildWorkerPointerHoldSql(input) {
  const queueId = requireUuid(input.queue_id);
  const reason = input.hold_reason === 'message_id_invalid' ? 'message_id_invalid' : 'message_id_missing';
  const message = reason === 'message_id_invalid'
    ? 'webhook Message-ID failed the match key; held by Worker; no Hostinger call made'
    : 'webhook had no usable Message-ID; held by Worker; no Hostinger call made';
  const messagePredicate = reason === 'message_id_missing'
    ? 'q.webhook_message_id IS NULL'
    : 'q.webhook_message_id IS NOT NULL';
  return `
WITH held AS (
  UPDATE email_automation.intake_queue q
     SET status = 'held'::email_automation.intake_queue_status,
         hold_reason = ${quoteLiteral(reason)},
         locked_at = NULL,
         locked_by = NULL
   WHERE q.id = ${quoteLiteral(queueId)}::uuid
     AND q.tenant_id = 'tvg'
     AND q.status = 'processing'
     AND q.resolution_status = 'unresolved'
     AND ${messagePredicate}
  RETURNING q.id
)
INSERT INTO email_automation.automation_errors (
  tenant_id, intake_queue_id, stage, error_code, error_message, context_json, retryable
)
SELECT
  'tvg',
  held.id,
  'worker',
  ${quoteLiteral(reason)},
  ${quoteLiteral(message)},
  '{}'::jsonb,
  false
FROM held
RETURNING intake_queue_id;
`.trim();
}

function rescheduleResolveSql(queueId, minutes, rateConsumed) {
  const mins = Number(minutes);
  if (!Number.isInteger(mins) || mins <= 0) throw new Error('backoff rejected');
  let pointerSql = '';
  if (rateConsumed != null) {
    const consumed = Number(rateConsumed);
    if (!Number.isInteger(consumed) || consumed < 0) throw new Error('rate limit counter rejected');
    // A string (Fast ACK stores "unresolved") is not an object. jsonb || would
    // wrap it into a growing array, and the cap would never see the counter.
    pointerSql = `,
      hostinger_pointers = COALESCE(q.hostinger_pointers, '{}'::jsonb) || jsonb_build_object(
        'resolution', CASE
          WHEN jsonb_typeof(q.hostinger_pointers->'resolution') = 'object'
            THEN q.hostinger_pointers->'resolution'
          ELSE '{}'::jsonb
        END || jsonb_build_object(
          'rate_limit_consumed', ${consumed}::int
        )
      )`;
  }
  return `
UPDATE email_automation.intake_queue q
SET status = 'pending'::email_automation.intake_queue_status,
    resolve_attempts = q.resolve_attempts + 1,
    next_attempt_at = now() + make_interval(mins => ${mins}),
    locked_at = NULL,
    locked_by = NULL${pointerSql}
WHERE q.id = ${quoteLiteral(queueId)}::uuid
  AND q.tenant_id = 'tvg'
  AND q.status = 'processing'
RETURNING 'rescheduled'::text AS outcome,
  q.id,
  q.status,
  q.resolve_attempts,
  q.attempt_count,
  q.locked_at,
  q.locked_by;
`.trim();
}

export function zeroMatchAction(queueRow, settings) {
  const completed = Number(queueRow?.resolve_attempts || 0);
  const thisAttempt = (Number.isFinite(completed) ? completed : 0) + 1;
  const limit = resolveScheduleLimit(settings);
  if (thisAttempt > limit) {
    return { action: 'hold', error_code: 'pointer_not_found', queue_status: 'held' };
  }
  const backoff = resolveBackoff(settings);
  return { action: 'reschedule', minutes: backoff[thisAttempt - 1], thisAttempt };
}

export function rateLimitAction(queueRow, settings) {
  const consumed = Number(queueRow?.hostinger_pointers?.resolution?.rate_limit_consumed || 0);
  const capRaw = Number(settings?.resolve_429_max_consumed);
  const cap = Number.isFinite(capRaw) && capRaw >= 0 ? Math.floor(capRaw) : 2;
  const completed = Number(queueRow?.resolve_attempts || 0);
  const thisAttempt = (Number.isFinite(completed) ? completed : 0) + 1;
  const limit = resolveScheduleLimit(settings);
  if ((Number.isFinite(consumed) ? consumed : 0) >= cap || thisAttempt > limit) {
    return { action: 'hold', error_code: 'hostinger_rate_limited', queue_status: 'held' };
  }
  const backoff = resolveBackoff(settings);
  return {
    action: 'reschedule',
    minutes: backoff[Math.min(thisAttempt, backoff.length) - 1],
    rate_limit_consumed: (Number.isFinite(consumed) ? consumed : 0) + 1,
  };
}

export function insideResolveSchedule(row, now = new Date()) {
  if (!row || row.status !== 'pending' || row.next_attempt_at == null) return false;
  const at = new Date(row.next_attempt_at).getTime();
  return Number.isFinite(at) && at > now.getTime();
}

/**
 * Rows still waiting on the 1/2/5/10/20 schedule are exempt from a pending-SLA alert.
 * A missing-Message-ID row has no next_attempt_at and is legitimately alertable:
 * it is pending until a Worker run, and nothing is fetched in that window.
 */
export function pendingSlaExempt(row, now = new Date(), slackMinutes = 5) {
  if (!row || row.status !== 'pending') return false;
  if (row.webhook_message_id == null || String(row.webhook_message_id).trim() === '') return false;
  if (insideResolveSchedule(row, now)) return true;
  if (row.resolution_status !== 'unresolved' || row.created_at == null) return false;
  const slack = Number(slackMinutes);
  const extra = Number.isFinite(slack) && slack >= 0 ? slack : 0;
  const deadline = new Date(row.created_at).getTime() + (38 + extra) * 60 * 1000;
  return Number.isFinite(deadline) && now.getTime() < deadline;
}

const MANUAL_RERESOLVE_REFUSE = new Set([
  'message_id_missing',
  'message_id_invalid',
  'pointer_ambiguous',
  'identity_uncertain',
  'pointer_excluded_uid',
  'mailbox_map_changed',
]);

export function manualReresolveAllowed(row) {
  if (!row || row.tenant_id !== 'tvg') return false;
  if (row.resolution_status !== 'unresolved') return false;
  if (row.webhook_message_id == null || String(row.webhook_message_id).trim() === '') return false;
  if (row.status !== 'held' && row.status !== 'error') return false;
  if (MANUAL_RERESOLVE_REFUSE.has(row.hold_reason)) return false;
  if (row.hold_reason === 'pointer_not_found' || row.hold_reason === 'hostinger_rate_limited') return true;
  return /^(hostinger_timeout|hostinger_upstream_error)/.test(String(row.last_error || ''));
}

export function buildManualReresolveSql(queueId) {
  const id = requireUuid(queueId);
  return `
UPDATE email_automation.intake_queue q
   SET status = 'pending'::email_automation.intake_queue_status,
       resolve_attempts = 0,
       next_attempt_at = NULL,
       hold_reason = NULL,
       locked_at = NULL,
       locked_by = NULL,
       hostinger_pointers = COALESCE(q.hostinger_pointers, '{}'::jsonb)
         || jsonb_build_object(
              'resolution',
              COALESCE(q.hostinger_pointers->'resolution', '{}'::jsonb)
                || jsonb_build_object(
                     'manual_resets',
                     COALESCE((q.hostinger_pointers->'resolution'->>'manual_resets')::int, 0) + 1
                   )
            )
 WHERE q.id = ${quoteLiteral(id)}::uuid
   AND q.tenant_id = 'tvg'
   AND q.resolution_status = 'unresolved'
   AND q.webhook_message_id IS NOT NULL
   AND q.status IN ('held', 'error')
   AND (
     q.hold_reason IN ('pointer_not_found', 'hostinger_rate_limited')
     OR q.last_error ~ '^(hostinger_timeout|hostinger_upstream_error)'
   )
RETURNING q.id, q.status, q.resolve_attempts, q.attempt_count;
`.trim();
}

function listHttpStatus(item) {
  if (item == null) return { status: 0, timedOut: true };
  if (typeof item !== 'object') return { status: 200, timedOut: false };
  if (item.timeout === true) return { status: 0, timedOut: true };
  if (item.error) {
    const message = String(item.error.message || item.error.description || item.error);
    return {
      status: Number(item.error.status || item.error.httpCode || 0),
      timedOut: /timeout|timed out|etimedout|econnaborted|aborted/i.test(message),
    };
  }
  const status = Number(item.statusCode || item.status || item.http_status || 0) || 200;
  return { status, timedOut: false };
}

export function parseListEnvelope(item) {
  let parsed = null;
  if (item && typeof item === 'object' && !Array.isArray(item) && typeof item.data === 'string') {
    try {
      parsed = JSON.parse(item.data);
    } catch {
      return { ok: false, reason: 'resolve_response_malformed' };
    }
  } else if (item && typeof item === 'object' && item.body && typeof item.body === 'object' && !Array.isArray(item.body)) {
    parsed = item.body;
  } else if (item && typeof item === 'object' && item.response_body && typeof item.response_body === 'object' && !Array.isArray(item.response_body)) {
    parsed = item.response_body;
  } else if (item && typeof item === 'object' && Array.isArray(item.data) && item.pagination) {
    parsed = item;
  } else {
    return { ok: false, reason: 'resolve_response_malformed' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.data)) {
    return { ok: false, reason: 'resolve_response_malformed' };
  }
  const pagination = parsed.pagination;
  if (!pagination || typeof pagination !== 'object' || Array.isArray(pagination)) {
    return { ok: false, reason: 'resolve_response_malformed' };
  }
  for (const key of ['page', 'perPage', 'total', 'totalPages']) {
    if (!Number.isInteger(pagination[key])) return { ok: false, reason: 'resolve_response_malformed' };
  }
  return { ok: true, items: parsed.data, pagination };
}

function blankEvaluation(overrides = {}) {
  return {
    matches: [],
    pages_scanned: 0,
    total: 0,
    items_seen: 0,
    invalid_items: 0,
    stop_reason: 'max_pages',
    zero_match: false,
    ambiguous: false,
    excluded: false,
    resolved: false,
    retry: false,
    hold: false,
    error: false,
    error_code: null,
    ...overrides,
  };
}

function listItemUid(item) {
  const uid = item?.uid;
  if (typeof uid === 'number' && Number.isInteger(uid) && uid > 0) return uid;
  if (typeof uid === 'string' && /^\d{1,18}$/.test(uid)) return Number(uid);
  return null;
}

function itemOlderThan(item, cutoffMs) {
  const raw = item?.date;
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return false;
  return parsed < cutoffMs;
}

function finishMatchEvaluation(counts, queueRow, settings) {
  const excluded = new Set((counts.excludedUids || []).map((value) => String(value)));
  const unique = [];
  for (const uid of counts.matches) {
    if (!unique.includes(uid)) unique.push(uid);
  }
  const base = {
    matches: unique,
    pages_scanned: counts.pages_scanned,
    total: counts.total,
    items_seen: counts.items_seen,
    invalid_items: counts.invalid_items,
    stop_reason: counts.stop_reason,
    zero_match: false,
    ambiguous: false,
    excluded: false,
    resolved: false,
    retry: false,
    hold: false,
    error: false,
    error_code: null,
  };
  if (unique.length > 1) {
    return { ...base, ambiguous: true, hold: true, error_code: 'pointer_ambiguous' };
  }
  if (unique.length === 1 && excluded.has(String(unique[0]))) {
    return { ...base, excluded: true, hold: true, error_code: 'pointer_excluded_uid' };
  }
  if (unique.length === 1) {
    return { ...base, resolved: true, stop_reason: counts.stop_reason };
  }
  const action = zeroMatchAction(queueRow, settings);
  if (action.action === 'hold') {
    return { ...base, zero_match: true, hold: true, error_code: action.error_code };
  }
  return { ...base, zero_match: true, retry: true, error_code: null };
}

export function evaluateResolvePages({ pages, queueRow, settings, prior }) {
  const maxPages = clampedResolvePages(settings);
  const lookbackHours = clampedLookbackHours(settings);
  const eventAt = Date.parse(queueRow?.webhook_event_at || '');
  const cutoffMs = Number.isFinite(eventAt) ? eventAt - lookbackHours * 60 * 60 * 1000 : null;
  const wanted = midKey(queueRow?.webhook_message_id);
  const excludedUids = [
    STUCK_REAL_UID,
    ...settingsArray(settings, 'hostinger_fetch_excluded_uids').map((value) => String(value)),
  ];
  const counts = {
    matches: Array.isArray(prior?.matches) ? prior.matches.filter((uid) => Number.isInteger(uid)) : [],
    pages_scanned: Number(prior?.pages_scanned || 0),
    items_seen: Number(prior?.items_seen || 0),
    invalid_items: Number(prior?.invalid_items || 0),
    total: Number(prior?.total || 0),
    stop_reason: 'max_pages',
    excludedUids,
  };
  const list = Array.isArray(pages) ? pages : [];
  for (let index = 0; index < list.length && counts.pages_scanned < maxPages; index += 1) {
    const status = listHttpStatus(list[index]);
    if (status.timedOut) {
      return blankEvaluation({
        ...counts,
        matches: [],
        stop_reason: 'timeout',
        error: true,
        hold: false,
        error_code: 'hostinger_timeout',
      });
    }
    if (status.status === 429) {
      const action = rateLimitAction(queueRow, settings);
      return blankEvaluation({
        pages_scanned: counts.pages_scanned,
        total: counts.total,
        items_seen: counts.items_seen,
        invalid_items: counts.invalid_items,
        stop_reason: 'rate_limited',
        retry: action.action === 'reschedule',
        hold: action.action === 'hold',
        error_code: action.action === 'hold' ? 'hostinger_rate_limited' : null,
      });
    }
    if (status.status >= 500) {
      return blankEvaluation({
        stop_reason: 'upstream',
        error: true,
        error_code: 'hostinger_upstream_error',
        pages_scanned: counts.pages_scanned,
        items_seen: counts.items_seen,
        invalid_items: counts.invalid_items,
        total: counts.total,
      });
    }
    if (status.status === 401 || status.status === 403) {
      return blankEvaluation({
        stop_reason: 'auth',
        error: true,
        error_code: 'hostinger_auth_rejected',
        pages_scanned: counts.pages_scanned,
      });
    }
    const parsed = parseListEnvelope(list[index]);
    if (!parsed.ok) {
      return blankEvaluation({
        stop_reason: 'malformed',
        hold: true,
        error_code: 'resolve_response_malformed',
        pages_scanned: counts.pages_scanned,
        items_seen: counts.items_seen,
        invalid_items: counts.invalid_items,
        total: counts.total,
      });
    }
    counts.pages_scanned += 1;
    counts.total = parsed.pagination.total;
    let allOlder = parsed.items.length > 0 && cutoffMs != null;
    for (const item of parsed.items) {
      counts.items_seen += 1;
      if (item == null || typeof item !== 'object' || Array.isArray(item)) {
        counts.invalid_items += 1;
        allOlder = false;
        continue;
      }
      if (cutoffMs == null || !itemOlderThan(item, cutoffMs)) allOlder = false;
      const uid = listItemUid(item);
      if (uid == null) {
        counts.invalid_items += 1;
        continue;
      }
      const path = item.path == null ? 'INBOX' : String(item.path);
      const key = midKey(item.messageId);
      if (wanted && key && key === wanted && path === 'INBOX') counts.matches.push(uid);
    }
    if (allOlder) {
      counts.stop_reason = 'time_window';
      break;
    }
    if (counts.pages_scanned >= maxPages) {
      counts.stop_reason = 'max_pages';
      break;
    }
  }
  const evaluation = finishMatchEvaluation(counts, queueRow, settings);
  if (evaluation.error_code && !RESOLVE_ERROR_CODES.has(evaluation.error_code)) {
    return blankEvaluation({ hold: true, error_code: 'resolve_response_malformed', stop_reason: 'malformed' });
  }
  return evaluation;
}

export function buildResolveWriteSql({ queueRow, settings, evaluation }) {
  const queueId = requireUuid(queueRow.id);
  const outcome = evaluation || blankEvaluation();
  if (outcome.resolved && outcome.matches.length === 1) {
    const uid = outcome.matches[0];
    const pages = Number(outcome.pages_scanned || 0);
    const total = Number(outcome.total || 0);
    return {
      outcome: 'resolved',
      sql: `
SELECT email_automation.resolve_intake_uid(
  ${quoteLiteral(queueId)}::uuid,
  ${uid}::bigint,
  ${pages}::int,
  ${total}::int
) AS outcome,
${uid}::bigint AS uid;
`.trim(),
    };
  }
  if (outcome.retry) {
    const action = outcome.stop_reason === 'rate_limited'
      ? rateLimitAction(queueRow, settings)
      : zeroMatchAction(queueRow, settings);
    if (action.action !== 'reschedule') {
      return {
        outcome: 'held',
        sql: buildClosedHoldSql({
          queue_id: queueId,
          queue_status: 'held',
          hold_reason: action.error_code,
          error_code: action.error_code,
          detail: action.error_code,
          fetch_base_url: 'resolve',
        }).replace(
          /RETURNING intake_queue_id AS id,/,
          "RETURNING 'held'::text AS outcome, intake_queue_id AS id,",
        ),
      };
    }
    return {
      outcome: 'rescheduled',
      sql: rescheduleResolveSql(queueId, action.minutes, action.rate_limit_consumed ?? null),
    };
  }
  const reason = outcome.error_code || 'resolve_response_malformed';
  const queueStatus = outcome.error ? 'error' : 'held';
  const detail = reason === 'hostinger_timeout' || reason === 'hostinger_upstream_error' ? reason : reason;
  return {
    outcome: outcome.error ? 'error' : 'held',
    sql: buildClosedHoldSql({
      queue_id: queueId,
      queue_status: queueStatus,
      hold_reason: reason,
      error_code: reason,
      detail,
      fetch_base_url: 'resolve',
    }).replace(
      /RETURNING intake_queue_id AS id,/,
      `RETURNING '${outcome.error ? 'error' : 'held'}'::text AS outcome, intake_queue_id AS id,`,
    ),
  };
}

export function planResolveStart({ queueRow, settings }) {
  const baseUrl = settingsString(settings, 'hostinger_mail_api_base_url', DISABLED_BASE_URL);
  const page = 1;
  let listUrl = null;
  if (baseUrl !== DISABLED_BASE_URL && baseUrl !== 'off' && baseUrl !== 'mock') {
    listUrl = buildListMessagesUrl(baseUrl, queueRow.mailbox_resource_id, page);
  }
  return {
    queue_id: queueRow.id,
    webhook_message_id: queueRow.webhook_message_id,
    mailbox_resource_id: queueRow.mailbox_resource_id,
    page,
    max_pages: clampedResolvePages(settings),
    lookback_hours: clampedLookbackHours(settings),
    event_at: queueRow.webhook_event_at || null,
    base_url: baseUrl,
    timeout_ms: settingsInt(settings, 'hostinger_fetch_timeout_ms', DEFAULT_TIMEOUT_MS, 20000),
    allowed_hosts: settingsArray(settings, 'hostinger_mail_api_allowed_hosts'),
    live_fetch: settings?.hostinger_live_fetch_enabled === true,
    list_url: listUrl,
    method: 'GET',
  };
}

const LIST_TARGET_MESSAGE_ID = '<mock-list@example.com>';

function mockListItem({ uid, messageId, path, date }) {
  return {
    uid,
    path: path === undefined ? 'INBOX' : path,
    date: date === undefined ? '2026-09-29T05:00:00.000Z' : date,
    flags: [],
    unseen: true,
    size: 120,
    subject: 'Mock list item',
    from: { name: 'Pat Customer', address: 'pat@example.com' },
    to: [{ name: 'TVG', address: 'info@vent-guys.com' }],
    messageId: messageId === undefined ? `<other-${uid}@example.com>` : messageId,
  };
}

function mockListPage(items, page, totalPages) {
  const total = totalPages * 1;
  return {
    http_status: 200,
    timeout: false,
    response_body: {
      data: items,
      pagination: { page, perPage: 100, total, totalPages },
    },
  };
}

export function renderMockListMessages({ scenario, page = 1, attempt = 1 }) {
  const pageNum = Number(page) || 1;
  const name = String(scenario || '');
  if (name === 'mbx_list_429') {
    return { http_status: 429, timeout: false, response_body: { error: 'rate_limited' } };
  }
  if (name === 'mbx_list_401') {
    return { http_status: 401, timeout: false, response_body: { error: 'auth' } };
  }
  if (name === 'mbx_list_500') {
    return { http_status: 500, timeout: false, response_body: { error: 'upstream' } };
  }
  if (name === 'mbx_list_timeout') {
    return { http_status: 200, timeout: true, response_body: { error: 'delayed' } };
  }
  if (name === 'mbx_list_badpage') {
    return {
      http_status: 200,
      timeout: false,
      response_body: { data: { unexpected: true }, pagination: { page: pageNum, perPage: '100', total: 1, totalPages: 1 } },
    };
  }
  const hit = (uid, messageId, path) => mockListItem({ uid, messageId, path });
  if (name === 'mbx_list_hit1') {
    return mockListPage([
      hit(3101, LIST_TARGET_MESSAGE_ID),
      hit(3102),
    ], pageNum, 1);
  }
  if (name === 'mbx_list_hit3') {
    if (pageNum < 3) return mockListPage([hit(3200 + pageNum)], pageNum, 3);
    return mockListPage([hit(3303, LIST_TARGET_MESSAGE_ID)], pageNum, 3);
  }
  if (name === 'mbx_list_miss') {
    if (pageNum >= 4) return mockListPage([hit(3404, LIST_TARGET_MESSAGE_ID)], pageNum, 4);
    return mockListPage([hit(3400 + pageNum)], pageNum, 4);
  }
  if (name === 'mbx_list_ambiguous') {
    return mockListPage([
      hit(3501, LIST_TARGET_MESSAGE_ID),
      hit(3502, LIST_TARGET_MESSAGE_ID),
    ], pageNum, 1);
  }
  if (name === 'mbx_list_delay') {
    if (Number(attempt) >= 2) return mockListPage([hit(3601, LIST_TARGET_MESSAGE_ID)], pageNum, 1);
    return mockListPage([hit(3600)], pageNum, 1);
  }
  if (name === 'mbx_list_otherpath') {
    return mockListPage([hit(3701, LIST_TARGET_MESSAGE_ID, 'Sent')], pageNum, 1);
  }
  if (name === 'mbx_list_nullmid') {
    return mockListPage([hit(3801, null)], pageNum, 1);
  }
  if (name === 'mbx_list_case') {
    return mockListPage([hit(3901, '<Mock-List@Example.com>')], pageNum, 1);
  }
  if (name === 'mbx_list_collision') {
    return mockListPage([hit(2279, LIST_TARGET_MESSAGE_ID)], pageNum, 1);
  }
  return mockListPage([], pageNum, 1);
}
