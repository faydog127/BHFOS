#!/usr/bin/env node
import { selfTest, invokeAllowlisted, resolveAllowedPath, assertNotProhibited } from './adapter.mjs';

const args = process.argv.slice(2);

function usage() {
  console.log(`supabase-diagnostics-adapter (G2.3B-B2C)

Commands:
  --self-test                         Run allowlist/deny proofs (no credential)
  --dry-run <operation> --ref=<ref>   Resolve allowlisted path only
  project-status --ref=<ref>          Live call (requires authorized token — not B2C)
  project-health --ref=<ref>
  edge-function-inventory --ref=<ref>

Environment (live only, after separate Founder auth):
  SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN  Internal credential (never pass on CLI)
  SUPABASE_ADAPTER_DRY_RUN=1          Force dry-run

Never pass tokens on the command line.
`);
}

function getRef(argv) {
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

  if (args[0] === '--dry-run') {
    const operation = args[1];
    const ref = getRef(args);
    const out = await invokeAllowlisted(operation, { ref, dryRun: true });
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }

  const map = {
    'project-status': 'project_status',
    'project-health': 'project_health',
    'edge-function-inventory': 'edge_function_inventory',
  };
  const op = map[args[0]];
  if (!op) {
    usage();
    process.exit(2);
  }
  const ref = getRef(args);
  try {
    // Resolve first so deny is clear even without token
    resolveAllowedPath(op, { ref });
    assertNotProhibited(resolveAllowedPath(op, { ref }).path);
    const out = await invokeAllowlisted(op, { ref, dryRun: false });
    console.log(JSON.stringify(out, null, 2));
    process.exit(out.ok ? 0 : 1);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}

main();
