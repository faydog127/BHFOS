import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');

function embedModule(source) {
  return source
    .split('\n')
    .filter((line) => !line.startsWith('import ') && !line.startsWith('export {'))
    .map((line) => (line.startsWith('export ') ? line.slice('export '.length) : line))
    .join('\n');
}

const logic = embedModule(readFileSync(join(root, 'lib/pass1-intake-logic.mjs'), 'utf8'));
const fetchLogic = embedModule(readFileSync(join(root, 'lib/pass1-hostinger-fetch.mjs'), 'utf8'));
const smsLogic = embedModule(readFileSync(join(root, 'lib/pass1-internal-sms.mjs'), 'utf8'));
const opsLogic = embedModule(readFileSync(join(root, 'lib/pass1-ops-policy.mjs'), 'utf8'));

const resumeSql = readFileSync(join(root, 'apply/resume_deferred_kill_switch.sql'), 'utf8');
const staleSql = readFileSync(join(root, 'apply/reconcile_stale_to_hold.sql'), 'utf8');

const credential = {
  postgres: {
    id: 'tvg-staging-n8n-email-automation',
    name: 'TVG Staging n8n_email_automation',
  },
};

const hostingerCredential = {
  httpHeaderAuth: {
    id: 'tvg-staging-hostinger-mail-api-placeholder',
    name: 'TVG Staging Hostinger Mail API',
  },
};

function nodeBase(id, name, type, typeVersion, x, y, parameters, extra = {}) {
  return {
    id,
    name,
    type,
    typeVersion,
    position: [x, y],
    parameters,
    ...extra,
  };
}

function codeNode(id, name, x, y, js) {
  return nodeBase(id, name, 'n8n-nodes-base.code', 2, x, y, {
    language: 'javaScript',
    mode: 'runOnceForAllItems',
    jsCode: js,
  });
}

function postgresNode(id, name, x, y, query) {
  return nodeBase(id, name, 'n8n-nodes-base.postgres', 2.5, x, y, {
    operation: 'executeQuery',
    query,
    options: { alwaysOutputData: true },
  }, { credentials: credential });
}

function workflow(name, nodes, connections) {
  return {
    name,
    nodes,
    connections,
    active: false,
    settings: { executionOrder: 'v1' },
    pinData: {},
    meta: {
      templateCredsSetupCompleted: false,
      tvgEmailPass1: {
        label: 'TVG Email Pass 1',
        hostinger: 'OFF',
        schedulesEnabled: false,
        projectRef: 'glkrykpksbsqmmilmjhs',
        productionRefForbidden: 'wwyxohjnyqnegzbxtuxs',
        credentialScope: 'staging-only',
        namePrefix: '[STAGING]',
      },
    },
    tags: [],
  };
}

function connect(map, from, to, outputIndex = 0) {
  map[from] ||= { main: [] };
  map[from].main[outputIndex] ||= [];
  map[from].main[outputIndex].push({ node: to, type: 'main', index: 0 });
}

const fastAckPrepare = `${logic}

// Auth: enforced by Webhook node Header Auth (httpHeaderAuth credential).
// Do not re-check $env.HOSTINGER_WEBHOOK_SECRET here (Starter Variables / Code-node secret path retired).
const item = $input.first().json;
const body = item.body && typeof item.body === 'object' ? item.body : item;
const planned = planFastAck(body);
return [{ json: planned }];
`;

const fastAckShape = `
const prepared = $('Prepare intake').first().json;
const rows = $input.all().map((item) => item.json).filter((row) => row && row.id);
return [{
  json: {
    http_status: 200,
    response_body: {
      ok: true,
      duplicate: rows.length === 0,
      intake_id: rows[0] ? rows[0].id : null,
    },
  },
}];
`;

const fastAck = workflow(
  '[STAGING] TVG Email Intake — Fast ACK',
  [
    nodeBase('aa000000-0000-4000-8000-000000000001', 'Webhook', 'n8n-nodes-base.webhook', 2, 0, 0, {
      httpMethod: 'POST',
      path: 'tvg/hostinger-mail/inbound',
      responseMode: 'responseNode',
      options: {},
      authentication: 'headerAuth',
    }, {
      webhookId: 'aa000000-0000-4000-8000-000000000010',
      credentials: {
        httpHeaderAuth: {
          id: 'REPLACE_WITH_STAGING_HEADER_AUTH_CRED_ID',
          name: 'TVG Staging Hostinger Webhook Header Auth',
        },
      },
    }),
    nodeBase('aa000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -220, {
      content: 'TVG Email Pass 1. Workflow MUST stay inactive. Do not point Hostinger at this path. Auth = Webhook Header Auth credential (Authorization: Bearer …). No Global Variables for auth. No fetch on this path. Incomplete pointer: HTTP 400 from Shape reject, no intake_queue insert. Auth sample is disconnected.',
      width: 560,
      height: 160,
    }),
    codeNode('aa000000-0000-4000-8000-000000000002', 'Prepare intake', 280, 0, fastAckPrepare),
    nodeBase('aa000000-0000-4000-8000-000000000003', 'Has durable SQL', 'n8n-nodes-base.if', 2.2, 560, 0, {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        combinator: 'and',
        conditions: [
          {
            id: 'sql-present',
            leftValue: '={{ $json.sql }}',
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
      },
    }),
    postgresNode('aa000000-0000-4000-8000-000000000004', 'Insert pointer', 840, -80, '={{ $json.sql }}'),
    codeNode('aa000000-0000-4000-8000-000000000005', 'Shape ack', 1100, -80, fastAckShape),
    postgresNode('aa000000-0000-4000-8000-000000000006', 'Auth sample disconnected', 840, 320, "={{ $json.sample_sql || 'SELECT 1 WHERE false' }}"),
    codeNode('aa000000-0000-4000-8000-000000000008', 'Shape reject', 1100, 160, `
const prepared = $('Prepare intake').first().json;
return [{ json: { http_status: prepared.http_status, response_body: prepared.response_body } }];
`),
    nodeBase('aa000000-0000-4000-8000-000000000007', 'Respond', 'n8n-nodes-base.respondToWebhook', 1.1, 1360, 0, {
      respondWith: 'json',
      responseBody: '={{ $json.response_body }}',
      options: { responseCode: '={{ $json.http_status }}' },
    }),
  ],
  {},
);

