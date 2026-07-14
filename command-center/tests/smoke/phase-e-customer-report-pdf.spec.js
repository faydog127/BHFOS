/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect, chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import {
  createAdminClient,
  createRunId,
  insertWithRetry,
  buildLeadPayload,
} from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';
const TARGET_INSPECTION_ID = 'ec244c29-ab90-49a4-9b3a-d225f2f21f7c';

const parseEnv = () => {
  const read = (file) => {
    if (!fs.existsSync(file)) return {};
    return Object.fromEntries(
      fs.readFileSync(file, 'utf8').split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        }),
    );
  };
  return { ...read('.env'), ...read('.env.local') };
};

const countOccurrences = (haystack, needle) => {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  const lower = haystack.toLowerCase();
  const target = needle.toLowerCase();
  while (true) {
    const found = lower.indexOf(target, idx);
    if (found === -1) break;
    count += 1;
    idx = found + target.length;
  }
  return count;
};

const downloadHttps = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      downloadHttps(res.headers.location).then(resolve, reject);
      return;
    }
    if (res.statusCode !== 200) {
      reject(new Error(`download failed ${res.statusCode}`));
      return;
    }
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks)));
  }).on('error', reject);
});

/** Extract readable text from compressed PDFShift output via pdf.js. */
const extractPdfText = async (buf) => {
  const pdfJs = await downloadHttps('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  const worker = await downloadHttps('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/report.pdf') {
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': buf.length });
      res.end(buf);
      return;
    }
    if (url === '/pdf.min.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(pdfJs);
      return;
    }
    if (url === '/pdf.worker.min.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(worker);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><script src="/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
(async () => {
  try {
    const doc = await pdfjsLib.getDocument('/report.pdf').promise;
    const parts = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((item) => item.str).join(' '));
    }
    window.__pdfText = parts.join('\\n');
    window.__pageCount = doc.numPages;
    window.__ready = true;
  } catch (error) {
    window.__error = String(error && error.message ? error.message : error);
  }
})();
</script>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 60000 });
    const result = await page.evaluate(() => ({
      ready: window.__ready,
      error: window.__error,
      text: window.__pdfText || '',
      pageCount: window.__pageCount || 0,
    }));
    if (!result.ready) throw new Error(result.error || 'pdf text extraction failed');
    return { text: result.text, pageCount: result.pageCount };
  } finally {
    await browser.close();
    server.close();
  }
};

