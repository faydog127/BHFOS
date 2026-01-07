import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateServiceReportHtml } from '../src/templates/ServiceReportTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const samplePayload = {
  customerName: 'Jane Doe',
  serviceAddress: '123 Palm St, Melbourne, FL',
  serviceDate: 'Jan 5, 2026',
  technicianName: 'Alex Technician',
  workOrder: 'WO-1042',
  primaryConcern: 'Dryer taking too long to dry',
  serviceType: 'Dryer Vent & Duct Cleaning',
  summary: 'Removed severe lint blockage and restored safe airflow.',
  criticalRisk: 'Vent screen at roof exhaust posed a fire hazard; removed per code.',
  findingsBefore: [
    'Heavy lint accumulation at roof vent screen.',
    'Airflow nearly fully obstructed.',
  ],
  findingsAfter: [
    'Duct interior is clear and unobstructed.',
    'Exhaust housing lint removed; no screen remains.',
  ],
  keyImprovements: 'Restored full airflow; removed non-compliant screen.',
  remainingConcerns: 'Minor residual dust; no impact on operation.',
  recommendations:
    'Do not reinstall vent screens at exhaust termination. Schedule annual cleaning.',
  technicianNotes: 'Customer previously replaced a dryer due to restriction warnings.',
  beforePhotos: ['https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=900'],
  afterPhotos: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900'],
  signatureName: 'Alex Technician',
  brandContext: { company_name: 'The Vent Guys' },
};

async function run() {
  const html = generateServiceReportHtml(samplePayload);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1700, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outPath = path.join(__dirname, '..', 'sample-service-report.pdf');
  await page.pdf({
    path: outPath,
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0in', bottom: '0in', left: '0in', right: '0in' },
  });

  await browser.close();
  console.log(`Sample report saved to ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
