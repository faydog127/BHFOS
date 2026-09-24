import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const design = readFileSync(join(root, 'design/02-email-automation-schema.sql'), 'utf8');
const marker = '-- -----------------------------------------------------------------------------\n-- 1) Extensions';
const start = design.indexOf(marker);
if (start < 0) throw new Error('design schema is missing the extensions section marker');
const preamble = readFileSync(join(dir, '00-preamble.sql'), 'utf8');
const postamble = readFileSync(join(dir, '99-postamble.sql'), 'utf8');
const body = design.slice(start);
const output = `${preamble.trim()}\n\n${body.trim()}\n\n${postamble.trim()}\n`;
const target = join(dir, '20260924_tvg_email_pass1_v5.sql');
writeFileSync(target, output);
process.stdout.write(`wrote ${target}\n`);
