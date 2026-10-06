/**
 * Local synthetic Supabase stand-in for Finance Playwright.
 * Loopback only. No hosted project, no secrets, no replica mode.
 * Auth accepts any password and returns a TVG admin JWT the client can decode.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { blankPlanInputs } from '../src/lib/finance/blankPlan.js';

const port = Number(process.env.FINANCE_MOCK_PORT || 54921);
const userId = '11111111-1111-4111-8111-111111111111';

let plans = [];
let actuals = [];

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function session(email) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
    sub: userId,
    email,
    role: 'authenticated',
    app_metadata: { tenant_id: 'tvg', role: 'admin' },
    user_metadata: {},
    exp,
  })}.sig`;
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'local-mock-refresh',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider: 'email', providers: ['email'], tenant_id: 'tvg', role: 'admin' },
      user_metadata: {},
      created_at: '2026-10-06T00:00:00.000Z',
    },
  };
}

function now() {
  return new Date().toISOString();
}

function send(res, status, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': res.reqOrigin || '*',
    'access-control-expose-headers': 'content-range',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function zeroRows(res) {
  send(res, 406, {
    code: 'PGRST116',
    details: 'The result contains 0 rows',
    hint: null,
    message: 'JSON object requested, multiple (or no) rows returned',
  });
}

function wantsObject(req) {
  return String(req.headers.accept || '').includes('application/vnd.pgrst.object+json');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function filters(url) {
  const out = {};
  for (const [key, value] of url.searchParams) {
    if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') continue;
    if (value.startsWith('eq.')) out[key] = value.slice(3);
  }
  return out;
}

function matches(row, expected) {
  return Object.entries(expected).every(([key, value]) => String(row[key]) === value);
}

function sortByUpdated(rows) {
  return [...rows].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

function seedBlankDraft() {
  if (plans.some((row) => row.status === 'draft')) return;
  plans.push({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    tenant_id: 'tvg',
    status: 'draft',
    version: 1,
    schema_version: 2,
    inputs: { ...blankPlanInputs(), monthly_basis: {} },
    notes: null,
    approved_at: null,
    approved_by: null,
    updated_at: now(),
  });
}

function historicalV1() {
  if (!plans.some((row) => row.id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1')) {
    plans.push({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      tenant_id: 'tvg',
      status: 'superseded',
      version: 1,
      schema_version: 1,
      inputs: {
        structural: {
          weeks_per_year: null,
          months_per_year: null,
          days_per_month_ar: null,
          rounding_increment_usd: null,
        },
        stages: {
          stage_0: { label: 'Stage 0' },
          stage_1: { label: 'Stage 1' },
          stage_2: { label: 'Stage 2' },
          stage_3: { label: 'Stage 3' },
        },
        staffing: [],
        owner_field_replacement: { wage: null, burden: null },
        cost_pools: {},
        channels: [],
        services: {},
      },
      notes: 'historical-v1-browser',
      approved_at: '2025-11-01T00:00:00.000Z',
      approved_by: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      updated_at: '2025-11-01T00:00:00.000Z',
    });
  }
  if (!actuals.some((row) => String(row.month).startsWith('2025-11'))) {
    actuals.push({
      id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      tenant_id: 'tvg',
      comparison_plan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      month: '2025-11-01',
      version: 1,
      schema_version: 1,
      source: 'manual_entry',
      source_note: null,
      total_revenue: 8,
      direct_residential_revenue: null,
      commercial_direct_revenue: null,
      portal_revenue: null,
      field_payroll: null,
      indirect_cash_costs: null,
      ar_ending: null,
      cash_reserve: null,
      total_jobs: null,
      dryer_vent_jobs: null,
      duct_jobs: null,
      ahu_jobs: null,
      productive_unit_hours: null,
      notes: null,
      updated_at: '2025-11-01T00:00:00.000Z',
    });
  }
}

function insertPlan(body) {
  if (plans.some((row) => row.status === 'draft')) {
    return { error: { status: 409, body: { code: '23505', message: 'finance_plans_one_draft' } } };
  }
  const row = {
    id: body.id || randomUUID(),
    tenant_id: 'tvg',
    status: 'draft',
    version: 1,
    schema_version: body.schema_version,
    inputs: body.inputs,
    notes: body.notes ?? null,
    approved_at: null,
    approved_by: null,
    updated_at: now(),
  };
  plans.push(row);
  return { row };
}

function patchPlan(url, body) {
  const expected = filters(url);
  const row = plans.find((item) => matches(item, expected));
  if (!row) return null;
  if (Object.prototype.hasOwnProperty.call(body, 'inputs')) row.inputs = body.inputs;
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) row.notes = body.notes;
  row.version += 1;
  row.updated_at = now();
  return row;
}

function approvePlan(body) {
  const row = plans.find((item) => item.id === body.p_plan_id && item.status === 'draft' && item.version === body.p_expected_version);
  if (!row) {
    return {
      error: {
        status: 409,
        body: {
          code: 'PT409',
          message: 'finance_version_conflict',
          details: 'finance_version_conflict',
          hint: 'finance_version_conflict',
        },
      },
    };
  }
  for (const plan of plans) {
    if (plan.status === 'approved') {
      plan.status = 'superseded';
      plan.version += 1;
      plan.updated_at = now();
    }
  }
  row.status = 'approved';
  row.version += 1;
  row.approved_at = now();
  row.approved_by = userId;
  row.updated_at = now();
  return { row };
}

function openDraft(body) {
  const existing = plans.find((item) => item.status === 'draft');
  if (existing) return { row: existing };
  const source = plans.find((item) => item.id === body.p_plan_id && item.status === 'approved');
  if (!source) return { error: { status: 409, body: { code: '02000', message: 'finance_no_approved_plan' } } };
  const row = {
    id: randomUUID(),
    tenant_id: 'tvg',
    status: 'draft',
    version: 1,
    schema_version: source.schema_version,
    inputs: structuredClone(source.inputs),
    notes: source.notes,
    approved_at: null,
    approved_by: null,
    updated_at: now(),
  };
  plans.push(row);
  return { row };
}

function insertActual(body) {
  const month = String(body.month || '').slice(0, 10);
  if (actuals.some((row) => String(row.month).slice(0, 10) === month)) {
    return { error: { status: 409, body: { code: '23505', message: 'finance_actuals_month_key', details: 'finance_actuals_month_key' } } };
  }
  const row = {
    id: randomUUID(),
    tenant_id: 'tvg',
    comparison_plan_id: body.comparison_plan_id || null,
    month,
    version: 1,
    schema_version: body.schema_version || 1,
    source: 'manual_entry',
    source_note: null,
    total_revenue: null,
    direct_residential_revenue: null,
    commercial_direct_revenue: null,
    portal_revenue: null,
    field_payroll: null,
    indirect_cash_costs: null,
    ar_ending: null,
    cash_reserve: null,
    total_jobs: null,
    dryer_vent_jobs: null,
    duct_jobs: null,
    ahu_jobs: null,
    productive_unit_hours: null,
    notes: null,
    updated_at: now(),
  };
  Object.assign(row, body, { id: row.id, version: 1, month, source: 'manual_entry', updated_at: row.updated_at });
  actuals.push(row);
  return { row };
}

function patchActual(url, body) {
  const expected = filters(url);
  const row = actuals.find((item) => matches(item, expected));
  if (!row) return null;
  Object.assign(row, body);
  row.version += 1;
  row.updated_at = now();
  return row;
}

const server = createServer(async (req, res) => {
  res.reqOrigin = req.headers.origin || '*';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': res.reqOrigin,
      'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
      'access-control-max-age': '600',
    });
    res.end();
    return;
  }
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  console.log(`${req.method} ${url.pathname}${url.search}`);
  try {
    if (url.pathname === '/mock/reset' && req.method === 'POST') {
      plans = [];
      actuals = [];
      send(res, 200, { ok: true });
      return;
    }
    if (url.pathname === '/mock/seed-blank-draft' && req.method === 'POST') {
      seedBlankDraft();
      send(res, 200, { ok: true, plans: plans.length });
      return;
    }
    if (url.pathname === '/auth/v1/settings' && req.method === 'GET') {
      send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
      return;
    }
    if (url.pathname === '/mock/seed-historical-v1' && req.method === 'POST') {
      historicalV1();
      send(res, 200, { ok: true, plans: plans.length, actuals: actuals.length });
      return;
    }
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      const body = await readBody(req);
      const email = body.email || 'finance-gate@example.test';
      send(res, 200, session(email));
      return;
    }
    if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
      send(res, 200, session('finance-gate@example.test').user);
      return;
    }
    if (url.pathname === '/auth/v1/logout' && req.method === 'POST') {
      send(res, 204, undefined);
      return;
    }
    if (url.pathname === '/rest/v1/rpc/check_is_superuser') {
      send(res, 200, false);
      return;
    }
    if (url.pathname === '/rest/v1/rpc/finance_approve_plan' && req.method === 'POST') {
      const result = approvePlan(await readBody(req));
      if (result.error) send(res, result.error.status, result.error.body);
      else send(res, 200, result.row);
      return;
    }
    if (url.pathname === '/rest/v1/rpc/finance_open_draft' && req.method === 'POST') {
      const result = openDraft(await readBody(req));
      if (result.error) send(res, result.error.status, result.error.body);
      else send(res, 200, result.row);
      return;
    }
    if (url.pathname === '/rest/v1/rpc/finance_upgrade_draft_schema' && req.method === 'POST') {
      send(res, 409, { code: 'PT409', message: 'finance_version_conflict', details: 'finance_version_conflict', hint: 'finance_version_conflict' });
      return;
    }
    if (url.pathname === '/rest/v1/finance_plans') {
      if (req.method === 'GET') {
        const rows = sortByUpdated(plans.filter((row) => matches(row, filters(url))));
        if (wantsObject(req)) {
          if (rows.length !== 1) zeroRows(res);
          else send(res, 200, rows[0]);
        } else send(res, 200, rows);
        return;
      }
      if (req.method === 'POST') {
        const result = insertPlan(await readBody(req));
        if (result.error) send(res, result.error.status, result.error.body);
        else send(res, 201, wantsObject(req) ? result.row : [result.row]);
        return;
      }
      if (req.method === 'PATCH') {
        const row = patchPlan(url, await readBody(req));
        if (!row) zeroRows(res);
        else send(res, 200, wantsObject(req) ? row : [row]);
        return;
      }
    }
    if (url.pathname === '/rest/v1/finance_monthly_actuals') {
      if (req.method === 'GET') {
        const rows = [...actuals.filter((row) => matches(row, filters(url)))].sort((a, b) => String(b.month).localeCompare(String(a.month)));
        if (wantsObject(req)) {
          if (rows.length !== 1) zeroRows(res);
          else send(res, 200, rows[0]);
        } else send(res, 200, rows);
        return;
      }
      if (req.method === 'POST') {
        const result = insertActual(await readBody(req));
        if (result.error) send(res, result.error.status, result.error.body);
        else send(res, 201, wantsObject(req) ? result.row : [result.row]);
        return;
      }
      if (req.method === 'PATCH') {
        const row = patchActual(url, await readBody(req));
        if (!row) zeroRows(res);
        else send(res, 200, wantsObject(req) ? row : [row]);
        return;
      }
    }
    send(res, 404, { message: 'finance mock has no route', path: url.pathname });
  } catch (error) {
    console.error(error);
    send(res, 500, { message: 'finance mock error' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`finance playwright mock listening on http://127.0.0.1:${port}`);
});
