import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const signature =
  'public.record_stripe_webhook_payment_validated(text,text,text,bigint,text,jsonb,uuid)';
const wrapperSignature =
  'public.record_stripe_webhook_payment(text,text,text,bigint,text,jsonb,uuid)';
const legacySignature =
  'public.record_stripe_webhook_payment_legacy_unvalidated(text,text,text,bigint,text,jsonb,uuid)';

const status = JSON.parse(
  execFileSync('supabase', ['status', '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);

const rpcPayload = {
  p_gateway_event_id: '',
  p_event_type: 'payment_intent.succeeded',
  p_provider_payment_id: 'pi_acl_probe',
  p_amount_cents: 100,
  p_currency: 'usd',
  p_payload: {},
  p_invoice_id: null,
};

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const createAuthenticatedToken = () => {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: now + 300,
    iat: now,
    iss: 'supabase-demo',
    role: 'authenticated',
    sub: crypto.randomUUID(),
  })}`;
  const signatureValue = crypto
    .createHmac('sha256', status.JWT_SECRET)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signatureValue}`;
};

const callRpc = async (name, token) => {
  const response = await fetch(`${status.API_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: token,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(rpcPayload),
  });
  return { status: response.status, body: await response.text() };
};

const assertPermissionDenied = ({ status: responseStatus, body }, role) => {
  assert.ok(
    [401, 403, 404].includes(responseStatus),
    `${role} unexpectedly reached the validated settlement function: ${responseStatus} ${body}`,
  );
  assert.match(body, /permission|not find|schema cache|not allowed/i);
};

test('validated webhook settlement privileges are fail-closed', async () => {
  const sql = `
    with target as (
      select p.*
        from pg_proc p
       where p.oid = to_regprocedure('${signature}')
    )
    select json_build_object(
      'public_execute', exists (
        select 1
          from target t,
               lateral aclexplode(coalesce(t.proacl, acldefault('f', t.proowner))) a
         where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      ),
      'anon_execute', has_function_privilege('anon', '${signature}', 'EXECUTE'),
      'authenticated_execute', has_function_privilege('authenticated', '${signature}', 'EXECUTE'),
      'service_execute', has_function_privilege('service_role', '${signature}', 'EXECUTE'),
      'wrapper_service_execute', has_function_privilege('service_role', '${wrapperSignature}', 'EXECUTE'),
      'legacy_service_execute', has_function_privilege('service_role', '${legacySignature}', 'EXECUTE'),
      'security_definer', (select prosecdef from target),
      'controlled_search_path', (
        select 'search_path=public' = any(coalesce(proconfig, array[]::text[]))
          from target
      )
    );
  `;
  const acl = JSON.parse(
    execFileSync(
      'psql',
      [status.DB_URL, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql],
      { encoding: 'utf8' },
    ).trim(),
  );

  assert.equal(acl.public_execute, false);
  assert.equal(acl.anon_execute, false);
  assert.equal(acl.authenticated_execute, false);
  assert.equal(acl.service_execute, true);
  assert.equal(acl.wrapper_service_execute, true);
  assert.equal(acl.legacy_service_execute, false);
  assert.equal(acl.security_definer, true);
  assert.equal(acl.controlled_search_path, true);

  assertPermissionDenied(
    await callRpc('record_stripe_webhook_payment_validated', status.ANON_KEY),
    'anon',
  );
  assertPermissionDenied(
    await callRpc('record_stripe_webhook_payment_validated', createAuthenticatedToken()),
    'authenticated',
  );

  const directService = await callRpc(
    'record_stripe_webhook_payment_validated',
    status.SERVICE_ROLE_KEY,
  );
  assert.equal(directService.status, 400);
  assert.match(directService.body, /GATEWAY_EVENT_ID_REQUIRED/);

  const wrapperService = await callRpc(
    'record_stripe_webhook_payment',
    status.SERVICE_ROLE_KEY,
  );
  assert.equal(wrapperService.status, 400);
  assert.match(wrapperService.body, /GATEWAY_EVENT_ID_REQUIRED/);

  assertPermissionDenied(
    await callRpc('record_stripe_webhook_payment_legacy_unvalidated', status.SERVICE_ROLE_KEY),
    'service_role legacy implementation',
  );
});