// Rewire fast ACK through the IF node. True output inserts; false output samples or responds.
const fastMap = {};
connect(fastMap, 'Webhook', 'Prepare intake');
connect(fastMap, 'Prepare intake', 'Has durable SQL');
connect(fastMap, 'Has durable SQL', 'Insert pointer', 0);
connect(fastMap, 'Has durable SQL', 'Shape reject', 1);
connect(fastMap, 'Insert pointer', 'Shape ack');
connect(fastMap, 'Shape ack', 'Respond');
connect(fastMap, 'Shape reject', 'Respond');
fastAck.connections = fastMap;
fastAck.meta.auth_redesign = 'headerAuth-2026-09-24';
fastAck.meta.hostinger = 'OFF';
const authSample = fastAck.nodes.find((node) => node.name === 'Auth sample disconnected');
authSample.disabled = true;
delete authSample.parameters.options;

const sqlGuard = `
function refuseUnsafeSql(sql) {
  if (/email_responses|email_send_queue|developers\\.hostinger|insert\\s+into\\s+public\\./i.test(sql || '')) {
    throw new Error('refusing SQL that mentions send tables, public inserts, or the Hostinger developers host');
  }
}
`;

const workerEval = `${logic}

${fetchLogic}

${sqlGuard}

const row = $input.first().json || {};
if (!row.queue_row) return [{ json: { sql: null, skipped: true, fetch_base_url: row.fetch_base_url || null } }];
const queue = row.queue_row;
const synthetic = queue.hostinger_pointers && queue.hostinger_pointers.synthetic_message;
if (!synthetic) {
  const sql = buildClosedHoldSql({
    queue_id: queue.id,
    queue_status: 'held',
    hold_reason: 'pointer_unresolved',
    error_code: 'pointer_unresolved',
    detail: 'evaluate_received_non_synthetic',
    fetch_base_url: row.fetch_base_url || 'disabled',
  });
  refuseUnsafeSql(sql);
  return [{ json: { sql, fetch_base_url: row.fetch_base_url || 'disabled', decision: { event_status: 'held', hold_reason: 'pointer_unresolved' }, display: {} } }];
}
const decision = evaluateIntake({
  message: { ...synthetic, mailbox: queue.mailbox },
  filterRows: row.filter_rows || [],
  formSenders: row.form_senders || [],
  settings: row.settings || {},
  contacts: row.contacts || [],
  leads: row.leads || [],
});
const sql = buildOutcomeSql({
  ...decision,
  queue_id: queue.id,
  mailbox: queue.mailbox,
  mailbox_resource_id: queue.mailbox_resource_id,
  folder: queue.folder,
  uid: String(queue.uid),
  subject: synthetic.subject || null,
  date_header: synthetic.date_header || null,
  authentication_results: synthetic.authentication_results || null,
  body_excerpt: decision.body_normalized || '',
  in_reply_to: synthetic.in_reply_to || synthetic.inReplyTo || null,
  references: synthetic.references || synthetic.references_header || null,
  attachment_meta: synthetic.attachment_meta || synthetic.attachments || null,
  fetch_base_url: row.fetch_base_url || 'disabled',
  fetch_mode: 'synthetic',
});
refuseUnsafeSql(sql);
const formFields = synthetic.form_fields && typeof synthetic.form_fields === 'object' ? synthetic.form_fields : {};
const display = {
  senderName: synthetic.sender_name || synthetic.from_name || '',
  senderEmail: decision.from_email || '',
  subject: synthetic.subject || '',
  formFields: {
    service: formFields.service || '',
    city: formFields.city || '',
  },
};
return [{ json: { sql, decision, display, fetch_base_url: row.fetch_base_url || 'disabled' } }];
`;

const workerPlan = `${logic}

${fetchLogic}

const claimed = $input.all().map((item) => item.json).find((item) => item && item.queue_row);
if (!claimed) return [{ json: planWorkerRoute({ queueRow: null, settings: {} }) }];
return [{ json: planWorkerRoute({
  queueRow: claimed.queue_row,
  settings: claimed.settings || {},
  filterRows: claimed.filter_rows || [],
  formSenders: claimed.form_senders || [],
  contacts: claimed.contacts || [],
  leads: claimed.leads || [],
}) }];
`;

const workerGuard = `${logic}

${fetchLogic}

${sqlGuard}

const plan = $input.first().json || {};
const checked = recheckFetchPlan(plan);
if (!checked.ok) {
  refuseUnsafeSql(checked.sql);
  return [{
    json: {
      guard_ok: false,
      sql: checked.sql,
      fetch_base_url: plan.fetch_base_url || null,
      decision: { event_status: 'held', hold_reason: checked.hold_reason || 'hostinger_request_rejected' },
      display: {},
    },
  }];
}
return [{ json: { ...plan, guard_ok: true } }];
`;

