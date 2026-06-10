import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Upload } from 'tus-js-client';
import { loadEnvFiles } from './env.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
export const commandCenterRoot = path.resolve(toolsDir, '..');
export const repoRoot = path.resolve(commandCenterRoot, '..');
export const tmpDir = path.join(commandCenterRoot, 'tmp');

loadEnvFiles({ cwd: commandCenterRoot });

export const DEFAULT_DOMAIN = process.env.HOSTINGER_DOMAIN || 'app.bhfos.com';
const HOSTINGER_TOKEN = process.env.HOSTINGER_API_TOKEN || process.env.API_TOKEN || '';
const HOSTINGER_API_BASE = 'https://developers.hostinger.com/api/hosting/v1';

export const APPS = {
  crm: {
    name: 'crm',
    label: 'CRM',
    mountPath: '',
    routePath: '/',
    identityText: 'The Vent Guys CRM',
    sourceDir: path.join(commandCenterRoot, 'dist'),
    projectRoot: commandCenterRoot,
    buildCommand: ['npm', 'run', 'build'],
  },
  tis: {
    name: 'tis',
    label: 'TIS',
    mountPath: 'tis',
    routePath: '/tis/',
    identityText: 'TIS Field Scouting',
    sourceDir: path.join(repoRoot, 'TIS', 'dist'),
    projectRoot: path.join(repoRoot, 'TIS'),
    buildCommand: ['npm', 'run', 'build'],
  },
};

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (const value of argv) {
    if (!value.startsWith('--')) {
      args._.push(value);
      continue;
    }
    const trimmed = value.slice(2);
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      args[trimmed] = true;
      continue;
    }
    args[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return args;
}

export function timestampSlug() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ];
  return parts.join('');
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label || 'Path'} not found: ${targetPath}`);
  }
}

export function copyDirContents(sourceDir, targetDir) {
  assertExists(sourceDir, 'Source directory');
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
  }
}

export async function runCommand(command, args = [], options = {}) {
  const {
    cwd = commandCenterRoot,
    env = process.env,
    captureOutput = false,
  } = options;

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput) {
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if ((code ?? 1) !== 0) {
        const error = new Error(`Command failed (${code ?? 1}): ${command} ${args.join(' ')}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function buildApp(appName) {
  const app = APPS[appName];
  if (!app) throw new Error(`Unknown app: ${appName}`);
  await runCommand(app.buildCommand[0], app.buildCommand.slice(1), { cwd: app.projectRoot });
}

function extractAssetRefsFromHtml(html) {
  const refs = new Set();
  const patterns = [
    /(?:src|href)\s*=\s*"(\/[^"]+)"/gi,
    /(?:src|href)\s*=\s*'(\/[^']+)'/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(String(html || '')))) {
      const ref = match[1];
      if (/\.(?:js|css|wasm)$/i.test(ref)) {
        refs.add(ref);
      }
    }
  }

  return [...refs].sort();
}

function compareRefSets(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((item) => !actualSet.has(item)),
    extra: actual.filter((item) => !expectedSet.has(item)),
  };
}

function appUrl(domain, routePath) {
  const base = domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;
  return new URL(routePath, base).toString();
}

export async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'bhfos-multi-app-deploy/1.0',
      'Cache-Control': 'no-cache',
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }
  return { response, text };
}

export async function getLiveAppSnapshot(appName, domain = DEFAULT_DOMAIN) {
  const app = APPS[appName];
  if (!app) throw new Error(`Unknown app: ${appName}`);
  const { text } = await fetchText(appUrl(domain, app.routePath));
  return {
    appName,
    html: text,
    refs: extractAssetRefsFromHtml(text),
    identityPresent: text.includes(app.identityText),
  };
}

export function getLocalAppSnapshot(appName, sourceDir = APPS[appName]?.sourceDir) {
  const app = APPS[appName];
  if (!app) throw new Error(`Unknown app: ${appName}`);
  const indexPath = path.join(sourceDir, 'index.html');
  assertExists(indexPath, `${app.label} index.html`);
  const html = fs.readFileSync(indexPath, 'utf8');
  return {
    appName,
    html,
    refs: extractAssetRefsFromHtml(html),
    identityPresent: html.includes(app.identityText),
  };
}

