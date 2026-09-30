/**
 * Dispatch mock must send the INBOX list route to the list renderer.
 * The committed workflow JSON is what n8n runs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mock = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-hostinger-mock.json'), 'utf8'));
const dispatchCode = mock.nodes.find((node) => node.name === 'Dispatch mock').parameters.jsCode;
const renderCode = mock.nodes.find((node) => node.name === 'Render mock').parameters.jsCode;

function run(item, executed = {}) {
  const $ = (name) => ({ isExecuted: Boolean(executed[name]) });
  const dispatched = vm.runInNewContext(`(function () {\n${dispatchCode}\n})()`, {
    $input: { first() { return { json: item }; } },
    $,
  }, { timeout: 2000 });
  assert.equal(dispatched[0].json.mock_kind === 'rejected', false);
  const rendered = vm.runInNewContext(`(function () {\n${renderCode}\n})()`, {
    $input: { first() { return { json: dispatched[0].json }; } },
    $,
  }, { timeout: 2000 });
  return { dispatched: dispatched[0].json, rendered: rendered[0].json };
}

function listItem(mailbox, { page = '1', perPage = '100', executed = false, webhookUrl } = {}) {
  const path = `/webhook/tvg/staging-mock/mail/api/v1/mailboxes/${mailbox}/folders/INBOX/messages`;
  const url = webhookUrl || `https://bhfos.app.n8n.cloud${path}?page=${page}&perPage=${perPage}`;
  return {
    item: {
      headers: {},
      params: { mailboxResourceId: mailbox },
      query: { page, perPage },
      webhookUrl: url,
    },
    executed: executed ? { 'Mock list': true } : {},
  };
}

function assertListEnvelope(rendered, { status, page }) {
  assert.equal(rendered.http_status, status);
  assert.equal(rendered.timeout, false);
  if (status === 200) {
    assert.equal(Array.isArray(rendered.response_body.data), true);
    assert.equal(rendered.response_body.pagination.page, Number(page));
    assert.equal(rendered.response_body.pagination.perPage, 100);
    assert.equal(typeof rendered.response_body.pagination.totalPages, 'number');
  } else {
    assert.equal(rendered.response_body.error, 'rate_limited');
  }
}

test('Dispatch mock sends list routes through Render mock', () => {
  const cases = [
    ['mbx_list_hit1', '1', 200],
    ['mbx_list_hit3', '1', 200],
    ['mbx_list_miss', '1', 200],
    ['mbx_list_ambiguous', '1', 200],
    ['mbx_list_429', '1', 429],
  ];
  for (const [mailbox, page, status] of cases) {
    const spec = listItem(mailbox, { page });
    const { dispatched, rendered } = run(spec.item, spec.executed);
    assert.equal(dispatched.mock_kind, 'list', mailbox);
    assertListEnvelope(rendered, { status, page });
  }

  const pageThree = listItem('mbx_list_hit3', { page: '3', perPage: '100' });
  const hit3 = run(pageThree.item);
  assert.equal(hit3.dispatched.mock_kind, 'list');
  assert.equal(hit3.rendered.response_body.data[0].uid, 3303);
  assertListEnvelope(hit3.rendered, { status: 200, page: '3' });

  const fallback = listItem('mbx_list_hit1', {
    executed: true,
    webhookUrl: '',
  });
  const fromParent = run(fallback.item, fallback.executed);
  assert.equal(fromParent.dispatched.mock_kind, 'list');
  assertListEnvelope(fromParent.rendered, { status: 200, page: '1' });

  const metadata = run({
    headers: {},
    params: { uid: '910001', mailboxResourceId: 'mbx_unused' },
    query: {},
    webhookUrl: 'https://bhfos.app.n8n.cloud/webhook/tvg/staging-mock/mail/api/v1/mailboxes/mbx/folders/INBOX/messages/910001',
  });
  assert.equal(metadata.dispatched.mock_kind, 'metadata');
  assert.equal(metadata.rendered.http_status, 200);
  assert.equal(metadata.rendered.response_body.data.messageId, '<mock-910001@example.com>');

  const text = run({
    headers: {},
    params: { uid: '910001' },
    query: {},
    webhookUrl: 'https://bhfos.app.n8n.cloud/webhook/tvg/staging-mock/mail/api/v1/mailboxes/mbx/folders/INBOX/messages/910001/text',
  });
  assert.equal(text.dispatched.mock_kind, 'text');
  assert.equal(text.rendered.http_status, 200);

  const source = run({
    headers: {},
    params: { uid: '910001' },
    query: {},
    webhookUrl: 'https://bhfos.app.n8n.cloud/webhook/tvg/staging-mock/mail/api/v1/mailboxes/mbx/folders/INBOX/messages/910001/source',
  }, { 'Mock list': true });
  assert.equal(source.dispatched.mock_kind, 'source');
  assert.equal(source.rendered.http_status, 200);

  const sourceFallback = run({
    headers: {},
    params: { uid: '910404' },
    query: {},
    webhookUrl: '',
  }, { 'Mock source': true, 'Mock list': true });
  assert.equal(sourceFallback.dispatched.mock_kind, 'source');
  assert.equal(sourceFallback.rendered.http_status, 404);
  assert.equal(sourceFallback.rendered.response_body.uid, '910404');
});