const workerNormalize = `${logic}

${fetchLogic}

${sqlGuard}

function nodeJson(name) {
  try {
    const item = $(name).first();
    return item ? item.json : null;
  } catch (error) {
    return { error: { message: 'node ' + name + ' did not run' } };
  }
}
const plan = nodeJson('Plan route') || {};
const decided = decideFetchedIntake({
  plan,
  metadataItem: nodeJson('Fetch metadata'),
  textItem: nodeJson('Fetch text'),
  sourceItem: nodeJson('Fetch source'),
});
refuseUnsafeSql(decided.sql);
return [{ json: decided }];
`;

const workerClosed = `${logic}

${fetchLogic}

${sqlGuard}

const plan = $input.first().json || {};
const sql = buildClosedHoldSql({
  queue_id: plan.queue_row.id,
  queue_status: plan.queue_status || 'held',
  hold_reason: plan.hold_reason,
  error_code: plan.error_code,
  detail: plan.detail,
  fetch_base_url: plan.fetch_base_url,
});
refuseUnsafeSql(sql);
return [{
  json: {
    sql,
    fetch_base_url: plan.fetch_base_url,
    decision: {
      event_status: plan.queue_status === 'error' ? 'error' : 'held',
      hold_reason: plan.hold_reason,
    },
    display: {},
  },
}];
`;

const workerClaimSql = `
WITH claim AS (
  SELECT q.id
  FROM email_automation.intake_queue q
  WHERE q.tenant_id = 'tvg'
    AND q.status = 'pending'
    AND (
      q.hostinger_pointers ? 'synthetic_message'
      OR (
        q.uid IS DISTINCT FROM 924150001
        AND NOT EXISTS (
          SELECT 1
          FROM email_automation.automation_settings s
          CROSS JOIN LATERAL jsonb_array_elements_text(s.value_json) AS ex(uid_text)
          WHERE s.tenant_id = 'tvg'
            AND s.key = 'hostinger_fetch_excluded_uids'
            AND jsonb_typeof(s.value_json) = 'array'
            AND ex.uid_text ~ '^[0-9]{1,18}$'
            AND ex.uid_text::bigint = q.uid
        )
      )
    )
  ORDER BY q.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT COALESCE((
    SELECT (s.value_json #>> '{}')::int
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'worker_claim_batch_size'
  ), 1)
),
updated AS (
  UPDATE email_automation.intake_queue q
  SET status = 'processing',
      locked_at = now(),
      locked_by = CASE
        WHEN q.hostinger_pointers ? 'synthetic_message' THEN 'n8n-worker-synthetic'
        ELSE 'n8n-worker-fetch'
      END,
      attempt_count = q.attempt_count + 1
  FROM claim
  WHERE q.id = claim.id
    AND COALESCE((
      SELECT s.value_json = 'true'::jsonb
      FROM email_automation.automation_settings s
      WHERE s.tenant_id = 'tvg' AND s.key = 'intake_processing_enabled'
    ), false)
  RETURNING q.*
)
SELECT
  to_jsonb(u.*) AS queue_row,
  (SELECT coalesce(jsonb_agg(to_jsonb(f.*) ORDER BY f.kind, f.pattern), '[]'::jsonb)
     FROM email_automation.email_filter_lists f
     WHERE f.tenant_id = 'tvg' AND f.enabled) AS filter_rows,
  (SELECT coalesce(jsonb_agg(to_jsonb(s.*) ORDER BY s.from_email), '[]'::jsonb)
     FROM email_automation.known_form_senders s
     WHERE s.tenant_id = 'tvg' AND s.enabled) AS form_senders,
  (SELECT coalesce(jsonb_object_agg(s.key, s.value_json), '{}'::jsonb)
     FROM email_automation.automation_settings s
     WHERE s.tenant_id = 'tvg') AS settings,
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'email', c.email, 'phone', c.phone, 'tenant_id', c.tenant_id
    )), '[]'::jsonb)
     FROM public.contacts c) AS contacts,
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'email', l.email, 'status', l.status, 'contact_id', l.contact_id, 'tenant_id', l.tenant_id
    )), '[]'::jsonb)
     FROM public.leads l) AS leads
FROM updated u;
`.trim();

