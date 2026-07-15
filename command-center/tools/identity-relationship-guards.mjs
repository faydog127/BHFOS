#!/usr/bin/env node
/**
 * R1C — Identity & relationship regression guards.
 *
 * Scans active Command Center source for forbidden V1 patterns from:
 * - R1A property relationship contract
 * - R1B technician identity contract
 *
 * Usage:
 *   node tools/identity-relationship-guards.mjs
 *   node tools/identity-relationship-guards.mjs --json
 *
 * Exit 0 when clean; exit 1 when offenders found.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
export const commandCenterRoot = path.resolve(toolsDir, '..');
export const srcRoot = path.join(commandCenterRoot, 'src');

const isCommentLine = (line) => {
  const trimmed = String(line || '').trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*/')
  );
};

const walkJsFiles = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
};

/** Paths relative to command-center that may document banned patterns safely. */
const ALLOWLIST_RELATIVE = new Set([
  'src/lib/technicianIdentity.js',
  'src/lib/inspectionFieldAddress.js',
  'tools/identity-relationship-guards.mjs',
]);

/**
 * Property relationship forbidden patterns (active code only).
 * Approved replacement: inspectionFieldAddress / LEAD_*_SELECT helpers;
 * never join leads.property_id → properties.id.
 */
export const PROPERTY_RULES = [
  {
    id: 'property_embed_property_id',
    pattern: /property\s*:\s*property_id\s*\(/,
    message: 'Banned PostgREST embed property:property_id(...).',
    approved:
      'Use LEAD_FIELD_SELECT / LEAD_ADDRESS_SELECT and resolveLegacyServiceAddress / hydrateLeadsWithProperties.',
  },
  {
    id: 'properties_fk_leads',
    pattern: /properties!fk_leads_property/,
    message: 'Banned properties!fk_leads_property embed from leads.',
    approved: 'Select lead address / property_formatted_address; treat property_id as opaque.',
  },
  {
    id: 'properties_fk_invoices',
    pattern: /properties!fk_invoices_property/,
    message: 'Banned properties!fk_invoices_property embed from invoices.',
    approved: 'Use invoice/lead denormalized address fields via resolveLegacyServiceAddress.',
  },
  {
    id: 'jobs_properties_address1',
    pattern: /properties\s*\(\s*address1/,
    message: 'Banned nested properties(address1…) embed (column does not exist in production).',
    approved: 'Use jobs.service_address / lead property_formatted_address / leads.address.',
  },
];

/**
 * Technician identity forbidden patterns (active code only).
 * Approved: auth user → technicians.user_id → technicians.id;
 * assignment columns store technicians.id only.
 */
export const TECHNICIAN_RULES = [
  {
    id: 'select_value_tech_user_id',
    pattern: /value=\{(?:tech|technician)\.user_id\}/,
    message: 'Assignment SelectItem must not use technicians.user_id as its value.',
    approved: 'Use value={tech.id} / value={technician.id} (roster id).',
  },
  {
    id: 'select_value_dispatch_id',
    pattern: /value=\{(?:tech|technician)\.dispatch_id\}/,
    message: 'Assignment SelectItem must not use dispatch_id (legacy user_id alias).',
    approved: 'Use value={technician.id} via technicianIdentity helpers.',
  },
  {
    id: 'dispatch_id_user_id_fallback',
    pattern: /dispatch_id\s*:\s*(?:tech|technician)\.user_id/,
    message: 'Banned dispatch_id fallback that prefers technicians.user_id.',
    approved: 'Write technicians.id only; do not invent dispatch_id aliases.',
  },
  {
    id: 'write_technician_id_user_id',
    pattern: /technician_id\s*:\s*(?:tech|technician)\.user_id\b/,
    message: 'Banned write of technicians.user_id into technician_id assignment columns.',
    approved: 'Write technicians.id (resolveTechnicianSelectValue / resolveTechnicianRosterId).',
  },
  {
    id: 'filter_technician_id_by_user_id',
    pattern: /\.eq\(\s*['"]technician_id['"]\s*,\s*(?:user\.id|user\?\.id|authUserId)\s*\)/,
    message: 'Banned filtering assignment technician_id by auth user id.',
    approved:
      'Resolve auth user → technicians.user_id → technicians.id, then .eq("technician_id", rosterId).',
  },
  {
    id: 'user_id_or_id_dispatch',
    pattern: /(?:tech|technician)\.user_id\s*\|\|\s*(?:tech|technician)\.id/,
    message: 'Banned user_id || id assignment preference (writes auth id when login linked).',
    approved: 'Always prefer technicians.id for assignment values.',
  },
];

export const ASSIGNMENT_WRITER_FILES = [
  'src/pages/crm/Jobs.jsx',
  'src/pages/crm/Schedule.jsx',
];

/**
 * Scan active src for forbidden patterns.
 * @returns {{ ok: boolean, offenders: Array<object>, scannedFiles: number }}
 */
export function scanIdentityRelationshipGuards({
  root = commandCenterRoot,
  sourceDir = path.join(root, 'src'),
} = {}) {
  const offenders = [];
  const files = walkJsFiles(sourceDir);

  for (const file of files) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    if (ALLOWLIST_RELATIVE.has(relative)) continue;

    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);

    lines.forEach((line, idx) => {
      if (isCommentLine(line)) return;

      for (const rule of PROPERTY_RULES) {
        if (rule.pattern.test(line)) {
          offenders.push({
            domain: 'property',
            ruleId: rule.id,
            file: relative,
            line: idx + 1,
            snippet: line.trim().slice(0, 160),
            message: rule.message,
            approved: rule.approved,
          });
        }
      }

      for (const rule of TECHNICIAN_RULES) {
        if (rule.pattern.test(line)) {
          offenders.push({
            domain: 'technician',
            ruleId: rule.id,
            file: relative,
            line: idx + 1,
            snippet: line.trim().slice(0, 160),
            message: rule.message,
            approved: rule.approved,
          });
        }
      }
    });
  }

  // Affirmative checks: known assignment writers must use shared helper.
  for (const relative of ASSIGNMENT_WRITER_FILES) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) {
      offenders.push({
        domain: 'technician',
        ruleId: 'missing_assignment_writer',
        file: relative,
        line: 0,
        snippet: '',
        message: 'Expected assignment writer file is missing.',
        approved: 'Restore Jobs.jsx / Schedule.jsx with technicianIdentity usage.',
      });
      continue;
    }
    const source = fs.readFileSync(full, 'utf8');
    if (!source.includes("from '@/lib/technicianIdentity'") && !source.includes('from "@/lib/technicianIdentity"')) {
      offenders.push({
        domain: 'technician',
        ruleId: 'assignment_writer_missing_helper',
        file: relative,
        line: 0,
        snippet: '',
        message: 'Assignment writer must import @/lib/technicianIdentity.',
        approved: 'Use resolveTechnicianSelectValue / TECHNICIAN_ROSTER_SELECT.',
      });
    }
    if (!source.includes('value={tech.id}') && !source.includes('value={technician.id}')) {
      offenders.push({
        domain: 'technician',
        ruleId: 'assignment_writer_missing_roster_select',
        file: relative,
        line: 0,
        snippet: '',
        message: 'Assignment writer must use SelectItem value={tech.id} or value={technician.id}.',
        approved: 'Roster id only — never user_id.',
      });
    }
  }

  return {
    ok: offenders.length === 0,
    offenders,
    scannedFiles: files.length,
  };
}

export function formatOffenders(offenders) {
  return offenders
    .map(
      (o) =>
        `${o.file}:${o.line || '?'} [${o.domain}/${o.ruleId}] ${o.message}\n` +
        `  snippet: ${o.snippet || '(n/a)'}\n` +
        `  approved: ${o.approved}`,
    )
    .join('\n\n');
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const jsonMode = process.argv.includes('--json');
  const result = scanIdentityRelationshipGuards();
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(
      `IDENTITY RELATIONSHIP GUARDS: PASSED (${result.scannedFiles} files scanned)`,
    );
  } else {
    console.error('IDENTITY RELATIONSHIP GUARDS: FAILED\n');
    console.error(formatOffenders(result.offenders));
    console.error(`\n${result.offenders.length} offender(s) in ${result.scannedFiles} files.`);
  }
  process.exit(result.ok ? 0 : 1);
}
