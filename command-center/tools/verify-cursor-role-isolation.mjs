#!/usr/bin/env node
/**
 * Cursor role-isolation proofs (G2.3B-B2C).
 * Static + structural — does not require live secrets.
 * Fails if Diagnostics credentials could leak into other role MCP templates.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const envRoot = path.join(root, 'docs/governance/cursor-environments');

const ROLES = [
  'production-diagnostics',
  'production-operator',
  'release-agent',
  'independent-uat',
];

const DIAG_SECRET_MARKERS = [
  'GITHUB_PERSONAL_ACCESS_TOKEN',
  'I2_GITHUB_MCP',
  'I2_GITHUB_APP_',
  'github-i2-diagnostics',
  'SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN',
];

const TOKEN_LITERAL = /(ghp_|github_pat_|sbp_|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.)/;

function readTemplate(role) {
  const p = path.join(envRoot, role, 'mcp.json.template');
  if (!fs.existsSync(p)) throw new Error(`Missing MCP template: ${p}`);
  return { path: p, text: fs.readFileSync(p, 'utf8'), json: JSON.parse(fs.readFileSync(p, 'utf8')) };
}

function main() {
  const results = [];

  for (const role of ROLES) {
    const t = readTemplate(role);
    results.push({ test: `template_exists_${role}`, pass: true });

    if (TOKEN_LITERAL.test(t.text)) {
      results.push({ test: `no_token_literal_${role}`, pass: false });
    } else {
      results.push({ test: `no_token_literal_${role}`, pass: true });
    }

    if (role === 'production-diagnostics') {
      const hasGithub = Boolean(t.json.mcpServers?.['github-i2-diagnostics']);
      const env = t.json.mcpServers?.['github-i2-diagnostics']?.env || {};
      const args = t.json.mcpServers?.['github-i2-diagnostics']?.args || [];
      const usesLauncher = args.some((a) => String(a).includes('github-diagnostics-launcher'));
      const readOnly =
        env.GITHUB_READ_ONLY === '1' ||
        String(t.text).includes('GITHUB_READ_ONLY');
      const toolsets = String(env.GITHUB_TOOLSETS || '');
      const restricted =
        toolsets.includes('repos') &&
        toolsets.includes('pull_requests') &&
        toolsets.includes('actions') &&
        !toolsets.includes('all');
      results.push({ test: 'diagnostics_has_github_mcp', pass: hasGithub });
      results.push({ test: 'diagnostics_uses_app_launcher', pass: usesLauncher });
      results.push({ test: 'diagnostics_read_only', pass: readOnly });
      results.push({ test: 'diagnostics_restricted_toolsets', pass: restricted });
      results.push({
        test: 'diagnostics_uses_env_placeholders',
        pass:
          String(env.GITHUB_APP_ID || '').includes('${env:') &&
          String(env.GITHUB_APP_INSTALLATION_ID || '').includes('${env:'),
      });
      results.push({
        test: 'diagnostics_no_inline_pat_env',
        pass: !Object.prototype.hasOwnProperty.call(env, 'GITHUB_PERSONAL_ACCESS_TOKEN'),
      });
    } else {
      for (const marker of DIAG_SECRET_MARKERS) {
        const leaked = t.text.includes(marker);
        results.push({
          test: `role_${role}_no_${marker}`,
          pass: !leaked,
        });
      }
      const servers = Object.keys(t.json.mcpServers || {});
      results.push({
        test: `role_${role}_no_diagnostics_server`,
        pass: !servers.includes('github-i2-diagnostics'),
      });
    }
  }

  // Isolation doc present
  const iso = path.join(root, 'docs/governance/CURSOR_ROLE_ISOLATION.md');
  results.push({ test: 'isolation_doc_present', pass: fs.existsSync(iso) });

  // Hostinger not in Diagnostics mcp
  const diag = readTemplate('production-diagnostics');
  results.push({
    test: 'diagnostics_no_hostinger',
    pass: !/HOSTINGER/i.test(diag.text),
  });

  const failed = results.filter((r) => !r.pass);
  const out = { ok: failed.length === 0, results, failed };
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main();