const smsBudgetSql = `
SELECT
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24') AS suppression_window,
  COALESCE((
    SELECT (s.value_json #>> '{}')::int
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'max_internal_sms_per_hour'
  ), 10) AS max_per_hour,
  COALESCE((
    SELECT s.value_json = 'true'::jsonb
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'internal_sms_enabled'
  ), false) AS sms_enabled,
  (
    SELECT count(*) FROM email_automation.notification_log n
    WHERE n.tenant_id = 'tvg'
      AND n.channel = 'internal_sms'
      AND n.notification_kind = 'actionable_inbound'
      AND n.delivery_state IN ('queued', 'attempted', 'sent', 'delivered', 'recorded_not_sent')
      AND n.attempted_at >= date_trunc('hour', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC'
  ) AS ordinary_sent,
  (
    SELECT count(*) FROM email_automation.notification_log n
    WHERE n.tenant_id = 'tvg'
      AND n.channel = 'internal_sms'
      AND n.notification_kind IN ('hold_alert', 'error_alert')
      AND n.delivery_state IN ('queued', 'attempted', 'sent', 'delivered', 'recorded_not_sent')
      AND n.attempted_at >= date_trunc('hour', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC'
  ) AS priority_sent,
  (
    SELECT count(*) FROM email_automation.notification_log n
    WHERE n.tenant_id = 'tvg'
      AND n.channel = 'internal_sms'
      AND n.notification_kind = 'actionable_inbound'
      AND n.suppression_state = 'suppressed'
      AND n.suppression_window = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24')
  ) AS suppressed_ordinary,
  EXISTS (
    SELECT 1 FROM email_automation.notification_log n
    WHERE n.tenant_id = 'tvg'
      AND n.channel = 'internal_sms'
      AND n.notification_kind = 'storm_summary'
      AND n.suppression_window = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24')
  ) AS summary_sent,
  (
    SELECT s.value_json #>> '{}'
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'internal_sms_destination_ref'
  ) AS destination_ref,
  (
    SELECT CASE
      WHEN s.value_json IS NULL OR s.value_json = 'null'::jsonb THEN NULL
      ELSE s.value_json #>> '{}'
    END
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'live_notification_started_at'
  ) AS live_notification_started_at,
  (
    SELECT count(*)
    FROM email_automation.email_events e
    WHERE e.tenant_id = 'tvg'
      AND e.status IN ('awaiting_pass2', 'held', 'error')
      AND (
        (
          SELECT s.value_json
          FROM email_automation.automation_settings s
          WHERE s.tenant_id = 'tvg' AND s.key = 'live_notification_started_at'
        ) IS NOT DISTINCT FROM 'null'::jsonb
        OR e.created_at < (
          SELECT (s.value_json #>> '{}')::timestamptz
          FROM email_automation.automation_settings s
          WHERE s.tenant_id = 'tvg'
            AND s.key = 'live_notification_started_at'
            AND s.value_json IS DISTINCT FROM 'null'::jsonb
        )
      )
  ) AS backlog_count,
  EXISTS (
    SELECT 1 FROM email_automation.notification_log n
    WHERE n.tenant_id = 'tvg'
      AND n.channel = 'internal_sms'
      AND n.notification_kind = 'backlog_summary'
  ) AS backlog_summary_sent;
`.trim();

const smsPlan = `${logic}

${smsLogic}

// SMS_PLAN_FOOTER
const written = $('Write outcome').first().json || {};
const budget = $input.first().json || {};
function executedJson(name) {
  try {
    const item = $(name).first();
    if (item && item.json && item.json.decision) return item.json;
  } catch (error) {
    return null;
  }
  return null;
}
const evaluated = executedJson('Evaluate') || executedJson('Normalize fetch') || executedJson('Closed hold') || {};
const decision = evaluated.decision || {};
const display = evaluated.display || {};
const wasExisting = written.was_existing === true || written.was_existing === 't' || written.was_existing === 'true';
if (!written.email_event_id || wasExisting || !decision.event_status) {
  return [{ json: { action: wasExisting ? 'dedup' : 'skip', sql: null, summarySql: null } }];
}
const planned = planInternalSms({
  status: decision.event_status,
  emailEventId: written.email_event_id,
  holdReason: decision.hold_reason || null,
  errorCode: decision.error_code || null,
  senderName: display.senderName || '',
  senderEmail: display.senderEmail || '',
  subject: display.subject || '',
  formFields: display.formFields || {},
  maxPerHour: Number(budget.max_per_hour || 10),
  ordinarySent: Number(budget.ordinary_sent || 0),
  prioritySent: Number(budget.priority_sent || 0),
  suppressedOrdinary: Number(budget.suppressed_ordinary || 0),
  summarySent: budget.summary_sent === true || budget.summary_sent === 't' || budget.summary_sent === 'true',
  suppressionWindow: budget.suppression_window || null,
  existingKeys: new Set(),
  liveNotificationStartedAt: budget.live_notification_started_at ?? null,
  eventCreatedAt: written.event_created_at || null,
  backlogSummarySent: budget.backlog_summary_sent === true || budget.backlog_summary_sent === 't' || budget.backlog_summary_sent === 'true',
  backlogCount: Number(budget.backlog_count || 1),
});
const smsEnabled = budget.sms_enabled === true || budget.sms_enabled === 't' || budget.sms_enabled === 'true';
const gated = gateSmsTransport(planned, smsEnabled);
if (gated.action === 'skip' || gated.action === 'dedup') {
  return [{ json: { action: gated.action, sql: null, summarySql: null } }];
}
const destinationRef = budget.destination_ref || '';
const sql = buildNotificationInsertSql({
  action: gated.action,
  kind: gated.kind,
  emailEventId: gated.emailEventId,
  status: decision.event_status,
  holdReason: decision.hold_reason || null,
  errorCode: decision.error_code || null,
  deliveryState: gated.deliveryState,
  suppressionReason: gated.suppressionReason,
  suppressionWindow: gated.action === 'suppress' ? (budget.suppression_window || null) : null,
  smsText: gated.smsBody || null,
  destinationRef,
});
let summarySql = null;
if (gated.summary) {
  const summaryKind = gated.summary.kind;
  summarySql = buildNotificationInsertSql({
    action: gated.summary.deliveryState === 'recorded_not_sent' ? 'record_only' : 'send',
    kind: summaryKind,
    deliveryState: gated.summary.deliveryState || null,
    suppressionWindow: summaryKind === 'storm_summary'
      ? (gated.summary.suppressionWindow || budget.suppression_window)
      : (gated.summary.suppressionWindow || null),
    status: summaryKind === 'backlog_summary' ? 'backlog' : 'storm',
    smsText: gated.summary.smsBody,
    destinationRef,
  });
}
return [{ json: { action: gated.action, kind: gated.kind, sql, summarySql } }];
`;

