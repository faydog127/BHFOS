import fs from 'node:fs';
import path from 'node:path';

export const parseEnvText = (raw) => {
  const entries = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice('export '.length) : trimmed;
    const idx = withoutExport.indexOf('=');
    if (idx === -1) continue;

    const key = withoutExport.slice(0, idx).trim();
    if (!key) continue;

    let value = withoutExport.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }
  return entries;
};

export const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  return parseEnvText(fs.readFileSync(filePath, 'utf8'));
};

export const loadEnvFiles = ({
  cwd = process.cwd(),
  files = ['.env', '.env.local'],
  override = false,
} = {}) => {
  const merged = {};
  for (const file of files) {
    Object.assign(merged, parseEnvFile(path.join(cwd, file)));
  }

  for (const [key, value] of Object.entries(merged)) {
    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }

  return merged;
};

