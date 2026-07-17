#!/usr/bin/env node
import {
  selfTest,
  invokeAllowlisted,
  resolveAllowedPath,
  PRODUCTION_PROJECT_REF,
} from './adapter.mjs';

const args = process.argv.slice(2);

function usage() {
  console.log(`supabase-diagnostics-adapter (G2.3B-B2D)

Commands:
  --self-test                 Run allowlist/deny proofs (no credential)
  --dry-run <operation>       Resolve allowlisted path for locked production ref
  project-status              Live call (requires authorized OAuth access token)
  project-health

Project ref is hard-locked to ${PRODUCTION_PROJECT_REF}.
Agent-supplied --ref= is rejected unless it exactly matches the lock (and is unnecessary).

Environment (live only, after separate Founder auth + AG):
  I2_SUPABASE_OAUTH_ACCESS_TOKEN   Bearer token (never pass on CLI)
  SUPABASE_DIAGNOSTICS_PROJECT_REF Must be ${PRODUCTION_PROJECT_REF} when set
  SUPABASE_ADAPTER_DRY_RUN=1       Force dry-run

Never pass tokens on the command line.
`);
}

function getAgentRef(argv) {
  const hit = argv.find((a) => a.startsWith('--ref='));
  return hit ? hit.slice('--ref='.length) : undefined;
}

async function main() {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  if (args.includes('--self-test')) {
    const result = await selfTest();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  const agentRef = getAgentRef(args);

  if (args[0] === '--dry-run') {
    const operation = args[1];
    try {
      const out = await invokeAllowlisted(operation, { agentRef, dryRun: true });
      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
    } catch (e) {
      console.error(String(e.message || e));
      process.exit(1);
    }
  }

  const map = {
    'project-status': 'project_status',
    'project-health': 'project_health',
  };
  const op = map[args[0]];
  if (!op) {
    usage();
    process.exit(2);
  }
  try {
    resolveAllowedPath(op, { agentRef });
    const out = await invokeAllowlisted(op, { agentRef, dryRun: false });
    console.log(JSON.stringify(out, null, 2));
    process.exit(out.ok ? 0 : 1);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}

main();