function routeIf(id, name, x, y, route) {
  return nodeBase(id, name, 'n8n-nodes-base.if', 2.2, x, y, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      combinator: 'and',
      conditions: [
        {
          id: `${route}-route`,
          leftValue: '={{ $json.route }}',
          rightValue: route,
          operator: { type: 'string', operation: 'equals' },
        },
      ],
    },
  });
}

function hostingerGetNode(id, name, x, y, urlField) {
  return nodeBase(id, name, 'n8n-nodes-base.httpRequest', 4.2, x, y, {
    method: 'GET',
    url: `={{ $('Plan route').first().json.${urlField} }}`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    options: {
      timeout: "={{ $('Plan route').first().json.timeout_ms }}",
      redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
      response: {
        response: {
          fullResponse: true,
          neverError: true,
          responseFormat: 'text',
        },
      },
    },
  }, {
    credentials: hostingerCredential,
    onError: 'continueRegularOutput',
    notes: 'GET only. URL comes from Plan route after the host and path guard. No live token in this file.',
  });
}

const workerMap = {};
connect(workerMap, 'Manual start', 'Claim pending');
connect(workerMap, 'Claim pending', 'Plan route');
connect(workerMap, 'Plan route', 'Is fetch');
connect(workerMap, 'Is fetch', 'Re-guard GET', 0);
connect(workerMap, 'Is fetch', 'Is closed hold', 1);
connect(workerMap, 'Re-guard GET', 'Guard passed');
connect(workerMap, 'Guard passed', 'Fetch metadata', 0);
connect(workerMap, 'Guard passed', 'Write outcome', 1);
connect(workerMap, 'Fetch metadata', 'Fetch text');
connect(workerMap, 'Fetch text', 'Fetch source');
connect(workerMap, 'Fetch source', 'Normalize fetch');
connect(workerMap, 'Normalize fetch', 'Write outcome');
connect(workerMap, 'Is closed hold', 'Closed hold', 0);
connect(workerMap, 'Is closed hold', 'Evaluate', 1);
connect(workerMap, 'Closed hold', 'Write outcome');
connect(workerMap, 'Evaluate', 'Write outcome');
connect(workerMap, 'Write outcome', 'Load SMS budget');
connect(workerMap, 'Load SMS budget', 'Plan internal SMS');
connect(workerMap, 'Plan internal SMS', 'Record notification');
connect(workerMap, 'Record notification', 'Record notification summary');

const worker = workflow(
  '[STAGING] TVG Email Intake — Worker',
  [
    nodeBase('bb000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -280, {
      content: 'Inactive. No schedule. Synthetic rows skip HTTP. Real pointers are GET metadata, text, and source only, after a host allowlist check. Base URL defaults to disabled, never the live API. api.mail.hostinger.com also requires hostinger_live_fetch_enabled. Non-synthetic uid 924150001 is excluded from claim and is not fetched. GET /text marks Seen on the live API per the Hostinger SDK; metadata and source docs do not say they change flags. No Twilio. No customer send.',
      width: 760,
      height: 180,
    }),
    nodeBase('bb000000-0000-4000-8000-000000000001', 'Manual start', 'n8n-nodes-base.manualTrigger', 1, 0, 0, {}),
    postgresNode('bb000000-0000-4000-8000-000000000002', 'Claim pending', 280, 0, workerClaimSql),
    codeNode('bb000000-0000-4000-8000-000000000003', 'Plan route', 560, 0, workerPlan),
    routeIf('bb000000-0000-4000-8000-000000000009', 'Is fetch', 840, 0, 'fetch'),
    codeNode('bb000000-0000-4000-8000-00000000000a', 'Re-guard GET', 1120, -180, workerGuard),
    nodeBase('bb000000-0000-4000-8000-00000000000b', 'Guard passed', 'n8n-nodes-base.if', 2.2, 1400, -180, {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        combinator: 'and',
        conditions: [
          {
            id: 'guard-ok',
            leftValue: '={{ $json.guard_ok }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
      },
    }),
    hostingerGetNode('bb000000-0000-4000-8000-00000000000c', 'Fetch metadata', 1680, -300, 'metadata_url'),
    hostingerGetNode('bb000000-0000-4000-8000-00000000000d', 'Fetch text', 1960, -300, 'text_url'),
    hostingerGetNode('bb000000-0000-4000-8000-00000000000e', 'Fetch source', 2240, -300, 'source_url'),
    codeNode('bb000000-0000-4000-8000-00000000000f', 'Normalize fetch', 2520, -300, workerNormalize),
    routeIf('bb000000-0000-4000-8000-000000000010', 'Is closed hold', 1120, 180, 'hold'),
    codeNode('bb000000-0000-4000-8000-000000000011', 'Closed hold', 1400, 180, workerClosed),
    codeNode('bb000000-0000-4000-8000-000000000012', 'Evaluate', 1400, 360, workerEval),
    postgresNode('bb000000-0000-4000-8000-000000000004', 'Write outcome', 2800, 0, "={{ $json.sql || 'SELECT 1 WHERE false' }}"),
    postgresNode('bb000000-0000-4000-8000-000000000005', 'Load SMS budget', 3080, 0, smsBudgetSql),
    codeNode('bb000000-0000-4000-8000-000000000006', 'Plan internal SMS', 3360, 0, smsPlan),
    postgresNode('bb000000-0000-4000-8000-000000000007', 'Record notification', 3640, 0, "={{ $json.sql || 'SELECT 1 WHERE false' }}"),
    postgresNode('bb000000-0000-4000-8000-000000000008', 'Record notification summary', 3920, 0, "={{ $json.summarySql || 'SELECT 1 WHERE false' }}"),
  ],
  workerMap,
);
worker.meta.tvgEmailPass1.hostingerFetch = 'get-only-mock-or-disabled';
worker.meta.tvgEmailPass1.liveFetchDefault = false;
worker.meta.hostinger = 'OFF';

