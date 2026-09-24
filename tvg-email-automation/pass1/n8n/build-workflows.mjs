import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const logic = readFileSync(join(root, 'lib/pass1-intake-logic.mjs'), 'utf8')
  .split('\n')
  .filter((line) => !line.startsWith('export {'))
  .map((line) => (line.startsWith('export ') ? line.slice('export '.length) : line))
  .join('\n');

const resumeSql = readFileSync(join(root, 'apply/resume_deferred_kill_switch.sql'), 'utf8');
const staleSql = readFileSync(join(root, 'apply/reconcile_stale_to_hold.sql'), 'utf8');

const credential = {
  postgres: {
    id: 'tvg-staging-n8n-email-automation',
    name: 'TVG Staging n8n_email_automation',
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

const item = $input.first().json;
const body = item.body && typeof item.body === 'object' ? item.body : item;
const headers = item.headers || {};
const secret = (typeof $env !== 'undefined' && $env.HOSTINGER_WEBHOOK_SECRET) ? String($env.HOSTINGER_WEBHOOK_SECRET) : '';
const headerValue = headers.authorization || headers.Authorization || '';
const presented = headerValue.startsWith('Bearer ') ? headerValue.slice('Bearer '.length) : '';
let authOk = false;
if (secret && presented.length === secret.length) {
  let mismatch = 0;
  for (let i = 0; i < secret.length; i += 1) mismatch |= secret.charCodeAt(i) ^ presented.charCodeAt(i);
  authOk = mismatch === 0;
}
if (!authOk) {
  const reason = secret ? 'bad_bearer' : 'webhook_secret_unset';
  return [{
    json: {
      http_status: 401,
      response_body: { ok: false, error: 'unauthorized' },
      sql: null,
      sample_sql: \`INSERT INTO email_automation.notification_log (tenant_id, kind, destination_ref, payload_summary, status)
SELECT 'tvg', 'auth_reject_sample', 'internal_sample', \${quoteLiteral(JSON.stringify({ reason }))}::jsonb, 'sampled'
WHERE (
  SELECT count(*) FROM email_automation.notification_log
  WHERE tenant_id = 'tvg' AND kind = 'auth_reject_sample' AND created_at > now() - interval '1 hour'
) < COALESCE((
  SELECT (value_json #>> '{}')::int
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'rejected_webhook_sample_per_hour'
), 5);\`,
    },
  }];
}
const pointer = normalizeWebhookPointer(body);
if (!pointer.ok) {
  return [{
    json: {
      http_status: 400,
      response_body: { ok: false, error: pointer.reason },
      sql: null,
      sample_sql: null,
    },
  }];
}
const killSwitchSql = \`(
  SELECT COALESCE((
    SELECT value_json = 'true'::jsonb
    FROM email_automation.automation_settings
    WHERE tenant_id = 'tvg' AND key = 'intake_processing_enabled'
  ), true)
)\`;
return [{
  json: {
    http_status: 200,
    response_body: { ok: true },
    sample_sql: null,
    sql: \`
INSERT INTO email_automation.intake_queue (
  tenant_id, mailbox, mailbox_resource_id, folder, uid, event_type, status, hostinger_pointers
) VALUES (
  'tvg',
  \${quoteLiteral(pointer.mailbox)},
  \${quoteLiteral(pointer.mailbox_resource_id)},
  \${quoteLiteral(pointer.folder)},
  \${quoteLiteral(pointer.uid)}::bigint,
  \${pointer.event_type ? quoteLiteral(pointer.event_type) : 'NULL'},
  CASE WHEN \${killSwitchSql} THEN 'pending'::email_automation.intake_queue_status
       ELSE 'deferred_kill_switch'::email_automation.intake_queue_status END,
  \${quoteLiteral(JSON.stringify({
    mailbox_resource_id: pointer.mailbox_resource_id,
    folder: pointer.folder,
    uid: pointer.uid,
    source: 'fast_ack_normalized',
  }))}::jsonb
)
ON CONFLICT (tenant_id, mailbox_resource_id, folder, uid) DO NOTHING
RETURNING id, status;\`,
  },
}];
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

const fastConnections = {};
connect(fastConnections, 'Webhook', 'Prepare intake');
connect(fastConnections, 'Prepare intake', 'Insert pointer', 0);
connect(fastConnections, 'Prepare intake', 'Auth sample', 1);
connect(fastConnections, 'Insert pointer', 'Shape ack');
connect(fastConnections, 'Shape ack', 'Respond');
connect(fastConnections, 'Auth sample', 'Respond');

const fastAck = workflow(
  'TVG Email Intake — Fast ACK',
  [
    nodeBase('aa000000-0000-4000-8000-000000000001', 'Webhook', 'n8n-nodes-base.webhook', 2, 0, 0, {
      httpMethod: 'POST',
      path: 'tvg/hostinger-mail/inbound',
      responseMode: 'responseNode',
      options: {},
    }, { webhookId: 'aa000000-0000-4000-8000-000000000010' }),
    nodeBase('aa000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -220, {
      content: 'TVG Email Pass 1. Workflow MUST stay inactive. Do not point Hostinger at this path. No fetch on this path.',
      width: 520,
      height: 120,
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
    postgresNode('aa000000-0000-4000-8000-000000000006', 'Auth sample', 840, 160, "={{ $json.sample_sql || 'SELECT 1 WHERE false' }}"),
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
connect(fastMap, 'Has durable SQL', 'Auth sample', 1);
connect(fastMap, 'Insert pointer', 'Shape ack');
connect(fastMap, 'Shape ack', 'Respond');
connect(fastMap, 'Auth sample', 'Shape reject');
connect(fastMap, 'Shape reject', 'Respond');
fastAck.connections = fastMap;

const workerEval = `${logic}

const row = $input.all().map((item) => item.json).find((item) => item && item.queue_row);
if (!row) return [{ json: { sql: null, skipped: true } }];
const queue = row.queue_row;
const synthetic = queue.hostinger_pointers && queue.hostinger_pointers.synthetic_message;
if (!synthetic) {
  throw new Error('HOSTINGER_OFF: refusing to fetch live mail. Pass 1 workflows claim synthetic_message rows only.');
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
});
if (/email_responses|email_send_queue|developers\\.hostinger|api\\.mail\\.hostinger/i.test(sql)) {
  throw new Error('refusing outcome SQL that mentions send tables or Hostinger');
}
return [{ json: { sql, decision } }];
`;

const workerClaimSql = `
WITH claim AS (
  SELECT q.id
  FROM email_automation.intake_queue q
  WHERE q.tenant_id = 'tvg'
    AND q.status = 'pending'
    AND q.hostinger_pointers ? 'synthetic_message'
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
      locked_by = 'n8n-worker-synthetic',
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

const workerMap = {};
connect(workerMap, 'Manual start', 'Claim synthetic');
connect(workerMap, 'Claim synthetic', 'Evaluate');
connect(workerMap, 'Evaluate', 'Write outcome');

const worker = workflow(
  'TVG Email Intake — Worker',
  [
    nodeBase('bb000000-0000-4000-8000-000000000020', 'STAGING ONLY / HOSTINGER OFF', 'n8n-nodes-base.stickyNote', 1, 0, -220, {
      content: 'Inactive. No schedule. Claims only rows with hostinger_pointers.synthetic_message. Live Hostinger fetch is not implemented in this import.',
      width: 560,
      height: 120,
    }),
    nodeBase('bb000000-0000-4000-8000-000000000001', 'Manual start', 'n8n-nodes-base.manualTrigger', 1, 0, 0, {}),
    postgresNode('bb000000-0000-4000-8000-000000000002', 'Claim synthetic', 280, 0, workerClaimSql),
    codeNode('bb000000-0000-4000-8000-000000000003', 'Evaluate', 560, 0, workerEval),
    postgresNode('bb000000-0000-4000-8000-000000000004', 'Write outcome', 840, 0, "={{ $json.sql || 'SELECT 1 WHERE false' }}"),
  ],
  workerMap,
);

const reconcileMap = {};
connect(reconcileMap, 'Manual start', 'Resume deferred');
connect(reconcileMap, 'Schedule disabled', 'Resume deferred');
connect(reconcileMap, 'Resume deferred', 'Stale to HOLD');

const reconcile = workflow(
  'TVG Email Intake — Reconcile',
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
  'TVG Email — Daily Filtered Digest',
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
  tenant_id, kind, destination_ref, payload_summary, status
)
SELECT
  'tvg',
  'daily_filtered_digest',
  'suppressed_pre_webhook',
  jsonb_build_object('delivery', 'not_sent', 'reason', 'pre_webhook_closed'),
  'suppressed_pre_webhook'
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

const files = {
  'tvg-email-intake-fast-ack.json': fastAck,
  'tvg-email-intake-worker.json': worker,
  'tvg-email-intake-reconcile.json': reconcile,
  'tvg-email-daily-filtered-digest.json': digest,
};

for (const [name, value] of Object.entries(files)) {
  writeFileSync(join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
  process.stdout.write(`wrote ${name}\n`);
}
