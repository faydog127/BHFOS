/**
 * Fetch text and Fetch source used to read $json from the previous HTTP node.
 * That item is the fullResponse body and has no text_url, source_url, or timeout.
 * The committed worker JSON is what n8n runs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const worker = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-worker.json'), 'utf8'));

const PLAN = {
  guard_ok: true,
  metadata_url: 'https://mock.staging.invalid/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001',
  text_url: 'https://mock.staging.invalid/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001/text',
  source_url: 'https://mock.staging.invalid/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001/source',
  timeout_ms: 8000,
};

function httpItem(label) {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: { label } }),
  };
}

function evalExpr(expr, { json, nodes }) {
  assert.equal(expr.startsWith('={{ '), true, expr);
  assert.equal(expr.endsWith(' }}'), true, expr);
  const inner = expr.slice(4, -3);
  const nodeRef = inner.match(/^\$\('([^']+)'\)\.first\(\)\.json\.([A-Za-z0-9_]+)$/);
  if (nodeRef) {
    const item = nodes[nodeRef[1]];
    return item ? item[nodeRef[2]] : undefined;
  }
  const current = inner.match(/^\$json\.([A-Za-z0-9_]+)$/);
  if (current) return json ? json[current[1]] : undefined;
  throw new Error(`unsupported expression ${expr}`);
}

function nodeByName(name) {
  return worker.nodes.find((node) => node.name === name);
}

test('Fetch text and Fetch source read the guarded plan, not the previous HTTP item', () => {
  assert.equal(worker.connections['Guard passed'].main[0][0].node, 'Fetch metadata');
  assert.equal(worker.connections['Fetch metadata'].main[0][0].node, 'Fetch text');
  assert.equal(worker.connections['Fetch text'].main[0][0].node, 'Fetch source');
  assert.equal(worker.connections['Re-guard GET'].main[0][0].node, 'Guard passed');

  const metadata = nodeByName('Fetch metadata');
  const text = nodeByName('Fetch text');
  const source = nodeByName('Fetch source');
  const nodes = { 'Re-guard GET': PLAN };
  const metadataHttp = httpItem('metadata');
  const textHttp = httpItem('text');

  assert.equal(evalExpr('={{ $json.text_url }}', { json: metadataHttp, nodes }), undefined);
  assert.equal(evalExpr('={{ $json.source_url }}', { json: textHttp, nodes }), undefined);
  assert.equal(evalExpr('={{ $json.timeout_ms }}', { json: metadataHttp, nodes }), undefined);

  assert.equal(metadata.parameters.method, 'GET');
  assert.equal(metadata.parameters.options.redirect.redirect.followRedirects, false);
  assert.equal(
    evalExpr(metadata.parameters.url, { json: PLAN, nodes }),
    PLAN.metadata_url,
  );
  assert.equal(
    evalExpr(metadata.parameters.options.timeout, { json: PLAN, nodes }),
    PLAN.timeout_ms,
  );

  assert.equal(text.parameters.method, 'GET');
  assert.equal(text.parameters.options.redirect.redirect.followRedirects, false);
  assert.equal(text.credentials.httpHeaderAuth.name, 'TVG Staging Hostinger Mail API');
  assert.equal(
    evalExpr(text.parameters.url, { json: metadataHttp, nodes }),
    PLAN.text_url,
  );
  assert.equal(
    evalExpr(text.parameters.options.timeout, { json: metadataHttp, nodes }),
    PLAN.timeout_ms,
  );

  assert.equal(source.parameters.method, 'GET');
  assert.equal(source.parameters.options.redirect.redirect.followRedirects, false);
  assert.equal(
    evalExpr(source.parameters.url, { json: textHttp, nodes }),
    PLAN.source_url,
  );
  assert.equal(
    evalExpr(source.parameters.options.timeout, { json: textHttp, nodes }),
    PLAN.timeout_ms,
  );

  const list = nodeByName('List page');
  assert.equal(list.parameters.url, '={{ $json.list_url }}');
  assert.equal(list.parameters.method, 'GET');
});