const reconcileMap = {};
connect(reconcileMap, 'Manual start', 'Resume deferred');
connect(reconcileMap, 'Schedule disabled', 'Resume deferred');
connect(reconcileMap, 'Resume deferred', 'Stale to HOLD');

const reconcile = workflow(
  '[STAGING] TVG Email Intake — Reconcile',
  [
    nodeBase('cc000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -240, {
      content: 'Schedule node is disabled and the workflow is inactive. Actor A for deferred_kill_switch resume is apply/resume_deferred_kill_switch.sql. This workflow is actor B and must not be activated. No INBOX list call.',
      width: 620,
      height: 140,
    }),
    nodeBase('cc000000-0000-4000-8000-000000000001', 'Schedule disabled', 'n8n-nodes-base.scheduleTrigger', 1.2, 0, 160, {
      rule: { interval: [{ field: 'minutes', minutesInterval: 12 }] },
    }, { disabled: true }),
    nodeBase('cc000000-0000-4000-8000-000000000002', 'Manual start', 'n8n-nodes-base.manualTrigger', 1, 0, 0, {}),
    postgresNode('cc000000-0000-4000-8000-000000000003', 'Resume deferred', 300, 40, resumeSql),
    postgresNode('cc000000-0000-4000-8000-000000000004', 'Stale to HOLD', 620, 40, staleSql),
  ],
  reconcileMap,
);

const digestMap = {};
connect(digestMap, 'Manual start', 'Count filtered');
connect(digestMap, 'Schedule disabled', 'Count filtered');
connect(digestMap, 'Count filtered', 'Record suppressed digest');

const digest = workflow(
  '[STAGING] TVG Email — Daily Filtered Digest',
  [
    nodeBase('dd000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -240, {
      content: 'Schedule disabled. No email, Slack, or HTTP send node. Writes a suppressed audit row only. Customer addresses are out of scope.',
      width: 560,
      height: 120,
    }),
    nodeBase('dd000000-0000-4000-8000-000000000001', 'Schedule disabled', 'n8n-nodes-base.scheduleTrigger', 1.2, 0, 160, {
      rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 7 }] },
    }, { disabled: true }),
    nodeBase('dd000000-0000-4000-8000-000000000002', 'Manual start', 'n8n-nodes-base.manualTrigger', 1, 0, 0, {}),
    postgresNode('dd000000-0000-4000-8000-000000000003', 'Count filtered', 300, 40, `
SELECT
  (SELECT count(*) FROM email_automation.email_events
    WHERE tenant_id = 'tvg' AND status IN ('filtered', 'system_lessen')
      AND created_at > now() - interval '1 day') AS filtered_count,
  (SELECT value_json FROM email_automation.automation_settings
    WHERE tenant_id = 'tvg' AND key = 'daily_filtered_digest_enabled') AS digest_enabled,
  (SELECT value_json FROM email_automation.automation_settings
    WHERE tenant_id = 'tvg' AND key = 'daily_filtered_digest_destination') AS destination;
`.trim()),
    postgresNode('dd000000-0000-4000-8000-000000000004', 'Record suppressed digest', 620, 40, `
INSERT INTO email_automation.notification_log (
  tenant_id, kind, notification_kind, channel, destination_ref, payload_summary, status, delivery_state
)
SELECT
  'tvg',
  'daily_filtered_digest',
  'daily_filtered_digest',
  'internal_digest',
  'suppressed_pre_webhook',
  jsonb_build_object('delivery', 'not_sent', 'reason', 'pre_webhook_closed'),
  'suppressed_pre_webhook',
  'recorded_not_sent'
WHERE (
  SELECT value_json FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'daily_filtered_digest_enabled'
) IS DISTINCT FROM 'true'::jsonb
OR (
  SELECT value_json FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'daily_filtered_digest_destination'
) = 'null'::jsonb
OR (
  SELECT value_json FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'daily_filtered_digest_destination'
) IS NULL;
`.trim()),
  ],
  digestMap,
);

const smsGuard = `
const rows = $input.all().map((item) => item.json).filter((row) => row && row.id);
if (rows.length) {
  throw new Error('INTERNAL_SMS_CREDENTIAL_NOT_APPROVED: refusing to hand queued rows to Twilio. Founder approval is required before this guard is removed.');
}
return [{ json: { handed_to_twilio: false, queued_rows: 0 } }];
`;

const smsSelectSql = `
SELECT
  n.id,
  n.notification_kind,
  (
    SELECT s.value_json #>> '{}'
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'internal_sms_destination_ref'
  ) AS destination_ref,
  n.payload_summary,
  n.delivery_state,
  NULL::text AS sms_from_credential_only
FROM email_automation.notification_log n
WHERE n.tenant_id = 'tvg'
  AND n.channel = 'internal_sms'
  AND n.delivery_state = 'queued'
  AND (n.dispatch_after IS NULL OR n.dispatch_after <= now())
  AND COALESCE((
    SELECT s.value_json = 'true'::jsonb
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'internal_sms_enabled'
  ), false);
`.trim();

const smsMap = {};
connect(smsMap, 'Manual start', 'Select queued internal SMS');
connect(smsMap, 'Select queued internal SMS', 'Credential guard');

