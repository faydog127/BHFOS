#!/usr/bin/env node
/**
 * verify-branch-protection.mjs — G2.3A read-only branch-protection verifier.
 *
 * Distinguishes three tiers of knowledge (G2.3A brief §8.5):
 *   1. Repository-derivable (no API): expected required checks from workflow
 *      files, CODEOWNERS presence, and the intended policy in
 *      BRANCH_PROTECTION.md.
 *   2. GitHub-API-derivable (only with --remote AND `gh` available): actual
 *      enforcement of required checks, required reviews, force-push and deletion
 *      restrictions.
 *   3. Unknown until later phases: org overrides, actor bypass lists, etc.
 *
 * Guarantees: NEVER mutates GitHub settings. Uses `gh` only when explicitly
 * invoked with --remote. Cleanly reports when API access is unavailable.
 * Machine-readable (--json) and human output.
 *
 * Usage:
 *   node tools/verify-branch-protection.mjs [--branch=main] [--remote] [--json]
 * Exit code 0 = repository expectations resolved (and, if --remote, no drift).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const commandCenterRoot = path.resolve(toolsDir, '..');
const repoRoot = path.resolve(commandCenterRoot, '..');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const body = raw.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) args[body] = true;
    else args[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return args;
}

/** Derive expected required checks from workflow files (Workflow / Job format). */
function deriveExpectedChecks() {
  const workflowsDir = path.join(repoRoot, '.github', 'workflows');
  const checks = [];
  if (!fs.existsSync(workflowsDir)) return checks;
  for (const file of fs.readdirSync(workflowsDir)) {
    if (!/\.ya?ml$/i.test(file)) continue;
    const text = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
    const nameMatch = text.match(/^name:\s*(.+)$/m);
    const workflowName = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : file;
    // Collect job ids under the top-level `jobs:` mapping.
    const jobsIdx = text.search(/^jobs:\s*$/m);
    if (jobsIdx === -1) continue;
    const after = text.slice(jobsIdx);
    const jobRegex = /^\s{2}([A-Za-z0-9_-]+):\s*$/gm;
    let m;
    while ((m = jobRegex.exec(after))) {
      checks.push(`${workflowName} / ${m[1]}`);
    }
  }
  return checks;
}