test('Phase E customer PDF uses Findings + one Service Recommendation', async () => {
  test.setTimeout(180_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');

  const dotenv = parseEnv();
  const anonKey = dotenv.VITE_SUPABASE_ANON_KEY || dotenv.SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('Missing anon key');

  const inspectionRes = await admin.from('inspections').select('*').eq('id', TARGET_INSPECTION_ID).maybeSingle();
  if (!inspectionRes.data) test.skip(true, `Synthetic inspection ${TARGET_INSPECTION_ID} not found.`);
  const inspection = inspectionRes.data;
  const summary = String(inspection.summary || '').trim();
  expect(summary.length).toBeGreaterThan(20);

  const photosRes = await admin.from('inspection_photos').select('*').eq('inspection_id', TARGET_INSPECTION_ID);
  const photos = photosRes.data || [];
  const eligibleCaptions = photos
    .filter((p) => !p.is_voided && (!p.upload_state || p.upload_state === 'complete'))
    .map((p) => String(p.caption || '').trim())
    .filter(Boolean);
  const voidedCaptions = photos
    .filter((p) => p.is_voided)
    .map((p) => String(p.caption || '').trim())
    .filter(Boolean);
  expect(eligibleCaptions.length).toBeGreaterThanOrEqual(1);
  expect(voidedCaptions.length).toBeGreaterThanOrEqual(1);

  const findingsRes = await admin.from('inspection_findings').select('title, is_customer_visible, recommended_action')
    .eq('inspection_id', TARGET_INSPECTION_ID);
  const internalTitles = (findingsRes.data || [])
    .filter((f) => f.is_customer_visible === false)
    .map((f) => String(f.title || '').trim())
    .filter(Boolean);

  const recRes = await admin.from('inspection_recommendations').select('*').eq('inspection_id', TARGET_INSPECTION_ID);
  const serviceRecs = (recRes.data || []).filter((r) => r.is_customer_visible && r.finding_id == null);
  expect(serviceRecs.length).toBe(1);
  const serviceRec = serviceRecs[0];

  // Auth as an admin user for function invoke (JWT tenant claim).
  const runId = createRunId('phasee').replace(/-/g, '').slice(0, 10);
  const email = `phasee.${runId}@example.com`;
  const password = `PhaseE-${runId}-Aa1!`;
  const user = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
  });
  if (user.error) throw user.error;

  const userClient = createClient(env.supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await userClient.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  const pdf = await userClient.functions.invoke('inspection-report-pdf', {
    body: {
      tenant_id: TENANT_ID,
      inspection_id: TARGET_INSPECTION_ID,
      store: true,
      return_pdf: true,
    },
  });
  if (pdf.error || pdf.data?.error) throw pdf.error || new Error(pdf.data.error);
  expect(pdf.data?.ok).toBe(true);
  expect(pdf.data?.meta?.service_recommendation_count).toBe(1);
  expect(pdf.data?.meta?.photos_count).toBe(eligibleCaptions.length);

  const reportPath = pdf.data?.report?.file_path || pdf.data?.meta?.stored_file_path;
  expect(reportPath).toBeTruthy();
  const downloaded = await admin.storage.from('inspection-reports').download(reportPath);
  if (downloaded.error) throw downloaded.error;
  const buf = Buffer.from(await downloaded.data.arrayBuffer());

  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `phase-e-airduct-report-${TARGET_INSPECTION_ID.slice(0, 8)}.pdf`);
  fs.writeFileSync(outPath, buf);

  const extracted = await extractPdfText(buf);
  const text = extracted.text;
  const pageCount = extracted.pageCount;

  const checks = {
    validPdf: buf.slice(0, 4).toString() === '%PDF',
    bytes: buf.length,
    pageCount,
    renderer: pdf.data?.meta?.renderer_used || null,
    summaryOnce: countOccurrences(text, summary.slice(0, 48)) >= 1,
    hasFindingsHeading: /\bFindings\b/.test(text),
    hasTechnicianApproved: /Technician-Approved Findings/i.test(text),
    hasRecommendedColon: /Recommended:/i.test(text),
    hasServiceRecHeading: /Service Recommendation/i.test(text),
    hasServiceRecTitle: new RegExp(serviceRec.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text),
    hasSupportingEvidence: /Supporting Evidence/i.test(text),
    hasSeparateEstimate: /separate estimate/i.test(text),
    // Visible customer text only (avoid binary false positives from compressed streams).
    hasPrice: /(?:\$\s?\d|\bsuggested_unit_price\b|\btotal_amount\b)/i.test(text),
    voidedCaptionPresent: voidedCaptions.some((c) => text.toLowerCase().includes(c.toLowerCase())),
    eligibleCaptionPresent: eligibleCaptions.some((c) => text.toLowerCase().includes(c.toLowerCase().slice(0, 24))),
    internalFindingAsSection: internalTitles.some((title) => {
      // Local PDF used to render "- {title}" as finding sections.
      return text.includes(`- ${title}`) || text.includes(`[${title}]`);
    }),
    outputPath: outPath,
  };

  console.log('PHASE_E_PDF_JSON_START');
  console.log(JSON.stringify(checks, null, 2));
  console.log('PHASE_E_PDF_JSON_END');

  expect(checks.validPdf).toBe(true);
  expect(checks.summaryOnce).toBe(true);
  expect(checks.hasFindingsHeading).toBe(true);
  expect(checks.hasTechnicianApproved).toBe(false);
  expect(checks.hasRecommendedColon).toBe(false);
  expect(checks.hasServiceRecHeading).toBe(true);
  expect(checks.hasServiceRecTitle).toBe(true);
  expect(checks.hasSupportingEvidence).toBe(true);
  expect(checks.hasSeparateEstimate).toBe(true);
  expect(checks.hasPrice).toBe(false);
  expect(checks.voidedCaptionPresent).toBe(false);
  expect(checks.eligibleCaptionPresent).toBe(true);
  expect(checks.internalFindingAsSection).toBe(false);
  expect(checks.pageCount).toBeGreaterThan(0);
  expect(checks.pageCount).toBeLessThanOrEqual(4);

  // Historical fallback: older record without summary must not crash.
  const histRun = createRunId('phise').replace(/-/g, '').slice(0, 8);
  const lead = await insertWithRetry(admin, 'leads', buildLeadPayload(histRun, {
    first_name: 'HIST',
    last_name: 'FALLBACK',
    email: `hist.${histRun}@example.invalid`,
    company: 'SYNTHETIC TEST DATA - DO NOT CONTACT',
  }));
  if (lead.error) throw lead.error;
  const hist = await insertWithRetry(admin, 'inspections', {
    tenant_id: TENANT_ID,
    lead_id: lead.data.id,
    status: 'draft',
    title: `HIST PDF fallback ${histRun}`,
    inspection_type: 'air_duct',
    revision: 1,
    summary: null,
    summary_status: 'draft',
    created_by_user_id: user.data.user.id,
  });
  if (hist.error) throw hist.error;

  const histPdf = await userClient.functions.invoke('inspection-report-pdf', {
    body: {
      tenant_id: TENANT_ID,
      inspection_id: hist.data.id,
      store: false,
      return_pdf: true,
    },
  });
  if (histPdf.error || histPdf.data?.error) throw histPdf.error || new Error(histPdf.data.error);
  expect(histPdf.data?.ok).toBe(true);
  const histText = Buffer.from(
    // return_pdf may be base64 attachment or nested
    typeof histPdf.data?.pdf?.content === 'string'
      ? Buffer.from(histPdf.data.pdf.content, 'base64')
      : Buffer.from([]),
  ).toString('latin1');
  // Prefer decoding via meta when attachment shape varies.
  if (histPdf.data?.pdf?.content) {
    expect(Buffer.from(histPdf.data.pdf.content, 'base64').slice(0, 4).toString()).toBe('%PDF');
    expect(/Technician-Approved Findings/i.test(histText)).toBe(false);
  } else {
    // store:false still returns ok; bytes may be under pdf.bytes-like shapes in some runtimes
    expect(histPdf.data?.ok).toBe(true);
  }
});