const smsDelivery = workflow(
  '[STAGING] TVG Email — Notification Dispatcher',
  [
    nodeBase('ee000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -260, {
      content: 'Inactive outbox dispatcher. Worker does not send SMS. One-way outbound only: no inbound command path. Twilio node is disabled and disconnected. to reads internal_sms_destination_ref. No phone number in this JSON. Staging credential placeholder only.',
      width: 680,
      height: 140,
    }),
    nodeBase('ee000000-0000-4000-8000-000000000001', 'Manual start', 'n8n-nodes-base.manualTrigger', 1, 0, 0, {}),
    postgresNode('ee000000-0000-4000-8000-000000000002', 'Select queued internal SMS', 280, 0, smsSelectSql),
    codeNode('ee000000-0000-4000-8000-000000000003', 'Credential guard', 560, 0, smsGuard),
    nodeBase('ee000000-0000-4000-8000-000000000004', 'Twilio send disabled', 'n8n-nodes-base.twilio', 1, 900, 220, {
      resource: 'sms',
      operation: 'send',
      from: '={{ $json.sms_from_credential_only }}',
      to: '={{ $json.destination_ref }}',
      message: '={{ $json.payload_summary && $json.payload_summary.sms_text }}',
      options: {},
    }, {
      disabled: true,
      credentials: {
        twilioApi: {
          id: 'tvg-internal-sms-twilio-placeholder',
          name: 'TVG Internal SMS Twilio',
        },
      },
    }),
  ],
  smsMap,
);
smsDelivery.meta.tvgEmailPass1.internalSms = 'placeholder-credential-not-attached';
smsDelivery.meta.tvgEmailPass1.smsTransportIsNotSoR = true;
smsDelivery.meta.tvgEmailPass1.credentialScope = 'staging-only';
smsDelivery.meta.tvgEmailPass1.smsDirection = 'one-way-outbound';
smsDelivery.meta.tvgEmailPass1.outbox = 'email_automation.notification_log';

const healthLoadSql = `
SELECT
  c.component,
  c.last_successful_health_at,
  c.open_incident_key,
  COALESCE((
    SELECT s.value_json = 'true'::jsonb
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'health_alerts_enabled'
  ), false) AS alerts_enabled,
  COALESCE((
    SELECT (s.value_json #>> '{}')::int
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'primary_path_target_seconds'
  ), 120) AS primary_target,
  (
    SELECT s.value_json #>> '{}'
    FROM email_automation.automation_settings s
    WHERE s.tenant_id = 'tvg' AND s.key = 'internal_sms_destination_ref'
  ) AS destination_ref,
  (
    SELECT count(*)
    FROM email_automation.intake_queue q
    WHERE q.tenant_id = 'tvg' AND q.status = 'pending'
  ) AS pending_count,
  NULL::integer AS newer_mail_count,
  NULL::integer AS intake_lag_seconds,
  'dormant'::text AS mailbox_probe
FROM email_automation.health_checks c
WHERE c.tenant_id = 'tvg' AND c.component = 'primary_path';
`.trim();

const healthFooter = `
const row = $input.first().json || {};
const alertsEnabled = row.alerts_enabled === true || row.alerts_enabled === 't' || row.alerts_enabled === 'true';
const last = row.last_successful_health_at ? new Date(row.last_successful_health_at) : null;
const target = Number(row.primary_target || 120);
const now = new Date();
const stale = Boolean(last) && (now.getTime() - last.getTime()) > target * 1000;
const decision = planHealthAlert({
  component: 'primary_path',
  alertsEnabled,
  pipelineOk: true,
  dependencyOk: true,
  stale,
  messagesSeen: Number(row.pending_count || 0),
  mailboxProbeLive: false,
  newerMailCount: null,
  queueLagSeconds: null,
  targetSeconds: target,
  openIncidentKey: row.open_incident_key || null,
  now: now.toISOString(),
});
const destinationRef = row.destination_ref || '';
let alertSql = null;
let stateSql = null;
if (decision.alert && decision.action === 'outage') {
  alertSql = buildHealthAlertSql(decision.alert, destinationRef);
  stateSql = buildHealthOutageSql('primary_path', decision.alert.incidentKey, decision.fault);
} else if (decision.alert && decision.action === 'recover') {
  alertSql = buildHealthAlertSql(decision.alert, destinationRef);
  stateSql = buildHealthSuccessSql('primary_path');
} else if (decision.recordSuccess) {
  stateSql = buildHealthSuccessSql('primary_path');
}
return [{ json: { action: decision.action, reason: decision.reason, fault: decision.fault, quietInbox: decision.quietInbox, alertSql, stateSql } }];
`;

const healthMap = {};
connect(healthMap, 'Manual start', 'Load health');
connect(healthMap, 'Schedule disabled', 'Load health');
connect(healthMap, 'Load health', 'Plan health');
connect(healthMap, 'Plan health', 'Record health alert');
connect(healthMap, 'Record health alert', 'Record health state');

const health = workflow(
  '[STAGING] TVG Email — Health Heartbeat',
  [
    nodeBase('ff000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -260, {
      content: 'Inactive. Quiet inbox is not a fault. Hostinger newer-mail and intake-lag checks are mock and dormant until Pre-webhook. This workflow does not call the Hostinger API. One outage and one recovery per local incident. Writes the notification_log outbox only. Does not send SMS.',
      width: 640,
      height: 140,
    }),
    nodeBase('ff000000-0000-4000-8000-000000000001', 'Schedule disabled', 'n8n-nodes-base.scheduleTrigger', 1.2, 0, 160, {
      rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] },
    }, { disabled: true }),
    nodeBase('ff000000-0000-4000-8000-000000000002', 'Manual start', 'n8n-nodes-base.manualTrigger', 1, 0, 0, {}),
    postgresNode('ff000000-0000-4000-8000-000000000003', 'Load health', 300, 40, healthLoadSql),
    codeNode('ff000000-0000-4000-8000-000000000004', 'Plan health', 620, 40, `${logic}\n\n${smsLogic}\n\n${opsLogic}\n\n${healthFooter}`),
    postgresNode('ff000000-0000-4000-8000-000000000005', 'Record health alert', 940, 40, "={{ $json.alertSql || 'SELECT 1 WHERE false' }}"),
    postgresNode('ff000000-0000-4000-8000-000000000006', 'Record health state', 1220, 40, "={{ $json.stateSql || 'SELECT 1 WHERE false' }}"),
  ],
  healthMap,
);
health.meta.tvgEmailPass1.hostingerMailboxProbe = 'dormant';
health.meta.tvgEmailPass1.hostingerApiHealth = 'not-a-live-check';

