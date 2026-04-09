#!/usr/bin/env node
import fs from 'node:fs';

const norm = (p) => String(p || '').replaceAll('\\', '/');
const fail = (msg) => {
  console.error(`TENANT SCOPE: FAILED\n\n${msg}\n`);
  process.exit(1);
};

const inputPath = process.argv[2];
if (!inputPath) {
  fail('Usage: node tmp/orchestrator-v2/eval/validate_tenant_scope.mjs <layer2_observed_judgment.json>');
}

if (!fs.existsSync(inputPath)) fail(`Missing JSON: ${inputPath}`);
const src = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const tenantId = String(src?.tenant_id || '').trim();
if (!tenantId || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(tenantId)) {
  fail('Invalid or missing tenant_id in layer2_observed_judgment.json');
}

const pathTenant = norm(inputPath).match(/(?:^|\/)artifacts\/tenants\/([^/]+)\/runs\//)?.[1] || null;
if (pathTenant && pathTenant !== tenantId) {
  fail(`tenant_id mismatch vs path: json=${tenantId} path=${pathTenant}`);
}

const observedRoot = String(src?.observed_bundle_root || '').trim();
if (observedRoot) {
  const observedTenant = norm(observedRoot).match(/(?:^|\/)artifacts\/tenants\/([^/]+)\/runs\//)?.[1] || null;
  if (observedTenant && observedTenant !== tenantId) {
    fail(`tenant_id mismatch vs observed_bundle_root: json=${tenantId} observed_bundle_root=${observedTenant}`);
  }
}

console.log('TENANT SCOPE: PASSED');

