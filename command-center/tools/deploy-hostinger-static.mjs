#!/usr/bin/env node
/**
 * deploy-hostinger-static.mjs — G2.3A Hostinger static deploy CLI.
 *
 * SAFETY MODEL (binding, G2.3A brief §4.2)
 * ----------------------------------------
 *   - DEFAULT BEHAVIOUR IS NON-MUTATING. Running with no arguments prints help
 *     and performs no network operation.
 *   - `--dry-run` validates the deployment plan and performs ZERO network
 *     operations of any kind (no reads, no writes, no uploads).
 *   - A mutating upload requires ALL of:
 *         --execute                       (explicit production action flag)
 *         --environment=<target>          (explicit target environment)
 *         --authorization=<reference>     (explicit authorization reference)
 *         --sha=<40-hex>                  (explicit intended SHA; never fabricated)
 *         --i-understand-production       (explicit acknowledgement)
 *     Missing or conflicting identity stops the run before any network call.
 *   - Target identity and the intended SHA + release identity are printed
 *     BEFORE any mutation is attempted.
 *   - Credentials are never printed (only masked presence is shown).
 *   - In G2.3A the underlying mutating upload is intentionally NOT enabled
 *     (see deploy-lib.executeDeploy); this CLI is committed, not executed.
 *
 * Usage:
 *   node tools/deploy-hostinger-static.mjs --help
 *   node tools/deploy-hostinger-static.mjs --dry-run [--environment=production] [--app=crm] [--sha=<hex>]
 *   node tools/deploy-hostinger-static.mjs --execute --environment=production \
 *        --authorization=<ref> --sha=<hex> --i-understand-production   (BLOCKED in G2.3A)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  parseCliArgs,
  loadCredentials,
  planDeployment,
  createMutationGate,
  resolveHostingerUsername,
  executeDeploy,
  APPS,
  TARGETS,
} from './deploy-lib.mjs';

// Read the intended SHA from an already-built build-info.json for the app.
// Used only to populate a dry-run plan. Purely local read, no network.
function shaFromBuildInfo(app) {
  const cfg = APPS[app];
  if (!cfg) return undefined;
  const infoPath = path.join(cfg.sourceDir, 'build-info.json');
  try {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    if (typeof info.commitSha === 'string' && info.commitSha.trim()) return info.commitSha.trim();
  } catch {
    /* no build-info yet */
  }
  return undefined;
}

function printHelp() {
  const known = Object.keys(TARGETS).join(', ');
  console.log(
    [
      'bhfos deploy-hostinger-static - static deploy CLI (default: non-mutating)',
      '',
      'Commands:',
      '  --help                 Show this help and exit (no network).',
      '  --dry-run              Validate the deploy plan; ZERO network operations.',
      '  --execute              Attempt a mutating deploy (requires the full flag set).',
      '',
      'Dry-run / plan options:',
      '  --app=<crm|tis>        App to deploy (default: crm).',
      `  --environment=<env>    Target environment (known: ${known}).`,
      '  --sha=<40-hex>         Intended commit SHA (never fabricated).',
      '  --release=<id>         Release identifier (optional; else from build-info).',
      '  --json                 Machine-readable output.',
      '',
      'Mutation (all required together):',
      '  --execute --environment=<env> --authorization=<ref> --sha=<hex>',
      '  --archive=<path>',
      '  and ONE of:',
      '    --i-understand-production     (required when environment=production)',
      '    --i-understand-mil-staging    (required when environment=mil-staging)',
      '',
      'Safety: ordinary validation (lint/build/test) never invokes this CLI, and a',
      'dry run performs no network mutation. Remote deletion and server-side rollback',
      'are intentionally not implemented. mil-staging refuses remoteRoot=public_html.',
    ].join('\n')
  );
}

function resolveIntendedSha(args) {
  if (typeof args.sha === 'string' && args.sha.trim()) return args.sha.trim();
  return null;
}

function emit(json, humanFn, payload) {
  if (json) console.log(JSON.stringify(payload, null, 2));
  else humanFn();
}

