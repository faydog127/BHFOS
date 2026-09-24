import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const latch = readFileSync(join(dir, '00-incremental-latch.sql'), 'utf8');
const sms = readFileSync(join(dir, '98-internal-sms.sql'), 'utf8');
const extra = readFileSync(join(dir, '97-consolidated-directive.sql'), 'utf8');
const output = `${latch.trim()}\n\n${sms.trim()}\n\n${extra.trim()}\n`;
const target = join(dir, '20260924_tvg_email_pass1_incremental.sql');
writeFileSync(target, output);
process.stdout.write(`wrote ${target}\n`);