function mockWebhook(id, name, path, x, y) {
  return nodeBase(id, name, 'n8n-nodes-base.webhook', 2, x, y, {
    httpMethod: 'GET',
    path,
    responseMode: 'responseNode',
    options: {},
  }, { webhookId: id });
}

const mockRender = `${fetchLogic}

const item = $input.first().json || {};
const params = item.params || {};
const query = item.query || {};
const uid = params.uid || query.uid || '';
const rendered = renderMockHostingerResponse({ uid, kind: item.mock_kind });
return [{ json: rendered }];
`;

const mockMap = {};
connect(mockMap, 'Mock metadata', 'Mark metadata');
connect(mockMap, 'Mock text', 'Mark text');
connect(mockMap, 'Mock source', 'Mark source');
connect(mockMap, 'Mark metadata', 'Render mock');
connect(mockMap, 'Mark text', 'Render mock');
connect(mockMap, 'Mark source', 'Render mock');
connect(mockMap, 'Render mock', 'Is timeout');
connect(mockMap, 'Is timeout', 'Wait for timeout case', 0);
connect(mockMap, 'Is timeout', 'Respond mock', 1);
connect(mockMap, 'Wait for timeout case', 'Respond mock');

const hostingerMock = workflow(
  '[STAGING] TVG Email — Hostinger Mock',
  [
    nodeBase('b1000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -260, {
      content: 'Inactive mock. Not the live Hostinger API. Use the test URL only. UIDs: 910001 happy, 910404 not found, 910500 upstream, 910408 delay, 910601 missing Authentication-Results, 910602 missing Message-ID and Date, 910603 oversized text. This workflow does not read or flag a mailbox.',
      width: 720,
      height: 160,
    }),
    mockWebhook('b1000000-0000-4000-8000-000000000001', 'Mock metadata', 'tvg/staging-mock/mail/api/v1/mailboxes/:mailboxResourceId/folders/:folder/messages/:uid', 0, 0),
    mockWebhook('b1000000-0000-4000-8000-000000000002', 'Mock text', 'tvg/staging-mock/mail/api/v1/mailboxes/:mailboxResourceId/folders/:folder/messages/:uid/text', 0, 180),
    mockWebhook('b1000000-0000-4000-8000-000000000003', 'Mock source', 'tvg/staging-mock/mail/api/v1/mailboxes/:mailboxResourceId/folders/:folder/messages/:uid/source', 0, 360),
    codeNode('b1000000-0000-4000-8000-000000000004', 'Mark metadata', 360, 0, "const item = $input.first().json || {};\nreturn [{ json: { ...item, mock_kind: 'metadata' } }];\n"),
    codeNode('b1000000-0000-4000-8000-000000000005', 'Mark text', 360, 180, "const item = $input.first().json || {};\nreturn [{ json: { ...item, mock_kind: 'text' } }];\n"),
    codeNode('b1000000-0000-4000-8000-000000000006', 'Mark source', 360, 360, "const item = $input.first().json || {};\nreturn [{ json: { ...item, mock_kind: 'source' } }];\n"),
    codeNode('b1000000-0000-4000-8000-000000000007', 'Render mock', 680, 180, mockRender),
    nodeBase('b1000000-0000-4000-8000-000000000008', 'Is timeout', 'n8n-nodes-base.if', 2.2, 960, 180, {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        combinator: 'and',
        conditions: [
          {
            id: 'timeout-case',
            leftValue: '={{ $json.timeout }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
      },
    }),
    nodeBase('b1000000-0000-4000-8000-000000000009', 'Wait for timeout case', 'n8n-nodes-base.wait', 1.1, 1240, 40, {
      amount: 12,
      unit: 'seconds',
    }),
    nodeBase('b1000000-0000-4000-8000-00000000000a', 'Respond mock', 'n8n-nodes-base.respondToWebhook', 1.1, 1520, 180, {
      respondWith: 'json',
      responseBody: '={{ $json.response_body }}',
      options: { responseCode: '={{ $json.http_status }}' },
    }),
  ],
  mockMap,
);
hostingerMock.meta.tvgEmailPass1.hostingerFetch = 'inactive-mock';
hostingerMock.meta.hostinger = 'OFF';

const files = {
  'tvg-email-intake-fast-ack.json': fastAck,
  'tvg-email-intake-worker.json': worker,
  'tvg-email-hostinger-mock.json': hostingerMock,
  'tvg-email-intake-reconcile.json': reconcile,
  'tvg-email-daily-filtered-digest.json': digest,
  'tvg-email-notification-dispatcher.json': smsDelivery,
  'tvg-email-health-heartbeat.json': health,
};

for (const [name, value] of Object.entries(files)) {
  writeFileSync(join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
  process.stdout.write(`wrote ${name}\n`);
}
