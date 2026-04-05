import fs from 'node:fs';
import path from 'node:path';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const domain = arg('domain') || 'app.bhfos.com';
const distDir = path.resolve(arg('dist') || 'dist');
const baseUrl = domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;

const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const listLocalAssetPaths = () => {
  const rootIndexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(rootIndexPath)) {
    throw new Error(`Missing local ${rootIndexPath} (run build first, or point --dist=...)`);
  }

  const localIndexHtml = readText(rootIndexPath);
  const localAssetsDir = path.join(distDir, 'assets');

  const assetFiles =
    fs.existsSync(localAssetsDir)
      ? fs
          .readdirSync(localAssetsDir, { withFileTypes: true })
          .filter((d) => d.isFile())
          .map((d) => `/assets/${d.name}`)
      : [];

  return { localIndexHtml, assetFiles };
};

const extractAssetRefsFromHtml = (html) => {
  const text = String(html || '');
  const refs = new Set();

  const patterns = [
    /(?:src|href)\s*=\s*"(\/assets\/[^"]+)"/gi,
    /(?:src|href)\s*=\s*'(\/assets\/[^']+)'/gi,
  ];

  for (const re of patterns) {
    let m;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(text))) refs.add(m[1]);
  }

  return [...refs].sort();
};

const fetchText = async (url) => {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': 'bhfos-command-center/compare-hostinger-live' },
  });
  const text = await res.text();
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text };
};

const main = async () => {
  const { localIndexHtml, assetFiles: localAssetFiles } = listLocalAssetPaths();
  const localRefs = extractAssetRefsFromHtml(localIndexHtml);

  const liveIndex = await fetchText(`${baseUrl}/`);
  if (liveIndex.status >= 400) {
    throw new Error(`Live fetch failed: GET ${baseUrl}/ -> ${liveIndex.status}`);
  }

  const liveRefs = extractAssetRefsFromHtml(liveIndex.text);

  const localAssetSet = new Set(localAssetFiles);
  const localRefSet = new Set(localRefs);
  const liveRefSet = new Set(liveRefs);

  const onlyInLocalRefs = localRefs.filter((x) => !liveRefSet.has(x));
  const onlyInLiveRefs = liveRefs.filter((x) => !localRefSet.has(x));

  const missingLocalFilesReferenced = localRefs.filter((x) => !localAssetSet.has(x));

  const summary = {
    domain: baseUrl,
    distDir,
    live: {
      status: liveIndex.status,
      cache: liveIndex.headers['x-hcdn-cache-status'] || liveIndex.headers['cf-cache-status'] || null,
      etag: liveIndex.headers.etag || null,
      lastModified: liveIndex.headers['last-modified'] || null,
      assetsReferenced: liveRefs.length,
    },
    local: {
      assetsReferenced: localRefs.length,
      assetsPresentInDist: localAssetFiles.length,
    },
    diff: {
      onlyInLocalRefs,
      onlyInLiveRefs,
      missingLocalFilesReferenced,
      isExactMatch: onlyInLocalRefs.length === 0 && onlyInLiveRefs.length === 0 && missingLocalFilesReferenced.length === 0,
    },
    hint: null,
  };

  if (summary.diff.isExactMatch) {
    summary.hint = 'Live site matches local dist asset references (likely no Hostinger deploy needed).';
  } else {
    summary.hint = 'Live site differs from local dist asset references (Hostinger deploy likely needed).';
  }

  console.log(JSON.stringify(summary, null, 2));
};

await main();