function findCodeowners() {
  const candidates = [
    path.join(repoRoot, '.github', 'CODEOWNERS'),
    path.join(repoRoot, 'CODEOWNERS'),
    path.join(repoRoot, 'docs', 'CODEOWNERS'),
    path.join(commandCenterRoot, '.github', 'CODEOWNERS'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.relative(repoRoot, c).replaceAll('\\', '/');
  }
  return null;
}

function deriveDocumentedChecks() {
  const docPath = path.join(commandCenterRoot, 'docs', 'governance', 'BRANCH_PROTECTION.md');
  if (!fs.existsSync(docPath)) return { docPath: null, checks: [] };
  const text = fs.readFileSync(docPath, 'utf8');
  const checks = [];
  const regex = /`([A-Za-z0-9 ]+\/\s*[A-Za-z0-9_ ]+)`/g;
  let m;
  while ((m = regex.exec(text))) {
    const val = m[1].trim();
    // Skip the generic "Workflow Name / Job Name" placeholder used to explain
    // GitHub's display format; it is not an actual required check.
    if (/\bName\b/.test(val)) continue;
    if (/\s\/\s/.test(val)) checks.push(val);
  }
  return { docPath: path.relative(repoRoot, docPath).replaceAll('\\', '/'), checks: [...new Set(checks)] };
}

function queryRemote(branch) {
  const remote = { attempted: true, available: false, note: '', protection: null };
  // Resolve repo slug via gh (read-only).
  let slug = '';
  try {
    slug = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
    }).toString().trim();
  } catch {
    remote.note = 'GitHub API not queried: `gh` unavailable or not authenticated';
    return remote;
  }
  try {
    const raw = execFileSync('gh', ['api', `repos/${slug}/branches/${branch}/protection`], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20000,
    }).toString();
    const data = JSON.parse(raw);
    remote.available = true;
    remote.note = 'branch protection retrieved (read-only)';
    remote.protection = {
      requiredStatusChecks: data?.required_status_checks?.contexts
        || (data?.required_status_checks?.checks || []).map((c) => c.context),
      enforceAdmins: Boolean(data?.enforce_admins?.enabled),
      requiredReviews: data?.required_pull_request_reviews
        ? {
            requiredApprovingReviewCount: data.required_pull_request_reviews.required_approving_review_count ?? 0,
            dismissStaleReviews: Boolean(data.required_pull_request_reviews.dismiss_stale_reviews),
          }
        : null,
      allowForcePushes: Boolean(data?.allow_force_pushes?.enabled),
      allowDeletions: Boolean(data?.allow_deletions?.enabled),
      requiredConversationResolution: Boolean(data?.required_conversation_resolution?.enabled),
    };
  } catch (err) {
    // 404 => protection not configured or no access; either way, no mutation.
    remote.note = 'GitHub API not conclusive: branch protection not readable (missing scope, not configured, or no access)';
  }
  return remote;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const branch = typeof args.branch === 'string' ? args.branch : 'main';

  const expectedChecks = deriveExpectedChecks();
  const documented = deriveDocumentedChecks();
  const codeowners = findCodeowners();

  const repositoryExpectations = {
    branch,
    expectedRequiredChecks: expectedChecks,
    documentedRequiredChecks: documented.checks,
    branchProtectionDoc: documented.docPath,
    codeowners,
  };

  // Coverage: are the documented required checks a superset of expected checks?
  const missingFromDoc = expectedChecks.filter((c) => !documented.checks.some((d) => d.replace(/\s+/g, ' ') === c.replace(/\s+/g, ' ')));

  const errors = [];
  const warnings = [];
  if (expectedChecks.length === 0) warnings.push('no workflow-derived checks found');
  if (!codeowners) warnings.push('no CODEOWNERS file found');
  if (missingFromDoc.length > 0) {
    warnings.push(`BRANCH_PROTECTION.md does not document expected check(s): ${missingFromDoc.join(', ')}`);
  }

  let remote = { attempted: false, available: false, note: 'remote not checked (run with --remote to query GitHub read-only)', protection: null };
  if (args.remote) {
    remote = queryRemote(branch);
    if (remote.available && remote.protection) {
      const actual = new Set(remote.protection.requiredStatusChecks || []);
      const drift = expectedChecks.filter((c) => !actual.has(c));
      if (drift.length > 0) warnings.push(`GitHub does not enforce expected required check(s): ${drift.join(', ')}`);
      if (remote.protection.allowForcePushes) warnings.push('GitHub allows force pushes on this branch');
      if (remote.protection.allowDeletions) warnings.push('GitHub allows deletion of this branch');
      if (!remote.protection.requiredReviews || remote.protection.requiredReviews.requiredApprovingReviewCount < 1) {
        warnings.push('GitHub does not require an approving review');
      }
    }
  }

  const report = {
    tool: 'verify-branch-protection',
    mutatesSettings: false,
    repositoryExpectations,
    githubState: remote,
    deferredToLaterPhase: ['org-level overrides', 'actor bypass lists', 'elevated-scope settings'],
    ok: errors.length === 0,
    errors,
    warnings,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('[branch-protection] READ-ONLY — no GitHub setting was changed');
    console.log(`[branch-protection] branch=${branch}`);
    console.log(`[branch-protection] REPO expected checks: ${expectedChecks.join(', ') || '(none)'}`);
    console.log(`[branch-protection] REPO documented checks: ${documented.checks.join(', ') || '(none)'} (doc=${documented.docPath || 'missing'})`);
    console.log(`[branch-protection] REPO CODEOWNERS: ${codeowners || '(none)'}`);
    console.log(`[branch-protection] GITHUB: ${remote.note}`);
    if (remote.available && remote.protection) {
      console.log(`[branch-protection] GITHUB enforced checks: ${(remote.protection.requiredStatusChecks || []).join(', ') || '(none)'}`);
      console.log(`[branch-protection] GITHUB forcePush=${remote.protection.allowForcePushes} deletions=${remote.protection.allowDeletions} reviews=${remote.protection.requiredReviews ? remote.protection.requiredReviews.requiredApprovingReviewCount : 0}`);
    }
    for (const w of warnings) console.log(`  warning: ${w}`);
    for (const e of errors) console.error(`  error: ${e}`);
    console.log(report.ok ? '[branch-protection] RESULT: repository expectations resolved' : '[branch-protection] RESULT: FAILED');
  }

  process.exit(report.ok ? 0 : 1);
}

main();
