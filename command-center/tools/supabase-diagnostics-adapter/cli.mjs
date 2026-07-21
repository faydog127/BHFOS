#!/usr/bin/env node
import {
  selfTest,
  invokeAllowlisted,
  invokeCatalog,
  resolveAllowedPath,
  listCatalogOperations,
  PRODUCTION_PROJECT_REF,
} from './adapter.mjs';

const args = process.argv.slice(2);

function usage() {
  const catalogOps = listCatalogOperations().join('\n    ');
  console.log(`supabase-diagnostics-adapter (G2.3B-B2D + catalog v3)

Commands:
  --self-test                 Run allowlist/deny/catalog proofs (no credential)
  --dry-run <operation>       Resolve allowlisted GET path for locked production ref
  --dry-run-catalog <op>      Dry-run catalog op (structured params; no SQL)
  project-status              Live GET (requires OAuth access token)
  project-health              Live GET health
  catalog <op>                Live catalog-metadata (requires database_read-scoped token)

Catalog operations (params via --schema= --table= or --name=):
    ${catalogOps}

Project ref is hard-locked to ${PRODUCTION_PROJECT_REF}.
Agent-supplied SQL is always DENY.
Writable /database/query and execute-sql remain DENY.

Environment:
  I2_SUPABASE_OAUTH_ACCESS_TOKEN   Bearer token (never pass on CLI)
  SUPABASE_DIAGNOSTICS_PROJECT_REF Must be ${PRODUCTION_PROJECT_REF} when set
  I2_DIAGNOSTICS_AUDIT_LOG         Optional audit jsonl path
  SUPABASE_ADAPTER_DRY_RUN=1       Force dry-run

Never pass tokens on the command line.
`);
}

function getAgentRef(argv) {
  const hit = argv.find((a) => a.startsWith('--ref='));
  return hit ? hit.slice('--ref='.length) : undefined;
}

function parseCatalogParams(argv) {
  /** @type {Record<string, string>} */
  const params = {};
  for (const a of argv) {
    if (a.startsWith('--schema=')) params.schema = a.slice('--schema='.length);
    else if (a.startsWith('--table=')) params.table = a.slice('--table='.length);
    else if (a.startsWith('--name=')) params.name = a.slice('--name='.length);
    else if (a.startsWith('--sql=') || a.startsWith('--query=')) {
      throw new Error('DENY: agent-supplied SQL flags are prohibited');
    }
  }
  return params;
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

  if (args[0] === '--dry-run-catalog') {
    const operation = args[1];
    try {
      const params = parseCatalogParams(args.slice(2));
      const out = await invokeCatalog(operation, params, { agentRef, dryRun: true });
      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
    } catch (e) {
      console.error(String(e.message || e));
      process.exit(1);
    }
  }

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

  if (args[0] === 'catalog') {
    const operation = args[1];
    try {
      const params = parseCatalogParams(args.slice(2));
      const out = await invokeCatalog(operation, params, { agentRef, dryRun: false });
      console.log(JSON.stringify(out, null, 2));
      process.exit(out.ok ? 0 : 1);
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
