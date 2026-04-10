#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { assertEstimateInvariants } from './_estimate_lib.mjs';

const repoRoot = process.cwd();
const fixturesDir = path.resolve(repoRoot, 'tmp/orchestrator-v2/estimate/fixtures');

const fail = (msg) => {
  console.error(`ESTIMATE FIXTURES: FAILED\n\n${msg}\n`);
  process.exit(1);
};

const ok = () => {
  console.log('ESTIMATE FIXTURES: PASSED');
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const cases = [
  {
    id: 'good_sample',
    expect: 'PASS',
    path: 'tmp/orchestrator-v2/estimate/estimate_judgment.sample.json',
  },
  {
    id: 'bad_multiple_recommended',
    expect: 'FAIL',
    path: 'tmp/orchestrator-v2/estimate/fixtures/estimate_judgment.bad.multiple_recommended.json',
    contains: 'exactly one recommended option',
  },
  {
    id: 'bad_recommended_key_mismatch',
    expect: 'FAIL',
    path: 'tmp/orchestrator-v2/estimate/fixtures/estimate_judgment.bad.recommended_key_mismatch.json',
    contains: 'recommended option mismatch',
  },
  {
    id: 'bad_selected_missing_pricing',
    expect: 'FAIL',
    path: 'tmp/orchestrator-v2/estimate/fixtures/estimate_judgment.bad.selected_missing_pricing.json',
    contains: 'selected option must include pricing',
  },
  {
    id: 'bad_unknown_boundary_policy',
    expect: 'FAIL',
    path: 'tmp/orchestrator-v2/estimate/fixtures/estimate_judgment.bad.unknown_boundary_policy.json',
    contains: 'unsupported boundary_inheritance_policy',
  },
  {
    id: 'bad_missing_evidence_uri',
    expect: 'FAIL',
    path: 'tmp/orchestrator-v2/estimate/fixtures/estimate_judgment.bad.missing_evidence_uri.json',
    contains: 'evidence_refs[] must include',
  },
];

const failures = [];

for (const c of cases) {
  const abs = path.resolve(repoRoot, c.path);
  if (!fs.existsSync(abs)) {
    failures.push(`${c.id}: missing fixture file: ${c.path}`);
    continue;
  }
  try {
    const json = readJson(abs);
    assertEstimateInvariants(json);
    if (c.expect !== 'PASS') failures.push(`${c.id}: expected FAIL, got PASS`);
  } catch (e) {
    const msg = e?.message || String(e);
    if (c.expect !== 'FAIL') failures.push(`${c.id}: expected PASS, got FAIL: ${msg}`);
    if (c.expect === 'FAIL' && c.contains && !msg.includes(c.contains)) {
      failures.push(`${c.id}: failure message mismatch; expected to contain "${c.contains}", got "${msg}"`);
    }
  }
}

if (failures.length) fail(failures.join('\n'));
ok();

