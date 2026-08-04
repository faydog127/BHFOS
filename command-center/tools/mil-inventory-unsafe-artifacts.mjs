#!/usr/bin/env node
/**
 * mil-inventory-unsafe-artifacts.mjs
 *
 * Read-only inventory of local mil-production zip packages.
 * Marks known stale 5a5653e archives as: UNSAFE — DO NOT DEPLOY
 * Does NOT delete anything.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventoryMilPackages, parseCliArgs } from './mil-control-plane.mjs';
import { commandCenterRoot } from './deploy-lib.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const defaults = [
    path.join(commandCenterRoot, 'tmp'),
    path.resolve(commandCenterRoot, '..', '..', 'BHFOS-media-intel-phase2a', 'command-center', 'tmp'),
    path.resolve(commandCenterRoot, '..', '..', 'BHFOS-media-intel-phase2a-deploy', 'command-center', 'tmp'),
    path.resolve(commandCenterRoot, '..', '..', 'BHFOS-media-intel', 'command-center', 'tmp'),
  ];
  const roots = args.root
    ? [path.resolve(String(args.root))]
    : defaults;

  const items = inventoryMilPackages(roots);
  const report = {
    ok: true,
    readOnly: true,
    generatedAt: new Date().toISOString(),
    policy: 'Deletion of unsafe artifacts requires separate owner authorization. Do not auto-delete.',
    count: items.length,
    items,
  };
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (err) {
  console.error(`[mil-inventory-unsafe-artifacts] ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
}