async function main() {
  const args = parseCliArgs();
  const json = Boolean(args.json);

  if (args.help || (!args['dry-run'] && !args.execute)) {
    printHelp();
    process.exit(0);
    return;
  }

  const app = typeof args.app === 'string' ? args.app : 'crm';
  const environment = typeof args.environment === 'string' ? args.environment : undefined;
  const authorization = typeof args.authorization === 'string' ? args.authorization : undefined;
  const releaseId = typeof args.release === 'string' ? args.release : undefined;
  const intendedSha = resolveIntendedSha(args);

  // ---- DRY RUN: zero network operations ----------------------------------
  if (args['dry-run']) {
    // For a dry run we validate against a known target if given, else default
    // to the production target purely for plan display (still no network).
    const planEnv = environment || 'production';
    const sourceDir = APPS[app] ? APPS[app].sourceDir : undefined;
    const { ok, problems, plan } = planDeployment({
      app,
      environment: planEnv,
      authorization: authorization || '(dry-run: none required)',
      intendedSha: intendedSha || shaFromBuildInfo(app),
      releaseId,
      sourceDir,
    });

    // Credentials are only inspected for presence; never used, never printed.
    const creds = loadCredentials();

    const payload = {
      tool: 'deploy-hostinger-static',
      mode: 'dry-run',
      networkMutations: 0,
      networkReads: 0,
      credentialPresence: creds.masked,
      target: plan.target,
      app: plan.app,
      intendedSha: plan.intendedSha,
      buildInfoSha: plan.buildInfoSha,
      releaseId: plan.releaseId,
      manifest: plan.manifest,
      secretScan: plan.secretScan,
      planOk: ok,
      problems,
    };

    emit(json, () => {
      console.log('[deploy][dry-run] DRY RUN — zero network operations performed');
      console.log(`[deploy][dry-run] app=${plan.app} target=${plan.target ? `${plan.target.id} (${plan.target.domain}${plan.target.routePath})` : '(unresolved)'}`);
      console.log(`[deploy][dry-run] intendedSha=${plan.intendedSha || '(none)'} buildInfoSha=${plan.buildInfoSha || '(none)'} releaseId=${plan.releaseId || '(none)'}`);
      console.log(`[deploy][dry-run] source=${plan.sourceDir || '(none)'} files=${plan.manifest ? plan.manifest.fileCount : 0} buildInfo=${plan.manifest ? plan.manifest.hasBuildInfo : false}`);
      console.log(`[deploy][dry-run] secretScan findings=${plan.secretScan.findings}`);
      console.log(`[deploy][dry-run] credentials=${creds.masked} (never used in dry-run)`);
      if (problems.length) {
        for (const p of problems) console.log(`[deploy][dry-run] plan issue: ${p}`);
        console.log('[deploy][dry-run] plan INCOMPLETE (dry-run still made zero network calls)');
      } else {
        console.log('[deploy][dry-run] plan OK');
      }
    }, payload);

    // A dry run is a validation, not a deploy: it succeeds as long as it
    // performed zero network mutation, regardless of whether the plan is
    // deploy-ready. Exit 0 so ordinary validation cannot be made to fail by a
    // not-yet-built dist.
    process.exit(0);
    return;
  }

  // ---- EXECUTE: mutating deploy (guarded; disabled in G2.3A) -------------
  // Print the intended target/identity BEFORE constructing the gate.
  console.log('[deploy][execute] mutation requested — validating explicit authorization inputs');
  console.log(`[deploy][execute] app=${app} environment=${environment || '(missing)'} authorization=${authorization ? '(provided)' : '(missing)'}`);
  console.log(`[deploy][execute] intendedSha=${intendedSha || '(missing)'}`);
  const target = TARGETS[String(environment || '').trim()];
  console.log(`[deploy][execute] target=${target ? `${target.id} (${target.domain}${target.routePath})` : '(unresolved)'}`);

  // Validate the plan first (still no network).
  const sourceDir = APPS[app] ? APPS[app].sourceDir : undefined;
  const planResult = planDeployment({ app, environment, authorization, intendedSha, releaseId, sourceDir });
  if (!planResult.ok) {
    console.error('[deploy][execute] STOP — plan is not deploy-ready:');
    for (const p of planResult.problems) console.error(`  - ${p}`);
    process.exit(2);
    return;
  }

  let gate;
  try {
    const isMil = String(environment || '').trim() === 'mil-staging';
    const acknowledged = isMil
      ? args['i-understand-mil-staging'] === true
      : args['i-understand-production'] === true;
    gate = createMutationGate({
      environment,
      authorization,
      intendedSha,
      acknowledged,
    });
  } catch (err) {
    console.error(`[deploy][execute] STOP — ${err.message}`);
    process.exit(2);
    return;
  }

  const creds = loadCredentials();
  console.log(`[deploy][execute] target=${gate.target.id} domain=${gate.target.domain} intendedSha=${gate.intendedSha}`);
  console.log(`[deploy][execute] credentials=${creds.masked}`);

  // The mutating path is committed but not exercised in G2.3A. An archive must
  // be pre-built and secret-scanned by the operator phase (G2.3C); it is not
  // built here. resolveHostingerUsername is referenced to keep the gated call
  // surface honest for later phases.
  void resolveHostingerUsername;
  const archivePath = typeof args.archive === 'string' ? args.archive : undefined;
  if (!archivePath) {
    console.error('[deploy][execute] STOP — no --archive provided. Archive building/upload is a G2.3C operator action; not performed in G2.3A.');
    process.exit(2);
    return;
  }
  await executeDeploy(gate, creds, { archivePath });
}

main().catch((err) => {
  console.error(`[deploy] ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
