import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.QUOTE_SAMPLE_URL || 'http://127.0.0.1:4173/quotes/1';
const pngPath = process.env.QUOTE_SAMPLE_PNG || 'tmp/tvg-implemented-quote-sample.png';
const pdfPath = process.env.QUOTE_SAMPLE_PDF || 'tmp/tvg-implemented-quote-sample.pdf';
const htmlPath = process.env.QUOTE_SAMPLE_HTML || 'tmp/tvg-implemented-quote-sample.html';
const brandingDir = path.resolve('public/assets/branding');

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
});

try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 2200 },
    deviceScaleFactor: 2,
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });

  const staticSnapshot = await page.evaluate(() => {
    const shell = document.querySelector('.quote-doc-shell');
    const markup = shell ? shell.outerHTML : '';
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules || [])
            .map((rule) => rule.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .filter(Boolean)
      .join('\n');

    return {
      title: document.title || 'The Vent Guys Quote Sample',
      markup,
      styles,
    };
  });

  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(100);

  const pageLocators = await page.locator('.quote-doc-page').all();
  if (pageLocators.length === 0) {
    throw new Error('No quote document pages found.');
  }

  const pageImagePaths = [];
  for (let index = 0; index < pageLocators.length; index += 1) {
    const pageImagePath = getPageImagePath(pngPath, index + 1);
    await pageLocators[index].screenshot({
      path: pageImagePath,
      animations: 'disabled',
      caret: 'hide',
    });
    pageImagePaths.push(pageImagePath);
  }

  await fs.copyFile(pageImagePaths[0], pngPath);

  await page.pdf({
    path: pdfPath,
    printBackground: true,
    format: 'Letter',
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  const standaloneHtml = await buildStandaloneHtml(staticSnapshot);
  await fs.writeFile(htmlPath, standaloneHtml, 'utf8');

  console.log(`Rendered sample from ${baseUrl}`);
  console.log(`Primary PNG: ${pngPath}`);
  console.log(`Page PNGs: ${pageImagePaths.join(', ')}`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`HTML: ${htmlPath}`);
} finally {
  await browser.close();
}

function getPageImagePath(targetPath, pageNumber) {
  const parsed = path.parse(targetPath);
  return path.join(parsed.dir, `${parsed.name}-page-${pageNumber}${parsed.ext || '.png'}`);
}

async function buildStandaloneHtml(snapshot) {
  const brandingInlineMap = await buildBrandingInlineMap();
  let markup = snapshot.markup;
  let styles = snapshot.styles;

  for (const [assetUrl, dataUrl] of brandingInlineMap.entries()) {
    markup = markup.split(assetUrl).join(dataUrl);
    styles = styles.split(assetUrl).join(dataUrl);
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(snapshot.title)}</title>
    <style>
      ${styles}
      html, body {
        margin: 0;
        padding: 0;
        background: #f1f5f9;
      }
    </style>
  </head>
  <body>
    ${markup}
  </body>
</html>`;
}

async function buildBrandingInlineMap() {
  const entries = await fs.readdir(brandingDir);
  const map = new Map();

  for (const entry of entries) {
    const filePath = path.join(brandingDir, entry);
    const fileBuffer = await fs.readFile(filePath);
    const mimeType = getMimeType(entry);
    if (!mimeType) continue;

    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    map.set(`/assets/branding/${entry}`, dataUrl);
    map.set(`http://127.0.0.1:4173/assets/branding/${entry}`, dataUrl);
    map.set(`http://localhost:4173/assets/branding/${entry}`, dataUrl);
  }

  return map;
}

function getMimeType(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    default:
      return '';
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