export async function assertAppSourceMatchesLive(appName, sourceDir, domain = DEFAULT_DOMAIN) {
  const app = APPS[appName];
  const live = await getLiveAppSnapshot(appName, domain);
  const local = getLocalAppSnapshot(appName, sourceDir);
  const diff = compareRefSets(live.refs, local.refs);

  if (!live.identityPresent) {
    throw new Error(`${app.label} live route is missing identity marker: ${app.identityText}`);
  }
  if (!local.identityPresent) {
    throw new Error(`${app.label} local source is missing identity marker: ${app.identityText}`);
  }
  if (diff.missing.length > 0 || diff.extra.length > 0) {
    throw new Error(
      `${app.label} source drift detected against live. Missing: ${diff.missing.join(', ') || 'none'}. Extra: ${diff.extra.join(', ') || 'none'}.`
    );
  }

  return { live, local };
}

async function listZipEntries(zipPath) {
  const script = [
    "$ErrorActionPreference='Stop'",
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    `$zip = [System.IO.Compression.ZipFile]::OpenRead(${quotePowerShell(zipPath)})`,
    'try { $zip.Entries | ForEach-Object { $_.FullName } } finally { $zip.Dispose() }',
  ].join('; ');

  const { stdout } = await runCommand('powershell', ['-NoProfile', '-Command', script], {
    cwd: commandCenterRoot,
    captureOutput: true,
  });

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function findMatchingCrmArchive(domain = DEFAULT_DOMAIN) {
  const live = await getLiveAppSnapshot('crm', domain);
  const requiredRefs = live.refs.map((ref) => ref.replace(/^\//, ''));
  const candidates = fs
    .readdirSync(tmpDir)
    .filter((name) => /^dist-deploy-.*\.zip$/i.test(name))
    .map((name) => ({
      name,
      path: path.join(tmpDir, name),
      mtimeMs: fs.statSync(path.join(tmpDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of candidates) {
    const entries = await listZipEntries(candidate.path);
    if (requiredRefs.every((ref) => entries.includes(ref))) {
      return candidate.path;
    }
  }

  throw new Error(`No CRM archive in ${tmpDir} matches live root asset refs: ${requiredRefs.join(', ')}`);
}

export async function extractZipToDirectory(zipPath, destinationDir) {
  ensureDir(destinationDir);
  const script = [
    "$ErrorActionPreference='Stop'",
    `Expand-Archive -LiteralPath ${quotePowerShell(zipPath)} -DestinationPath ${quotePowerShell(destinationDir)} -Force`,
  ].join('; ');
  await runCommand('powershell', ['-NoProfile', '-Command', script], { cwd: commandCenterRoot });
}

export async function createZipFromDirectory(sourceDir, zipPath) {
  const script = [
    "$ErrorActionPreference='Stop'",
    `if (Test-Path ${quotePowerShell(zipPath)}) { Remove-Item -LiteralPath ${quotePowerShell(zipPath)} -Force }`,
    `Get-ChildItem -LiteralPath ${quotePowerShell(sourceDir)} -Force | Compress-Archive -DestinationPath ${quotePowerShell(zipPath)} -Force`,
  ].join('; ');
  await runCommand('powershell', ['-NoProfile', '-Command', script], { cwd: commandCenterRoot });
}

export function stageApps(label, appSources) {
  const stageDir = path.join(tmpDir, `deploy-stage-${timestampSlug()}-${label}`);
  ensureDir(stageDir);

  for (const source of appSources) {
    const mountPath = source.mountPath || '';
    const targetDir = mountPath ? path.join(stageDir, mountPath) : stageDir;
    copyDirContents(source.sourceDir, targetDir);
  }

  return stageDir;
}

export async function materializeLiveCrmSource(domain = DEFAULT_DOMAIN) {
  const archivePath = await findMatchingCrmArchive(domain);
  const extractDir = path.join(tmpDir, `crm-live-${timestampSlug()}`);
  await extractZipToDirectory(archivePath, extractDir);
  return { sourceDir: extractDir, archivePath };
}

async function hostingerRequest(url, { method = 'GET', body, headers } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${HOSTINGER_TOKEN}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Hostinger request failed (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return data;
}

export async function resolveHostingerUsername(domain = DEFAULT_DOMAIN) {
  if (process.env.HOSTINGER_USERNAME) return process.env.HOSTINGER_USERNAME;
  if (!HOSTINGER_TOKEN) {
    throw new Error('Missing HOSTINGER_API_TOKEN (or API_TOKEN).');
  }

  const url = `${HOSTINGER_API_BASE}/websites?domain=${encodeURIComponent(domain)}`;
  const data = await hostingerRequest(url);
  const username = data?.data?.[0]?.username;
  if (!username) {
    throw new Error(`Unable to resolve Hostinger username for ${domain}`);
  }
  return username;
}

export async function fetchUploadCredentials(domain, username) {
  const url = `${HOSTINGER_API_BASE}/files/upload-urls`;
  const data = await hostingerRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { domain, username },
  });

  if (!data?.url || !data?.auth_key || !data?.rest_auth_key) {
    throw new Error(`Invalid upload credentials response for ${domain}`);
  }

  return {
    uploadUrl: String(data.url).replace(/\/$/, ''),
    authKey: data.auth_key,
    restAuthKey: data.rest_auth_key,
  };
}

export async function uploadFileToHostinger(filePath, remotePath, credentials) {
  const size = fs.statSync(filePath).size;
  const targetUrl = `${credentials.uploadUrl}/${normalizePath(remotePath)}?override=true`;
  const headers = {
    'X-Auth': credentials.authKey,
    'X-Auth-Rest': credentials.restAuthKey,
    'upload-length': String(size),
    'upload-offset': '0',
  };

  const createResponse = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: '',
  });

  if (createResponse.status !== 201) {
    const body = await createResponse.text();
    throw new Error(`Upload creation failed (${createResponse.status}) for ${remotePath}: ${body}`);
  }

  await new Promise((resolve, reject) => {
    const upload = new Upload(fs.createReadStream(filePath), {
      uploadUrl: targetUrl,
      retryDelays: [1000, 2000, 4000, 8000, 16000],
      uploadDataDuringCreation: false,
      parallelUploads: 1,
      chunkSize: 10 * 1024 * 1024,
      headers,
      removeFingerprintOnSuccess: true,
      uploadSize: size,
      metadata: {
        filename: path.basename(filePath),
      },
      onError: reject,
      onSuccess: resolve,
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    }).catch(reject);
  });
}

export async function deployArchiveToHostinger(domain, archivePath, username) {
  if (!HOSTINGER_TOKEN) {
    throw new Error('Missing HOSTINGER_API_TOKEN (or API_TOKEN).');
  }

  const resolvedUsername = username || await resolveHostingerUsername(domain);
  const credentials = await fetchUploadCredentials(domain, resolvedUsername);
  const remoteArchivePath = `public_html/${path.basename(archivePath)}`;

  await uploadFileToHostinger(archivePath, remoteArchivePath, credentials);

  const url = `${HOSTINGER_API_BASE}/accounts/${resolvedUsername}/websites/${domain}/deploy`;
  const response = await hostingerRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { archive_path: remoteArchivePath },
  });

  return {
    username: resolvedUsername,
    remoteArchivePath,
    response,
  };
}

export async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyAppLive(appName, domain = DEFAULT_DOMAIN) {
  const app = APPS[appName];
  const snapshot = await getLiveAppSnapshot(appName, domain);
  if (!snapshot.identityPresent) {
    throw new Error(`${app.label} live route is missing identity marker: ${app.identityText}`);
  }

  const base = domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;
  for (const ref of snapshot.refs) {
    const assetUrl = new URL(ref, base).toString();
    const response = await fetch(assetUrl, {
      headers: {
        'User-Agent': 'bhfos-multi-app-deploy/1.0',
        'Cache-Control': 'no-cache',
      },
    });
    if (!response.ok) {
      throw new Error(`${app.label} asset check failed (${response.status}): ${assetUrl}`);
    }
    await response.arrayBuffer();
  }

  return {
    app: appName,
    route: app.routePath,
    refs: snapshot.refs,
  };
}

export async function verifyDeploy(domain = DEFAULT_DOMAIN, apps = ['crm', 'tis']) {
  const results = [];
  for (const appName of apps) {
    results.push(await verifyAppLive(appName, domain));
  }
  return results;
}
